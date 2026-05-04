import { readDir } from "@tauri-apps/plugin-fs";
import { ALL_EXTS } from "$lib/constants";

const FOLDER_CACHE_MAX = 50;
const folderCache = new Map<string, string[]>();
const folderCacheOrder: string[] = [];

function evictOldestFolder() {
  while (folderCacheOrder.length > FOLDER_CACHE_MAX) {
    const oldest = folderCacheOrder.shift();
    if (oldest) folderCache.delete(oldest);
  }
}

export async function readMediaFilesInFolder(path: string): Promise<string[]> {
  const sep = path.includes("\\") ? "\\" : "/";
  const folder = path.substring(0, path.lastIndexOf(sep));
  const cached = folderCache.get(folder);
  if (cached) return cached;
  const entries = await readDir(folder);
  const list = entries
    .filter((e) =>
      ALL_EXTS.includes(e.name?.split(".").pop()?.toLowerCase() ?? ""),
    )
    .map((e) => `${folder}${sep}${e.name}`)
    .sort();
  folderCache.set(folder, list);
  folderCacheOrder.push(folder);
  evictOldestFolder();
  return list;
}

export function clearFolderCache(folder?: string) {
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
  const sep = filePath.includes("\\") ? "\\" : "/";
  return filePath.includes(sep)
    ? filePath.substring(0, filePath.lastIndexOf(sep))
    : "";
}

export function getFileExt(filePath: string): string {
  return filePath.split(".").pop()?.toLowerCase() || "";
}

export function getFileName(filePath: string): string {
  return filePath.split("\\").pop()?.split("/").pop() || filePath;
}
