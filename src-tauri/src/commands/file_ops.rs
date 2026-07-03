// File operations
use std::fs;
use std::path::PathBuf;

use crate::types::BatchStatItem;
use crate::util::canonicalize_path;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

#[tauri::command]
pub async fn batch_stat(paths: Vec<String>) -> Result<Vec<BatchStatItem>, String> {
    const CHUNK_SIZE: usize = 8;
    let handles: Vec<_> = paths
        .chunks(CHUNK_SIZE)
        .map(|chunk| {
            let chunk = chunk.to_vec();
            tauri::async_runtime::spawn_blocking(move || {
                chunk
                    .into_iter()
                    .map(|p| {
                        let meta = fs::metadata(&p).ok();
                        BatchStatItem {
                            path: p,
                            size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
                            mtime_ms: meta
                                .as_ref()
                                .and_then(|m| m.modified().ok())
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_secs_f64() * 1000.0)
                                .unwrap_or(0.0),
                            birthtime_ms: meta
                                .as_ref()
                                .and_then(|m| m.created().ok())
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_secs_f64() * 1000.0)
                                .unwrap_or(0.0),
                        }
                    })
                    .collect::<Vec<_>>()
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;
    let mut items = Vec::with_capacity(paths.len());
    for r in results {
        items.extend(r.map_err(|e| format!("Thread join error: {e}"))?);
    }
    Ok(items)
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = canonicalize_path(&path)?;
    std::fs::remove_file(&p).map_err(|e| format!("Failed to delete file: {e}"))
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old = canonicalize_path(&old_path)?;
    let dest = PathBuf::from(&new_path);
    if dest.exists() {
        return Err("Destination already exists".into());
    }
    match std::fs::rename(&old, &dest) {
        Ok(()) => Ok(()),
        Err(e) if e.raw_os_error() == Some(17) => {
            // Cross-device fallback
            std::fs::copy(&old, &dest)
                .map_err(|ce| format!("Failed to copy across devices: {ce}"))?;
            std::fs::remove_file(&old).map_err(|de| format!("Copied but failed to remove original: {de}"))?;
            Ok(())
        }
        Err(e) => Err(format!("Failed to rename file: {e}")),
    }
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
    trash_file_inner(&p)
}

#[cfg(target_os = "windows")]
fn trash_file_inner(p: &std::path::Path) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::{
        SHFileOperationW, SHFILEOPSTRUCTW, FO_DELETE, FOF_ALLOWUNDO,
    };

    let wide: Vec<u16> = OsStr::new(p.as_os_str())
        .encode_wide()
        .chain(std::iter::once(0))
        .chain(std::iter::once(0))
        .collect();

    let mut op = SHFILEOPSTRUCTW {
        hwnd: HWND::default(),
        wFunc: FO_DELETE,
        pFrom: windows::core::PCWSTR::from_raw(wide.as_ptr()),
        pTo: windows::core::PCWSTR::null(),
        fFlags: FOF_ALLOWUNDO.0 as u16,
        fAnyOperationsAborted: false.into(),
        hNameMappings: std::ptr::null_mut(),
        lpszProgressTitle: windows::core::PCWSTR::null(),
    };

    let result = unsafe { SHFileOperationW(&mut op) };
    if result == 0 {
        Ok(())
    } else {
        Err(format!("Failed to move to trash: error code {result}"))
    }
}

#[cfg(not(target_os = "windows"))]
fn trash_file_inner(_p: &std::path::Path) -> Result<(), String> {
    Err("Trash is not supported on this platform".into())
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
pub async fn get_files_total_size(paths: Vec<String>) -> Result<u64, String> {
    const CHUNK_SIZE: usize = 8;
    let handles: Vec<_> = paths
        .chunks(CHUNK_SIZE)
        .map(|chunk| {
            let chunk = chunk.to_vec();
            tauri::async_runtime::spawn_blocking(move || {
                let mut total: u64 = 0;
                for p in &chunk {
                    if let Ok(meta) = fs::metadata(p) {
                        total = total.saturating_add(meta.len());
                    }
                }
                total
            })
        })
        .collect();

    let results = futures::future::join_all(handles).await;
    let mut total: u64 = 0;
    for r in results {
        total = total.saturating_add(r.map_err(|e| format!("Thread join error: {e}"))?);
    }
    Ok(total)
}
