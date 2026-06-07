import type { MediaProperties } from "$lib/shared/types";
import {
  ctxCopyImage,
  ctxCopyFrame,
  ctxCopyPath,
  ctxShowInExplorer,
  ctxRotate,
  ctxFlip,
  ctxClearMarkers,
  ctxEdit,
  ctxMarkup,
  ctxProperties,
  ctxShare,
} from "./contextActions";
import {
  refreshFfprobeAvailability,
  loadMediaProperties,
} from "$lib/features/media/ffmpeg";

export interface ContextActionDeps {
  filePath: () => string;
  videoEl: () => HTMLVideoElement | null;
  closeContextMenu: () => void;
  toast: {
    showImageCopyToast: (
      msg: string,
      tone: "success" | "error" | "info",
    ) => void;
    showFrameCopyToast: (
      msg: string,
      tone: "success" | "error" | "info",
    ) => void;
  };
  editing: { pushUndo: () => void };
  viewer: { rotate: () => void; flip: () => void };
  clips: { clearBoundaries: () => void };
  clearAllTimestamps: () => void;
  removeResumePoint: () => void;
  openEditMenu: () => void;
  openMarkupMenu: () => void;
  propertiesOpen: () => boolean;
  setPropertiesOpen: (v: boolean) => void;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
  clearFfmpegError: () => void;
  ffprobeAvailable: () => boolean;
  setFfprobeChecked: (v: boolean) => void;
  setFfprobeAvailable: (v: boolean) => void;
  setShareOpen: (v: boolean) => void;
  deleteActions: { ctxDelete: (close: () => void) => void };
}

export function createContextActionFns(deps: ContextActionDeps) {
  async function ctxCopyImageFn() {
    await ctxCopyImage({
      filePath: deps.filePath(),
      closeContextMenu: deps.closeContextMenu,
      showImageCopyToast: deps.toast.showImageCopyToast,
    });
  }
  async function ctxCopyFrameFn() {
    await ctxCopyFrame({
      videoEl: deps.videoEl(),
      closeContextMenu: deps.closeContextMenu,
      showFrameCopyToast: deps.toast.showFrameCopyToast,
    });
  }
  async function ctxCopyPathFn() {
    await ctxCopyPath({
      filePath: deps.filePath(),
      closeContextMenu: deps.closeContextMenu,
      showFrameCopyToast: deps.toast.showFrameCopyToast,
    });
  }
  async function ctxShowInExplorerFn() {
    await ctxShowInExplorer({
      filePath: deps.filePath(),
      closeContextMenu: deps.closeContextMenu,
    });
  }
  function ctxRotateFn() {
    ctxRotate({
      closeContextMenu: deps.closeContextMenu,
      pushUndo: () => deps.editing.pushUndo(),
      rotate: () => deps.viewer.rotate(),
    });
  }
  function ctxFlipFn() {
    ctxFlip({
      closeContextMenu: deps.closeContextMenu,
      pushUndo: () => deps.editing.pushUndo(),
      flip: () => deps.viewer.flip(),
    });
  }
  function ctxClearMarkersFn() {
    ctxClearMarkers({
      closeContextMenu: deps.closeContextMenu,
      clearAllTimestamps: deps.clearAllTimestamps,
      clearBoundaries: () => deps.clips.clearBoundaries(),
      removeResumePoint: deps.removeResumePoint,
    });
  }
  function ctxEditFn() {
    ctxEdit({ openEditMenu: deps.openEditMenu });
  }
  function ctxMarkupFn() {
    ctxMarkup({ openMarkupMenu: deps.openMarkupMenu });
  }
  function ctxPropertiesFn() {
    ctxProperties({
      closeContextMenu: deps.closeContextMenu,
      setPropertiesOpen: deps.setPropertiesOpen,
      clearMediaProps: () => deps.setMediaProps(null),
      clearFfmpegError: deps.clearFfmpegError,
      isStillOpen: deps.propertiesOpen,
      ensureFfprobeAndLoad: async () => {
        await refreshFfprobeAvailability({
          setFfprobeChecked: deps.setFfprobeChecked,
          setFfprobeAvailable: deps.setFfprobeAvailable,
        });
        if (deps.ffprobeAvailable()) {
          await loadMediaProperties({
            filePath: deps.filePath(),
            setMediaProps: deps.setMediaProps,
            setMediaPropsLoading: deps.setMediaPropsLoading,
          });
        }
      },
    });
  }
  function ctxShareFn() {
    ctxShare({
      closeContextMenu: deps.closeContextMenu,
      setShareOpen: deps.setShareOpen,
    });
  }
  const ctxDelete = () => deps.deleteActions.ctxDelete(deps.closeContextMenu);

  return {
    ctxCopyImageFn,
    ctxCopyFrameFn,
    ctxCopyPathFn,
    ctxShowInExplorerFn,
    ctxRotateFn,
    ctxFlipFn,
    ctxClearMarkersFn,
    ctxEditFn,
    ctxMarkupFn,
    ctxPropertiesFn,
    ctxShareFn,
    ctxDelete,
  };
}
