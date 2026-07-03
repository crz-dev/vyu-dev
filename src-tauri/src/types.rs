// Shared Rust types
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore, oneshot};

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

#[derive(serde::Serialize)]
pub struct BatchStatItem {
    pub path: String,
    pub size: u64,
    pub mtime_ms: f64,
    pub birthtime_ms: f64,
}

/// Thumbnail manager state
pub struct ThumbState {
    pub image_sem: Semaphore,
    pub video_sem: Semaphore,
    pub audio_sem: Semaphore,
    pub inflight: InFlightRegistry,
}

impl ThumbState {
    pub fn new() -> Self {
        Self {
            image_sem: Semaphore::new(8),
            video_sem: Semaphore::new(2),
            audio_sem: Semaphore::new(2),
            inflight: InFlightRegistry::new(),
        }
    }

    pub fn sem_for_kind(&self, kind: &MediaKind) -> &Semaphore {
        if kind.is_image && !kind.is_ffmpeg_image && !kind.is_raw {
            &self.image_sem
        } else if kind.is_video || kind.is_ffmpeg_image || kind.is_raw {
            &self.video_sem
        } else {
            &self.audio_sem
        }
    }
}

/// In-flight dedup
pub struct InFlightRegistry {
    map: Mutex<HashMap<String, Vec<oneshot::Sender<Result<Arc<Vec<u8>>, String>>>>>,
}

impl InFlightRegistry {
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }

    /// Register or await in-flight
    pub async fn register(
        &self,
        key: &str,
    ) -> Option<oneshot::Receiver<Result<Arc<Vec<u8>>, String>>> {
        let mut map = self.map.lock().await;
        if let Some(senders) = map.get_mut(key) {
            let (tx, rx) = oneshot::channel();
            senders.push(tx);
            Some(rx)
        } else {
            map.insert(key.to_string(), Vec::new());
            None
        }
    }

    /// Signal waiters
    pub async fn complete(&self, key: &str, result: Result<Vec<u8>, String>) {
        let shared = result.map(Arc::new);
        let mut map = self.map.lock().await;
        if let Some(senders) = map.remove(key) {
            for sender in senders {
                let _ = sender.send(shared.clone());
            }
        }
    }

    /// Remove without signalling (failure path)
    pub async fn cancel(&self, key: &str) {
        self.map.lock().await.remove(key);
    }
}

/// Media kind boolean helpers
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
        let mut kind = Self {
            is_image: false,
            is_video: false,
            is_audio: false,
            is_document: false,
            is_ffmpeg_image: false,
            is_raw: false,
        };

        match ext {
            // Standard images (image crate)
            "jpg" | "jpeg" | "png" | "webp" | "bmp" | "avif" => kind.is_image = true,
            "tiff" | "tif" => kind.is_image = true,

            // FFmpeg images
            "jxl" | "heic" | "heif" => {
                kind.is_image = true;
                kind.is_ffmpeg_image = true;
            }
            "psd" => {
                kind.is_image = true;
                kind.is_ffmpeg_image = true;
            }
            "gif" => {
                kind.is_image = true;
                kind.is_ffmpeg_image = true;
            }

            // RAW camera formats
            "dng" | "cr2" | "cr3" | "nef" | "nrw" | "arw" | "srf" | "sr2" | "raf" | "rw2"
            | "orf" | "pef" | "3fr" | "fff" | "iiq" | "kdc" | "mef" | "mos" | "x3f"
            | "gpr" => {
                kind.is_image = true;
                kind.is_raw = true;
            }

            // Video
            "mp4" | "webm" | "mkv" | "avi" | "mov" | "wmv" | "mpeg" | "mpg" | "ts" | "m2ts"
            | "m4v" => kind.is_video = true,

            // Audio
            "mp3" | "wav" | "flac" | "ogg" | "aac" | "wma" | "m4a" | "opus" | "aiff"
            | "alac" => kind.is_audio = true,

            // Document
            "pdf" => kind.is_document = true,

            _ => {}
        }

        kind
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
