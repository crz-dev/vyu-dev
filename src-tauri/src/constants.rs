use std::time::Duration;

// Kept as canonical source of truth even though types.rs
// now uses a match — referenced conceptually by frontend
// shared/constants.ts for cross-referencing.
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

/// Image formats that need ffmpeg for decoding/thumbnail generation.
pub const FFMPEG_IMAGE_EXTS_RUST: &[&str] = &["gif", "psd", "jxl", "heic", "heif"];
pub const FFMPEG_THUMB_TIMEOUT: Duration = Duration::from_secs(8);

/// Image formats that browsers (WebView2/Edge) cannot render natively.
/// These must be decoded server-side and served as PNG for display.
pub const BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST: &[&str] = &[
    "tiff", "tif", "psd", "jxl", "heic", "heif", "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf",
    "sr2", "raf", "rw2", "orf", "pef", "3fr", "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr",
];

/// RAW camera formats — decoded via ffmpeg (libraw/libdcraw backend).
pub const RAW_IMAGE_EXTS_RUST: &[&str] = &[
    "dng", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "raf", "rw2", "orf", "pef", "3fr",
    "fff", "iiq", "kdc", "mef", "mos", "x3f", "gpr",
];

/// Video formats that browsers cannot play natively.
/// These must be remuxed server-side (ffmpeg -c copy → MP4) for playback.
pub const REMUX_VIDEO_EXTS_RUST: &[&str] = &["ts", "m2ts"];

/// Video formats that browsers cannot play natively (beyond REMUX_VIDEO_EXTS).
/// These must be re-encoded server-side (ffmpeg → WebM) for browser playback.
pub const BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST: &[&str] = &[
    "mkv", "avi", "mov", "wmv", "mpeg", "mpg", "m4v",
];

/// Short side in pixels for thumbnail resize.
pub const THUMB_SHORT_SIDE: u32 = 120;
/// JPEG quality for thumbnail encoding.
pub const THUMB_JPEG_QUALITY: u8 = 55;

pub const WINDOW_STATE_FILE: &str = "window-state.json";

/// Prevents console windows from appearing when spawning ffmpeg/ffprobe/winget/powershell
/// from a GUI (windows_subsystem = "windows") application.
#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;
