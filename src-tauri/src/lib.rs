// Tauri setup
mod constants;
mod types;
mod util;
mod state;
mod commands;
mod database;
use commands::*;

use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, WindowEvent};
use windows::core::w;
use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

struct InitialFile(std::sync::Mutex<Option<String>>);

#[tauri::command]
fn get_initial_file(state: tauri::State<'_, InitialFile>) -> Option<String> {
    let mut guard = state.0.lock().ok()?;
    guard.take()
}

pub fn run() {
    // A restart spawns the new process before this one exits. Give the
    // single-instance mutex/window time to disappear before registration.
    if std::env::args().any(|arg| arg == "--restart-delay") {
        std::thread::sleep(Duration::from_millis(700));
    }

    let mut context = tauri::generate_context!();
    let identifier = context.config().identifier.clone();
    let system_config = state::system::load_config(&identifier);

    if !system_config.hardware_acceleration && !state::system::safe_mode_enabled() {
        const WRY_DEFAULT_BROWSER_ARGS: &str =
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
        let existing = context
            .config()
            .app
            .windows
            .first()
            .and_then(|window| window.additional_browser_args.clone())
            .unwrap_or_else(|| WRY_DEFAULT_BROWSER_ARGS.to_string());
        let args = if existing.trim().is_empty() {
            format!("{WRY_DEFAULT_BROWSER_ARGS} --disable-gpu")
        } else {
            format!("{existing} --disable-gpu")
        };
        if let Some(window) = context.config_mut().app.windows.first_mut() {
            window.additional_browser_args = Some(args);
        }
    }

    let config_for_setup = system_config.clone();
    let mut builder = tauri::Builder::default();
    if system_config.single_instance {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            if let Some(file) = argv.iter().skip(1).find(|arg| Path::new(arg).is_file()) {
                let _ = app.emit("system:open-file", file.clone());
            }
        }));
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            delete_file,
            trash_file,
            show_in_explorer,
            open_directory,
            get_media_properties,

            process_video_clips,
            rename_file,
            copy_file,
            copy_file_unique,
            set_file_modified_time,
            cleanup_temp_folder,
            batch_stat,
            backup_file,
            get_backup_path,
            restore_backup,
            clear_backups,
            get_clipboard_file_path,
            export_cropped_media,
            export_edited_media,
            convert_media,
            get_ffmpeg_info,
            get_thumbnail,
            get_thumbnails,
            get_thumbnail_cache_size,
            clear_thumbnail_cache,
            migrate_thumbnail_cache,
            prepare_display_image,
            prepare_video_display,
            extract_cover_art,
            copy_image_to_clipboard,
            fix_media,
            print_file,
            send_bluetooth,
            set_wallpaper,
            set_lock_screen,
            create_desktop_shortcut,
            open_in_photos,
            open_in_paint,
            open_in_vlc,
            open_in_spotify,
            open_in_browser,
            open_devtools,
            open_with_dialog,
            convert_audio_to_waveform_video,
            convert_image_to_pdf,
            apply_markup_to_pdf,
            identify_song,
            get_files_total_size,
            db_get_file_metadata,
            db_get_file_metadata_light,
            db_get_file_metadata_position,
            db_save_file_metadata,
            db_clear_file_metadata_field,
            db_delete_file_metadata,
            db_get_setting,
            db_set_setting,
            db_batch_upsert_file_metadata,
            create_collection_folder,
            delete_collection_folder,
            get_initial_file,

            get_system_config,
            get_system_restart_status,
            set_hardware_acceleration,
            set_single_instance,
            set_thumbnail_cache_limit,
            set_keep_awake,
            get_power_status,
            get_start_on_login,
            set_start_on_login,
            get_explorer_context_menu,
            set_explorer_context_menu,
            get_cache_stats,
            clear_all_caches,
            open_app_folder,
            open_default_apps_settings,
            restart_app,
            reset_system_integrations,
            check_for_updates,
        ])
        .setup(move |app| {
            unsafe {
                let _ = SetCurrentProcessExplicitAppUserModelID(w!("com.vyu.app"));
            }

            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::env::temp_dir());
            crate::commands::thumbnail::set_cache_limit_bytes(
                config_for_setup.thumbnail_cache_limit_mb * 1024 * 1024,
            );
            let system_state = state::system::SystemState::new(config_for_setup, config_dir);
            let keep_awake = system_state.keep_awake.clone();
            app.manage(system_state);
            state::system::start_keep_awake_monitor(keep_awake);

            if let Err(e) = database::connection::init(app.handle()) {
                eprintln!("Database initialization failed: {e}");
            }

            if let Ok(resource_dir) = app.path().resource_dir() {
                util::init_ffmpeg_path(&resource_dir);
            }

            app.manage(types::ThumbState::new());

            util::cleanup_vyu_temp();

            // Silently clean orphaned thumbnail cache entries in background at startup
            let cache_dir = commands::thumbnail::thumb_cache_dir(app.handle()).to_path_buf();
            std::thread::spawn(move || {
                // Defer 5s — avoids I/O contention during app init
                std::thread::sleep(Duration::from_secs(5));
                if cache_dir.exists() {
                    if let Ok(entries) = fs::read_dir(&cache_dir) {
                        for entry in entries.flatten() {
                            let p = entry.path();
                            if p.extension().map_or(false, |e| e == "src") {
                                if let Ok(src) = fs::read_to_string(&p) {
                                    let src = src.trim();
                                    if !std::path::Path::new(src).exists() {
                                        let _ = fs::remove_file(&p);
                                        let _ = fs::remove_file(p.with_extension("jpg"));
                                    }
                                }
                            }
                        }
                    }
                }
            });

            let args: Vec<String> = std::env::args().collect();
            let window = app
                .get_webview_window("main")
                .expect("main webview window should exist at startup");

            let skip_save = Arc::new(AtomicBool::new(false));

            state::window::restore_window_state(&window, &skip_save);

            let window_for_events = window.clone();
            let skip_for_events = skip_save.clone();
            let last_save = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(60)));

            window.on_window_event(move |event| match event {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                    let mut last = match last_save.lock() {
                        Ok(guard) => guard,
                        Err(poisoned) => {
                            eprintln!("window state mutex was poisoned, recovering");
                            poisoned.into_inner()
                        }
                    };
                    if last.elapsed() > Duration::from_millis(300) {
                        state::window::persist_window_state(&window_for_events, &skip_for_events);
                        *last = Instant::now();
                    }
                }
                WindowEvent::CloseRequested { .. } => {
                    state::window::persist_window_state(&window_for_events, &skip_for_events);
                }
                _ => {}
            });

            let initial_file = args
                .iter()
                .skip(1)
                .find(|arg| !arg.starts_with("--") && Path::new(arg).is_file())
                .cloned();
            app.manage(InitialFile(std::sync::Mutex::new(initial_file)));
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
