import type { MediaProperties } from "$lib/shared/types";
import {
  invokeCheckFfprobe,
  invokeGetMediaProperties,
  invokeInstallFfmpeg,
} from "$lib/features/media/tools";
import { isBrowserUnsupportedImage, needsRemux } from "$lib/shared/media-kind";

export async function fetchMediaProperties(
  filePath: string,
): Promise<MediaProperties | null> {
  try {
    return await invokeGetMediaProperties(filePath);
  } catch {
    return null;
  }
}

export async function detectFfprobeAvailability(): Promise<boolean> {
  try {
    return await invokeCheckFfprobe();
  } catch {
    return false;
  }
}

export async function installFfmpegWithPolling(options?: {
  attempts?: number;
  delayMs?: number;
}): Promise<{ available: boolean; error: string }> {
  const attempts = options?.attempts ?? 60;
  const delayMs = options?.delayMs ?? 2000;

  try {
    await invokeInstallFfmpeg();
  } catch (e) {
    return {
      available: false,
      error: e instanceof Error ? e.message : "Failed to start FFmpeg install.",
    };
  }

  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (await detectFfprobeAvailability()) {
      return { available: true, error: "" };
    }
  }

  return {
    available: false,
    error: "Install still running. Reopen Properties in a moment.",
  };
}

export async function prepareDisplayPath(path: string): Promise<string> {
  if (isBrowserUnsupportedImage(path)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const displayPath = await invoke<string | null>("prepare_display_image", {
        path,
      });
      return displayPath ?? path;
    } catch (e) {
      console.error("prepare_display_image failed:", e);
      return path;
    }
  }
  if (needsRemux(path)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const displayPath = await invoke<string | null>("prepare_video_display", {
        path,
      });
      return displayPath ?? path;
    } catch (e) {
      console.error("prepare_video_display failed:", e);
      return path;
    }
  }
  return path;
}
