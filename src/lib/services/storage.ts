import type { VideoMarker, ClipBoundary, CropBounds } from "$lib/shared/types";
import {
  SORT_MODES,
  type LoopMode,
  type SortMode,
} from "$lib/shared/constants";
import { replacePathPrefix } from "$lib/services/files";

const MAX_STALE_ENTRIES = 500;
const PER_FILE_PREFIXES = [
  "vyu-ts-",
  "vyu-clips-",
  "vyu-resume-",
  "vyu-eq-",
  "vyu-cd-color-",
] as const;

export function migrateFilePathStorage(oldPath: string, newPath: string): void {
  if (!oldPath || !newPath || oldPath === newPath) return;
  for (const prefix of PER_FILE_PREFIXES) {
    const oldKey = `${prefix}${oldPath}`;
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      localStorage.setItem(`${prefix}${newPath}`, value);
      localStorage.removeItem(oldKey);
    }
  }
}

export function migrateFolderPathStorage(
  oldFolder: string,
  newFolder: string,
): void {
  if (!oldFolder || !newFolder || oldFolder === newFolder) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    const prefix = PER_FILE_PREFIXES.find((p) => key.startsWith(p));
    if (!prefix) continue;
    const path = key.slice(prefix.length);
    const next = replacePathPrefix(path, oldFolder, newFolder);
    if (!next) continue;
    const value = localStorage.getItem(key);
    if (value === null) continue;
    localStorage.setItem(`${prefix}${next}`, value);
    localStorage.removeItem(key);
  }
}

export interface EqSettings {
  bands: number[];
  bypass: boolean;
  outputGain: number;
  activePreset: string;
}

export type EditExportQuality = "fast" | "balanced" | "quality" | "lossless";
export type EditImageFormat = "original" | "png" | "jpg" | "webp";
export type EditImageQualityKey = "original" | "jpg" | "webp";
export type EditVideoFormat = "original" | "mp4" | "webm" | "mkv";
export type ProcessQuality = "fast" | "balanced" | "quality" | "lossless";
export type CoverArtMode = "cover" | "waveform";
export type HardwareEncoder = "auto" | "h264_nvenc" | "h264_qsv" | "h264_amf";
export type EditBackupMode = "off" | "ask" | "always";
export type EditMediaKind = "image" | "video";

export interface PersistedEditSnapshot {
  rotation: number;
  flipped: boolean;
  flippedVertical: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  cropBounds: CropBounds;
  cropAspectRatio: number | null;
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

export function saveSkipDeleteConfirmation(enabled = true): void {
  localStorage.setItem("vyu-delete-no-ask", String(enabled));
}

// ── Editor ──
export function loadSkipApplyConfirm(): boolean {
  return localStorage.getItem("vyu-edit-apply-no-warn") === "true";
}

export function saveSkipApplyConfirm(skip: boolean): void {
  localStorage.setItem("vyu-edit-apply-no-warn", String(skip));
}

export function loadEditExportQuality(): EditExportQuality {
  const value = localStorage.getItem("vyu-edit-export-quality");
  if (
    value === "fast" ||
    value === "balanced" ||
    value === "quality" ||
    value === "lossless"
  ) {
    return value;
  }
  return "balanced";
}

export function saveEditExportQuality(quality: EditExportQuality): void {
  localStorage.setItem("vyu-edit-export-quality", quality);
}

function editMediaKey(base: string, kind: EditMediaKind): string {
  return `vyu-edit-${kind}-${base}`;
}

export function loadEditOutputDir(kind: EditMediaKind): string {
  return (
    localStorage.getItem(editMediaKey("output-dir", kind)) ??
    localStorage.getItem("vyu-edit-output-dir") ??
    ""
  );
}

export function saveEditOutputDir(kind: EditMediaKind, dir: string): void {
  const key = editMediaKey("output-dir", kind);
  if (dir) localStorage.setItem(key, dir);
  else localStorage.removeItem(key);
}

export function loadEditImageFormat(): EditImageFormat {
  const value = localStorage.getItem("vyu-edit-image-format");
  if (value === "png" || value === "jpg" || value === "webp") return value;
  return "original";
}

export function saveEditImageFormat(format: EditImageFormat): void {
  localStorage.setItem("vyu-edit-image-format", format);
}

export function loadEditVideoFormat(): EditVideoFormat {
  const value = localStorage.getItem("vyu-edit-video-format");
  if (value === "mp4" || value === "webm" || value === "mkv") return value;
  return "original";
}

export function saveEditVideoFormat(format: EditVideoFormat): void {
  localStorage.setItem("vyu-edit-video-format", format);
}

function imageQualityMaxForStorage(format: EditImageQualityKey): number {
  return format === "jpg" ? 95 : 100;
}

function clampImageQuality(value: number, max: number): number {
  return Math.min(max, Math.max(60, Math.round(value)));
}

export function loadEditImageQuality(format: EditImageQualityKey): number {
  const max = imageQualityMaxForStorage(format);
  const stored = localStorage.getItem(`vyu-edit-image-quality-${format}`);
  if (stored !== null) {
    const value = Number(stored);
    return Number.isFinite(value) ? clampImageQuality(value, max) : max;
  }
  const legacy = localStorage.getItem("vyu-edit-image-quality");
  if (legacy !== null) {
    const value = Number(legacy);
    return Number.isFinite(value) ? clampImageQuality(value, max) : max;
  }
  return max;
}

export function saveEditImageQuality(
  format: EditImageQualityKey,
  quality: number,
): void {
  localStorage.setItem(
    `vyu-edit-image-quality-${format}`,
    String(clampImageQuality(quality, imageQualityMaxForStorage(format))),
  );
}

export function loadEditKeepDate(kind: EditMediaKind): boolean {
  const value = localStorage.getItem(editMediaKey("keep-date", kind));
  if (value !== null) return value !== "false";
  return localStorage.getItem("vyu-edit-keep-date") !== "false";
}

export function saveEditKeepDate(kind: EditMediaKind, enabled: boolean): void {
  localStorage.setItem(editMediaKey("keep-date", kind), String(enabled));
}

export function loadEditAutoOpenExport(kind: EditMediaKind): boolean {
  const value = localStorage.getItem(editMediaKey("auto-open-export", kind));
  if (value !== null) return value === "true";
  return localStorage.getItem("vyu-edit-auto-open-export") === "true";
}

export function saveEditAutoOpenExport(
  kind: EditMediaKind,
  enabled: boolean,
): void {
  localStorage.setItem(editMediaKey("auto-open-export", kind), String(enabled));
}

export function loadEditCompareEnabled(): boolean {
  return localStorage.getItem("vyu-edit-compare-enabled") !== "false";
}

export function saveEditCompareEnabled(enabled: boolean): void {
  localStorage.setItem("vyu-edit-compare-enabled", String(enabled));
}

export function loadEditRememberSession(): boolean {
  const value = localStorage.getItem("vyu-edit-remember-session");
  if (value !== null) return value !== "false";
  const image = localStorage.getItem("vyu-edit-image-remember-session");
  const video = localStorage.getItem("vyu-edit-video-remember-session");
  const legacy = [image, video].filter((v): v is string => v !== null);
  if (legacy.length > 0) return legacy.some((v) => v !== "false");
  return true;
}

export function saveEditRememberSession(enabled: boolean): void {
  localStorage.setItem("vyu-edit-remember-session", String(enabled));
  localStorage.removeItem("vyu-edit-image-remember-session");
  localStorage.removeItem("vyu-edit-video-remember-session");
}

function isPersistedEditSnapshot(
  value: unknown,
): value is PersistedEditSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const bounds = v.cropBounds as Record<string, unknown> | null;
  return (
    typeof v.rotation === "number" &&
    typeof v.flipped === "boolean" &&
    typeof v.flippedVertical === "boolean" &&
    typeof v.brightness === "number" &&
    typeof v.contrast === "number" &&
    typeof v.saturation === "number" &&
    typeof v.hue === "number" &&
    !!bounds &&
    typeof bounds.left === "number" &&
    typeof bounds.top === "number" &&
    typeof bounds.right === "number" &&
    typeof bounds.bottom === "number" &&
    (v.cropAspectRatio === null || typeof v.cropAspectRatio === "number")
  );
}

