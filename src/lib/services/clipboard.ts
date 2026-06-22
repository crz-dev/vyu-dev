import type { MediaProperties } from "$lib/shared/types";
import { invokeCopyImageToClipboard } from "$lib/features/media/tools";

export function showValue(v: string | undefined): string {
  return v && v.trim() ? v : "Unknown";
}

export async function copyImageToClipboard(filePath: string): Promise<void> {
  await invokeCopyImageToClipboard(filePath);
}

export async function copyFrameToClipboard(
  videoEl: HTMLVideoElement,
): Promise<void> {
  if (
    videoEl.readyState < 2 ||
    videoEl.videoWidth <= 0 ||
    videoEl.videoHeight <= 0
  ) {
    throw new Error("Frame not ready yet.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context.");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("Could not encode frame as PNG.");

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Image clipboard API is unavailable in this runtime.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function copyPathToClipboard(filePath: string): Promise<void> {
  await navigator.clipboard.writeText(filePath);
}

export async function copyAllPropertiesToClipboard(
  fileName: string,
  filePath: string,
  isVideo: boolean,
  isPdf: boolean,
  fileExt: string,
  fileDimensions: string,
  fileSize: string,
  fileCreated: string,
  fileModified: string,
  durationDisplay: string,
  parentFolder: string,
  mediaProps: MediaProperties | null,
): Promise<void> {
  const typeLabel = isPdf ? `Document (PDF)` : isVideo ? "Video" : "Image";
  const lines = [
    `Name: ${fileName}`,
    `Type: ${typeLabel} (${fileExt || "unknown"})`,
    `Container: ${showValue(mediaProps?.container)}`,
    `Video codec: ${showValue(mediaProps?.video_codec)}`,
    `Audio codec: ${showValue(mediaProps?.audio_codec)}`,
    `Pixel format: ${showValue(mediaProps?.pixel_format)}`,
    `Color space: ${showValue(mediaProps?.color_space)}`,
    `Color primaries: ${showValue(mediaProps?.color_primaries)}`,
    `Color transfer: ${showValue(mediaProps?.color_transfer)}`,
    `Bit depth: ${showValue(mediaProps?.bit_depth)}`,
    `Frame rate: ${showValue(mediaProps?.frame_rate)}`,
    `Dimensions: ${fileDimensions || "Unknown"}`,
    ...(isVideo ? [`Duration: ${durationDisplay}`] : []),
    `Size: ${fileSize || "Unknown"}`,
    `Created: ${fileCreated || "Unknown"}`,
    `Modified: ${fileModified || "Unknown"}`,
    `Folder: ${parentFolder || "Unknown"}`,
    `Path: ${filePath || "Unknown"}`,
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
}
