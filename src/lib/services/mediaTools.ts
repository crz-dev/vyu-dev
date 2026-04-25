import { invoke } from "@tauri-apps/api/core";
import type { MediaProperties, ClipJobResult } from "$lib/types";

export async function invokeGetMediaProperties(
  path: string,
): Promise<MediaProperties> {
  return invoke("get_media_properties", { path });
}

export async function invokeCheckFfprobe(): Promise<boolean> {
  return invoke("check_ffprobe");
}

export async function invokeInstallFfmpeg(): Promise<void> {
  return invoke("install_ffmpeg");
}

export async function invokeProcessVideoClips(
  path: string,
  outputDir: string,
  segments: { start: number; end: number }[],
  mode: "separate" | "merge",
  deleteOriginal: boolean,
): Promise<ClipJobResult> {
  return invoke("process_video_clips", {
    path,
    outputDir,
    segments,
    mode,
    deleteOriginal,
  });
}

export async function invokeDeleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export async function invokeTrashFile(path: string): Promise<void> {
  return invoke("trash_file", { path });
}

export async function invokeShowInExplorer(path: string): Promise<void> {
  return invoke("show_in_explorer", { path });
}

export async function invokeOpenFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}

export async function invokeOpenDirectory(path: string): Promise<void> {
  return invoke("open_directory", { path });
}

export async function invokeRenameFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  return invoke("rename_file", { oldPath, newPath });
}

export async function invokeGetClipboardFilePath(): Promise<string | null> {
  return invoke("get_clipboard_file_path");
}

export async function invokeExportCroppedMedia(
  path: string,
  outputPath: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): Promise<void> {
  return invoke("export_cropped_media", {
    path,
    outputPath,
    left,
    top,
    right,
    bottom,
    width,
    height,
  });
}
