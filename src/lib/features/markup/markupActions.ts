// Markup actions
import { save } from "@tauri-apps/plugin-dialog";
import { renderMarkupOnImage } from "$lib/features/media/api";
import { getFileExt, getParentFolder } from "$lib/services/files";
import { markup } from "./markup.svelte";
import { showToast } from "$lib/components/toast";

export interface MarkupActionsDeps {
  getFilePath: () => string;
  getFileName: () => string;
  loadFile: (path: string) => Promise<void>;
  folderWatcher: {
    stopWatching: () => void;
    startWatching: (path: string) => void;
  };
}

export function createMarkupActions(deps: MarkupActionsDeps) {
  async function handleMarkupApply() {
    if (markup.strokes.length === 0) return;
    try {
      deps.folderWatcher.stopWatching();
      await renderMarkupOnImage(
        deps.getFilePath(),
        markup.strokes,
        deps.getFilePath(),
        markup.displayWidth,
        markup.displayHeight,
      );
      markup.clearAllStrokes();
      await deps.loadFile(deps.getFilePath());
      deps.folderWatcher.startWatching(
        getParentFolder(deps.getFilePath()) || "",
      );
      showToast({ message: "Markup applied", color: "green" });
    } catch (err) {
      deps.folderWatcher.startWatching(
        getParentFolder(deps.getFilePath()) || "",
      );
      const message =
        err instanceof Error ? err.message : "Failed to apply markup";
      showToast({ message, color: "red" });
    }
  }

  async function handleMarkupExport() {
    if (markup.strokes.length === 0) return;
    try {
      const ext = getFileExt(deps.getFilePath()) || "png";
      const defaultName =
        deps.getFileName().replace(/\.[^.]+$/, "") + "_marked." + ext;
      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Image", extensions: [ext] }],
      });
      if (!outputPath) return;
      await renderMarkupOnImage(
        deps.getFilePath(),
        markup.strokes,
        outputPath,
        markup.displayWidth,
        markup.displayHeight,
      );
      showToast({ message: "Markup exported", color: "green" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export markup";
      showToast({ message, color: "red" });
    }
  }

  return { handleMarkupApply, handleMarkupExport };
}
