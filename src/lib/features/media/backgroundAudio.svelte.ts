// Background audio for browsing other files
import { deleteResumePoint, saveResumePoint } from "$lib/services/storage";
import {
  deleteResumePoint as dbDeleteResumePoint,
  saveResumePoint as dbSaveResumePoint,
} from "$lib/services/database";
import { volumeToActual } from "$lib/features/media/playback.svelte";

export interface BackgroundAudioStart {
  path: string;
  name: string;
  src: string;
  currentTime: number;
  volume: number;
  muted: boolean;
  rate: number;
  loop: boolean;
  playing: boolean;
}

function createBackgroundAudio() {
  let active = $state(false);
  let playing = $state(false);
  let path = $state("");
  let name = $state("");
  let src = $state("");
  let volume = $state(1);
  let muted = $state(false);
  let rate = $state(1);
  let loop = $state(false);
  let boost = $state(false);

  let element: HTMLAudioElement | null = null;
  let saveInterval: ReturnType<typeof setInterval> | null = null;
  let pendingSeek: { path: string; time: number } | null = null;

  function applyProps() {
    if (!element) return;
    element.volume = Math.min(1, volumeToActual(volume) * (boost ? 2 : 1));
    element.muted = muted;
    element.playbackRate = rate;
    element.loop = loop;
  }

  function attach(el: HTMLAudioElement | null) {
    element = el;
    if (!el) return;
    applyProps();
    if (active && src) {
      if (el.src !== src) el.src = src;
      if (playing) {
        el.play().catch(() => {
          playing = false;
        });
      }
    }
  }

  function savePosition() {
    if (!active || !path || !element) return;
    const cur = element.currentTime;
    const dur = Number.isFinite(element.duration) ? element.duration : 0;
    if (!Number.isFinite(cur) || cur <= 0) return;
    if (dur > 0 && cur >= dur - 1.5) {
      deleteResumePoint(path);
      void dbDeleteResumePoint(path);
      return;
    }
    saveResumePoint(path, cur);
    void dbSaveResumePoint(path, cur);
  }

  function clearSaveInterval() {
    if (saveInterval) {
      clearInterval(saveInterval);
      saveInterval = null;
    }
  }

  function start(opts: BackgroundAudioStart) {
    if (!opts.src) return;
    active = true;
    path = opts.path;
    name = opts.name;
    src = opts.src;
    volume = opts.volume;
    muted = opts.muted;
    rate = opts.rate;
    loop = opts.loop;
    playing = opts.playing;
    clearSaveInterval();
    saveInterval = setInterval(savePosition, 10_000);
    if (!element) return;
    element.src = opts.src;
    element.load();
    applyProps();
    try {
      if (opts.currentTime > 0) element.currentTime = opts.currentTime;
    } catch {
      /* seek will apply once metadata is ready */
    }
    if (opts.playing) {
      element.play().catch(() => {
        playing = false;
      });
    } else {
      playing = false;
    }
  }

  function stop(save = true) {
    if (save) savePosition();
    clearSaveInterval();
    if (element) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    active = false;
    playing = false;
    path = "";
    name = "";
    src = "";
  }

  function setPlaying(value: boolean) {
    playing = value;
  }

  function pause() {
    if (element && !element.paused) element.pause();
    playing = false;
  }

  function queueSeek(pathValue: string, time: number) {
    pendingSeek = { path: pathValue, time };
  }

  function consumePendingSeek(pathValue: string): number | null {
    const pending = pendingSeek;
    pendingSeek = null;
    return pending && pending.path === pathValue ? pending.time : null;
  }

  function clearPendingSeek() {
    pendingSeek = null;
  }

  function toggle() {
    if (!element || !active) return;
    if (element.paused) {
      element.play().catch(() => {
        playing = false;
      });
    } else {
      element.pause();
    }
  }

  function setVolume(value: number) {
    volume = value;
    if (element) applyProps();
  }

  function setMuted(value: boolean) {
    muted = value;
    if (element) element.muted = value;
  }

  function setBoost(enabled: boolean) {
    boost = enabled;
    if (element) applyProps();
  }

  function handleEnded() {
    if (loop && element) {
      element.currentTime = 0;
      element.play().catch(() => {});
      return;
    }
    if (path) {
      deleteResumePoint(path);
      void dbDeleteResumePoint(path);
    }
    stop(false);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", savePosition);
  }

  return {
    get active() {
      return active;
    },
    get playing() {
      return playing;
    },
    get path() {
      return path;
    },
    get name() {
      return name;
    },
    get src() {
      return src;
    },
    get loop() {
      return loop;
    },
    get currentTime() {
      return element?.currentTime ?? 0;
    },
    attach,
    start,
    stop,
    pause,
    toggle,
    setVolume,
    setMuted,
    setBoost,
    setPlaying,
    handleEnded,
    savePosition,
    queueSeek,
    consumePendingSeek,
    clearPendingSeek,
  };
}

export const backgroundAudio = createBackgroundAudio();
