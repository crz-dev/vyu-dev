use std::fs;
use std::path::{Path, PathBuf};

use crate::util::canonicalize_path;

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = canonicalize_path(&path)?;
    std::fs::remove_file(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let _old = canonicalize_path(&old_path)?;
    let dest = Path::new(&new_path);
    if dest.exists() {
        return Err("Destination already exists".into());
    }
    std::fs::rename(&_old, dest).map_err(|e| format!("Failed to rename file: {e}"))
}

#[tauri::command]
pub fn copy_file(source: String, destination: String) -> Result<(), String> {
    let src = canonicalize_path(&source)?;
    std::fs::copy(&src, &destination)
        .map(|_| ())
        .map_err(|e| format!("Failed to copy file: {e}"))
}

#[tauri::command]
pub fn copy_file_unique(source: String, output_dir: String) -> Result<String, String> {
    use crate::util::unique_path;

    let src = canonicalize_path(&source)?;
    let out_dir = PathBuf::from(&output_dir);
    if !out_dir.exists() {
        fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output folder: {e}"))?;
    }
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let dest_name = if ext.is_empty() {
        stem.clone()
    } else {
        format!("{stem}.{ext}")
    };
    let dest = unique_path(out_dir.join(&dest_name));
    std::fs::copy(&src, &dest)
        .map(|_| dest.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to copy file: {e}"))
}

#[tauri::command]
pub fn trash_file(path: String) -> Result<(), String> {
    let p = canonicalize_path(&path)?;
    trash::delete(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_in_explorer(path: String) -> Result<(), String> {
    let p = canonicalize_path(&path)?;
    let path_str = p.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(p.parent().unwrap_or(&p))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_directory(path: String) -> Result<(), String> {
    let p = canonicalize_path(&path)?;
    let dir = if p.is_dir() {
        p
    } else {
        p.parent().unwrap_or(&p).to_path_buf()
    };
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn cleanup_temp_folder() {
    crate::util::cleanup_vyu_temp();
}

#[tauri::command]
pub fn get_files_total_size(paths: Vec<String>) -> Result<u64, String> {
    let mut total: u64 = 0;
    for p in &paths {
        if let Ok(meta) = fs::metadata(p) {
            total = total.saturating_add(meta.len());
        }
    }
    Ok(total)
}
