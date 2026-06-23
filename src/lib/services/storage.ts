// localStorage persistence
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
  return saved !== null ? parseFloat(saved) : 0.5;
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

export function loadSkipApplyConfirm(): boolean {
  return localStorage.getItem("vyu-edit-apply-no-warn") === "true";
}

export function saveSkipApplyConfirm(): void {
  localStorage.setItem("vyu-edit-apply-no-warn", "true");
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

const VALID_SORT_MODES = ["name", "date-modified", "size", "type"] as const;

export function loadSortMode(): "name" | "date-modified" | "size" | "type" {
  const v = localStorage.getItem("vyu-sort-mode");
  if (v && (VALID_SORT_MODES as readonly string[]).includes(v)) {
    return v as "name" | "date-modified" | "size" | "type";
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

// ── Audio layout ──
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

// ── Markup custom colors ──
export function loadMarkupCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("vyu-markup-custom-colors");
    if (!raw) return ["", "", ""];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed.map((c) => (typeof c === "string" ? c : ""));
    }
  } catch {
    /* empty */
  }
  return ["", "", ""];
}

export function saveMarkupCustomColors(colors: string[]): void {
  localStorage.setItem("vyu-markup-custom-colors", JSON.stringify(colors));
}

// ── Highlight custom colors ──
export function loadHighlightCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("vyu-highlight-custom-colors");
    if (!raw) return ["", "", "", "", "", ""];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 6) {
      return parsed.map((c) => (typeof c === "string" ? c : ""));
    }
  } catch {
    /* empty */
  }
  return ["", "", "", "", "", ""];
}

export function saveHighlightCustomColors(colors: string[]): void {
  localStorage.setItem("vyu-highlight-custom-colors", JSON.stringify(colors));
}

// ── Text custom colors ──
export function loadTextCustomColors(): string[] {
  try {
    const raw = localStorage.getItem("vyu-text-custom-colors");
    if (!raw) return [""];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 1) {
      return parsed.map((c) => (typeof c === "string" ? c : ""));
    }
  } catch {
    /* empty */
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

export function loadLastDialogSection(dialog: string): string {
  return localStorage.getItem(`vyu-${dialog}-last-section`) ?? "";
}

export function saveLastDialogSection(dialog: string, section: string): void {
  localStorage.setItem(`vyu-${dialog}-last-section`, section);
}

export function loadViewDensity(): number {
  const raw = localStorage.getItem("vyu-view-density");
  if (raw !== null) {
    const v = parseFloat(raw);
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  }
  return 0.5;
}

export function saveViewDensity(v: number): void {
  localStorage.setItem("vyu-view-density", String(Math.max(0, Math.min(1, v))));
}

export interface RecentFileItem {
  path: string;
  openedAt: number;
}

export function loadRecentFiles(limit = 20): RecentFileItem[] {
  const raw = localStorage.getItem("vyu-recent-files");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Migrate from string[] to RecentFileItem[]
      if (parsed.length > 0 && typeof parsed[0] === "string") {
        const now = Date.now();
        const migrated: RecentFileItem[] = parsed.map(
          (p: string, i: number) => ({
            path: p,
            openedAt: now - i * 1000,
          }),
        );
        saveRecentFiles(migrated, limit);
        return migrated.slice(0, limit);
      }
      return parsed.slice(0, limit);
    }
  } catch {
    // corrupted — clear
  }
  return [];
}

export function saveRecentFiles(items: RecentFileItem[], limit = 20): void {
  localStorage.setItem(
    "vyu-recent-files",
    JSON.stringify(items.slice(0, limit)),
  );
}

export function loadRecentFilesLimit(): number {
  const raw = localStorage.getItem("vyu-recent-files-limit");
  if (raw !== null) {
    const v = parseInt(raw, 10);
    if (v === 10 || v === 25 || v === 50 || v === 100) return v;
  }
  return 25;
}

export function saveRecentFilesLimit(limit: number): void {
  localStorage.setItem("vyu-recent-files-limit", String(limit));
}

export function loadRecentsDisabled(): boolean {
  return localStorage.getItem("vyu-recents-disabled") === "true";
}

export function saveRecentsDisabled(disabled: boolean): void {
  localStorage.setItem("vyu-recents-disabled", String(disabled));
}

export function loadShowFolders(): boolean {
  const v = localStorage.getItem("vyu-show-folders");
  if (v === null) return true;
  return v === "true";
}

export function loadDividersOn(): boolean {
  return localStorage.getItem("vyu-dividers-on") === "true";
}

export function saveDividersOn(enabled: boolean): void {
  localStorage.setItem("vyu-dividers-on", String(enabled));
}

export function loadNamesOn(): boolean {
  return localStorage.getItem("vyu-names-on") === "true";
}

export function saveNamesOn(enabled: boolean): void {
  localStorage.setItem("vyu-names-on", String(enabled));
}

export function saveShowFolders(enabled: boolean): void {
  localStorage.setItem("vyu-show-folders", String(enabled));
}

export function loadShowThumbnails(): boolean {
  const v = localStorage.getItem("vyu-show-thumbnails");
  if (v === null) return true;
  return v === "true";
}

export function saveShowThumbnails(enabled: boolean): void {
  localStorage.setItem("vyu-show-thumbnails", String(enabled));
}

// ── Collections ──

export interface CollectionItem {
  name: string;
  path: string;
  type?: "linked" | "custom";
  createdAt?: number;
  thumbnailPath?: string;
}

export function loadCollections(): CollectionItem[] {
  const raw = localStorage.getItem("vyu-collections");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter(
      (c: unknown): c is CollectionItem =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).name === "string" &&
        typeof (c as Record<string, unknown>).path === "string",
    );
    return filtered.map((c, i) => ({
      name: c.name,
      path: c.path,
      type: c.type ?? ("linked" as const),
      createdAt: c.createdAt ?? Date.now() - (filtered.length - 1 - i) * 1000,
      thumbnailPath: c.thumbnailPath,
    }));
  } catch {
    return [];
  }
}

export function saveCollections(items: CollectionItem[]): void {
  localStorage.setItem("vyu-collections", JSON.stringify(items));
}

// ── Favorites ──

export interface FavoriteItem {
  path: string;
  favoritedAt: number;
}

export function loadFavorites(): FavoriteItem[] {
  const raw = localStorage.getItem("vyu-favorites");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate from string[] to FavoriteItem[]
    if (parsed.length > 0 && typeof parsed[0] === "string") {
      const now = Date.now();
      return parsed.map((p: string, i: number) => ({
        path: p,
        favoritedAt: now - i * 1000,
      }));
    }
    return parsed.filter(
      (f: unknown): f is FavoriteItem =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).path === "string" &&
        typeof (f as Record<string, unknown>).favoritedAt === "number",
    );
  } catch {
    return [];
  }
}

export function saveFavorites(items: FavoriteItem[]): void {
  localStorage.setItem("vyu-favorites", JSON.stringify(items));
}
