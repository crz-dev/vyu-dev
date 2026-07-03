// DB models
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct FileMetadata {
    pub path: String,
    pub last_position: Option<f64>,
    pub timestamp_data: Option<String>,
    pub clips_data: Option<String>,
    pub eq_data: Option<String>,
    pub cd_color: Option<i32>,
    pub last_viewed: Option<i64>,
    pub updated_at: i64,
}

/// Subset excluding eq_data and cd_color — avoids loading large JSON blobs
#[derive(Debug, Clone, Serialize)]
pub struct FileMetadataLight {
    pub path: String,
    pub last_position: Option<f64>,
    pub timestamp_data: Option<String>,
    pub clips_data: Option<String>,
    pub updated_at: i64,
}

/// Only position — for resume playback restore
#[derive(Debug, Clone, Serialize)]
pub struct FileMetadataPosition {
    pub path: String,
    pub last_position: Option<f64>,
}
