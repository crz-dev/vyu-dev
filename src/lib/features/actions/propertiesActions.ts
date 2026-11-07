import {
  copyPathToClipboard,
  copyAllPropertiesToClipboard,
} from "$lib/services/clipboard";
import { invokeOpenDirectory } from "$lib/features/media/api";
import { getFileExt } from "$lib/services/files";
import type { MediaProperties } from "$lib/shared/types";
import { showToast } from "$lib/components/toast.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";
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
      showToast({
        message: locale.t("shell.actions.copiedPath"),
        color: "yellow",
      });
    } catch {
      showToast({
        message: locale.t("shell.actions.copyPathFailed"),
        color: "red",
      });
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
        message: locale.t("shell.actions.copiedAll"),
        color: "yellow",
      });
    } catch {
      showToast({
        message: locale.t("shell.actions.copyAllFailed"),
        color: "red",
      });
    }
  }

  async function copyPropValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({
        message: locale.t("shell.actions.copiedProperty"),
        color: "yellow",
      });
    } catch {
      showToast({
        message: locale.t("shell.actions.copyPropertyFailed"),
        color: "red",
      });
    }
  }

  return { propsCopyPath, propsOpenFolder, propsCopyAll, copyPropValue };
}
