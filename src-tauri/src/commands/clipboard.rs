// Clipboard operations
use std::fs;
use std::path::Path;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::constants::{CREATE_NO_WINDOW, RAW_IMAGE_EXTS_RUST};
use crate::util::{ffmpeg_command, hash_path_xxh3};

#[tauri::command]
pub async fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
        let is_raw = RAW_IMAGE_EXTS_RUST.contains(&ext.as_str());

        let img = if is_raw {
            let temp_png = std::env::temp_dir().join(format!("vyu_clipboard_{}.png", hash_path_xxh3(&path)));
            ffmpeg_command()
                .args([
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    &path,
                    temp_png.to_str().ok_or("Temp path is not valid UTF-8")?,
                ])
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
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[tauri::command]
pub fn get_clipboard_file_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-Command",
                "Add-Type -Assembly PresentationCore; $files = [System.Windows.Clipboard]::GetFileDropList(); if ($files.Count -gt 0) { $files[0] }",
            ])
            .output()
            .ok()?;
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return None;
        }
        let p = Path::new(&path);
        if !p.has_root() || path.contains('\n') {
            return None;
        }
        Some(path)
    }
    #[cfg(not(target_os = "windows"))]
    None
}
