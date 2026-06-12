import { createMedia } from "$lib/features/media/media.svelte";
import { createFolderWatcher } from "$lib/features/navigation/folderWatcher.svelte";
import { editing } from "$lib/features/editing/editing.svelte";
import { markup } from "$lib/features/markup/markup.svelte";
import { markerStore } from "$lib/features/markers/markers.svelte";
import { viewer } from "$lib/features/viewer/viewer.svelte";
import { slideshow } from "$lib/features/media/slideshow.svelte";
import { menuStore } from "$lib/features/stores/menuVisibility.svelte";
import { corruption } from "$lib/features/media/corruption.svelte";
import {
  clearFolderCache,
  getParentFolder,
  getFileExt,
} from "$lib/services/files";
import {
  AUDIO_EXTS,
  type LoopMode,
  type SortMode,
} from "$lib/shared/constants";
import { sort } from "$lib/features/navigation/sort.svelte";
import { createPlaybackUI } from "$lib/features/media/playback.svelte";
import {
  createSetMediaState,
  type SetMediaState,
  type SetMediaStateSetters,
} from "./setMediaState";
import type { PdfState } from "$lib/features/pdf/pdf.svelte";

const PREV_DOUBLE_CLICK_MS = 1200;

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
      viewer.state.baseZoomLevel = 100;
      if (newPath) {
        editing.switchFile(newPath);
      } else {
        editing.cleanup();
        markup.cleanup();
      }
      menuStore.editMenuVisible = false;
    },
  );

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

  async function loadFile(path: string) {
    slideshow.stop();
    editing.exitCropMode();
    await media.loadFile(
      path,
      setMediaState,
      (list, index) => {
        deps.setFileList(list);
        deps.setCurrentIndex(index >= 0 ? index : 0);
      },
      deps.getSortMode(),
      deps.getSortDesc(),
    );
    // Start watching the parent folder
    const folder = getParentFolder(path);
    if (folder) folderWatcher.startWatching(folder);
  }

  async function navigate(direction: number) {
    if (deps.getFileList().length === 0) return;
    slideshow.stop();
    editing.exitCropMode();
    deps.setCurrentIndex(
      await media.navigate(
        direction,
        deps.getFileList(),
        deps.getCurrentIndex(),
        setMediaState,
      ),
    );
  }

  async function navigateToIndex(index: number) {
    const fileList = deps.getFileList();
    if (fileList.length === 0 || index === deps.getCurrentIndex()) return;
    slideshow.stop();
    editing.exitCropMode();
    deps.setCurrentIndex(index);
    await media.displayFile(fileList[index], setMediaState);
  }

  async function navigateToEdge(first: boolean) {
    if (deps.getFileList().length === 0) return;
    slideshow.stop();
    editing.exitCropMode();
    deps.setCurrentIndex(
      await media.navigateToEdge(first, deps.getFileList(), setMediaState),
    );
  }

  function navigateToAudioFile(direction: number) {
    const fileList = deps.getFileList();
    if (fileList.length === 0) return;
    let idx =
      (deps.getCurrentIndex() + direction + fileList.length) % fileList.length;
    const startIdx = idx;
    do {
      const ext = getFileExt(fileList[idx]);
      if (AUDIO_EXTS.includes(ext)) {
        slideshow.stop();
        editing.exitCropMode();
        deps.setCurrentIndex(idx);
        media.displayFile(fileList[idx], setMediaState);
        return;
      }
      idx = (idx + direction + fileList.length) % fileList.length;
    } while (idx !== startIdx);
    // No other audio file found — do nothing
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
    viewer.resetZoom();
    viewer.state.baseZoomLevel = 100;
    if (slideshow.active) slideshow.onMediaLoaded();
    // After metadata load, video intrinsic size may have changed.
    // If the mouse is no longer over the video wrapper, reset hover state
    // so arrow keys don't seek in a stale hover zone.
    const cropContainerEl = deps.getCropContainerEl();
    if (cropContainerEl && !cropContainerEl.matches(":hover")) {
      deps.setHoverZone("none");
    }
  }

  function onAudioLoad() {
    const audioEl = deps.getAudioEl();
    if (!audioEl) return;
    audioEl.volume = deps.getVolume();
    audioEl.playbackRate = deps.getPlaybackUI().playbackSpeed;
    audioEl.muted = deps.getMuted();
    audioEl.loop = deps.getLoopMode() === "loop";
    deps.getPlaybackUI().initSliderMode(true, true);
    setMediaState({
      fileDimensions: "",
      fileInfoLoading: false,
      rawCurrentSecs: 0,
      rawDurationSecs: audioEl.duration || 0,
      progress: 0,
      playing: !audioEl.paused,
    });
    if (deps.getIsLoadingFile()) media.finishLoading(setMediaState);
    if (slideshow.active) slideshow.onMediaLoaded();
    // After metadata load, if the mouse is no longer over the audio wrapper,
    // reset hover state so arrow keys don't seek in a stale hover zone.
    if (audioEl?.parentElement && !audioEl.parentElement.matches(":hover")) {
      deps.setHoverZone("none");
    }
  }

  function onSortChange(mode: SortMode, desc: boolean) {
    sort.change(mode, desc);
    // Re-sort the current folder
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
    setMediaState,
    folderWatcher,
    media,
  };
}
