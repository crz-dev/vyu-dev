use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use crate::commands::display::{
    display_cache_dir, pin_display_cache_file, record_display_cache_write, unpin_display_cache_files,
    unpin_display_cache_file,
};
use crate::commands::subtitles::{self, ass, bitmap, vtt};
use crate::database::connection::DbConnection;
use crate::database::loudness as loudness_cache;
use crate::types::{AudioLoudnessInfo, MediaTrack, MediaTrackCatalog, SubtitleDocument};
use crate::util::{ffmpeg_command, ffprobe_command, hash_path_xxh3};
use serde_json::Value;
use tauri::{AppHandle, Manager};

static TEMP_NONCE: AtomicU64 = AtomicU64::new(0);

fn probe_streams(path: &str) -> Result<Value, String> {
    if !Path::new(path).is_file() {
        return Err("Media file does not exist".into());
    }

    let output = ffprobe_command()
        .args(["-v", "error", "-show_streams", "-of", "json", path])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid ffprobe output: {e}"))
}

fn value_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn stream_track(stream: &Value, kind: &str) -> Option<MediaTrack> {
    let index = stream.get("index")?.as_u64()? as usize;
    let codec = value_string(stream.get("codec_name"));
    let tags = stream.get("tags");
    let disposition_default = stream
        .get("disposition")
        .and_then(|d| d.get("default"))
        .and_then(Value::as_u64)
        .unwrap_or(0)
        != 0;
    let bitmap = kind == "subtitle" && codec.as_deref().is_some_and(subtitles::is_bitmap_codec);
    let supported = kind != "subtitle"
        || codec
            .as_deref()
            .is_some_and(subtitles::is_supported_codec);

    Some(MediaTrack {
        index,
        kind: kind.to_string(),
        codec,
        language: value_string(tags.and_then(|t| t.get("language"))),
        title: value_string(tags.and_then(|t| t.get("title"))),
        channels: stream.get("channels").and_then(Value::as_u64),
        channel_layout: value_string(stream.get("channel_layout")),
        is_default: disposition_default,
        bitmap,
        supported,
    })
}

fn subtitle_codec(probe: &Value, index: usize) -> Option<String> {
    probe
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|streams| {
            streams.iter().find(|stream| {
                stream.get("index").and_then(Value::as_u64) == Some(index as u64)
            })
        })
        .and_then(|stream| stream.get("codec_name"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn catalog_from_probe(value: &Value) -> MediaTrackCatalog {
    let streams = value
        .get("streams")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();

    let mut audio = Vec::new();
    let mut subtitles = Vec::new();
    for stream in streams {
        match stream.get("codec_type").and_then(Value::as_str) {
            Some("audio") => {
                if let Some(track) = stream_track(stream, "audio") {
                    audio.push(track);
                }
            }
            Some("subtitle") => {
                if let Some(track) = stream_track(stream, "subtitle") {
                    subtitles.push(track);
                }
            }
            _ => {}
        }
    }

    MediaTrackCatalog { audio, subtitles }
}

#[tauri::command]
pub async fn get_media_tracks(path: String) -> Result<MediaTrackCatalog, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let probe = probe_streams(&path)?;
        Ok(catalog_from_probe(&probe))
    })
    .await
    .map_err(|e| format!("Track inspection task failed: {e}"))?
}

fn fingerprint(path: &str, variant: &str) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot access file: {e}"))?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    Ok(hash_path_xxh3(&format!(
        "{path}\0{}\0{modified}\0{variant}",
        metadata.len()
    )))
}

fn temp_output_path(cache_dir: &Path, key: &str, extension: &str) -> PathBuf {
    let nonce = TEMP_NONCE.fetch_add(1, Ordering::Relaxed);
    let unique = hash_path_xxh3(&format!("{}:{}:{}", std::process::id(), key, nonce));
    cache_dir.join(format!("{key}_{unique}.part.{extension}"))
}

