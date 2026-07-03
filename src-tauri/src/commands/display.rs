// Display pipeline
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::Manager;

use crate::constants::{
    BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST, FFMPEG_IMAGE_EXTS_RUST,
    RAW_IMAGE_EXTS_RUST, REMUX_VIDEO_EXTS_RUST,
};
use crate::util::{check_cache, ffmpeg_command, hash_path_xxh3};

const DISPLAY_CACHE_MAX: u64 = 2 * 1024 * 1024 * 1024;
const EVICTION_MARGIN: u64 = 50 * 1024 * 1024;
static DISPLAY_CACHE_USED: AtomicU64 = AtomicU64::new(0);

fn cover_art_cache_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("cover_art");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn display_cache_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("displays");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn record_display_cache_write(written_bytes: u64, cache_dir: &Path) {
    let prev = DISPLAY_CACHE_USED.fetch_add(written_bytes, Ordering::AcqRel);
    let new_val = prev.wrapping_add(written_bytes);
    if new_val > DISPLAY_CACHE_MAX + EVICTION_MARGIN {
        let dir = cache_dir.to_path_buf();
        let _ = std::thread::spawn(move || {
            let actual = compute_display_cache_size(&dir);
            DISPLAY_CACHE_USED.store(actual, Ordering::SeqCst);
            if actual > DISPLAY_CACHE_MAX {
                try_evict_display_cache(&dir);
            }
        });
    }
}

