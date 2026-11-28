import type { MediaChapter, VideoMarker } from "$lib/shared/types";

const CHAPTER_EPSILON = 0.05;

function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, Number.isFinite(time) ? time : 0);
  }
  return Math.max(0, Math.min(time, duration));
}

export function chapterIndexAt(
  time: number,
  chapters: MediaChapter[],
  duration: number,
): number {
  if (chapters.length === 0) return -1;
  const target = clampTime(time, duration);
  let index = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= target + CHAPTER_EPSILON) index = i;
    else break;
  }
  return index;
}

export function chapterSeekTarget(
  time: number,
  chapters: MediaChapter[],
  duration: number,
  direction: -1 | 1,
): number | null {
  if (chapters.length === 0) return null;
  const target = clampTime(time, duration);

  if (direction > 0) {
    for (const chapter of chapters) {
      if (chapter.start > target + CHAPTER_EPSILON) {
        return clampTime(chapter.start, duration);
      }
    }
    return null;
  }

  const index = chapterIndexAt(target, chapters, duration);
  if (index <= 0) return 0;
  return clampTime(chapters[index - 1].start, duration);
}

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