fn finish_cached_output(temp_path: &Path, final_path: &Path) -> Result<String, String> {
    if final_path.exists() {
        let _ = fs::remove_file(temp_path);
        return Ok(final_path.to_string_lossy().to_string());
    }

    match fs::rename(temp_path, final_path) {
        Ok(()) => {}
        Err(error) if final_path.exists() => {
            let _ = fs::remove_file(temp_path);
            let _ = error;
        }
        Err(error) => {
            let _ = fs::remove_file(temp_path);
            return Err(format!("Failed to finalize track cache: {error}"));
        }
    }

    if let Ok(metadata) = fs::metadata(final_path) {
        if let Some(parent) = final_path.parent() {
            record_display_cache_write(metadata.len(), parent);
        }
    }
    Ok(final_path.to_string_lossy().to_string())
}

fn stream_exists_with_kind(probe: &Value, index: usize, kind: &str) -> bool {
    probe
        .get("streams")
        .and_then(Value::as_array)
        .is_some_and(|streams| {
            streams.iter().any(|stream| {
                stream.get("index").and_then(Value::as_u64) == Some(index as u64)
                    && stream.get("codec_type").and_then(Value::as_str) == Some(kind)
            })
        })
}

fn prepare_audio_track_sync(
    app: &tauri::AppHandle,
    path: &str,
    stream_index: usize,
) -> Result<String, String> {
    let probe = probe_streams(path)?;
    if !stream_exists_with_kind(&probe, stream_index, "audio") {
        return Err("The selected audio track is no longer available".into());
    }

    let video_codec = probe
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|streams| {
            streams
                .iter()
                .find(|stream| stream.get("codec_type").and_then(Value::as_str) == Some("video"))
        })
        .and_then(|stream| stream.get("codec_name"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let is_webm_codec = matches!(video_codec, "vp8" | "vp9" | "av1");
    let extension = if is_webm_codec { "webm" } else { "mp4" };
    let audio_encoder = if is_webm_codec { "libopus" } else { "aac" };

    let key = fingerprint(path, &format!("audio-{stream_index}-{extension}"))?;
    let cache_dir = display_cache_dir(app);
    let output_path = cache_dir.join(format!("{key}.{extension}"));
    if output_path.is_file() {
        pin_display_cache_file(&output_path);
        return Ok(output_path.to_string_lossy().to_string());
    }
    let temp_path = temp_output_path(&cache_dir, &key, extension);
    let map_audio = format!("0:{stream_index}");

    let mut command = ffmpeg_command();
    command.args([
        "-nostdin",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        path,
        "-map",
        "0:v:0?",
        "-map",
        &map_audio,
        "-c:v",
        "copy",
        "-c:a",
        audio_encoder,
        "-b:a",
        "192k",
        "-sn",
        "-dn",
    ]);
    if is_webm_codec {
        command.args(["-f", "webm"]);
    } else {
        command.args(["-movflags", "+faststart", "-f", "mp4"]);
    }
    let output = command
        .arg(&temp_path)
        .output()
        .map_err(|e| format!("Failed to prepare audio track: {e}"))?;

    if !output.status.success() {
        let _ = fs::remove_file(&temp_path);
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "FFmpeg could not prepare the selected audio track".into()
        } else {
            message
        });
    }

    pin_display_cache_file(&output_path);
    match finish_cached_output(&temp_path, &output_path) {
        Ok(path) => Ok(path),
        Err(error) => {
            unpin_display_cache_file(&output_path);
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn prepare_audio_track(
    app: tauri::AppHandle,
    path: String,
    stream_index: usize,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        prepare_audio_track_sync(&app, &path, stream_index)
    })
    .await
    .map_err(|e| format!("Audio track preparation task failed: {e}"))?
}

#[tauri::command]
pub async fn release_audio_track(app: tauri::AppHandle, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&path);
        let cache_dir = display_cache_dir(&app);
        let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
        if path.parent() != Some(cache_dir.as_path()) || !matches!(extension, "mp4" | "webm") {
            return Err("Invalid prepared audio track path".into());
        }
        unpin_display_cache_file(path);
        Ok(())
    })
    .await
    .map_err(|e| format!("Audio track release task failed: {e}"))?
}

fn ffmpeg_error(output: &std::process::Output, fallback: &str) -> String {
    let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if message.is_empty() {
        fallback.into()
    } else {
        message
    }
}