export function loadEditSession(): Record<string, PersistedEditSnapshot> {
  const raw = localStorage.getItem("vyu-edit-session");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const session: Record<string, PersistedEditSnapshot> = {};
    for (const [path, snapshot] of Object.entries(parsed)) {
      if (isPersistedEditSnapshot(snapshot)) session[path] = snapshot;
    }
    return session;
  } catch {
    return {};
  }
}

export function saveEditSession(
  session: Record<string, PersistedEditSnapshot>,
): void {
  try {
    localStorage.setItem("vyu-edit-session", JSON.stringify(session));
  } catch (e) {
    console.error("Failed to save edit session:", e);
  }
}

export function clearEditSession(): void {
  localStorage.removeItem("vyu-edit-session");
}

export function loadEditBackupMode(): EditBackupMode {
  const value = localStorage.getItem("vyu-edit-backup-mode");
  if (value === "off" || value === "ask" || value === "always") return value;
  return localStorage.getItem("vyu-edit-backups") === "true" ? "always" : "off";
}

export function saveEditBackupMode(mode: EditBackupMode): void {
  localStorage.setItem("vyu-edit-backup-mode", mode);
}

export function loadEditBackupDir(): string {
  return localStorage.getItem("vyu-edit-backup-dir") ?? "";
}

export function saveEditBackupDir(dir: string): void {
  if (dir) localStorage.setItem("vyu-edit-backup-dir", dir);
  else localStorage.removeItem("vyu-edit-backup-dir");
}

export function loadClipPreferences(): {
  deleteOriginal: boolean;
  mergeSegments: boolean;
} {
  return {
    deleteOriginal: localStorage.getItem("vyu-clip-delete-original") === "true",
    mergeSegments: localStorage.getItem("vyu-clip-merge-segments") === "true",
  };
}

