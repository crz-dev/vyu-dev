use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::constants::REMUX_VIDEO_EXTS_RUST;
use crate::types::{ClipProcessResult, ClipSegment};
use crate::util::{ffmpeg_command, format_clip_tag, hash_path_xxh3, sanitize_segments, unique_path};

#[tauri::command]
pub fn process_video_clips(
    path: String,
    output_dir: String,
    segments: Vec<ClipSegment>,
    mode: String,
    delete_original: bool,
) -> Result<ClipProcessResult, String> {
    use crate::util::ffmpeg_extract_segment;

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
    let mut ext = input
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4")
        .to_string();
    if REMUX_VIDEO_EXTS_RUST.contains(&ext.as_str()) {
        ext = "mp4".to_string();
    }
    let base_name = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video")
        .to_string();
    let mut outputs: Vec<String> = Vec::new();

    if mode == "separate" {
        for (idx, seg) in clean_segments.iter().enumerate() {
            let file_name = format!(
                "{}_clip_{:02}_{}_to_{}.{}",
                base_name,
                idx + 1,
                format_clip_tag(seg.start),
                format_clip_tag(seg.end),
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
            let temp_dir = std::env::temp_dir().join(format!(
                "vyu-clips-{}",
                hash_path_xxh3(&format!("{}:{}", path, SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0)))
            ));
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
            fs::write(&list_file, list_text)
                .map_err(|e| format!("Failed writing concat list: {e}"))?;
            let merged_name = format!("{}_clips_merged.{}", base_name, ext);
            let merged_output = unique_path(out_dir.join(merged_name));
            let merge_out = ffmpeg_command()
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
                return Err(String::from_utf8_lossy(&merge_out.stderr)
                    .trim()
                    .to_string());
            }
            outputs.push(merged_output.to_string_lossy().to_string());
            let _ = fs::remove_dir_all(&temp_dir);
        }
    } else {
        return Err("Invalid clip mode".into());
    }

    let mut deleted_original = false;
    if delete_original {
        fs::remove_file(&input)
            .map_err(|e| format!("Clips were created, but deleting original failed: {e}"))?;
        deleted_original = true;
    }

    Ok(ClipProcessResult {
        outputs,
        deleted_original,
        output_dir: out_dir.to_string_lossy().to_string(),
    })
}