fn read_subtitle_text(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("Failed to read subtitle file: {error}"))?;
    if bytes.starts_with(&[0xff, 0xfe]) {
        return Ok(decode_utf16(&bytes[2..], true));
    }
    if bytes.starts_with(&[0xfe, 0xff]) {
        return Ok(decode_utf16(&bytes[2..], false));
    }
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> String {
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|chunk| {
            if little_endian {
                u16::from_le_bytes([chunk[0], chunk[1]])
            } else {
                u16::from_be_bytes([chunk[0], chunk[1]])
            }
        })
        .collect();
    String::from_utf16_lossy(&units)
}

fn parse_text_document(text: &str, is_ass: bool) -> Result<SubtitleDocument, String> {
    if is_ass {
        let document = ass::parse(text);
        if document.cues.is_empty() {
            return Err("This subtitle file contains no cues".into());
        }
        return Ok(subtitles::text_document(
            document.cues,
            document.play_res_x,
            document.play_res_y,
        ));
    }
    let document = vtt::parse(text);
    if document.cues.is_empty() {
        return Err("This subtitle file contains no cues".into());
    }
    Ok(subtitles::text_document(document.cues, 1920, 1080))
}

fn extract_embedded_text(
    app: &tauri::AppHandle,
    path: &str,
    stream_index: usize,
    codec: &str,
) -> Result<SubtitleDocument, String> {
    let key = fingerprint(path, &format!("subtitle-{stream_index}"))?;
    let cache_dir = display_cache_dir(app);
    let map_subtitle = format!("0:{stream_index}");

    if codec == "ass" || codec == "ssa" {
        let output_path = cache_dir.join(format!("{key}.ass"));
        if !output_path.is_file() {
            let temp_path = temp_output_path(&cache_dir, &key, "ass");
            let mut command = ffmpeg_command();
            command.args([
                "-nostdin",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                path,
                "-map",
                &map_subtitle,
                "-c:s",
                "copy",
                "-f",
                "ass",
            ]);
            let output = command
                .arg(&temp_path)
                .output()
                .map_err(|error| format!("Failed to extract subtitle track: {error}"))?;
            if !output.status.success() {
                let _ = fs::remove_file(&temp_path);
                let mut fallback = ffmpeg_command();
                fallback.args([
                    "-nostdin",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    path,
                    "-map",
                    &map_subtitle,
                    "-c:s",
                    "ass",
                    "-f",
                    "ass",
                ]);
                let output = fallback
                    .arg(&temp_path)
                    .output()
                    .map_err(|error| format!("Failed to extract subtitle track: {error}"))?;
                if !output.status.success() {
                    let _ = fs::remove_file(&temp_path);
                    return Err(ffmpeg_error(
                        &output,
                        "FFmpeg could not convert the selected subtitle track",
                    ));
                }
            }
            finish_cached_output(&temp_path, &output_path)?;
        }
        let text = read_subtitle_text(Path::new(&output_path))?;
        return parse_text_document(&text, true);
    }

    let output_path = cache_dir.join(format!("{key}.vtt"));
    if !output_path.is_file() {
        let temp_path = temp_output_path(&cache_dir, &key, "vtt");
        let output = ffmpeg_command()
            .args([
                "-nostdin",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                path,
                "-map",
                &map_subtitle,
                "-f",
                "webvtt",
                &temp_path.to_string_lossy(),
            ])
            .output()
            .map_err(|error| format!("Failed to extract subtitle track: {error}"))?;
        if !output.status.success() {
            let _ = fs::remove_file(&temp_path);
            return Err(ffmpeg_error(
                &output,
                "FFmpeg could not convert the selected subtitle track",
            ));
        }
        finish_cached_output(&temp_path, &output_path)?;
    }
    let text = read_subtitle_text(Path::new(&output_path))?;
    parse_text_document(&text, false)
}

fn pin_bitmap_source(source: &bitmap::BitmapSource) {
    for image in &source.images {
        pin_display_cache_file(Path::new(image));
    }
}