export function saveClipPreferences(prefs: {
  deleteOriginal?: boolean;
  mergeSegments?: boolean;
}): void {
  if (prefs.deleteOriginal !== undefined)
    localStorage.setItem(
      "vyu-clip-delete-original",
      String(prefs.deleteOriginal),
    );
  if (prefs.mergeSegments !== undefined)
    localStorage.setItem(
      "vyu-clip-merge-segments",
      String(prefs.mergeSegments),
    );
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

// ── Appearance ──
export type DisplayDensity = "comfortable" | "compact";
export type DarkVariant = "standard" | "oled";
export type ViewerBackground = "theme" | "black" | "gray";

const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 2.25;

export function loadUiScale(): number {
  const raw = localStorage.getItem("vyu-ui-scale");
  if (raw === null) return 1;
  const v = Number(raw);
  if (!Number.isFinite(v)) return 1;
  return Math.min(
    UI_SCALE_MAX,
    Math.max(UI_SCALE_MIN, Math.round(v * 100) / 100),
  );
}

export function saveUiScale(scale: number): void {
  localStorage.setItem("vyu-ui-scale", String(scale));
}

export function loadDensity(): DisplayDensity {
  return localStorage.getItem("vyu-density") === "compact"
    ? "compact"
    : "comfortable";
}

export function saveDensity(density: DisplayDensity): void {
  localStorage.setItem("vyu-density", density);
}

export function loadReducedMotion(): boolean {
  return localStorage.getItem("vyu-reduced-motion") === "true";
}

export function saveReducedMotion(enabled: boolean): void {
  localStorage.setItem("vyu-reduced-motion", enabled ? "true" : "false");
}

export function loadCheckerboard(): boolean {
  return localStorage.getItem("vyu-checkerboard") === "true";
}

export function saveCheckerboard(enabled: boolean): void {
  localStorage.setItem("vyu-checkerboard", enabled ? "true" : "false");
}

export function loadDarkVariant(): DarkVariant {
  return localStorage.getItem("vyu-dark-variant") === "oled"
    ? "oled"
    : "standard";
}

export function saveDarkVariant(variant: DarkVariant): void {
  localStorage.setItem("vyu-dark-variant", variant);
}

export function loadShowTooltips(): boolean {
  return localStorage.getItem("vyu-show-tooltips") !== "false";
}

export function saveShowTooltips(enabled: boolean): void {
  localStorage.setItem("vyu-show-tooltips", String(enabled));
}

export function loadCursorAutoHide(): boolean {
  return localStorage.getItem("vyu-cursor-auto-hide") !== "false";
}

export function saveCursorAutoHide(enabled: boolean): void {
  localStorage.setItem("vyu-cursor-auto-hide", String(enabled));
}

export function loadHighContrast(): boolean {
  return localStorage.getItem("vyu-high-contrast") === "true";
}

export function saveHighContrast(enabled: boolean): void {
  localStorage.setItem("vyu-high-contrast", String(enabled));
}

export function loadRememberLastTab(): boolean {
  return localStorage.getItem("vyu-remember-last-tab") !== "false";
}

export function saveRememberLastTab(enabled: boolean): void {
  localStorage.setItem("vyu-remember-last-tab", String(enabled));
}

export function loadHideDangerZone(): boolean {
  return localStorage.getItem("vyu-hide-danger-zone") === "true";
}

export function saveHideDangerZone(enabled: boolean): void {
  localStorage.setItem("vyu-hide-danger-zone", String(enabled));
}

export function loadViewerBackground(): ViewerBackground {
  const value = localStorage.getItem("vyu-viewer-background");
  if (value === "black" || value === "gray") return value;
  return "theme";
}

export function saveViewerBackground(background: ViewerBackground): void {
  localStorage.setItem("vyu-viewer-background", background);
}

// ── Playback ──
export type ResumeMode = "off" | "ask" | "always";

export function loadResumeMode(): ResumeMode {
  const v = localStorage.getItem("vyu-resume-mode");
  if (v === "off" || v === "always") return v;
  return "ask";
}

export function saveResumeMode(mode: ResumeMode): void {
  localStorage.setItem("vyu-resume-mode", mode);
}

export function loadResumeThreshold(): number {
  const raw = localStorage.getItem("vyu-resume-threshold");
  if (raw === null) return 30;
  const v = Number(raw);
  if (!Number.isFinite(v)) return 30;
  const snapped = Math.round(v / 30) * 30;
  return Math.min(900, Math.max(0, snapped));
}

export function saveResumeThreshold(seconds: number): void {
  localStorage.setItem("vyu-resume-threshold", String(seconds));
}

export function loadAutoplay(): boolean {
  return localStorage.getItem("vyu-autoplay") !== "false";
}

export function saveAutoplay(enabled: boolean): void {
  localStorage.setItem("vyu-autoplay", enabled ? "true" : "false");
}

export function loadRememberSpeed(): boolean {
  return localStorage.getItem("vyu-remember-speed") !== "false";
}

export function saveRememberSpeed(enabled: boolean): void {
  localStorage.setItem("vyu-remember-speed", enabled ? "true" : "false");
}

export function loadRememberVolume(): boolean {
  return localStorage.getItem("vyu-remember-volume") !== "false";
}

export function saveRememberVolume(enabled: boolean): void {
  localStorage.setItem("vyu-remember-volume", enabled ? "true" : "false");
}

export function loadDefaultSpeed(): number {
  const raw = localStorage.getItem("vyu-default-speed");
  if (raw === null) return 1;
  const v = Number(raw);
  if (!Number.isFinite(v)) return 1;
  return Math.min(3, Math.max(0.1, Math.round(v / 0.05) * 0.05));
}

export function saveDefaultSpeed(speed: number): void {
  localStorage.setItem("vyu-default-speed", String(speed));
}

export function loadDefaultVolume(): number {
  const raw = localStorage.getItem("vyu-default-volume");
  if (raw === null) return 0.5;
  const v = Number(raw);
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(v * 100) / 100));
}

export function saveDefaultVolume(volume: number): void {
  localStorage.setItem("vyu-default-volume", String(volume));
}

export function loadVolumeBoost(): boolean {
  return localStorage.getItem("vyu-volume-boost") === "true";
}

export function saveVolumeBoost(enabled: boolean): void {
  localStorage.setItem("vyu-volume-boost", enabled ? "true" : "false");
}

export function loadSeekStep(): number {
  const raw = localStorage.getItem("vyu-seek-step");
  if (raw === null) return 5;
  const v = Number(raw);
  if (!Number.isFinite(v)) return 5;
  return Math.min(60, Math.max(1, Math.round(v)));
}

export function saveSeekStep(seconds: number): void {
  localStorage.setItem("vyu-seek-step", String(seconds));
}

export function loadRelativeSeek(): boolean {
  return localStorage.getItem("vyu-relative-seek") === "true";
}

export function saveRelativeSeek(enabled: boolean): void {
  localStorage.setItem("vyu-relative-seek", String(enabled));
}

export function loadRelativeSeekStep(): number {
  const raw = localStorage.getItem("vyu-relative-seek-step");
  if (raw === null) return 5;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 5;
  return Math.min(100, Math.max(1, Math.round(value)));
}

export function saveRelativeSeekStep(percent: number): void {
  localStorage.setItem("vyu-relative-seek-step", String(percent));
}

export function loadKeepAudio(): boolean {
  return localStorage.getItem("vyu-keep-audio") === "true";
}

