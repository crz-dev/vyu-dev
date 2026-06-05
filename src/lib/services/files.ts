import { readDir, stat } from "@tauri-apps/plugin-fs";
import { ALL_EXTS } from "$lib/shared/constants";
import type { SortMode } from "$lib/shared/constants";

const FOLDER_CACHE_MAX = 50;
const folderCache = new Map<string, string[]>();
const folderCacheOrder: string[] = [];

function evictOldestFolder() {
  while (folderCacheOrder.length > FOLDER_CACHE_MAX) {
    const oldest = folderCacheOrder.shift();
    if (oldest) folderCache.delete(oldest);
  }
}

function detectSep(path: string): string {
  return path.includes("\\") ? "\\" : "/";
}

function cacheKey(folder: string, mode: SortMode, desc: boolean): string {
  return `${folder}\0${mode}\0${desc ? "1" : "0"}`;
}

async function sortFileList(
  list: string[],
  mode: SortMode,
  desc: boolean,
): Promise<string[]> {
  if (mode === "name") {
    const sorted = [...list].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    return desc ? sorted.reverse() : sorted;
  }

  // Modes that need file stats
  const entries = await Promise.all(
    list.map(async (path) => {
      try {
        const s = await stat(path);
        return { path, stat: s };
      } catch {
        return { path, stat: null };
      }
    }),
  );

  entries.sort((a, b) => {
    let cmp = 0;
    switch (mode) {
      case "date-modified": {
        const aTime = getStatTime(a.stat, "mtime");
        const bTime = getStatTime(b.stat, "mtime");
        cmp = aTime - bTime;
        break;
      }
      case "date-created": {
        const aTime = getStatTime(a.stat, "birthtime");
        const bTime = getStatTime(b.stat, "birthtime");
        cmp = aTime - bTime;
        break;
      }
      case "size": {
        const aSize = a.stat?.size ?? 0;
        const bSize = b.stat?.size ?? 0;
        cmp = aSize - bSize;
        break;
      }
      case "type": {
        const aExt = getExt(a.path);
        const bExt = getExt(b.path);
        cmp =
          aExt.localeCompare(bExt) ||
          getFileName(a.path).localeCompare(getFileName(b.path));
        break;
      }
    }
    return cmp;
  });

  const sorted = entries.map((e) => e.path);
  return desc ? sorted.reverse() : sorted;
}

function getStatTime(
  s: {
    size: number;
    birthtime?: unknown;
    mtime?: unknown;
    birthtimeMs?: unknown;
    mtimeMs?: unknown;
    createdAt?: unknown;
    modifiedAt?: unknown;
  } | null,
  kind: "mtime" | "birthtime",
): number {
  if (!s) return 0;
  const raw =
    kind === "mtime"
      ? (s.mtime ?? s.mtimeMs ?? s.modifiedAt)
      : (s.birthtime ?? s.birthtimeMs ?? s.createdAt);
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  // Some platforms return seconds, others milliseconds
  return n < 10_000_000_000 ? n * 1000 : n;
}

function getExt(filePath: string): string {
  const name = getFileName(filePath);
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.substring(lastDot + 1).toLowerCase() : "";
}

export async function readMediaFilesInFolder(
  path: string,
  mode: SortMode = "name",
  desc = false,
): Promise<string[]> {
  const sep = detectSep(path);
  const folder = path.substring(0, path.lastIndexOf(sep));
  const key = cacheKey(folder, mode, desc);
  const cached = folderCache.get(key);
  if (cached) return cached;
  const entries = await readDir(folder);
  const list = entries
    .filter((e) => ALL_EXTS.includes(getFileExt(e.name ?? "")))
    .map((e) => `${folder}${sep}${e.name}`);
  const sorted = await sortFileList(list, mode, desc);
  folderCache.set(key, sorted);
  folderCacheOrder.push(key);
  evictOldestFolder();
  return sorted;
}

/**
 * Re-scan a folder bypassing the cache. Used by the file watcher
 * when filesystem changes are detected.
 */
export async function rescanFolder(
  folderPath: string,
  mode: SortMode = "name",
  desc = false,
): Promise<string[]> {
  clearFolderCache(folderPath);
  const entries = await readDir(folderPath);
  const sep = detectSep(folderPath + "\\");
  const list = entries
    .filter((e) => ALL_EXTS.includes(getFileExt(e.name ?? "")))
    .map((e) => `${folderPath}${sep}${e.name}`);
  return sortFileList(list, mode, desc);
}

export function clearFolderCache(folder?: string): void {
  if (folder) {
    // Clear all cache entries whose key starts with this folder path
    const keysToDelete: string[] = [];
    for (const key of folderCache.keys()) {
      if (key.startsWith(folder)) keysToDelete.push(key);
    }
    for (const key of keysToDelete) {
      folderCache.delete(key);
      const idx = folderCacheOrder.indexOf(key);
      if (idx !== -1) folderCacheOrder.splice(idx, 1);
    }
  } else {
    folderCache.clear();
    folderCacheOrder.length = 0;
  }
}

export function getParentFolder(filePath: string): string {
  const sep = detectSep(filePath);
  return filePath.includes(sep)
    ? filePath.substring(0, filePath.lastIndexOf(sep))
    : "";
}

export function getFileExt(filePath: string): string {
  const name = getFileName(filePath);
  const lastDot = name.lastIndexOf(".");
  return lastDot > 0 ? name.substring(lastDot + 1).toLowerCase() : "";
}

export function getFileName(filePath: string): string {
  const lastSep = Math.max(
    filePath.lastIndexOf("\\"),
    filePath.lastIndexOf("/"),
  );
  return lastSep >= 0 ? filePath.substring(lastSep + 1) : filePath;
}
