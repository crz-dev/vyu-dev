use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use image::GenericImageView;
use tauri::Manager;

use crate::constants::{
    FFMPEG_THUMB_TIMEOUT, THUMB_JPEG_QUALITY, THUMB_SHORT_SIDE,
};
use crate::types::{MediaKind, ThumbState};
use crate::util::{format_data_url, hash_path_xxh3, run_ffmpeg};

pub fn thumb_cache_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("thumbnails");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// In-process image-crate thumbnail: decode, resize to `short_side`, encode as JPEG.
fn thumbnail_via_image_crate(path: &Path, thumb_path: &Path, src_path: &Path, short_side: u32) -> Result<Vec<u8>, String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {e}"))?;
    let (w, h) = img.dimensions();
    let (nw, nh) = if w > h {
        (
            ((w as f64) * (short_side as f64) / (h as f64)).round() as u32,
            short_side,
        )
    } else if h > w {
        (
            short_side,
            ((h as f64) * (short_side as f64) / (w as f64)).round() as u32,
        )
    } else {
        (short_side, short_side)
    };
    let thumb = img.resize_exact(nw.max(1), nh.max(1), image::imageops::FilterType::Triangle);
    let mut jpeg_bytes: Vec<u8> = Vec::new();
    let mut encoder =
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_bytes, THUMB_JPEG_QUALITY);
    encoder
        .encode(
            thumb.as_bytes(),
            thumb.width(),
            thumb.height(),
            thumb.color().into(),
        )
        .map_err(|e| format!("JPEG encode error: {e}"))?;
    let _ = fs::write(thumb_path, &jpeg_bytes);
    let _ = fs::write(src_path, path.to_string_lossy().as_ref());
    Ok(jpeg_bytes)
}

fn generate_video_frame(path: &str, thumb_path: &Path, size: u32) -> Result<Option<String>, String> {
    let scale = format!("scale={size}:{size}:force_original_aspect_ratio=decrease");
    run_ffmpeg(
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            "1",
            "-i",
            path,
            "-vframes",
            "1",
            "-vf",
            &scale,
            "-q:v",
            "4",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )
}

/// Thumbnail for single-frame ffmpeg-based images (PSD, JXL, etc.).
/// Unlike generate_video_frame this does NOT seek (-ss), since
/// single-frame images have only frame at position 0.
fn generate_ffmpeg_image_frame(path: &str, thumb_path: &Path, size: u32) -> Result<Option<String>, String> {
    let scale = format!("scale={size}:{size}:force_original_aspect_ratio=decrease");
    run_ffmpeg(
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            path,
            "-vframes",
            "1",
            "-vf",
            &scale,
            "-q:v",
            "4",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )
}

/// Tries to extract embedded cover art from an audio file and write it to `thumb_path`.
/// Returns `Ok(Some(path))` if cover art was found, `Ok(None)` if not, or `Err` on ffmpeg failure.
fn try_extract_audio_cover_art(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    let result = run_ffmpeg(
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            path,
            "-an",
            "-c:v",
            "copy",
            "-q:v",
            "4",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )?;

    if result.is_some()
        && thumb_path.exists()
        && thumb_path.metadata().map(|m| m.len()).unwrap_or(0) > 0
    {
        return Ok(result);
    }
    let _ = fs::remove_file(thumb_path);
    Ok(None)
}

fn generate_audio_waveform(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    run_ffmpeg(
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            path,
            "-filter_complex",
            "showwavespic=s=640x200:colors=#ffffff",
            "-frames:v",
            "1",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )
}

/// FFmpeg-based thumbnail: dispatches to the right helper based on media kind.
fn thumbnail_via_ffmpeg(
    path: &str,
    thumb_path: &Path,
    src_path: &Path,
    kind: &MediaKind,
    size: u32,
) -> Result<Vec<u8>, String> {
    let result = if kind.is_video {
        generate_video_frame(path, thumb_path, size)
    } else if kind.is_ffmpeg_image || kind.is_raw {
        generate_ffmpeg_image_frame(path, thumb_path, size)
    } else if kind.is_audio {
        match try_extract_audio_cover_art(path, thumb_path) {
            Ok(Some(_)) => Ok(Some(thumb_path.to_string_lossy().to_string())),
            _ => generate_audio_waveform(path, thumb_path),
        }
    } else {
        return Err("Unsupported media type for thumbnail".into());
    };
    match result {
        Ok(Some(_)) => {
            let _ = fs::write(src_path, path);
            fs::read(thumb_path).map_err(|e| format!("Failed to read FFmpeg output: {e}"))
        }
        Ok(None) => {
            let _ = fs::remove_file(thumb_path);
            Err("FFmpeg thumbnail generation failed (no output)".into())
        }
        Err(e) => {
            let _ = fs::remove_file(thumb_path);
            Err(e)
        }
    }
}

/// Single command for all thumbnail generation.
/// Returns a base64 JPEG data URL, or empty string for PDFs / unsupported types.
/// `size` is the short-side target in pixels; defaults to THUMB_SHORT_SIDE (120) if omitted.
#[tauri::command]
pub async fn get_thumbnail(
    app: tauri::AppHandle,
    state: tauri::State<'_, ThumbState>,
    path: String,
    size: Option<u32>,
) -> Result<String, String> {
    let thumb_size = size.unwrap_or(THUMB_SHORT_SIDE);
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    let kind = MediaKind::from_ext(&ext);

    if !kind.is_image && !kind.is_video && !kind.is_audio && !kind.is_document {
        return Ok(String::new());
    }

    if kind.is_document {
        return Ok(String::new());
    }

    let src_meta = fs::metadata(&path).map_err(|e| format!("Cannot access file: {e}"))?;
    let mtime = src_meta
        .modified()
        .map_err(|e| format!("Cannot read mtime: {e}"))?
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let cache_dir = thumb_cache_dir(&app);
    let hash = hash_path_xxh3(&path);
    let thumb_name = format!("{hash}_{mtime}_{thumb_size}.jpg");
    let thumb_path = cache_dir.join(&thumb_name);
    let src_name = format!("{hash}_{mtime}_{thumb_size}.src");
    let src_path = cache_dir.join(&src_name);

    if thumb_path.exists() {
        if let Ok(jpeg_bytes) = fs::read(&thumb_path) {
            return Ok(format_data_url(&jpeg_bytes));
        }
    }

    let use_image_crate = kind.is_image && !kind.is_ffmpeg_image && !kind.is_raw;

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
            thumbnail_via_image_crate(Path::new(&path_c), &thumb_path_c, &src_path_c, thumb_size)
        } else {
            thumbnail_via_ffmpeg(&path_c, &thumb_path_c, &src_path_c, &kind, thumb_size)
        }
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))??;

    Ok(format_data_url(&jpeg_bytes))
}

/// Returns the total size in bytes of all cached thumbnail JPEGs.
#[tauri::command]
pub async fn get_thumbnail_cache_size(app: tauri::AppHandle) -> Result<u64, String> {
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
pub async fn clear_thumbnail_cache(app: tauri::AppHandle) -> Result<u64, String> {
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
