// Central media state
import { volumeToActual } from "$lib/features/media/playback.svelte";
import { convertFileSrc } from "@tauri-apps/api/core";
import { stat } from "@tauri-apps/plugin-fs";
import { getFileName } from "$lib/services/files";
import { prepareDisplayPath } from "$lib/features/media/tools";
import { getFileMetadataLight } from "$lib/services/database";
import {
  readTimestamps as lsReadTimestamps,
  readClipBoundaries as lsReadClipBoundaries,
  loadResumePoint as lsLoadResumePoint,
} from "$lib/services/storage";
import {
  isVideo as pathIsVideo,
  isAudio as pathIsAudio,
  isPdf as pathIsPdf,
  isBrowserUnsupportedImage,
  needsRemux,
} from "$lib/shared/media-kind";
import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
import { formatMetaDate, getMetaValue } from "$lib/shared/file-meta";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
import { fxEngine } from "$lib/features/effects/effects-engine";
import { library } from "$lib/features/library/library.svelte";

export interface MediaState {
  filePath: string;
  fileSrc: string;
  fileName: string;
  isVideo: boolean;
  isAudio: boolean;
  isPdf: boolean;
  fileList: string[];
  currentIndex: number;
  fileSize: string;
  fileSizeBytes: number;
  fileDimensions: string;
  fileCreated: string;
  fileModified: string;
  fileInfoLoading: boolean;
  isLoadingFile: boolean;
  loadingFadingOut: boolean;
  imageRotation: number;
  imageFlipped: boolean;
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  rawCurrentSecs: number;
  rawDurationSecs: number;
  progress: number;
  playing: boolean;
  timestamps: VideoMarker[];
  clipBoundaries: ClipBoundary[];
  resumePoint: number | null;
}

interface PrefetchEntry {
  baseSrc?: string;
  meta?: {
    timestamps: VideoMarker[];
    clipBoundaries: ClipBoundary[];
    resumePoint: number | null;
  };
}

