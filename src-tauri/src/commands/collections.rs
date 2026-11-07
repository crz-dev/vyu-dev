use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;

fn collections_base_dir(app: &tauri::AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("collections")
}

fn validate_collection_name(name: &str) -> Result<&str, String> {
    let name = name.trim();
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.ends_with('.')
        || name.chars().any(|c| {
            c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
        })
    {
        return Err("Invalid collection name".into());
    }

    let device_name = name
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end_matches(|c| c == ' ' || c == '.')
        .to_ascii_uppercase();
    if matches!(
        device_name.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    ) {
        return Err("Invalid collection name".into());
    }

    let mut components = Path::new(name).components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err("Invalid collection name".into());
    }

    Ok(name)
}

fn is_strict_descendant(path: &Path, base: &Path) -> bool {
    path != base && path.starts_with(base)
}

fn is_lexically_strict_descendant(path: &Path, base: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(base) else {
        return false;
    };
    let mut components = relative.components();
    matches!(components.next(), Some(Component::Normal(_)))
        && components.all(|component| matches!(component, Component::Normal(_)))
}

fn missing_path_is_within_collections(path: &Path, base: &Path) -> Result<bool, String> {
    if !is_lexically_strict_descendant(path, base) {
        return Ok(false);
    }

    let canonical_base = match fs::canonicalize(base) {
        Ok(path) => Some(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("Failed to resolve collections directory: {error}")),
    };

    let Some(canonical_base) = canonical_base else {
        // The collections directory itself is gone, so there is nothing to delete.
        return Ok(true);
    };

    let mut ancestor = path.parent();
    while let Some(candidate) = ancestor {
        match fs::canonicalize(candidate) {
            Ok(canonical) => {
                return Ok(canonical == canonical_base || canonical.starts_with(&canonical_base));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                ancestor = candidate.parent();
            }
            Err(error) => {
                return Err(format!("Failed to validate collection path: {error}"));
            }
        }
    }

    Ok(false)
}

#[tauri::command]
pub fn create_collection_folder(name: String, app: tauri::AppHandle) -> Result<String, String> {
    let name = validate_collection_name(&name)?;
    let base = collections_base_dir(&app);
    fs::create_dir_all(&base)
        .map_err(|e| format!("Failed to create collections directory: {e}"))?;

    let dir = base.join(name);
    if fs::symlink_metadata(&dir)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("Collection path cannot be a symbolic link".into());
    }
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create collection folder: {e}"))?;

    let canonical_base = fs::canonicalize(&base)
        .map_err(|e| format!("Failed to resolve collections directory: {e}"))?;
    let canonical_dir =
        fs::canonicalize(&dir).map_err(|e| format!("Failed to resolve collection folder: {e}"))?;
    if !is_strict_descendant(&canonical_dir, &canonical_base) {
        return Err("Collection path is not within the collections directory".into());
    }

    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_collection_folder(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let base = collections_base_dir(&app);
    let dir = PathBuf::from(path);
    let metadata = match fs::symlink_metadata(&dir) {
        Ok(metadata) => Some(metadata),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("Failed to inspect collection folder: {error}")),
    };

    let Some(metadata) = metadata else {
        return match missing_path_is_within_collections(&dir, &base) {
            Ok(true) => Ok(()),
            Ok(false) => Err("Collection path is not within the collections directory".into()),
            Err(error) => Err(error),
        };
    };

    if metadata.file_type().is_symlink() {
        return Err("Collection path cannot be a symbolic link".into());
    }
    if !metadata.is_dir() {
        return Err("Collection path is not a directory".into());
    }

    let canonical_base = fs::canonicalize(&base)
        .map_err(|e| format!("Failed to resolve collections directory: {e}"))?;
    let canonical_dir =
        fs::canonicalize(&dir).map_err(|e| format!("Failed to resolve collection folder: {e}"))?;
    if !is_strict_descendant(&canonical_dir, &canonical_base) {
        return Err("Collection path is not within the collections directory".into());
    }

    fs::remove_dir_all(&canonical_dir)
        .map_err(|e| format!("Failed to delete collection folder: {e}"))
}

#[cfg(test)]
mod tests {
    use super::{is_lexically_strict_descendant, is_strict_descendant, validate_collection_name};
    use std::path::Path;

    #[test]
    fn accepts_normal_collection_names() {
        for name in ["Family photos", "2024..trip", "旅行", "party.mix"] {
            assert!(validate_collection_name(name).is_ok(), "{name}");
        }
        assert_eq!(validate_collection_name(" trailing ").unwrap(), "trailing");
    }

    #[test]
    fn rejects_invalid_or_path_like_collection_names() {
        for name in [
            "",
            " ",
            "invalid\u{0085}name",
            ".",
            "..",
            "../outside",
            r"..\outside",
            r"C:\outside",
            "C:outside",
            r"\\server\share",
            "name:stream",
            "CON",
            "nul.txt",
            "trailing.",
        ] {
            assert!(validate_collection_name(name).is_err(), "{name}");
        }
    }

    #[test]
    fn collections_root_is_not_a_strict_descendant() {
        let base = Path::new(r"C:\app\collections");
        assert!(!is_strict_descendant(base, base));
        assert!(is_strict_descendant(&base.join("photos"), base,));
        assert!(!is_strict_descendant(
            Path::new(r"C:\app\collections-old"),
            base,
        ));
    }

    #[test]
    fn missing_paths_require_a_lexical_descendant_without_traversal() {
        let base = Path::new(r"C:\app\collections");
        assert!(is_lexically_strict_descendant(&base.join("photos"), base));
        assert!(!is_lexically_strict_descendant(base, base));
        assert!(!is_lexically_strict_descendant(
            &base.join(r"..\outside"),
            base,
        ));
        assert!(!is_lexically_strict_descendant(
            Path::new(r"C:\app\collections-old\photos"),
            base,
        ));
    }
}
