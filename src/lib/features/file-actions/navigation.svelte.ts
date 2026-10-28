// File navigation
import { createMedia } from "$lib/features/media/media.svelte";
import { createFolderWatcher } from "$lib/features/navigation/folderWatcher.svelte";
import { editing } from "$lib/features/editing/editing.svelte";
import { library } from "$lib/features/library/library.svelte";
import { markup } from "$lib/features/markup/markup.svelte";
import { markerStore } from "$lib/features/markers/markers.svelte";
import { viewer } from "$lib/features/viewer/viewer.svelte";
import { slideshow } from "$lib/features/media/slideshow.svelte";
import { menuStore } from "$lib/features/menus/menuVisibility.svelte";

import { corruption } from "$lib/features/media/corruption.svelte";
import {
  clearFolderCache,
  getParentFolder,
  getFileExt,
} from "$lib/services/files";
import {
  isAudio as pathIsAudio,
  isVideo as pathIsVideo,
} from "$lib/shared/mediaKind";
import { backgroundAudio } from "$lib/features/media/backgroundAudio.svelte";
import { requestThumbnail } from "$lib/services/thumbnailCache";
import {
  AUDIO_EXTS,
  type LoopMode,
  type SortMode,
} from "$lib/shared/constants";
import { sort } from "$lib/features/navigation/sort.svelte";
import {
  createPlaybackUI,
  formatTime,
  volumeToActual,
} from "$lib/features/media/playback.svelte";
import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
import { showToast, dismissToast } from "$lib/components/toast.svelte";
import { saveResumePoint, deleteResumePoint } from "$lib/services/storage";
import {
  saveResumePoint as dbSaveResumePoint,
  deleteResumePoint as dbDeleteResumePoint,
} from "$lib/services/database";
import {
  createSetMediaState,
  type SetMediaState,
  type SetMediaStateSetters,
} from "./setMediaState";
import type { PdfState } from "$lib/features/viewer/pdf.svelte";

const PREV_DOUBLE_CLICK_MS = 1200;

async function closeVisualizers() {
  try {
    const { visualizerStore } =
      await import("$lib/features/visualizer/visualizer-store.svelte");
    visualizerStore.closeAll();
  } catch {
    // Non-critical — visualizers will be cleaned up on next call
  }
}

export interface NavigationDeps extends SetMediaStateSetters {
  getFilePath: () => string;
  getFileList: () => string[];
  getCurrentIndex: () => number;
  getIsLoadingFile: () => boolean;
  getVolume: () => number;
  getMuted: () => boolean;
  getLoopMode: () => LoopMode;
  getVideoEl: () => HTMLVideoElement | null;
  getAudioEl: () => HTMLAudioElement | null;
  getFsPillEl: () => HTMLButtonElement | null;
  getPendingPlay: () => ReturnType<typeof setTimeout> | undefined;
  getCropContainerEl: () => HTMLElement | null;
  getSortMode: () => SortMode;
  getSortDesc: () => boolean;
  getPlaybackUI: () => ReturnType<typeof createPlaybackUI>;
  getViewerEl: () => HTMLElement | null;
  getViewerContentSize: () => { width: number; height: number };
  getLastPrevClickTime: () => number;
  getThumbnailBarVisible: () => boolean;
  getResetZoom: () => () => void;
  setLastPrevClickTime: (v: number) => void;
  setThumbnailBarVisible: (v: boolean) => void;
  setHoverZone: (v: string) => void;
  pdf: { state: PdfState; cleanup: () => void };
}

