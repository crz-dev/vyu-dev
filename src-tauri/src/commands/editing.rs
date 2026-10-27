// Image editing
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{Emitter, Manager};

use crate::util::{
    canonicalize_path, ffmpeg_command, ffprobe_command, hash_path_xxh3,
};

// Same-file applies must never hand ffmpeg its own input as output.
fn same_file(input: &Path, output: &Path) -> bool {
    match (std::fs::canonicalize(input), std::fs::canonicalize(output)) {
        (Ok(a), Ok(b)) => a == b,
        _ => input == output,
    }
}

// Explicit muxer lets the staging file live next to the source without a media extension.
fn muxer_for_ext(ext: &str) -> Option<&'static str> {
    match ext {
        "mp4" | "m4v" => Some("mp4"),
        "mov" => Some("mov"),
        "mkv" => Some("matroska"),
        "webm" => Some("webm"),
        "avi" => Some("avi"),
        "wmv" => Some("asf"),
        "mpg" | "mpeg" => Some("mpeg"),
        "ts" | "m2ts" => Some("mpegts"),
        _ => None,
    }
}

fn in_place_temp(input: &Path) -> (PathBuf, Option<&'static str>) {
    let parent = input
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let ext = input
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let unique = hash_path_xxh3(&format!("{}:{nanos}", input.display()));
    let muxer = muxer_for_ext(&ext);
    let name = if muxer.is_some() {
        format!("{stem}.vyu-tmp-{unique}")
    } else {
        format!("{stem}.vyu-tmp-{unique}.{ext}")
    };
    (parent.join(name), muxer)
}

// Windows can briefly hold the source open; retry before giving up.
fn replace_with_temp(temp: &Path, target: &Path) -> Result<(), String> {
    let mut last_error = String::new();
    for _ in 0..10 {
        match std::fs::rename(temp, target) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_error = e.to_string();
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }
    }
    Err(format!("Failed to replace original file: {last_error}"))
}

fn backup_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?
        .join("backups"))
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = backup_root(app)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create backups dir: {e}"))?;
    Ok(dir)
}

fn backup_file_name(source: &Path) -> String {
    let hash = hash_path_xxh3(&source.to_string_lossy());
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bak");
    format!("{hash}.{ext}")
}

fn backup_path_for(app: &tauri::AppHandle, source: &Path) -> Result<PathBuf, String> {
    Ok(backup_root(app)?.join(backup_file_name(source)))
}

fn unique_temp(dir: &Path, tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    dir.join(format!(".{tag}-{nanos}"))
}

fn probe_duration_us(path: &str) -> f64 {
    ffprobe_command()
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            path,
        ])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<f64>().ok())
        .map(|secs| secs * 1_000_000.0)
        .unwrap_or(0.0)
}

