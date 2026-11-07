import { invokeShowInExplorer } from "$lib/features/media/api";
import {
  copyImageToClipboard,
  copyFrameToClipboard,
  copyPathToClipboard,
} from "$lib/services/clipboard";
import { showToast } from "$lib/components/toast.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";

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
      color: "green",
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
      color: "green",
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
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  if (!opts.videoEl) return;
  try {
    await copyFrameToClipboard(opts.videoEl);
    showToast({
      message: locale.t("shell.actions.copiedFrame"),
      color: "green",
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
      color: "blue",
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
