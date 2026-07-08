// Playback poller
import { markerStore } from "$lib/features/markers/markers.svelte";

export interface PlaybackPollerDeps {
  getIsVideo: () => boolean;
  getIsAudio: () => boolean;
  getVideoEl: () => HTMLVideoElement | null;
  getAudioEl: () => HTMLAudioElement | null;
  getIsScrubbing: () => boolean;
  setRawCurrentSecs: (v: number) => void;
  setProgress: (v: number) => void;
  setPlaying: (v: boolean) => void;
}

export function createPlaybackPoller(deps: PlaybackPollerDeps) {
  return () => {
    const mediaEl = deps.getIsVideo()
      ? deps.getVideoEl()
      : deps.getIsAudio()
        ? deps.getAudioEl()
        : null;
    if (!mediaEl) return;

    let rafId: number;

    function poll() {
      const el = mediaEl;
      if (!el) return;

      try {
        if (!deps.getIsScrubbing()) {
          const t = el.currentTime;
          const d = el.duration || 0;
          deps.setRawCurrentSecs(t);
          deps.setProgress(d > 0 ? (t / d) * 100 : 0);

          // AB loop enforcement
          const ab = markerStore.abLoopRegion;
          if (ab && t >= ab.end) {
            el.currentTime = ab.start;
          }
        }
      } catch {
        // Decoder may be in a bad state — keep polling to maintain RAF chain
      }

      rafId = requestAnimationFrame(poll);
    }

    function onPlay() {
      deps.setPlaying(true);
      rafId = requestAnimationFrame(poll);
    }

    function onPause() {
      cancelAnimationFrame(rafId);
      deps.setPlaying(false);
    }

    mediaEl.addEventListener("play", onPlay);
    mediaEl.addEventListener("pause", onPause);

    // If already playing (e.g. autoplay), start RAF loop immediately
    if (!mediaEl.paused) {
      rafId = requestAnimationFrame(poll);
    }

    return () => {
      cancelAnimationFrame(rafId);
      mediaEl.removeEventListener("play", onPlay);
      mediaEl.removeEventListener("pause", onPause);
    };
  };
}
