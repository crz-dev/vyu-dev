import { save } from "@tauri-apps/plugin-dialog";
import {
  invokeShowInExplorer,
  writeBlobToFileAtomic,
  writeFrameBlobToTemp,
} from "$lib/features/media/api";
import {
  copyImageToClipboard,
  copyFrameToClipboard,
  copyPathToClipboard,
} from "$lib/services/clipboard";
import { getFileName, getParentFolder, joinPath } from "$lib/services/files";
import { dismissToast, showToast } from "$lib/components/toast.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";

const DOWNLOAD_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
const OPEN_VIEWER_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>';

function frameFileName(filePath: string, seconds: number): string {
  const name =
    filePath && !filePath.includes("://") ? getFileName(filePath) : "";
  const stem = name.replace(/\.[^.]+$/, "").trim() || "frame";
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${stem} - frame ${minutes}-${secs.toString().padStart(2, "0")}.png`;
}

async function downloadFrame(
  blob: Blob,
  filePath: string,
  seconds: number,
  toastId: number,
) {
  try {
    const isLocal = !!filePath && !filePath.includes("://");
    const defaultName = frameFileName(filePath, seconds);
    const chosen = await save({
      defaultPath: isLocal
        ? joinPath(getParentFolder(filePath), defaultName)
        : defaultName,
      filters: [
        { name: locale.t("editing.filter.image"), extensions: ["png"] },
      ],
    });
    if (!chosen) return;
    const outputPath = chosen.toLowerCase().endsWith(".png")
      ? chosen
      : `${chosen.replace(/\.[^.\\/]+$/, "")}.png`;
    await writeBlobToFileAtomic(outputPath, blob);
    dismissToast(toastId);
    showToast({
      message: locale.t("shell.actions.savedFrame"),
      color: "green",
    });
  } catch (err) {
    console.error("Failed to save current frame:", err);
    const message =
      err instanceof Error
        ? err.message
        : locale.t("shell.actions.saveFrameFailed");
    showToast({ message, color: "red" });
  }
}

async function openFrameInViewer(
  blob: Blob,
  openInViewer: (path: string) => Promise<void>,
  toastId: number,
) {
  try {
    const path = await writeFrameBlobToTemp(blob);
    await openInViewer(path);
    dismissToast(toastId);
  } catch (err) {
    console.error("Failed to open current frame:", err);
    const message =
      err instanceof Error
        ? err.message
        : locale.t("shell.actions.frameOpenFailed");
    showToast({ message, color: "red" });
  }
}

export async function ctxCopyPdfPage(opts: {
  canvas: HTMLCanvasElement | null;
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  const canvas = opts.canvas;
  if (!canvas) {
    showToast({ message: locale.t("shell.actions.noPage"), color: "yellow" });
    return;
  }
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error(locale.t("shell.actions.encodePageFailed"));
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      throw new Error(locale.t("shell.clipboard.imageUnavailable"));
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast({
      message: locale.t("shell.actions.copiedPage"),
      color: "yellow",
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : locale.t("shell.actions.copyPageFailed");
    showToast({ message, color: "red" });
  }
}

export async function ctxCopyImage(opts: {
  filePath: string;
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  try {
    await copyImageToClipboard(opts.filePath);
    showToast({
      message: locale.t("shell.actions.copiedImage"),
      color: "yellow",
    });
  } catch {
    showToast({
      message: locale.t("shell.actions.copyImageFailed"),
      color: "red",
    });
  }
}

export async function ctxCopyFrame(opts: {
  videoEl: HTMLVideoElement | null;
  filePath: string;
  closeContextMenu: () => void;
  openInViewer: (path: string) => Promise<void>;
}) {
  opts.closeContextMenu();
  const videoEl = opts.videoEl;
  if (!videoEl) return;
  try {
    const seconds = videoEl.currentTime;
    const blob = await copyFrameToClipboard(videoEl);
    const toastId = showToast({
      message: locale.t("shell.actions.copiedFrame"),
      color: "yellow",
      duration: 10000,
      actions: [
        {
          tooltip: locale.t("shell.actions.downloadFrame"),
          icon: DOWNLOAD_ICON,
          variant: "accent",
          onClick: () => {
            void downloadFrame(blob, opts.filePath, seconds, toastId);
          },
        },
        {
          tooltip: locale.t("shell.actions.openFrameInViewer"),
          icon: OPEN_VIEWER_ICON,
          variant: "default",
          onClick: () => {
            void openFrameInViewer(blob, opts.openInViewer, toastId);
          },
        },
      ],
    });
  } catch (err) {
    console.error("Failed to copy current frame to clipboard:", err);
    const message =
      err instanceof DOMException && err.name === "SecurityError"
        ? locale.t("shell.actions.frameSecurity")
        : err instanceof Error
          ? err.message
          : locale.t("shell.actions.copyFrameFailed");
    showToast({ message, color: "red" });
  }
}

export async function ctxCopyPath(opts: {
  filePath: string;
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  try {
    await copyPathToClipboard(opts.filePath);
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

export async function ctxShowInExplorer(opts: {
  filePath: string;
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  try {
    await invokeShowInExplorer(opts.filePath);
  } catch (e) {
    console.error("Show in explorer failed:", e);
  }
}

export function ctxRotate(opts: {
  closeContextMenu: () => void;
  pushUndo: () => void;
  rotate: () => void;
}) {
  opts.closeContextMenu();
  opts.pushUndo();
  opts.rotate();
}

export function ctxFlip(opts: {
  closeContextMenu: () => void;
  pushUndo: () => void;
  flip: () => void;
}) {
  opts.closeContextMenu();
  opts.pushUndo();
  opts.flip();
}

export function ctxClearMarkers(opts: {
  closeContextMenu: () => void;
  clearAllTimestamps: () => void;
  clearBoundaries: () => void;
  removeResumePoint: () => void;
}) {
  opts.closeContextMenu();
  opts.clearAllTimestamps();
  opts.clearBoundaries();
  opts.removeResumePoint();
}

export function ctxEdit(opts: { openEditMenu: () => void }) {
  opts.openEditMenu();
}

export function ctxMarkup(opts: { openMarkupMenu: () => void }) {
  opts.openMarkupMenu();
}

export function ctxEffects(opts: { openEffectsMenu: () => void }) {
  opts.openEffectsMenu();
}

export function ctxEqualizer(opts: { openEqualizerMenu: () => void }) {
  opts.openEqualizerMenu();
}

export function ctxProperties(opts: {
  closeContextMenu: () => void;
  setPropertiesOpen: (v: boolean) => void;
  clearMediaProps: () => void;
  isStillOpen: () => boolean;
  ensureFfprobeAndLoad: () => Promise<void>;
}) {
  opts.closeContextMenu();
  opts.setPropertiesOpen(true);
  opts.clearMediaProps();
  void (async () => {
    await opts.ensureFfprobeAndLoad();
    if (!opts.isStillOpen()) return;
  })();
}

export function ctxShare(opts: {
  closeContextMenu: () => void;
  setShareOpen: (v: boolean) => void;
}) {
  opts.closeContextMenu();
  opts.setShareOpen(true);
}

export function ctxSearchPdf(opts: {
  toggleFindBar: () => void;
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  opts.toggleFindBar();
}
