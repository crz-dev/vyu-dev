import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { ALL_EXTS_SET } from "$lib/shared/constants";
import type { SortMode } from "$lib/shared/constants";
import type { BatchStatItem } from "$lib/shared/types";

const FOLDER_CACHE_MAX = 50;
const folderCache = new Map<string, string[]>();
const folderCacheOrder: string[] = [];
const folderPrefixIndex = new Map<string, Set<string>>();

function evictOldestFolder() {
  while (folderCacheOrder.length > FOLDER_CACHE_MAX) {
    const oldest = folderCacheOrder.shift();
    if (oldest) {
      folderCache.delete(oldest);
      for (const [, set] of folderPrefixIndex) {
        set.delete(oldest);
      }
    }
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

  // Modes that need file stats — batch-query via single IPC call
  const items: BatchStatItem[] = await invoke("batch_stat", { paths: list });
  const statMap = new Map<string, BatchStatItem>();
  for (const item of items) {
    statMap.set(item.path, item);
  }

  const entries = list.map((path) => ({
    path,
    stat: statMap.get(path) ?? null,
  }));

  entries.sort((a, b) => {
    let cmp = 0;
    switch (mode) {
      case "date-modified": {
        const aTime = a.stat?.mtime_ms ?? 0;
        const bTime = b.stat?.mtime_ms ?? 0;
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
    .filter((e) => ALL_EXTS_SET.has(getFileExt(e.name ?? "")))
    .map((e) => `${folder}${sep}${e.name}`);
  const sorted = await sortFileList(list, mode, desc);
  folderCache.set(key, sorted);
  folderCacheOrder.push(key);
  if (!folderPrefixIndex.has(folder)) folderPrefixIndex.set(folder, new Set());
  folderPrefixIndex.get(folder)!.add(key);
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
    .filter((e) => ALL_EXTS_SET.has(getFileExt(e.name ?? "")))
    .map((e) => `${folderPath}${sep}${e.name}`);
  return sortFileList(list, mode, desc);
}

export function clearFolderCache(folder?: string): void {
  if (folder) {
    const keys = folderPrefixIndex.get(folder);
    if (keys) {
      for (const key of keys) {
        folderCache.delete(key);
        const idx = folderCacheOrder.indexOf(key);
        if (idx !== -1) folderCacheOrder.splice(idx, 1);
      }
      folderPrefixIndex.delete(folder);
    }
  } else {
    folderCache.clear();
    folderCacheOrder.length = 0;
    folderPrefixIndex.clear();
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
