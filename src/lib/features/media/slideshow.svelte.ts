// Slideshow state
import { isPdf, isTimedMedia } from "$lib/shared/media-kind";

export type SlideshowOrder = "next" | "shuffle";
export type SlideshowVideoMode = "skip" | "full";
export type SlideshowTransition = "none" | "fade" | "slide";

export function createSlideshow() {
  let active = $state(false);
  let paused = $state(false);
  let intervalSec = $state(5);
  let order = $state<SlideshowOrder>("next");
  let videoMode = $state<SlideshowVideoMode>("skip");
  let transition = $state<SlideshowTransition>("none");

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingVideoEl: HTMLMediaElement | null = null;
  let pendingVideoHandler: (() => void) | null = null;
  let shuffledIndices: number[] = [];
  let shufflePos = 0;

  let bound = {
    getFileList: () => [] as string[],
    getCurrentIndex: () => 0,
    advanceFn: (_: number) => {},
    getMediaEl: () => null as HTMLMediaElement | null,
  };

  function bind(
    getFileList: () => string[],
    getCurrentIndex: () => number,
    advanceFn: (nextIndex: number) => void,
    getMediaEl: () => HTMLMediaElement | null,
  ) {
    bound = { getFileList, getCurrentIndex, advanceFn, getMediaEl };
  }

  function clearVideoListener() {
    if (pendingVideoEl && pendingVideoHandler) {
      pendingVideoEl.removeEventListener("ended", pendingVideoHandler);
    }
    pendingVideoEl = null;
    pendingVideoHandler = null;
  }

  function buildShuffle(fileList: string[], currentIndex: number) {
    shuffledIndices = Array.from({ length: fileList.length }, (_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [
        shuffledIndices[j],
        shuffledIndices[i],
      ];
    }
    shufflePos = shuffledIndices.indexOf(currentIndex);
    if (shufflePos === -1) shufflePos = 0;
  }

  function getNextIndex(fileList: string[], currentIndex: number): number {
    if (fileList.length <= 1) return 0;
    if (order === "shuffle") {
      shufflePos = (shufflePos + 1) % shuffledIndices.length;
      return shuffledIndices[shufflePos];
    }
    return (currentIndex + 1) % fileList.length;
  }

  function schedule() {
    if (!active || paused) return;
    const fileList = bound.getFileList();
    const currentIndex = bound.getCurrentIndex();
    if (fileList.length === 0) return;
    const path = fileList[currentIndex];
    const timed = isTimedMedia(path);
    const document = isPdf(path);

    // Always skip documents (PDFs) in slideshow
    if (document) {
      if (fileList.length === 1) {
        stop();
        return;
      }
      const nextIndex = getNextIndex(fileList, currentIndex);
      timer = setTimeout(() => {
        if (!active || paused) return;
        bound.advanceFn(nextIndex);
      }, 0);
      return;
    }

    if (timed && videoMode === "skip") {
      if (fileList.length === 1) {
        timer = setTimeout(() => {
          if (!active || paused) return;
          bound.advanceFn(0);
        }, intervalSec * 1000);
        return;
      }
      const nextIndex = getNextIndex(fileList, currentIndex);
      timer = setTimeout(() => {
        if (!active || paused) return;
        bound.advanceFn(nextIndex);
      }, 0);
      return;
    }

    if (timed && videoMode === "full") {
      const mediaEl = bound.getMediaEl();
      if (mediaEl) {
        clearVideoListener();
        const handler = () => {
          clearVideoListener();
          if (!active || paused) return;
          const nextIndex = getNextIndex(fileList, currentIndex);
          bound.advanceFn(nextIndex);
        };
        pendingVideoEl = mediaEl;
        pendingVideoHandler = handler;
        mediaEl.addEventListener("ended", handler);
        return;
      }
      timer = setTimeout(() => {
        if (!active || paused) return;
        const nextIndex = getNextIndex(fileList, currentIndex);
        bound.advanceFn(nextIndex);
      }, intervalSec * 1000);
      return;
    }

    timer = setTimeout(() => {
      if (!active || paused) return;
      const nextIndex = getNextIndex(fileList, currentIndex);
      bound.advanceFn(nextIndex);
    }, intervalSec * 1000);
  }

  function restartIfActive() {
    if (active && !paused) {
      clearTimeout(timer);
      timer = undefined;
      clearVideoListener();
      schedule();
    }
  }

  function start() {
    stop();
    const fileList = bound.getFileList();
    const currentIndex = bound.getCurrentIndex();
    if (fileList.length === 0) return;
    active = true;
    paused = false;
    if (order === "shuffle") buildShuffle(fileList, currentIndex);
    schedule();
  }

  function pause() {
    if (!active) return;
    paused = true;
    clearTimeout(timer);
    timer = undefined;
    clearVideoListener();
  }

  function resume() {
    if (!active) return;
    paused = false;
    schedule();
  }

  function stop() {
    active = false;
    paused = false;
    clearTimeout(timer);
    timer = undefined;
    clearVideoListener();
    shuffledIndices = [];
  }

  function onMediaLoaded() {
    if (!active || paused) return;
    clearTimeout(timer);
    timer = undefined;
    clearVideoListener();
    schedule();
  }

  return {
    get active() {
      return active;
    },
    get paused() {
      return paused;
    },
    get intervalSec() {
      return intervalSec;
    },
    set intervalSec(v: number) {
      intervalSec = v;
      restartIfActive();
    },
    get order() {
      return order;
    },
    set order(v: SlideshowOrder) {
      order = v;
      if (v === "shuffle") {
        const fileList = bound.getFileList();
        const currentIndex = bound.getCurrentIndex();
        buildShuffle(fileList, currentIndex);
      }
      restartIfActive();
    },
    get videoMode() {
      return videoMode;
    },
    set videoMode(v: SlideshowVideoMode) {
      videoMode = v;
      restartIfActive();
    },
    get transition() {
      return transition;
    },
    set transition(v: SlideshowTransition) {
      transition = v;
    },
    bind,
    start,
    pause,
    resume,
    stop,
    onMediaLoaded,
  };
}

export type SlideshowStore = typeof slideshow;
export const slideshow = createSlideshow();
