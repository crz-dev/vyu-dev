// Thumbnail generation
use std::collections::HashMap;
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use futures::future::join_all;
use image::GenericImageView;
use tauri::Manager;

use crate::constants::{
    FFMPEG_THUMB_TIMEOUT, THUMB_JPEG_QUALITY, THUMB_SHORT_SIDE,
};
use crate::types::{MediaKind, ThumbState};
use crate::util::{format_data_url, hash_path_xxh3, run_ffmpeg};

const MAX_CACHE_BYTES: u64 = 500 * 1024 * 1024;
const EVICTION_MARGIN: u64 = 10 * 1024 * 1024;

/// Total cache size tracker
static CACHE_USED: AtomicU64 = AtomicU64::new(u64::MAX);

static CACHED_THUMB_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn thumb_cache_dir(app: &tauri::AppHandle) -> &Path {
    CACHED_THUMB_DIR.get_or_init(|| {
        let dir = app
            .path()
            .app_cache_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("thumbnails");
        let _ = fs::create_dir_all(&dir);
        dir
    })
}

/// Scaled JPEG decode
fn open_jpeg_scaled(path: &Path, short_side: u32) -> Result<image::DynamicImage, String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("jpg") || e.eq_ignore_ascii_case("jpeg"))
        .unwrap_or(false);
    if !ext {
        return Err("not a JPEG".into());
    }

    let file = fs::File::open(path).map_err(|e| format!("Cannot open JPEG: {e}"))?;
    let mut decoder = jpeg_decoder::Decoder::new(BufReader::new(file));

    // Pick largest IDCT factor (1/8, 1/4, 1/2, 1/1) that yields dimensions >= short_side
    let (w, h) = decoder
        .scale(short_side as u16, short_side as u16)
        .map_err(|e| format!("JPEG scale config: {e}"))?;

    let pixels = decoder
        .decode()
        .map_err(|e| format!("JPEG decode: {e}"))?;

    let w = w as u32;
    let h = h as u32;

    image::RgbImage::from_raw(w, h, pixels)
        .map(image::DynamicImage::ImageRgb8)
        .ok_or_else(|| "JPEG decode produced invalid buffer".into())
}

/// Encode + write thumbnail
fn encode_and_save_thumbnail(
    img: &image::DynamicImage,
    thumb_path: &Path,
    src_path: &Path,
    short_side: u32,
    orig_path: &Path,
) -> Result<Vec<u8>, String> {
    let (w, h) = img.dimensions();
    if w <= short_side && h <= short_side {
        let mut jpeg_bytes: Vec<u8> = Vec::new();
        let mut encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_bytes, THUMB_JPEG_QUALITY);
        encoder
            .encode(img.as_bytes(), w, h, img.color().into())
            .map_err(|e| format!("JPEG encode error: {e}"))?;
        let _ = fs::write(thumb_path, &jpeg_bytes);
        let _ = fs::write(src_path, orig_path.to_string_lossy().as_ref());
        return Ok(jpeg_bytes);
    }
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
    let _ = fs::write(src_path, orig_path.to_string_lossy().as_ref());
    Ok(jpeg_bytes)
}

/// In-process thumbnail
fn thumbnail_via_image_crate(
    path: &Path,
    thumb_path: &Path,
    src_path: &Path,
    short_side: u32,
) -> Result<Vec<u8>, String> {
    // Fast path: JPEG scale-down decode avoids full-resolution memory.
    let img = open_jpeg_scaled(path, short_side)
        .or_else(|_| image::open(path).map_err(|e| format!("Failed to open image: {e}")))?;

    encode_and_save_thumbnail(&img, thumb_path, src_path, short_side, path)
}

