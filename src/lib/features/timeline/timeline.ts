import type { VideoMarker } from "$lib/shared/types";

export function createTimeline() {
  function addTimestamp(
    currentTime: number,
    timestamps: VideoMarker[],
    set: (v: VideoMarker[]) => void,
  ) {
    const newTimestamp: VideoMarker = {
      id: crypto.randomUUID(),
      time: currentTime,
      title: undefined,
    };

    const next = [...timestamps, newTimestamp].sort((a, b) => a.time - b.time);

    set(next);
  }

  function removeTimestamp(
    id: string,
    timestamps: VideoMarker[],
    set: (v: VideoMarker[]) => void,
  ) {
    const next = timestamps.filter((t) => t.id !== id);
    set(next);
  }

  function clearTimestamps(set: (v: VideoMarker[]) => void) {
    set([]);
  }

  function updateTimestampTitle(
    id: string,
    title: string,
    timestamps: VideoMarker[],
    set: (v: VideoMarker[]) => void,
  ) {
    const next = timestamps.map((ts) =>
      ts.id === id ? { ...ts, title: title.trim() } : ts,
    );
    set(next);
  }

  function getTimestampById(
    id: string,
    timestamps: VideoMarker[],
  ): VideoMarker | undefined {
    return timestamps.find((ts) => ts.id === id);
  }

  function getTimestampPct(time: number, duration: number): number {
    if (!duration || duration <= 0) return 0;
    return (time / duration) * 100;
  }

  function findTouchTarget(
    timestamps: VideoMarker[],
    time: number,
    tolerance = 0.6,
  ): VideoMarker | null {
    let found: VideoMarker | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const ts of timestamps) {
      const d = Math.abs(ts.time - time);
      if (d <= tolerance && d < best) {
        found = ts;
        best = d;
      }
    }
    return found;
  }

  function seekToTimestamp(
    index: number,
    timestamps: VideoMarker[],
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
    clearTimestamps,
    updateTimestampTitle,
    getTimestampById,
    getTimestampPct,
    findTouchTarget,
    seekToTimestamp,
  };
}
