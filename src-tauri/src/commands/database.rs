// Database commands
use rusqlite::params;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

use crate::database::connection::{get_db_path, DbConnection};
use crate::database::models::{FileMetadata, FileMetadataLight, FileMetadataPosition};

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[tauri::command]
pub fn db_get_file_metadata(
    db: State<'_, DbConnection>,
    path: String,
) -> Result<Option<FileMetadata>, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT path, last_position, timestamp_data, clips_data, eq_data,
                    cd_color, last_viewed, updated_at
             FROM file_metadata
             WHERE path = ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let result = stmt.query_row(params![path], |row| {
        Ok(FileMetadata {
            path: row.get(0)?,
            last_position: row.get(1)?,
            timestamp_data: row.get(2)?,
            clips_data: row.get(3)?,
            eq_data: row.get(4)?,
            cd_color: row.get(5)?,
            last_viewed: row.get(6)?,
            updated_at: row.get(7)?,
        })
    });

    match result {
        Ok(meta) => Ok(Some(meta)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to execute query: {e}")),
    }
}

#[tauri::command]
pub fn db_save_file_metadata(
    db: State<'_, DbConnection>,
    path: String,
    last_position: Option<f64>,
    timestamp_data: Option<String>,
    clips_data: Option<String>,
    eq_data: Option<String>,
    cd_color: Option<i32>,
    last_viewed: Option<i64>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let now = now_secs();

    let mut stmt = conn
        .prepare_cached(
            "INSERT INTO file_metadata
                (path, last_position, timestamp_data, clips_data, eq_data,
                 cd_color, last_viewed, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(path) DO UPDATE SET
                last_position = COALESCE(?2, file_metadata.last_position),
                timestamp_data = COALESCE(?3, file_metadata.timestamp_data),
                clips_data = COALESCE(?4, file_metadata.clips_data),
                eq_data = COALESCE(?5, file_metadata.eq_data),
                cd_color = COALESCE(?6, file_metadata.cd_color),
                last_viewed = COALESCE(?7, file_metadata.last_viewed),
                updated_at = ?8",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    stmt.execute(params![
        path,
        last_position,
        timestamp_data,
        clips_data,
        eq_data,
        cd_color,
        last_viewed,
        now,
    ])
    .map_err(|e| format!("Failed to save file metadata: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn db_clear_file_metadata_field(
    db: State<'_, DbConnection>,
    path: String,
    field: String,
) -> Result<(), String> {
    let sql = match field.as_str() {
        "last_position" => "UPDATE file_metadata SET last_position = NULL WHERE path = ?1",
        "timestamp_data" => "UPDATE file_metadata SET timestamp_data = NULL WHERE path = ?1",
        "clips_data" => "UPDATE file_metadata SET clips_data = NULL WHERE path = ?1",
        "eq_data" => "UPDATE file_metadata SET eq_data = NULL WHERE path = ?1",
        "cd_color" => "UPDATE file_metadata SET cd_color = NULL WHERE path = ?1",
        _ => return Err(format!("Unknown field: {field}")),
    };

    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    conn.execute(sql, params![path])
        .map_err(|e| format!("Failed to clear field: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_file_metadata(
    db: State<'_, DbConnection>,
    path: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    conn.execute("DELETE FROM file_metadata WHERE path = ?1", params![path])
        .map_err(|e| format!("Failed to delete file metadata: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn db_get_setting(
    db: State<'_, DbConnection>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let mut stmt = conn
        .prepare_cached("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| format!("Failed to prepare query: {e}"))?;
    let result = stmt.query_row(params![key], |row| row.get(0));
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to execute query: {e}")),
    }
}

#[tauri::command]
pub fn db_set_setting(
    db: State<'_, DbConnection>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let mut stmt = conn
        .prepare_cached(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;
    stmt.execute(params![key, value])
        .map_err(|e| format!("Failed to save setting: {e}"))?;
    Ok(())
}

/// Migrate from localStorage
#[tauri::command]
pub fn db_batch_upsert_file_metadata(
    db: State<'_, DbConnection>,
    entries: Vec<FileMetadataBatchEntry>,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {e}"))?;

    let now = now_secs();

    for entry in &entries {
        tx.execute(
            "INSERT INTO file_metadata
                (path, last_position, timestamp_data, clips_data, eq_data,
                 cd_color, last_viewed, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(path) DO UPDATE SET
                last_position = COALESCE(?2, file_metadata.last_position),
                timestamp_data = COALESCE(?3, file_metadata.timestamp_data),
                clips_data = COALESCE(?4, file_metadata.clips_data),
                eq_data = COALESCE(?5, file_metadata.eq_data),
                cd_color = COALESCE(?6, file_metadata.cd_color),
                last_viewed = COALESCE(?7, file_metadata.last_viewed),
                updated_at = ?8",
            params![
                entry.path,
                entry.last_position,
                entry.timestamp_data,
                entry.clips_data,
                entry.eq_data,
                entry.cd_color,
                entry.last_viewed,
                now,
            ],
        )
        .map_err(|e| format!("Failed to batch upsert: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {e}"))?;
    Ok(())
}

/// Lightweight metadata query — avoids loading eq_data and cd_color blobs
#[tauri::command]
pub fn db_get_file_metadata_light(
    db: State<'_, DbConnection>,
    path: String,
) -> Result<Option<FileMetadataLight>, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT path, last_position, timestamp_data, clips_data, updated_at
             FROM file_metadata
             WHERE path = ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let result = stmt.query_row(params![path], |row| {
        Ok(FileMetadataLight {
            path: row.get(0)?,
            last_position: row.get(1)?,
            timestamp_data: row.get(2)?,
            clips_data: row.get(3)?,
            updated_at: row.get(4)?,
        })
    });

    match result {
        Ok(meta) => Ok(Some(meta)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to execute query: {e}")),
    }
}

/// Only position — for resume playback restore
#[tauri::command]
pub fn db_get_file_metadata_position(
    db: State<'_, DbConnection>,
    path: String,
) -> Result<Option<FileMetadataPosition>, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT path, last_position, updated_at
             FROM file_metadata
             WHERE path = ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let result = stmt.query_row(params![path], |row| {
        Ok(FileMetadataPosition {
            path: row.get(0)?,
            last_position: row.get(1)?,
        })
    });

    match result {
        Ok(meta) => Ok(Some(meta)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to execute query: {e}")),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStats {
    pub path: String,
    pub size_bytes: u64,
    pub wal_bytes: u64,
    pub metadata_rows: u64,
    pub settings_rows: u64,
}

fn database_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let path = get_db_path(app)?;
    let wal = PathBuf::from(format!("{}-wal", path.to_string_lossy()));
    Ok((path, wal))
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

fn read_database_stats(app: &AppHandle) -> Result<DatabaseStats, String> {
    let (path, wal) = database_paths(app)?;
    let db = app.state::<DbConnection>();
    let conn = db
        .0
        .lock()
        .map_err(|e| format!("Failed to lock database: {e}"))?;
    let metadata_rows: u64 = conn
        .query_row("SELECT COUNT(*) FROM file_metadata", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap_or(0) as u64;
    let settings_rows: u64 = conn
        .query_row("SELECT COUNT(*) FROM settings", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap_or(0) as u64;
    Ok(DatabaseStats {
        path: path.to_string_lossy().to_string(),
        size_bytes: file_size(&path),
        wal_bytes: file_size(&wal),
        metadata_rows,
        settings_rows,
    })
}

#[tauri::command]
pub fn get_database_stats(app: AppHandle) -> Result<DatabaseStats, String> {
    read_database_stats(&app)
}

fn marker_clear_sql(mode: &str) -> Result<&'static str, String> {
    match mode {
        "timestamps" => Ok(
            "UPDATE file_metadata SET timestamp_data = NULL, updated_at = ?1 \
             WHERE timestamp_data IS NOT NULL",
        ),
        "clips" => Ok(
            "UPDATE file_metadata SET clips_data = NULL, updated_at = ?1 \
             WHERE clips_data IS NOT NULL",
        ),
        "all" => Ok(
            "UPDATE file_metadata
             SET timestamp_data = NULL, clips_data = NULL, updated_at = ?1
             WHERE timestamp_data IS NOT NULL OR clips_data IS NOT NULL",
        ),
        _ => Err(format!("Unknown marker mode: {mode}")),
    }
}

#[tauri::command]
pub fn clear_all_markers(db: State<'_, DbConnection>, mode: String) -> Result<u64, String> {
    let sql = marker_clear_sql(&mode)?;
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {e}"))?;
    conn.execute(sql, params![now_secs()])
        .map(|count| count as u64)
        .map_err(|e| format!("Failed to clear markers: {e}"))
}

#[tauri::command]
pub async fn factory_reset_database(app: AppHandle) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<DbConnection>();
        let conn = db
            .0
            .lock()
            .map_err(|e| format!("Failed to lock database: {e}"))?;
        let deleted = conn
            .execute("DELETE FROM file_metadata", [])
            .map_err(|e| format!("Failed to clear file metadata: {e}"))? as u64;
        conn.execute("DELETE FROM settings", [])
            .map_err(|e| format!("Failed to clear database settings: {e}"))?;
        let _ = conn.execute_batch("VACUUM; PRAGMA wal_checkpoint(TRUNCATE);");
        Ok(deleted)
    })
    .await
    .map_err(|e| format!("Database reset task failed: {e}"))?
}

#[tauri::command]
pub async fn vacuum_database(app: AppHandle) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (path, wal) = database_paths(&app)?;
        let before = file_size(&path) + file_size(&wal);
        {
            let db = app.state::<DbConnection>();
            let conn = db
                .0
                .lock()
                .map_err(|e| format!("Failed to lock database: {e}"))?;
            conn.execute_batch("VACUUM;")
                .map_err(|e| format!("Failed to compact database: {e}"))?;
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        }
        let after = file_size(&path) + file_size(&wal);
        Ok(before.saturating_sub(after))
    })
    .await
    .map_err(|e| format!("Database compact task failed: {e}"))?
}

#[derive(serde::Deserialize)]
pub struct FileMetadataBatchEntry {
    pub path: String,
    pub last_position: Option<f64>,
    pub timestamp_data: Option<String>,
    pub clips_data: Option<String>,
    pub eq_data: Option<String>,
    pub cd_color: Option<i32>,
    pub last_viewed: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn marker_clear_sql_validates_mode() {
        assert!(marker_clear_sql("timestamps").is_ok());
        assert!(marker_clear_sql("clips").is_ok());
        assert!(marker_clear_sql("all").is_ok());
        assert!(marker_clear_sql("other").is_err());
    }

    #[test]
    fn marker_clear_sql_clears_expected_columns() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE file_metadata (
                path TEXT PRIMARY KEY,
                timestamp_data TEXT,
                clips_data TEXT,
                updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO file_metadata VALUES ('a', '[]', '[]', 0), ('b', NULL, NULL, 0)",
            [],
        )
        .unwrap();

        let changed = conn
            .execute(marker_clear_sql("timestamps").unwrap(), rusqlite::params![1])
            .unwrap();
        assert_eq!(changed, 1);

        let clips: Option<String> = conn
            .query_row(
                "SELECT clips_data FROM file_metadata WHERE path = 'a'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(clips.as_deref(), Some("[]"));

        let changed = conn
            .execute(marker_clear_sql("all").unwrap(), rusqlite::params![2])
            .unwrap();
        assert_eq!(changed, 1);

        let (timestamps, clips): (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT timestamp_data, clips_data FROM file_metadata WHERE path = 'a'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert!(timestamps.is_none());
        assert!(clips.is_none());
    }
}
