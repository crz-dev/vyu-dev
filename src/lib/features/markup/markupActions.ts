// Markup actions
import { save } from "@tauri-apps/plugin-dialog";
import {
  renderMarkupOnImage,
  renderMarkupOnCanvas,
  invokeApplyMarkupToPdf,
} from "$lib/features/media/api";
import { getFileExt, getParentFolder } from "$lib/services/files";
import { markup } from "./markup.svelte";
import { showToast } from "$lib/components/toast.svelte";

export interface MarkupActionsDeps {
  getFilePath: () => string;
  getFileName: () => string;
  loadFile: (path: string) => Promise<void>;
  folderWatcher: {
    stopWatching: () => void;
    startWatching: (path: string) => void;
  };
  getPdfPageCanvas?: () => HTMLCanvasElement | null;
}

export function createMarkupActions(deps: MarkupActionsDeps) {
  async function handleMarkupApply() {
    if (markup.strokes.length === 0) return;
    if (markup.currentPage > 0) {
      await applyPdfMarkup();
      return;
    }
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

  async function applyPdfMarkup() {
    const pages = markup.collectAllPageStrokes();
    if (pages.every((p) => p.strokes.length === 0)) return;
    try {
      deps.folderWatcher.stopWatching();
      await invokeApplyMarkupToPdf({
        filePath: deps.getFilePath(),
        pages,
      });
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
    if (markup.currentPage > 0) {
      await exportPdfPageMarkup();
      return;
    }
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

  async function exportPdfPageMarkup() {
    const pageCanvas = deps.getPdfPageCanvas?.();
    if (!pageCanvas) {
      showToast({ message: "No PDF page to export", color: "red" });
      return;
    }
    const outputPath = await save({
      defaultPath:
        deps.getFileName().replace(/\.[^.]+$/, "") +
        `_p${markup.currentPage}.png`,
      filters: [{ name: "Image", extensions: ["png"] }],
    });
    if (!outputPath) return;

    try {
      await renderMarkupOnCanvas(
        pageCanvas,
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
