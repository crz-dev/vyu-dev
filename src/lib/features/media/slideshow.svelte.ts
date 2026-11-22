import { isPdf, isTimedMedia } from "$lib/shared/mediaKind";

export type QueueTransition = "none" | "fade" | "slide";

/**
 * Queue playback engine. The queue owns the sequence; this store only decides
 * when to advance and which transition to use. Images advance on the interval,
 * timed media advances when it ends, and PDFs are skipped.
 */
export function createSlideshow() {
  let active = $state(false);
  let paused = $state(false);
  let intervalSec = $state(15);
  let transition = $state<QueueTransition>("none");

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingMediaEl: HTMLMediaElement | null = null;
  let pendingMediaHandler: (() => void) | null = null;

  let bound = {
    getCurrentPath: () => "",
    advance: () => {},
    getMediaEl: () => null as HTMLMediaElement | null,
  };

  function bind(
    getCurrentPath: () => string,
    advanceFn: () => void,
    getMediaEl: () => HTMLMediaElement | null,
  ) {
    bound = { getCurrentPath, advance: advanceFn, getMediaEl };
  }

  function clearMediaListener() {
    if (pendingMediaEl && pendingMediaHandler) {
      pendingMediaEl.removeEventListener("ended", pendingMediaHandler);
    }
    pendingMediaEl = null;
    pendingMediaHandler = null;
  }

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function advance() {
    if (!active || paused) return;
    clearTimer();
    clearMediaListener();
    bound.advance();
  }

  function schedule() {
    if (!active || paused) return;
    clearTimer();
    clearMediaListener();

    const path = bound.getCurrentPath();
    if (!path) {
      stop();
      return;
    }

    if (isPdf(path)) {
      timer = setTimeout(advance, 0);
      return;
    }

    const isGif = /\.gif$/i.test(path);
    if (isTimedMedia(path) && !isGif) {
      const mediaEl = bound.getMediaEl();
      if (mediaEl) {
        mediaEl.loop = false;
        const handler = () => {
          clearMediaListener();
          if (!active || paused) return;
          advance();
        };
        pendingMediaEl = mediaEl;
        pendingMediaHandler = handler;
        mediaEl.addEventListener("ended", handler);
        return;
      }
      timer = setTimeout(advance, intervalSec * 1000);
      return;
    }

    timer = setTimeout(advance, intervalSec * 1000);
  }

  function restartIfActive() {
    if (active && !paused) schedule();
  }

  function start() {
    stop();
    if (!bound.getCurrentPath()) return;
    active = true;
    paused = false;
    schedule();
  }

  function pause() {
    if (!active) return;
    paused = true;
    clearTimer();
    clearMediaListener();
  }

  function resume() {
    if (!active) return;
    paused = false;
    schedule();
  }

  function stop() {
    active = false;
    paused = false;
    clearTimer();
    clearMediaListener();
  }

  function onMediaLoaded() {
    if (!active || paused) return;
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
    get transition() {
      return transition;
    },
    set transition(v: QueueTransition) {
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
