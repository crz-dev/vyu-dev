import { save } from "@tauri-apps/plugin-dialog";
import { invokeCopyFile } from "$lib/features/media/tools";
import { getFileExt } from "$lib/services/files";

export type ToastTone = "success" | "error" | "info";

export interface FrameToastState {
  visible: boolean;
  message: string;
  tone: ToastTone;
}

export interface ClipboardToastState {
  visible: boolean;
  filePath: string | null;
}

export function createToastHelpers(opts: {
  getFrameCopyToast: () => FrameToastState;
  setFrameCopyToast: (v: FrameToastState) => void;
  getFrameCopyToastTimer: () => ReturnType<typeof setTimeout> | undefined;
  setFrameCopyToastTimer: (
    v: ReturnType<typeof setTimeout> | undefined,
  ) => void;
  getImageCopyToast: () => FrameToastState;
  setImageCopyToast: (v: FrameToastState) => void;
  getImageCopyToastTimer: () => ReturnType<typeof setTimeout> | undefined;
  setImageCopyToastTimer: (
    v: ReturnType<typeof setTimeout> | undefined,
  ) => void;
  getClipboardToast: () => ClipboardToastState;
  setClipboardToast: (v: ClipboardToastState) => void;
}) {
  function showFrameCopyToast(message: string, tone: ToastTone) {
    clearTimeout(opts.getFrameCopyToastTimer());
    opts.setFrameCopyToast({ visible: true, message, tone });
    opts.setFrameCopyToastTimer(
      setTimeout(() => {
        opts.setFrameCopyToast({ ...opts.getFrameCopyToast(), visible: false });
      }, 2200),
    );
  }

  function showImageCopyToast(message: string, tone: ToastTone) {
    clearTimeout(opts.getImageCopyToastTimer());
    opts.setImageCopyToast({ visible: true, message, tone });
    opts.setImageCopyToastTimer(
      setTimeout(() => {
        opts.setImageCopyToast({ ...opts.getImageCopyToast(), visible: false });
      }, 2200),
    );
  }

  async function saveClipboardFile() {
    const toast = opts.getClipboardToast();
    if (!toast.filePath) return;
    const ext = getFileExt(toast.filePath) || "png";
    const defaultName = `vyu-export-${Date.now()}.${ext}`;
    const outputPath = await save({
      defaultPath: defaultName,
      filters: [{ name: "Media", extensions: [ext] }],
    });
    if (!outputPath) return;
    try {
      await invokeCopyFile(toast.filePath, outputPath);
      opts.setClipboardToast({ ...toast, visible: false });
      showFrameCopyToast("File saved", "success");
    } catch (err) {
      console.error("Failed to save file:", err);
      showFrameCopyToast("Failed to save file", "error");
    }
  }

  function dismissClipboardToast() {
    const toast = opts.getClipboardToast();
    opts.setClipboardToast({ ...toast, visible: false });
  }

  return {
    showFrameCopyToast,
    showImageCopyToast,
    saveClipboardFile,
    dismissClipboardToast,
  };
}
