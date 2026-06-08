use std::path::PathBuf;

use crate::util::{canonicalize_path, ffmpeg_command, hash_path_xxh3};

/// Exports the currently visible crop region of an image using ffmpeg.
#[tauri::command]
pub fn export_cropped_media(
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
}

/// Exports an edited image with brightness/contrast/saturation/hue/rotation/flip/crop.
#[tauri::command]
pub fn export_edited_media(
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

    let output = ffmpeg_command()
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

    let fallback = ffmpeg_command()
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

/// Backs up the source file to a temp directory before editing.
#[tauri::command]
pub fn backup_file(source: String) -> Result<String, String> {
    let source_path = canonicalize_path(&source)?;
    let temp_dir = std::env::temp_dir().join("Vyu-temp").join("originals");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bak");
    let hash = hash_path_xxh3(&source);
    let backup_path = temp_dir.join(format!("{}.{}", hash, ext));
    if backup_path.exists() {
        let _ = std::fs::remove_file(&backup_path);
    }
    std::fs::copy(&source_path, &backup_path).map_err(|e| format!("Failed to backup file: {e}"))?;
    Ok(backup_path.to_string_lossy().to_string())
}
