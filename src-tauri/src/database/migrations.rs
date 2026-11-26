use rusqlite::Connection;

const SCHEMA_VERSION: i32 = 4;

pub fn run(conn: &mut Connection) -> Result<(), String> {
    // The _migrations table must exist before version check. Creation is outside the migration transaction.
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

        if current < 2 {
            let has_column = {
                let mut stmt = tx
                    .prepare("PRAGMA table_info(file_metadata)")
                    .map_err(|e| format!("Migration v2 inspection failed: {e}"))?;
                let columns = stmt
                    .query_map([], |row| row.get::<_, String>(1))
                    .map_err(|e| format!("Migration v2 inspection failed: {e}"))?;
                let found = columns
                    .filter_map(Result::ok)
                    .any(|column| column == "subtitle_data");
                found
            };
            if !has_column {
                tx.execute_batch("ALTER TABLE file_metadata ADD COLUMN subtitle_data TEXT;")
                    .map_err(|e| format!("Migration v2 failed: {e}"))?;
            }
        }

        if current < 3 {
            let has_column = {
                let mut stmt = tx
                    .prepare("PRAGMA table_info(file_metadata)")
                    .map_err(|e| format!("Migration v3 inspection failed: {e}"))?;
                let columns = stmt
                    .query_map([], |row| row.get::<_, String>(1))
                    .map_err(|e| format!("Migration v3 inspection failed: {e}"))?;
                let found = columns
                    .filter_map(Result::ok)
                    .any(|column| column == "pdf_bookmark");
                found
            };
            if !has_column {
                tx.execute_batch(
                    "ALTER TABLE file_metadata ADD COLUMN pdf_bookmark INTEGER;",
                )
                .map_err(|e| format!("Migration v3 failed: {e}"))?;
            }
        }

        if current < 4 {
            let has_column = {
                let mut stmt = tx
                    .prepare("PRAGMA table_info(file_metadata)")
                    .map_err(|e| format!("Migration v4 inspection failed: {e}"))?;
                let columns = stmt
                    .query_map([], |row| row.get::<_, String>(1))
                    .map_err(|e| format!("Migration v4 inspection failed: {e}"))?;
                let found = columns
                    .filter_map(Result::ok)
                    .any(|column| column == "pdf_bookmarks");
                found
            };
            if !has_column {
                tx.execute_batch(
                    "ALTER TABLE file_metadata ADD COLUMN pdf_bookmarks TEXT;
                     UPDATE file_metadata
                     SET pdf_bookmarks = '[{\"page\":' || pdf_bookmark ||
                         ',\"color\":\"#f5c518\",\"title\":\"\"}]'
                     WHERE pdf_bookmark IS NOT NULL AND pdf_bookmarks IS NULL;",
                )
                .map_err(|e| format!("Migration v4 failed: {e}"))?;
            }
        }

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

#[cfg(test)]
mod tests {
    use super::run;

    #[test]
    fn adds_pdf_metadata_columns() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut conn).unwrap();

        let mut columns = Vec::new();
        {
            let mut stmt = conn.prepare("PRAGMA table_info(file_metadata)").unwrap();
            let rows = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap();
            for column in rows {
                columns.push(column.unwrap());
            }
        }
        assert!(columns.iter().any(|column| column == "subtitle_data"));
        assert!(columns.iter().any(|column| column == "pdf_bookmark"));
        assert!(columns.iter().any(|column| column == "pdf_bookmarks"));

        let version: i32 = conn
            .query_row("SELECT MAX(version) FROM _migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 4);

        // Running again is a no-op.
        run(&mut conn).unwrap();
    }
}
