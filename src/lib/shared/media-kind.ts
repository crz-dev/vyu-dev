// Media kind detection
import { getFileExt } from "$lib/services/files";
import {
  VIDEO_EXTS,
  AUDIO_EXTS,
  DOCUMENT_EXTS,
  BROWSER_UNSUPPORTED_IMAGE_EXTS,
  REMUX_VIDEO_EXTS,
} from "$lib/shared/constants";

export function isVideo(path: string): boolean {
  return VIDEO_EXTS.includes(getFileExt(path));
}

export function isAudio(path: string): boolean {
  return AUDIO_EXTS.includes(getFileExt(path));
}

export function isPdf(path: string): boolean {
  return DOCUMENT_EXTS.includes(getFileExt(path));
}

export function isTimedMedia(path: string): boolean {
  return isVideo(path) || isAudio(path);
}

export function isBrowserUnsupportedImage(path: string): boolean {
  return BROWSER_UNSUPPORTED_IMAGE_EXTS.has(getFileExt(path));
}

export function needsRemux(path: string): boolean {
  return REMUX_VIDEO_EXTS.has(getFileExt(path));
}
