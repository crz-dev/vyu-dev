use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use base64::Engine as _;
use image::GenericImageView;
use image::ImageEncoder;
use tauri::{Listener, Manager, PhysicalPosition, PhysicalSize, Position, Size, WindowEvent};
use tokio::sync::Semaphore;
use windows::core::w;
use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
use xxhash_rust::xxh3::xxh3_64;

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

/// Managed state for the thumbnail system — caps concurrent decode operations.
struct ThumbState {
    sem: Semaphore,
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

fn persist_window_state(window: &tauri::WebviewWindow, skip: &Arc<AtomicBool>) {
    if skip.load(Ordering::Relaxed) {
        return;
    }

    let Some(path) = window_state_path(&window.app_handle()) else {
        return;
    };

    let maximized = window.is_maximized().unwrap_or(false);
    let Ok(size) = window.inner_size() else { return };

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

fn restore_window_state(window: &tauri::WebviewWindow, skip: &Arc<AtomicBool>) {
    skip.store(true, Ordering::Relaxed);

    let Some(state) = load_window_state(&window.app_handle()) else {
        skip.store(false, Ordering::Relaxed);
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

    skip.store(false, Ordering::Relaxed);
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
        .map_err(|e| format!("Failed to rename file: {e}"))
}

#[tauri::command]
fn copy_file(source: String, destination: String) -> Result<(), String> {
    std::fs::copy(&source, &destination)
        .map(|_| ())
        .map_err(|e| format!("Failed to copy file: {e}"))
}

fn hash_path(path: &str) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Deterministic hash for thumbnail cache filenames (xxh3 is fast and consistent across runs).
fn hash_path_xxh3(path: &str) -> String {
    format!("{:016x}", xxh3_64(path.as_bytes()))
}

const IMAGE_EXTS_RUST: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "tiff", "tif", "psd", "jxl", "heic", "heif", "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "rw2", "orf", "pef", "3fr", "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr"];
const VIDEO_EXTS_RUST: &[&str] = &["mp4", "webm", "mkv", "avi", "mov", "wmv", "mpeg", "mpg", "ts", "m2ts", "m4v"];
const AUDIO_EXTS_RUST: &[&str] = &["mp3", "wav", "flac", "ogg", "aac", "wma", "m4a", "opus", "aiff", "alac"];
const DOCUMENT_EXTS_RUST: &[&str] = &["pdf"];

/// Image formats that need ffmpeg for decoding (not supported by the image crate).
const FFMPEG_IMAGE_EXTS_RUST: &[&str] = &["psd", "jxl", "heic", "heif"];
const FFMPEG_THUMB_TIMEOUT: Duration = Duration::from_secs(8);

fn generate_video_frame(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    let mut child = Command::new("ffmpeg")
        .args([
            "-y", "-hide_banner", "-loglevel", "error",
            "-ss", "1",
            "-i", path,
            "-vframes", "1",
            "-vf", "scale=200:200:force_original_aspect_ratio=decrease",
            "-q:v", "4",
            &thumb_path.to_string_lossy(),
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => {
                return Ok(Some(thumb_path.to_string_lossy().to_string()));
            }
            Ok(Some(_)) => {
                let _ = fs::remove_file(thumb_path);
                return Ok(None);
            }
            Ok(None) => {
                if start.elapsed() > FFMPEG_THUMB_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = fs::remove_file(thumb_path);
                    return Ok(None);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => {
                let _ = fs::remove_file(thumb_path);
                return Err(format!("ffmpeg error: {e}"));
            }
        }
    }
}

/// Thumbnail for single-frame ffmpeg-based images (PSD, JXL, etc.).
/// Unlike generate_video_frame this does NOT seek (-ss), since
/// single-frame images have only frame at position 0.
fn generate_ffmpeg_image_frame(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    let mut child = Command::new("ffmpeg")
        .args([
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", path,
            "-vframes", "1",
            "-vf", "scale=200:200:force_original_aspect_ratio=decrease",
            "-q:v", "4",
            &thumb_path.to_string_lossy(),
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => {
                return Ok(Some(thumb_path.to_string_lossy().to_string()));
            }
            Ok(Some(_)) => {
                let _ = fs::remove_file(thumb_path);
                return Ok(None);
            }
            Ok(None) => {
                if start.elapsed() > FFMPEG_THUMB_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = fs::remove_file(thumb_path);
                    return Ok(None);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => {
                let _ = fs::remove_file(thumb_path);
                return Err(format!("ffmpeg error: {e}"));
            }
        }
    }
}

fn generate_audio_waveform(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    let mut child = Command::new("ffmpeg")
        .args([
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", path,
            "-filter_complex", "showwavespic=s=640x200:colors=#ffffff",
            "-frames:v", "1",
            &thumb_path.to_string_lossy(),
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => {
                return Ok(Some(thumb_path.to_string_lossy().to_string()));
            }
            Ok(Some(_)) => {
                let _ = fs::remove_file(thumb_path);
                return Ok(None);
            }
            Ok(None) => {
                if start.elapsed() > FFMPEG_THUMB_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = fs::remove_file(thumb_path);
                    return Ok(None);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => {
                let _ = fs::remove_file(thumb_path);
                return Err(format!("ffmpeg error: {e}"));
            }
        }
    }
}

fn format_data_url(bytes: &[u8]) -> String {
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:image/jpeg;base64,{b64}")
}

fn thumb_cache_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("thumbnails");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Single command for all thumbnail generation.
/// Returns a base64 JPEG data URL, or empty string for PDFs / unsupported types.
/// Internally branches by file type:
///   - image-crate formats (JPG, PNG, WEBP, BMP, GIF, AVIF, TIFF): in-process decode + resize
///   - video / audio / FFmpeg-dependent images: existing FFmpeg path
/// Both paths go through the same semaphore (4 permits) and disk cache.
#[tauri::command]
async fn get_thumbnail(
    app: tauri::AppHandle,
    state: tauri::State<'_, ThumbState>,
    path: String,
) -> Result<String, String> {
    let ext = path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    let is_image = IMAGE_EXTS_RUST.contains(&ext.as_str());
    let is_video = VIDEO_EXTS_RUST.contains(&ext.as_str());
    let is_audio = AUDIO_EXTS_RUST.contains(&ext.as_str());
    let is_document = DOCUMENT_EXTS_RUST.contains(&ext.as_str());
    let is_ffmpeg_image = FFMPEG_IMAGE_EXTS_RUST.contains(&ext.as_str());
    let is_raw = RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

    if !is_image && !is_video && !is_audio && !is_document {
        return Ok(String::new());
    }

    // Documents are handled on the frontend (no Rust thumbnail)
    if is_document {
        return Ok(String::new());
    }

    // Get source file mtime for cache key
    let src_meta = fs::metadata(&path).map_err(|e| format!("Cannot access file: {e}"))?;
    let mtime = src_meta
        .modified()
        .map_err(|e| format!("Cannot read mtime: {e}"))?
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let cache_dir = thumb_cache_dir(&app);
    let hash = hash_path_xxh3(&path);
    let thumb_name = format!("{hash}_{mtime}.jpg");
    let thumb_path = cache_dir.join(&thumb_name);
    let src_name = format!("{hash}_{mtime}.src");
    let src_path = cache_dir.join(&src_name);

    // Check disk cache — if an up-to-date thumbnail exists, return it directly
    if thumb_path.exists() {
        if let Ok(jpeg_bytes) = fs::read(&thumb_path) {
            return Ok(format_data_url(&jpeg_bytes));
        }
    }

    let use_ffmpeg = is_video || is_audio || is_ffmpeg_image || is_raw;
    let use_image_crate = !use_ffmpeg && is_image;

    // Acquire semaphore permit — caps concurrent decode work to 4
    let _permit = state
        .sem
        .acquire()
        .await
        .map_err(|e| format!("Semaphore error: {e}"))?;

    let path_c = path.clone();
    let thumb_path_c = thumb_path.clone();
    let src_path_c = src_path.clone();

    let jpeg_bytes = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        if use_image_crate {
            // ── In-process image crate decode ──
            let img =
                image::open(&path_c).map_err(|e| format!("Failed to open image: {e}"))?;
            let (w, h) = img.dimensions();
            let short: u32 = 120;
            let (nw, nh) = if w > h {
                // Landscape: short side = height
                (((w as f64) * (short as f64) / (h as f64)).round() as u32, short)
            } else if h > w {
                // Portrait: short side = width
                (short, ((h as f64) * (short as f64) / (w as f64)).round() as u32)
            } else {
                // Square
                (short, short)
            };
            let thumb = img.resize_exact(
                nw.max(1),
                nh.max(1),
                image::imageops::FilterType::Triangle,
            );
            let mut jpeg_bytes: Vec<u8> = Vec::new();
            let mut encoder =
                image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_bytes, 55);
            encoder
                .encode(
                    thumb.as_bytes(),
                    thumb.width(),
                    thumb.height(),
                    thumb.color().into(),
                )
                .map_err(|e| format!("JPEG encode error: {e}"))?;
            // Write to disk cache
            let _ = fs::write(&thumb_path_c, &jpeg_bytes);
            let _ = fs::write(&src_path_c, &path_c);
            Ok(jpeg_bytes)
        } else {
            // ── FFmpeg path (video / audio / unsupported image) ──
            let result = if is_video {
                generate_video_frame(&path_c, &thumb_path_c)
            } else if is_ffmpeg_image || is_raw {
                generate_ffmpeg_image_frame(&path_c, &thumb_path_c)
            } else if is_audio {
                generate_audio_waveform(&path_c, &thumb_path_c)
            } else {
                return Err("Unsupported media type for thumbnail".into());
            };
            match result {
                Ok(Some(_)) => {
                    let _ = fs::write(&src_path_c, &path_c);
                    fs::read(&thumb_path_c)
                        .map_err(|e| format!("Failed to read FFmpeg output: {e}"))
                }
                Ok(None) => {
                    // FFmpeg failed to produce output (timeout, etc.)
                    let _ = fs::remove_file(&thumb_path_c);
                    Err("FFmpeg thumbnail generation failed (no output)".into())
                }
                Err(e) => {
                    let _ = fs::remove_file(&thumb_path_c);
                    Err(e)
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))??;

    Ok(format_data_url(&jpeg_bytes))
}

/// Returns the total size in bytes of all cached thumbnail JPEGs.
#[tauri::command]
async fn get_thumbnail_cache_size(app: tauri::AppHandle) -> Result<u64, String> {
    let cache_dir = thumb_cache_dir(&app);
    if !cache_dir.exists() {
        return Ok(0);
    }
    let mut total: u64 = 0;
    let entries = fs::read_dir(&cache_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().map_or(false, |e| e == "jpg") {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(total)
}

/// Deletes all files in the thumbnail cache folder and returns bytes freed.
#[tauri::command]
async fn clear_thumbnail_cache(app: tauri::AppHandle) -> Result<u64, String> {
    let cache_dir = thumb_cache_dir(&app);
    if !cache_dir.exists() {
        return Ok(0);
    }
    let mut freed: u64 = 0;
    let entries = fs::read_dir(&cache_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        let ext = p.extension().map(|e| e.to_os_string()).unwrap_or_default();
        if ext == "jpg" || ext == "src" {
            freed += entry.metadata().map(|m| m.len()).unwrap_or(0);
            let _ = fs::remove_file(&p);
        }
    }
    Ok(freed)
}

/// Image formats that browsers (WebView2/Edge) cannot render natively.
/// These must be decoded server-side and served as PNG for display.
const BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST: &[&str] = &["tiff", "tif", "psd", "jxl", "heic", "heif", "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "rw2", "orf", "pef", "3fr", "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr"];

/// RAW camera formats — decoded via ffmpeg (libraw/libdcraw backend).
const RAW_IMAGE_EXTS_RUST: &[&str] = &[
    "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2",
    "raf", "rw2", "orf", "pef", "3fr", "fff", "iiq", "kdc",
    "mef", "mos", "x3f", "gpr",
];

/// Video formats that browsers cannot play natively.
/// These must be remuxed server-side (ffmpeg -c copy → MP4) for playback.
const REMUX_VIDEO_EXTS_RUST: &[&str] = &["ts", "m2ts"];

/// Decodes a browser-unsupported image and returns a cached PNG path for display.
/// Uses the image crate for formats it supports (TIFF), ffmpeg for PSD/JXL.
/// For browser-supported formats, returns None (frontend uses the original file).
#[tauri::command]
async fn prepare_display_image(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<String>, String> {
    let ext = path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    if !BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST.contains(&ext.as_str()) {
        return Ok(None);
    }

    let display_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("displays");
    let _ = fs::create_dir_all(&display_dir);

    let hash = hash_path(&path);
    let cached_png = display_dir.join(format!("{hash}.png"));

    // Check if cached PNG is up-to-date
    if cached_png.exists() {
        if let (Ok(src_meta), Ok(cached_meta)) =
            (fs::metadata(&path), fs::metadata(&cached_png))
        {
            if let (Ok(src_time), Ok(cached_time)) =
                (src_meta.modified(), cached_meta.modified())
            {
                if cached_time >= src_time {
                    return Ok(Some(cached_png.to_string_lossy().to_string()));
                }
            }
        }
    }

    let path_clone = path.clone();
    let cached_clone = cached_png.clone();
    let ext_clone = ext.clone();
    let is_ffmpeg = FFMPEG_IMAGE_EXTS_RUST.contains(&ext.as_str()) || RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

    tauri::async_runtime::spawn_blocking(move || {
        if is_ffmpeg {
            // Use ffmpeg to decode PSD, JXL, etc. to PNG
            let status = Command::new("ffmpeg")
                .args([
                    "-y", "-hide_banner", "-loglevel", "error",
                    "-i", &path_clone,
                    &cached_clone.to_string_lossy(),
                ])
                .status()
                .map_err(|e| format!("Failed to run ffmpeg for {} display: {e}", ext_clone))?;

            if !status.success() {
                let _ = fs::remove_file(&cached_clone);
                return Err(format!("ffmpeg failed to convert {} for display", ext_clone));
            }
            Ok(Some(cached_clone.to_string_lossy().to_string()))
        } else {
            let img = image::open(&path_clone)
                .map_err(|e| format!("Failed to decode {} for display: {e}", ext_clone))?;

            // Encode to PNG at native resolution
            let mut png_bytes: Vec<u8> = Vec::new();
            let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
            encoder
                .write_image(
                    img.as_bytes(),
                    img.width(),
                    img.height(),
                    img.color().into(),
                )
                .map_err(|e| format!("Failed to encode display PNG: {e}"))?;

            fs::write(&cached_clone, &png_bytes)
                .map_err(|e| format!("Failed to write display cache: {e}"))?;

            Ok(Some(cached_clone.to_string_lossy().to_string()))
        }
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

/// Remuxes a browser-unsupported video (TS, M2TS) to MP4 for playback.
/// Uses ffmpeg -c copy (no re-encode) so it's fast and lossless.
/// Returns the cached MP4 path, or None if the format doesn't need remuxing.
#[tauri::command]
async fn prepare_video_display(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<String>, String> {
    let ext = path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    if !REMUX_VIDEO_EXTS_RUST.contains(&ext.as_str()) {
        return Ok(None);
    }

    let remux_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("displays");
    let _ = fs::create_dir_all(&remux_dir);

    let hash = hash_path(&path);
    let cached_mp4 = remux_dir.join(format!("{hash}.mp4"));

    // Check if cached MP4 is up-to-date
    if cached_mp4.exists() {
        if let (Ok(src_meta), Ok(cached_meta)) =
            (fs::metadata(&path), fs::metadata(&cached_mp4))
        {
            if let (Ok(src_time), Ok(cached_time)) =
                (src_meta.modified(), cached_meta.modified())
            {
                if cached_time >= src_time {
                    return Ok(Some(cached_mp4.to_string_lossy().to_string()));
                }
            }
        }
    }

    let path_clone = path.clone();
    let cached_clone = cached_mp4.clone();

    tauri::async_runtime::spawn_blocking(move || {
        // Remux TS/M2TS → MP4 (no re-encode, just container swap)
        let status = Command::new("ffmpeg")
            .args([
                "-y", "-hide_banner", "-loglevel", "error",
                "-i", &path_clone,
                "-c", "copy",
                "-movflags", "+faststart",
                &cached_clone.to_string_lossy(),
            ])
            .status()
            .map_err(|e| format!("Failed to run ffmpeg for remux: {e}"))?;

        if !status.success() {
            let _ = fs::remove_file(&cached_clone);
            return Err("ffmpeg remux failed".into());
        }
        Ok(Some(cached_clone.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

fn cleanup_vyu_temp() {
    let temp_dir = std::env::temp_dir().join("Vyu-temp");
    let _ = std::fs::remove_dir_all(&temp_dir);
}

#[tauri::command]
fn cleanup_temp_folder() {
    cleanup_vyu_temp();
}

#[tauri::command]
fn backup_file(source: String) -> Result<String, String> {
    let source_path = PathBuf::from(&source);
    if !source_path.exists() {
        return Err("Source file does not exist".into());
    }
    let temp_dir = std::env::temp_dir().join("Vyu-temp").join("originals");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let ext = source_path.extension().and_then(|e| e.to_str()).unwrap_or("bak");
    let hash = hash_path(&source);
    let backup_path = temp_dir.join(format!("{}.{}", hash, ext));
    if backup_path.exists() {
        let _ = std::fs::remove_file(&backup_path);
    }
    std::fs::copy(&source_path, &backup_path)
        .map_err(|e| format!("Failed to backup file: {e}"))?;
    Ok(backup_path.to_string_lossy().to_string())
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
    rotation: f64,
) -> Result<(), String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let rot = ((rotation % 360.0) + 360.0) % 360.0;
    let is_quarter_turn = (rot - 90.0).abs() < 1.0 || (rot - 270.0).abs() < 1.0;

    // Crop bounds are set relative to the displayed (rotated) image.
    // For quarter-turn rotations, swap the bounds to match natural coordinates.
    let (left, top, right, bottom) = if is_quarter_turn {
        if (rot - 90.0).abs() < 1.0 {
            (top, right, bottom, left)
        } else {
            (bottom, left, top, right)
        }
    } else {
        (left, top, right, bottom)
    };

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
fn export_edited_media(
    path: String,
    output_path: String,
    brightness: f64,
    contrast: f64,
    saturation: f64,
    hue: f64,
    rotation: f64,
    flipped: bool,
    flipped_vertical: bool,
    crop_left: f64,
    crop_top: f64,
    crop_right: f64,
    crop_bottom: f64,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let mut filters: Vec<String> = Vec::new();

    let rot = ((rotation % 360.0) + 360.0) % 360.0;
    let is_quarter_turn = (rot - 90.0).abs() < 1.0 || (rot - 270.0).abs() < 1.0;

    // Crop bounds are set relative to the displayed (rotated) image.
    // For quarter-turn rotations, swap the bounds to match natural coordinates.
    let (crop_left, crop_top, crop_right, crop_bottom) = if is_quarter_turn {
        if (rot - 90.0).abs() < 1.0 {
            (crop_top, crop_right, crop_bottom, crop_left)
        } else {
            (crop_bottom, crop_left, crop_top, crop_right)
        }
    } else {
        (crop_left, crop_top, crop_right, crop_bottom)
    };

    let has_crop = crop_left > 0.0 || crop_top > 0.0 || crop_right > 0.0 || crop_bottom > 0.0;
    if has_crop {
        let out_w = ((width as f64) * (1.0 - crop_left - crop_right)).round() as u32;
        let out_h = ((height as f64) * (1.0 - crop_top - crop_bottom)).round() as u32;
        let x = ((width as f64) * crop_left).round() as u32;
        let y = ((height as f64) * crop_top).round() as u32;
        if out_w == 0 || out_h == 0 {
            return Err("Crop area is too small".into());
        }
        filters.push(format!("crop={}:{}:{}:{}", out_w, out_h, x, y));
    }
    if (rot - 90.0).abs() < 1.0 {
        filters.push("transpose=1".into());
    } else if (rot - 180.0).abs() < 1.0 || (rot + 180.0).abs() < 1.0 {
        filters.push("transpose=1,transpose=1".into());
    } else if (rot - 270.0).abs() < 1.0 || (rot + 90.0).abs() < 1.0 {
        filters.push("transpose=2".into());
    } else if rot > 1.0 {
        // Arbitrary rotation — expand canvas to fit the full rotated frame
        let rad = rot * std::f64::consts::PI / 180.0;
        filters.push(format!(
            "rotate={}:ow=rotw({}):oh=roth({}):c=black@0",
            rad, rad, rad
        ));
    }

    if flipped {
        filters.push("hflip".into());
    }
    if flipped_vertical {
        filters.push("vflip".into());
    }

    let mut eq_parts: Vec<String> = Vec::new();
    if (brightness - 1.0).abs() > 0.01 {
        eq_parts.push(format!("brightness={:.2}", brightness - 1.0));
    }
    if (contrast - 1.0).abs() > 0.01 {
        eq_parts.push(format!("contrast={:.2}", contrast));
    }
    if (saturation - 1.0).abs() > 0.01 {
        eq_parts.push(format!("saturation={:.2}", saturation));
    }

    if !eq_parts.is_empty() {
        filters.push(format!("eq={}", eq_parts.join(":")));
    }

    if hue.abs() > 1.0 {
        filters.push(format!("hue=h={}", hue));
    }

    let filter_arg = if filters.is_empty() {
        "copy".to_string()
    } else {
        filters.join(",")
    };

    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            &input.to_string_lossy(),
            "-vf",
            &filter_arg,
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
            &filter_arg,
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
fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    let is_raw = RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

    let img = if is_raw {
        // Decode RAW to temp PNG via ffmpeg, then load with image crate
        let temp_png = std::env::temp_dir().join(format!("vyu_clipboard_{}.png", hash_path(&path)));
        Command::new("ffmpeg")
            .args(["-y", "-hide_banner", "-loglevel", "error", "-i", &path, temp_png.to_str().unwrap()])
            .status()
            .map_err(|e| format!("Failed to run ffmpeg for RAW clipboard: {e}"))?;
        let decoded = image::open(&temp_png)
            .map_err(|e| format!("Failed to decode RAW for clipboard: {e}"))?;
        let _ = fs::remove_file(&temp_png);
        decoded
    } else {
        image::open(&path).map_err(|e| format!("Failed to open image: {e}"))?
    };

    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let data = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    };
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {e}"))?;
    clipboard
        .set_image(data)
        .map_err(|e| format!("Failed to set clipboard image: {e}"))
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

#[derive(serde::Serialize)]
struct MediaIntegrity {
    corrupted: bool,
    reason: String,
}

#[derive(serde::Serialize)]
struct FixResult {
    success: bool,
    output_path: String,
    error: String,
}

#[tauri::command]
fn check_media_integrity(path: String) -> Result<MediaIntegrity, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(MediaIntegrity {
            corrupted: true,
            reason: "File does not exist".into(),
        });
    }

    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let is_image = IMAGE_EXTS_RUST.contains(&ext.as_str());
    let is_video = VIDEO_EXTS_RUST.contains(&ext.as_str());
    let is_audio = AUDIO_EXTS_RUST.contains(&ext.as_str());
    let is_document = DOCUMENT_EXTS_RUST.contains(&ext.as_str());
    let is_ffmpeg_image = FFMPEG_IMAGE_EXTS_RUST.contains(&ext.as_str());
    let is_raw = RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

    if is_document {
        // For PDF, check magic bytes (%PDF-)
        let bytes = fs::read(&path).unwrap_or_default();
        if bytes.len() < 5 || &bytes[0..5] != b"%PDF-" {
            return Ok(MediaIntegrity {
                corrupted: true,
                reason: "Not a valid PDF file (missing %PDF- header)".into(),
            });
        }
        return Ok(MediaIntegrity {
            corrupted: false,
            reason: String::new(),
        });
    }

    if is_image && !is_ffmpeg_image && !is_raw {
        match image::open(&path) {
            Ok(img) => {
                let (w, h) = img.dimensions();
                if w == 0 || h == 0 {
                    return Ok(MediaIntegrity {
                        corrupted: true,
                        reason: "Image has zero dimensions (corrupted header)".into(),
                    });
                }
                Ok(MediaIntegrity {
                    corrupted: false,
                    reason: String::new(),
                })
            }
            Err(e) => Ok(MediaIntegrity {
                corrupted: true,
                reason: format!("Image decode failed: {e}"),
            }),
        }
    } else if is_video || is_audio || is_ffmpeg_image || is_raw {
        let output = Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                &path,
            ])
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    // Check if stderr contains corruption warnings
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    let corruption_keywords = [
                        "corrupt", "invalid", "truncated", "incomplete",
                        "malformed", "missing", "broken",
                    ];
                    let lower = stderr.to_lowercase();
                    for kw in &corruption_keywords {
                        if lower.contains(kw) {
                            return Ok(MediaIntegrity {
                                corrupted: true,
                                reason: format!("ffprobe reported issue: {stderr}"),
                            });
                        }
                    }
                    // Also check if no streams found (empty/broken file)
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    if !stdout.contains("\"codec_type\"") {
                        return Ok(MediaIntegrity {
                            corrupted: true,
                            reason: "No media streams found in file".into(),
                        });
                    }
                    Ok(MediaIntegrity {
                        corrupted: false,
                        reason: String::new(),
                    })
                } else {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    Ok(MediaIntegrity {
                        corrupted: true,
                        reason: format!("ffprobe failed: {stderr}"),
                    })
                }
            }
            Err(e) => {
                // ffprobe not available — can't check via ffprobe
                Ok(MediaIntegrity {
                    corrupted: false,
                    reason: format!("ffprobe unavailable: {e}"),
                })
            }
        }
    } else {
        Ok(MediaIntegrity {
            corrupted: false,
            reason: format!("Skipped integrity check for unsupported type: .{ext}"),
        })
    }
}

#[tauri::command]
fn fix_media(
    path: String,
    mode: String,
) -> Result<FixResult, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Ok(FixResult {
            success: false,
            output_path: String::new(),
            error: "Source file does not exist".into(),
        });
    }

    let ext = input
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let is_image = IMAGE_EXTS_RUST.contains(&ext.as_str());
    let is_video = VIDEO_EXTS_RUST.contains(&ext.as_str());
    let is_audio = AUDIO_EXTS_RUST.contains(&ext.as_str());
    let is_document = DOCUMENT_EXTS_RUST.contains(&ext.as_str());
    let is_ffmpeg_image = FFMPEG_IMAGE_EXTS_RUST.contains(&ext.as_str());
    let is_raw = RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

    let parent = input.parent().unwrap_or_else(|| Path::new(".")).to_path_buf();
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("fixed")
        .to_string();

    let output_path = if mode == "copy" {
        let fixed_name = format!("{stem}_fixed.{ext}");
        unique_path(parent.join(&fixed_name))
    } else {
        // mode == "replace": write to a temp file first, then swap
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let tmp = std::env::temp_dir()
            .join("Vyu-temp")
            .join(format!("fix-{stamp}.{ext}"));
        if let Some(p) = tmp.parent() {
            let _ = fs::create_dir_all(p);
        }
        tmp
    };

    let fix_result: Result<(), String> = if is_image && !is_ffmpeg_image && !is_raw {
        fix_image(&input, &output_path)
    } else if is_video || is_audio || is_ffmpeg_image || is_raw {
        fix_video_audio(&input, &output_path)
    } else if is_document {
        fix_document(&input, &output_path)
    } else {
        Err(format!("Unsupported file type: .{ext}"))
    };

    match fix_result {
        Ok(()) => {
            if mode == "replace" {
                // Move fixed file over original
                if let Err(e) = fs::remove_file(&input) {
                    let _ = fs::remove_file(&output_path);
                    return Ok(FixResult {
                        success: false,
                        output_path: String::new(),
                        error: format!("Failed to remove original: {e}"),
                    });
                }
                if let Err(e) = fs::rename(&output_path, &input) {
                    return Ok(FixResult {
                        success: false,
                        output_path: String::new(),
                        error: format!("Failed to replace original: {e}"),
                    });
                }
                Ok(FixResult {
                    success: true,
                    output_path: input.to_string_lossy().to_string(),
                    error: String::new(),
                })
            } else {
                Ok(FixResult {
                    success: true,
                    output_path: output_path.to_string_lossy().to_string(),
                    error: String::new(),
                })
            }
        }
        Err(e) => {
            let _ = fs::remove_file(&output_path);
            Ok(FixResult {
                success: false,
                output_path: String::new(),
                error: e,
            })
        }
    }
}

fn fix_image(input: &Path, output: &Path) -> Result<(), String> {
    let img = image::open(input).map_err(|e| format!("Failed to open image: {e}"))?;
    img.save(output).map_err(|e| format!("Failed to save fixed image: {e}"))
}

fn fix_video_audio(input: &Path, output: &Path) -> Result<(), String> {
    // First try: stream copy (remux) — fast and lossless
    let remux = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            &input.to_string_lossy(),
            "-c",
            "copy",
            "-map",
            "0",
            &output.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    if remux.status.success() {
        return Ok(());
    }

    // Second try: full re-encode (slower but can fix more corruption)
    let reencode = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-err_detect",
            "ignore_err",
            "-i",
            &input.to_string_lossy(),
            &output.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to start ffmpeg re-encode: {e}"))?;

    if reencode.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&reencode.stderr).trim().to_string();
        Err(format!("Failed to fix media: {stderr}"))
    }
}

fn fix_document(input: &Path, output: &Path) -> Result<(), String> {
    // For PDF, read the file and re-write it (basic re-save).
    // This preserves the original bytes while writing a clean copy.
    let bytes = fs::read(input).map_err(|e| format!("Failed to read document: {e}"))?;
    if bytes.len() < 5 || &bytes[0..5] != b"%PDF-" {
        return Err("Not a valid PDF file (missing %PDF- header)".into());
    }
    fs::write(output, &bytes).map_err(|e| format!("Failed to write fixed document: {e}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            delete_file,
            trash_file,
            show_in_explorer,
            open_directory,
            get_media_properties,
            check_ffprobe,
            install_ffmpeg,
            process_video_clips,
            rename_file,
            copy_file,
            cleanup_temp_folder,
            backup_file,
            get_clipboard_file_path,
            export_cropped_media,
            export_edited_media,
            convert_media,
            compress_media,
            get_thumbnail,
            get_thumbnail_cache_size,
            clear_thumbnail_cache,
            prepare_display_image,
            prepare_video_display,
            copy_image_to_clipboard,
            check_media_integrity,
            fix_media,
        ])
        .setup(|app| {
            // Set AppUserModelID so Task Manager groups all WebView2 children under "Vyu"
            unsafe {
                let _ = SetCurrentProcessExplicitAppUserModelID(w!("com.vyu.app"));
            }

            // Manage thumbnail concurrency semaphore (4 permits)
            app.manage(ThumbState {
                sem: Semaphore::new(4),
            });

            cleanup_vyu_temp();

            // Silently clean up orphaned thumbnail cache entries
            let cache_dir = app
                .path()
                .app_cache_dir()
                .unwrap_or_else(|_| std::env::temp_dir())
                .join("thumbnails");
            if cache_dir.exists() {
                if let Ok(entries) = fs::read_dir(&cache_dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.extension().map_or(false, |e| e == "src") {
                            if let Ok(src) = fs::read_to_string(&p) {
                                let src = src.trim();
                                if !Path::new(src).exists() {
                                    let _ = fs::remove_file(&p);
                                    let _ = fs::remove_file(p.with_extension("jpg"));
                                }
                            }
                        }
                    }
                }
            }

            let mut args: Vec<String> = std::env::args().collect();
            let window = app.get_webview_window("main").unwrap();

            let skip_save = Arc::new(AtomicBool::new(false));

            restore_window_state(&window, &skip_save);

            let window_for_events = window.clone();
            let skip_for_events = skip_save.clone();
            let last_save = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(60)));

            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                        let mut last = last_save.lock()
                            .expect("window state save mutex should not be poisoned");
                        if last.elapsed() > Duration::from_millis(300) {
                            persist_window_state(&window_for_events, &skip_for_events);
                            *last = Instant::now();
                        }
                    }
                    WindowEvent::CloseRequested { .. } => {
                        persist_window_state(&window_for_events, &skip_for_events);
                    }
                    _ => {}
                }
            });

            let window_for_close = window.clone();
            let skip_for_close = skip_save.clone();
            app.listen("tauri://close-requested", move |_event| {
                persist_window_state(&window_for_close, &skip_for_close);
                cleanup_vyu_temp();
            });

            if args.len() > 1 {
                let file_path = args.swap_remove(1);
                let escaped = serde_json::to_string(&file_path)
                    .expect("failed to JSON-escape file path");
                window.eval(&format!("window.__INITIAL_FILE__ = {}", escaped))
                    .expect("failed to set initial file via eval");
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
            std::io::copy(&mut file, zip).map_err(|e| format!("Zip write error: {e}"))?;
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
        std::io::copy(&mut f, &mut zip).map_err(|e| format!("Zip write error: {e}"))?;
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
    let mut ext = input.extension().and_then(|e| e.to_str()).unwrap_or("mp4").to_string();
    // Remux-needed formats (TS, M2TS) get MP4 output so clips are playable
    if REMUX_VIDEO_EXTS_RUST.contains(&ext.as_str()) {
        ext = "mp4".to_string();
    }
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