export function createNavigation(deps: NavigationDeps) {
  const setMediaState: SetMediaState = createSetMediaState(deps);

  const media = createMedia(
    deps.getVideoEl,
    deps.getAudioEl,
    deps.getVolume,
    deps.getMuted,
    () => deps.getLoopMode() === "loop",
    (newPath?: string) => {
      markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
      markerStore.tsEditMenu = { ...markerStore.tsEditMenu, visible: false };
      markerStore.loopStart = null;
      markerStore.loopEnd = null;
      deps.getResetZoom()();
      if (!viewer.state.zoomLocked) viewer.state.baseZoomLevel = 100;
      if (newPath) {
        editing.switchFile(newPath);
        markup.switchFile(newPath);
      } else {
        editing.cleanup();
        markup.cleanup();
      }
      menuStore.editMenuVisible = false;
    },
    handleBeforeSwitch,
  );

  function handleBeforeSwitch(_nextPath: string) {
    saveCurrentPosition();
    switching = true;
    if (switchTimer) clearTimeout(switchTimer);
    switchTimer = setTimeout(() => {
      switching = false;
      switchTimer = undefined;
    }, 400);
    backgroundAudio.stop();
    backgroundAudio.clearPendingSeek();
  }

  let resumeAppliedPath = "";
  let switching = false;
  let switchTimer: ReturnType<typeof setTimeout> | undefined;

  function clearSavedResume(path: string) {
    deleteResumePoint(path);
    void dbDeleteResumePoint(path);
    markerStore.resumePoint = null;
  }

  function saveCurrentPosition() {
    resumeAppliedPath = "";
    if (switching) return;
    if (playbackPrefs.resumeMode === "off") return;
    const path = deps.getFilePath();
    if (!path) return;
    if (!pathIsAudio(path) && !pathIsVideo(path)) return;
    const el = pathIsVideo(path) ? deps.getVideoEl() : deps.getAudioEl();
    if (!el) return;
    const cur = el.currentTime;
    const dur = Number.isFinite(el.duration) ? el.duration : 0;
    if (!Number.isFinite(cur) || cur <= 0) return;
    if (dur > 0 && cur >= dur - 1.5) {
      clearSavedResume(path);
      return;
    }
    saveResumePoint(path, cur);
    void dbSaveResumePoint(path, cur);
  }

  function maybeResume(el: HTMLMediaElement) {
    const path = deps.getFilePath();
    const point = markerStore.resumePoint;
    if (!path || point === null || point <= 0) return;
    if (resumeAppliedPath === path) return;
    if (slideshow.active) return;
    const dur = Number.isFinite(el.duration) ? el.duration : 0;
    if (dur > 0 && point >= dur - 10) {
      clearSavedResume(path);
      return;
    }
    if (point < playbackPrefs.resumeThreshold) return;
    resumeAppliedPath = path;

    if (playbackPrefs.resumeMode === "always") {
      el.currentTime = point;
      showToast({
        message: `Resumed from ${formatTime(point)}`,
        color: "blue",
        duration: 4500,
        actions: [
          {
            label: "Start over",
            variant: "default",
            onClick: () => {
              if (deps.getFilePath() !== path) return;
              clearSavedResume(path);
              el.currentTime = 0;
            },
          },
        ],
      });
      return;
    }

    const id = showToast({
      message: `Resume from ${formatTime(point)}?`,
      color: "blue",
      duration: 12000,
      actions: [
        {
          label: "Resume",
          variant: "green",
          onClick: () => {
            if (deps.getFilePath() !== path) return;
            el.currentTime = point;
            el.play().catch(() => {});
            dismissToast(id);
          },
        },
        {
          label: "Start over",
          variant: "default",
          onClick: () => {
            if (deps.getFilePath() !== path) return;
            clearSavedResume(path);
            el.currentTime = 0;
            dismissToast(id);
          },
        },
      ],
    });
  }

  const folderWatcher = createFolderWatcher({
    getFilePath: deps.getFilePath,
    getFileList: deps.getFileList,
    getCurrentIndex: deps.getCurrentIndex,
    getSortMode: deps.getSortMode,
    getSortDesc: deps.getSortDesc,
    setFileList: deps.setFileList,
    setCurrentIndex: deps.setCurrentIndex,
    loadFile: (path: string) => loadFile(path),
    closeFile: () => closeFile(),
  });

  async function loadFile(path: string, refresh = false) {
    slideshow.stop();
    editing.exitCropMode();
    let loadedIndex = -1;
    await media.loadFile(
      path,
      setMediaState,
      (list, index) => {
        loadedIndex = index >= 0 ? index : 0;
        deps.setFileList(list);
        deps.setCurrentIndex(loadedIndex);
      },
      (deps.getSortMode() === "date-opened"
        ? "date-modified"
        : deps.getSortMode()) as "name" | "date-modified" | "size" | "type",
      deps.getSortDesc(),
      refresh,
    );
    const folder = getParentFolder(path);
    if (folder) folderWatcher.startWatching(folder);
    if (loadedIndex >= 0) {
      media.prefetchAdjacent(deps.getFileList(), loadedIndex);
      // Warm thumbnail cache center-outward while the bar transition plays
      const files = deps.getFileList();
      const count = Math.min(24, files.length);
      const order: number[] = [loadedIndex];
      let l = loadedIndex - 1;
      let r = loadedIndex + 1;
      while (order.length < count && (l >= 0 || r < files.length)) {
        if (l >= 0) order.push(l--);
        if (r < files.length) order.push(r++);
      }
      for (const idx of order) {
        requestThumbnail(files[idx], 120);
      }
      // Warm library-sized thumbnails (fewer — first screen only)
      const libCount = Math.min(8, order.length);
      for (let i = 0; i < libCount; i++) {
        requestThumbnail(files[order[i]], 256);
      }
    }
  }

  async function navigate(direction: number) {
    if (deps.getFileList().length === 0) return;
    if (!menuStore.effectsMenuVisible) {
      await closeVisualizers();
    }
    slideshow.stop();
    editing.exitCropMode();
    try {
      const next = await media.navigate(
        direction,
        deps.getFileList(),
        deps.getCurrentIndex(),
        setMediaState,
      );
      deps.setCurrentIndex(next);
      library.addRecent(deps.getFileList()[next]);
      media.prefetchAdjacent(deps.getFileList(), next);
    } catch (e) {
      console.error("Navigation failed:", e);
    }
  }

  async function navigateToIndex(index: number) {
    const fileList = deps.getFileList();
    if (fileList.length === 0 || index === deps.getCurrentIndex()) return;
    if (!menuStore.effectsMenuVisible) {
      await closeVisualizers();
    }
    slideshow.stop();
    editing.exitCropMode();
    deps.setCurrentIndex(index);
    await media.displayFile(fileList[index], setMediaState);
    library.addRecent(fileList[index]);
    media.prefetchAdjacent(fileList, index);
  }

  async function navigateToEdge(first: boolean) {
    if (deps.getFileList().length === 0) return;
    if (!menuStore.effectsMenuVisible) {
      await closeVisualizers();
    }
    slideshow.stop();
    editing.exitCropMode();
    const next = await media.navigateToEdge(
      first,
      deps.getFileList(),
      setMediaState,
    );
    deps.setCurrentIndex(next);
    library.addRecent(deps.getFileList()[next]);
    media.prefetchAdjacent(deps.getFileList(), next);
  }

  async function navigateToAudioFile(direction: number) {
    const fileList = deps.getFileList();
    if (fileList.length === 0) return;
    let idx =
      (deps.getCurrentIndex() + direction + fileList.length) % fileList.length;
    const startIdx = idx;
    do {
      const ext = getFileExt(fileList[idx]);
      if (AUDIO_EXTS.includes(ext)) {
        if (!menuStore.effectsMenuVisible) {
          await closeVisualizers();
        }
        slideshow.stop();
        editing.exitCropMode();
        deps.setCurrentIndex(idx);
        await media.displayFile(fileList[idx], setMediaState);
        media.prefetchAdjacent(fileList, idx);
        return;
      }
      idx = (idx + direction + fileList.length) % fileList.length;
    } while (idx !== startIdx);
  }

  function handlePrevClick() {
    const now = Date.now();
    if (now - deps.getLastPrevClickTime() < PREV_DOUBLE_CLICK_MS) {
      // Double-click: navigate to previous audio file
      navigateToAudioFile(-1);
    } else {
      // Single click: restart current audio from beginning
      const audioEl = deps.getAudioEl();
      if (audioEl && audioEl.duration) {
        audioEl.currentTime = 0;
        audioEl.play().catch(() => {});
        deps.setPlaying(true);
      }
    }
    deps.setLastPrevClickTime(now);
  }

  function handleNextClick() {
    navigateToAudioFile(1);
  }

  function toggleThumbnailBar() {
    deps.setThumbnailBarVisible(!deps.getThumbnailBarVisible());
  }

  function closeFile() {
    slideshow.stop();
    folderWatcher.stopWatching();
    clearTimeout(deps.getPendingPlay());
    markerStore.resumeTooltipVisible = false;
    editing.cleanup();
    markup.cleanup();
    viewer.state.zoomLevel = 100;
    viewer.state.baseZoomLevel = 100;
    viewer.state.translateX = 0;
    viewer.state.translateY = 0;
    media.closeFile(setMediaState);
    deps.pdf.cleanup();
    deps.setMediaProps(null);
    deps.setMediaPropsLoading(false);
    clearFolderCache();
    corruption.reset();
  }

  function onImageLoad(e: Event) {
    media.onImageLoad(e, deps.getIsLoadingFile(), setMediaState, () =>
      media.finishLoading(setMediaState),
    );
    const img = e.target as HTMLImageElement;
    const viewerEl = deps.getViewerEl();
    if (viewerEl && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const { width, height } = deps.getViewerContentSize();
      viewer.fitToScreen(width, height, img.naturalWidth, img.naturalHeight);
    }
    if (slideshow.active) slideshow.onMediaLoaded();
  }

  function onVideoLoad() {
    media.onVideoLoad(deps.getIsLoadingFile(), setMediaState, () =>
      media.finishLoading(setMediaState),
    );
    const video = deps.getVideoEl();
    if (video) {
      const speed = playbackPrefs.rememberSpeed
        ? deps.getPlaybackUI().playbackSpeed
        : playbackPrefs.defaultSpeed;
      if (!playbackPrefs.rememberSpeed) {
        deps.getPlaybackUI().setPlaybackSpeed(speed);
      }
      video.playbackRate = speed;
      maybeResume(video);
    }
    if (
      viewer.state.zoomLocked ||
      !video ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0 ||
      !deps.getViewerEl()
    ) {
      viewer.resetZoom();
      if (!viewer.state.zoomLocked) viewer.state.baseZoomLevel = 100;
    } else {
      const { width, height } = deps.getViewerContentSize();
      viewer.fitToScreen(width, height, video.videoWidth, video.videoHeight);
    }
    if (slideshow.active) slideshow.onMediaLoaded();
    // Reset hover state after metadata load if mouse moved off video
    const cropContainerEl = deps.getCropContainerEl();
    if (cropContainerEl && !cropContainerEl.matches(":hover")) {
      deps.setHoverZone("none");
    }
  }

  function onAudioLoad() {
    const audioEl = deps.getAudioEl();
    if (!audioEl) return;
    if (!playbackPrefs.rememberSpeed) {
      deps.getPlaybackUI().setPlaybackSpeed(playbackPrefs.defaultSpeed);
    }
    audioEl.volume = volumeToActual(deps.getVolume());
    audioEl.playbackRate = deps.getPlaybackUI().playbackSpeed;
    audioEl.muted = deps.getMuted();
    audioEl.loop = deps.getLoopMode() === "loop";
    deps.getPlaybackUI().initSliderMode(true, true);
    const pendingSeek = backgroundAudio.consumePendingSeek(deps.getFilePath());
    if (pendingSeek !== null) {
      audioEl.currentTime = pendingSeek;
    } else {
      maybeResume(audioEl);
    }
    if (playbackPrefs.autoplay) {
      audioEl.play().catch(() => {});
    }
    setMediaState({
      fileDimensions: "",
      fileInfoLoading: false,
      rawCurrentSecs: 0,
      rawDurationSecs: audioEl.duration || 0,
      progress: 0,
      playing: playbackPrefs.autoplay && !audioEl.paused,
    });
    if (deps.getIsLoadingFile()) media.finishLoading(setMediaState);
    if (slideshow.active) slideshow.onMediaLoaded();
    // Reset hover state after metadata load if mouse moved off audio
    if (audioEl?.parentElement && !audioEl.parentElement.matches(":hover")) {
      deps.setHoverZone("none");
    }
  }

  function onSortChange(mode: SortMode, desc: boolean) {
    sort.change(mode, desc);
    const filePath = deps.getFilePath();
    if (filePath) {
      const folder = getParentFolder(filePath);
      if (folder) folderWatcher.onFolderChanged(folder);
    }
  }

  function handleFsPillContext(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deps.getFileList().length === 0) return;
    const fsPillEl = deps.getFsPillEl();
    if (fsPillEl) {
      const rect = fsPillEl.getBoundingClientRect();
      sort.toggleAt(rect.left, window.innerHeight - rect.top + 4);
    } else {
      sort.toggle();
    }
  }

  async function advanceSlide(nextIndex: number) {
    if (deps.getFileList().length === 0) return;
    editing.exitCropMode();
    deps.setCurrentIndex(nextIndex);
    await media.displayFile(deps.getFileList()[nextIndex], setMediaState);
    media.prefetchAdjacent(deps.getFileList(), nextIndex);
  }

  return {
    loadFile,
    navigate,
    navigateToIndex,
    navigateToEdge,
    navigateToAudioFile,
    handlePrevClick,
    handleNextClick,
    toggleThumbnailBar,
    closeFile,
    onImageLoad,
    onVideoLoad,
    onAudioLoad,
    onSortChange,
    handleFsPillContext,
    advanceSlide,
    saveCurrentPosition,
    setMediaState,
    folderWatcher,
    media,
  };
}