fn bitmap_document(source: bitmap::BitmapSource) -> SubtitleDocument {
    subtitles::bitmap_document(
        source.cues,
        source.images,
        source.canvas_width,
        source.canvas_height,
    )
}

fn prepare_bitmap_stream(
    app: &tauri::AppHandle,
    path: &str,
    stream_index: usize,
    codec: &str,
) -> Result<SubtitleDocument, String> {
    let key = fingerprint(path, &format!("subtitle-{stream_index}-bitmap"))?;
    let cache_dir = display_cache_dir(app);
    let manifest_path = cache_dir.join(format!("{key}_subs.json"));
    if let Some(source) = bitmap::load_manifest(&manifest_path) {
        pin_bitmap_source(&source);
        return Ok(bitmap_document(source));
    }

    let extension = if codec == "hdmv_pgs_subtitle" {
        "sup"
    } else {
        "mks"
    };
    let temp_path = temp_output_path(&cache_dir, &key, extension);
    let map_subtitle = format!("0:{stream_index}");
    let mut command = ffmpeg_command();
    command.args([
        "-nostdin",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        path,
        "-map",
        &map_subtitle,
        "-c:s",
        "copy",
    ]);
    if extension == "sup" {
        command.args(["-f", "sup"]);
    } else {
        command.args(["-strict", "-2", "-f", "matroska"]);
    }
    let output = command
        .arg(&temp_path)
        .output()
        .map_err(|error| format!("Failed to extract subtitle track: {error}"))?;
    if !output.status.success() {
        let _ = fs::remove_file(&temp_path);
        return Err(ffmpeg_error(
            &output,
            "FFmpeg could not extract the selected subtitle track",
        ));
    }

    let decoded = if extension == "sup" {
        let data = fs::read(&temp_path)
            .map_err(|error| format!("Failed to read extracted subtitle track: {error}"))?;
        bitmap::decode_pgs(&data, &cache_dir, &key)
    } else {
        let data = fs::read(&temp_path)
            .map_err(|error| format!("Failed to read extracted subtitle track: {error}"))?;
        bitmap::decode_vobsub_mks(&data, &cache_dir, &key)
    };
    let _ = fs::remove_file(&temp_path);
    let source = decoded?;
    let manifest_bytes = bitmap::save_manifest(&manifest_path, &source)?;
    pin_bitmap_source(&source);
    let image_bytes: u64 = source
        .images
        .iter()
        .filter_map(|path| fs::metadata(path).ok())
        .map(|metadata| metadata.len())
        .sum();
    record_display_cache_write(image_bytes.saturating_add(manifest_bytes), &cache_dir);
    Ok(bitmap_document(source))
}

fn prepare_external_bitmap(
    app: &tauri::AppHandle,
    path: &Path,
    extension: &str,
) -> Result<SubtitleDocument, String> {
    let path_string = path.to_string_lossy().to_string();
    let key = fingerprint(&path_string, &format!("external-bitmap-{extension}"))?;
    let cache_dir = display_cache_dir(app);
    let manifest_path = cache_dir.join(format!("{key}_subs.json"));
    if let Some(source) = bitmap::load_manifest(&manifest_path) {
        pin_bitmap_source(&source);
        return Ok(bitmap_document(source));
    }

    let decoded = match extension {
        "sup" => {
            let data = fs::read(path)
                .map_err(|error| format!("Failed to read subtitle file: {error}"))?;
            bitmap::decode_pgs(&data, &cache_dir, &key)
        }
        "idx" => {
            let idx = read_subtitle_text(path)?;
            let sub_path = path.with_extension("sub");
            if !sub_path.is_file() {
                return Err("The matching .sub file is missing".into());
            }
            let sub = fs::read(&sub_path)
                .map_err(|error| format!("Failed to read subtitle file: {error}"))?;
            bitmap::decode_vobsub_idx(&idx, sub, &cache_dir, &key)
        }
        _ => return Err("Choose a supported image subtitle file".into()),
    };
    let source = decoded?;
    let manifest_bytes = bitmap::save_manifest(&manifest_path, &source)?;
    pin_bitmap_source(&source);
    let image_bytes: u64 = source
        .images
        .iter()
        .filter_map(|path| fs::metadata(path).ok())
        .map(|metadata| metadata.len())
        .sum();
    record_display_cache_write(image_bytes.saturating_add(manifest_bytes), &cache_dir);
    Ok(bitmap_document(source))
}

