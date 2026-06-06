import { save } from "@tauri-apps/plugin-dialog";
import { renderMarkupOnImage } from "$lib/features/media/tools";
import { getFileExt, getParentFolder } from "$lib/services/files";
import { markup } from "./markup.svelte";

export interface MarkupActionsDeps {
  getFilePath: () => string;
  getFileName: () => string;
  loadFile: (path: string) => Promise<void>;
  folderWatcher: {
    stopWatching: () => void;
    startWatching: (path: string) => void;
  };
  showFrameCopyToast: (
    message: string,
    tone: "success" | "error" | "info",
  ) => void;
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
      );
      markup.clearAllStrokes();
      await deps.loadFile(deps.getFilePath());
      deps.folderWatcher.startWatching(
        getParentFolder(deps.getFilePath()) || "",
      );
      deps.showFrameCopyToast("Markup applied", "success");
    } catch (err) {
      deps.folderWatcher.startWatching(
        getParentFolder(deps.getFilePath()) || "",
      );
      const message =
        err instanceof Error ? err.message : "Failed to apply markup";
      deps.showFrameCopyToast(message, "error");
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
      await renderMarkupOnImage(deps.getFilePath(), markup.strokes, outputPath);
      deps.showFrameCopyToast("Markup exported", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export markup";
      deps.showFrameCopyToast(message, "error");
    }
  }

  return { handleMarkupApply, handleMarkupExport };
}
