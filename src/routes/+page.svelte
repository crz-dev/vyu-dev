<script lang="ts">
  import { untrack } from "svelte";
  import {
    createPlaybackUI,
    formatTime,
  } from "$lib/features/media/playback.svelte";
  import { createClips } from "$lib/features/media/clips.svelte";
  import {
    createScrubbingActions,
    discScrubStore,
  } from "$lib/features/media/scrubbing.svelte";
  import { loopModeStore } from "$lib/features/media/loopMode.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
  import { sleepTimer } from "$lib/features/media/sleepTimer.svelte";
  import { backgroundAudio } from "$lib/features/media/backgroundAudio.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { isTypingTarget } from "$lib/features/keybinds/keybindUtils";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import { invokeSetKeepAwake } from "$lib/features/system/api";
  import {
    createOnMediaEnded,
    createFrameStep,
  } from "$lib/features/media/playbackHelpers";
  import { timerStore } from "$lib/features/media/timer.svelte";
  import { createPlaybackBridge } from "$lib/features/media/playbackBridge";
  import { createPlaybackPoller } from "$lib/features/media/playbackPoller.svelte";
  import {
    markerStore,
    createMarkerActions,
  } from "$lib/features/markers/markers.svelte";
  import { createKeybindHandler } from "$lib/shared/keybinds";
  import {
    VOLUME_SEGMENTS,
    VOLUME_STEP,
    type LoopMode,
  } from "$lib/shared/constants";
  import type { MediaProperties } from "$lib/shared/types";
  import {
    saveLoopMode,
    saveVolume,
    loadAudioLayoutMode,
    loadPlaybackSpeed,
    savePlaybackSpeed,
  } from "$lib/services/storage";
  import { createFfmpegHelpers } from "$lib/features/media/ffmpeg";
  import { invokeOpenDirectory } from "$lib/features/media/api";
  import {
    showFilenameTooltip,
    hideFilenameTooltip,
  } from "$lib/services/filenameTooltip";
  import { obscurePath } from "$lib/shared/privacy";
  import { library } from "$lib/features/library/library.svelte";
  import { showValue } from "$lib/services/clipboard";
  import {
    getParentFolder,
    getFileExt,
    clearFolderCache,
  } from "$lib/services/files";
  import { viewer } from "$lib/features/viewer/viewer.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import { markup } from "$lib/features/markup/markup.svelte";

  import { showToast } from "$lib/components/toast.svelte";
  import Shell from "$lib/components/Shell.svelte";
  import NowPlayingPill from "$lib/components/NowPlayingPill.svelte";
  import { createContextActionFns } from "$lib/features/actions/contextActionWrappers";
  import { createPropertiesActions } from "$lib/features/actions/propertiesActions";
  import { contextMenuStore } from "$lib/features/menus/contextMenu.svelte";
  import { createGlobalMouseHandler } from "$lib/features/actions/globalMouseHandler";
  import ApplyEditDialog from "$lib/features/dialogs/ApplyEditDialog.svelte";
  import TransparencyConfirmDialog from "$lib/features/dialogs/TransparencyConfirmDialog.svelte";
  import { setupInit } from "$lib/services/init";
  import { createPdf } from "$lib/features/viewer/pdf.svelte";
  import { corruption } from "$lib/features/media/corruption.svelte";
  import { sort } from "$lib/features/navigation/sort.svelte";
  import {
    minimizeWindow,
    maximizeWindow,
    closeWindow,
  } from "$lib/features/menus/windowControls";
  import { createFileOpenActions } from "$lib/features/file-actions/fileOpen";
  import { createNavigation } from "$lib/features/file-actions/navigation.svelte";
  import { createPanDrag } from "$lib/features/viewer/panDrag";
  import { createViewerEffects } from "$lib/features/viewer/viewerEffects.svelte";
  import { createViewerStyle } from "$lib/features/viewer/viewerStyle.svelte";
  import ViewerArea from "$lib/features/viewer/ViewerArea.svelte";
  import {
    createDeleteActions,
    performMultiDelete,
    deleteStore,
  } from "$lib/features/file-actions/deleteFile.svelte";
  import {
    menuStore,
    createMenuActions,
    createMenuBindings,
    areDialogsOpen,
  } from "$lib/features/menus/menuVisibility.svelte";
  import {
    editDialogStore,
    createEditActions,
  } from "$lib/features/editing/editActions.svelte";
  import { eqStore } from "$lib/features/equalizer/equalizer-store.svelte";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import { effectsStore } from "$lib/features/effects/effects-store.svelte";
  import {
    buildTimelineProps,
    buildAudioMarkerProps,
    buildPlaybackProps,
  } from "$lib/shared/pageProps";

  let filePath = $state("");
  let fileSrc = $state("");
  let fileName = $state("no file open");
  let isVideo = $state(false);
  let isAudio = $state(false);
  let isPdf = $state(false);
  let cdColor = $state("var(--green)");
  let cdColorIndex = $state(0);
  let showCdColorPicker = $state(false);
  let coverArtSrc = $state("");
  let fileList: string[] = $state([]);
  let currentIndex = $state(0);
  let fileSize = $state("");
  let fileSizeBytes = $state(0);
  let fileDimensions = $state("");
  let fileCreated = $state("");
  let fileModified = $state("");
  let fileInfoLoading = $state(false);
  let isLoadingFile = $state(false);
  let loadingFadingOut = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let cropContainerEl = $state<HTMLElement | null>(null);
  let imageEl = $state<HTMLImageElement | null>(null);
  let viewerEl = $state<HTMLElement | null>(null);
  let pdfContainerEl = $state<HTMLElement | null>(null);
  let pdfRightClickedCanvas = $state<HTMLCanvasElement | null>(null);
  let playing = $state(false);
  let muted = $state(false);
  let progress = $state(0);
  let rawCurrentSecs = $state(0);
  let rawDurationSecs = $state(0);
  let imageNaturalWidth = $state(0);
  let imageNaturalHeight = $state(0);
  let volume = $state(1);
  let hoverZone = $state("none");
  let dragStart = $state({ x: 0, y: 0, tx: 0, ty: 0 });
  let lastLeftClickTime = 0;
  let pendingPlay: ReturnType<typeof setTimeout> | undefined;
  let isScrubbing = $state(false);
  let propertiesOpen = $state(false);
  let shareOpen = $state(false);
  let audioLayoutMode: "retro" | "modern" = $state(loadAudioLayoutMode());
  let cassetteFilenameOverflow = $state(false);
  let cassetteInfoRowEl = $state<HTMLElement | null>(null);
  let lastPrevClickTime = $state(0);
  let volumeTrackEl: HTMLDivElement | null = $state(null);
  let speedTrackEl: HTMLDivElement | null = $state(null);
  let bgAudioEl: HTMLAudioElement | null = $state(null);
  let thumbnailBarVisible = $state(false);
  let fsPillEl: HTMLButtonElement | null = $state(null);
  let volumeSliderMode = $state(false);
  let speedSliderMode = $state(false);
  let mediaProps = $state<MediaProperties | null>(null);
  let mediaPropsLoading = $state(false);

  const menuActions = createMenuActions({
    closeContextMenu,
    getFilePath: () => filePath,
    setEditingFilePath: (path) => editing.setFilePath(path),
  });
  const {
    openEditMenu,
    closeEditMenu,
    openMarkupMenu,
    closeMarkupMenu,
    openEffectsMenu,
    closeEffectsMenu,
    openEqualizerMenu,
    closeEqualizerMenu,
    toggleSlideshowMenu,
    closeSlideshowMenu,
  } = menuActions;
  const menuBindings = createMenuBindings();
  const { runLoadMediaProperties } = createFfmpegHelpers({
    filePath: () => filePath,
    setMediaProps: (v) => (mediaProps = v),
    setMediaPropsLoading: (v) => (mediaPropsLoading = v),
  });

  const style = createViewerStyle();
  const pdf = createPdf();
  const isGifVideo = $derived(isVideo && getFileExt(filePath) === "gif");
  const clips = createClips({
    getFilePath: () => filePath,
    getRawDurationSecs: () => rawDurationSecs,
    getIsVideo: () => isVideo,
    getVideoEl: () => videoEl,
    getAudioEl: () => audioEl,
    getFileParentFolder: () => getParentFolder(filePath),
  });
  const durationDisplay = $derived(formatTime(rawDurationSecs));
  const anyMenuOpen = $derived(
    areDialogsOpen({
      contextMenuStore,
      menuStore,
      markerStore,
      deleteStore,
      propertiesOpen,
      shareOpen,
      clips,
      editDialogStore,
      corruption,
      sort,
    }),
  );

  const viewerFx = createViewerEffects({
    getVideoEl: () => videoEl,
    getViewerEl: () => viewerEl,
    getFileSrc: () => fileSrc,
    getIsVideo: () => isVideo,
    getIsPdf: () => isPdf,
    getImageNaturalWidth: () => imageNaturalWidth,
    getImageNaturalHeight: () => imageNaturalHeight,
    getPdfPageDimensions: () =>
      pdf.state.pages.map((page) => ({
        width: page.width,
        height: page.height,
      })),
    getPdfAutoFit: () => pdf.state.autoFit,
    setPdfScale: pdf.setScale,
    fitPdfToScreen: (width, height) => pdf.fitToScreen(width, height),
    getThumbnailBarVisible: () => thumbnailBarVisible,
    getIsFullscreen: () => viewer.state.isFullscreen,
  });
  $effect(viewerFx.setVideoElEffect);
  $effect(viewerFx.resizeObserverEffect);
  $effect(viewerFx.refitOnChangeEffect);
  $effect(() => {
    const poller = createPlaybackPoller({
      getIsVideo: () => isVideo,
      getIsAudio: () => isAudio,
      getVideoEl: () => videoEl,
      getAudioEl: () => audioEl,
      getIsScrubbing: () => isScrubbing,
      setRawCurrentSecs: (v) => (rawCurrentSecs = v),
      setProgress: (v) => (progress = v),
      setPlaying: (v) => (playing = v),
    });
    try {
      return poller();
    } catch (e) {
      console.error("Playback poller effect failed:", e);
    }
  });
  const {
    getViewerContentSize,
    resetZoom,
    handleToggleZoomLock,
    handleViewerScroll,
    toggleFullscreen,
  } = viewerFx;

  const getMediaEl = () => (isVideo ? videoEl : isAudio ? audioEl : null);

  function resetView() {
    resetZoom();
    if (!isPdf) editing.clearEdits();
  }

  function hasPlayback() {
    return playing || backgroundAudio.playing;
  }

  function pausePlayback() {
    getMediaEl()?.pause();
    backgroundAudio.pause();
  }
  const playbackUI = createPlaybackUI(
    getMediaEl,
    () => volume,
    (v) => {
      volume = v;
      if (playbackPrefs.rememberVolume) saveVolume(v);
    },
    (speed) => {
      if (playbackPrefs.rememberSpeed) savePlaybackSpeed(speed);
    },
    playbackPrefs.rememberSpeed
      ? loadPlaybackSpeed()
      : playbackPrefs.defaultSpeed,
  );
  effectsStore.setPlaybackSpeedFn((speed) =>
    playbackUI.setPlaybackSpeed(speed),
  );
  effectsStore.setBackgroundPlaybackSpeedFn((speed) =>
    playbackUI.setPlaybackRateDirect(speed),
  );
  const scrubbing = createScrubbingActions({
    getIsVideo: () => isVideo,
    getAudioEl: () => audioEl,
    getVideoEl: () => videoEl,
    setRawCurrentSecs: (v) => (rawCurrentSecs = v),
    setProgress: (v) => (progress = v),
    setIsScrubbing: (v) => (isScrubbing = v),
  });
  const { startScrubbing, startDiscScrubbing } = scrubbing;
  const playbackBridge = createPlaybackBridge({
    getMediaEl,
    getPlaying: () => playing,
    setPlaying: (v) => (playing = v),
    getMuted: () => muted,
    setMuted: (v) => (muted = v),
    setVolume: (v) => (volume = v),
    getVolumeSliderMode: () => volumeSliderMode,
    setVolumeSliderMode: (v) => (volumeSliderMode = v),
    getSpeedSliderMode: () => speedSliderMode,
    setSpeedSliderMode: (v) => (speedSliderMode = v),
    playbackUI,
  });
  const {
    togglePlay,
    toggleMute,
    setVolume,
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
  } = playbackBridge;
  function setLoopMode(mode: LoopMode) {
    loopModeStore.setLoopMode(
      mode,
      () => videoEl,
      () => audioEl,
    );
  }
  function toggleTimer() {
    timerStore.toggleTimer();
  }
  function currentTimeDisplay(): string {
    return timerStore.currentTimeDisplay(
      () => rawCurrentSecs,
      () => rawDurationSecs,
    );
  }
  const audioBitrateDisplay = $derived(
    timerStore.audioBitrateDisplay(
      () => fileSizeBytes,
      () => rawDurationSecs,
      () => isAudio,
    ),
  );
  const timerTooltip = $derived(timerStore.timerTooltip());
  const markerActions = createMarkerActions({
    getFilePath: () => filePath,
    getRawDurationSecs: () => rawDurationSecs,
    getLoopMode: () => loopModeStore.loopMode,
    getMediaEl: () => (isVideo ? videoEl : isAudio ? audioEl : null),
    formatTime,
    clips,
    onClipMenuReopen: () => clips.bumpMenuResetKey(),
    setRawCurrentSecs: (v: number) => (rawCurrentSecs = v),
    setProgress: (v: number) => (progress = v),
  });
  const {
    addTimestamp,
    removeTimestamp,
    clearAllTimestamps,
    getTimestampPct,
    clearABLoop,
    addLoopStart,
    addLoopEnd,
    clearLoopMarkers,
    startLoopMarkerDrag,
    startTimestampDrag,
    startClipMarkerDrag,
    seekToTimestamp,
    removeResumePoint,
    seekToResumePoint,
    showResumeTooltip,
    hideResumeTooltip,
    showTimestampTooltip,
    showLoopMarkerTooltip,
    showClipBoundaryTooltip,
    hideTsTooltip,
    openTimestampEditor,
    openSegmentEditor,
    closeTimestampEditor,
    getActiveEditorTimestamp,
    getActiveEditorSegment,
    getEditorTitle,
    updateEditorTitle,
    onEditorScissor,
    onEditorDeleteTimestamp,
    onEditorDeleteSegment,
    getTitleEditorWidthCh,
    removeClipBoundary,
  } = markerActions;

  const timelineProps = $derived(
    buildTimelineProps({
      progress,
      currentTimeSecs: rawCurrentSecs,
      isGifVideo,
      clipPairs: clips.clipPairs,
      clipBoundaries: clips.clipBoundaries,
      timestamps: markerStore.timestamps,
      abLoopRegion: markerStore.abLoopRegion,
      loopStart: markerStore.loopStart,
      loopEnd: markerStore.loopEnd,
      resumePoint: markerStore.resumePoint,
      durationSecs: rawDurationSecs,
      clipMarkerJustDragged: clips.clipMarkerJustDragged,
      tsEditMenuVisible: markerStore.tsEditMenu.visible,
      startScrubbing,
      getTimestampPct,
      startClipMarkerDrag,
      removeClipBoundary,
      showClipBoundaryTooltip,
      hideTsTooltip,
      seekToTimestamp,
      openSegmentEditor,
      startTimestampDrag,
      timestampDragJustEnded: markerStore.timestampDragJustEnded,
      removeTimestamp,
      showTimestampTooltip,
      openTimestampEditor,
      showResumeTooltip,
      hideResumeTooltip,
      seekToResumePoint,
      removeResumePoint,
      clearABLoop,
      formatTime,
      startLoopMarkerDrag,
      loopMarkerJustDragged: markerStore.loopMarkerJustDragged,
      showLoopMarkerTooltip,
    }),
  );
  const audioMarkerProps = $derived(
    buildAudioMarkerProps({
      clipPairs: clips.clipPairs,
      abLoopRegion: markerStore.abLoopRegion,
      clipMarkerJustDragged: clips.clipMarkerJustDragged,
      timestampDragJustEnded: markerStore.timestampDragJustEnded,
      loopMarkerJustDragged: markerStore.loopMarkerJustDragged,
      getTimestampPct,
      startClipMarkerDrag,
      removeClipBoundary,
      showClipBoundaryTooltip,
      hideTsTooltip,
      seekToTimestamp,
      openSegmentEditor,
      startTimestampDrag,
      removeTimestamp,
      showTimestampTooltip,
      openTimestampEditor,
      showResumeTooltip,
      hideResumeTooltip,
      seekToResumePoint,
      removeResumePoint,
      clearABLoop,
      formatTime,
      startLoopMarkerDrag,
      showLoopMarkerTooltip,
    }),
  );
  const playbackProps = $derived(
    buildPlaybackProps({
      isGifVideo,
      isAudio,
      playing,
      looping: loopModeStore.loopMode,
      muted,
      volume,
      volumeHovered: playbackUI.volumeHovered,
      volumeSegments: VOLUME_SEGMENTS,
      togglePlay,
      setLoopMode,
      toggleMute,
      showVolumeOverlay: playbackUI.showVolumeOverlay,
      handleVolumeAreaLeave: playbackUI.handleVolumeAreaLeave,
      handleVolumeScroll: playbackUI.handleVolumeScroll,
      startVolumeDrag: playbackUI.startVolumeDrag,
      handleVolumeDiamondHover: playbackUI.handleVolumeDiamondHover,
      setVolume,
      playbackSpeed: playbackUI.playbackSpeed,
      speedHovered: playbackUI.speedHovered,
      setPlaybackSpeed: playbackUI.setPlaybackSpeed,
      showSpeedOverlay: playbackUI.showSpeedOverlay,
      handleSpeedAreaLeave: playbackUI.handleSpeedAreaLeave,
      handleSpeedScroll: playbackUI.handleSpeedScroll,
      handleSpeedDiamondHover: playbackUI.handleSpeedDiamondHover,
      startSpeedDrag: playbackUI.startSpeedDrag,
      addTimestamp,
      addClipStart: () => clips.addClipBoundaryFromMedia("start"),
      addClipEnd: () => clips.addClipBoundaryFromMedia("end"),
      addLoopStart,
      addLoopEnd,
      hasLoopStart: markerStore.loopStart !== null,
      hasLoopEnd: markerStore.loopEnd !== null,
      hasAnyMarkers:
        markerStore.timestamps.length > 0 ||
        clips.clipBoundaries.length > 0 ||
        markerStore.resumePoint !== null ||
        markerStore.loopStart !== null ||
        markerStore.loopEnd !== null,
      deleteAllMarkers: () => {
        clearAllTimestamps();
        clips.clearBoundaries();
        removeResumePoint();
        clearLoopMarkers();
        showToast({ message: "Markers cleared", color: "yellow" });
      },
      toggleTimer,
      currentTimeDisplay,
      durationDisplay,
      timerTooltip,
      toggleFullscreen,
      onTsMenuChange: (v: boolean) => (menuStore.tsMenuOpen = v),
      volumeSliderMode: playbackUI.volumeSliderMode || volumeSliderMode,
      speedSliderMode: playbackUI.speedSliderMode || speedSliderMode,
      volumeSliderValue: playbackUI.volumeSliderValue,
      speedSliderValue: playbackUI.speedSliderValue,
      toggleVolumeSliderMode,
      toggleSpeedSliderMode,
      startVolumeSliderDrag: playbackUI.startVolumeSliderDrag,
      startSpeedSliderDrag: playbackUI.startSpeedSliderDrag,
      handleVolumeSliderChange: playbackUI.handleVolumeSliderChange,
      handleSpeedSliderChange: playbackUI.handleSpeedSliderChange,
      showVolumeSliderTooltip: playbackUI.showVolumeSliderTooltip,
      hideVolumeSliderTooltip: playbackUI.hideVolumeSliderTooltip,
      showSpeedSliderTooltip: playbackUI.showSpeedSliderTooltip,
      hideSpeedSliderTooltip: playbackUI.hideSpeedSliderTooltip,
      volumeDragging: playbackUI.volumeDragging,
      speedDragging: playbackUI.speedDragging,
    }),
  );

  const navigation = createNavigation({
    setFilePath: (v) => (filePath = v),
    setFileSrc: (v) => (fileSrc = v),
    setFileName: (v) => (fileName = v),
    setIsVideo: (v) => (isVideo = v),
    setIsAudio: (v) => (isAudio = v),
    setIsPdf: (v) => (isPdf = v),
    setFileList: (v) => (fileList = v),
    setCurrentIndex: (v) => (currentIndex = v),
    setFileSize: (v) => (fileSize = v),
    setFileSizeBytes: (v) => (fileSizeBytes = v),
    setFileDimensions: (v) => (fileDimensions = v),
    setFileCreated: (v) => (fileCreated = v),
    setFileModified: (v) => (fileModified = v),
    setFileInfoLoading: (v) => (fileInfoLoading = v),
    setIsLoadingFile: (v) => (isLoadingFile = v),
    setLoadingFadingOut: (v) => (loadingFadingOut = v),
    setImageNaturalWidth: (v) => (imageNaturalWidth = v),
    setImageNaturalHeight: (v) => (imageNaturalHeight = v),
    setRawCurrentSecs: (v) => (rawCurrentSecs = v),
    setRawDurationSecs: (v) => (rawDurationSecs = v),
    setProgress: (v) => (progress = v),
    setPlaying: (v) => (playing = v),
    setRotation: (v) => editing.setRotation(v),
    setFlipped: (v) => (editing.snapshot.flipped = v),
    setCdColor: (v) => (cdColor = v),
    setCdColorIndex: (v) => (cdColorIndex = v),
    setCoverArtSrc: (v) => (coverArtSrc = v),
    setMediaProps: (v) => (mediaProps = v),
    setMediaPropsLoading: (v) => (mediaPropsLoading = v),
    setBoundaries: (v) => clips.setBoundaries(v),
    getFilePath: () => filePath,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    getIsLoadingFile: () => isLoadingFile,
    getVolume: () => volume,
    getMuted: () => muted,
    getLoopMode: () => loopModeStore.loopMode,
    getVideoEl: () => videoEl,
    getAudioEl: () => audioEl,
    getFsPillEl: () => fsPillEl,
    getPendingPlay: () => pendingPlay,
    getCropContainerEl: () => cropContainerEl,
    getSortMode: () => sort.mode,
    getSortDesc: () => sort.desc,
    getPlaybackUI: () => playbackUI,
    getViewerEl: () => viewerEl,
    getViewerContentSize,
    getLastPrevClickTime: () => lastPrevClickTime,
    getThumbnailBarVisible: () => thumbnailBarVisible,
    getResetZoom: () => resetZoom,
    setLastPrevClickTime: (v) => (lastPrevClickTime = v),
    setThumbnailBarVisible: (v) => (thumbnailBarVisible = v),
    setHoverZone: (v) => (hoverZone = v),
    pdf,
  });
  const {
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
  } = navigation;
  slideshow.bind(
    () => fileList,
    () => currentIndex,
    advanceSlide,
    () => (isVideo ? videoEl : isAudio ? audioEl : null),
  );
  const onMediaEnded = createOnMediaEnded({
    slideshow,
    loopModeStore,
    setPlaying: (v) => (playing = v),
    navigate,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    media,
    setMediaState,
  });
  $effect(() => {
    try {
      if (filePath && isPdf && pdfContainerEl) {
        pdf.loadFile(filePath);
        pdf.setContainer(pdfContainerEl);
      } else {
        pdf.cleanup();
      }
    } catch (e) {
      console.error("PDF effect failed:", e);
    }
  });
  let prevPdfLoading = false;
  $effect(() => {
    if (prevPdfLoading && !pdf.state.loading && pdf.state.pageCount > 0) {
      markup.initPages(pdf.state.pageCount);
      media.finishLoading(setMediaState);
    }
    prevPdfLoading = pdf.state.loading;
  });

  // Page dimensions are set after state.loading = false (in pdf.svelte.ts loadFile),
  // so we update the markup store reactively when they become available
  let prevPageDims = "";
  $effect(() => {
    if (
      pdf.state.pageCount > 0 &&
      pdf.state.pages.length > 0 &&
      pdf.state.pages[0].width > 0
    ) {
      const dims = pdf.state.pages.map((p) => ({
        width: p.width,
        height: p.height,
      }));
      const key = dims.map((d) => `${d.width}x${d.height}`).join(",");
      if (key !== prevPageDims) {
        prevPageDims = key;
        markup.updatePageDimensions(dims);
      }
    }
  });
  const { openFileDialog, pickAudioFile, openConvertedFile } =
    createFileOpenActions({ loadFile });
  const { startPan, startDrag } = createPanDrag({
    getIsVideo: () => isVideo,
    toggleFullscreen,
    togglePlay,
  });

  const frameStep = createFrameStep({ getVideoEl: () => videoEl });

  function isTimedMedia(): boolean {
    return (isVideo || isAudio) && !isGifVideo;
  }

  function isVideoHover(): boolean {
    return (
      isTimedMedia() && (hoverZone === "video" || viewer.state.isFullscreen)
    );
  }

  function compareAvailable(): boolean {
    return (
      editing.compareEnabled &&
      !editing.cropMode &&
      (editing.getHasEdits() || editing.getCropBounds() !== null)
    );
  }

  function toggleSleepTimer() {
    if (sleepTimer.active) {
      sleepTimer.clear();
      showToast({ message: "Sleep timer cleared", color: "grey" });
    } else {
      sleepTimer.start(sleepTimer.minutes);
      showToast({
        message: `Sleep timer set for ${sleepTimer.minutes} min`,
        color: "blue",
      });
    }
  }

  const configuredKeybind = createKeybindHandler({
    getContext: () =>
      isPdf ? "pdf" : menuStore.libraryOpen ? "library" : "viewer",
    areDialogsOpen: () =>
      areDialogsOpen({
        contextMenuStore,
        menuStore,
        markerStore,
        deleteStore,
        propertiesOpen,
        shareOpen,
        clips,
        editDialogStore,
        corruption,
        sort,
      }),
    closeDialogs: () => {
      contextMenuStore.close();
      menuStore.closeAll();
      deleteStore.deleteConfirm = false;
      deleteStore.multiDeleteConfirm = false;
      deleteStore.multiDeletePaths = [];
      propertiesOpen = false;
      shareOpen = false;
      markerStore.tsEditMenu.visible = false;
      clips.clipDeleteConfirm.visible = false;
      editDialogStore.closeAll();
      corruption.hide();
      markup.drawActive = false;
      markup.highlightActive = false;
      markup.textActive = false;
    },
    isFullscreen: () => viewer.state.isFullscreen,
    exitFullscreen: toggleFullscreen,
    actions: {
      "open-file": openFileDialog,
      "close-file": closeFile,
      "toggle-library": () => (menuStore.libraryOpen = !menuStore.libraryOpen),
      "show-shortcuts": keybindStore.toggleCheatSheet,
      "play-pause": () => {
        if (isTimedMedia()) togglePlay();
      },
      fullscreen: toggleFullscreen,
      "next-file": () => void navigate(1),
      "previous-file": () => void navigate(-1),
      "first-file": () => void navigateToEdge(true),
      "last-file": () => void navigateToEdge(false),
      "seek-forward": () => {
        const el = getMediaEl();
        if (el && isVideoHover()) {
          el.currentTime = Math.min(
            el.currentTime + playbackPrefs.seekStep,
            el.duration,
          );
        } else {
          void navigate(1);
        }
      },
      "seek-backward": () => {
        const el = getMediaEl();
        if (el && isVideoHover()) {
          el.currentTime = Math.max(el.currentTime - playbackPrefs.seekStep, 0);
        } else {
          void navigate(-1);
        }
      },
      "volume-up": () => setVolume(volume + VOLUME_STEP),
      "volume-down": () => setVolume(volume - VOLUME_STEP),
      mute: toggleMute,
      "frame-back": () => {
        if (isVideo) frameStep(-1);
      },
      "frame-forward": () => {
        if (isVideo) frameStep(1);
      },
      "add-marker": () => {
        if (isTimedMedia()) addTimestamp();
      },
      undo: () => handleUndo(),
      "loop-start": () => {
        if (isTimedMedia()) addLoopStart();
      },
      "loop-end": () => {
        if (isTimedMedia()) addLoopEnd();
      },
      "delete-file": () => void performDelete(),
      "copy-path": () => void propsCopyPath(),
      "export-edits": () => void handleExportEdits(),
      "toggle-slideshow": () =>
        slideshow.active ? slideshow.stop() : slideshow.start(),
      "toggle-sleep-timer": toggleSleepTimer,
    },
    holdActions: {
      compare: {
        start: () => {
          if (compareAvailable()) editing.setCompareOriginal(true);
        },
        end: () => editing.setCompareOriginal(false),
      },
    },
  });
  function handleKeydown(e: KeyboardEvent) {
    configuredKeybind.handleKeydown(e);
  }
  function handleKeyup(e: KeyboardEvent) {
    configuredKeybind.handleKeyup(e);
  }
  $effect(() => {
    const release = () => configuredKeybind.releaseHolds();
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  });

  // Intercept the PDF find binding before WebView2's built-in find.
  $effect(() => {
    function capturePdfFind(e: KeyboardEvent) {
      if (keybindStore.isRecording || keybindStore.cheatSheetOpen) return;
      const dialogsOpen = menuStore.isAnyOpen;
      const isCtrlF = e.ctrlKey && (e.key === "f" || e.key === "F");
      if (isCtrlF) {
        e.preventDefault();
        e.stopPropagation();
        if (
          !dialogsOpen &&
          isPdf &&
          !isTypingTarget(e.target) &&
          keybindStore.matches("pdf-find", e)
        ) {
          pdf.toggleFind();
        }
        return;
      }
      if (dialogsOpen || isTypingTarget(e.target)) return;
      if (isPdf && keybindStore.matches("pdf-find", e)) {
        e.preventDefault();
        e.stopPropagation();
        pdf.toggleFind();
      }
    }
    window.addEventListener("keydown", capturePdfFind, { capture: true });
    return () =>
      window.removeEventListener("keydown", capturePdfFind, { capture: true });
  });
  function openContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest("button, .progress-bar, .fs-progress")) return;
    if (!fileSrc) return;
    pdfRightClickedCanvas = target.closest(
      ".pdf-canvas",
    ) as HTMLCanvasElement | null;
    const menuW = 200;
    const menuH = isVideo || isAudio ? 300 : 260;
    contextMenuStore.open(e, menuW, menuH);
  }
  function closeContextMenu() {
    if (document.querySelector(".context-menu.pinned")) return;
    contextMenuStore.close();
  }

  function forceCloseContextMenu() {
    contextMenuStore.close();
  }

  const editActions = createEditActions({
    getFilePath: () => filePath,
    getFileName: () => fileName,
    getIsVideo: () => isVideo,
    getVideoEl: () => videoEl,
    loadFile,
    handleMarkupApply: (keepBackup) => handleMarkupApply(keepBackup),
    handleMarkupExport: () => handleMarkupExport(),
    handleClearMarkup: () => markup.clearAllStrokes(),
  });
  const {
    handleApplyEdits,
    handleExportEdits,
    handleTransparencyChoice,
    handleApplyConfirm,
    handleApplyExportInstead,
    closeEditApplyConfirm,
    closeEditTransparencyConfirm,
    handleUndo,
    handleReset,
    handleUpdateApplyNoAsk,
  } = editActions;
  let _markupActions: {
    handleMarkupApply: (keepBackup?: boolean) => Promise<void>;
    handleMarkupExport: (canvasDataUrl?: string) => Promise<void>;
  } | null = null;
  async function ensureMarkupActions() {
    if (!_markupActions) {
      const { createMarkupActions } =
        await import("$lib/features/markup/markupActions");
      _markupActions = createMarkupActions({
        getFilePath: () => filePath,
        getFileName: () => fileName,
        loadFile,
        folderWatcher,
        getPdfPageCanvas: () => {
          const idx = pdf.state.currentPage - 1;
          return idx >= 0 && idx < pdf.state.pages.length
            ? pdf.state.pages[idx].canvasRef
            : null;
        },
      });
    }
    return _markupActions;
  }
  async function handleMarkupApply(keepBackup?: boolean) {
    const a = await ensureMarkupActions();
    return a.handleMarkupApply(keepBackup);
  }
  async function handleMarkupExport(canvasDataUrl?: string) {
    const a = await ensureMarkupActions();
    return a.handleMarkupExport(canvasDataUrl);
  }
  const deleteActions = createDeleteActions({
    getFilePath: () => filePath,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    loadFile,
    closeFile,
  });
  const { performDelete } = deleteActions;
  const {
    ctxCopyPdfPageFn,
    ctxCopyImageFn,
    ctxCopyFrameFn,
    ctxCopyPathFn,
    ctxShowInExplorerFn,
    ctxRotateFn,
    ctxFlipFn,
    ctxClearMarkersFn,
    ctxEditFn,
    ctxMarkupFn,
    ctxEffectsFn,
    ctxEqualizerFn,
    ctxPropertiesFn,
    ctxShareFn,
    ctxSearchPdfFn,
    ctxDelete,
  } = createContextActionFns({
    filePath: () => filePath,
    videoEl: () => videoEl,
    togglePdfFindBar: () => pdf.toggleFind(),
    pdfRightClickedCanvas: () => pdfRightClickedCanvas,
    closeContextMenu,
    editing,
    viewer,
    clips,
    clearAllTimestamps,
    removeResumePoint,
    openEditMenu,
    openMarkupMenu,
    openEffectsMenu,
    openEqualizerMenu,
    propertiesOpen: () => propertiesOpen,
    setPropertiesOpen: (v) => (propertiesOpen = v),
    setMediaProps: (v) => (mediaProps = v),
    setMediaPropsLoading: (v) => (mediaPropsLoading = v),
    setShareOpen: (v) => (shareOpen = v),
    deleteActions,
  });
  const { propsCopyPath, propsOpenFolder, propsCopyAll, copyPropValue } =
    createPropertiesActions({
      getFile: () => ({
        fileName,
        filePath,
        isVideo,
        isPdf,
        fileDimensions,
        fileSize,
        fileCreated,
        fileModified,
        durationDisplay,
        mediaProps,
      }),
      getParentFolder,
    });
  const handleGlobalMouseDown = createGlobalMouseHandler({
    contextMenuStore,
    menuStore: {
      get editMenuVisible() {
        return menuStore.editMenuVisible;
      },
      get markupMenuVisible() {
        return menuStore.markupMenuVisible;
      },
      get effectsMenuVisible() {
        return menuStore.effectsMenuVisible;
      },
      get equalizerMenuVisible() {
        return menuStore.equalizerMenuVisible;
      },
      get slideshowMenuVisible() {
        return menuStore.slideshowMenuVisible;
      },
      get appDropdownVisible() {
        return menuStore.appDropdownVisible;
      },
      get libraryOpen() {
        return menuStore.libraryOpen;
      },
    },
    markerStore: {
      get tsEditMenu() {
        return markerStore.tsEditMenu;
      },
    },
    closeEditMenu,
    closeMarkupMenu,
    closeEffectsMenu,
    closeEqualizerMenu,
    closeSlideshowMenu,
    closeTimestampEditor,
  });

  const _shellProps = $derived({
    fileName,
    fileSrc,
    filePath,
    fileList,
    currentIndex,
    isVideo,
    isAudio,
    isPdf,
    playing,
    getMediaEl,
    resetView,
    clearTimestamps: clearAllTimestamps,
    clearClips: () => clips.clearBoundaries(),
    pdfPageCount: pdf.state.pageCount,
    pdfVersion: pdf.state.pdfVersion,
    pdfPageSize: pdf.state.pdfPageSize,
    pdfScale: pdf.state.scale,
    pdfFitScale: pdf.state.fitScale,
    pdfAutoFit: pdf.state.autoFit,
    pdfSetScale: pdf.setScale,
    fileDimensions,
    fileSize,
    fileInfoLoading,
    isLoadingFile,
    loadingFadingOut,
    anyMenuOpen,
    thumbnailBarVisible,
    adjustZoom: viewer.adjustZoom,
    toggleSlideshowMenu,
    closeSlideshowMenu,
    toggleThumbnailBar,
    onSortChange,
    navigate,
    startDrag,
    showFilenameTooltip: (e: MouseEvent) =>
      showFilenameTooltip(
        e,
        library.privacyMode ? obscurePath(filePath) : filePath,
      ),
    hideFilenameTooltip,
    closeFile,
    openFileDialog,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    closeEditMenu,
    closeMarkupMenu,
    closeEffectsMenu,
    markupMenuHasEdits: markup.strokes.length > 0,
    openConvertedFile,
    showValue,
    muted,
    volume,
    propertiesOpen,
    shareOpen,
    fileCreated,
    fileModified,
    durationDisplay,
    audioBitrateDisplay,
    mediaPropsLoading,
    mediaProps,
    propsCopyPath,
    propsOpenFolder,
    propsCopyAll,
    copyPropValue,
    performDelete,
    ctxDelete,
    getTitleEditorWidthCh,
    updateEditorTitle,
    closeTimestampEditor,
    onEditorScissor,
    onEditorDeleteTimestamp,
    onEditorDeleteSegment,
    invokeOpenDirectory,
  });

  setupInit({
    volume: { get: () => volume, set: (v) => (volume = v) },
    loopMode: {
      get: () => loopModeStore.loopMode,
      set: (v) =>
        loopModeStore.setLoopMode(
          v,
          () => videoEl,
          () => audioEl,
        ),
      save: saveLoopMode,
    },
    volumeSliderMode: {
      get: () => volumeSliderMode,
      set: (v) => (volumeSliderMode = v),
    },
    speedSliderMode: {
      get: () => speedSliderMode,
      set: (v) => (speedSliderMode = v),
    },
    clips: { loadPrefs: clips.loadPrefs },
    isVideo: { get: () => isVideo },
    isAudio: { get: () => isAudio },
    isPdf: { get: () => isPdf },
    filePath: { get: () => filePath },
    rawCurrentSecs: { get: () => rawCurrentSecs },
    rawDurationSecs: { get: () => rawDurationSecs },
    playbackUI,
    loadFile,
    saveResumePosition: saveCurrentPosition,
    hasPlayback,
    pausePlayback,
    handleKeydown,
    handleKeyup,
    handleGlobalMouseDown,
  });

  let keepAwakeMode: "none" | "system" | "display" = "none";
  $effect(() => {
    const active =
      systemPrefs.keepAwake && (playing || backgroundAudio.playing);
    const mode: "none" | "system" | "display" = !active
      ? "none"
      : isVideo
        ? "display"
        : "system";
    if (mode === keepAwakeMode) return;
    keepAwakeMode = mode;
    void invokeSetKeepAwake(mode);
  });

  $effect(() => {
    if (playbackPrefs.rememberSpeed) return;
    playbackUI.setPlaybackSpeed(playbackPrefs.defaultSpeed);
  });

  $effect(() => {
    if (playbackPrefs.rememberVolume) return;
    setVolume(playbackPrefs.defaultVolume);
  });

  let prevRememberSpeed = playbackPrefs.rememberSpeed;
  $effect(() => {
    const enabled = playbackPrefs.rememberSpeed;
    if (enabled && !prevRememberSpeed) {
      savePlaybackSpeed(playbackUI.playbackSpeed);
    }
    prevRememberSpeed = enabled;
  });

  let prevRememberVolume = playbackPrefs.rememberVolume;
  $effect(() => {
    const enabled = playbackPrefs.rememberVolume;
    if (enabled && !prevRememberVolume) {
      saveVolume(volume);
    }
    prevRememberVolume = enabled;
  });

  $effect(() => {
    const mode = loopModeStore.loopMode;
    if (videoEl) videoEl.loop = mode === "loop";
    if (audioEl) audioEl.loop = mode === "loop";
  });

  $effect(() => {
    const boost = playbackPrefs.volumeBoost;
    eqEngine.setVolumeBoost(boost);
    untrack(() => backgroundAudio.setBoost(boost));
  });

  $effect(() => {
    const el = isVideo ? videoEl : isAudio ? audioEl : null;
    if (!el) return;
    let seekTimer: ReturnType<typeof setTimeout> | undefined;
    const save = () => saveCurrentPosition();
    const saveSeek = () => {
      if (seekTimer) clearTimeout(seekTimer);
      seekTimer = setTimeout(save, 300);
    };
    el.addEventListener("pause", save);
    el.addEventListener("seeked", saveSeek);
    return () => {
      if (seekTimer) clearTimeout(seekTimer);
      el.removeEventListener("pause", save);
      el.removeEventListener("seeked", saveSeek);
    };
  });

  $effect(() => {
    if (playbackPrefs.resumeMode === "off") markerStore.resumePoint = null;
  });

  $effect(() => {
    const el = bgAudioEl;
    untrack(() => backgroundAudio.attach(el));
  });

  let wasLibraryOpen = false;
  $effect.pre(() => {
    const open = menuStore.libraryOpen;
    if (open === wasLibraryOpen) return;
    wasLibraryOpen = open;

    if (open) {
      if (!playbackPrefs.keepAudio || !isAudio || !filePath || !audioEl) return;
      if (audioEl.paused && audioEl.currentTime <= 0) return;
      const audioSrc = audioEl.currentSrc || audioEl.src;
      if (!audioSrc) return;
      backgroundAudio.start({
        path: filePath,
        name: fileName,
        src: audioSrc,
        currentTime: audioEl.currentTime,
        volume,
        muted,
        rate: audioEl.playbackRate,
        loop: audioEl.loop,
        playing: !audioEl.paused,
      });
      return;
    }

    if (!backgroundAudio.active) return;
    const bgPath = backgroundAudio.path;
    const pos = backgroundAudio.currentTime;
    backgroundAudio.stop();
    if (isAudio && filePath === bgPath && pos > 0) {
      backgroundAudio.queueSeek(bgPath, pos);
    }
  });

  $effect(() => {
    if (playbackPrefs.keepAudio) return;
    untrack(() => backgroundAudio.stop());
  });

  sleepTimer.configure(() => {
    getMediaEl()?.pause();
    backgroundAudio.stop();
    slideshow.stop();
    playing = false;
    showToast({
      message: "Sleep timer stopped playback",
      color: "grey",
      duration: 4000,
    });
  });

  // EQ settings + video EQ on file change
  let lastLoadedPath = "";
  $effect(() => {
    const path = filePath;
    const el = videoEl;
    if (!path) return;

    if (path !== lastLoadedPath) {
      lastLoadedPath = path;
      eqStore
        .loadForFile(path)
        .catch((e) => console.error("Failed to load EQ settings:", e));
      effectsStore.loadForFile(path);
    }

    if (isVideo && el) {
      try {
        eqEngine.connectMediaElement(el);
      } catch (e) {
        console.error("Failed to connect EQ to video element:", e);
      }
    }
  });

  // Bypass EQ during scrubbing
  let scrubbingEqBypassed = $state(false);
  $effect(() => {
    if (isScrubbing) {
      if (!scrubbingEqBypassed) {
        eqEngine.setBypass(true);
        scrubbingEqBypassed = true;
      }
    } else if (scrubbingEqBypassed) {
      eqEngine.setBypass(false);
      scrubbingEqBypassed = false;
    }
  });

  // Close thumbnail bar when library opens
  $effect(() => {
    if (menuStore.libraryOpen) {
      thumbnailBarVisible = false;
    }
  });

  // Save/restore viewer menu state across library transitions
  let prevLibraryOpen = $state(false);
  $effect(() => {
    if (menuStore.libraryOpen && !prevLibraryOpen) {
      menuStore.saveViewerMenus();
    } else if (!menuStore.libraryOpen && prevLibraryOpen) {
      menuStore.restoreViewerMenus();
    }
    prevLibraryOpen = menuStore.libraryOpen;
  });