const prefetchCache = new Map<string, PrefetchEntry>();
const MAX_PREFETCH = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createMedia(
  videoElRef: () => HTMLVideoElement | null,
  audioElRef: () => HTMLAudioElement | null,
  getVolume: () => number,
  getMuted: () => boolean,
  getLooping: () => boolean,
  onReset: (newPath?: string) => void,
) {
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let finishLoadingCalled = false;
  let loadGen = 0;
  const STAT_CACHE_MAX = 500;
  const statCache = new Map<
    string,
    {
      size: number;
      birthtime?: unknown;
      mtime?: unknown;
      createdAt?: unknown;
      modifiedAt?: unknown;
      birthtimeMs?: unknown;
      mtimeMs?: unknown;
    }
  >();

  function evictStatCache() {
    if (statCache.size > STAT_CACHE_MAX) {
      const first = statCache.keys().next().value;
      if (first !== undefined) statCache.delete(first);
    }
  }

  function finishLoading(set: (data: Partial<MediaState>) => void): void {
    if (finishLoadingCalled) return;
    finishLoadingCalled = true;
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      set({ loadingFadingOut: true });
      setTimeout(() => {
        set({ isLoadingFile: false, loadingFadingOut: false });
      }, 400);
    }, 400);
  }

  function releaseMediaResources() {
    const videoEl = videoElRef();
    if (videoEl) {
      videoEl.pause();
    }
    const audioEl = audioElRef();
    if (audioEl) {
      audioEl.pause();
    }
    fxEngine.disconnect();
    eqEngine.disconnect();
    if (videoEl) {
      videoEl.removeAttribute("src");
      videoEl.load();
    }
    if (audioEl) {
      audioEl.removeAttribute("src");
      audioEl.load();
    }
  }

  function parseTimestamps(data: string | null | undefined): VideoMarker[] {
    if (!data || data === "[]" || data === "null") return [];
    try {
      const raw = JSON.parse(data) as Array<Partial<VideoMarker>>;
      return raw
        .filter((ts) => typeof ts?.time === "number")
        .map((ts) => ({
          id:
            ts.id ||
            `ts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          time: ts.time as number,
          title: typeof ts.title === "string" ? ts.title : "",
        }))
        .sort((a, b) => a.time - b.time);
    } catch {
      return [];
    }
  }

  function parseClipBoundaries(data: string | null | undefined): ClipBoundary[] {
    if (!data || data === "[]" || data === "null") return [];
    try {
      const raw = JSON.parse(data) as Array<Partial<ClipBoundary>>;
      return raw
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

  async function prefetchFile(path: string) {
    if (prefetchCache.has(path)) return;
    try {
      const [baseSrc, metaResult] = await Promise.all([
        prepareDisplayPath(path).then(convertFileSrc).catch(() => undefined),
        getFileMetadataLight(path).catch(() => null),
      ]);

      const entry: PrefetchEntry = {};
      if (baseSrc) entry.baseSrc = baseSrc;
      if (metaResult) {
        const timestamps: VideoMarker[] = [];
        const clipBoundaries: ClipBoundary[] = [];
        let resumePoint: number | null = null;

        if (metaResult.timestamp_data) {
          timestamps.push(...parseTimestamps(metaResult.timestamp_data));
        }
        if (metaResult.clips_data) {
          clipBoundaries.push(...parseClipBoundaries(metaResult.clips_data));
        }
        if (metaResult.last_position != null && isFinite(metaResult.last_position)) {
          resumePoint = metaResult.last_position;
        }

        entry.meta = { timestamps, clipBoundaries, resumePoint };
      }

      if (prefetchCache.size >= MAX_PREFETCH) {
        const first = prefetchCache.keys().next().value;
        if (first) prefetchCache.delete(first);
      }
      prefetchCache.set(path, entry);

      // Pre-warm stat cache — displayFile checks this before IPC
      if (!statCache.has(path)) {
        try {
          const info = await stat(path);
          statCache.set(path, info);
          evictStatCache();
        } catch {
          // non-critical
        }
      }
    } catch {
      // Prefetch failures are non-critical
    }
  }

  function prefetchAdjacent(fileList: string[], currentIndex: number) {
    if (fileList.length === 0) return;
    const offsets = [1, -1, 2, -2];
    for (const offset of offsets) {
      const idx = currentIndex + offset;
      if (idx < 0 || idx >= fileList.length) continue;
      // Skip heavy prefetch (±2) for formats that need conversion
      if (Math.abs(offset) >= 2) {
        const p = fileList[idx];
        if (isBrowserUnsupportedImage(p) || needsRemux(p)) continue;
      }
      prefetchFile(fileList[idx]);
    }
  }

  async function displayFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
  ): Promise<void> {
    const gen = ++loadGen;

    // Consume prefetch cache if available
    const cached = prefetchCache.get(path);
    if (cached) prefetchCache.delete(path);

    releaseMediaResources();

    const isVideo = pathIsVideo(path);
    const isAudio = pathIsAudio(path);
    const isPdf = pathIsPdf(path);

    // Batch metadata fetch — use cached or fresh
    let timestamps: VideoMarker[] = [];
    let clipBoundaries: ClipBoundary[] = [];
    let resumePoint: number | null = null;

    if (cached?.meta) {
      timestamps = cached.meta.timestamps;
      clipBoundaries = cached.meta.clipBoundaries;
      resumePoint = cached.meta.resumePoint;
    } else if (isVideo || isAudio) {
      try {
        const meta = await getFileMetadataLight(path);
        if (gen !== loadGen) return;
        if (meta) {
          if (meta.timestamp_data) {
            timestamps = parseTimestamps(meta.timestamp_data);
          }
          if (isVideo && meta.clips_data) {
            clipBoundaries = parseClipBoundaries(meta.clips_data);
          }
          if (meta.last_position != null && isFinite(meta.last_position)) {
            resumePoint = meta.last_position;
          }
        } else {
          timestamps = lsReadTimestamps(path);
          if (isVideo) clipBoundaries = lsReadClipBoundaries(path);
          resumePoint = lsLoadResumePoint(path);
        }
      } catch {
        timestamps = lsReadTimestamps(path);
        if (isVideo) clipBoundaries = lsReadClipBoundaries(path);
        resumePoint = lsLoadResumePoint(path);
      }
    }

    set({
      filePath: path,
      fileName: getFileName(path),
      isVideo,
      isAudio,
      isPdf,
      fileSrc: "",
      fileSize: "",
      fileSizeBytes: 0,
      fileDimensions: "",
      fileCreated: "",
      fileModified: "",
      fileInfoLoading: true,
      imageRotation: 0,
      imageFlipped: false,
      imageNaturalWidth: 0,
      imageNaturalHeight: 0,
      rawCurrentSecs: 0,
      rawDurationSecs: 0,
      progress: 0,
      playing: false,
      timestamps,
      clipBoundaries,
      resumePoint,
    });

    onReset(path);

    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (gen !== loadGen) return;

    const baseSrc = cached?.baseSrc ?? convertFileSrc(await prepareDisplayPath(path));
    if (gen !== loadGen) return;
    set({
      fileSrc: baseSrc,
    });

    try {
      let info = statCache.get(path);
      if (!info) {
        info = await stat(path);
        if (gen !== loadGen) return;
        statCache.set(path, info);
        evictStatCache();
      }
      set({
        fileSize: formatFileSize(info.size),
        fileSizeBytes: info.size,
        fileCreated: formatMetaDate(
          getMetaValue(info, "birthtime") ??
            getMetaValue(info, "birthtimeMs") ??
            getMetaValue(info, "createdAt"),
        ),
        fileModified: formatMetaDate(
          getMetaValue(info, "mtime") ??
            getMetaValue(info, "mtimeMs") ??
            getMetaValue(info, "modifiedAt"),
        ),
      });
    } catch (e) {
      console.error("stat() failed:", e);
    }
  }

  async function loadFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
    setFileList: (list: string[], index: number) => void,
    sortMode: "name" | "date-modified" | "size" | "type" = "name",
    sortDesc = false,
  ): Promise<void> {
    clearTimeout(loadingTimer);
    finishLoadingCalled = false;
    set({ isLoadingFile: true, loadingFadingOut: false });
    await displayFile(path, set);
    library.addRecent(path);
    try {
      const { readMediaFilesInFolder } = await import("$lib/services/files");
      const list = await readMediaFilesInFolder(path, sortMode, sortDesc);
      setFileList(list, list.indexOf(path));
    } catch (e) {
      console.error("readMediaFilesInFolder failed:", e);
    }
  }

  async function navigate(
    direction: number,
    fileList: string[],
    currentIndex: number,
    set: (data: Partial<MediaState>) => void,
  ): Promise<number> {
    if (fileList.length === 0) return currentIndex;
    const next = (currentIndex + direction + fileList.length) % fileList.length;
    await displayFile(fileList[next], set);
    return next;
  }

  async function navigateToEdge(
    first: boolean,
    fileList: string[],
    set: (data: Partial<MediaState>) => void,
  ): Promise<number> {
    if (fileList.length === 0) return 0;
    const next = first ? 0 : fileList.length - 1;
    await displayFile(fileList[next], set);
    return next;
  }

  function closeFile(set: (data: Partial<MediaState>) => void): void {
    clearTimeout(loadingTimer);
    finishLoadingCalled = false;
    releaseMediaResources();
    statCache.clear();
    onReset();
    set({
      filePath: "",
      fileSrc: "",
      fileName: "no file open",
      isVideo: false,
      isAudio: false,
      isPdf: false,
      fileList: [],
      currentIndex: 0,
      playing: false,
      progress: 0,
      rawCurrentSecs: 0,
      rawDurationSecs: 0,
      fileSize: "",
      fileSizeBytes: 0,
      fileDimensions: "",
      fileCreated: "",
      fileModified: "",
      isLoadingFile: false,
      loadingFadingOut: false,
      imageRotation: 0,
      imageFlipped: false,
      imageNaturalWidth: 0,
      imageNaturalHeight: 0,
      timestamps: [],
      clipBoundaries: [],
      resumePoint: null,
    });
  }

  function onImageLoad(
    e: Event,
    isLoadingFile: boolean,
    set: (data: Partial<MediaState>) => void,
    finishLoadingCb: () => void,
  ): void {
    const img = e.target as HTMLImageElement;
    set({
      imageNaturalWidth: img.naturalWidth,
      imageNaturalHeight: img.naturalHeight,
      fileDimensions: `${img.naturalWidth} × ${img.naturalHeight}`,
      fileInfoLoading: false,
    });
    if (isLoadingFile) finishLoadingCb();
  }

  function onVideoLoad(
    isLoadingFile: boolean,
    set: (data: Partial<MediaState>) => void,
    finishLoadingCb: () => void,
  ): void {
    const videoEl = videoElRef();
    if (!videoEl) return;
    videoEl.volume = volumeToActual(getVolume());
    videoEl.muted = getMuted();
    videoEl.loop = getLooping();
    set({
      fileDimensions: `${videoEl.videoWidth} × ${videoEl.videoHeight}`,
      fileInfoLoading: false,
      rawCurrentSecs: 0,
      rawDurationSecs: videoEl.duration || 0,
      progress: 0,
      playing: !videoEl.paused,
    });
    if (isLoadingFile) finishLoadingCb();
  }

  return {
    displayFile,
    loadFile,
    navigate,
    navigateToEdge,
    closeFile,
    onImageLoad,
    onVideoLoad,
    finishLoading,
    prefetchAdjacent,
  };
}
