// Collections
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn collections_base_dir(app: &tauri::AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("collections")
}

fn is_under_collections_dir(path: &str, base: &PathBuf) -> bool {
    if let Ok(canonical) = fs::canonicalize(path) {
        canonical.starts_with(base)
    } else {
        false
    }
}

#[tauri::command]
pub fn create_collection_folder(name: String, app: tauri::AppHandle) -> Result<String, String> {
    let base = collections_base_dir(&app);
    let dir = base.join(&name);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create collection folder: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_collection_folder(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let base = collections_base_dir(&app);
    if !is_under_collections_dir(&path, &base) {
        return Err("Collection path is not within the collections directory".into());
    }
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| format!("Failed to delete collection folder: {e}"))
}
