export const IMAGE_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "tiff",
  "tif",
  "psd",
  "jxl",
  "heic",
  "heif",
  // RAW camera formats
  "dng",
  "cr2",
  "cr3",
  "nef",
  "nrw",
  "arw",
  "srf",
  "sr2",
  "raf",
  "rw2",
  "orf",
  "pef",
  "3fr",
  "fff",
  "iiq",
  "kdc",
  "mef",
  "mos",
  "x3f",
  "gpr",
];
export const VIDEO_EXTS = [
  "mp4",
  "webm",
  "mkv",
  "avi",
  "mov",
  "wmv",
  "mpeg",
  "mpg",
  "ts",
  "m2ts",
  "m4v",
];
export const AUDIO_EXTS = [
  "mp3",
  "wav",
  "flac",
  "ogg",
  "aac",
  "wma",
  "m4a",
  "opus",
  "aiff",
  "alac",
];
export const DOCUMENT_EXTS = ["pdf"];
export const ALL_EXTS = [
  ...IMAGE_EXTS,
  ...VIDEO_EXTS,
  ...AUDIO_EXTS,
  ...DOCUMENT_EXTS,
];

/** CSS color variables used for vinyl CD visual center labels and progress rings.
 *  Index is persisted per audio file in localStorage (`vyu-cd-color-{path}`). */
export const CD_COLORS = [
  "var(--green)",
  "var(--blue)",
  "var(--yellow)",
  "var(--red)",
  "var(--text-muted)",
  "var(--purple)",
  "var(--cyan)",
  "var(--orange)",
  "var(--pink)",
  "var(--text-primary)",
];

/** Image formats that browsers cannot render natively in &lt;img&gt; tags.
 *  These need to be decoded server-side (Rust image crate / ffmpeg) and served as PNG. */
export const BROWSER_UNSUPPORTED_IMAGE_EXTS = new Set([
  "tiff",
  "tif",
  "psd",
  "jxl",
  "heic",
  "heif",
  // RAW camera formats
  "dng",
  "cr2",
  "cr3",
  "nef",
  "nrw",
  "arw",
  "srf",
  "sr2",
  "raf",
  "rw2",
  "orf",
  "pef",
  "3fr",
  "fff",
  "iiq",
  "kdc",
  "mef",
  "mos",
  "x3f",
  "gpr",
]);

/** Video formats that browsers cannot play natively.
 *  These need to be remuxed server-side (ffmpeg -c copy → MP4) for playback. */
export const REMUX_VIDEO_EXTS = new Set(["ts", "m2ts"]);

export const VOLUME_SEGMENTS = 8;
export const LOOP_MODES = ["loop", "stop", "next", "shuffle"] as const;
export type LoopMode = (typeof LOOP_MODES)[number];

// UI / interaction constants
export const DEFAULT_ZOOM = 100;
export const ZOOM_MIN = 10;
export const ZOOM_MAX = 1000;
export const FULLSCREEN_HIDE_DELAY_MS = 1500;
export const VOLUME_STEP = 1 / VOLUME_SEGMENTS;

// Timing constants (ms)
export const TIMER_DBLCLICK_MS = 300;
export const TIMER_CLIP_TOAST_MS = 4200;
export const TIMER_DRAG_FADE_MS = 600;
export const TIMER_PENDING_PLAY_MS = 150;

// Media / proximity constants
export const MEGABYTE = 1024 * 1024;
export const FRAME_STEP_SEC = 1 / 30;
export const PROXIMITY_DUPLICATE = 0.25;
export const PROXIMITY_TOUCH = 0.6;

// Sort constants
export const SORT_MODES = [
  { value: "name", label: "Name" },
  { value: "date-modified", label: "Date modified" },
  { value: "date-created", label: "Date created" },
  { value: "size", label: "Size" },
  { value: "type", label: "Type" },
] as const;
export type SortMode = (typeof SORT_MODES)[number]["value"];
export const SORT_MODE_DEFAULT: SortMode = "name";