</script>

<Shell
  {..._shellProps}
  viewerStateIsFullscreen={viewer.state.isFullscreen}
  viewerFsControlsVisible={viewer.state.fsControlsVisible}
  viewerResetFsTimer={viewer.resetFsTimer}
  viewerToggleFullscreen={toggleFullscreen}
  zoomLevel={viewer.state.zoomLevel}
  zoomLocked={viewer.state.zoomLocked}
  toggleZoomLock={handleToggleZoomLock}
  clipCount={clips.clipCount}
  clipMenuResetKey={clips.clipMenuResetKey}
  triggerClipSegments={clips.triggerSegments}
  clipJobRunning={clips.clipJobRunning}
  clipDeleteOriginal={clips.clipDeleteOriginal}
  clipMergeSegments={clips.clipMergeSegments}
  toggleClipDeleteOriginal={clips.toggleDeleteOriginal}
  toggleClipMergeSegments={clips.toggleMergeSegments}
  clipJobLabel={clips.clipJobLabel}
  slideshowMenuVisible={menuStore.slideshowMenuVisible}
  sortMode={sort.mode}
  sortDesc={sort.desc}
  sortMenuVisible={sort.menuVisible}
  toggleSortMenu={sort.toggle}
  closeSortMenu={sort.close}
  {...menuBindings}
  contextMenu={contextMenuStore.contextMenu}
  onOpenContextMenu={openContextMenu}
  editMenuVisible={menuStore.editMenuVisible}
  onApply={handleApplyEdits}
  onExport={handleExportEdits}
  onUndo={handleUndo}
  onReset={handleReset}
  onMarkupApply={handleApplyEdits}
  onMarkupExport={handleMarkupExport}
  markupMenuVisible={menuStore.markupMenuVisible}
  effectsMenuVisible={menuStore.effectsMenuVisible}
  equalizerMenuVisible={menuStore.equalizerMenuVisible}
  closeEqualizerMenu={() => (menuStore.equalizerMenuVisible = false)}
  showInExplorer={ctxShowInExplorerFn}
  loadMediaProperties={runLoadMediaProperties}
  onRenamed={async (newPath: string) => {
    clearFolderCache(getParentFolder(newPath));
    await loadFile(newPath);
  }}
  onFolderRenamed={async (newFolderPath: string) => {
    clearFolderCache(getParentFolder(newFolderPath));
    const sep = newFolderPath.includes("\\") ? "\\" : "/";
    const newFilePath = `${newFolderPath}${sep}${fileName}`;
    await loadFile(newFilePath);
  }}
  onSelect={navigateToIndex}
  {loadFile}
  onCloseClipDeleteConfirm={() => {
    clips.clipDeleteConfirm.visible = false;
    clips.clipDeleteConfirm.mode = null;
  }}
  onCloseDeleteConfirm={() => (deleteStore.deleteConfirm = false)}
  onCloseProperties={() => (propertiesOpen = false)}
  onCloseShare={() => (shareOpen = false)}
  onOpenConverted={(path) => loadFile(path)}
  onUpdateDeleteNoAsk={(v: boolean) => (deleteStore.deleteNoAsk = v)}
  onUpdateDeletePermanently={(v: boolean) =>
    (deleteStore.deletePermanently = v)}
  onCloseContextMenu={forceCloseContextMenu}
  tsTooltip={markerStore.tsTooltip}
  tsEditMenuVisible={markerStore.tsEditMenu.visible}
  tsEditMenu={markerStore.tsEditMenu}
  editingTimestamp={getActiveEditorTimestamp()}
  editingSegment={getActiveEditorSegment()}
  currentTitle={getEditorTitle()}
  volumeTooltipVisible={playbackUI.volumeTooltipVisible}
  volumeTooltipX={playbackUI.volumeTooltipX}
  volumeTooltipY={playbackUI.volumeTooltipY}
  volumeTooltipVertical={playbackUI.volumeTooltipVertical}
  speedTooltipVisible={playbackUI.speedTooltipVisible}
  speedTooltipX={playbackUI.speedTooltipX}
  speedTooltipY={playbackUI.speedTooltipY}
  speedTooltipVertical={playbackUI.speedTooltipVertical}
  playbackSpeed={playbackUI.playbackSpeed}
  timestamps={markerStore.timestamps}
  clipBoundaries={clips.clipBoundaries}
  resumePoint={markerStore.resumePoint}
  parentFolder={() => getParentFolder(filePath)}
  {invokeOpenDirectory}
  ctxCopyPdfPage={ctxCopyPdfPageFn}
  ctxCopyImage={ctxCopyImageFn}
  ctxCopyFrame={ctxCopyFrameFn}
  ctxCopyPath={ctxCopyPathFn}
  ctxRotate={ctxRotateFn}
  ctxFlip={ctxFlipFn}
  ctxEdit={ctxEditFn}
  ctxMarkup={ctxMarkupFn}
  ctxEffects={ctxEffectsFn}
  ctxEqualizer={ctxEqualizerFn}
  ctxShowInExplorer={ctxShowInExplorerFn}
  ctxProperties={ctxPropertiesFn}
  ctxShare={ctxShareFn}
  ctxSearchPdf={ctxSearchPdfFn}
  ctxClearMarkers={ctxClearMarkersFn}
  clipDeleteConfirm={clips.clipDeleteConfirm}
  deleteConfirm={deleteStore.deleteConfirm}
  deleteNoAsk={deleteStore.deleteNoAsk}
  deletePermanently={deleteStore.deletePermanently}
  fileExt={() => getFileExt(filePath)}
  corruptionWarning={corruption.state.warning}
  corruptionReason={corruption.state.reason}
  corruptionFixing={corruption.state.fixing}
  corruptionFixError={corruption.state.fixError}
  dismissCorruption={corruption.dismiss}
  fixCopy={() =>
    corruption.fixCopy({
      filePath,
    })}
  fixReplace={() =>
    corruption.fixReplace({
      filePath,
      loadFile,
    })}
