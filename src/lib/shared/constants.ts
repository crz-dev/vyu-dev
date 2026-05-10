export const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
export const VIDEO_EXTS = ["mp4", "webm", "mkv", "avi", "mov", "wmv"];
export const AUDIO_EXTS = ["mp3", "wav", "flac", "ogg", "aac", "wma", "m4a", "opus"];
export const ALL_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS];
export const VOLUME_SEGMENTS = 8;
export const LOOP_MODES = ["loop", "stop", "next", "shuffle"] as const;
export type LoopMode = (typeof LOOP_MODES)[number];

// UI / interaction constants
export const DEFAULT_ZOOM = 100;
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
