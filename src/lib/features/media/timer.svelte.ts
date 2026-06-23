// Timer state
import { formatTime } from "$lib/features/media/playback.svelte";

function createTimerStore() {
  let timerShowRemaining = $state(false);

  function toggleTimer() {
    timerShowRemaining = !timerShowRemaining;
  }

  function currentTimeDisplay(
    getCurrentSecs: () => number,
    getDurationSecs: () => number,
  ): string {
    if (!timerShowRemaining) return formatTime(getCurrentSecs());
    return `-${formatTime(getDurationSecs() - getCurrentSecs())}`;
  }

  function audioBitrateDisplay(
    getFileSizeBytes: () => number,
    getDurationSecs: () => number,
    getIsAudio: () => boolean,
  ): string {
    if (!getIsAudio() || getFileSizeBytes() <= 0 || getDurationSecs() <= 0)
      return "";
    const kbps = Math.round(
      (getFileSizeBytes() * 8) / getDurationSecs() / 1000,
    );
    return `${kbps} kbps`;
  }

  function timerTooltip(): string {
    return timerShowRemaining ? "Remaining" : "Elapsed";
  }

  return {
    get timerShowRemaining() {
      return timerShowRemaining;
    },
    toggleTimer,
    currentTimeDisplay,
    audioBitrateDisplay,
    timerTooltip,
  };
}

export const timerStore = createTimerStore();
