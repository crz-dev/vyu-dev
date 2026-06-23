// Loop mode state
import { saveLoopMode } from "$lib/services/storage";
import { LOOP_MODES, type LoopMode } from "$lib/shared/constants";

function createLoopModeStore() {
  let loopMode = $state<LoopMode>("loop");

  function applyToMedia(
    mode: LoopMode,
    videoEl: HTMLVideoElement | null,
    audioEl: HTMLAudioElement | null,
  ) {
    if (videoEl) videoEl.loop = mode === "loop";
    if (audioEl) audioEl.loop = mode === "loop";
  }

  function setLoopMode(
    mode: LoopMode,
    getVideoEl: () => HTMLVideoElement | null,
    getAudioEl: () => HTMLAudioElement | null,
  ) {
    loopMode = mode;
    saveLoopMode(loopMode);
    applyToMedia(loopMode, getVideoEl(), getAudioEl());
  }

  function cycleLoopMode(
    getVideoEl: () => HTMLVideoElement | null,
    getAudioEl: () => HTMLAudioElement | null,
  ) {
    const idx = LOOP_MODES.indexOf(loopMode);
    const next = LOOP_MODES[(idx + 1) % LOOP_MODES.length];
    setLoopMode(next, getVideoEl, getAudioEl);
  }

  return {
    get loopMode() {
      return loopMode;
    },
    setLoopMode,
    cycleLoopMode,
  };
}

export type LoopModeStoreType = typeof loopModeStore;
export const loopModeStore = createLoopModeStore();
