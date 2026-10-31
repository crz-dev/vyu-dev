// Debug and diagnostics types
import type { FfmpegInfo } from "$lib/features/media/api";
import type {
  CacheStats,
  RuntimeInfo,
  SystemConfig,
} from "$lib/features/system/api";
import type { MediaProperties } from "$lib/shared/types";

export interface DebugFileInfo {
  fileName: string;
  filePath: string;
  fileSize: string;
  fileDimensions: string;
  fileCreated: string;
  fileModified: string;
  mediaProps: MediaProperties | null;
  isVideo: boolean;
  isAudio: boolean;
  isPdf: boolean;
  index: number;
  count: number;
}

export interface GpuInfo {
  available: boolean;
  vendor: string;
  renderer: string;
}

export interface DatabaseStats {
  path: string;
  sizeBytes: number;
  walBytes: number;
  metadataRows: number;
  settingsRows: number;
}

export interface DebugInfo {
  appVersion: string;
  tauriVersion: string;
  webview2Version: string;
  userAgent: string;
  platform: string;
  language: string;
  hardwareConcurrency: number;
  devicePixelRatio: number;
  runtime: RuntimeInfo;
  gpu: GpuInfo;
  systemConfig: SystemConfig;
  ffmpeg: FfmpegInfo;
  database: DatabaseStats;
  caches: CacheStats;
  keybindCount: number;
  unboundKeybindCount: number;
  currentFile: DebugFileInfo | null;
}
