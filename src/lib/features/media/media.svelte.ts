import { volumeToActual } from "$lib/features/media/playback.svelte";
import { convertFileSrc } from "@tauri-apps/api/core";
import { stat } from "@tauri-apps/plugin-fs";
import {
  getFileName,
  getParentFolder,
  clearFolderCache,
} from "$lib/services/files";
import { prepareDisplayPath } from "$lib/features/media/api";
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
} from "$lib/shared/mediaKind";
import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
import { formatMetaDate, getMetaValue } from "$lib/shared/fileMeta";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
import { fxEngine } from "$lib/features/effects/effects-engine";
import { library } from "$lib/features/library/library.svelte";
import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
import {
  preloadImage,
  getPreloadedUrl,
  clearPreloadedImages,
  forgetPreloadedImage,
} from "$lib/services/imagePreload";
import { locale } from "$lib/features/i18n/locale.svelte";

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
  /** Versioned display URL, shared with the decoded-image preload. */
  src?: string;
  at?: number;
  meta?: {
    timestamps: VideoMarker[];
    clipBoundaries: ClipBoundary[];
    resumePoint: number | null;
  };
}

const prefetchCache = new Map<string, PrefetchEntry>();
const MAX_PREFETCH = 10;
// Prefetched URLs are reused for a short window; real content changes
// (edit apply, folder change) invalidate them explicitly.
const PREFETCH_TTL_MS = 5 * 60_000;
// Unique URL per load so WebView media caches can't serve a previous version of the file.
let srcNonce = Date.now();

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
  onBeforeSwitch: (nextPath: string) => void = () => {},
  onSourceReady: (path: string) => void = () => {},
) {
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let finishLoadingCalled = false;
  let loadGen = 0;
  // Whether the file currently on screen is an image. Used to avoid blanking
  // the viewer when switching between two images.
  let previousWasImage = false;
  // Pixel preloads are held until the visible image has loaded, so background
  // decoding cannot compete with the image the user is waiting for.
  const pendingPixelPreloads: Array<{ path: string; src: string }> = [];
  let preloadFlushTimer: ReturnType<typeof setTimeout> | undefined;
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
    }
    if (audioEl) {
      audioEl.removeAttribute("src");
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

  function parseClipBoundaries(
    data: string | null | undefined,
  ): ClipBoundary[] {
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

  function queuePixelPreload(path: string, src: string) {
    if (pendingPixelPreloads.some((p) => p.path === path)) return;
    pendingPixelPreloads.push({ path, src });
    if (pendingPixelPreloads.length > 6) pendingPixelPreloads.shift();
    clearTimeout(preloadFlushTimer);
    preloadFlushTimer = setTimeout(flushPixelPreloads, 350);
  }

  function flushPixelPreloads() {
    clearTimeout(preloadFlushTimer);
    preloadFlushTimer = undefined;
    if (pendingPixelPreloads.length === 0) return;
    const queued = pendingPixelPreloads.splice(0);
    for (const entry of queued) preloadImage(entry.path, entry.src);
  }

  async function prefetchFile(path: string, preloadPixels = true) {
    if (prefetchCache.has(path)) return;
    try {
      const [displayPath, metaResult] = await Promise.all([
        prepareDisplayPath(path).catch(() => undefined),
        getFileMetadataLight(path).catch(() => null),
      ]);

      const entry: PrefetchEntry = { at: Date.now() };
      if (displayPath) {
        entry.src =
          getPreloadedUrl(path) ??
          `${convertFileSrc(displayPath)}?v=${++srcNonce}`;
      }
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
        if (
          metaResult.last_position != null &&
          isFinite(metaResult.last_position)
        ) {
          resumePoint = metaResult.last_position;
        }

        entry.meta = { timestamps, clipBoundaries, resumePoint };
      }

      if (prefetchCache.size >= MAX_PREFETCH) {
        const first = prefetchCache.keys().next().value;
        if (first) prefetchCache.delete(first);
      }
      prefetchCache.set(path, entry);

      // Fetch and decode image pixels now so the next navigation can paint
      // from the decoded-image cache instead of hitting disk. Only immediate
      // neighbours are worth the memory; ±2 is metadata-only.
      if (
        preloadPixels &&
        entry.src &&
        !pathIsVideo(path) &&
        !pathIsAudio(path) &&
        !pathIsPdf(path)
      ) {
        queuePixelPreload(path, entry.src);
      }

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
      prefetchFile(fileList[idx], Math.abs(offset) === 1);
    }
  }

  async function displayFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
    refresh = false,
  ): Promise<boolean> {
    const gen = ++loadGen;

    // Consume prefetch cache if available
    const cached = prefetchCache.get(path);
    if (cached) prefetchCache.delete(path);
    if (refresh) {
      // The file changed on disk; drop every cached representation of it.
      statCache.delete(path);
      forgetPreloadedImage(path);
      const queuedIdx = pendingPixelPreloads.findIndex((p) => p.path === path);
      if (queuedIdx !== -1) pendingPixelPreloads.splice(queuedIdx, 1);
    }

    onBeforeSwitch(path);
    releaseMediaResources();

    const isVideo = pathIsVideo(path);
    const isAudio = pathIsAudio(path);
    const isPdf = pathIsPdf(path);
    const isImage = !isVideo && !isAudio && !isPdf;
    // Keep the previous image on screen until the next one is ready. Only
    // applies to image -> image switches; media kind changes still clear it.
    const keepPreviousImage = isImage && previousWasImage;

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
        if (gen !== loadGen) return false;
        if (meta) {
          if (meta.timestamp_data) {
            timestamps = parseTimestamps(meta.timestamp_data);
          }
          if (isVideo && meta.clips_data) {
            clipBoundaries = parseClipBoundaries(meta.clips_data);
          }
          const lsPosition = lsLoadResumePoint(path);
          if (meta.last_position != null && isFinite(meta.last_position)) {
            resumePoint = meta.last_position;
          } else {
            resumePoint = lsPosition;
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

    const nextState: Partial<MediaState> = {
      filePath: path,
      fileName: getFileName(path),
      isVideo,
      isAudio,
      isPdf,
      fileSize: "",
      fileSizeBytes: 0,
      fileDimensions: "",
      fileCreated: "",
      fileModified: "",
      fileInfoLoading: true,
      imageRotation: 0,
      imageFlipped: false,
      rawCurrentSecs: 0,
      rawDurationSecs: 0,
      progress: 0,
      playing: false,
      timestamps,
      clipBoundaries,
      resumePoint:
        playbackPrefs.resumeMode === "off" ||
        (resumePoint !== null && resumePoint < playbackPrefs.resumeThreshold)
          ? null
          : resumePoint,
    };
    if (!keepPreviousImage) {
      nextState.fileSrc = "";
      nextState.imageNaturalWidth = 0;
      nextState.imageNaturalHeight = 0;
    }
    set(nextState);
    previousWasImage = isImage;

    onReset(path);

    // Audio and video elements must be torn down and recreated between files.
    // Their equalizer source node is bound to the element, so reusing the
    // element leaves it disconnected from the audio graph (no sound). Yield a
    // frame so the cleared `fileSrc` is committed first.
    if (!isImage) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (gen !== loadGen) return false;
    }

    const cachedSrc =
      !refresh &&
      cached?.src &&
      cached.at !== undefined &&
      Date.now() - cached.at < PREFETCH_TTL_MS
        ? cached.src
        : null;
    const preloadedSrc = refresh ? null : getPreloadedUrl(path);
    const src =
      cachedSrc ??
      preloadedSrc ??
      `${convertFileSrc(await prepareDisplayPath(path))}?v=${++srcNonce}`;
    if (gen !== loadGen) return false;
    set({
      fileSrc: src,
    });
    // Fit against the already-decoded dimensions so the first paint of a large
    // photo is not laid out at 1:1 scale.
    onSourceReady(path);

    try {
      let info = statCache.get(path);
      if (!info) {
        info = await stat(path);
        if (gen !== loadGen) return false;
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
    return true;
  }

  async function loadFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
    setFileList: (list: string[], index: number) => void,
    sortMode: "name" | "date-modified" | "size" | "type" = "name",
    sortDesc = false,
    refresh = false,
  ): Promise<void> {
    clearTimeout(loadingTimer);
    finishLoadingCalled = false;
    set({ isLoadingFile: true, loadingFadingOut: false });
    const loaded = await displayFile(path, set, refresh);
    if (!loaded) return;
    library.addRecent(path);
    try {
      const { readMediaFilesInFolder } = await import("$lib/services/files");
      let list = await readMediaFilesInFolder(path, sortMode, sortDesc);
      if (!list.includes(path)) {
        clearFolderCache(getParentFolder(path));
        list = await readMediaFilesInFolder(path, sortMode, sortDesc);
      }
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
  ): Promise<number | null> {
    if (fileList.length === 0) return currentIndex;
    const next = (currentIndex + direction + fileList.length) % fileList.length;
    if (!(await displayFile(fileList[next], set))) return null;
    return next;
  }

  async function navigateToEdge(
    first: boolean,
    fileList: string[],
    set: (data: Partial<MediaState>) => void,
  ): Promise<number | null> {
    if (fileList.length === 0) return 0;
    const next = first ? 0 : fileList.length - 1;
    if (!(await displayFile(fileList[next], set))) return null;
    return next;
  }

  function closeFile(set: (data: Partial<MediaState>) => void): void {
    onBeforeSwitch("");
    clearTimeout(loadingTimer);
    finishLoadingCalled = false;
    previousWasImage = false;
    clearPreloadedImages();
    pendingPixelPreloads.length = 0;
    clearTimeout(preloadFlushTimer);
    preloadFlushTimer = undefined;
    releaseMediaResources();
    statCache.clear();
    onReset();
    set({
      filePath: "",
      fileSrc: "",
      fileName: locale.t("media.player.noFileOpen"),
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
    // The visible image is ready; now warm the neighbours.
    flushPixelPreloads();
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

  function clearCaches() {
    prefetchCache.clear();
    statCache.clear();
    clearPreloadedImages();
    pendingPixelPreloads.length = 0;
    clearTimeout(preloadFlushTimer);
    preloadFlushTimer = undefined;
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
    clearCaches,
  };
}
