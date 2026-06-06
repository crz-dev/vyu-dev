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

function createToastStore() {
  const frameCopyToast = $state<FrameToastState>({
    visible: false,
    message: "",
    tone: "success",
  });
  let frameCopyToastTimer: ReturnType<typeof setTimeout> | undefined;
  const imageCopyToast = $state<FrameToastState>({
    visible: false,
    message: "",
    tone: "success",
  });
  let imageCopyToastTimer: ReturnType<typeof setTimeout> | undefined;
  const clipboardToast = $state<ClipboardToastState>({
    visible: false,
    filePath: null,
  });

  function setFrameCopyToast(v: FrameToastState) {
    frameCopyToast.visible = v.visible;
    frameCopyToast.message = v.message;
    frameCopyToast.tone = v.tone;
  }
  function setImageCopyToast(v: FrameToastState) {
    imageCopyToast.visible = v.visible;
    imageCopyToast.message = v.message;
    imageCopyToast.tone = v.tone;
  }
  function setClipboardToast(v: ClipboardToastState) {
    clipboardToast.visible = v.visible;
    clipboardToast.filePath = v.filePath;
  }

  return {
    get frameCopyToast() {
      return frameCopyToast;
    },
    get imageCopyToast() {
      return imageCopyToast;
    },
    get clipboardToast() {
      return clipboardToast;
    },
    setFrameCopyToast,
    setImageCopyToast,
    setClipboardToast,
    getFrameCopyToastTimer: () => frameCopyToastTimer,
    setFrameCopyToastTimer: (v: ReturnType<typeof setTimeout> | undefined) => {
      frameCopyToastTimer = v;
    },
    getImageCopyToastTimer: () => imageCopyToastTimer,
    setImageCopyToastTimer: (v: ReturnType<typeof setTimeout> | undefined) => {
      imageCopyToastTimer = v;
    },
  };
}

export const toastStore = createToastStore();

export function createToastHelpers() {
  function showFrameCopyToast(message: string, tone: ToastTone) {
    clearTimeout(toastStore.getFrameCopyToastTimer());
    toastStore.setFrameCopyToast({ visible: true, message, tone });
    toastStore.setFrameCopyToastTimer(
      setTimeout(() => {
        toastStore.setFrameCopyToast({
          ...toastStore.frameCopyToast,
          visible: false,
        });
      }, 2200),
    );
  }

  function showImageCopyToast(message: string, tone: ToastTone) {
    clearTimeout(toastStore.getImageCopyToastTimer());
    toastStore.setImageCopyToast({ visible: true, message, tone });
    toastStore.setImageCopyToastTimer(
      setTimeout(() => {
        toastStore.setImageCopyToast({
          ...toastStore.imageCopyToast,
          visible: false,
        });
      }, 2200),
    );
  }

  async function saveClipboardFile() {
    const toast = toastStore.clipboardToast;
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
      toastStore.setClipboardToast({ ...toast, visible: false });
      showFrameCopyToast("File saved", "success");
    } catch (err) {
      console.error("Failed to save file:", err);
      showFrameCopyToast("Failed to save file", "error");
    }
  }

  function dismissClipboardToast() {
    toastStore.setClipboardToast({
      ...toastStore.clipboardToast,
      visible: false,
    });
  }

  return {
    showFrameCopyToast,
    showImageCopyToast,
    saveClipboardFile,
    dismissClipboardToast,
  };
}
