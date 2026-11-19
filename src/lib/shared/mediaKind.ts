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

// ── Remote media URLs ──

// Sites that require extraction (yt-dlp style) rather than a direct media link.
// Kept here so the paste handler can reject them before any request is made.
const REMOTE_SITE_HOSTS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "dailymotion.com",
  "twitch.tv",
  "netflix.com",
  "hulu.com",
  "disneyplus.com",
  "primevideo.com",
  "crunchyroll.com",
  "spotify.com",
  "soundcloud.com",
  "music.apple.com",
  "facebook.com",
  "fb.watch",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "rumble.com",
  "bilibili.com",
  "nicovideo.jp",
];

export type MediaUrlClassification =
  | { kind: "video"; hls: boolean; name: string }
  | { kind: "audio"; hls: false; name: string }
  | { kind: "site" }
  | { kind: "unsupported" };

export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function parseRemoteUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isKnownSite(host: string): boolean {
  const hostname = host.toLowerCase();
  return REMOTE_SITE_HOSTS.some(
    (site) => hostname === site || hostname.endsWith(`.${site}`),
  );
}

export function remoteDisplayName(raw: string): string {
  const url = parseRemoteUrl(raw);
  if (!url) return raw.trim();
  const segment = url.pathname.split("/").filter(Boolean).pop();
  if (!segment) return url.hostname;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function classifyMediaUrl(raw: string): MediaUrlClassification {
  const url = parseRemoteUrl(raw);
  if (!url) return { kind: "unsupported" };

  const segment = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const lastDot = segment.lastIndexOf(".");
  const ext = lastDot > 0 ? segment.substring(lastDot + 1).toLowerCase() : "";

  if (ext === "m3u8") {
    return { kind: "video", hls: true, name: remoteDisplayName(raw) };
  }
  if (VIDEO_EXTS.includes(ext)) {
    return { kind: "video", hls: false, name: remoteDisplayName(raw) };
  }
  if (AUDIO_EXTS.includes(ext)) {
    return { kind: "audio", hls: false, name: remoteDisplayName(raw) };
  }
  if (isKnownSite(url.hostname)) return { kind: "site" };
  return { kind: "unsupported" };
}

export function isHlsUrl(value: string): boolean {
  const url = parseRemoteUrl(value);
  return url?.pathname.toLowerCase().endsWith(".m3u8") ?? false;
}
