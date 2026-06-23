// Extension constants
use std::time::Duration;

// Canonical source referenced by frontend shared/constants.ts
#[allow(dead_code)]
pub const IMAGE_EXTS_RUST: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "tiff", "tif", "psd", "jxl", "heic",
    "heif", "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "rw2", "orf", "pef",
    "3fr", "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr", // NOTE: "svg" is intentionally absent — browser-native, never needs server-side processing
];
#[allow(dead_code)]
pub const VIDEO_EXTS_RUST: &[&str] = &[
    "mp4", "webm", "mkv", "avi", "mov", "wmv", "mpeg", "mpg", "ts", "m2ts", "m4v",
];
#[allow(dead_code)]
pub const AUDIO_EXTS_RUST: &[&str] = &[
    "mp3", "wav", "flac", "ogg", "aac", "wma", "m4a", "opus", "aiff", "alac",
];
#[allow(dead_code)]
pub const DOCUMENT_EXTS_RUST: &[&str] = &["pdf"];

/// FFmpeg image formats
pub const FFMPEG_IMAGE_EXTS_RUST: &[&str] = &["gif", "psd", "jxl", "heic", "heif"];
pub const FFMPEG_THUMB_TIMEOUT: Duration = Duration::from_secs(8);

/// Non-native image formats
pub const BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST: &[&str] = &[
    "tiff", "tif", "psd", "jxl", "heic", "heif", "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf",
    "sr2", "raf", "rw2", "orf", "pef", "3fr", "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr",
];

/// RAW camera formats
pub const RAW_IMAGE_EXTS_RUST: &[&str] = &[
    "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "rw2", "orf", "pef", "3fr",
    "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr",
];

/// Remux video formats
pub const REMUX_VIDEO_EXTS_RUST: &[&str] = &["ts", "m2ts"];

/// Re-encode video formats
pub const BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST: &[&str] = &[
    "mkv", "avi", "mov", "wmv", "mpeg", "mpg", "m4v",
];

pub const THUMB_SHORT_SIDE: u32 = 120;
pub const THUMB_JPEG_QUALITY: u8 = 55;

pub const WINDOW_STATE_FILE: &str = "window-state.json";

/// Suppress console windows
#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;
