// Marker state
import { createTimeline } from "$lib/features/timeline/timeline";
import {
  writeTimestamps,
  deleteTimestamps,
  deleteResumePoint,
} from "$lib/services/database";
import type { LoopMode } from "$lib/shared/constants";
import type { ClipBoundary, VideoMarker } from "$lib/shared/types";

const timeline = createTimeline();

export type MarkerTooltipTone = "yellow" | "blue" | "green" | "grey";

export interface MarkerTooltip {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  timeLabel: string;
  tone?: MarkerTooltipTone;
  targetId?: string;
}

export interface MarkerEditMenu {
  visible: boolean;
  x: number;
  y: number;
  targetId: string;
  targetType: "timestamp" | "segment";
}

function createMarkerStore() {
  let timestamps = $state<VideoMarker[]>([]);
  let resumePoint = $state<number | null>(null);
  let loopStart = $state<number | null>(null);
  let loopEnd = $state<number | null>(null);
  let loopMarkerJustDragged = $state(false);
  let timestampDragJustEnded = $state(false);
  let resumeTooltipVisible = $state(false);
  let tsTooltip = $state<MarkerTooltip>({
    visible: false,
    x: 0,
    y: 0,
    title: "",
    timeLabel: "",
    tone: "yellow",
  });
  let tsEditMenu = $state<MarkerEditMenu>({
    visible: false,
    x: 0,
    y: 0,
    targetId: "",
    targetType: "timestamp",
  });

  const abLoopRegion = $derived(
    loopStart !== null && loopEnd !== null
      ? { start: loopStart, end: loopEnd }
      : null,
  );

  return {
    get timestamps() {
      return timestamps;
    },
    set timestamps(v: VideoMarker[]) {
      timestamps = v;
    },
    get resumePoint() {
      return resumePoint;
    },
    set resumePoint(v: number | null) {
      resumePoint = v;
    },
    get loopStart() {
      return loopStart;
    },
    set loopStart(v: number | null) {
      loopStart = v;
    },
    get loopEnd() {
      return loopEnd;
    },
    set loopEnd(v: number | null) {
      loopEnd = v;
    },
    get loopMarkerJustDragged() {
      return loopMarkerJustDragged;
    },
    set loopMarkerJustDragged(v: boolean) {
      loopMarkerJustDragged = v;
    },
    get timestampDragJustEnded() {
      return timestampDragJustEnded;
    },
    set timestampDragJustEnded(v: boolean) {
      timestampDragJustEnded = v;
    },
    get resumeTooltipVisible() {
      return resumeTooltipVisible;
    },
    set resumeTooltipVisible(v: boolean) {
      resumeTooltipVisible = v;
    },
    get tsTooltip() {
      return tsTooltip;
    },
    set tsTooltip(v: MarkerTooltip) {
      tsTooltip = v;
    },
    get tsEditMenu() {
      return tsEditMenu;
    },
    set tsEditMenu(v: MarkerEditMenu) {
      tsEditMenu = v;
    },
    get abLoopRegion() {
      return abLoopRegion;
    },
  };
}

export type MarkersStore = typeof markerStore;
export const markerStore = createMarkerStore();

export interface ClipsBridge {
  getBoundaryById: (id: string) => ClipBoundary | undefined;
  removeClipBoundary: (id: string) => void;
  addClipBoundary: (kind: "start" | "end", time: number) => void;
  updateBoundaryTitle: (id: string, title: string) => void;
  setBoundaryKind: (id: string, kind: "start" | "end") => void;
  setBoundaryTime: (id: string, time: number) => void;
  readonly clipBoundaries: ClipBoundary[];
  get clipMarkerJustDragged(): boolean;
  set clipMarkerJustDragged(v: boolean);
}

export interface MarkerActionsDeps {
  getFilePath: () => string;
  getRawDurationSecs: () => number;
  getLoopMode: () => LoopMode;
  getMediaEl: () => HTMLMediaElement | null;
  formatTime: (s: number) => string;
  clips: ClipsBridge;
  onClipMenuReopen: () => void;
  setRawCurrentSecs: (v: number) => void;
  setProgress: (v: number) => void;
}

