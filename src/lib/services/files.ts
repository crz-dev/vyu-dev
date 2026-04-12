import { readDir } from "@tauri-apps/plugin-fs";
import { ALL_EXTS } from "$lib/constants";

export async function readMediaFilesInFolder(path: string): Promise<string[]> {
  const sep = path.includes("\\") ? "\\" : "/";
  const folder = path.substring(0, path.lastIndexOf(sep));
  const entries = await readDir(folder);
  return entries
    .filter((e) =>
      ALL_EXTS.includes(e.name?.split(".").pop()?.toLowerCase() ?? ""),
    )
    .map((e) => `${folder}${sep}${e.name}`)
    .sort();
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
