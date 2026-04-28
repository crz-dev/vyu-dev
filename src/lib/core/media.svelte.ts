import { convertFileSrc } from "@tauri-apps/api/core";
import { stat } from "@tauri-apps/plugin-fs";
import { VIDEO_EXTS } from "$lib/constants";
import { readMediaFilesInFolder, getFileName } from "$lib/services/files";
import {
  readTimestamps,
  readClipBoundaries,
  loadResumePoint,
} from "$lib/services/storage";
import type { Timestamp, ClipBoundary } from "$lib/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMetaDate(value: unknown): string {
  if (value === null || value === undefined) return "Unknown";
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber)) return "Unknown";
  const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
}

function getMetaValue(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return (obj as Record<string, unknown>)[key];
}

export interface MediaState {
  filePath: string;
  fileSrc: string;
  fileName: string;
  isVideo: boolean;
  fileList: string[];
  currentIndex: number;
  fileSize: string;
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
  timestamps: Timestamp[];
  clipBoundaries: ClipBoundary[];
  resumePoint: number | null;
}

export function createMedia(
  videoElRef: () => HTMLVideoElement | null,
  getVolume: () => number,
  getMuted: () => boolean,
  getLooping: () => boolean,
  onReset: () => void,
) {
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let finishLoadingCalled = false;

  function finishLoading(set: (data: Partial<MediaState>) => void) {
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

  async function displayFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
  ) {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const isVideo = VIDEO_EXTS.includes(ext);

    set({
      filePath: path,
      fileName: getFileName(path),
      isVideo,
      fileSrc: convertFileSrc(path),
      fileSize: "",
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
      timestamps: isVideo ? readTimestamps(path) : [],
      clipBoundaries: isVideo ? readClipBoundaries(path) : [],
      resumePoint: isVideo ? loadResumePoint(path) : null,
    });

    onReset();

    try {
      const info = await stat(path);
      set({
        fileSize: formatFileSize(info.size),
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
    } catch {}
  }

  async function loadFile(
    path: string,
    set: (data: Partial<MediaState>) => void,
    setFileList: (list: string[], index: number) => void,
  ) {
    clearTimeout(loadingTimer);
    finishLoadingCalled = false;
    set({ isLoadingFile: true, loadingFadingOut: false });
    await displayFile(path, set);
    try {
      const list = await readMediaFilesInFolder(path);
      setFileList(list, list.indexOf(path));
    } catch {}
  }

  function navigate(
    direction: number,
    fileList: string[],
    currentIndex: number,
    set: (data: Partial<MediaState>) => void,
  ): number {
    if (fileList.length === 0) return currentIndex;
    const next = (currentIndex + direction + fileList.length) % fileList.length;
    displayFile(fileList[next], set);
    return next;
  }

  function navigateToEdge(
    first: boolean,
    fileList: string[],
    set: (data: Partial<MediaState>) => void,
  ): number {
    if (fileList.length === 0) return 0;
    const next = first ? 0 : fileList.length - 1;
    displayFile(fileList[next], set);
    return next;
  }

  function closeFile(set: (data: Partial<MediaState>) => void) {
    clearTimeout(loadingTimer);
    finishLoadingCalled = false;
    onReset();
    set({
      filePath: "",
      fileSrc: "",
      fileName: "no file open",
      isVideo: false,
      fileList: [],
      currentIndex: 0,
      playing: false,
      progress: 0,
      rawCurrentSecs: 0,
      rawDurationSecs: 0,
      fileSize: "",
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
  ) {
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
  ) {
    const videoEl = videoElRef();
    if (!videoEl) return;
    const volume = getVolume();
    const muted = getMuted();
    const looping = getLooping();
    videoEl.volume = volume;
    videoEl.muted = muted;
    videoEl.loop = looping;
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
