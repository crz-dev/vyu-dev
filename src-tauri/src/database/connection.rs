// DB connection
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Single DB connection
pub struct DbConnection(pub Mutex<Connection>);

pub fn get_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    path.push("vyu.db");
    Ok(path)
}

pub fn init(app: &tauri::AppHandle) -> Result<(), String> {
    let path = get_db_path(app)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create DB directory: {e}"))?;
    }

    let mut conn =
        Connection::open(&path).map_err(|e| format!("Failed to open database: {e}"))?;

    // WAL mode — concurrent reads without blocking writers (critical for UI responsiveness)
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set journal_mode: {e}"))?;

    let journal_mode: String = conn
        .pragma_query_value(None, "journal_mode", |row| row.get(0))
        .unwrap_or_default();
    if journal_mode.to_lowercase() != "wal" {
        eprintln!(
            "SQLite journal_mode is '{journal_mode}', expected 'wal'. \
             The database file may reside on a network drive or \
             a filesystem that does not support WAL."
        );
    }

    // synchronous=NORMAL is safe with WAL
    conn.execute_batch("PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("Failed to set synchronous pragma: {e}"))?;

    // Foreign keys — enforce integrity for future tables
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set foreign_keys pragma: {e}"))?;

    // Busy timeout — wait 5s instead of failing with SQLITE_BUSY
    conn.execute_batch("PRAGMA busy_timeout=5000;")
        .map_err(|e| format!("Failed to set busy_timeout pragma: {e}"))?;

    crate::database::migrations::run(&mut conn)?;

    app.manage(DbConnection(Mutex::new(conn)));
    Ok(())
}
