// Timeline markers
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

  function updateTimestampTime(
    id: string,
    time: number,
    timestamps: VideoMarker[],
    set: (v: VideoMarker[]) => void,
  ) {
    const next = timestamps
      .map((ts) => (ts.id === id ? { ...ts, time } : ts))
      .sort((a, b) => a.time - b.time);
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

  return {
    addTimestamp,
    removeTimestamp,
    clearTimestamps,
    updateTimestampTitle,
    updateTimestampTime,
    getTimestampById,
    getTimestampPct,
  };
}