fn generate_video_frame(path: &str, thumb_path: &Path, size: u32) -> Result<Option<String>, String> {
    let scale = format!("scale={size}:{size}:force_original_aspect_ratio=decrease");
    run_ffmpeg(
        &[
            "-y", "-hide_banner", "-loglevel", "error",
            "-ss", "1",
            "-i", path,
            "-vframes", "1",
            "-vf", &scale,
            "-q:v", "4",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )
}

fn generate_ffmpeg_image_frame(path: &str, thumb_path: &Path, size: u32) -> Result<Option<String>, String> {
    let scale = format!("scale={size}:{size}:force_original_aspect_ratio=decrease");
    run_ffmpeg(
        &[
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", path,
            "-vframes", "1",
            "-vf", &scale,
            "-q:v", "4",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )
}

fn try_extract_audio_cover_art(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    let result = run_ffmpeg(
        &[
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", path,
            "-an",
            "-c:v", "copy",
            "-q:v", "4",
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

/// Extract embedded JPEG preview from RAW file
fn try_extract_raw_preview(path: &str, thumb_path: &Path) -> Result<Option<String>, String> {
    let stream_idx = crate::util::find_embedded_jpeg_stream(path);
    let idx = match stream_idx {
        Some(i) => i,
        None => return Ok(None),
    };

    run_ffmpeg(
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            path,
            "-map",
            &format!("0:v:{idx}"),
            "-c:v",
            "copy",
            "-vframes",
            "1",
            "-q:v",
            "4",
            &thumb_path.to_string_lossy(),
        ],
        thumb_path,
        FFMPEG_THUMB_TIMEOUT,
    )
}

/// FFmpeg thumbnail
fn thumbnail_via_ffmpeg(
    path: &str,
    thumb_path: &Path,
    src_path: &Path,
    kind: &MediaKind,
    size: u32,
) -> Result<Vec<u8>, String> {
    let result = if kind.is_video {
        generate_video_frame(path, thumb_path, size)
    } else if kind.is_ffmpeg_image {
        generate_ffmpeg_image_frame(path, thumb_path, size)
    } else if kind.is_raw {
        // Fast path: extract embedded JPEG preview, decode + scale via image crate
        let fast_result = try_extract_raw_preview(path, thumb_path);
        if let Ok(Some(_)) = fast_result {
            let cached_thumb = thumb_path.to_path_buf();
            match open_jpeg_scaled(thumb_path, size)
                .or_else(|_| image::open(thumb_path).map_err(|e| format!("Failed to open embedded JPEG: {e}")))
            {
                Ok(img) => {
                    let bytes = encode_and_save_thumbnail(&img, &cached_thumb, src_path, size, Path::new(path))?;
                    let _ = fs::write(src_path, path);
                    return Ok(bytes);
                }
                Err(_) => {
                    let _ = fs::remove_file(thumb_path);
                }
            }
        }
        generate_ffmpeg_image_frame(path, thumb_path, size)
    } else if kind.is_audio {
        match try_extract_audio_cover_art(path, thumb_path) {
            Ok(Some(_)) => Ok(Some(thumb_path.to_string_lossy().to_string())),
            // No waveform fallback — placeholder icon shown by frontend
            _ => Ok(None),
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

/// Inner thumbnail logic shared by single and batch commands
async fn thumbnail_for_path(
    _app: &tauri::AppHandle,
    state: &ThumbState,
    cache_dir: &Path,
    path: &str,
    thumb_size: u32,
) -> Result<String, String> {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    let kind = MediaKind::from_ext(&ext);

    if !kind.is_image && !kind.is_video && !kind.is_audio && !kind.is_document {
        return Ok(String::new());
    }

    if kind.is_document {
        return Ok(String::new());
    }

    let use_image_crate = kind.is_image && !kind.is_ffmpeg_image && !kind.is_raw;

    // In-flight dedup (keyed by hash + size)
    let hash = hash_path_xxh3(path);
    let inflight_key = format!("{hash}_{thumb_size}");
    if let Some(rx) = state.inflight.register(&inflight_key).await {
        return rx
            .await
            .unwrap_or(Ok(std::sync::Arc::new(vec![])))
            .map(|bytes| format_data_url(&bytes[..]));
    }

    let sem = state.sem_for_kind(&kind);
    let _permit = sem.acquire().await;
    let _permit = match _permit {
        Ok(p) => p,
        Err(e) => {
            state.inflight.cancel(&inflight_key).await;
            return Err(format!("Semaphore error: {e}"));
        }
    };

    let path_c = path.to_string();
    let cache_dir_c = cache_dir.to_path_buf();

    let spawn_result = tauri::async_runtime::spawn_blocking(move || -> Result<(Vec<u8>, String), String> {
        let src_meta = fs::metadata(&path_c).map_err(|e| format!("Cannot access file: {e}"))?;
        let mtime = src_meta
            .modified()
            .map_err(|e| format!("Cannot read mtime: {e}"))?
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let cache_key = format!("{hash}_{mtime}_{thumb_size}");
        let thumb_path = cache_dir_c.join(format!("{cache_key}.jpg"));
        let src_path = cache_dir_c.join(format!("{cache_key}.src"));

        if thumb_path.exists() {
            if let Ok(jpeg_bytes) = fs::read(&thumb_path) {
                return Ok((jpeg_bytes, cache_key));
            }
        }

        let jpeg_bytes = if use_image_crate {
            thumbnail_via_image_crate(
                Path::new(&path_c),
                &thumb_path,
                &src_path,
                thumb_size,
            )
        } else {
            thumbnail_via_ffmpeg(&path_c, &thumb_path, &src_path, &kind, thumb_size)
        }?;

        if let Ok(meta) = fs::metadata(&thumb_path) {
            record_cache_write(meta.len(), &cache_dir_c);
        }

        Ok((jpeg_bytes, cache_key))
    })
    .await;

    let (jpeg_bytes, _cache_key) = match spawn_result {
        Ok(Ok(result)) => result,
        Ok(Err(e)) => {
            state.inflight.cancel(&inflight_key).await;
            return Err(e);
        }
        Err(e) => {
            state.inflight.cancel(&inflight_key).await;
            return Err(format!("Thread join error: {e}"));
        }
    };

    state
        .inflight
        .complete(&inflight_key, Ok(jpeg_bytes.clone()))
        .await;

    Ok(format_data_url(&jpeg_bytes))
}

/// Single thumbnail command
#[tauri::command]
pub async fn get_thumbnail(
    app: tauri::AppHandle,
    state: tauri::State<'_, ThumbState>,
    path: String,
    size: Option<u32>,
) -> Result<String, String> {
    let thumb_size = size.unwrap_or(THUMB_SHORT_SIDE);
    let cache_dir = thumb_cache_dir(&app).to_path_buf();
    thumbnail_for_path(&app, &state, &cache_dir, &path, thumb_size).await
}

/// Batch thumbnail command — process multiple paths in a single IPC call
#[tauri::command]
pub async fn get_thumbnails(
    app: tauri::AppHandle,
    state: tauri::State<'_, ThumbState>,
    paths: Vec<String>,
    size: Option<u32>,
) -> Result<HashMap<String, String>, String> {
    let thumb_size = size.unwrap_or(THUMB_SHORT_SIDE);
    let cache_dir = thumb_cache_dir(&app).to_path_buf();
    let state_ref: &ThumbState = &state;

    let futs: Vec<_> = paths
        .into_iter()
        .map(|path| {
            let app = app.clone();
            let cache_dir = cache_dir.clone();
            async move {
                let result =
                    thumbnail_for_path(&app, state_ref, &cache_dir, &path, thumb_size).await;
                (path, result)
            }
        })
        .collect();

    let results = join_all(futs).await;
    let mut map = HashMap::new();
    for (path, result) in results {
        map.insert(path, result.unwrap_or_default());
    }
    Ok(map)
}

/// Record cache entry
fn record_cache_write(written_bytes: u64, cache_dir: &Path) {
    let prev = CACHE_USED.fetch_add(written_bytes, Ordering::AcqRel);
    if prev == u64::MAX {
        // First write — sentinel wrapped; correct immediately.
        let actual = compute_cache_size(cache_dir);
        CACHE_USED.store(actual, Ordering::Release);
        // Don't check eviction here — the next write will.
        return;
    }
    let new_val = prev.wrapping_add(written_bytes);
    if new_val > MAX_CACHE_BYTES + EVICTION_MARGIN {
        let dir = cache_dir.to_path_buf();
        let _ = std::thread::spawn(move || {
            // Recompute from disk (counter may have drifted).
            let actual = compute_cache_size(&dir);
            CACHE_USED.store(actual, Ordering::SeqCst);
            if actual > MAX_CACHE_BYTES {
                try_evict_cache(&dir);
            }
        });
    }
}

/// Cache folder size
fn compute_cache_size(cache_dir: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return 0;
    };
    let mut total: u64 = 0;
    for entry in entries.flatten() {
        if entry.path().extension().map_or(false, |e| e == "jpg") {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

/// Evict oldest entries
fn try_evict_cache(cache_dir: &Path) {
    let Ok(entries) = fs::read_dir(cache_dir) else {
        return;
    };
    let mut jpeg_entries: Vec<(PathBuf, SystemTime)> = Vec::new();
    let mut total: u64 = 0;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().map_or(false, |e| e == "jpg") {
            if let Ok(meta) = entry.metadata() {
                total += meta.len();
                if let Ok(mtime) = meta.modified() {
                    jpeg_entries.push((p, mtime));
                }
            }
        }
    }
    if total <= MAX_CACHE_BYTES {
        CACHE_USED.store(total, Ordering::Relaxed);
        return;
    }
    jpeg_entries.sort_by(|a, b| a.1.cmp(&b.1));
    let mut freed: u64 = 0;
    let target = total - MAX_CACHE_BYTES;
    for (jpg_path, _) in &jpeg_entries {
        if freed >= target {
            break;
        }
        if let Ok(meta) = jpg_path.metadata() {
            freed += meta.len();
        }
        let _ = fs::remove_file(jpg_path);
        let src_path = jpg_path.with_extension("src");
        let _ = fs::remove_file(src_path);
    }
    CACHE_USED.fetch_sub(freed, Ordering::Relaxed);
}

/// Cache total size
#[tauri::command]
pub async fn get_thumbnail_cache_size(app: tauri::AppHandle) -> Result<u64, String> {
    let cache_dir = thumb_cache_dir(&app);
    let size = compute_cache_size(cache_dir);
    // Re-sync the shared counter with ground truth.
    CACHE_USED.store(size, Ordering::Relaxed);
    Ok(size)
}

/// Clear cache
#[tauri::command]
pub async fn clear_thumbnail_cache(app: tauri::AppHandle) -> Result<u64, String> {
    let cache_dir = thumb_cache_dir(&app);
    if !cache_dir.exists() {
        return Ok(0);
    }
    let mut freed: u64 = 0;
    let entries = fs::read_dir(cache_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        let ext = p.extension().map(|e| e.to_os_string()).unwrap_or_default();
        if ext == "jpg" || ext == "src" {
            freed += entry.metadata().map(|m| m.len()).unwrap_or(0);
            let _ = fs::remove_file(&p);
        }
    }
    CACHE_USED.store(0, Ordering::Relaxed);
    Ok(freed)
}

/// Migrate cache entries
#[tauri::command]
pub async fn migrate_thumbnail_cache(
    app: tauri::AppHandle,
    old_dir: String,
    new_dir: String,
) -> Result<usize, String> {
    let cache_dir = thumb_cache_dir(&app).to_path_buf();

    tauri::async_runtime::spawn_blocking(move || {
        let mut migrated = 0usize;

        let entries =
            fs::read_dir(&cache_dir).map_err(|e| format!("Failed to read cache: {e}"))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
            let path = entry.path();

            if path.extension().and_then(|e| e.to_str()) != Some("src") {
                continue;
            }

            let src_content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let stored_path = src_content.trim();

            if let Some(relative) = stored_path.strip_prefix(&old_dir) {
                let relative = relative.trim_start_matches('\\').trim_start_matches('/');
                let new_path = Path::new(&new_dir).join(relative);
                let new_hash = hash_path_xxh3(&new_path.to_string_lossy());

                let filename = match path.file_stem().and_then(|s| s.to_str()) {
                    Some(f) => f.to_string(),
                    None => continue,
                };

                if let Some(pos) = filename.find('_') {
                    let rest = &filename[pos + 1..];
                    let new_filename = format!("{}_{}", new_hash, rest);

                    let jpg_path = path.with_extension("jpg");
                    let new_jpg = cache_dir.join(format!("{}.jpg", new_filename));
                    let new_src = cache_dir.join(format!("{}.src", new_filename));

                    if jpg_path.exists() && !new_jpg.exists() {
                        let _ = fs::copy(&jpg_path, &new_jpg);
                        let _ = fs::copy(&path, &new_src);
                        migrated += 1;
                    }
                }
            }
        }

        Ok(migrated)
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}
