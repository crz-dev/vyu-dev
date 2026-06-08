use tokio::sync::Semaphore;

use crate::constants;

#[derive(serde::Serialize)]
pub struct MediaProperties {
    pub container: Option<String>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub pixel_format: Option<String>,
    pub color_space: Option<String>,
    pub color_primaries: Option<String>,
    pub color_transfer: Option<String>,
    pub bit_depth: Option<String>,
    pub frame_rate: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
pub struct ClipSegment {
    pub start: f64,
    pub end: f64,
}

#[derive(serde::Serialize)]
pub struct ClipProcessResult {
    pub outputs: Vec<String>,
    pub deleted_original: bool,
    pub output_dir: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SavedWindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[derive(serde::Serialize)]
pub struct FixResult {
    pub success: bool,
    pub output_path: String,
    pub error: String,
}

/// Managed state for the thumbnail system — caps concurrent decode operations.
pub struct ThumbState {
    pub sem: Semaphore,
}

/// Bundles the boolean checks that repeat at the top of most Tauri commands.
/// Construct via `MediaKind::from_ext(ext)`.
#[derive(Clone)]
pub struct MediaKind {
    pub is_image: bool,
    pub is_video: bool,
    pub is_audio: bool,
    pub is_document: bool,
    pub is_ffmpeg_image: bool,
    pub is_raw: bool,
}

impl MediaKind {
    pub fn from_ext(ext: &str) -> Self {
        Self {
            is_image: constants::IMAGE_EXTS_RUST.contains(&ext),
            is_video: constants::VIDEO_EXTS_RUST.contains(&ext),
            is_audio: constants::AUDIO_EXTS_RUST.contains(&ext),
            is_document: constants::DOCUMENT_EXTS_RUST.contains(&ext),
            is_ffmpeg_image: constants::FFMPEG_IMAGE_EXTS_RUST.contains(&ext),
            is_raw: constants::RAW_IMAGE_EXTS_RUST.contains(&ext),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_media_kind_image() {
        let kind = MediaKind::from_ext("jpg");
        assert!(kind.is_image);
        assert!(!kind.is_video);
        assert!(!kind.is_audio);
        assert!(!kind.is_document);
        assert!(!kind.is_ffmpeg_image);
        assert!(!kind.is_raw);
    }

    #[test]
    fn test_media_kind_video() {
        let kind = MediaKind::from_ext("mp4");
        assert!(!kind.is_image);
        assert!(kind.is_video);
        assert!(!kind.is_audio);
        assert!(!kind.is_document);
    }

    #[test]
    fn test_media_kind_audio() {
        let kind = MediaKind::from_ext("mp3");
        assert!(!kind.is_image);
        assert!(!kind.is_video);
        assert!(kind.is_audio);
        assert!(!kind.is_document);
    }

    #[test]
    fn test_media_kind_document() {
        let kind = MediaKind::from_ext("pdf");
        assert!(!kind.is_image);
        assert!(!kind.is_video);
        assert!(!kind.is_audio);
        assert!(kind.is_document);
    }

    #[test]
    fn test_media_kind_ffmpeg_image() {
        let kind = MediaKind::from_ext("psd");
        assert!(kind.is_image);
        assert!(kind.is_ffmpeg_image);
        assert!(!kind.is_raw);
    }

    #[test]
    fn test_media_kind_raw() {
        let kind = MediaKind::from_ext("dng");
        assert!(kind.is_image);
        assert!(!kind.is_ffmpeg_image);
        assert!(kind.is_raw);
    }

    #[test]
    fn test_media_kind_unknown() {
        let kind = MediaKind::from_ext("xyz");
        assert!(!kind.is_image);
        assert!(!kind.is_video);
        assert!(!kind.is_audio);
        assert!(!kind.is_document);
        assert!(!kind.is_ffmpeg_image);
        assert!(!kind.is_raw);
    }

    #[test]
    fn test_media_kind_case_sensitive() {
        let kind = MediaKind::from_ext("JPG");
        assert!(!kind.is_image);
    }
}