fn prepare_subtitle_sync(
    app: &tauri::AppHandle,
    path: &str,
    stream_index: usize,
) -> Result<SubtitleDocument, String> {
    let probe = probe_streams(path)?;
    if !stream_exists_with_kind(&probe, stream_index, "subtitle") {
        return Err("The selected subtitle track is no longer available".into());
    }
    let codec = subtitle_codec(&probe, stream_index).unwrap_or_default();
    if subtitles::is_bitmap_codec(&codec) {
        return prepare_bitmap_stream(app, path, stream_index, &codec);
    }
    if !subtitles::is_text_codec(&codec) {
        return Err("This subtitle format is not supported".into());
    }
    extract_embedded_text(app, path, stream_index, &codec)
}

#[tauri::command]
pub async fn prepare_subtitle_track(
    app: tauri::AppHandle,
    path: String,
    stream_index: usize,
) -> Result<SubtitleDocument, String> {
    tauri::async_runtime::spawn_blocking(move || prepare_subtitle_sync(&app, &path, stream_index))
        .await
        .map_err(|e| format!("Subtitle preparation task failed: {e}"))?
}

fn prepare_external_subtitle_sync(
    app: &tauri::AppHandle,
    path: &str,
) -> Result<SubtitleDocument, String> {
    let input_path = Path::new(path);
    if !input_path.is_file() {
        return Err("Subtitle file does not exist".into());
    }
    let extension = input_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match extension.as_str() {
        "vtt" => {
            let text = read_subtitle_text(input_path)?;
            parse_text_document(&text, false)
        }
        "ass" | "ssa" => {
            let text = read_subtitle_text(input_path)?;
            parse_text_document(&text, true)
        }
        "srt" => {
            let key = fingerprint(path, "external-subtitle")?;
            let cache_dir = display_cache_dir(app);
            let output_path = cache_dir.join(format!("{key}.vtt"));
            if !output_path.is_file() {
                let temp_path = temp_output_path(&cache_dir, &key, "vtt");
                let output = ffmpeg_command()
                    .args([
                        "-nostdin",
                        "-y",
                        "-hide_banner",
                        "-loglevel",
                        "error",
                        "-i",
                        path,
                        "-map",
                        "0:0",
                        "-f",
                        "webvtt",
                        &temp_path.to_string_lossy(),
                    ])
                    .output()
                    .map_err(|error| format!("Failed to convert subtitle file: {error}"))?;
                if !output.status.success() {
                    let _ = fs::remove_file(&temp_path);
                    return Err(ffmpeg_error(
                        &output,
                        "FFmpeg could not convert the subtitle file",
                    ));
                }
                finish_cached_output(&temp_path, &output_path)?;
            }
            let text = read_subtitle_text(Path::new(&output_path))?;
            parse_text_document(&text, false)
        }
        "sup" | "idx" => prepare_external_bitmap(app, input_path, &extension),
        "sub" => {
            let idx_path = input_path.with_extension("idx");
            if !idx_path.is_file() {
                return Err("The matching .idx file is missing".into());
            }
            prepare_external_bitmap(app, &idx_path, "idx")
        }
        _ => Err("Choose an SRT, WebVTT, ASS, SUP or VobSub subtitle file".into()),
    }
}

#[tauri::command]
pub async fn prepare_external_subtitle(
    app: tauri::AppHandle,
    path: String,
) -> Result<SubtitleDocument, String> {
    tauri::async_runtime::spawn_blocking(move || prepare_external_subtitle_sync(&app, &path))
        .await
        .map_err(|e| format!("External subtitle preparation task failed: {e}"))?
}

