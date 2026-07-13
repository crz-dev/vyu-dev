// Playback helpers
import { isAudio } from "$lib/shared/mediaKind";
import type { MediaState } from "./media.svelte";

export function createOnMediaEnded(deps: {
  slideshow: { active: boolean };
  loopModeStore: { loopMode: string };
  setPlaying: (v: boolean) => void;
  navigate: (dir: number) => void;
  getFileList: () => string[];
  getCurrentIndex: () => number;
  media: {
    navigate: (
      dir: number,
      list: string[],
      idx: number,
      setState: (data: Partial<MediaState>) => void,
    ) => Promise<number>;
  };
  setMediaState: (data: Partial<MediaState>) => void;
}) {
  return async function onMediaEnded() {
    if (deps.slideshow.active) return;
    const mode = deps.loopModeStore.loopMode;
    if (mode === "stop") {
      deps.setPlaying(false);
    } else if (mode === "next") {
      deps.navigate(1);
    } else if (mode === "shuffle") {
      const list = deps.getFileList();
      if (list.length > 1) {
        const idx = Math.floor(Math.random() * list.length);
        const currentIndex = deps.getCurrentIndex();
        await deps.media.navigate(
          idx - currentIndex,
          list,
          currentIndex,
          deps.setMediaState,
        );
      }
    } else if (mode === "shuffle-songs") {
      const list = deps.getFileList();
      const audioFiles = list.filter((f) => isAudio(f));
      if (audioFiles.length > 1) {
        const idx = Math.floor(Math.random() * audioFiles.length);
        const currentIndex = deps.getCurrentIndex();
        const chosen = audioFiles[idx];
        const listIdx = list.indexOf(chosen);
        if (listIdx !== -1) {
          await deps.media.navigate(
            listIdx - currentIndex,
            list,
            currentIndex,
            deps.setMediaState,
          );
        }
      }
    }
  };
}

export function createFrameStep(deps: {
  getVideoEl: () => HTMLVideoElement | null;
}) {
  return function frameStep(direction: -1 | 1) {
    const videoEl = deps.getVideoEl();
    if (!videoEl) return;
    videoEl.currentTime = Math.max(
      0,
      Math.min(videoEl.currentTime + direction * (1 / 30), videoEl.duration),
    );
  };
}
