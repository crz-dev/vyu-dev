use rusqlite::params;
use tauri::State;

use crate::database::connection::DbConnection;
use crate::database::models::FileMetadata;

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

/// Batch-migrate a set of file metadata entries from localStorage.
/// Runs inside a single transaction for atomicity.
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