/// Crop export
#[tauri::command]
pub async fn export_cropped_media(
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
    tauri::async_runtime::spawn_blocking(move || {
        let input = PathBuf::from(&path);
        if !input.exists() {
            return Err("Source file does not exist".into());
        }

        let rot = ((rotation % 360.0) + 360.0) % 360.0;
        let is_quarter_turn = (rot - 90.0).abs() < 1.0 || (rot - 270.0).abs() < 1.0;

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

        let output = ffmpeg_command()
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

        let fallback = ffmpeg_command()
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
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

/// Edit export
#[tauri::command]
pub async fn export_edited_media(
    app: tauri::AppHandle,
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
    tauri::async_runtime::spawn_blocking(move || {
        let input = PathBuf::from(&path);
        if !input.exists() {
            return Err("Source file does not exist".into());
        }

        let mut filters: Vec<String> = Vec::new();

        let rot = ((rotation % 360.0) + 360.0) % 360.0;
        let is_quarter_turn = (rot - 90.0).abs() < 1.0 || (rot - 270.0).abs() < 1.0;

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

        // CSS applies brightness(), contrast(), saturate(), then hue-rotate(),
        // clamping between each. Reproduce that sequence in sRGB.
        let bright = brightness.max(0.0);
        if (bright - 1.0).abs() > 0.01 {
            let expr = format!("clip(val*{bright:.4},0,255)");
            filters.push(format!("lutrgb=r='{expr}':g='{expr}':b='{expr}'"));
        }

        let contrast = contrast.max(0.0);
        if (contrast - 1.0).abs() > 0.01 {
            let expr = format!("clip((val-127.5)*{contrast:.4}+127.5,0,255)");
            filters.push(format!("lutrgb=r='{expr}':g='{expr}':b='{expr}'"));
        }

        let sat = saturation.max(0.0);
        if (sat - 1.0).abs() > 0.01 {
            let s = sat;
            let m = [
                [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
                [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
                [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
            ];
            filters.push(format!(
                "colorchannelmixer=rr={:.6}:rg={:.6}:rb={:.6}:gr={:.6}:gg={:.6}:gb={:.6}:br={:.6}:bg={:.6}:bb={:.6}",
                m[0][0], m[0][1], m[0][2],
                m[1][0], m[1][1], m[1][2],
                m[2][0], m[2][1], m[2][2],
            ));
        }

        if hue.abs() > 0.01 {
            let (sin, cos) = hue.to_radians().sin_cos();
            let m = [
                [
                    0.213 + cos * 0.787 - sin * 0.213,
                    0.715 - cos * 0.715 - sin * 0.715,
                    0.072 - cos * 0.072 + sin * 0.928,
                ],
                [
                    0.213 - cos * 0.213 + sin * 0.143,
                    0.715 + cos * 0.285 + sin * 0.140,
                    0.072 - cos * 0.072 - sin * 0.283,
                ],
                [
                    0.213 - cos * 0.213 - sin * 0.787,
                    0.715 - cos * 0.715 + sin * 0.715,
                    0.072 + cos * 0.928 + sin * 0.072,
                ],
            ];
            filters.push(format!(
                "colorchannelmixer=rr={:.6}:rg={:.6}:rb={:.6}:gr={:.6}:gg={:.6}:gb={:.6}:br={:.6}:bg={:.6}:bb={:.6}",
                m[0][0], m[0][1], m[0][2],
                m[1][0], m[1][1], m[1][2],
                m[2][0], m[2][1], m[2][2],
            ));
        }

        let filter_arg = filters.join(",");
        let output = PathBuf::from(&output_path);
        let in_place = same_file(&input, &output);
        let (write_path, muxer) = if in_place {
            in_place_temp(&input)
        } else {
            (output, None)
        };

        let input_str = input.to_string_lossy().to_string();
        let write_str = write_path.to_string_lossy().to_string();
        let duration_us = probe_duration_us(&input_str);

        let run = |copy_audio: bool| -> Result<(bool, String), String> {
            let mut cmd = ffmpeg_command();
            cmd.args([
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                &input_str,
            ]);
            if filters.is_empty() {
                cmd.args(["-c:v", "copy"]);
            } else {
                cmd.args(["-vf", &filter_arg]);
            }
            if copy_audio {
                cmd.args(["-c:a", "copy"]);
            }
            if let Some(muxer) = muxer {
                cmd.args(["-f", muxer]);
            }
            cmd.args(["-progress", "pipe:1", "-nostats"])
                .arg(&write_str)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = cmd
                .spawn()
                .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

            let stderr = child.stderr.take();
            let stderr_thread = std::thread::spawn(move || {
                let mut buf = String::new();
                if let Some(mut pipe) = stderr {
                    let _ = std::io::Read::read_to_string(&mut pipe, &mut buf);
                }
                buf
            });

            if let Some(stdout) = child.stdout.take() {
                let reader = std::io::BufReader::new(stdout);
                for line in reader.lines().flatten() {
                    if let Some(value) = line.strip_prefix("out_time_us=") {
                        if let Ok(us) = value.trim().parse::<f64>() {
                            if duration_us > 0.0 {
                                let pct =
                                    ((us / duration_us) * 100.0).clamp(0.0, 99.0) as u32;
                                let _ = app.emit("edit-apply-progress", pct);
                            }
                        }
                    }
                }
            }

            let status = child
                .wait()
                .map_err(|e| format!("Failed to wait for ffmpeg: {e}"))?;
            let stderr = stderr_thread.join().ok().unwrap_or_default();
            Ok((status.success(), stderr))
        };

        let (first_ok, _) = run(true)?;

        if !first_ok {
            let _ = app.emit("edit-apply-progress", 0u32);
            let (fallback_ok, stderr) = run(false)?;
            if !fallback_ok {
                let _ = std::fs::remove_file(&write_path);
                return Err(stderr.trim().to_string());
            }
        }

        if in_place {
            if let Err(e) = replace_with_temp(&write_path, &input) {
                let _ = std::fs::remove_file(&write_path);
                return Err(e);
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

/// Backup source
#[tauri::command]
pub async fn backup_file(app: tauri::AppHandle, source: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source_path = canonicalize_path(&source)?;
        let dir = backup_dir(&app)?;
        let backup_path = dir.join(backup_file_name(&source_path));
        if backup_path.exists() {
            return Ok(backup_path.to_string_lossy().to_string());
        }

        let temp = unique_temp(&dir, "vyu-backup");
        std::fs::copy(&source_path, &temp)
            .map_err(|e| format!("Failed to backup file: {e}"))?;
        if let Err(e) = std::fs::rename(&temp, &backup_path) {
            let _ = std::fs::remove_file(&temp);
            return Err(format!("Failed to store backup: {e}"));
        }
        Ok(backup_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[tauri::command]
pub async fn get_backup_path(
    app: tauri::AppHandle,
    source: String,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source_path = canonicalize_path(&source)?;
        let backup_path = backup_path_for(&app, &source_path)?;
        Ok(backup_path
            .exists()
            .then(|| backup_path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[tauri::command]
pub async fn clear_backups(app: tauri::AppHandle) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = backup_root(&app)?;
        if !dir.exists() {
            return Ok(0);
        }

        let entries =
            std::fs::read_dir(&dir).map_err(|e| format!("Failed to read backups: {e}"))?;
        let mut freed = 0u64;
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Ok(meta) = entry.metadata() {
                freed = freed.saturating_add(meta.len());
            }
            let _ = std::fs::remove_file(&path);
        }
        Ok(freed)
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[tauri::command]
pub async fn restore_backup(app: tauri::AppHandle, path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = canonicalize_path(&path)?;
        let backup_path = backup_path_for(&app, &target)?;
        if !backup_path.exists() {
            return Ok(false);
        }

        let parent = target
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        let temp = unique_temp(parent, "vyu-restore");
        std::fs::copy(&backup_path, &temp)
            .map_err(|e| format!("Failed to stage restored file: {e}"))?;
        if let Err(e) = replace_with_temp(&temp, &target) {
            let _ = std::fs::remove_file(&temp);
            return Err(e);
        }
        let _ = std::fs::remove_file(&backup_path);
        Ok(true)
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_file_matches_identical_paths() {
        assert!(same_file(Path::new("clip.mp4"), Path::new("clip.mp4")));
        assert!(!same_file(Path::new("clip.mp4"), Path::new("other.mp4")));
    }

    #[test]
    fn staging_path_avoids_media_extension() {
        let (path, muxer) = in_place_temp(Path::new("clip.mp4"));
        assert_eq!(muxer, Some("mp4"));
        assert!(path.to_string_lossy().contains(".vyu-tmp-"));
        assert_ne!(path.extension().and_then(|e| e.to_str()), Some("mp4"));
    }

    #[test]
    fn unknown_extension_keeps_muxer_guess_from_extension() {
        let (path, muxer) = in_place_temp(Path::new("clip.xyz"));
        assert_eq!(muxer, None);
        assert_eq!(path.extension().and_then(|e| e.to_str()), Some("xyz"));
    }

    #[test]
    fn backup_name_is_stable_and_path_specific() {
        let a = backup_file_name(Path::new("C:\\media\\clip.mp4"));
        let b = backup_file_name(Path::new("C:\\media\\clip.mp4"));
        let c = backup_file_name(Path::new("C:\\media\\other.mp4"));
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert!(a.ends_with(".mp4"));
    }
}