#[tauri::command]
pub async fn release_bitmap_subtitle(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cache_dir = display_cache_dir(&app);
        let valid: Vec<PathBuf> = paths
            .into_iter()
            .filter_map(|value| {
                let path = PathBuf::from(value);
                let is_png = path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
                (is_png && path.parent() == Some(cache_dir.as_path())).then_some(path)
            })
            .collect();
        unpin_display_cache_files(&valid);
        Ok(())
    })
    .await
    .map_err(|e| format!("Bitmap subtitle release task failed: {e}"))?
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MediaChapter {
    pub start: f64,
    pub end: f64,
    pub title: String,
}

fn probe_chapters(path: &str) -> Result<Value, String> {
    if !Path::new(path).is_file() {
        return Err("Media file does not exist".into());
    }
    let output = ffprobe_command()
        .args(["-v", "error", "-show_chapters", "-of", "json", path])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid ffprobe output: {e}"))
}

fn chapters_from_probe(value: &Value) -> Vec<MediaChapter> {
    let mut out = Vec::new();
    let chapters = value
        .get("chapters")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();
    for (i, ch) in chapters.iter().enumerate() {
        let time_base = ch
            .get("time_base")
            .and_then(Value::as_str)
            .unwrap_or("1/1");
        let (num, den) = parse_time_base(time_base);
        let start = ch
            .get("start_time")
            .and_then(Value::as_str)
            .and_then(|s| s.parse::<f64>().ok())
            .or_else(|| {
                ch.get("start")
                    .and_then(Value::as_i64)
                    .map(|v| v as f64 / (num as f64 / den as f64).max(f64::EPSILON))
            })
            .unwrap_or(0.0);
        let end = ch
            .get("end_time")
            .and_then(Value::as_str)
            .and_then(|s| s.parse::<f64>().ok())
            .or_else(|| {
                ch.get("end")
                    .and_then(Value::as_i64)
                    .map(|v| v as f64 / (num as f64 / den as f64).max(f64::EPSILON))
            })
            .unwrap_or(start);
        let title = ch
            .get("tags")
            .and_then(|t| t.get("title"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("Chapter {}", i + 1));
        if end > start {
            out.push(MediaChapter { start, end, title });
        }
    }
    out.sort_by(|a, b| a.start.total_cmp(&b.start));
    out
}

fn parse_time_base(s: &str) -> (i64, i64) {
    let mut parts = s.split('/');
    let n = parts.next().and_then(|x| x.parse().ok()).unwrap_or(1);
    let d = parts.next().and_then(|x| x.parse().ok()).unwrap_or(1);
    (n, d)
}

#[tauri::command]
pub async fn get_media_chapters(path: String) -> Result<Vec<MediaChapter>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let probe = probe_chapters(&path)?;
        Ok(chapters_from_probe(&probe))
    })
    .await
    .map_err(|e| format!("Chapter inspection task failed: {e}"))?
}

static LOUDNESS_SCAN_LOCK: Mutex<()> = Mutex::new(());

