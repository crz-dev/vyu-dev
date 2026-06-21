use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Managed state: single connection behind a mutex.
///
/// A single Mutex<Connection> is sufficient for the current workload:
/// - All database operations are fast point lookups by primary key.
/// - Peak throughput is low (< 10 ops/sec).
/// - Contention has not been measurable.
/// - A connection pool (r2d2, deadpool) would add complexity without benefit.
///
/// Revisit if adding concurrent background indexers or bulk metadata operations.
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

    // ── Journal mode ──────────────────────────────────────────────────
    // WAL mode allows concurrent reads without blocking writers.
    // Critical for responsive UI when background operations (thumbnails,
    // folder indexing) run alongside user-initiated reads.
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

    // ── Synchronous mode ──────────────────────────────────────────────
    // synchronous=NORMAL is safe with WAL: a crash loses at most the
    // last incomplete transaction. Faster than FULL (the default for
    // DELETE journal) with no practical data-loss risk.
    conn.execute_batch("PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("Failed to set synchronous pragma: {e}"))?;

    // ── Foreign keys ──────────────────────────────────────────────────
    // Enforce referential integrity for future collection/tag/history tables.
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set foreign_keys pragma: {e}"))?;

    // ── Busy timeout ──────────────────────────────────────────────────
    // If another process (or a future connection pool) holds the lock,
    // wait up to 5 seconds instead of failing immediately with SQLITE_BUSY.
    conn.execute_batch("PRAGMA busy_timeout=5000;")
        .map_err(|e| format!("Failed to set busy_timeout pragma: {e}"))?;

    crate::database::migrations::run(&mut conn)?;

    app.manage(DbConnection(Mutex::new(conn)));
    Ok(())
}
