use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

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

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    std::fs::remove_file(&p).map_err(|e| e.to_string())
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
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            &path,
        ])
        .output()
        .map_err(|e| format!("ffprobe not available: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let value: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid ffprobe output: {e}"))?;

    let streams = value
        .get("streams")
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default();

    let video_stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"));
    let audio_stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio"));

    let container = value
        .get("format")
        .and_then(|f| f.get("format_name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let video_codec = video_stream
        .and_then(|s| s.get("codec_name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let audio_codec = audio_stream
        .and_then(|s| s.get("codec_name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let pixel_format = video_stream
        .and_then(|s| s.get("pix_fmt"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let color_space = video_stream
        .and_then(|s| s.get("color_space"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let color_primaries = video_stream
        .and_then(|s| s.get("color_primaries"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let color_transfer = video_stream
        .and_then(|s| s.get("color_transfer"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let bit_depth = video_stream
        .and_then(|s| s.get("bits_per_raw_sample"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    let frame_rate = video_stream
        .and_then(|s| s.get("r_frame_rate"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());

    Ok(MediaProperties {
        container,
        video_codec,
        audio_codec,
        pixel_format,
        color_space,
        color_primaries,
        color_transfer,
        bit_depth,
        frame_rate,
    })
}

#[tauri::command]
fn check_ffprobe() -> bool {
    Command::new("ffprobe")
        .arg("-version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
fn install_ffmpeg() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("winget")
            .args([
                "install",
                "--id",
                "Gyan.FFmpeg",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ])
            .spawn()
            .map_err(|e| format!("Failed to start FFmpeg install: {e}"))?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Automatic FFmpeg install is currently only supported on Windows.".into())
    }
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
            get_media_properties,
            check_ffprobe,
            install_ffmpeg
        ])
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = args[1].clone();
                let window = app.get_webview_window("main").unwrap();
                window
                    .eval(&format!(
                        "window.__INITIAL_FILE__ = '{}'",
                        file_path.replace('\'', "\\'").replace('\\', "\\\\")
                    ))
                    .unwrap();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}