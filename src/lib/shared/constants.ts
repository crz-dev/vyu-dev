export const IMAGE_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg", // browser-native — not in backend IMAGE_EXTS_RUST (no Rust-side processing needed)
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
export const ALL_EXTS_SET: ReadonlySet<string> = new Set(ALL_EXTS);

/** CSS color variables used for vinyl CD visual center labels and progress rings.
 *  Index is persisted per audio file in localStorage (`vyu-cd-color-{path}`). */
export const CD_COLORS = [
  "var(--red)",
  "var(--orange)",
  "var(--yellow)",
  "var(--green)",
  "var(--cyan)",
  "var(--blue)",
  "var(--purple)",
  "var(--pink)",
  "var(--text-muted)",
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
export const LOOP_MODES = [
  "loop",
  "stop",
  "next",
  "shuffle",
  "shuffle-songs",
] as const;
export type LoopMode = (typeof LOOP_MODES)[number];

export const ZOOM_MIN = 10;
export const VOLUME_STEP = 1 / VOLUME_SEGMENTS;

// Sort constants
export const SORT_MODES = [
  { value: "name", label: "Name" },
  { value: "date-modified", label: "Date modified" },
  { value: "size", label: "Size" },
  { value: "type", label: "Type" },
] as const;
export type SortMode =
  | (typeof SORT_MODES)[number]["value"]
  | "date-opened"
  | "date-created"
  | "date-favorited";
