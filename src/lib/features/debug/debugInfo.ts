// Debug diagnostics collection
import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
import { invokeGetDatabaseStats } from "$lib/features/debug/api";
import type {
  DatabaseStats,
  DebugFileInfo,
  DebugInfo,
  GpuInfo,
} from "$lib/features/debug/debugTypes";
import { invokeGetFfmpegInfo, type FfmpegInfo } from "$lib/features/media/api";
import {
  invokeGetCacheStats,
  invokeGetRuntimeInfo,
  invokeGetSystemConfig,
  type CacheStats,
  type RuntimeInfo,
  type SystemConfig,
} from "$lib/features/system/api";

const UNKNOWN = "Unavailable";

const EMPTY_RUNTIME: RuntimeInfo = {
  os: UNKNOWN,
  arch: UNKNOWN,
  exePath: "",
  args: [],
  safeMode: false,
};

const EMPTY_SYSTEM: SystemConfig = {
  hardwareAcceleration: true,
  singleInstance: true,
  thumbnailCacheLimitMb: 500,
};

const EMPTY_FFMPEG: FfmpegInfo = {
  ffmpegPath: "",
  ffmpegVersion: UNKNOWN,
  ffprobePath: "",
  ffprobeVersion: UNKNOWN,
  hardwareEncoders: [],
};

const EMPTY_DATABASE: DatabaseStats = {
  path: "",
  sizeBytes: 0,
  walBytes: 0,
  metadataRows: 0,
  settingsRows: 0,
};

const EMPTY_CACHES: CacheStats = {
  thumbnails: 0,
  displays: 0,
  coverArt: 0,
  total: 0,
  thumbnailLimit: 0,
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function getWebView2Version(userAgent: string): string {
  return /Edg\/([\d.]+)/.exec(userAgent)?.[1] ?? UNKNOWN;
}

function getPlatform(): string {
  if (typeof navigator === "undefined") return UNKNOWN;
  const data = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  return data?.platform || navigator.platform || UNKNOWN;
}

export function getGpuInfo(): GpuInfo {
  if (typeof document === "undefined") {
    return { available: false, vendor: UNKNOWN, renderer: UNKNOWN };
  }
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
  if (!gl) {
    return { available: false, vendor: UNKNOWN, renderer: UNKNOWN };
  }
  try {
    const extension = gl.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    const vendor = extension
      ? String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    const renderer = extension
      ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return { available: true, vendor, renderer };
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

export async function collectDebugInfo(
  fileInfo: DebugFileInfo | null = null,
): Promise<DebugInfo> {
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : UNKNOWN;
  const [version, tauri, runtime, system, ffmpeg, database, caches] =
    await Promise.allSettled([
      getVersion(),
      getTauriVersion(),
      invokeGetRuntimeInfo(),
      invokeGetSystemConfig(),
      invokeGetFfmpegInfo(),
      invokeGetDatabaseStats(),
      invokeGetCacheStats(),
    ]);

  return {
    appVersion: settled(version, "Unknown"),
    tauriVersion: settled(tauri, UNKNOWN),
    webview2Version: getWebView2Version(userAgent),
    userAgent,
    platform: getPlatform(),
    language: typeof navigator !== "undefined" ? navigator.language : UNKNOWN,
    hardwareConcurrency:
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0,
    devicePixelRatio:
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
    runtime: settled(runtime, EMPTY_RUNTIME),
    gpu: getGpuInfo(),
    systemConfig: settled(system, EMPTY_SYSTEM),
    ffmpeg: settled(ffmpeg, EMPTY_FFMPEG),
    database: settled(database, EMPTY_DATABASE),
    caches: settled(caches, EMPTY_CACHES),
    keybindCount: keybindStore.actions.length,
    unboundKeybindCount: keybindStore.unboundIds.length,
    currentFile: fileInfo,
  };
}

function redactArg(arg: string): string {
  if (/^[A-Za-z]:[\\/]/.test(arg) || arg.startsWith("/")) return "<file>";
  return arg;
}

export function redactArgs(args: string[]): string[] {
  return args.map(redactArg);
}

function currentFileSummary(file: DebugFileInfo) {
  return {
    name: file.fileName,
    type: file.isVideo
      ? "video"
      : file.isAudio
        ? "audio"
        : file.isPdf
          ? "pdf"
          : "image",
    size: file.fileSize,
    dimensions: file.fileDimensions,
    created: file.fileCreated,
    modified: file.fileModified,
    media: file.mediaProps,
    index: file.index,
    count: file.count,
  };
}

export function buildDiagnosticsReport(info: DebugInfo) {
  return {
    generatedAt: new Date().toISOString(),
    app: {
      version: info.appVersion,
      tauri: info.tauriVersion,
      webview2: info.webview2Version,
    },
    runtime: {
      os: info.runtime.os,
      arch: info.runtime.arch,
      platform: info.platform,
      language: info.language,
      hardwareConcurrency: info.hardwareConcurrency,
      devicePixelRatio: info.devicePixelRatio,
      userAgent: info.userAgent,
    },
    graphics: {
      available: info.gpu.available,
      vendor: info.gpu.vendor,
      renderer: info.gpu.renderer,
      hardwareAcceleration: info.systemConfig.hardwareAcceleration,
    },
    system: {
      singleInstance: info.systemConfig.singleInstance,
      thumbnailCacheLimitMb: info.systemConfig.thumbnailCacheLimitMb,
    },
    launch: {
      safeMode: info.runtime.safeMode,
      args: info.runtime.args.map(redactArg),
    },
    ffmpeg: {
      version: info.ffmpeg.ffmpegVersion,
      probeVersion: info.ffmpeg.ffprobeVersion,
      path: info.ffmpeg.ffmpegPath,
      encoders: info.ffmpeg.hardwareEncoders,
    },
    database: {
      path: info.database.path,
      sizeBytes: info.database.sizeBytes,
      walBytes: info.database.walBytes,
      metadataRows: info.database.metadataRows,
      settingsRows: info.database.settingsRows,
    },
    caches: {
      thumbnails: info.caches.thumbnails,
      displays: info.caches.displays,
      coverArt: info.caches.coverArt,
      total: info.caches.total,
      thumbnailLimit: info.caches.thumbnailLimit,
    },
    keybinds: {
      total: info.keybindCount,
      unbound: info.unboundKeybindCount,
    },
    currentFile: info.currentFile ? currentFileSummary(info.currentFile) : null,
  };
}

export function diagnosticsJson(info: DebugInfo): string {
  return JSON.stringify(buildDiagnosticsReport(info), null, 2);
}

export function fileMetadataJson(file: DebugFileInfo): string {
  return JSON.stringify(
    {
      path: file.filePath,
      name: file.fileName,
      type: file.isVideo
        ? "video"
        : file.isAudio
          ? "audio"
          : file.isPdf
            ? "pdf"
            : "image",
      size: file.fileSize,
      dimensions: file.fileDimensions,
      created: file.fileCreated,
      modified: file.fileModified,
      index: file.index,
      count: file.count,
      media: file.mediaProps,
    },
    null,
    2,
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
