// Context action wrappers
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
  ctxEffects,
  ctxEqualizer,
  ctxProperties,
  ctxShare,
} from "./contextActions";
import { loadMediaProperties } from "$lib/features/media/ffmpeg";

export interface ContextActionDeps {
  filePath: () => string;
  videoEl: () => HTMLVideoElement | null;
  closeContextMenu: () => void;
  editing: { pushUndo: () => void };
  viewer: { rotate: () => void; flip: () => void };
  clips: { clearBoundaries: () => void };
  clearAllTimestamps: () => void;
  removeResumePoint: () => void;
  openEditMenu: () => void;
  openMarkupMenu: () => void;
  openEffectsMenu: () => void;
  openEqualizerMenu: () => void;
  propertiesOpen: () => boolean;
  setPropertiesOpen: (v: boolean) => void;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
  setShareOpen: (v: boolean) => void;
  deleteActions: { ctxDelete: (close: () => void) => void };
}

export function createContextActionFns(deps: ContextActionDeps) {
  async function ctxCopyImageFn() {
    await ctxCopyImage({
      filePath: deps.filePath(),
      closeContextMenu: deps.closeContextMenu,
    });
  }
  async function ctxCopyFrameFn() {
    await ctxCopyFrame({
      videoEl: deps.videoEl(),
      closeContextMenu: deps.closeContextMenu,
    });
  }
  async function ctxCopyPathFn() {
    await ctxCopyPath({
      filePath: deps.filePath(),
      closeContextMenu: deps.closeContextMenu,
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
  function ctxEffectsFn() {
    ctxEffects({ openEffectsMenu: deps.openEffectsMenu });
  }
  function ctxEqualizerFn() {
    ctxEqualizer({ openEqualizerMenu: deps.openEqualizerMenu });
  }
  function ctxPropertiesFn() {
    ctxProperties({
      closeContextMenu: deps.closeContextMenu,
      setPropertiesOpen: deps.setPropertiesOpen,
      clearMediaProps: () => deps.setMediaProps(null),
      isStillOpen: deps.propertiesOpen,
      ensureFfprobeAndLoad: async () => {
        await loadMediaProperties({
          filePath: deps.filePath(),
          setMediaProps: deps.setMediaProps,
          setMediaPropsLoading: deps.setMediaPropsLoading,
        });
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
    ctxEffectsFn,
    ctxEqualizerFn,
    ctxPropertiesFn,
    ctxShareFn,
    ctxDelete,
  };
}
