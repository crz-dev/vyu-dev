import type { Timestamp } from "$lib/types";

export function createTimeline() {
  function addTimestamp(
    currentTime: number,
    timestamps: Timestamp[],
    set: (v: Timestamp[]) => void,
  ) {
    const newTimestamp: Timestamp = {
      id: crypto.randomUUID(),
      time: currentTime,
      title: undefined,
    };

    const next = [...timestamps, newTimestamp].sort((a, b) => a.time - b.time);

    set(next);
  }

  function removeTimestamp(
    id: string,
    timestamps: Timestamp[],
    set: (v: Timestamp[]) => void,
  ) {
    const next = timestamps.filter((t) => t.id !== id);
    set(next);
  }

  function seekToTimestamp(
    index: number,
    timestamps: Timestamp[],
    videoEl: HTMLVideoElement | null,
  ) {
    if (!videoEl) return;

    const t = timestamps[index];
    if (t) {
      videoEl.currentTime = t.time;
    }
  }

  return {
    addTimestamp,
    removeTimestamp,
    seekToTimestamp,
  };
}
