import {
  getFileExt,
  getFileName,
  getParentFolder,
  joinPath,
} from "$lib/services/files";
import { ALL_EXTS_SET, PLAYLIST_EXTS } from "$lib/shared/constants";

export type PlaylistFormat = "m3u" | "pls";

const REMOTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const FILE_SCHEME_RE = /^file:\/\//i;
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

export function isPlaylistPath(path: string): boolean {
  return PLAYLIST_EXTS.includes(getFileExt(path));
}

export function playlistFormatForPath(path: string): PlaylistFormat {
  return getFileExt(path) === "pls" ? "pls" : "m3u";
}

function resolveEntry(raw: string, playlistPath: string): string {
  let entry = raw.trim();
  if (!entry) return "";

  if (FILE_SCHEME_RE.test(entry)) {
    try {
      entry = decodeURIComponent(entry.replace(FILE_SCHEME_RE, ""));
    } catch {
      return "";
    }
    // file:///C:/music/a.flac → C:/music/a.flac
    entry = entry.replace(/^\/([a-zA-Z]:)/, "$1").replace(/\//g, "\\");
  } else if (REMOTE_SCHEME_RE.test(entry)) {
    // The queue only plays local files.
    return "";
  }

  if (WINDOWS_ABSOLUTE_RE.test(entry) || entry.startsWith("\\\\")) {
    return entry;
  }

  const dir = getParentFolder(playlistPath);
  if (!dir) return "";
  return joinPath(dir, entry.replace(/[\\/]+/g, "\\"));
}

function parseM3u(text: string): string[] {
  const entries: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const value = line.replace(/^\uFEFF/, "").trim();
    if (!value || value.startsWith("#")) continue;
    entries.push(value);
  }
  return entries;
}

function parsePls(text: string): string[] {
  const entries: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const value = line.replace(/^\uFEFF/, "").trim();
    const eq = value.indexOf("=");
    if (eq <= 0) continue;
    const key = value.slice(0, eq).trim().toLowerCase();
    if (!/^file\d+$/.test(key)) continue;
    entries.push(value.slice(eq + 1).trim());
  }
  return entries;
}

/** Parse playlist text into supported local media paths, in playlist order. */
export function parsePlaylist(text: string, playlistPath: string): string[] {
  const raw =
    playlistFormatForPath(playlistPath) === "pls"
      ? parsePls(text)
      : parseM3u(text);
  const seen = new Set<string>();
  const tracks: string[] = [];
  for (const entry of raw) {
    const resolved = resolveEntry(entry, playlistPath);
    if (!resolved || !ALL_EXTS_SET.has(getFileExt(resolved))) continue;
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push(resolved);
  }
  return tracks;
}

export function serializePlaylist(
  paths: string[],
  format: PlaylistFormat,
): string {
  if (format === "pls") {
    const lines = ["[playlist]", `NumberOfEntries=${paths.length}`];
    paths.forEach((path, index) => {
      lines.push(
        `File${index + 1}=${path}`,
        `Title${index + 1}=${getFileName(path)}`,
      );
    });
    lines.push("Version=2");
    return `${lines.join("\r\n")}\r\n`;
  }

  return `${["#EXTM3U", ...paths].join("\r\n")}\r\n`;
}
