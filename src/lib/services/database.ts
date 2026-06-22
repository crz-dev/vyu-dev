import { invoke } from "@tauri-apps/api/core";
import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
import type { EqSettings } from "./storage";

export interface FileMetadata {
  path: string;
  last_position: number | null;
  timestamp_data: string | null;
  clips_data: string | null;
  eq_data: string | null;
  cd_color: number | null;
  last_viewed: number | null;
  updated_at: number;
}

interface BatchEntry {
  path: string;
  last_position: number | null;
  timestamp_data: string | null;
  clips_data: string | null;
  eq_data: string | null;
  cd_color: number | null;
  last_viewed: number | null;
}

const metaCache = new Map<string, FileMetadata>();
const metaCacheOrder: string[] = [];
const META_CACHE_MAX = 200;

function touchMetaCache(path: string) {
  const idx = metaCacheOrder.indexOf(path);
  if (idx !== -1) metaCacheOrder.splice(idx, 1);
  metaCacheOrder.push(path);
}

function evictMetaCache() {
  const oldest = metaCacheOrder.shift();
  if (oldest !== undefined) metaCache.delete(oldest);
}

function invalidateMetaCache(path: string) {
  metaCache.delete(path);
  const idx = metaCacheOrder.indexOf(path);
  if (idx !== -1) metaCacheOrder.splice(idx, 1);
}

function setMetaCache(path: string, meta: FileMetadata) {
  if (metaCache.has(path)) touchMetaCache(path);
  else {
    metaCache.set(path, meta);
    metaCacheOrder.push(path);
    if (metaCacheOrder.length > META_CACHE_MAX) evictMetaCache();
  }
}

async function getMeta(path: string): Promise<FileMetadata | null> {
  if (!path) return null;
  const cached = metaCache.get(path);
  if (cached) {
    touchMetaCache(path);
    return cached;
  }
  try {
    const result = await invoke<FileMetadata | null>("db_get_file_metadata", {
      path,
    });
    if (result) setMetaCache(path, result);
    return result;
  } catch {
    return null;
  }
}

export async function getFileMetadata(
  path: string,
): Promise<FileMetadata | null> {
  return getMeta(path);
}

async function saveMeta(
  path: string,
  fields: Partial<{
    last_position: number | null;
    timestamp_data: string | null;
    clips_data: string | null;
    eq_data: string | null;
    cd_color: number | null;
    last_viewed: number | null;
  }>,
): Promise<void> {
  if (!path) return;
  invalidateMetaCache(path);
  try {
    await invoke("db_save_file_metadata", {
      path,
      lastPosition: "last_position" in fields ? fields.last_position ?? null : null,
      timestampData: "timestamp_data" in fields ? fields.timestamp_data ?? null : null,
      clipsData: "clips_data" in fields ? fields.clips_data ?? null : null,
      eqData: "eq_data" in fields ? fields.eq_data ?? null : null,
      cdColor: "cd_color" in fields ? fields.cd_color ?? null : null,
      lastViewed: "last_viewed" in fields ? fields.last_viewed ?? null : null,
    });
  } catch (e) {
    console.error("Failed to save file metadata:", e);
  }
}

async function clearField(path: string, field: string): Promise<void> {
  if (!path) return;
  try {
    await invoke("db_clear_file_metadata_field", { path, field });
  } catch (e) {
    console.error(`Failed to clear field ${field}:`, e);
  }
}

// ── Timestamps ──

