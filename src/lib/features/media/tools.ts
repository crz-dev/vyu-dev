import { invoke } from "@tauri-apps/api/core";
import type { MediaProperties, ClipJobResult } from "$lib/shared/types";
import { getFileExt } from "$lib/services/files";
import type { EditSnapshot } from "$lib/features/editing/editing.svelte";

export async function exportCroppedImage(
  filePath: string,
  bounds: { left: number; top: number; right: number; bottom: number },
  outputPath: string,
) {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(filePath);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });

  URL.revokeObjectURL(url);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const cropX = Math.round(bounds.left * w);
  const cropY = Math.round(bounds.top * h);
  const cropW = Math.round(w * (1 - bounds.left - bounds.right));
  const cropH = Math.round(h * (1 - bounds.top - bounds.bottom));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cropW);
  canvas.height = Math.max(1, cropH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const ext = getFileExt(outputPath) || "png";
  const mimeType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";

  const outBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType, 0.92);
  });

  const arrayBuffer = await outBlob.arrayBuffer();
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(outputPath, new Uint8Array(arrayBuffer));
}

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
  return invoke("open_directory", { path });
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

export async function invokeCopyFile(
  source: string,
  destination: string,
): Promise<void> {
  return invoke("copy_file", { source, destination });
}

export async function invokeCopyImageToClipboard(path: string): Promise<void> {
  return invoke("copy_image_to_clipboard", { path });
}

export async function invokeCleanupTempFolder(): Promise<void> {
  return invoke("cleanup_temp_folder");
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

export async function invokeConvertMedia(
  path: string,
  outputDir: string,
  format: string,
  preset: string,
): Promise<string> {
  return invoke("convert_media", {
    path,
    outputDir,
    format,
    preset,
  });
}

export async function invokeCompressMedia(
  path: string,
  outputDir: string,
  target: string,
  preset: string,
): Promise<string> {
  return invoke("compress_media", {
    path,
    outputDir,
    target,
    preset,
  });
}

export async function exportEditedImage(
  filePath: string,
  snapshot: EditSnapshot,
  outputPath: string,
) {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(filePath);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });
  URL.revokeObjectURL(url);

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const b = snapshot.cropBounds;
  const cropW = Math.round(w * (1 - b.left - b.right));
  const cropH = Math.round(h * (1 - b.top - b.bottom));
  const cropX = Math.round(b.left * w);
  const cropY = Math.round(b.top * h);

  const isQuarterTurn = Math.abs(snapshot.rotation % 180) === 90;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  if (isQuarterTurn) {
    canvas.width = Math.max(1, cropH);
    canvas.height = Math.max(1, cropW);
  } else {
    canvas.width = Math.max(1, cropW);
    canvas.height = Math.max(1, cropH);
  }

  const filterParts: string[] = [];
  if (snapshot.brightness !== 1)
    filterParts.push(`brightness(${snapshot.brightness})`);
  if (snapshot.contrast !== 1)
    filterParts.push(`contrast(${snapshot.contrast})`);
  if (snapshot.saturation !== 1)
    filterParts.push(`saturate(${snapshot.saturation})`);
  if (snapshot.hue !== 0) filterParts.push(`hue-rotate(${snapshot.hue}deg)`);
  if (filterParts.length > 0) {
    ctx.filter = filterParts.join(" ");
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  if (snapshot.rotation !== 0) {
    ctx.rotate((snapshot.rotation * Math.PI) / 180);
  }

  if (snapshot.flipped || snapshot.flippedVertical) {
    ctx.scale(snapshot.flipped ? -1 : 1, snapshot.flippedVertical ? -1 : 1);
  }

  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropW,
    cropH,
    -cropW / 2,
    -cropH / 2,
    cropW,
    cropH,
  );

  ctx.restore();

  const ext = getFileExt(outputPath) || "png";
  const mimeType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";

  const outBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType, 0.92);
  });

  const arrayBuffer = await outBlob.arrayBuffer();
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(outputPath, new Uint8Array(arrayBuffer));
}

export async function invokeExportEditedMedia(
  path: string,
  outputPath: string,
  snapshot: EditSnapshot,
  width: number,
  height: number,
): Promise<void> {
  return invoke("export_edited_media", {
    path,
    outputPath,
    brightness: snapshot.brightness,
    contrast: snapshot.contrast,
    saturation: snapshot.saturation,
    hue: snapshot.hue,
    rotation: snapshot.rotation,
    flipped: snapshot.flipped,
    flippedVertical: snapshot.flippedVertical,
    cropLeft: snapshot.cropBounds.left,
    cropTop: snapshot.cropBounds.top,
    cropRight: snapshot.cropBounds.right,
    cropBottom: snapshot.cropBounds.bottom,
    width,
    height,
  });
}
