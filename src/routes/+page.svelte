<script lang="ts">
  // Imports
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
  import { VOLUME_SEGMENTS, type LoopMode } from "$lib/shared/constants";
  import type { MediaProperties } from "$lib/shared/types";
  import {
    saveLoopMode,
    saveVolume,
    loadAudioLayoutMode,
    loadPlaybackSpeed,
    savePlaybackSpeed,
  } from "$lib/services/storage";
  import {
    createFfmpegHelpers,
    createEnsureFfprobe,
  } from "$lib/features/media/ffmpegHelpers";
  import { invokeOpenDirectory } from "$lib/features/media/tools";
  import {
    showFilenameTooltip,
    hideFilenameTooltip,
  } from "$lib/services/filenameTooltip";
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
  import { createMarkupActions } from "$lib/features/markup/markupActions";
  import { showToast } from "$lib/features/toast/toast.svelte";
  import Shell from "$lib/shared/Shell.svelte";
  import { createContextActionFns } from "$lib/features/actions/contextActionWrappers";
  import { createPropertiesActions } from "$lib/features/actions/propertiesActions";
  import { contextMenuStore } from "$lib/features/stores/contextMenu.svelte";
  import { createGlobalMouseHandler } from "$lib/features/actions/globalMouseHandler";
  import ApplyEditDialog from "$lib/features/dialogs/ApplyEditDialog.svelte";
  import TransparencyConfirmDialog from "$lib/features/dialogs/TransparencyConfirmDialog.svelte";
  import { setupInit } from "./init";
  import { createPdf } from "$lib/features/pdf/pdf.svelte";
  import { corruption } from "$lib/features/media/corruption.svelte";
  import { sort } from "$lib/features/navigation/sort.svelte";
  import {
    minimizeWindow,
    maximizeWindow,
    closeWindow,
  } from "$lib/features/window/windowControls";
  import { createFileOpenActions } from "$lib/features/fileActions/fileOpen";
  import { createNavigation } from "$lib/features/fileActions/navigation.svelte";
  import { createPanDrag } from "$lib/features/viewer/panDrag";
  import { createViewerEffects } from "$lib/features/viewer/viewerEffects.svelte";
  import { createViewerStyle } from "$lib/features/viewer/viewerStyle.svelte";
  import ViewerArea from "$lib/features/viewer/ViewerArea.svelte";
  import {
    createDeleteActions,
    performMultiDelete,
    deleteStore,
  } from "$lib/features/fileActions/deleteFile.svelte";
  import {
    menuStore,
    createMenuActions,
    createMenuBindings,
    areDialogsOpen,
  } from "$lib/features/stores/menuVisibility.svelte";
  import {
    editDialogStore,
    createEditActions,
  } from "$lib/features/edit-dialogs/editActions.svelte";
  import { eqStore } from "$lib/features/equalizer/equalizer-store.svelte";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import { effectsEngine } from "$lib/features/effects/effects-engine";

  // State declarations
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
  let thumbnailBarVisible = $state(false);
  let fsPillEl: HTMLButtonElement | null = $state(null);
  let volumeSliderMode = $state(false);
  let speedSliderMode = $state(false);
  let mediaProps = $state<MediaProperties | null>(null);
  let mediaPropsLoading = $state(false);
  let ffprobeAvailable = $state(true);
  let ffprobeChecked = $state(false);
  let ffmpegInstalling = $state(false);
  let ffmpegInstallError = $state("");

  // Feature modules: menu and ffmpeg helpers
  const menuActions = createMenuActions({
    closeContextMenu: () => contextMenuStore.close(),
    getFilePath: () => filePath,
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
  const { runInstallFfmpeg, runRefreshFfprobe, runLoadMediaProperties } =
    createFfmpegHelpers({
      filePath: () => filePath,
      setMediaProps: (v) => (mediaProps = v),
      setMediaPropsLoading: (v) => (mediaPropsLoading = v),
      setFfmpegInstallError: (v) => (ffmpegInstallError = v),
      setFfmpegInstalling: (v) => (ffmpegInstalling = v),
      setFfprobeChecked: (v) => (ffprobeChecked = v),
      setFfprobeAvailable: (v) => (ffprobeAvailable = v),
    });

  // Feature modules: viewer and media foundation
  const style = createViewerStyle();
  const isGifVideo = $derived(isVideo && getFileExt(filePath) === "gif");
  const clips = createClips({
    getFilePath: () => filePath,
    getRawDurationSecs: () => rawDurationSecs,
    getIsVideo: () => isVideo,
    getVideoEl: () => videoEl,
    getAudioEl: () => audioEl,
    getFileParentFolder: () => getParentFolder(filePath),
    ensureFfprobe: createEnsureFfprobe({
      getFfprobeChecked: () => ffprobeChecked,
      getFfprobeAvailable: () => ffprobeAvailable,
      setFfprobeChecked: (v) => (ffprobeChecked = v),
      setFfprobeAvailable: (v) => (ffprobeAvailable = v),
      setFfmpegInstallError: (v) => (ffmpegInstallError = v),
      setFfmpegInstalling: (v) => (ffmpegInstalling = v),
      filePath: () => filePath,
      setMediaProps: (v) => (mediaProps = v),
      setMediaPropsLoading: (v) => (mediaPropsLoading = v),
    }),
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

  // Feature modules: viewer effects and playback poller
  const viewerFx = createViewerEffects({
    getVideoEl: () => videoEl,
    getViewerEl: () => viewerEl,
    getFileSrc: () => fileSrc,
    getIsVideo: () => isVideo,
    getImageNaturalWidth: () => imageNaturalWidth,
    getImageNaturalHeight: () => imageNaturalHeight,
    getThumbnailBarVisible: () => thumbnailBarVisible,
    getIsFullscreen: () => viewer.state.isFullscreen,
  });
  $effect(viewerFx.setVideoElEffect);
  $effect(viewerFx.resizeObserverEffect);
  $effect(viewerFx.refitOnChangeEffect);
  $effect(
    createPlaybackPoller({
      getIsVideo: () => isVideo,
      getIsAudio: () => isAudio,
      getVideoEl: () => videoEl,
      getAudioEl: () => audioEl,
      getIsScrubbing: () => isScrubbing,
      setRawCurrentSecs: (v) => (rawCurrentSecs = v),
      setRawDurationSecs: (v) => (rawDurationSecs = v),
      setProgress: (v) => (progress = v),
      setPlaying: (v) => (playing = v),
    }),
  );
  const {
    getViewerContentSize,
    resetZoom,
    handleToggleZoomLock,
    handleViewerScroll,
    toggleFullscreen,
  } = viewerFx;

  // Feature modules: playback and marker controls
  const getMediaEl = () => (isVideo ? videoEl : isAudio ? audioEl : null);
  const playbackUI = createPlaybackUI(
    getMediaEl,
    () => volume,
    (v) => {
      volume = v;
      saveVolume(v);
    },
    savePlaybackSpeed,
    loadPlaybackSpeed(),
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

  // Prop bundles: timeline and playback (must be after state + playback modules)
  const timelineProps = $derived({
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
  });
  const audioMarkerProps = $derived({
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
  });
  const playbackProps = $derived({
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
  });

  // Feature modules: file operations and navigation
  const pdf = createPdf();
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
    if (filePath && isPdf && pdfContainerEl) {
      pdf.loadFile(filePath);
      pdf.setContainer(pdfContainerEl);
    } else {
      pdf.cleanup();
    }
  });
  const { openFileDialog, pickAudioFile, openConvertedFile } =
    createFileOpenActions({ loadFile });
  const { startPan, startDrag } = createPanDrag({
    getIsVideo: () => isVideo,
    toggleFullscreen,
    togglePlay,
  });

  // Feature modules: input handling (keybind, context menu)
  const configuredKeydown = createKeybindHandler({
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
    navigateToEdge,
    navigate,
    toggleFullscreen,
    setVolume,
    getVolume: () => volume,
    isTimedMedia: () => (isVideo || isAudio) && !isGifVideo,
    isVideo: () => isVideo,
    getMediaEl: () => (isVideo ? videoEl : isAudio ? audioEl : null),
    getHoverZone: () => hoverZone,
    isFullscreen: () => viewer.state.isFullscreen,
    togglePlay,
    frameStep: createFrameStep({ getVideoEl: () => videoEl }),
    toggleLibrary: () => (menuStore.libraryOpen = !menuStore.libraryOpen),
  });
  function handleKeydown(e: KeyboardEvent) {
    configuredKeydown(e);
  }
  function openContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest("button, .progress-bar, .fs-progress")) return;
    if (!fileSrc) return;
    // Pixel estimates for context menu dimensions
    const menuW = 200;
    const menuH = isVideo || isAudio ? 300 : 260;
    contextMenuStore.open(e, menuW, menuH);
  }
  function closeContextMenu() {
    contextMenuStore.close();
  }

  // Feature modules: edit, markup, delete, and context actions
  const editActions = createEditActions({
    getFilePath: () => filePath,
    getFileName: () => fileName,
    getIsVideo: () => isVideo,
    getVideoEl: () => videoEl,
    loadFile,
    handleMarkupApply: () => handleMarkupApply(),
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
  const { handleMarkupApply, handleMarkupExport } = createMarkupActions({
    getFilePath: () => filePath,
    getFileName: () => fileName,
    loadFile,
    folderWatcher,
  });
  const deleteActions = createDeleteActions({
    getFilePath: () => filePath,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    loadFile,
    closeFile,
  });
  const { performDelete } = deleteActions;
  const {
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
    ctxDelete,
  } = createContextActionFns({
    filePath: () => filePath,
    videoEl: () => videoEl,
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
    clearFfmpegError: () => (ffmpegInstallError = ""),
    ffprobeAvailable: () => ffprobeAvailable,
    setFfprobeChecked: (v) => (ffprobeChecked = v),
    setFfprobeAvailable: (v) => (ffprobeAvailable = v),
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

  // Prop bundle: shell (must be after all feature modules)
  const _shellProps = $derived({
    fileName,
    fileSrc,
    filePath,
    fileList,
    currentIndex,
    isVideo,
    isAudio,
    isPdf,
    fileDimensions,
    fileSize,
    fileInfoLoading,
    isLoadingFile,
    loadingFadingOut,
    anyMenuOpen,
    thumbnailBarVisible,
    resetZoom,
    toggleSlideshowMenu,
    closeSlideshowMenu,
    toggleThumbnailBar,
    onSortChange,
    navigate,
    startDrag,
    showFilenameTooltip,
    hideFilenameTooltip,
    closeFile,
    openFileDialog,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    closeEditMenu,
    closeMarkupMenu,
    closeEffectsMenu,
    ffprobeChecked,
    ffprobeAvailable,
    ffmpegInstalling,
    ffmpegInstallError,
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

  // Lifecycle
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
    handleKeydown,
    handleGlobalMouseDown,
  });

  // Load EQ settings on file change and connect video element
  $effect(() => {
    const path = filePath;
    if (!path) return;

    eqStore.loadForFile(path);

    if (isVideo && videoEl) {
      eqEngine.connectMediaElement(videoEl);
    }
  });

  // Also connect video element when it becomes available after mount
  $effect(() => {
    const el = videoEl;
    if (el && filePath && isVideo) {
      eqEngine.connectMediaElement(el);
    }
  });

  // Wire audio element to effects engine for pitch control via playbackRate
  $effect(() => {
    const el = audioEl;
    if (el && (isAudio || isVideo)) {
      effectsEngine.setAudioElement(el);
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
  clipUseCustomPath={clips.clipUseCustomPath}
  clipMergeSegments={clips.clipMergeSegments}
  getClipTargetDir={clips.getTargetDir}
  toggleClipDeleteOriginal={clips.toggleDeleteOriginal}
  toggleClipPathSelection={clips.togglePathSelection}
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
  onMarkupApply={handleMarkupApply}
  onMarkupExport={handleMarkupExport}
  markupMenuVisible={menuStore.markupMenuVisible}
  effectsMenuVisible={menuStore.effectsMenuVisible}
  equalizerMenuVisible={menuStore.equalizerMenuVisible}
  closeEqualizerMenu={() => (menuStore.equalizerMenuVisible = false)}
  installFfmpegAndWait={runInstallFfmpeg}
  refreshFfprobeAvailability={runRefreshFfprobe}
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
  onUpdateDeleteNoAsk={(v: boolean) => (deleteStore.deleteNoAsk = v)}
  onUpdateDeletePermanently={(v: boolean) =>
    (deleteStore.deletePermanently = v)}
  onCloseContextMenu={closeContextMenu}
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
  clipOutputDir={clips.clipOutputDir}
  parentFolder={() => getParentFolder(filePath)}
  {invokeOpenDirectory}
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
  onClose={closeEditApplyConfirm}
  onConfirm={handleApplyConfirm}
  onExportInstead={handleApplyExportInstead}
  onUpdateApplyNoAsk={handleUpdateApplyNoAsk}
/>
