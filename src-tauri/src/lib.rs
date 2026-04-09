use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
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
            open_directory,
            get_media_properties,
            check_ffprobe,
            install_ffmpeg,
            process_video_clips
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

#[tauri::command]
fn open_directory(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Directory does not exist".into());
    }
    let dir = if p.is_dir() {
        p
    } else {
        p.parent().unwrap_or(&p).to_path_buf()
    };

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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

    let ext = input
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4")
        .to_string();
    let base_name = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video")
        .to_string();

    let mut outputs: Vec<String> = Vec::new();

    if mode == "separate" {
        for (idx, seg) in clean_segments.iter().enumerate() {
            let start_tag = format_clip_tag(seg.start);
            let end_tag = format_clip_tag(seg.end);
            let file_name = format!(
                "{}_clip_{:02}_{}_to_{}.{}",
                base_name,
                idx + 1,
                start_tag,
                end_tag,
                ext
            );
            let output_path = unique_path(out_dir.join(file_name));
            ffmpeg_extract_segment(&input, &output_path, seg.start, seg.end)?;
            outputs.push(output_path.to_string_lossy().to_string());
        }
    } else if mode == "merge" {
        if clean_segments.len() == 1 {
            let seg = &clean_segments[0];
            let file_name = format!(
                "{}_clip_{:02}_{}_to_{}.{}",
                base_name,
                1,
                format_clip_tag(seg.start),
                format_clip_tag(seg.end),
                ext
            );
            let output_path = unique_path(out_dir.join(file_name));
            ffmpeg_extract_segment(&input, &output_path, seg.start, seg.end)?;
            outputs.push(output_path.to_string_lossy().to_string());
        } else {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            let temp_dir = std::env::temp_dir().join(format!("vyu-clips-{stamp}"));
            fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed creating temp dir: {e}"))?;
            let mut temp_files: Vec<PathBuf> = Vec::new();
            for (idx, seg) in clean_segments.iter().enumerate() {
                let temp_file = temp_dir.join(format!("seg-{:03}.{}", idx + 1, ext));
                ffmpeg_extract_segment(&input, &temp_file, seg.start, seg.end)?;
                temp_files.push(temp_file);
            }

            let list_file = temp_dir.join("concat-list.txt");
            let list_text = temp_files
                .iter()
                .map(|p| {
                    let escaped = p
                        .to_string_lossy()
                        .replace('\\', "/")
                        .replace('\'', "'\\''");
                    format!("file '{escaped}'")
                })
                .collect::<Vec<String>>()
                .join("\n");
            fs::write(&list_file, list_text).map_err(|e| format!("Failed writing concat list: {e}"))?;

            let merged_name = format!("{}_clips_merged.{}", base_name, ext);
            let merged_output = unique_path(out_dir.join(merged_name));
            let merge_out = Command::new("ffmpeg")
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    &list_file.to_string_lossy(),
                    "-c",
                    "copy",
                    &merged_output.to_string_lossy(),
                ])
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
