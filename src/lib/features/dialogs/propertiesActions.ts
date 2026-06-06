import {
  copyPathToClipboard,
  copyAllPropertiesToClipboard,
} from "$lib/services/clipboard";
import { invokeOpenFolder } from "$lib/features/media/tools";
import { getFileExt } from "$lib/services/files";
import type { MediaProperties } from "$lib/shared/types";
import type { ToastTone } from "$lib/features/toast/toast.svelte";

export interface PropertiesFileSnapshot {
  fileName: string;
  filePath: string;
  isVideo: boolean;
  isPdf: boolean;
  fileDimensions: string;
  fileSize: string;
  fileCreated: string;
  fileModified: string;
  durationDisplay: string;
  mediaProps: MediaProperties | null;
}

export interface PropertiesActionsDeps {
  showFrameCopyToast: (message: string, tone: ToastTone) => void;
  getFile: () => PropertiesFileSnapshot;
  getParentFolder: (path: string) => string;
}

export function createPropertiesActions(deps: PropertiesActionsDeps) {
  async function propsCopyPath() {
    try {
      await copyPathToClipboard(deps.getFile().filePath);
      deps.showFrameCopyToast("Copied file path to clipboard", "info");
    } catch {
      deps.showFrameCopyToast("Failed to copy file path", "error");
    }
  }

  async function propsOpenFolder() {
    try {
      await invokeOpenFolder(deps.getFile().filePath);
    } catch {}
  }

  async function propsCopyAll() {
    const f = deps.getFile();
    try {
      await copyAllPropertiesToClipboard(
        f.fileName,
        f.filePath,
        f.isVideo,
        f.isPdf,
        getFileExt(f.filePath),
        f.fileDimensions,
        f.fileSize,
        f.fileCreated,
        f.fileModified,
        f.durationDisplay,
        deps.getParentFolder(f.filePath),
        f.mediaProps,
      );
      deps.showFrameCopyToast("Copied all properties to clipboard", "info");
    } catch {
      deps.showFrameCopyToast("Failed to copy properties", "error");
    }
  }

  async function copyPropValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      deps.showFrameCopyToast("Property copied to clipboard", "info");
    } catch {
      deps.showFrameCopyToast("Failed to copy property", "error");
    }
  }

  return { propsCopyPath, propsOpenFolder, propsCopyAll, copyPropValue };
}
