// DATAFLOW: handleKeydown dispatched from +page.svelte. ArrowLeft/Right → navigate(±1).
// Alt+Arrow → navigate. Ctrl+Arrow → navigateToEdge. Space → togglePlay.
import { VOLUME_STEP } from "$lib/shared/constants";

type KeybindActions = {
  areDialogsOpen: () => boolean;
  closeDialogs: () => void;
  navigateToEdge: (left: boolean) => void;
  navigate: (dir: number) => void;
  toggleFullscreen: () => void;
  setVolume: (v: number) => void;
  getVolume: () => number;
  isTimedMedia: () => boolean;
  isVideo: () => boolean;
  getMediaEl: () => HTMLMediaElement | null;
  getHoverZone: () => string;
  isFullscreen: () => boolean;
  togglePlay: () => void;
  frameStep: (direction: -1 | 1) => void;
};

const NAV_KEYS = new Set(["ArrowRight", "ArrowLeft", " "]);

export function createKeybindHandler(actions: KeybindActions) {
  return function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const isTypingTarget =
      !!target &&
      (target.closest("input, textarea, [contenteditable='true']") !== null ||
        target.isContentEditable);
    if (isTypingTarget) return;

    if (actions.areDialogsOpen()) {
      if (e.key === "Escape") {
        actions.closeDialogs();
      }
      return;
    }

    if (e.ctrlKey && e.key === "ArrowRight") {
      e.preventDefault();
      actions.navigateToEdge(false);
      return;
    }
    if (e.ctrlKey && e.key === "ArrowLeft") {
      e.preventDefault();
      actions.navigateToEdge(true);
      return;
    }
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      actions.navigate(1);
      return;
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      actions.navigate(-1);
      return;
    }
    if (e.key === "f" || e.key === "F") {
      actions.toggleFullscreen();
      return;
    }
    if (e.key === "Escape" && actions.isFullscreen()) {
      actions.toggleFullscreen();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      actions.setVolume(actions.getVolume() + VOLUME_STEP);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      actions.setVolume(actions.getVolume() - VOLUME_STEP);
      return;
    }

    if (NAV_KEYS.has(e.key)) e.preventDefault();

    const isTimed = actions.isTimedMedia();
    const mediaEl = actions.getMediaEl();

    if (
      isTimed &&
      mediaEl &&
      (actions.getHoverZone() === "video" || actions.isFullscreen())
    ) {
      if (e.key === " ") actions.togglePlay();
      if (e.key === "ArrowRight")
        mediaEl.currentTime = Math.min(
          mediaEl.currentTime + 5,
          mediaEl.duration,
        );
      if (e.key === "ArrowLeft")
        mediaEl.currentTime = Math.max(mediaEl.currentTime - 5, 0);
      if (e.key === "," || e.key === "<") {
        e.preventDefault();
        actions.frameStep(-1);
      }
      if (e.key === "." || e.key === ">") {
        e.preventDefault();
        actions.frameStep(1);
      }
    } else {
      const isVid = actions.isVideo();
      if (e.key === " " && isTimed && mediaEl) actions.togglePlay();
      if (e.key === "ArrowRight") actions.navigate(1);
      if (e.key === "ArrowLeft") actions.navigate(-1);
      if (e.key === "," || e.key === "<") {
        e.preventDefault();
        if (isVid) actions.frameStep(-1);
      }
      if (e.key === "." || e.key === ">") {
        e.preventDefault();
        if (isVid) actions.frameStep(1);
      }
    }
  };
}