fn probe_loudness(path: &str) -> Result<Value, String> {
    if !Path::new(path).is_file() {
        return Err("Media file does not exist".into());
    }

    let output = ffprobe_command()
        .args([
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid ffprobe output: {e}"))
}

fn normalize_tag_key(key: &str) -> String {
    key.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn read_tag(probe: &Value, name: &str) -> Option<String> {
    let wanted = normalize_tag_key(name);
    let mut containers: Vec<&Value> = Vec::new();

    if let Some(tags) = probe.get("format").and_then(|format| format.get("tags")) {
        containers.push(tags);
    }
    if let Some(streams) = probe.get("streams").and_then(Value::as_array) {
        if let Some(stream) = streams
            .iter()
            .find(|stream| stream.get("codec_type").and_then(Value::as_str) == Some("audio"))
        {
            if let Some(tags) = stream.get("tags") {
                containers.push(tags);
            }
        }
    }

    for tags in containers {
        if let Some(object) = tags.as_object() {
            for (key, value) in object {
                if normalize_tag_key(key) == wanted {
                    if let Some(text) = value.as_str() {
                        let text = text.trim();
                        if !text.is_empty() {
                            return Some(text.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

fn parse_db_number(value: &str) -> Option<f64> {
    value
        .split_whitespace()
        .next()
        .and_then(|number| number.trim_end_matches("dB").parse::<f64>().ok())
        .filter(|number| number.is_finite())
}

fn loudness_from_tags(probe: &Value) -> Option<AudioLoudnessInfo> {
    let gain_db = read_tag(probe, "REPLAYGAIN_TRACK_GAIN").and_then(|value| parse_db_number(&value))?;
    let peak = read_tag(probe, "REPLAYGAIN_TRACK_PEAK")
        .and_then(|value| parse_db_number(&value))
        .filter(|value| *value > 0.0);
    Some(AudioLoudnessInfo {
        gain_db,
        peak,
        source: "tag".into(),
    })
}

fn extract_json_object(text: &str) -> Option<&str> {
    let start = text.rfind('{')?;
    let end = text[start..].find('}')? + start;
    Some(&text[start..=end])
}

fn json_number(value: Option<&Value>) -> Option<f64> {
    match value {
        Some(Value::String(text)) => text.trim().parse::<f64>().ok(),
        Some(Value::Number(number)) => number.as_f64(),
        _ => None,
    }
}

fn measure_loudness(path: &str) -> Result<(f64, Option<f64>), String> {
    let output = ffmpeg_command()
        .args([
            "-nostdin",
            "-hide_banner",
            "-i",
            path,
            "-map",
            "0:a:0",
            "-vn",
            "-af",
            "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ])
        .output()
        .map_err(|e| format!("Failed to run loudness analysis: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let json = extract_json_object(&stderr)
        .ok_or_else(|| "Loudness analysis produced no measurements".to_string())?;
    let value: Value =
        serde_json::from_str(json).map_err(|e| format!("Invalid loudness output: {e}"))?;

    let integrated_lufs = json_number(value.get("input_i"))
        .ok_or_else(|| "Loudness analysis returned no integrated loudness".to_string())?;
    if !integrated_lufs.is_finite() || integrated_lufs <= -70.0 {
        return Err("Audio is too quiet to measure".into());
    }

    let peak_db = json_number(value.get("input_tp")).filter(|value| value.is_finite());
    Ok((integrated_lufs, peak_db))
}

fn loudness_from_measurement(integrated_lufs: f64, peak_db: Option<f64>) -> AudioLoudnessInfo {
    AudioLoudnessInfo {
        gain_db: -18.0 - integrated_lufs,
        peak: peak_db.map(|db| 10f64.powf(db / 20.0)),
        source: "scan".into(),
    }
}

#[tauri::command]
pub async fn get_audio_loudness(
    app: AppHandle,
    path: String,
    allow_scan: bool,
) -> Result<Option<AudioLoudnessInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !Path::new(&path).is_file() {
            return Err("Media file does not exist".into());
        }

        let probe = probe_loudness(&path)?;
        if let Some(info) = loudness_from_tags(&probe) {
            return Ok(Some(info));
        }
        if !allow_scan {
            return Ok(None);
        }

        let (file_size, file_modified) = loudness_cache::file_stamp(&path)?;
        let read_cache = || -> Result<Option<loudness_cache::CachedLoudness>, String> {
            let db = app.state::<DbConnection>();
            let conn = db
                .0
                .lock()
                .map_err(|e| format!("Failed to lock database: {e}"))?;
            loudness_cache::get(&conn, &path, file_size, file_modified)
        };

        if let Some(cached) = read_cache()? {
            return Ok(Some(loudness_from_measurement(
                cached.integrated_lufs,
                cached.peak_db,
            )));
        }

        // Serialize measurements so a queued run does not compete with the
        // current track or spawn several FFmpeg processes at once.
        let _guard = LOUDNESS_SCAN_LOCK
            .lock()
            .unwrap_or_else(|error| error.into_inner());

        if let Some(cached) = read_cache()? {
            return Ok(Some(loudness_from_measurement(
                cached.integrated_lufs,
                cached.peak_db,
            )));
        }

        let (integrated_lufs, peak_db) = measure_loudness(&path)?;
        {
            let db = app.state::<DbConnection>();
            let conn = db
                .0
                .lock()
                .map_err(|e| format!("Failed to lock database: {e}"))?;
            loudness_cache::save(
                &conn,
                &path,
                file_size,
                file_modified,
                integrated_lufs,
                peak_db,
            )?;
        }

        Ok(Some(loudness_from_measurement(integrated_lufs, peak_db)))
    })
    .await
    .map_err(|e| format!("Loudness analysis task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::{catalog_from_probe, extract_json_object, loudness_from_tags, parse_db_number};
    use crate::commands::subtitles;

    #[test]
    fn parses_replaygain_tags_from_the_container() {
        let probe = serde_json::json!({
            "format": {
                "tags": {
                    "REPLAYGAIN_TRACK_GAIN": "-7.23 dB",
                    "REPLAYGAIN_TRACK_PEAK": "0.981"
                }
            }
        });

        let info = loudness_from_tags(&probe).expect("gain tag");
        assert_eq!(info.gain_db, -7.23);
        assert_eq!(info.peak, Some(0.981));
        assert_eq!(info.source, "tag");
    }

    #[test]
    fn falls_back_to_audio_stream_tags() {
        let probe = serde_json::json!({
            "streams": [
                {"codec_type": "video"},
                {
                    "codec_type": "audio",
                    "tags": {"replaygain_track_gain": "4.5 dB"}
                }
            ]
        });

        let info = loudness_from_tags(&probe).expect("stream gain tag");
        assert_eq!(info.gain_db, 4.5);
        assert_eq!(info.peak, None);
    }

    #[test]
    fn ignores_missing_or_invalid_gain_tags() {
        assert!(loudness_from_tags(&serde_json::json!({})).is_none());
        let probe = serde_json::json!({
            "format": {"tags": {"REPLAYGAIN_TRACK_GAIN": "loud"}}
        });
        assert!(loudness_from_tags(&probe).is_none());
        assert_eq!(parse_db_number("-3.5 dB"), Some(-3.5));
        assert_eq!(parse_db_number("-inf"), None);
    }

    #[test]
    fn extracts_the_loudnorm_measurement_block() {
        let stderr = "frame= 10 fps=0.0\n{\n  \"input_i\" : \"-16.42\",\n  \"input_tp\" : \"-1.02\"\n}\n";
        let json = extract_json_object(stderr).expect("json block");
        let value: serde_json::Value = serde_json::from_str(json).unwrap();
        assert_eq!(value.get("input_i").and_then(|v| v.as_str()), Some("-16.42"));
    }

    #[test]
    fn parses_audio_and_text_subtitle_metadata() {
        let probe = serde_json::json!({
            "streams": [
                {
                    "index": 1,
                    "codec_type": "audio",
                    "codec_name": "aac",
                    "channels": 6,
                    "channel_layout": "5.1",
                    "tags": {"language": "eng", "title": "English"},
                    "disposition": {"default": 1}
                },
                {
                    "index": 2,
                    "codec_type": "subtitle",
                    "codec_name": "subrip",
                    "tags": {"language": "jpn"},
                    "disposition": {"default": 0}
                }
            ]
        });

        let catalog = catalog_from_probe(&probe);
        assert_eq!(catalog.audio.len(), 1);
        assert_eq!(catalog.audio[0].index, 1);
        assert_eq!(catalog.audio[0].language.as_deref(), Some("eng"));
        assert_eq!(catalog.audio[0].channels, Some(6));
        assert!(catalog.audio[0].is_default);
        assert_eq!(catalog.subtitles.len(), 1);
        assert!(catalog.subtitles[0].supported);
        assert!(!catalog.subtitles[0].bitmap);
    }

    #[test]
    fn marks_bitmap_subtitles_as_supported() {
        assert!(subtitles::is_bitmap_codec("hdmv_pgs_subtitle"));
        assert!(subtitles::is_bitmap_codec("dvd_subtitle"));
        assert!(subtitles::is_bitmap_codec("vobsub"));
        assert!(subtitles::is_supported_codec("hdmv_pgs_subtitle"));
        assert!(subtitles::is_supported_codec("dvd_subtitle"));
        assert!(!subtitles::is_supported_codec("dvb_teletext"));
        assert!(!subtitles::is_supported_codec("xsub"));
        assert!(subtitles::is_text_codec("ass"));
    }
}