export async function readTimestamps(filePath: string): Promise<VideoMarker[]> {
  if (!filePath) return [];
  try {
    const meta = await getMeta(filePath);
    if (!meta?.timestamp_data) return [];
    const parsed = JSON.parse(meta.timestamp_data) as Array<Partial<VideoMarker>>;
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

export async function writeTimestamps(
  filePath: string,
  timestamps: VideoMarker[],
): Promise<void> {
  if (!filePath) return;
  await saveMeta(filePath, { timestamp_data: JSON.stringify(timestamps) });
}

export async function deleteTimestamps(filePath: string): Promise<void> {
  await clearField(filePath, "timestamp_data");
}

// ── Clip boundaries ──

export async function readClipBoundaries(filePath: string): Promise<ClipBoundary[]> {
  if (!filePath) return [];
  try {
    const meta = await getMeta(filePath);
    if (!meta?.clips_data) return [];
    const parsed = JSON.parse(meta.clips_data) as Array<Partial<ClipBoundary>>;
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

export async function writeClipBoundaries(
  filePath: string,
  boundaries: ClipBoundary[],
): Promise<void> {
  if (!filePath) return;
  await saveMeta(filePath, { clips_data: JSON.stringify(boundaries) });
}

export async function deleteClipBoundaries(filePath: string): Promise<void> {
  await clearField(filePath, "clips_data");
}

// ── Resume point ──

export async function loadResumePoint(filePath: string): Promise<number | null> {
  if (!filePath) return null;
  try {
    const meta = await getMeta(filePath);
    if (meta?.last_position == null) return null;
    return isFinite(meta.last_position) ? meta.last_position : null;
  } catch {
    return null;
  }
}

export async function saveResumePoint(
  filePath: string,
  time: number,
): Promise<void> {
  if (!filePath) return;
  await saveMeta(filePath, { last_position: time });
}

export async function deleteResumePoint(filePath: string): Promise<void> {
  await clearField(filePath, "last_position");
}

// ── CD color ──

export async function loadCdColor(filePath: string): Promise<number> {
  if (!filePath) return -1;
  try {
    const meta = await getMeta(filePath);
    if (meta?.cd_color == null) return -1;
    return Number.isFinite(meta.cd_color) ? meta.cd_color : -1;
  } catch {
    return -1;
  }
}

export async function saveCdColor(filePath: string, index: number): Promise<void> {
  if (!filePath) return;
  await saveMeta(filePath, { cd_color: index });
}

// ── EQ settings ──

export async function loadEqSettings(
  filePath: string,
): Promise<EqSettings | null> {
  if (!filePath) return null;
  try {
    const meta = await getMeta(filePath);
    if (!meta?.eq_data) return null;
    const parsed = JSON.parse(meta.eq_data) as Partial<EqSettings>;
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

export async function saveEqSettings(
  filePath: string,
  settings: EqSettings,
): Promise<void> {
  if (!filePath) return;
  await saveMeta(filePath, { eq_data: JSON.stringify(settings) });
}

export async function deleteEqSettings(filePath: string): Promise<void> {
  await clearField(filePath, "eq_data");
}

// ── Migration from localStorage ──

export async function migrateFromLocalStorage(): Promise<void> {
  const PREFIXES = [
    "vyu-ts-",
    "vyu-clips-",
    "vyu-resume-",
    "vyu-eq-",
    "vyu-cd-color-",
  ] as const;

  type PrefixType = (typeof PREFIXES)[number];

  interface LocalEntry {
    key: string;
    path: string;
    type: PrefixType;
    value: string;
  }

  const entries: LocalEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const prefix = PREFIXES.find((p) => key.startsWith(p));
    if (!prefix) continue;

    const value = localStorage.getItem(key);
    if (value === null) continue;

    entries.push({ key, path: key.slice(prefix.length), type: prefix, value });
  }

  if (entries.length === 0) return;

  // Group by file path
  const byPath = new Map<string, LocalEntry[]>();
  for (const entry of entries) {
    const existing = byPath.get(entry.path) ?? [];
    existing.push(entry);
    byPath.set(entry.path, existing);
  }

  const batch: BatchEntry[] = [];

  for (const [path, fileEntries] of byPath) {
    const row: BatchEntry = {
      path,
      last_position: null,
      timestamp_data: null,
      clips_data: null,
      eq_data: null,
      cd_color: null,
      last_viewed: null,
    };

    for (const e of fileEntries) {
      switch (e.type) {
        case "vyu-ts-":
          row.timestamp_data = e.value;
          break;
        case "vyu-clips-":
          row.clips_data = e.value;
          break;
        case "vyu-resume-": {
          const val = parseFloat(e.value);
          row.last_position = isFinite(val) ? val : null;
          break;
        }
        case "vyu-eq-":
          row.eq_data = e.value;
          break;
        case "vyu-cd-color-": {
          const val = parseInt(e.value, 10);
          row.cd_color = Number.isFinite(val) ? val : null;
          break;
        }
      }
    }

    batch.push(row);
  }

  try {
    await invoke("db_batch_upsert_file_metadata", { entries: batch });

    // Only remove localStorage keys after successful persistence
    for (const entry of entries) {
      localStorage.removeItem(entry.key);
    }
  } catch (e) {
    console.error("Failed to migrate localStorage entries to SQLite:", e);
  }
}
