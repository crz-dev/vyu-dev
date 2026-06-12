import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
import type { LoopMode } from "$lib/shared/constants";

const MAX_STALE_ENTRIES = 500;

export interface EqSettings {
  bands: number[];
  bypass: boolean;
  outputGain: number;
  activePreset: string;
}

export function cleanupStaleStorageEntries(): void {
  const tsKeys: string[] = [];
  const clipKeys: string[] = [];
  const resumeKeys: string[] = [];
  const cdColorKeys: string[] = [];
  const eqKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("vyu-ts-")) tsKeys.push(key);
    else if (key.startsWith("vyu-clips-")) clipKeys.push(key);
    else if (key.startsWith("vyu-resume-")) resumeKeys.push(key);
    else if (key.startsWith("vyu-cd-color-")) cdColorKeys.push(key);
    else if (key.startsWith("vyu-eq-")) eqKeys.push(key);
  }
  for (const keys of [tsKeys, clipKeys, resumeKeys, cdColorKeys, eqKeys]) {
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

export function loadPlaybackSpeed(): number {
  const saved = localStorage.getItem("vyu-speed");
  return saved !== null ? parseFloat(saved) : 1;
}

export function savePlaybackSpeed(speed: number): void {
  localStorage.setItem("vyu-speed", String(speed));
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

export function loadGlow(): number {
  const v = localStorage.getItem("vyu-glow");
  if (v === "1" || v === "2" || v === "3") return Number(v);
  return 0;
}

export function saveGlow(v: number): void {
  localStorage.setItem("vyu-glow", String(v));
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

const VALID_SORT_MODES = [
  "name",
  "date-modified",
  "date-created",
  "size",
  "type",
] as const;

export function loadSortMode():
  | "name"
  | "date-modified"
  | "date-created"
  | "size"
  | "type" {
  const v = localStorage.getItem("vyu-sort-mode");
  if (v && (VALID_SORT_MODES as readonly string[]).includes(v)) {
    return v as "name" | "date-modified" | "date-created" | "size" | "type";
  }
  return "name";
}

export function saveSortMode(mode: string): void {
  localStorage.setItem("vyu-sort-mode", mode);
}

export function loadSortDesc(): boolean {
  return localStorage.getItem("vyu-sort-desc") === "true";
}

export function saveSortDesc(desc: boolean): void {
  localStorage.setItem("vyu-sort-desc", desc ? "true" : "false");
}

// Audio customize
export type AudioLayoutMode = "retro" | "modern";

export function loadAudioLayoutMode(): AudioLayoutMode {
  const v = localStorage.getItem("vyu-audio-layout-mode");
  if (v === "retro" || v === "modern") return v;
  return "retro";
}

export function saveAudioLayoutMode(mode: AudioLayoutMode): void {
  localStorage.setItem("vyu-audio-layout-mode", mode);
}

export function loadShareOutputDir(): string {
  return localStorage.getItem("vyu-share-output-dir") ?? "";
}

export function saveShareOutputDir(dir: string): void {
  localStorage.setItem("vyu-share-output-dir", dir);
}

// Markup custom draw colors
export function loadMarkupCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("vyu-markup-custom-colors");
    if (!raw) return ["", "", ""];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed.map((c) => (typeof c === "string" ? c : ""));
    }
  } catch {
    /* ignore */
  }
  return ["", "", ""];
}

export function saveMarkupCustomColors(colors: string[]): void {
  localStorage.setItem("vyu-markup-custom-colors", JSON.stringify(colors));
}

// Highlight custom colors
export function loadHighlightCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("vyu-highlight-custom-colors");
    if (!raw) return ["", "", "", "", "", ""];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 6) {
      return parsed.map((c) => (typeof c === "string" ? c : ""));
    }
  } catch {
    /* ignore */
  }
  return ["", "", "", "", "", ""];
}

export function saveHighlightCustomColors(colors: string[]): void {
  localStorage.setItem("vyu-highlight-custom-colors", JSON.stringify(colors));
}

// Text custom colors
export function loadTextCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("vyu-text-custom-colors");
    if (!raw) return [""];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 1) {
      return parsed.map((c) => (typeof c === "string" ? c : ""));
    }
  } catch {
    /* ignore */
  }
  return [""];
}

export function saveTextCustomColors(colors: string[]): void {
  localStorage.setItem("vyu-text-custom-colors", JSON.stringify(colors));
}

export function loadEqSettings(filePath: string): EqSettings | null {
  if (!filePath) return null;
  try {
    const raw = localStorage.getItem(`vyu-eq-${filePath}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EqSettings>;
    if (
      Array.isArray(parsed.bands) &&
      parsed.bands.length === 10 &&
      typeof parsed.bypass === "boolean" &&
      typeof parsed.outputGain === "number" &&
      typeof parsed.activePreset === "string"
    ) {
      return parsed as EqSettings;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveEqSettings(filePath: string, settings: EqSettings): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-eq-${filePath}`, JSON.stringify(settings));
}

export function deleteEqSettings(filePath: string): void {
  if (filePath) localStorage.removeItem(`vyu-eq-${filePath}`);
}
