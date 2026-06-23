import { markerStore } from "$lib/features/markers/markers.svelte";

export interface PlaybackPollerDeps {
  getIsVideo: () => boolean;
  getIsAudio: () => boolean;
  getVideoEl: () => HTMLVideoElement | null;
  getAudioEl: () => HTMLAudioElement | null;
  getIsScrubbing: () => boolean;
  setRawCurrentSecs: (v: number) => void;
  setRawDurationSecs: (v: number) => void;
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

      if (!deps.getIsScrubbing()) {
        deps.setRawCurrentSecs(el.currentTime);
        deps.setRawDurationSecs(el.duration || 0);
        deps.setProgress(
          el.duration > 0 ? (el.currentTime / el.duration) * 100 : 0,
        );
        deps.setPlaying(!el.paused);

        // AB loop enforcement
        const ab = markerStore.abLoopRegion;
        if (ab && el.currentTime >= ab.end) {
          el.currentTime = ab.start;
        }
      }

      rafId = requestAnimationFrame(poll);
    }

    function onPlay() {
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