export function saveKeepAudio(enabled: boolean): void {
  localStorage.setItem("vyu-keep-audio", enabled ? "true" : "false");
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

const VALID_SORT_MODES = new Set<string>(SORT_MODES.map((mode) => mode.value));

export function loadSortMode(): SortMode {
  const v = localStorage.getItem("vyu-sort-mode");
  if (v && VALID_SORT_MODES.has(v)) {
    return v as SortMode;
  }
  return "name";
}

export function saveSortMode(mode: SortMode): void {
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

// ── Process / conversion ──
export function loadProcessQuality(): ProcessQuality {
  const value = localStorage.getItem("vyu-process-quality");
  if (
    value === "fast" ||
    value === "balanced" ||
    value === "quality" ||
    value === "lossless"
  ) {
    return value;
  }
  return "balanced";
}

export function saveProcessQuality(quality: ProcessQuality): void {
  localStorage.setItem("vyu-process-quality", quality);
}

export function loadProcessDeleteOriginal(): boolean {
  return localStorage.getItem("vyu-process-delete-original") === "true";
}

export function saveProcessDeleteOriginal(enabled: boolean): void {
  localStorage.setItem("vyu-process-delete-original", String(enabled));
}

export function loadProcessOutputDir(): string {
  return localStorage.getItem("vyu-process-output-dir") ?? "";
}

export function saveProcessOutputDir(dir: string): void {
  if (dir) localStorage.setItem("vyu-process-output-dir", dir);
  else localStorage.removeItem("vyu-process-output-dir");
}

export function loadProcessOpenOutputFolder(): boolean {
  return localStorage.getItem("vyu-process-open-output-folder") !== "false";
}

export function saveProcessOpenOutputFolder(enabled: boolean): void {
  localStorage.setItem("vyu-process-open-output-folder", String(enabled));
}

export function loadProcessKeepOriginalDate(): boolean {
  return localStorage.getItem("vyu-process-keep-original-date") !== "false";
}

export function saveProcessKeepOriginalDate(enabled: boolean): void {
  localStorage.setItem("vyu-process-keep-original-date", String(enabled));
}

export function loadProcessAudioBitrate(): number {
  const value = Number(localStorage.getItem("vyu-process-audio-bitrate"));
  return isAudioBitrate(value) ? value : 192;
}

export function saveProcessAudioBitrate(bitrate: number): void {
  const value = isAudioBitrate(bitrate) ? bitrate : 192;
  localStorage.setItem("vyu-process-audio-bitrate", String(value));
}

function isAudioBitrate(value: number): boolean {
  return (
    Number.isFinite(value) && value >= 64 && value <= 320 && value % 64 === 0
  );
}

export function loadProcessOverwrite(): boolean {
  return localStorage.getItem("vyu-process-overwrite") === "true";
}

export function saveProcessOverwrite(enabled: boolean): void {
  localStorage.setItem("vyu-process-overwrite", String(enabled));
}

export function loadProcessGpuEncoding(): boolean {
  return localStorage.getItem("vyu-process-gpu") === "true";
}

export function saveProcessGpuEncoding(enabled: boolean): void {
  localStorage.setItem("vyu-process-gpu", String(enabled));
}

export function loadProcessAutoOpen(): boolean {
  return localStorage.getItem("vyu-process-auto-open") === "true";
}

export function saveProcessAutoOpen(enabled: boolean): void {
  localStorage.setItem("vyu-process-auto-open", String(enabled));
}

export function loadProcessPreserveMetadata(): boolean {
  return localStorage.getItem("vyu-process-preserve-metadata") !== "false";
}

export function saveProcessPreserveMetadata(enabled: boolean): void {
  localStorage.setItem("vyu-process-preserve-metadata", String(enabled));
}

export function loadProcessCoverArtMode(): CoverArtMode {
  const value = localStorage.getItem("vyu-process-cover-art");
  return value === "waveform" ? "waveform" : "cover";
}

export function saveProcessCoverArtMode(mode: CoverArtMode): void {
  localStorage.setItem("vyu-process-cover-art", mode);
}

export function loadProcessHardwareEncoder(): HardwareEncoder {
  const value = localStorage.getItem("vyu-process-hardware-encoder");
  if (value === "h264_nvenc" || value === "h264_qsv" || value === "h264_amf") {
    return value;
  }
  return "auto";
}

export function saveProcessHardwareEncoder(encoder: HardwareEncoder): void {
  localStorage.setItem("vyu-process-hardware-encoder", encoder);
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
  } catch (e) {
    console.error("Failed to load markup custom colors:", e);
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
  } catch (e) {
    console.error("Failed to load highlight custom colors:", e);
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
  } catch (e) {
    console.error("Failed to load text custom colors:", e);
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

export function loadViewMode(): "grid" | "list" | "river" | "filmstrip" {
  const raw = localStorage.getItem("vyu-view-mode");
  if (
    raw === "grid" ||
    raw === "list" ||
    raw === "river" ||
    raw === "filmstrip"
  )
    return raw;
  return "grid";
}

export function saveViewMode(v: string): void {
  localStorage.setItem("vyu-view-mode", v);
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

// ── Library display ──

export interface LibraryFileFilters {
  images: boolean;
  videos: boolean;
  audio: boolean;
  documents: boolean;
}

const DEFAULT_LIBRARY_FILE_FILTERS: LibraryFileFilters = {
  images: true,
  videos: true,
  audio: true,
  documents: true,
};

export function loadLibraryFileFilters(): LibraryFileFilters {
  const raw = localStorage.getItem("vyu-library-file-filters");
  if (!raw) return { ...DEFAULT_LIBRARY_FILE_FILTERS };
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof LibraryFileFilters, unknown>
    >;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_LIBRARY_FILE_FILTERS };
    }
    const filters: LibraryFileFilters = {
      images: parsed.images !== false,
      videos: parsed.videos !== false,
      audio: parsed.audio !== false,
      documents: parsed.documents !== false,
    };
    if (
      !filters.images &&
      !filters.videos &&
      !filters.audio &&
      !filters.documents
    ) {
      return { ...DEFAULT_LIBRARY_FILE_FILTERS };
    }
    return filters;
  } catch {
    return { ...DEFAULT_LIBRARY_FILE_FILTERS };
  }
}

export function saveLibraryFileFilters(filters: LibraryFileFilters): void {
  localStorage.setItem("vyu-library-file-filters", JSON.stringify(filters));
}

export function loadRecentRetentionDays(): number {
  const raw = localStorage.getItem("vyu-recent-retention-days");
  if (raw === "7" || raw === "30" || raw === "90") return Number(raw);
  return 0;
}

export function saveRecentRetentionDays(days: number): void {
  localStorage.setItem("vyu-recent-retention-days", String(days));
}

export function loadLibraryThumbnailSize(): number {
  const raw = localStorage.getItem("vyu-library-thumbnail-size");
  if (raw === "128" || raw === "256" || raw === "512") return Number(raw);
  return 256;
}

export function saveLibraryThumbnailSize(size: number): void {
  localStorage.setItem("vyu-library-thumbnail-size", String(size));
}

export function loadCollectionCovers(): boolean {
  const v = localStorage.getItem("vyu-collection-covers");
  if (v === null) return true;
  return v === "true";
}

export function saveCollectionCovers(enabled: boolean): void {
  localStorage.setItem("vyu-collection-covers", String(enabled));
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

// ── Privacy Mode ──

export function loadPrivacyMode(): boolean {
  return localStorage.getItem("vyu-privacy-mode") === "true";
}

export function savePrivacyMode(enabled: boolean): void {
  localStorage.setItem("vyu-privacy-mode", String(enabled));
}

export function loadPrivacyBlur(): number {
  const raw = localStorage.getItem("vyu-privacy-blur");
  if (raw !== null) {
    const v = Number(raw);
    if (Number.isFinite(v)) return Math.max(4, Math.min(32, v));
  }
  return 12;
}

export function savePrivacyBlur(px: number): void {
  localStorage.setItem("vyu-privacy-blur", String(px));
}

export function loadPrivacyHideNames(): boolean {
  return localStorage.getItem("vyu-privacy-hide-names") === "true";
}

export function savePrivacyHideNames(enabled: boolean): void {
  localStorage.setItem("vyu-privacy-hide-names", String(enabled));
}

export function loadPrivacyRevealHover(): boolean {
  const v = localStorage.getItem("vyu-privacy-reveal-hover");
  if (v === null) return true;
  return v === "true";
}

export function savePrivacyRevealHover(enabled: boolean): void {
  localStorage.setItem("vyu-privacy-reveal-hover", String(enabled));
}

// ── Color Blind Mode ──

export type ColorBlindMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia";

export function loadColorBlindMode(): ColorBlindMode {
  const raw = localStorage.getItem("vyu-colorblind-mode");
  if (raw === "protanopia" || raw === "deuteranopia" || raw === "tritanopia") {
    return raw;
  }
  return "none";
}

export function saveColorBlindMode(mode: ColorBlindMode): void {
  localStorage.setItem("vyu-colorblind-mode", mode);
}

// ── System preferences ──

const SYSTEM_PREFIX = "vyu-system-";

export type StartupView = "last-file" | "library" | "empty";

function loadSystemBoolean(key: string, fallback: boolean): boolean {
  const value = localStorage.getItem(`${SYSTEM_PREFIX}${key}`);
  if (value === null) return fallback;
  return value === "true";
}

function saveSystemBoolean(key: string, value: boolean): void {
  localStorage.setItem(`${SYSTEM_PREFIX}${key}`, String(value));
}

export function loadStartupView(): StartupView {
  const value = localStorage.getItem(`${SYSTEM_PREFIX}startup-view`);
  if (value === "last-file" || value === "library" || value === "empty") {
    return value;
  }
  return loadReopenLastFile() ? "last-file" : "empty";
}

export function saveStartupView(view: StartupView): void {
  localStorage.setItem(`${SYSTEM_PREFIX}startup-view`, view);
}

export function loadCheckUpdatesOnLaunch(): boolean {
  return loadSystemBoolean("check-updates-on-launch", false);
}

export function saveCheckUpdatesOnLaunch(enabled: boolean): void {
  saveSystemBoolean("check-updates-on-launch", enabled);
}

export function loadConfirmCloseWhileEditing(): boolean {
  return loadSystemBoolean(
    "confirm-close-while-editing",
    loadSystemBoolean("confirm-close-while-playing", false),
  );
}

export function saveConfirmCloseWhileEditing(enabled: boolean): void {
  saveSystemBoolean("confirm-close-while-editing", enabled);
}

export function loadReopenLastFile(): boolean {
  return loadSystemBoolean("reopen-last-file", false);
}

export function loadAlwaysOnTop(): boolean {
  return loadSystemBoolean("always-on-top", false);
}

export function saveAlwaysOnTop(enabled: boolean): void {
  saveSystemBoolean("always-on-top", enabled);
}

export function loadKeepAwake(): boolean {
  return loadSystemBoolean("keep-awake", true);
}

export function saveKeepAwake(enabled: boolean): void {
  saveSystemBoolean("keep-awake", enabled);
}

export function loadPauseOnFocusLoss(): boolean {
  return loadSystemBoolean("pause-on-focus-loss", false);
}

export function savePauseOnFocusLoss(enabled: boolean): void {
  saveSystemBoolean("pause-on-focus-loss", enabled);
}

export function loadBatterySaverThumbnails(): boolean {
  return loadSystemBoolean("battery-saver-thumbnails", true);
}

export function saveBatterySaverThumbnails(enabled: boolean): void {
  saveSystemBoolean("battery-saver-thumbnails", enabled);
}

export function loadLastFile(): string {
  return localStorage.getItem("vyu-system-last-file") ?? "";
}

export function saveLastFile(path: string): void {
  if (path) localStorage.setItem("vyu-system-last-file", path);
  else localStorage.removeItem("vyu-system-last-file");
}

export function clearLastFile(): void {
  localStorage.removeItem("vyu-system-last-file");
}

export type ExternalAppKind = "vlc" | "spotify" | "paint";

export interface ExternalAppPaths {
  vlc: string;
  spotify: string;
  paint: string;
}

export function loadExternalAppPaths(): ExternalAppPaths {
  return {
    vlc: localStorage.getItem("vyu-system-vlc-path") ?? "",
    spotify: localStorage.getItem("vyu-system-spotify-path") ?? "",
    paint: localStorage.getItem("vyu-system-paint-path") ?? "",
  };
}

export function saveExternalAppPath(kind: ExternalAppKind, path: string): void {
  const key = `vyu-system-${kind}-path`;
  if (path) localStorage.setItem(key, path);
  else localStorage.removeItem(key);
}

// ── Keybinds ──

export function loadKeybinds(): unknown {
  const raw = localStorage.getItem("vyu-keybinds");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveKeybinds(config: unknown): void {
  localStorage.setItem("vyu-keybinds", JSON.stringify(config));
}

// ── Debug ──

export function loadDebugOverlay(): boolean {
  return localStorage.getItem("vyu-debug-overlay") === "true";
}

export function saveDebugOverlay(enabled: boolean): void {
  localStorage.setItem("vyu-debug-overlay", String(enabled));
}

// ── Accessibility ──

function loadA11yBoolean(key: string, fallback = false): boolean {
  const value = localStorage.getItem(`vyu-a11y-${key}`);
  if (value === null) return fallback;
  return value === "true";
}

function saveA11yBoolean(key: string, value: boolean): void {
  localStorage.setItem(`vyu-a11y-${key}`, String(value));
}

export function loadA11yFocusRings(): boolean {
  return loadA11yBoolean("focus-rings");
}

export function saveA11yFocusRings(enabled: boolean): void {
  saveA11yBoolean("focus-rings", enabled);
}

export function loadA11yBoldText(): boolean {
  return loadA11yBoolean("bold-text");
}

export function saveA11yBoldText(enabled: boolean): void {
  saveA11yBoolean("bold-text", enabled);
}

export function loadA11yTextSpacing(): boolean {
  return loadA11yBoolean("text-spacing");
}

export function saveA11yTextSpacing(enabled: boolean): void {
  saveA11yBoolean("text-spacing", enabled);
}

export function loadA11yReduceTransparency(): boolean {
  return loadA11yBoolean("reduce-transparency");
}

export function saveA11yReduceTransparency(enabled: boolean): void {
  saveA11yBoolean("reduce-transparency", enabled);
}

export function loadA11yLargeControls(): boolean {
  return loadA11yBoolean("large-controls");
}

export function saveA11yLargeControls(enabled: boolean): void {
  saveA11yBoolean("large-controls", enabled);
}

export function loadA11yLargeTargets(): boolean {
  return loadA11yBoolean("large-targets");
}

export function saveA11yLargeTargets(enabled: boolean): void {
  saveA11yBoolean("large-targets", enabled);
}

export function loadA11yLargeTimeline(): boolean {
  return loadA11yBoolean("large-timeline");
}

export function saveA11yLargeTimeline(enabled: boolean): void {
  saveA11yBoolean("large-timeline", enabled);
}

export function loadA11yLargeScrollbars(): boolean {
  return loadA11yBoolean("large-scrollbars");
}

export function saveA11yLargeScrollbars(enabled: boolean): void {
  saveA11yBoolean("large-scrollbars", enabled);
}

export function loadA11yAlwaysShowControls(): boolean {
  return loadA11yBoolean("always-show-controls");
}

export function saveA11yAlwaysShowControls(enabled: boolean): void {
  saveA11yBoolean("always-show-controls", enabled);
}

export function loadA11yReducePanSensitivity(): boolean {
  return loadA11yBoolean("reduce-pan-sensitivity");
}

export function saveA11yReducePanSensitivity(enabled: boolean): void {
  saveA11yBoolean("reduce-pan-sensitivity", enabled);
}

export function loadA11yMonoAudio(): boolean {
  return loadA11yBoolean("mono-audio");
}

export function saveA11yMonoAudio(enabled: boolean): void {
  saveA11yBoolean("mono-audio", enabled);
}

export function loadA11yNormalizeVolume(): boolean {
  return loadA11yBoolean("normalize-volume");
}

export function saveA11yNormalizeVolume(enabled: boolean): void {
  saveA11yBoolean("normalize-volume", enabled);
}

export function loadA11yLimitPeaks(): boolean {
  return loadA11yBoolean("limit-peaks");
}

export function saveA11yLimitPeaks(enabled: boolean): void {
  saveA11yBoolean("limit-peaks", enabled);
}

export function loadA11yBoostDialogue(): boolean {
  return loadA11yBoolean("boost-dialogue");
}

export function saveA11yBoostDialogue(enabled: boolean): void {
  saveA11yBoolean("boost-dialogue", enabled);
}

export function loadA11yVisualAlerts(): boolean {
  return loadA11yBoolean("visual-alerts");
}

export function saveA11yVisualAlerts(enabled: boolean): void {
  saveA11yBoolean("visual-alerts", enabled);
}

export function loadA11yAudioCues(): boolean {
  return loadA11yBoolean("audio-cues");
}

export function saveA11yAudioCues(enabled: boolean): void {
  saveA11yBoolean("audio-cues", enabled);
}

export function loadA11yReduceDistractions(): boolean {
  return loadA11yBoolean("reduce-distractions");
}

export function saveA11yReduceDistractions(enabled: boolean): void {
  saveA11yBoolean("reduce-distractions", enabled);
}

export function loadA11yFocusMode(): boolean {
  return loadA11yBoolean("focus-mode");
}

export function saveA11yFocusMode(enabled: boolean): void {
  saveA11yBoolean("focus-mode", enabled);
}

export function loadA11ySimplifiedMenus(): boolean {
  return loadA11yBoolean("simplified-menus");
}

export function saveA11ySimplifiedMenus(enabled: boolean): void {
  saveA11yBoolean("simplified-menus", enabled);
}

export function loadA11yHideMediaDetails(): boolean {
  return loadA11yBoolean("hide-media-details");
}

export function saveA11yHideMediaDetails(enabled: boolean): void {
  saveA11yBoolean("hide-media-details", enabled);
}

export function loadA11yGrayscale(): boolean {
  return loadA11yBoolean("grayscale");
}

export function saveA11yGrayscale(enabled: boolean): void {
  saveA11yBoolean("grayscale", enabled);
}

export function loadA11yInheritWindows(): boolean {
  return loadA11yBoolean("inherit-windows");
}

export function saveA11yInheritWindows(enabled: boolean): void {
  saveA11yBoolean("inherit-windows", enabled);
}

const A11Y_VOLUME_LIMIT_MIN = 0.2;
const A11Y_VOLUME_LIMIT_MAX = 1;

export function loadA11yVolumeLimit(): number {
  const raw = localStorage.getItem("vyu-a11y-volume-limit");
  if (raw === null) return A11Y_VOLUME_LIMIT_MAX;
  const value = Number(raw);
  if (!Number.isFinite(value)) return A11Y_VOLUME_LIMIT_MAX;
  const snapped = Math.round(value * 20) / 20;
  return Math.min(
    A11Y_VOLUME_LIMIT_MAX,
    Math.max(A11Y_VOLUME_LIMIT_MIN, snapped),
  );
}

export function saveA11yVolumeLimit(limit: number): void {
  const snapped = Math.round(limit * 20) / 20;
  localStorage.setItem(
    "vyu-a11y-volume-limit",
    String(
      Math.min(A11Y_VOLUME_LIMIT_MAX, Math.max(A11Y_VOLUME_LIMIT_MIN, snapped)),
    ),
  );
}

export function loadA11yBalance(): number {
  const raw = localStorage.getItem("vyu-a11y-balance");
  if (raw === null) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  const snapped = Math.round(value * 20) / 20;
  return Math.min(1, Math.max(-1, snapped));
}

export function saveA11yBalance(balance: number): void {
  const snapped = Math.round(balance * 20) / 20;
  localStorage.setItem(
    "vyu-a11y-balance",
    String(Math.min(1, Math.max(-1, snapped))),
  );
}

// ── Profiles ──

export type ProfileIcon =
  | "user"
  | "star"
  | "heart"
  | "briefcase"
  | "book"
  | "music"
  | "film";

export interface ProfileRecord {
  id: string;
  name: string;
  color: string;
  icon: ProfileIcon;
  createdAt: number;
  updatedAt: number;
  settings: Record<string, string>;
}

export interface ProfilePreferences {
  libraryIsolation: boolean;
  universalAccessibility: boolean;
  rememberLast: boolean;
  startupProfileId: string | null;
  confirmSwitch: boolean;
}

export interface ProfileRegistry {
  version: 2;
  activeId: string;
  profiles: ProfileRecord[];
  preferences: ProfilePreferences;
}

export const PROFILE_REGISTRY_KEY = "vyu-profiles-registry-v1";
export const DEFAULT_PROFILE_ID = "default";

export const PROFILE_COLORS = [
  "#a855f7",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#94a3b8",
] as const;

export const PROFILE_ICONS: readonly ProfileIcon[] = [
  "user",
  "star",
  "heart",
  "briefcase",
  "book",
  "music",
  "film",
];

// Device- and window-level settings stay shared so profiles do not move
// windows, overwrite external app paths, or change GPU behavior.
const PROFILE_SHARED_KEYS = new Set([
  "vyu-system-always-on-top",
  "vyu-system-keep-awake",
  "vyu-system-check-updates-on-launch",
  "vyu-system-battery-saver-thumbnails",
  "vyu-system-vlc-path",
  "vyu-system-spotify-path",
  "vyu-system-paint-path",
  "vyu-process-gpu",
  "vyu-process-hardware-encoder",
  "vyu-debug-overlay",
]);

// Library content and layout can be shared across profiles when
// profile-specific libraries are disabled.
const PROFILE_LIBRARY_PREFIXES = ["vyu-library-", "vyu-recent-"];
const PROFILE_LIBRARY_KEYS = new Set([
  "vyu-collections",
  "vyu-favorites",
  "vyu-collection-covers",
  "vyu-view-mode",
  "vyu-view-density",
  "vyu-sort-mode",
  "vyu-sort-desc",
  "vyu-show-folders",
  "vyu-show-thumbnails",
  "vyu-dividers-on",
  "vyu-names-on",
  "vyu-privacy-mode",
  "vyu-privacy-blur",
  "vyu-privacy-hide-names",
  "vyu-privacy-reveal-hover",
  "vyu-system-last-file",
]);

function isLibrarySettingsKey(key: string): boolean {
  return (
    PROFILE_LIBRARY_KEYS.has(key) ||
    PROFILE_LIBRARY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

const PROFILE_ACCESSIBILITY_PREFIXES = ["vyu-a11y-"];
const PROFILE_ACCESSIBILITY_KEYS = new Set([
  "vyu-colorblind-mode",
  "vyu-high-contrast",
  "vyu-reduced-motion",
  "vyu-ui-scale",
  "vyu-show-tooltips",
  "vyu-viewer-background",
  "vyu-privacy-mode",
  "vyu-privacy-blur",
  "vyu-privacy-hide-names",
  "vyu-privacy-reveal-hover",
  "vyu-recents-disabled",
  "vyu-show-thumbnails",
  "vyu-system-pause-on-focus-loss",
  "vyu-seek-step",
  "vyu-relative-seek",
  "vyu-relative-seek-step",
  "vyu-delete-no-ask",
]);

function isAccessibilitySettingsKey(key: string): boolean {
  return (
    PROFILE_ACCESSIBILITY_KEYS.has(key) ||
    PROFILE_ACCESSIBILITY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function isProfileSettingsKey(
  key: string,
  libraryIsolation: boolean,
  universalAccessibility = false,
): boolean {
  if (!key.startsWith("vyu-")) return false;
  if (key.startsWith("vyu-profiles-")) return false;
  if (PER_FILE_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  if (key === "vyu-edit-session") return false;
  if (PROFILE_SHARED_KEYS.has(key)) return false;
  if (universalAccessibility && isAccessibilitySettingsKey(key)) return false;
  if (!libraryIsolation && isLibrarySettingsKey(key)) return false;
  return true;
}

function createDefaultProfile(): ProfileRecord {
  const now = Date.now();
  return {
    id: DEFAULT_PROFILE_ID,
    name: "Default",
    color: PROFILE_COLORS[0],
    icon: "user",
    createdAt: now,
    updatedAt: now,
    settings: {},
  };
}

function createDefaultPreferences(): ProfilePreferences {
  return {
    libraryIsolation: false,
    universalAccessibility: false,
    rememberLast: true,
    startupProfileId: null,
    confirmSwitch: false,
  };
}

function createDefaultRegistry(): ProfileRegistry {
  return {
    version: 2,
    activeId: DEFAULT_PROFILE_ID,
    profiles: [createDefaultProfile()],
    preferences: createDefaultPreferences(),
  };
}

function normalizeProfileSettings(raw: unknown): Record<string, string> {
  const settings: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return settings;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && isProfileSettingsKey(key, true)) {
      settings[key] = value;
    }
  }
  return settings;
}

function profileName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 32) : fallback;
}

function profileColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function profileIcon(value: unknown): ProfileIcon {
  return typeof value === "string" &&
    PROFILE_ICONS.includes(value as ProfileIcon)
    ? (value as ProfileIcon)
    : "user";
}

export function loadProfileRegistry(): ProfileRegistry {
  const raw = localStorage.getItem(PROFILE_REGISTRY_KEY);
  if (!raw) return createDefaultRegistry();

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return createDefaultRegistry();
    }

    const seen = new Set<string>();
    const profiles: ProfileRecord[] = [];
    const rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];

    for (const item of rawProfiles) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || !record.id || seen.has(record.id)) {
        continue;
      }
      seen.add(record.id);
      const now = Date.now();
      profiles.push({
        id: record.id,
        name: profileName(record.name, "Profile"),
        color: profileColor(
          record.color,
          PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
        ),
        icon: profileIcon(record.icon),
        createdAt:
          typeof record.createdAt === "number" ? record.createdAt : now,
        updatedAt:
          typeof record.updatedAt === "number" ? record.updatedAt : now,
        settings: normalizeProfileSettings(record.settings),
      });
    }

    if (profiles.length === 0) profiles.push(createDefaultProfile());

    const activeId =
      typeof parsed.activeId === "string" &&
      profiles.some((profile) => profile.id === parsed.activeId)
        ? parsed.activeId
        : profiles[0].id;

    const rawPreferences =
      parsed.preferences &&
      typeof parsed.preferences === "object" &&
      !Array.isArray(parsed.preferences)
        ? (parsed.preferences as Record<string, unknown>)
        : {};

    const version = typeof parsed.version === "number" ? parsed.version : 1;

    const startupProfileId =
      typeof rawPreferences.startupProfileId === "string" &&
      profiles.some((profile) => profile.id === rawPreferences.startupProfileId)
        ? rawPreferences.startupProfileId
        : null;

    return {
      version: 2,
      activeId,
      profiles,
      preferences: {
        libraryIsolation:
          version < 2
            ? false
            : typeof rawPreferences.libraryIsolation === "boolean"
              ? rawPreferences.libraryIsolation
              : false,
        universalAccessibility:
          typeof rawPreferences.universalAccessibility === "boolean"
            ? rawPreferences.universalAccessibility
            : false,
        rememberLast:
          typeof rawPreferences.rememberLast === "boolean"
            ? rawPreferences.rememberLast
            : true,
        startupProfileId,
        confirmSwitch: rawPreferences.confirmSwitch === true,
      },
    };
  } catch {
    return createDefaultRegistry();
  }
}

