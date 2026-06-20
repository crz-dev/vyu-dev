import { volumeToActual } from "$lib/features/media/playback.svelte";
import { convertFileSrc } from "@tauri-apps/api/core";
import { stat } from "@tauri-apps/plugin-fs";
import { getFileName } from "$lib/services/files";
import { prepareDisplayPath } from "./sources";
import {
  readTimestamps,
  readClipBoundaries,
  loadResumePoint,
} from "$lib/services/storage";
import {
  isVideo as pathIsVideo,
  isAudio as pathIsAudio,
  isPdf as pathIsPdf,
} from "$lib/shared/media-kind";
import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
import { formatMetaDate, getMetaValue } from "$lib/shared/file-meta";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
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

  async function displayFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
  ): Promise<void> {
    releaseMediaResources();

    const isVideo = pathIsVideo(path);
    const isAudio = pathIsAudio(path);
    const isPdf = pathIsPdf(path);

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
      timestamps: isVideo || isAudio ? readTimestamps(path) : [],
      clipBoundaries: isVideo ? readClipBoundaries(path) : [],
      resumePoint: isVideo || isAudio ? loadResumePoint(path) : null,
    });

    onReset(path);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    set({ fileSrc: convertFileSrc(await prepareDisplayPath(path)) });

    try {
      let info = statCache.get(path);
      if (!info) {
        info = await stat(path);
        statCache.set(path, info);
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
  };
}
