use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::{FixResult, MediaKind};
use crate::util::{ffmpeg_command, unique_path};

fn fix_image(input: &Path, output: &Path) -> Result<(), String> {
    let img = image::open(input).map_err(|e| format!("Failed to open image: {e}"))?;
    img.save(output)
        .map_err(|e| format!("Failed to save fixed image: {e}"))
}

fn fix_video_audio(input: &Path, output: &Path) -> Result<(), String> {
    let remux = ffmpeg_command()
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

    let reencode = ffmpeg_command()
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
    let bytes = fs::read(input).map_err(|e| format!("Failed to read document: {e}"))?;
    if bytes.len() < 5 || &bytes[0..5] != b"%PDF-" {
        return Err("Not a valid PDF file (missing %PDF- header)".into());
    }
    fs::write(output, &bytes).map_err(|e| format!("Failed to write fixed document: {e}"))
}

#[tauri::command]
pub fn fix_media(path: String, mode: String) -> Result<FixResult, String> {
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
    let kind = MediaKind::from_ext(&ext);

    let parent = input
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("fixed")
        .to_string();

    let output_path = if mode == "copy" {
        let fixed_name = format!("{stem}_fixed.{ext}");
        unique_path(parent.join(&fixed_name))
    } else {
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

    let fix_result: Result<(), String> = if kind.is_image && !kind.is_ffmpeg_image && !kind.is_raw {
        fix_image(&input, &output_path)
    } else if kind.is_video || kind.is_audio || kind.is_ffmpeg_image || kind.is_raw {
        fix_video_audio(&input, &output_path)
    } else if kind.is_document {
        fix_document(&input, &output_path)
    } else {
        Err(format!("Unsupported file type: .{ext}"))
    };

    match fix_result {
        Ok(()) => {
            if mode == "replace" {
                // Rename original to a backup before putting the fixed file in place.
                // This prevents data loss if the process crashes mid-replacement.
                let stem = input
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("file");
                let backup = unique_path(
                    input
                        .parent()
                        .unwrap_or_else(|| Path::new("."))
                        .join(format!(".{stem}.bak"))
                );
                if let Err(e) = fs::rename(&input, &backup) {
                    let _ = fs::remove_file(&output_path);
                    return Ok(FixResult {
                        success: false,
                        output_path: String::new(),
                        error: format!("Failed to backup original: {e}"),
                    });
                }
                if let Err(e) = fs::rename(&output_path, &input) {
                    let _ = fs::rename(&backup, &input);
                    return Ok(FixResult {
                        success: false,
                        output_path: String::new(),
                        error: format!("Failed to replace original: {e}"),
                    });
                }
                let _ = fs::remove_file(&backup);
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
