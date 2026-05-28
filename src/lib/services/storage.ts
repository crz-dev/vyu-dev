// DATAFLOW: readTimestamps/readClipBoundaries/loadResumePoint called by
// media.ts:displayFile (line 129-131) on every file load/navigation.
// Save variants called on state mutation (timestamps/clips) and beforeunload (resume).
import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
import type { LoopMode } from "$lib/shared/constants";

const MAX_STALE_ENTRIES = 500;

export function cleanupStaleStorageEntries(): void {
  const tsKeys: string[] = [];
  const clipKeys: string[] = [];
  const resumeKeys: string[] = [];
  const cdColorKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("vyu-ts-")) tsKeys.push(key);
    else if (key.startsWith("vyu-clips-")) clipKeys.push(key);
    else if (key.startsWith("vyu-resume-")) resumeKeys.push(key);
    else if (key.startsWith("vyu-cd-color-")) cdColorKeys.push(key);
  }
  for (const keys of [tsKeys, clipKeys, resumeKeys, cdColorKeys]) {
    if (keys.length > MAX_STALE_ENTRIES) {
      const toRemove = keys.slice(0, keys.length - MAX_STALE_ENTRIES);
      for (const k of toRemove) localStorage.removeItem(k);
    }
  }
}

export function loadVolume(): number {
  const saved = localStorage.getItem("vyu-volume");
  return saved !== null ? parseFloat(saved) : 1;
}

export function saveVolume(volume: number): void {
  localStorage.setItem("vyu-volume", String(volume));
}

export function loadSkipDeleteConfirmation(): boolean {
  return localStorage.getItem("vyu-delete-no-ask") === "true";
}

export function saveSkipDeleteConfirmation(): void {
  localStorage.setItem("vyu-delete-no-ask", "true");
}

export function loadClipPreferences(): {
  deleteOriginal: boolean;
  useCustomPath: boolean;
  mergeSegments: boolean;
  outputDir: string;
} {
  return {
    deleteOriginal: localStorage.getItem("vyu-clip-delete-original") === "true",
    useCustomPath: localStorage.getItem("vyu-clip-use-custom-path") === "true",
    mergeSegments: localStorage.getItem("vyu-clip-merge-segments") === "true",
    outputDir: localStorage.getItem("vyu-clip-output-dir") ?? "",
  };
}

export function saveClipPreferences(prefs: {
  deleteOriginal?: boolean;
  useCustomPath?: boolean;
  mergeSegments?: boolean;
  outputDir?: string;
}): void {
  if (prefs.deleteOriginal !== undefined)
    localStorage.setItem(
      "vyu-clip-delete-original",
      String(prefs.deleteOriginal),
    );
  if (prefs.useCustomPath !== undefined)
    localStorage.setItem(
      "vyu-clip-use-custom-path",
      String(prefs.useCustomPath),
    );
  if (prefs.mergeSegments !== undefined)
    localStorage.setItem(
      "vyu-clip-merge-segments",
      String(prefs.mergeSegments),
    );
  if (prefs.outputDir !== undefined)
    localStorage.setItem("vyu-clip-output-dir", prefs.outputDir);
}

export function readTimestamps(filePath: string): VideoMarker[] {
  if (!filePath) return [];
  try {
    const raw = localStorage.getItem(`vyu-ts-${filePath}`);
    const parsed = raw ? (JSON.parse(raw) as Array<Partial<VideoMarker>>) : [];
    return parsed
      .filter((ts) => typeof ts?.time === "number")
      .map((ts) => ({
        id:
          ts.id || `ts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: ts.time as number,
        title: typeof ts.title === "string" ? ts.title : "",
      }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export function writeTimestamps(
  filePath: string,
  timestamps: VideoMarker[],
): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-ts-${filePath}`, JSON.stringify(timestamps));
}

export function deleteTimestamps(filePath: string): void {
  if (filePath) localStorage.removeItem(`vyu-ts-${filePath}`);
}

export function readClipBoundaries(filePath: string): ClipBoundary[] {
  if (!filePath) return [];
  try {
    const raw = localStorage.getItem(`vyu-clips-${filePath}`);
    const parsed = raw ? (JSON.parse(raw) as Array<Partial<ClipBoundary>>) : [];
    return parsed
      .filter(
        (m) =>
          typeof m?.time === "number" &&
          (m.kind === "start" || m.kind === "end"),
      )
      .map((m) => ({
        id:
          m.id ||
          `${m.kind}-${m.time}-${Math.random().toString(36).slice(2, 8)}`,
        time: m.time as number,
        kind: m.kind as "start" | "end",
        title: typeof m.title === "string" ? m.title : "",
      }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export function writeClipBoundaries(
  filePath: string,
  boundaries: ClipBoundary[],
): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-clips-${filePath}`, JSON.stringify(boundaries));
}

export function deleteClipBoundaries(filePath: string): void {
  if (filePath) localStorage.removeItem(`vyu-clips-${filePath}`);
}

export function loadResumePoint(filePath: string): number | null {
  if (!filePath) return null;
  const raw = localStorage.getItem(`vyu-resume-${filePath}`);
  if (raw === null) return null;
  const val = parseFloat(raw);
  return isFinite(val) ? val : null;
}

export function saveResumePoint(filePath: string, time: number): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-resume-${filePath}`, String(time));
}

export function deleteResumePoint(filePath: string): void {
  if (!filePath) return;
  localStorage.removeItem(`vyu-resume-${filePath}`);
}

export function loadLoopMode(): LoopMode {
  return (localStorage.getItem("vyu-loop-mode") as LoopMode) ?? "loop";
}

export function saveLoopMode(mode: LoopMode): void {
  localStorage.setItem("vyu-loop-mode", mode);
}

export function loadTheme(): "dark" | "light" | "system" {
  const v = localStorage.getItem("vyu-theme");
  if (v === "light" || v === "system") return v;
  return "dark";
}

export function saveTheme(t: "dark" | "light" | "system"): void {
  localStorage.setItem("vyu-theme", t);
}

export function loadSliderMode(): { volume?: boolean; speed?: boolean } {
  try {
    const raw = localStorage.getItem("vyu-slider-mode");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSliderMode(mode: {
  volume?: boolean;
  speed?: boolean;
}): void {
  localStorage.setItem("vyu-slider-mode", JSON.stringify(mode));
}

export function loadFont(): "geist" | "satoshi" | "system" {
  const v = localStorage.getItem("vyu-font");
  if (v === "satoshi" || v === "system") return v;
  return "geist";
}

export function saveFont(f: "geist" | "satoshi" | "system"): void {
  localStorage.setItem("vyu-font", f);
}

export function loadCdColor(filePath: string): number {
  if (!filePath) return -1;
  const raw = localStorage.getItem(`vyu-cd-color-${filePath}`);
  if (raw === null) return -1;
  const val = parseInt(raw, 10);
  return Number.isFinite(val) ? val : -1;
}

export function saveCdColor(filePath: string, index: number): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-cd-color-${filePath}`, String(index));
}

export function deleteCdColor(filePath: string): void {
  if (filePath) localStorage.removeItem(`vyu-cd-color-${filePath}`);
}
