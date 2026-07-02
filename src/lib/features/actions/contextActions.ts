// Context menu actions
import { invokeShowInExplorer } from "$lib/features/media/tools";
import {
  copyImageToClipboard,
  copyFrameToClipboard,
  copyPathToClipboard,
} from "$lib/services/clipboard";
import { showToast } from "$lib/features/toast/toast.svelte";

export async function ctxCopyImage(opts: {
  filePath: string;
  closeContextMenu: () => void;
}) {
  opts.closeContextMenu();
  try {
    await copyImageToClipboard(opts.filePath);
    showToast({ message: "Image copied to clipboard", color: "green" });
  } catch {
    showToast({ message: "Failed to copy image", color: "red" });
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
    showToast({ message: "Current frame copied as PNG", color: "green" });
  } catch (err) {
    console.error("Failed to copy current frame to clipboard:", err);
    const message =
      err instanceof DOMException && err.name === "SecurityError"
        ? "Frame copy blocked by canvas security (cross-origin source)."
        : err instanceof Error
          ? err.message
          : "Could not copy frame to clipboard";
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
    showToast({ message: "Copied file path to clipboard", color: "blue" });
  } catch {
    showToast({ message: "Failed to copy file path", color: "red" });
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