>
  {#snippet children()}
    <ViewerArea
      {fileSrc}
      {isVideo}
      {isAudio}
      {isPdf}
      {fileName}
      {filePath}
      bind:viewerEl
      bind:imageEl
      bind:videoEl
      bind:audioEl
      bind:cropContainerEl
      bind:pdfContainerEl
      bind:hoverZone
      {viewer}
      {style}
      {markup}
      {corruption}
      {slideshow}
      {markerStore}
      {menuStore}
      {sort}
      {discScrubStore}
      {loopModeStore}
      {playbackUI}
      {pickAudioFile}
      {currentIndex}
      {fileList}
      {isGifVideo}
      {playing}
      {muted}
      {volume}
      {isScrubbing}
      bind:volumeTrackEl
      bind:speedTrackEl
      bind:audioLayoutMode
      bind:cassetteFilenameOverflow
      bind:cassetteInfoRowEl
      bind:cdColor
      bind:cdColorIndex
      bind:showCdColorPicker
      {coverArtSrc}
      {navigate}
      {openFileDialog}
      {toggleThumbnailBar}
      {handleFsPillContext}
      {minimizeWindow}
      {maximizeWindow}
      {closeWindow}
      {startPan}
      {handleViewerScroll}
      {toggleFullscreen}
      {fsPillEl}
      {onImageLoad}
      {onVideoLoad}
      {onAudioLoad}
      {onMediaEnded}
      {timelineProps}
      {playbackProps}
      {clips}
      {setLoopMode}
      {setVolume}
      {toggleMute}
      {togglePlay}
      {addTimestamp}
      {addLoopStart}
      {addLoopEnd}
      {clearAllTimestamps}
      {clearLoopMarkers}
      {removeResumePoint}
      {handlePrevClick}
      {handleNextClick}
      {toggleTimer}
      {currentTimeDisplay}
      {durationDisplay}
      {timerTooltip}
      {setMediaState}
      {startScrubbing}
      {startDiscScrubbing}
      {toggleVolumeSliderMode}
      {toggleSpeedSliderMode}
      {progress}
      {rawCurrentSecs}
      {rawDurationSecs}
      {onSortChange}
      {pdf}
      {fileDimensions}
      {fileSize}
      {fileInfoLoading}
      {isLoadingFile}
      {loadingFadingOut}
      {anyMenuOpen}
      {thumbnailBarVisible}
      {resetZoom}
      {audioMarkerProps}
    />
  {/snippet}
</Shell>

<TransparencyConfirmDialog
  open={editDialogStore.editTransparencyConfirm}
  {fileName}
  fileExtUpper={getFileExt(filePath).toUpperCase()}
  onClose={closeEditTransparencyConfirm}
  onChoice={handleTransparencyChoice}
/>

<ApplyEditDialog
  open={editDialogStore.editApplyConfirm}
  {fileName}
  applyNoAsk={editActions.applyNoAsk}
  backupMode={editing.backupMode}
  keepBackup={editDialogStore.applyKeepBackup}
  onClose={closeEditApplyConfirm}
  onConfirm={handleApplyConfirm}
  onExportInstead={handleApplyExportInstead}
  onUpdateApplyNoAsk={handleUpdateApplyNoAsk}
  onUpdateKeepBackup={(v) => (editDialogStore.applyKeepBackup = v)}
/>

<audio
  bind:this={bgAudioEl}
  hidden
  onplay={() => backgroundAudio.setPlaying(true)}
  onpause={() => backgroundAudio.setPlaying(false)}
  onended={backgroundAudio.handleEnded}
></audio>

{#if backgroundAudio.active}
  <NowPlayingPill />
{/if}
