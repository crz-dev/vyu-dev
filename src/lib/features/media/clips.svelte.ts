import { open } from "@tauri-apps/plugin-dialog";
import type { ClipBoundary, ClipPair } from "$lib/shared/types";
import {
  writeClipBoundaries,
  deleteClipBoundaries,
  loadClipPreferences,
  saveClipPreferences,
} from "$lib/services/storage";
import { invokeProcessVideoClips } from "$lib/features/media/tools";

export interface ClipDeleteConfirmState {
  visible: boolean;
  mode: "separate" | "merge" | null;
}

export interface ClipToastState {
  visible: boolean;
  tone: "success" | "error";
  message: string;
  outputDir: string;
}

export interface ClipsDeps {
  getFilePath: () => string;
  getRawDurationSecs: () => number;
  getIsVideo: () => boolean;
  getVideoEl: () => HTMLVideoElement | null;
  getAudioEl: () => HTMLAudioElement | null;
  getFileParentFolder: () => string;
  ensureFfprobe: () => Promise<boolean>;
}

export function createClips(deps: ClipsDeps) {
  let clipBoundaries = $state<ClipBoundary[]>([]);
  let clipMarkerJustDragged = $state(false);
  let _saveTimer: ReturnType<typeof setTimeout> | undefined;

  let clipOutputDir = $state("");
  let clipDeleteOriginal = $state(false);
  let clipUseCustomPath = $state(false);
  let clipMergeSegments = $state(false);
  let clipJobRunning = $state(false);
  let clipJobLabel = $state("");
  let clipMenuResetKey = $state(0);
  let clipDeleteConfirm = $state<ClipDeleteConfirmState>({
    visible: false,
    mode: null,
  });
  let clipToast = $state<ClipToastState>({
    visible: false,
    tone: "success",
    message: "",
    outputDir: "",
  });
  let clipToastTimer: ReturnType<typeof setTimeout> | undefined;

  const clipPairs = $derived.by(() => computePairs(clipBoundaries));
  const clipCount = $derived(clipPairs.length);

  function _save() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      writeClipBoundaries(deps.getFilePath(), clipBoundaries);
    }, 300);
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

  function addClipBoundaryFromMedia(kind: "start" | "end") {
    const mediaEl = deps.getIsVideo()
      ? deps.getVideoEl()
      : deps.getAudioEl();
    const duration = deps.getRawDurationSecs();
    if (!mediaEl || duration <= 0) return;
    addClipBoundary(
      kind,
      Math.max(0, Math.min(mediaEl.currentTime, duration)),
    );
  }

  function removeClipBoundary(id: string) {
    clipBoundaries = clipBoundaries.filter((b) => b.id !== id);
    _save();
  }

  function clearBoundaries() {
    clipBoundaries = [];
    deleteClipBoundaries(deps.getFilePath());
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

  function setBoundaryTime(id: string, time: number) {
    clipBoundaries = clipBoundaries
      .map((m) => (m.id === id ? { ...m, time } : m))
      .sort((a, b) => a.time - b.time);
    _save();
  }

  function setBoundaryKind(id: string, kind: "start" | "end") {
    clipBoundaries = clipBoundaries
      .map((m) => (m.id === id ? { ...m, kind } : m))
      .sort((a, b) => a.time - b.time);
    _save();
  }

  function findTouchTarget(time: number, tolerance = 0.6): ClipBoundary | null {
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

  function loadPrefs() {
    const prefs = loadClipPreferences();
    clipOutputDir = prefs.outputDir;
    clipDeleteOriginal = prefs.deleteOriginal;
    clipUseCustomPath = prefs.useCustomPath;
    clipMergeSegments = prefs.mergeSegments;
  }

  function persistPrefs() {
    saveClipPreferences({
      deleteOriginal: clipDeleteOriginal,
      useCustomPath: clipUseCustomPath,
      mergeSegments: clipMergeSegments,
    });
  }

  function getTargetDir(): string {
    return clipUseCustomPath
      ? clipOutputDir || deps.getFileParentFolder()
      : deps.getFileParentFolder();
  }

  function showClipToast(
    message: string,
    tone: "success" | "error",
    outputDir: string = clipOutputDir || deps.getFileParentFolder(),
  ) {
    clearTimeout(clipToastTimer);
    clipToast = { visible: true, tone, message, outputDir };
    clipToastTimer = setTimeout(() => {
      clipToast = { ...clipToast, visible: false };
    }, 4200);
  }

  function sanitizeClipPairs(): { start: number; end: number }[] {
    return clipPairs.map((p) => ({ start: p.start, end: p.end }));
  }

  function extractInvokeErrorMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === "string" && e.trim()) return e;
    if (e && typeof e === "object") {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return "Unknown error";
    }
  }

  async function togglePathSelection() {
    const dir = await open({ directory: true });
    if (dir) {
      clipOutputDir = dir as string;
    }
  }

  function toggleDeleteOriginal() {
    clipDeleteOriginal = !clipDeleteOriginal;
    persistPrefs();
  }

  function toggleMergeSegments() {
    clipMergeSegments = !clipMergeSegments;
    persistPrefs();
  }

  async function triggerSegments() {
    const ready = await deps.ensureFfprobe();
    if (!ready) return;

    const segments = sanitizeClipPairs();
    if (segments.length === 0) {
      showClipToast(
        "No clip segments defined. Add clip markers first.",
        "error",
      );
      return;
    }

    const mode = clipMergeSegments ? "merge" : "separate";
    clipJobRunning = true;
    clipJobLabel = `Clipping ${segments.length} segment${segments.length > 1 ? "s" : ""}...`;

    try {
      const result = await invokeProcessVideoClips(
        deps.getFilePath(),
        getTargetDir(),
        segments,
        mode,
        clipDeleteOriginal,
      );
      showClipToast(
        `${result.outputs.length} clip${result.outputs.length > 1 ? "s" : ""} saved`,
        "success",
        result.output_dir,
      );
    } catch (err) {
      showClipToast(extractInvokeErrorMessage(err), "error");
    } finally {
      clipJobRunning = false;
      clipJobLabel = "";
    }
  }

  async function runClipAction(_mode: "separate" | "merge") {
    // planned feature — not yet implemented
  }

  return {
    get clipBoundaries() {
      return clipBoundaries;
    },
    get clipPairs() {
      return clipPairs;
    },
    get clipCount() {
      return clipCount;
    },
    get clipMarkerJustDragged() {
      return clipMarkerJustDragged;
    },
    set clipMarkerJustDragged(v: boolean) {
      clipMarkerJustDragged = v;
    },
    get clipOutputDir() {
      return clipOutputDir;
    },
    set clipOutputDir(v: string) {
      clipOutputDir = v;
    },
    get clipDeleteOriginal() {
      return clipDeleteOriginal;
    },
    set clipDeleteOriginal(v: boolean) {
      clipDeleteOriginal = v;
    },
    get clipUseCustomPath() {
      return clipUseCustomPath;
    },
    set clipUseCustomPath(v: boolean) {
      clipUseCustomPath = v;
    },
    get clipMergeSegments() {
      return clipMergeSegments;
    },
    set clipMergeSegments(v: boolean) {
      clipMergeSegments = v;
    },
    get clipJobRunning() {
      return clipJobRunning;
    },
    get clipJobLabel() {
      return clipJobLabel;
    },
    get clipMenuResetKey() {
      return clipMenuResetKey;
    },
    bumpMenuResetKey() {
      clipMenuResetKey++;
    },
    get clipDeleteConfirm() {
      return clipDeleteConfirm;
    },
    get clipToast() {
      return clipToast;
    },
    setBoundaries,
    addClipBoundary,
    addClipBoundaryFromMedia,
    removeClipBoundary,
    clearBoundaries,
    updateBoundaryTitle,
    getBoundaryById,
    setBoundaryTime,
    setBoundaryKind,
    findTouchTarget,
    loadPrefs,
    persistPrefs,
    getTargetDir,
    showClipToast,
    sanitizeClipPairs,
    extractInvokeErrorMessage,
    togglePathSelection,
    toggleDeleteOriginal,
    toggleMergeSegments,
    triggerSegments,
    runClipAction,
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
