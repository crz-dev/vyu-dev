// Properties actions
import {
  copyPathToClipboard,
  copyAllPropertiesToClipboard,
} from "$lib/services/clipboard";
import { invokeOpenDirectory } from "$lib/features/media/api";
import { getFileExt } from "$lib/services/files";
import type { MediaProperties } from "$lib/shared/types";
import { showToast } from "$lib/components/toast";
import { library } from "$lib/features/library/library.svelte";

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
  getFile: () => PropertiesFileSnapshot;
  getParentFolder: (path: string) => string;
}

export function createPropertiesActions(deps: PropertiesActionsDeps) {
  async function propsCopyPath() {
    try {
      await copyPathToClipboard(deps.getFile().filePath);
      showToast({ message: "Copied file path to clipboard", color: "yellow" });
    } catch {
      showToast({ message: "Failed to copy file path", color: "red" });
    }
  }

  async function propsOpenFolder() {
    try {
      await invokeOpenDirectory(deps.getFile().filePath);
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
        library.privacyMode,
      );
      showToast({
        message: "Copied all properties to clipboard",
        color: "yellow",
      });
    } catch {
      showToast({ message: "Failed to copy properties", color: "red" });
    }
  }

  async function copyPropValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ message: "Property copied to clipboard", color: "yellow" });
    } catch {
      showToast({ message: "Failed to copy property", color: "red" });
    }
  }

  return { propsCopyPath, propsOpenFolder, propsCopyAll, copyPropValue };
}
