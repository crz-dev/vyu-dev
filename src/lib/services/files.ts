// DATAFLOW: readMediaFilesInFolder (line 15) scans parent dir for sibling media —
// called by media.ts:loadFile (line 172) on initial file open only.
import { readDir } from "@tauri-apps/plugin-fs";
import { ALL_EXTS } from "$lib/shared/constants";

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

export async function readMediaFilesInFolder(path: string): Promise<string[]> {
  const sep = detectSep(path);
  const folder = path.substring(0, path.lastIndexOf(sep));
  const cached = folderCache.get(folder);
  if (cached) return cached;
  const entries = await readDir(folder);
  const list = entries
    .filter((e) => ALL_EXTS.includes(getFileExt(e.name ?? "")))
    .map((e) => `${folder}${sep}${e.name}`)
    .sort();
  folderCache.set(folder, list);
  folderCacheOrder.push(folder);
  evictOldestFolder();
  return list;
}

export function clearFolderCache(folder?: string): void {
  if (folder) {
    folderCache.delete(folder);
    const idx = folderCacheOrder.indexOf(folder);
    if (idx !== -1) folderCacheOrder.splice(idx, 1);
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
  const lastSep = Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/"));
  return lastSep >= 0 ? filePath.substring(lastSep + 1) : filePath;
}