export function saveProfileRegistry(registry: ProfileRegistry): boolean {
  try {
    localStorage.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(registry));
    return true;
  } catch (error) {
    console.error("Failed to save profiles:", error);
    return false;
  }
}

export function collectProfileSettings(
  libraryIsolation: boolean,
  universalAccessibility = false,
): Record<string, string> {
  const settings: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      !key ||
      !isProfileSettingsKey(key, libraryIsolation, universalAccessibility)
    ) {
      continue;
    }
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return settings;
}

export function collectLibrarySettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isLibrarySettingsKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return settings;
}

export function collectAccessibilitySettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isAccessibilitySettingsKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  return settings;
}

export function replaceProfileSettings(
  settings: Record<string, string>,
  libraryIsolation: boolean,
  universalAccessibility = false,
): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      isProfileSettingsKey(key, libraryIsolation, universalAccessibility)
    ) {
      keys.push(key);
    }
  }
  for (const key of keys) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(settings)) {
    if (isProfileSettingsKey(key, libraryIsolation, universalAccessibility)) {
      localStorage.setItem(key, value);
    }
  }
}

export function sanitizeProfileSettings(raw: unknown): Record<string, string> {
  return normalizeProfileSettings(raw);
}

export function applyStartupProfilePreference(): ProfileRegistry {
  const registry = loadProfileRegistry();
  if (registry.preferences.rememberLast) return registry;

  const targetId = registry.preferences.startupProfileId;
  if (!targetId || targetId === registry.activeId) return registry;

  const target = registry.profiles.find((profile) => profile.id === targetId);
  if (!target) return registry;

  const active = registry.profiles.find(
    (profile) => profile.id === registry.activeId,
  );
  if (active) {
    active.settings = collectProfileSettings(
      registry.preferences.libraryIsolation,
      registry.preferences.universalAccessibility,
    );
    active.updatedAt = Date.now();
  }

  replaceProfileSettings(
    target.settings,
    registry.preferences.libraryIsolation,
    registry.preferences.universalAccessibility,
  );
  registry.activeId = target.id;
  saveProfileRegistry(registry);
  return registry;
}
