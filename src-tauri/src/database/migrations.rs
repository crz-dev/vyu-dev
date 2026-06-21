use rusqlite::Connection;

/// Current schema version. Increment when adding new migrations.
const SCHEMA_VERSION: i32 = 1;

pub fn run(conn: &mut Connection) -> Result<(), String> {
    // The _migrations table must exist before we can check the current version.
    // This table creation is intentionally outside the migration transaction:
    // it is idempotent (IF NOT EXISTS) and we need it to store version tracking.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to create migrations table: {e}"))?;

    let current: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current < SCHEMA_VERSION {
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to begin migration transaction: {e}"))?;

        if current < 1 {
            tx.execute_batch(
                "CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS file_metadata (
                    path TEXT PRIMARY KEY,
                    last_position REAL,
                    timestamp_data TEXT,
                    clips_data TEXT,
                    eq_data TEXT,
                    cd_color INTEGER,
                    last_viewed INTEGER,
                    updated_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_file_metadata_last_viewed
                ON file_metadata(last_viewed);",
            )
            .map_err(|e| format!("Migration v1 failed: {e}"))?;
        }

        // Add future migrations here:
        // if current < 2 { ... }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        tx.execute(
            "INSERT INTO _migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![SCHEMA_VERSION, now],
        )
        .map_err(|e| format!("Failed to record migration: {e}"))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit migration transaction: {e}"))?;
    }

    Ok(())
}
