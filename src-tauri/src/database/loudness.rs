use rusqlite::{params, Connection};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, PartialEq)]
pub struct CachedLoudness {
    pub integrated_lufs: f64,
    pub peak_db: Option<f64>,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

/// Size and modification time used to invalidate a cached measurement.
pub fn file_stamp(path: &str) -> Result<(i64, i64), String> {
    let metadata =
        std::fs::metadata(path).map_err(|e| format!("Cannot access file metadata: {e}"))?;
    let modified = metadata
        .modified()
        .map_err(|e| format!("Cannot read file modification time: {e}"))?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    Ok((metadata.len() as i64, modified))
}

pub fn get(
    conn: &Connection,
    path: &str,
    file_size: i64,
    file_modified: i64,
) -> Result<Option<CachedLoudness>, String> {
    let mut stmt = conn
        .prepare_cached(
            "SELECT integrated_lufs, peak_db
             FROM audio_loudness
             WHERE path = ?1 AND file_size = ?2 AND file_modified = ?3",
        )
        .map_err(|e| format!("Failed to prepare loudness query: {e}"))?;

    let result = stmt.query_row(params![path, file_size, file_modified], |row| {
        Ok(CachedLoudness {
            integrated_lufs: row.get(0)?,
            peak_db: row.get(1)?,
        })
    });

    match result {
        Ok(cached) => Ok(Some(cached)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to read loudness cache: {e}")),
    }
}

pub fn save(
    conn: &Connection,
    path: &str,
    file_size: i64,
    file_modified: i64,
    integrated_lufs: f64,
    peak_db: Option<f64>,
) -> Result<(), String> {
    conn.prepare_cached(
        "INSERT INTO audio_loudness
            (path, file_size, file_modified, integrated_lufs, peak_db, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(path) DO UPDATE SET
            file_size = ?2,
            file_modified = ?3,
            integrated_lufs = ?4,
            peak_db = ?5,
            updated_at = ?6",
    )
    .map_err(|e| format!("Failed to prepare loudness cache write: {e}"))?
    .execute(params![
        path,
        file_size,
        file_modified,
        integrated_lufs,
        peak_db,
        now_secs(),
    ])
    .map_err(|e| format!("Failed to write loudness cache: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{get, save};

    fn connection() -> rusqlite::Connection {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::database::migrations::run(&mut conn).unwrap();
        conn
    }

    #[test]
    fn caches_measurements_until_the_file_changes() {
        let conn = connection();
        save(&conn, "C:\\media\\set.flac", 100, 200, -16.5, Some(-1.2)).unwrap();

        let cached = get(&conn, "C:\\media\\set.flac", 100, 200)
            .unwrap()
            .expect("cached loudness");
        assert_eq!(cached.integrated_lufs, -16.5);
        assert_eq!(cached.peak_db, Some(-1.2));

        assert!(get(&conn, "C:\\media\\set.flac", 101, 200)
            .unwrap()
            .is_none());
        assert!(get(&conn, "C:\\media\\set.flac", 100, 201)
            .unwrap()
            .is_none());
    }
}
