import {
  invokeShowInExplorer,
  invokeExportCroppedMedia,
  exportCroppedImage,
} from "$lib/features/media/tools";
import {
  copyImageToClipboard,
  copyFrameToClipboard,
  copyPathToClipboard,
} from "$lib/services/clipboard";

export async function ctxCopyImage(opts: {
  filePath: string;
  closeContextMenu: () => void;
  showImageCopyToast: (msg: string, tone: "success" | "error" | "info") => void;
}) {
  opts.closeContextMenu();
  try {
    await copyImageToClipboard(opts.filePath);
    opts.showImageCopyToast("Image copied to clipboard", "success");
  } catch {
    opts.showImageCopyToast("Failed to copy image", "error");
  }
}

export async function ctxCopyFrame(opts: {
  videoEl: HTMLVideoElement | null;
  closeContextMenu: () => void;
  showFrameCopyToast: (msg: string, tone: "success" | "error" | "info") => void;
}) {
  opts.closeContextMenu();
  if (!opts.videoEl) return;
  try {
    await copyFrameToClipboard(opts.videoEl);
    opts.showFrameCopyToast("Current frame copied as PNG", "success");
  } catch (err) {
    console.error("Failed to copy current frame to clipboard:", err);
    const message =
      err instanceof DOMException && err.name === "SecurityError"
        ? "Frame copy blocked by canvas security (cross-origin source)."
        : err instanceof Error
          ? err.message
          : "Could not copy frame to clipboard";
    opts.showFrameCopyToast(message, "error");
  }
}

export async function ctxCopyPath(opts: {
  filePath: string;
  closeContextMenu: () => void;
  showFrameCopyToast: (msg: string, tone: "success" | "error" | "info") => void;
}) {
  opts.closeContextMenu();
  try {
    await copyPathToClipboard(opts.filePath);
    opts.showFrameCopyToast("Copied file path to clipboard", "success");
  } catch {
    opts.showFrameCopyToast("Failed to copy file path", "error");
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

export function ctxToggleLoop(opts: {
  closeContextMenu: () => void;
  cycleLoopMode: () => void;
}) {
  opts.closeContextMenu();
  opts.cycleLoopMode();
}

export function ctxAddTimestamp(opts: {
  closeContextMenu: () => void;
  addTimestamp: () => void;
}) {
  opts.closeContextMenu();
  opts.addTimestamp();
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

export function ctxProperties(opts: {
  closeContextMenu: () => void;
  setPropertiesOpen: (v: boolean) => void;
  clearMediaProps: () => void;
  clearFfmpegError: () => void;
  isStillOpen: () => boolean;
  ensureFfprobeAndLoad: () => Promise<void>;
}) {
  opts.closeContextMenu();
  opts.setPropertiesOpen(true);
  opts.clearMediaProps();
  opts.clearFfmpegError();
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

export async function handleApplyCrop(opts: {
  filePath: string;
  fileName: string;
  isVideo: boolean;
  fileExt: () => string;
  videoEl: HTMLVideoElement | null;
  rotation: number;
  viewer: {
    getCropBounds: () => {
      left: number;
      top: number;
      right: number;
      bottom: number;
    } | null;
    applyCrop: () => void;
  };
  showFrameCopyToast: (msg: string, tone: "success" | "error" | "info") => void;
  setExportToast: (v: {
    visible: boolean;
    phase: string;
    message: string;
    outputPath: string;
  }) => void;
}) {
  const bounds = opts.viewer.getCropBounds();
  if (
    !bounds ||
    (bounds.left === 0 &&
      bounds.top === 0 &&
      bounds.right === 0 &&
      bounds.bottom === 0)
  ) {
    opts.showFrameCopyToast("No crop applied", "error");
    return;
  }

  const ext = opts.fileExt();
  const defaultName = opts.fileName.replace(/\.[^.]+$/, "") + "_cropped." + ext;

  const { save } = await import("@tauri-apps/plugin-dialog");
  const outputPath = await save({
    defaultPath: defaultName,
    filters: opts.isVideo
      ? [{ name: "Video", extensions: [ext] }]
      : [{ name: "Image", extensions: [ext] }],
  });

  if (!outputPath) return;

  opts.viewer.applyCrop();
  opts.setExportToast({
    visible: true,
    phase: "exporting",
    message: "Exporting...",
    outputPath,
  });

  try {
    if (opts.isVideo) {
      const ve = opts.videoEl;
      if (!ve || ve.videoWidth <= 0 || ve.videoHeight <= 0) {
        throw new Error("Video not ready for export");
      }
      await invokeExportCroppedMedia(
        opts.filePath,
        outputPath,
        bounds.left,
        bounds.top,
        bounds.right,
        bounds.bottom,
        ve.videoWidth,
        ve.videoHeight,
        opts.rotation,
      );
    } else {
      await exportCroppedImage(opts.filePath, bounds, outputPath);
    }
    opts.setExportToast({
      visible: true,
      phase: "done",
      message: "Exported!",
      outputPath,
    });
  } catch (err) {
    console.error("Export failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to export file";
    opts.setExportToast({ visible: true, phase: "error", message, outputPath });
  }
}