fn compute_display_cache_size(cache_dir: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(cache_dir) else { return 0 };
    let mut total: u64 = 0;
    for entry in entries.flatten() {
        let ext = entry.path().extension().map(|e| e.to_os_string()).unwrap_or_default();
        if ext == "jpg" || ext == "mp4" || ext == "png" {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

fn try_evict_display_cache(cache_dir: &Path) {
    let Ok(entries) = fs::read_dir(cache_dir) else { return };
    let mut cached_entries: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    let mut total: u64 = 0;
    for entry in entries.flatten() {
        let p = entry.path();
        let ext = p.extension().map(|e| e.to_os_string()).unwrap_or_default();
        if ext == "jpg" || ext == "mp4" || ext == "png" {
            if let Ok(meta) = entry.metadata() {
                total += meta.len();
                if let Ok(mtime) = meta.modified() {
                    cached_entries.push((p, mtime));
                }
            }
        }
    }
    if total <= DISPLAY_CACHE_MAX {
        DISPLAY_CACHE_USED.store(total, Ordering::Relaxed);
        return;
    }
    cached_entries.sort_by(|a, b| a.1.cmp(&b.1));
    let mut freed: u64 = 0;
    let target = total - DISPLAY_CACHE_MAX;
    for (path, _) in &cached_entries {
        if freed >= target { break; }
        if let Ok(meta) = path.metadata() {
            freed += meta.len();
        }
        let _ = fs::remove_file(path);
    }
    DISPLAY_CACHE_USED.fetch_sub(freed, Ordering::Relaxed);
}

/// Decode unsupported image
#[tauri::command]
pub async fn prepare_display_image(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<String>, String> {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();

    if !BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST.contains(&ext.as_str()) {
        return Ok(None);
    }

    let display_dir = display_cache_dir(&app);

    let input_path = Path::new(&path);
    if let Some(cached) = check_cache(input_path, &display_dir, "jpg") {
        return Ok(Some(cached.to_string_lossy().to_string()));
    }

    let hash = hash_path_xxh3(&path);
    let cached_jpg = display_dir.join(format!("{hash}.jpg"));

    let path_clone = path.clone();
    let cached_clone = cached_jpg.clone();
    let ext_clone = ext.clone();
    let is_ffmpeg = FFMPEG_IMAGE_EXTS_RUST.contains(&ext.as_str())
        || RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

    tauri::async_runtime::spawn_blocking(move || {
        if is_ffmpeg {
            let status = ffmpeg_command()
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    &path_clone,
                    "-q:v",
                    "4",
                    &cached_clone.to_string_lossy(),
                ])
                .status()
                .map_err(|e| format!("Failed to run ffmpeg for {} display: {e}", ext_clone))?;

            if !status.success() {
                let _ = fs::remove_file(&cached_clone);
                return Err(format!(
                    "ffmpeg failed to convert {} for display",
                    ext_clone
                ));
            }
            if let Ok(meta) = fs::metadata(&cached_clone) {
                record_display_cache_write(meta.len(), &display_dir);
            }
            Ok(Some(cached_clone.to_string_lossy().to_string()))
        } else {
            let img = image::open(&path_clone)
                .map_err(|e| format!("Failed to decode {} for display: {e}", ext_clone))?;

            let mut jpeg_bytes: Vec<u8> = Vec::new();
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_bytes, 85);
            encoder
                .encode(img.as_bytes(), img.width(), img.height(), img.color().into())
                .map_err(|e| format!("Failed to encode display JPEG: {e}"))?;

            fs::write(&cached_clone, &jpeg_bytes)
                .map_err(|e| format!("Failed to write display cache: {e}"))?;

            if let Ok(meta) = fs::metadata(&cached_clone) {
                record_display_cache_write(meta.len(), &display_dir);
            }

            Ok(Some(cached_clone.to_string_lossy().to_string()))
        }
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

/// Remux video
#[tauri::command]
pub async fn prepare_video_display(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<String>, String> {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();

    if !REMUX_VIDEO_EXTS_RUST.contains(&ext.as_str()) {
        return Ok(None);
    }

    let display_dir = display_cache_dir(&app);

    let input_path = Path::new(&path);
    if let Some(cached) = check_cache(input_path, &display_dir, "mp4") {
        return Ok(Some(cached.to_string_lossy().to_string()));
    }

    let hash = hash_path_xxh3(&path);
    let cached_mp4 = display_dir.join(format!("{hash}.mp4"));

    let path_clone = path.clone();
    let cached_clone = cached_mp4.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let status = ffmpeg_command()
            .args([
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                &path_clone,
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                &cached_clone.to_string_lossy(),
            ])
            .status()
            .map_err(|e| format!("Failed to run ffmpeg for remux: {e}"))?;

        if !status.success() {
            let _ = fs::remove_file(&cached_clone);
            return Err("ffmpeg remux failed".into());
        }
        if let Ok(meta) = fs::metadata(&cached_clone) {
            record_display_cache_write(meta.len(), &display_dir);
        }
        Ok(Some(cached_clone.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

/// Extract cover art
#[tauri::command]
pub async fn extract_cover_art(app: tauri::AppHandle, path: String) -> Result<Option<String>, String> {
    use crate::util::run_ffmpeg;
    use crate::constants::FFMPEG_THUMB_TIMEOUT;

    let cache_dir = cover_art_cache_dir(&app);
    let hash = hash_path_xxh3(&path);

    let src_meta = fs::metadata(&path).map_err(|e| format!("Cannot access file: {e}"))?;
    let mtime = src_meta
        .modified()
        .map_err(|e| format!("Cannot read mtime: {e}"))?
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    for ext in ["jpg", "png"] {
        let cached = cache_dir.join(format!("{hash}_{mtime}.{ext}"));
        if cached.exists() {
            return Ok(Some(cached.to_string_lossy().to_string()));
        }
    }

    let cached_jpg = cache_dir.join(format!("{hash}_{mtime}.jpg"));
    let path_c = path.clone();
    let cached_c = cached_jpg.clone();

    let result =
        tauri::async_runtime::spawn_blocking(move || -> Result<Option<PathBuf>, String> {
            let out = run_ffmpeg(
                &[
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    &path_c,
                    "-an",
                    "-c:v",
                    "copy",
                    "-q:v",
                    "4",
                    &cached_c.to_string_lossy(),
                ],
                &cached_c,
                FFMPEG_THUMB_TIMEOUT,
            )?;

            if out.is_some()
                && cached_c.exists()
                && cached_c.metadata().map(|m| m.len()).unwrap_or(0) > 0
            {
                return Ok(Some(cached_c));
            }
            let _ = fs::remove_file(&cached_c);
            Ok(None)
        })
        .await
        .map_err(|e| format!("Thread join error: {e}"))?;

    Ok(result?.map(|p| p.to_string_lossy().to_string()))
}
