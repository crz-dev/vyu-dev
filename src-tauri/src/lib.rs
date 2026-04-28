use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Listener, Manager, PhysicalPosition, PhysicalSize, Position, Size, WindowEvent};

#[derive(serde::Serialize)]
struct MediaProperties {
    container: Option<String>,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    pixel_format: Option<String>,
    color_space: Option<String>,
    color_primaries: Option<String>,
    color_transfer: Option<String>,
    bit_depth: Option<String>,
    frame_rate: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct ClipSegment {
    start: f64,
    end: f64,
}

#[derive(serde::Serialize)]
struct ClipProcessResult {
    outputs: Vec<String>,
    deleted_original: bool,
    output_dir: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct SavedWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

const WINDOW_STATE_FILE: &str = "window-state.json";

fn window_state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(WINDOW_STATE_FILE))
}

fn load_window_state(app: &tauri::AppHandle) -> Option<SavedWindowState> {
    let path = window_state_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn persist_window_state(window: &tauri::WebviewWindow) {
    let Some(path) = window_state_path(&window.app_handle()) else {
        return;
    };

    let maximized = window.is_maximized().unwrap_or(false);
    let Ok(size) = window.outer_size() else { return };

    let (x, y) = if maximized {
        (0, 0)
    } else {
        let Ok(pos) = window.outer_position() else { return };
        (pos.x, pos.y)
    };

    let state = SavedWindowState {
        x,
        y,
        width: size.width.max(400),
        height: size.height.max(300),
        maximized,
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(serialized) = serde_json::to_string_pretty(&state) {
        let _ = fs::write(path, serialized);
    }
}

fn restore_window_state(window: &tauri::WebviewWindow) {
    let Some(state) = load_window_state(&window.app_handle()) else {
        return;
    };

    if state.maximized {
        if state.width > 0 && state.height > 0 {
            let _ = window.set_size(Size::Physical(PhysicalSize::new(state.width, state.height)));
        }
        let plausible = state.x > -3840 && state.x < 7680
            && state.y > -2160 && state.y < 4320;
        if plausible {
            let _ = window.set_position(Position::Physical(
                PhysicalPosition::new(state.x, state.y),
            ));
        }
        let _ = window.maximize();
    } else {
        let valid_size = state.width >= 400 && state.height >= 300;
        let plausible = state.x > -3840 && state.x < 7680
            && state.y > -2160 && state.y < 4320;

        if valid_size {
            let _ = window.set_size(Size::Physical(PhysicalSize::new(state.width, state.height)));
        }

        if plausible {
            let _ = window.set_position(Position::Physical(
                PhysicalPosition::new(state.x, state.y),
            ));
        }
    }
}

fn format_clip_tag(seconds: f64) -> String {
    let safe = if seconds.is_finite() && seconds > 0.0 {
        seconds.floor() as u64
    } else {
        0
    };
    let h = safe / 3600;
    let m = (safe % 3600) / 60;
    let s = safe % 60;
    if h > 0 {
        format!("{:02}-{:02}-{:02}", h, m, s)
    } else {
        format!("{:02}-{:02}", m, s)
    }
}

fn sanitize_segments(mut segments: Vec<ClipSegment>) -> Vec<ClipSegment> {
    segments.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap_or(std::cmp::Ordering::Equal));
    segments
        .into_iter()
        .filter_map(|s| {
            if !s.start.is_finite() || !s.end.is_finite() {
                return None;
            }
            if s.end <= s.start + 0.04 {
                return None;
            }
            Some(ClipSegment {
                start: s.start.max(0.0),
                end: s.end.max(0.0),
            })
        })
        .collect()
}

fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output")
        .to_string();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string();
    let parent = path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf();
    for i in 1..10000 {
        let name = if ext.is_empty() {
            format!("{stem}({i})")
        } else {
            format!("{stem}({i}).{ext}")
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    path
}

fn ffmpeg_extract_segment(input: &Path, output: &Path, start: f64, end: f64) -> Result<(), String> {
    let output_run = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            &format!("{start:.3}"),
            "-to",
            &format!("{end:.3}"),
            "-i",
            &input.to_string_lossy(),
            "-c",
            "copy",
            &output.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    if output_run.status.success() {
        return Ok(());
    }

    let fallback = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            &format!("{start:.3}"),
            "-to",
            &format!("{end:.3}"),
            "-i",
            &input.to_string_lossy(),
            &output.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg fallback: {e}"))?;

    if fallback.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&fallback.stderr).trim().to_string())
    }
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    std::fs::remove_file(&p).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn trash_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    trash::delete(&p).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_in_explorer(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(p.parent().unwrap_or(&p))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    let folder = p.parent().unwrap_or(&p);
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_media_properties(path: String) -> Result<MediaProperties, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }

    let output = Command::new("ffprobe")
        .args(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", &path])
        .output()
        .map_err(|e| format!("ffprobe not available: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let value: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid ffprobe output: {e}"))?;

    let streams = value.get("streams").and_then(|s| s.as_array()).cloned().unwrap_or_default();
    let video_stream = streams.iter().find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"));
    let audio_stream = streams.iter().find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio"));

    Ok(MediaProperties {
        container: value.get("format").and_then(|f| f.get("format_name")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        video_codec: video_stream.and_then(|s| s.get("codec_name")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        audio_codec: audio_stream.and_then(|s| s.get("codec_name")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        pixel_format: video_stream.and_then(|s| s.get("pix_fmt")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        color_space: video_stream.and_then(|s| s.get("color_space")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        color_primaries: video_stream.and_then(|s| s.get("color_primaries")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        color_transfer: video_stream.and_then(|s| s.get("color_transfer")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        bit_depth: video_stream.and_then(|s| s.get("bits_per_raw_sample")).and_then(|n| n.as_str()).map(|s| s.to_string()),
        frame_rate: video_stream.and_then(|s| s.get("r_frame_rate")).and_then(|n| n.as_str()).map(|s| s.to_string()),
    })
}

#[tauri::command]
fn check_ffprobe() -> bool {
    Command::new("ffprobe").arg("-version").output().map(|o| o.status.success()).unwrap_or(false)
}

#[tauri::command]
fn install_ffmpeg() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("winget")
            .args(["install", "--id", "Gyan.FFmpeg", "--accept-package-agreements", "--accept-source-agreements"])
            .spawn()
            .map_err(|e| format!("Failed to start FFmpeg install: {e}"))?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    Err("Automatic FFmpeg install is currently only supported on Windows.".into())
}

#[tauri::command]
fn export_cropped_media(
    path: String,
    output_path: String,
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let out_w = ((width as f64) * (1.0 - left - right)).round() as u32;
    let out_h = ((height as f64) * (1.0 - top - bottom)).round() as u32;
    let x = ((width as f64) * left).round() as u32;
    let y = ((height as f64) * top).round() as u32;

    if out_w == 0 || out_h == 0 {
        return Err("Crop area is too small".into());
    }

    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            &input.to_string_lossy(),
            "-vf",
            &format!("crop={}:{}:{}:{}", out_w, out_h, x, y),
            "-c:a",
            "copy",
            &output_path,
        ])
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    let fallback = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            &input.to_string_lossy(),
            "-vf",
            &format!("crop={}:{}:{}:{}", out_w, out_h, x, y),
            &output_path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg fallback: {e}"))?;

    if fallback.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&fallback.stderr).trim().to_string())
    }
}

#[tauri::command]
fn get_clipboard_file_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Add-Type -Assembly PresentationCore; $files = [System.Windows.Clipboard]::GetFileDropList(); if ($files.Count -gt 0) { $files[0] }",
            ])
            .output()
            .ok()?;
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() { None } else { Some(path) }
    }
    #[cfg(not(target_os = "windows"))]
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            delete_file,
            trash_file,
            show_in_explorer,
            open_folder,
            open_directory,
            get_media_properties,
            check_ffprobe,
            install_ffmpeg,
            process_video_clips,
            rename_file,
            get_clipboard_file_path,
            export_cropped_media,
            convert_media,
            compress_media,
        ])
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let window = app.get_webview_window("main").unwrap();
            restore_window_state(&window);
            let window_for_events = window.clone();
            window.on_window_event(move |event| {
                if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
                    persist_window_state(&window_for_events);
                }
            });
            let window_for_close = window.clone();
            app.listen("tauri://close-requested", move |_event| {
                persist_window_state(&window_for_close);
            });
            if args.len() > 1 {
                let file_path = args[1].clone();
                window.eval(&format!(
                    "window.__INITIAL_FILE__ = '{}'",
                    file_path.replace('\'', "\\'").replace('\\', "\\\\")
                )).unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn open_directory(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Directory does not exist".into());
    }
    let dir = if p.is_dir() { p } else { p.parent().unwrap_or(&p).to_path_buf() };
    #[cfg(target_os = "windows")]
    { Command::new("explorer").arg(dir).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(dir).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(dir).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn convert_media(
    path: String,
    output_dir: String,
    format: String,
    preset: String,
) -> Result<String, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let out_dir = PathBuf::from(&output_dir);
    if !out_dir.exists() {
        fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output folder: {e}"))?;
    }

    let base_name = input.file_stem().and_then(|s| s.to_str()).unwrap_or("output").to_string();
    let ext = format.to_lowercase();
    let out_name = format!("{}_converted.{}", base_name, ext);
    let output_path = unique_path(out_dir.join(&out_name));

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-i".into(),
        input.to_string_lossy().to_string(),
    ];

    match ext.as_str() {
        "mp4" => {
            args.push("-c:v".into());
            args.push("libx264".into());
            args.push("-c:a".into());
            args.push("aac".into());
            args.push("-movflags".into());
            args.push("+faststart".into());
        }
        "webm" => {
            args.push("-c:v".into());
            args.push("libvpx-vp9".into());
            args.push("-c:a".into());
            args.push("libopus".into());
        }
        "mkv" => {
            args.push("-c:v".into());
            args.push("libx264".into());
            args.push("-c:a".into());
            args.push("aac".into());
        }
        "gif" => {
            args.push("-vf".into());
            args.push("fps=30,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer".into());
            args.push("-loop".into());
            args.push("0".into());
        }
        "png" => {
            args.push("-c:v".into());
            args.push("png".into());
        }
        "jpg" | "jpeg" => {
            args.push("-q:v".into());
            args.push("2".into());
        }
        "webp" => {
            args.push("-c:v".into());
            args.push("libwebp".into());
        }
        _ => {}
    }

    if ext != "gif" && ext != "png" && ext != "jpg" && ext != "jpeg" && ext != "webp" {
        match preset.as_str() {
            "Fast" => {
                args.push("-preset".into());
                args.push("fast".into());
                args.push("-crf".into());
                args.push("28".into());
            }
            "Balanced" => {
                args.push("-preset".into());
                args.push("medium".into());
                args.push("-crf".into());
                args.push("23".into());
            }
            "Quality" => {
                args.push("-preset".into());
                args.push("slow".into());
                args.push("-crf".into());
                args.push("18".into());
            }
            "Lossless" => {
                args.push("-preset".into());
                args.push("veryslow".into());
                args.push("-crf".into());
                args.push("0".into());
            }
            _ => {}
        }
    } else if ext == "webp" {
        match preset.as_str() {
            "Fast" => {
                args.push("-quality".into());
                args.push("50".into());
            }
            "Balanced" => {
                args.push("-quality".into());
                args.push("75".into());
            }
            "Quality" => {
                args.push("-quality".into());
                args.push("90".into());
            }
            "Lossless" => {
                args.push("-lossless".into());
                args.push("1".into());
            }
            _ => {}
        }
    }

    args.push(output_path.to_string_lossy().to_string());

    let output = Command::new("ffmpeg")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    if output.status.success() {
        Ok(output_path.to_string_lossy().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &Path,
    current: &Path,
    options: zip::write::FileOptions<()>,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|e| format!("Read dir error: {e}"))? {
        let entry = entry.map_err(|e| format!("Dir entry error: {e}"))?;
        let path = entry.path();
        let rel = path.strip_prefix(base).map_err(|e| format!("Strip prefix error: {e}"))?;
        let name = rel.to_string_lossy().replace('\\', "/");
        if path.is_file() {
            zip.start_file(name, options)
                .map_err(|e| format!("Zip start file error: {e}"))?;
            let mut file = fs::File::open(&path).map_err(|e| format!("Open file error: {e}"))?;
            let mut buf = Vec::new();
            file.read_to_end(&mut buf).map_err(|e| format!("Read file error: {e}"))?;
            zip.write_all(&buf).map_err(|e| format!("Zip write error: {e}"))?;
        } else if path.is_dir() {
            zip.add_directory(name + "/", options)
                .map_err(|e| format!("Zip add dir error: {e}"))?;
            add_dir_to_zip(zip, base, &path, options)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn compress_media(
    path: String,
    output_dir: String,
    target: String,
    preset: String,
) -> Result<String, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let out_dir = PathBuf::from(&output_dir);
    if !out_dir.exists() {
        fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output folder: {e}"))?;
    }

    let compression_level: i64 = match preset.as_str() {
        "Fast" => 1,
        "Balanced" => 5,
        "Quality" => 8,
        "Lossless" => 9,
        _ => 5,
    };

    let (source_path, zip_name) = if target == "folder" {
        let parent = input.parent().unwrap_or(&input).to_path_buf();
        let name = parent.file_name().and_then(|s| s.to_str()).unwrap_or("archive").to_string();
        (parent, format!("{name}.zip"))
    } else {
        let name = input.file_stem().and_then(|s| s.to_str()).unwrap_or("archive").to_string();
        (input.clone(), format!("{name}.zip"))
    };

    let zip_path = unique_path(out_dir.join(&zip_name));
    let file = fs::File::create(&zip_path).map_err(|e| format!("Failed to create zip file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(compression_level));

    if source_path.is_file() {
        let name = source_path.file_name().and_then(|s| s.to_str()).unwrap_or("file");
        zip.start_file(name, options)
            .map_err(|e| format!("Zip start file error: {e}"))?;
        let mut f = fs::File::open(&source_path).map_err(|e| format!("Open file error: {e}"))?;
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).map_err(|e| format!("Read file error: {e}"))?;
        zip.write_all(&buf).map_err(|e| format!("Zip write error: {e}"))?;
    } else {
        let name = source_path.file_name().and_then(|s| s.to_str()).unwrap_or("archive").to_string();
        if name != "." {
            zip.add_directory(name.clone() + "/", options)
                .map_err(|e| format!("Zip add dir error: {e}"))?;
        }
        add_dir_to_zip(&mut zip, &source_path, &source_path, options)?;
    }

    zip.finish().map_err(|e| format!("Failed to finish zip: {e}"))?;
    Ok(zip_path.to_string_lossy().to_string())
}

#[tauri::command]
fn process_video_clips(
    path: String,
    output_dir: String,
    segments: Vec<ClipSegment>,
    mode: String,
    delete_original: bool,
) -> Result<ClipProcessResult, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source video does not exist".into());
    }
    let clean_segments = sanitize_segments(segments);
    if clean_segments.is_empty() {
        return Err("No valid clip segments selected".into());
    }
    let out_dir = if output_dir.trim().is_empty() {
        input.parent().unwrap_or(Path::new(".")).to_path_buf()
    } else {
        PathBuf::from(&output_dir)
    };
    if !out_dir.exists() {
        fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output folder: {e}"))?;
    }
    let ext = input.extension().and_then(|e| e.to_str()).unwrap_or("mp4").to_string();
    let base_name = input.file_stem().and_then(|s| s.to_str()).unwrap_or("video").to_string();
    let mut outputs: Vec<String> = Vec::new();

    if mode == "separate" {
        for (idx, seg) in clean_segments.iter().enumerate() {
            let file_name = format!("{}_clip_{:02}_{}_to_{}.{}", base_name, idx + 1, format_clip_tag(seg.start), format_clip_tag(seg.end), ext);
            let output_path = unique_path(out_dir.join(file_name));
            ffmpeg_extract_segment(&input, &output_path, seg.start, seg.end)?;
            outputs.push(output_path.to_string_lossy().to_string());
        }
    } else if mode == "merge" {
        if clean_segments.len() == 1 {
            let seg = &clean_segments[0];
            let file_name = format!("{}_clip_{:02}_{}_to_{}.{}", base_name, 1, format_clip_tag(seg.start), format_clip_tag(seg.end), ext);
            let output_path = unique_path(out_dir.join(file_name));
            ffmpeg_extract_segment(&input, &output_path, seg.start, seg.end)?;
            outputs.push(output_path.to_string_lossy().to_string());
        } else {
            let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
            let temp_dir = std::env::temp_dir().join(format!("vyu-clips-{stamp}"));
            fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed creating temp dir: {e}"))?;
            let mut temp_files: Vec<PathBuf> = Vec::new();
            for (idx, seg) in clean_segments.iter().enumerate() {
                let temp_file = temp_dir.join(format!("seg-{:03}.{}", idx + 1, ext));
                ffmpeg_extract_segment(&input, &temp_file, seg.start, seg.end)?;
                temp_files.push(temp_file);
            }
            let list_file = temp_dir.join("concat-list.txt");
            let list_text = temp_files.iter().map(|p| {
                let escaped = p.to_string_lossy().replace('\\', "/").replace('\'', "'\\''");
                format!("file '{escaped}'")
            }).collect::<Vec<String>>().join("\n");
            fs::write(&list_file, list_text).map_err(|e| format!("Failed writing concat list: {e}"))?;
            let merged_name = format!("{}_clips_merged.{}", base_name, ext);
            let merged_output = unique_path(out_dir.join(merged_name));
            let merge_out = Command::new("ffmpeg")
                .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", &list_file.to_string_lossy(), "-c", "copy", &merged_output.to_string_lossy()])
                .output()
                .map_err(|e| format!("Failed to run ffmpeg merge: {e}"))?;
            if !merge_out.status.success() {
                return Err(String::from_utf8_lossy(&merge_out.stderr).trim().to_string());
            }
            outputs.push(merged_output.to_string_lossy().to_string());
            let _ = fs::remove_dir_all(&temp_dir);
        }
    } else {
        return Err("Invalid clip mode".into());
    }

    let mut deleted_original = false;
    if delete_original {
        fs::remove_file(&input).map_err(|e| format!("Clips were created, but deleting original failed: {e}"))?;
        deleted_original = true;
    }

    Ok(ClipProcessResult {
        outputs,
        deleted_original,
        output_dir: out_dir.to_string_lossy().to_string(),
    })
}