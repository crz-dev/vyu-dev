use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

use crate::commands::display::{
    display_cache_dir, pin_display_cache_file, record_display_cache_write, unpin_display_cache_file,
};
use crate::types::{MediaTrack, MediaTrackCatalog};
use crate::util::{ffmpeg_command, ffprobe_command, hash_path_xxh3};
use serde_json::Value;

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
    let supported = kind != "subtitle" || codec.as_deref().is_some_and(is_text_subtitle_codec);

    Some(MediaTrack {
        index,
        kind: kind.to_string(),
        codec,
        language: value_string(tags.and_then(|t| t.get("language"))),
        title: value_string(tags.and_then(|t| t.get("title"))),
        channels: stream.get("channels").and_then(Value::as_u64),
        channel_layout: value_string(stream.get("channel_layout")),
        is_default: disposition_default,
        supported,
    })
}

fn is_text_subtitle_codec(codec: &str) -> bool {
    !matches!(
        codec,
        "dvd_subtitle" | "hdmv_pgs_subtitle" | "dvb_subtitle" | "dvb_teletext" | "xsub" | "vobsub"
    )
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

fn prepare_subtitle_sync(
    app: &tauri::AppHandle,
    path: &str,
    stream_index: usize,
) -> Result<String, String> {
    let probe = probe_streams(path)?;
    if !stream_exists_with_kind(&probe, stream_index, "subtitle") {
        return Err("The selected subtitle track is no longer available".into());
    }
    let codec = probe
        .get("streams")
        .and_then(Value::as_array)
        .and_then(|streams| {
            streams.iter().find(|stream| {
                stream.get("index").and_then(Value::as_u64) == Some(stream_index as u64)
            })
        })
        .and_then(|stream| stream.get("codec_name"))
        .and_then(Value::as_str)
        .unwrap_or("");
    if !is_text_subtitle_codec(codec) {
        return Err("Image-based subtitles are not supported yet".into());
    }

    let key = fingerprint(path, &format!("subtitle-{stream_index}"))?;
    let cache_dir = display_cache_dir(app);
    let output_path = cache_dir.join(format!("{key}.vtt"));
    if output_path.is_file() {
        return Ok(output_path.to_string_lossy().to_string());
    }
    let temp_path = temp_output_path(&cache_dir, &key, "vtt");
    let map_subtitle = format!("0:{stream_index}");
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
        .map_err(|e| format!("Failed to extract subtitle track: {e}"))?;
    if !output.status.success() {
        let _ = fs::remove_file(&temp_path);
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "FFmpeg could not convert the selected subtitle track".into()
        } else {
            message
        });
    }
    finish_cached_output(&temp_path, &output_path)
}

#[tauri::command]
pub async fn prepare_subtitle_track(
    app: tauri::AppHandle,
    path: String,
    stream_index: usize,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || prepare_subtitle_sync(&app, &path, stream_index))
        .await
        .map_err(|e| format!("Subtitle preparation task failed: {e}"))?
}

fn prepare_external_subtitle_sync(app: &tauri::AppHandle, path: &str) -> Result<String, String> {
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
        "vtt" => return Ok(path.to_string()),
        "srt" => {}
        _ => return Err("Choose an SRT or WebVTT subtitle file".into()),
    }

    let key = fingerprint(path, "external-subtitle")?;
    let cache_dir = display_cache_dir(app);
    let output_path = cache_dir.join(format!("{key}.vtt"));
    if output_path.is_file() {
        return Ok(output_path.to_string_lossy().to_string());
    }
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
        .map_err(|e| format!("Failed to convert subtitle file: {e}"))?;
    if !output.status.success() {
        let _ = fs::remove_file(&temp_path);
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            "FFmpeg could not convert the subtitle file".into()
        } else {
            message
        });
    }
    finish_cached_output(&temp_path, &output_path)
}

#[tauri::command]
pub async fn prepare_external_subtitle(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || prepare_external_subtitle_sync(&app, &path))
        .await
        .map_err(|e| format!("External subtitle preparation task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::{catalog_from_probe, is_text_subtitle_codec};

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
    }

    #[test]
    fn marks_bitmap_subtitles_unsupported() {
        assert!(!is_text_subtitle_codec("hdmv_pgs_subtitle"));
        assert!(!is_text_subtitle_codec("dvd_subtitle"));
        assert!(is_text_subtitle_codec("ass"));
    }
}
