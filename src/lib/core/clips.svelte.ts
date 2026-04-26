import type { ClipBoundary, ClipPair } from "$lib/types";
import { writeClipBoundaries, eraseClipBoundaries } from "$lib/services/storage";

export function createClips(getFilePath: () => string) {
  let clipBoundaries = $state<ClipBoundary[]>([]);
  let clipMarkerJustDragged = $state(false);

  const clipPairs = $derived.by(() => computePairs(clipBoundaries));
  const clipCount = $derived(clipPairs.length);

  function _save() {
    writeClipBoundaries(getFilePath(), clipBoundaries);
  }

  function setBoundaries(v: ClipBoundary[]) {
    clipBoundaries = v;
    _save();
  }

  function addClipBoundary(kind: "start" | "end", time: number) {
    const exists = clipBoundaries.some(
      (m) => m.kind === kind && Math.abs(m.time - time) < 0.25,
    );
    if (exists) return;

    clipBoundaries = [
      ...clipBoundaries,
      {
        id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time,
        kind,
        title: "",
      },
    ].sort((a, b) => a.time - b.time);

    _save();
  }

  function removeClipBoundary(id: string) {
    clipBoundaries = clipBoundaries.filter((b) => b.id !== id);
    _save();
  }

  function clearBoundaries() {
    clipBoundaries = [];
    eraseClipBoundaries(getFilePath());
  }

  function updateBoundaryTitle(id: string, title: string) {
    clipBoundaries = clipBoundaries.map((marker) =>
      marker.id === id ? { ...marker, title: title.trim() } : marker,
    );
    _save();
  }

  function getBoundaryById(id: string): ClipBoundary | undefined {
    return clipBoundaries.find((marker) => marker.id === id);
  }

  function setBoundaryKind(id: string, kind: "start" | "end") {
    clipBoundaries = clipBoundaries
      .map((m) => (m.id === id ? { ...m, kind } : m))
      .sort((a, b) => a.time - b.time);
    _save();
  }

  function findTouchTarget(
    time: number,
    tolerance = 0.6,
  ): ClipBoundary | null {
    let found: ClipBoundary | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const marker of clipBoundaries) {
      const d = Math.abs(marker.time - time);
      if (d <= tolerance && d < best) {
        found = marker;
        best = d;
      }
    }
    return found;
  }

  return {
    get clipBoundaries() { return clipBoundaries; },
    get clipPairs() { return clipPairs; },
    get clipCount() { return clipCount; },
    get clipMarkerJustDragged() { return clipMarkerJustDragged; },
    set clipMarkerJustDragged(v: boolean) { clipMarkerJustDragged = v; },
    setBoundaries,
    addClipBoundary,
    removeClipBoundary,
    clearBoundaries,
    updateBoundaryTitle,
    getBoundaryById,
    setBoundaryKind,
    findTouchTarget,
  };
}

function computePairs(boundaries: ClipBoundary[]): ClipPair[] {
  const sorted = [...boundaries].sort((a, b) => a.time - b.time);
  const pendingStarts: ClipBoundary[] = [];
  const pairs: ClipPair[] = [];

  for (const marker of sorted) {
    if (marker.kind === "start") {
      pendingStarts.push(marker);
    } else if (pendingStarts.length > 0) {
      const start = pendingStarts.shift()!;
      if (marker.time > start.time) {
        pairs.push({
          start: start.time,
          end: marker.time,
          startId: start.id,
          endId: marker.id,
        });
      }
    }
  }

  return pairs.sort((a, b) => a.start - b.start);
}
