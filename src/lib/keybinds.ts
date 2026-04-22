export type KeybindActions = {
  areDialogsOpen: () => boolean;
  closeDialogs: () => void;
  navigateToEdge: (left: boolean) => void;
  navigate: (dir: number) => void;
  toggleFullscreen: () => void;
  setVolume: (v: number) => void;
  getVolume: () => number;
  isVideo: () => boolean;
  getVideoEl: () => HTMLVideoElement | null;
  getHoverZone: () => string;
  isFullscreen: () => boolean;
  togglePlay: () => void;
};

export function setupKeybinds(actions: KeybindActions) {
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
      actions.setVolume(actions.getVolume() + 0.125);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      actions.setVolume(actions.getVolume() - 0.125);
      return;
    }

    if (["ArrowRight", "ArrowLeft", " "].includes(e.key)) e.preventDefault();

    const isVid = actions.isVideo();
    const videoEl = actions.getVideoEl();

    if (
      isVid &&
      videoEl &&
      (actions.getHoverZone() === "video" || actions.isFullscreen())
    ) {
      if (e.key === " ") actions.togglePlay();
      if (e.key === "ArrowRight")
        videoEl.currentTime = Math.min(
          videoEl.currentTime + 5,
          videoEl.duration,
        );
      if (e.key === "ArrowLeft")
        videoEl.currentTime = Math.max(videoEl.currentTime - 5, 0);
    } else {
      if (e.key === " " && isVid && videoEl) actions.togglePlay();
      if (e.key === "ArrowRight") actions.navigate(1);
      if (e.key === "ArrowLeft") actions.navigate(-1);
    }
  };
}
