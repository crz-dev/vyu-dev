import { bytesToBase64 } from "$lib/shared/base64";
import { showToast } from "$lib/components/toast.svelte";
import { editing } from "$lib/features/editing/editing.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";
import { getParentFolder } from "$lib/services/files";
import { invokeRedactPdf, invokeWritePdfAtomic } from "$lib/features/media/api";
import type { PdfStore } from "./pdf.svelte";

export interface PdfActionsDeps {
  getFilePath: () => string;
  getPdf: () => PdfStore;
  loadFile: (path: string, refresh?: boolean) => Promise<void>;
  folderWatcher: {
    stopWatching: () => void;
    startWatching: (path: string) => void;
  };
}

export function createPdfActions(deps: PdfActionsDeps) {
  async function saveForms(): Promise<void> {
    const path = deps.getFilePath();
    if (!path) return;
    const pdf = deps.getPdf();
    let stopped = false;
    try {
      const bytes = await pdf.serializePdfBytes();
      if (!bytes) return;
      deps.folderWatcher.stopWatching();
      stopped = true;
      if (editing.backupMode === "always") {
        await editing.backupOriginal(path, true);
      }
      const data = new Uint8Array(bytes);
      await invokeWritePdfAtomic(path, bytesToBase64(data));
      pdf.markFormsSaved();
      await deps.loadFile(path, true);
      deps.folderWatcher.startWatching(getParentFolder(path) || "");
      showToast({
        message: locale.t("shell.viewer.pdf.formSaved"),
        color: "green",
      });
    } catch (err) {
      if (stopped) {
        deps.folderWatcher.startWatching(getParentFolder(path) || "");
      }
      console.error("Failed to save PDF form changes:", err);
      showToast({
        message: locale.t("shell.viewer.pdf.formSaveFailed"),
        color: "red",
      });
    }
  }

  function discardForms(): void {
    deps.getPdf().discardFormChanges();
  }

  async function applyRedaction(
    clearMetadata: boolean,
    keepBackup: boolean,
  ): Promise<void> {
    const path = deps.getFilePath();
    if (!path) return;
    const pdf = deps.getPdf();
    if (pdf.state.redactions.length === 0) return;
    deps.folderWatcher.stopWatching();
    try {
      const pages = await pdf.renderRedactionPages();
      if (pages.length === 0) return;
      if (keepBackup) {
        await editing.backupOriginal(path, true);
      }
      await invokeRedactPdf({
        filePath: path,
        clearMetadata,
        pages: pages.map((page) => ({
          pageNum: page.pageNum,
          dataBase64: page.dataBase64,
          width: page.width,
          height: page.height,
          widthPt: page.widthPt,
          heightPt: page.heightPt,
        })),
      });
      pdf.cancelRedaction();
      await deps.loadFile(path, true);
      deps.folderWatcher.startWatching(getParentFolder(path) || "");
      showToast({
        message: locale.t("shell.viewer.pdf.redactDone"),
        color: "green",
      });
    } catch (err) {
      console.error("Failed to redact PDF:", err);
      deps.folderWatcher.startWatching(getParentFolder(path) || "");
      showToast({
        message: locale.t("shell.viewer.pdf.redactFailed"),
        color: "red",
      });
    }
  }

  return { saveForms, discardForms, applyRedaction };
}