function getProgressBar(): HTMLElement | null {
  return (document.querySelector(".fs-progress") ??
    document.querySelector(".progress-bar") ??
    document.querySelector(".audio-waveform-bar")) as HTMLElement | null;
}

export function createMarkerActions(deps: MarkerActionsDeps) {
  function saveTimestamps() {
    writeTimestamps(deps.getFilePath(), markerStore.timestamps);
  }

  function getTimestampById(id: string): VideoMarker | undefined {
    return timeline.getTimestampById(id, markerStore.timestamps);
  }

  function getTimestampPct(time: number): number {
    return timeline.getTimestampPct(time, deps.getRawDurationSecs());
  }

  function addTimestamp() {
    timeline.addTimestamp(
      deps.getMediaEl()?.currentTime ?? 0,
      markerStore.timestamps,
      (v) => (markerStore.timestamps = v),
    );
    saveTimestamps();
  }

  function removeTimestamp(id: string) {
    markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
    markerStore.tsEditMenu = { ...markerStore.tsEditMenu, visible: false };
    if (markerStore.abLoopRegion) {
      const ts = timeline.getTimestampById(id, markerStore.timestamps);
      if (
        ts &&
        (Math.abs(ts.time - markerStore.abLoopRegion.start) < 0.01 ||
          Math.abs(ts.time - markerStore.abLoopRegion.end) < 0.01)
      ) {
        clearABLoop();
      }
    }
    timeline.removeTimestamp(
      id,
      markerStore.timestamps,
      (v) => (markerStore.timestamps = v),
    );
    saveTimestamps();
  }

  function clearAllTimestamps() {
    markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
    markerStore.tsEditMenu = { ...markerStore.tsEditMenu, visible: false };
    clearABLoop();
    timeline.clearTimestamps((v) => (markerStore.timestamps = v));
    deleteTimestamps(deps.getFilePath());
  }

  function updateTimestampTitle(id: string, title: string) {
    timeline.updateTimestampTitle(
      id,
      title,
      markerStore.timestamps,
      (v) => (markerStore.timestamps = v),
    );
    saveTimestamps();
    if (
      markerStore.tsTooltip.visible &&
      markerStore.tsTooltip.targetId === id
    ) {
      markerStore.tsTooltip = { ...markerStore.tsTooltip, title: title.trim() };
    }
  }

  function getTitleEditorWidthCh(title: string): number {
    return Math.min(26, Math.max(10, (title || "").trim().length + 2));
  }

  function showTimestampTooltip(e: MouseEvent, ts: VideoMarker) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    markerStore.tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: ts.title,
      timeLabel: deps.formatTime(ts.time),
      tone: "yellow",
      targetId: ts.id,
    };
  }

  function openTimestampEditor(e: MouseEvent, id: string) {
    e.stopPropagation();
    const ts = getTimestampById(id);
    if (!ts) return;
    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest(
      ".progress-bar, .fs-progress, .audio-waveform-bar",
    ) as HTMLElement | null;
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const pct =
      deps.getRawDurationSecs() > 0 ? ts.time / deps.getRawDurationSecs() : 0;
    markerStore.tsEditMenu = {
      visible: true,
      x: barRect.left + pct * barRect.width,
      y: barRect.top - 12,
      targetId: id,
      targetType: "timestamp",
    };
  }

  function openSegmentEditor(e: MouseEvent, id: string) {
    e.stopPropagation();
    const b = deps.clips.getBoundaryById(id);
    if (!b) return;
    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest(
      ".progress-bar, .fs-progress, .audio-waveform-bar",
    ) as HTMLElement | null;
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const pct =
      deps.getRawDurationSecs() > 0 ? b.time / deps.getRawDurationSecs() : 0;
    markerStore.tsEditMenu = {
      visible: true,
      x: barRect.left + pct * barRect.width,
      y: barRect.top - 12,
      targetId: id,
      targetType: "segment",
    };
  }

  function closeTimestampEditor() {
    markerStore.tsEditMenu = { ...markerStore.tsEditMenu, visible: false };
    hideTsTooltip();
  }

  function getActiveEditorTimestamp(): VideoMarker | undefined {
    return markerStore.tsEditMenu.targetType === "timestamp"
      ? getTimestampById(markerStore.tsEditMenu.targetId)
      : undefined;
  }

  function getActiveEditorSegment(): ClipBoundary | undefined {
    return markerStore.tsEditMenu.targetType === "segment"
      ? deps.clips.getBoundaryById(markerStore.tsEditMenu.targetId)
      : undefined;
  }

  function getEditorTitle(): string {
    const ts = getActiveEditorTimestamp();
    if (ts) return ts.title ?? "";
    const seg = getActiveEditorSegment();
    return seg?.title ?? "";
  }

  function updateEditorTitle(v: string) {
    if (markerStore.tsEditMenu.targetType === "timestamp") {
      updateTimestampTitle(markerStore.tsEditMenu.targetId, v);
    } else if (markerStore.tsEditMenu.targetType === "segment") {
      deps.clips.updateBoundaryTitle(markerStore.tsEditMenu.targetId, v);
      if (
        markerStore.tsTooltip.visible &&
        markerStore.tsTooltip.targetId === markerStore.tsEditMenu.targetId
      ) {
        markerStore.tsTooltip = { ...markerStore.tsTooltip, title: v.trim() };
      }
    }
  }

  function onEditorScissor(kind: "start" | "end") {
    const seg = getActiveEditorSegment();
    if (seg) {
      deps.clips.setBoundaryKind(seg.id, kind);
      closeTimestampEditor();
    } else {
      const ts = getActiveEditorTimestamp();
      if (ts) {
        deps.clips.addClipBoundary(kind, ts.time);
        removeTimestamp(ts.id);
        const newBoundary = deps.clips.clipBoundaries.find(
          (b) => b.time === ts.time && b.kind === kind,
        );
        if (newBoundary) {
          markerStore.tsEditMenu = {
            ...markerStore.tsEditMenu,
            visible: true,
            targetId: newBoundary.id,
            targetType: "segment",
          };
        }
      }
    }
  }

  function onEditorDeleteTimestamp() {
    const ts = getActiveEditorTimestamp();
    if (ts) removeTimestamp(ts.id);
    closeTimestampEditor();
  }

  function onEditorDeleteSegment() {
    const seg = getActiveEditorSegment();
    if (seg) {
      deps.clips.removeClipBoundary(seg.id);
      closeTimestampEditor();
    }
  }

  function showClipBoundaryTooltip(e: MouseEvent, marker: ClipBoundary) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    markerStore.tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: marker.title,
      timeLabel: deps.formatTime(marker.time),
      tone: "blue",
      targetId: marker.id,
    };
  }

  function showLoopMarkerTooltip(e: MouseEvent, which: "start" | "end") {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const time =
      which === "start" ? markerStore.loopStart : markerStore.loopEnd;
    markerStore.tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: which === "start" ? "Loop A" : "Loop B",
      timeLabel: deps.formatTime(time ?? 0),
      tone: "green",
      targetId: which,
    };
  }

  function hideTsTooltip() {
    markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
  }

  function updateTooltipDuringDrag(
    time: number,
    tone: MarkerTooltipTone,
    title: string | undefined,
    targetId: string | undefined,
  ) {
    const bar = getProgressBar();
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const pct =
      deps.getRawDurationSecs() > 0 ? time / deps.getRawDurationSecs() : 0;
    markerStore.tsTooltip = {
      visible: true,
      x: barRect.left + pct * barRect.width,
      y: barRect.top - 12,
      title,
      timeLabel: deps.formatTime(time),
      tone,
      targetId,
    };
  }

  function startTimestampDrag(e: MouseEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const mediaEl = deps.getMediaEl();
    const duration = deps.getRawDurationSecs();
    if (!mediaEl || duration <= 0) return;

    const startTs = timeline.getTimestampById(id, markerStore.timestamps);
    if (!startTs) return;
    const dragTitle = startTs.title;

    const bar = getProgressBar();
    if (!bar) return;

    updateTooltipDuringDrag(startTs.time, "yellow", dragTitle, id);

    function timeFromClientX(clientX: number): number {
      const rect = bar!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * duration;
    }

    let moved = false;
    function onMouseMove(ev: MouseEvent) {
      moved = true;
      const time = Math.max(0, Math.min(timeFromClientX(ev.clientX), duration));
      timeline.updateTimestampTime(
        id,
        time,
        markerStore.timestamps,
        (v) => (markerStore.timestamps = v),
      );
      updateTooltipDuringDrag(time, "yellow", dragTitle, id);
      if (
        markerStore.tsEditMenu.visible &&
        markerStore.tsEditMenu.targetId === id &&
        bar
      ) {
        const barRect = bar.getBoundingClientRect();
        const pct = duration > 0 ? time / duration : 0;
        markerStore.tsEditMenu.x = barRect.left + pct * barRect.width;
        markerStore.tsEditMenu.y = barRect.top - 12;
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        markerStore.timestampDragJustEnded = true;
        setTimeout(() => {
          markerStore.timestampDragJustEnded = false;
        }, 50);
      }
      saveTimestamps();
      hideTsTooltip();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function setABLoop(start: number, end: number) {
    markerStore.loopStart = start;
    markerStore.loopEnd = end;
    const mediaEl = deps.getMediaEl();
    if (mediaEl) mediaEl.loop = true;
  }

  function clearABLoop() {
    markerStore.loopStart = null;
    markerStore.loopEnd = null;
    const mediaEl = deps.getMediaEl();
    if (mediaEl) mediaEl.loop = deps.getLoopMode() === "loop";
  }

  function addLoopStart() {
    const mediaEl = deps.getMediaEl();
    const duration = deps.getRawDurationSecs();
    if (!mediaEl || duration <= 0) return;
    const time = Math.max(0, Math.min(mediaEl.currentTime, duration));
    markerStore.loopStart = time;
    if (markerStore.loopEnd !== null && markerStore.loopEnd < time) {
      markerStore.loopEnd = null;
    }
    const mEl = deps.getMediaEl();
    if (mEl && markerStore.loopStart !== null && markerStore.loopEnd !== null) {
      mEl.loop = true;
    }
  }

  function addLoopEnd() {
    const mediaEl = deps.getMediaEl();
    const duration = deps.getRawDurationSecs();
    if (!mediaEl || duration <= 0 || markerStore.loopStart === null) return;
    const time = Math.max(0, Math.min(mediaEl.currentTime, duration));
    if (time <= markerStore.loopStart) return;
    markerStore.loopEnd = time;
    mediaEl.loop = true;
  }

  function clearLoopMarkers() {
    markerStore.loopStart = null;
    markerStore.loopEnd = null;
    const mediaEl = deps.getMediaEl();
    if (mediaEl) mediaEl.loop = deps.getLoopMode() === "loop";
  }

  function startLoopMarkerDrag(e: MouseEvent, which: "start" | "end") {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const duration = deps.getRawDurationSecs();
    if (duration <= 0) return;
    if (which === "start" && markerStore.loopStart === null) return;
    if (which === "end" && markerStore.loopEnd === null) return;

    const bar = getProgressBar();
    if (!bar) return;

    function timeFromClientX(clientX: number): number {
      const rect = bar!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * duration;
    }

    let moved = false;
    function onMouseMove(ev: MouseEvent) {
      moved = true;
      const time = timeFromClientX(ev.clientX);
      if (which === "start") {
        markerStore.loopStart = Math.max(0, Math.min(time, duration));
      } else {
        markerStore.loopEnd = Math.max(0, Math.min(time, duration));
      }
      updateTooltipDuringDrag(
        time,
        "green",
        which === "start" ? "Loop A" : "Loop B",
        which,
      );
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        markerStore.loopMarkerJustDragged = true;
        setTimeout(() => {
          markerStore.loopMarkerJustDragged = false;
        }, 50);
      }
      if (markerStore.loopStart !== null && markerStore.loopEnd !== null) {
        const mediaEl = deps.getMediaEl();
        if (mediaEl) mediaEl.loop = true;
      }
      hideTsTooltip();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function startClipMarkerDrag(e: MouseEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    deps.onClipMenuReopen();

    const duration = deps.getRawDurationSecs();
    if (duration <= 0) return;

    const boundary = deps.clips.getBoundaryById(id);
    if (!boundary) return;
    const dragTitle = boundary.title;

    const bar = getProgressBar();
    if (!bar) return;

    updateTooltipDuringDrag(boundary.time, "blue", dragTitle, id);

    function timeFromClientX(clientX: number): number {
      const rect = bar!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * duration;
    }

    let moved = false;
    function onMouseMove(ev: MouseEvent) {
      moved = true;
      const time = timeFromClientX(ev.clientX);
      deps.clips.setBoundaryTime(id, Math.max(0, Math.min(time, duration)));
      updateTooltipDuringDrag(time, "blue", dragTitle, id);
      if (
        markerStore.tsEditMenu.visible &&
        markerStore.tsEditMenu.targetId === id &&
        bar
      ) {
        const barRect = bar.getBoundingClientRect();
        const pct = duration > 0 ? time / duration : 0;
        markerStore.tsEditMenu.x = barRect.left + pct * barRect.width;
        markerStore.tsEditMenu.y = barRect.top - 12;
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        deps.clips.clipMarkerJustDragged = true;
        setTimeout(() => {
          deps.clips.clipMarkerJustDragged = false;
        }, 50);
      }
      hideTsTooltip();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function seekToTimestamp(time: number) {
    const mediaEl = deps.getMediaEl();
    if (!mediaEl || !mediaEl.duration) return;
    mediaEl.currentTime = time;
    deps.setRawCurrentSecs(time);
    deps.setProgress((time / mediaEl.duration) * 100);
  }

  function removeResumePoint() {
    markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
    markerStore.resumeTooltipVisible = false;
    markerStore.resumePoint = null;
    deleteResumePoint(deps.getFilePath());
  }

  function seekToResumePoint() {
    const mediaEl = deps.getMediaEl();
    if (markerStore.resumePoint !== null && mediaEl) {
      seekToTimestamp(markerStore.resumePoint);
    }
  }

  function showResumeTooltip(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    markerStore.tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: "Resume",
      timeLabel: deps.formatTime(markerStore.resumePoint ?? 0),
      tone: "grey",
    };
  }

  function hideResumeTooltip() {
    markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
  }

  function removeClipBoundary(id: string) {
    markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
    deps.clips.removeClipBoundary(id);
  }

  return {
    addTimestamp,
    removeTimestamp,
    clearAllTimestamps,
    updateTimestampTitle,
    getTimestampById,
    getTimestampPct,
    saveTimestamps,
    setABLoop,
    clearABLoop,
    addLoopStart,
    addLoopEnd,
    clearLoopMarkers,
    startLoopMarkerDrag,
    startTimestampDrag,
    startClipMarkerDrag,
    seekToTimestamp,
    removeResumePoint,
    seekToResumePoint,
    showResumeTooltip,
    hideResumeTooltip,
    showTimestampTooltip,
    showLoopMarkerTooltip,
    showClipBoundaryTooltip,
    hideTsTooltip,
    updateTooltipDuringDrag,
    openTimestampEditor,
    openSegmentEditor,
    closeTimestampEditor,
    getActiveEditorTimestamp,
    getActiveEditorSegment,
    getEditorTitle,
    updateEditorTitle,
    onEditorScissor,
    onEditorDeleteTimestamp,
    onEditorDeleteSegment,
    getTitleEditorWidthCh,
    removeClipBoundary,
  };
}
