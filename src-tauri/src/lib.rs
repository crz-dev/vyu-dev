// Tauri setup
mod constants;
mod types;
mod util;
mod window_state;
mod commands;
mod database;
use commands::*;

use std::fs;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Listener, Manager, WindowEvent};
use windows::core::w;
use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

pub fn run() {
    tauri::Builder::default()
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
            cleanup_temp_folder,
            batch_stat,
            backup_file,
            get_clipboard_file_path,
            export_cropped_media,
            export_edited_media,
            convert_media,
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
            identify_song,
            get_files_total_size,
            db_get_file_metadata,
            db_save_file_metadata,
            db_clear_file_metadata_field,
            db_delete_file_metadata,
            db_get_setting,
            db_set_setting,
            db_batch_upsert_file_metadata,
            create_collection_folder,
            delete_collection_folder,
        ])
        .setup(|app| {
            unsafe {
                let _ = SetCurrentProcessExplicitAppUserModelID(w!("com.vyu.app"));
            }

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

            let mut args: Vec<String> = std::env::args().collect();
            let window = app
                .get_webview_window("main")
                .expect("main webview window should exist at startup");

            let skip_save = Arc::new(AtomicBool::new(false));

            window_state::restore_window_state(&window, &skip_save);

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
                        window_state::persist_window_state(&window_for_events, &skip_for_events);
                        *last = Instant::now();
                    }
                }
                WindowEvent::CloseRequested { .. } => {
                    window_state::persist_window_state(&window_for_events, &skip_for_events);
                }
                _ => {}
            });

            let window_for_close = window.clone();
            let skip_for_close = skip_save.clone();
            app.listen("tauri://close-requested", move |_event| {
                window_state::persist_window_state(&window_for_close, &skip_for_close);
                util::cleanup_vyu_temp();
            });

            if args.len() > 1 {
                let file_path = args.swap_remove(1);
                let escaped =
                    serde_json::to_string(&file_path).expect("failed to JSON-escape file path");
                if let Err(e) = window.eval(&format!("window.__INITIAL_FILE__ = {}", escaped)) {
                    eprintln!("failed to set initial file via eval: {e}");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
