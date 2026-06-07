<!-- Layout shell: wires feature modules into the template. State and handlers live in src/lib/features/*/. -->
<script lang="ts">
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
  import { createOnMediaEnded, createFrameStep } from "$lib/features/media/playbackHelpers";
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
    type LoopMode,
  } from "$lib/shared/constants";
  import type { MediaProperties } from "$lib/shared/types";
  import {
    saveLoopMode,
    loadAudioLayoutMode,
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
  import ImageView from "$lib/features/viewer/ImageView.svelte";
  import VideoView from "$lib/features/viewer/VideoView.svelte";
  import PDFView from "$lib/features/viewer/PDFView.svelte";
  import { createMarkupActions } from "$lib/features/markup/markupActions";
  import Shell from "$lib/shared/Shell.svelte";
  import { createToastHelpers, toastStore } from "$lib/features/toast/toast.svelte";
  import { createContextActionFns } from "$lib/features/dialogs/contextActionWrappers";
  import { createPropertiesActions } from "$lib/features/dialogs/propertiesActions";
  import { contextMenuStore } from "$lib/features/dialogs/contextMenu.svelte";
  import { createGlobalMouseHandler } from "$lib/features/dialogs/globalMouseHandler";
  import ApplyEditDialog from "$lib/features/dialogs/ApplyEditDialog.svelte";
  import TransparencyConfirmDialog from "$lib/features/dialogs/TransparencyConfirmDialog.svelte";
  import { setupInit } from "./init";
  import { createPdf } from "$lib/features/pdf/pdf.svelte";
  import AudioPlayer from "$lib/features/media/AudioPlayer.svelte";
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
    deleteStore,
  } from "$lib/features/fileActions/deleteFile.svelte";
  import {
    menuStore,
    createMenuActions,
    createMenuBindings,
  } from "$lib/features/dialogs/menuVisibility.svelte";
  import {
    editDialogStore,
    createEditActions,
  } from "$lib/features/edit/editActions.svelte";

  // ── State ──────────────────────────────────────────────
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
  const menuActions = createMenuActions({
    closeContextMenu: () => contextMenuStore.close(),
    getFilePath: () => filePath,
  });
  const {
    openEditMenu,
    closeEditMenu,
    openMarkupMenu,
    closeMarkupMenu,
    toggleSlideshowMenu,
    closeSlideshowMenu,
  } = menuActions;
  let audioLayoutMode: "retro" | "modern" = $state(loadAudioLayoutMode());
  let cassetteFilenameOverflow = $state(false);
  let cassetteInfoRowEl = $state<HTMLElement | null>(null);
  let lastPrevClickTime = $state(0);
  const PREV_DOUBLE_CLICK_MS = 1200;
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

  // ── Menu + media-prop prop bundles ──────────────────────
  const menuBindings = createMenuBindings();
  const {
    ffmpegSetters,
    ffprobeSetters,
    mediaPropsSetters,
    runInstallFfmpeg,
    runRefreshFfprobe,
    runLoadMediaProperties,
  } = createFfmpegHelpers({
    filePath: () => filePath,
    setMediaProps: (v) => (mediaProps = v),
    setMediaPropsLoading: (v) => (mediaPropsLoading = v),
    setFfmpegInstallError: (v) => (ffmpegInstallError = v),
    setFfmpegInstalling: (v) => (ffmpegInstalling = v),
    setFfprobeChecked: (v) => (ffprobeChecked = v),
    setFfprobeAvailable: (v) => (ffprobeAvailable = v),
  });

  // ── Derived ────────────────────────────────────────────
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
  const anyMenuOpen = $derived(
    contextMenuStore.isOpen ||
      menuStore.isAnyOpen ||
      markerStore.tsEditMenu.visible ||
      deleteStore.deleteConfirm ||
      propertiesOpen ||
      shareOpen ||
      clips.clipDeleteConfirm.visible ||
      editDialogStore.editApplyConfirm ||
      editDialogStore.editTransparencyConfirm ||
      corruption.state.warning ||
      sort.menuVisible,
  );
  const durationDisplay = $derived(formatTime(rawDurationSecs));

  // ── Toast helpers ──────────────────────────────────────
  const toast = createToastHelpers();

  // ── Viewer helpers ─────────────────────────────────────
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
  // ── Smooth progress via requestAnimationFrame ──────────
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

  // ── Playback ───────────────────────────────────────────
  const getMediaEl = () => (isVideo ? videoEl : isAudio ? audioEl : null);
  const playbackUI = createPlaybackUI(getMediaEl, () => volume, () => {});
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
    loopModeStore.setLoopMode(mode, () => videoEl, () => audioEl);
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

  // ── Timeline + playback prop bundles ────────────────────
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
  const playbackProps = $derived({
    isGifVideo,
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

  // ── File loading / navigation ──────────────────────────
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

  // ── PDF load effect ─────────────────────────────────────
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

  // ── Keybinds ───────────────────────────────────────────
  const configuredKeydown = createKeybindHandler({
    areDialogsOpen: () =>
      contextMenuStore.isOpen ||
      menuStore.isAnyOpen ||
      markerStore.tsEditMenu.visible ||
      deleteStore.deleteConfirm ||
      propertiesOpen ||
      shareOpen ||
      clips.clipDeleteConfirm.visible ||
      corruption.state.warning,
    closeDialogs: () => {
      contextMenuStore.close();
      menuStore.closeAll();
      deleteStore.deleteConfirm = false;
      propertiesOpen = false;
      shareOpen = false;
      markerStore.tsEditMenu.visible = false;
      clips.clipDeleteConfirm.visible = false;
      editDialogStore.closeAll();
      corruption.hide();
      markup.drawActive = false;
    },
    navigateToEdge,
    navigate,
    toggleFullscreen,
    setVolume,
    getVolume: () => volume,
    isTimedMedia: () => isVideo || isAudio,
    isVideo: () => isVideo,
    getMediaEl: () => (isVideo ? videoEl : isAudio ? audioEl : null),
    getHoverZone: () => hoverZone,
    isFullscreen: () => viewer.state.isFullscreen,
    togglePlay,
    frameStep: createFrameStep({ getVideoEl: () => videoEl }),
  });
  function handleKeydown(e: KeyboardEvent) {
    configuredKeydown(e);
  }

  // ── Context menu ───────────────────────────────────────
  function openContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest("button, .progress-bar, .fs-progress")) return;
    if (!fileSrc) return;
    const menuW = 200;
    const menuH = isVideo || isAudio ? 300 : 260;
    contextMenuStore.open(e, menuW, menuH);
  }
  function closeContextMenu() {
    contextMenuStore.close();
  }

  // ── Context menu actions ───────────────────────────────
  const editActions = createEditActions({
    getFilePath: () => filePath,
    getFileName: () => fileName,
    getIsVideo: () => isVideo,
    getVideoEl: () => videoEl,
    loadFile,
    showFrameCopyToast: toast.showFrameCopyToast,
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
  } = editActions;

  const { handleMarkupApply, handleMarkupExport } = createMarkupActions({
    getFilePath: () => filePath,
    getFileName: () => fileName,
    loadFile,
    folderWatcher,
    showFrameCopyToast: toast.showFrameCopyToast,
  });
  const deleteActions = createDeleteActions({
    getFilePath: () => filePath,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    loadFile,
    closeFile,
    showFrameCopyToast: toast.showFrameCopyToast,
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
    ctxPropertiesFn,
    ctxShareFn,
    ctxDelete,
  } = createContextActionFns({
    filePath: () => filePath,
    videoEl: () => videoEl,
    closeContextMenu,
    toast,
    editing,
    viewer,
    clips,
    clearAllTimestamps,
    removeResumePoint,
    openEditMenu,
    openMarkupMenu,
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

  // ── Properties dialog ──────────────────────────────────
  const { propsCopyPath, propsOpenFolder, propsCopyAll, copyPropValue } =
    createPropertiesActions({
      showFrameCopyToast: toast.showFrameCopyToast,
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

  // ── Global mouse ───────────────────────────────────────
  const handleGlobalMouseDown = createGlobalMouseHandler({
    contextMenuStore,
    menuStore: {
      get editMenuVisible() {
        return menuStore.editMenuVisible;
      },
      get markupMenuVisible() {
        return menuStore.markupMenuVisible;
      },
      get slideshowMenuVisible() {
        return menuStore.slideshowMenuVisible;
      },
      get appDropdownVisible() {
        return menuStore.appDropdownVisible;
      },
    },
    markerStore: {
      get tsEditMenu() {
        return markerStore.tsEditMenu;
      },
    },
    closeEditMenu,
    closeMarkupMenu,
    closeSlideshowMenu,
    closeTimestampEditor,
  });

  // ── Shell shorthand prop bundle ─────────────────────────
  const _shellProps = $derived({
    fileName, fileSrc, filePath, fileList, currentIndex,
    isVideo, isAudio, isPdf, fileDimensions, fileSize,
    fileInfoLoading, isLoadingFile, loadingFadingOut,
    anyMenuOpen, thumbnailBarVisible, resetZoom,
    toggleSlideshowMenu, closeSlideshowMenu, toggleThumbnailBar,
    onSortChange, navigate, startDrag,
    showFilenameTooltip, hideFilenameTooltip,
    closeFile, openFileDialog,
    minimizeWindow, maximizeWindow, closeWindow,
    closeEditMenu, closeMarkupMenu,
    ffprobeChecked, ffprobeAvailable, ffmpegInstalling, ffmpegInstallError,
    openConvertedFile, showValue,
    muted, volume, propertiesOpen, shareOpen,
    fileCreated, fileModified, durationDisplay, audioBitrateDisplay,
    mediaPropsLoading, mediaProps,
    propsCopyPath, propsOpenFolder, propsCopyAll, copyPropValue,
    performDelete, ctxDelete,
    getTitleEditorWidthCh, updateEditorTitle, closeTimestampEditor,
    onEditorScissor, onEditorDeleteTimestamp, onEditorDeleteSegment,
    invokeOpenDirectory,
  });

  // ── Lifecycle ──────────────────────────────────────────
  setupInit({
    volume: { get: () => volume, set: (v) => (volume = v) },
    loopMode: {
      get: () => loopModeStore.loopMode,
      set: (v) => loopModeStore.setLoopMode(v, () => videoEl, () => audioEl),
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
    clipboardToast: {
      get: () => toastStore.clipboardToast,
      set: (v) => toastStore.setClipboardToast(v),
    },
    playbackUI,
    loadFile,
    handleKeydown,
    handleGlobalMouseDown,
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
  installFfmpegAndWait={runInstallFfmpeg}
  refreshFfprobeAvailability={runRefreshFfprobe}
  showInExplorer={ctxShowInExplorerFn}
  loadMediaProperties={runLoadMediaProperties}
  onRenamed={async (newPath: string) => {
    clearFolderCache(getParentFolder(newPath));
    await loadFile(newPath);
  }}
  onSelect={navigateToIndex}
  onOpenExportedFile={async () => {
    if (editDialogStore.exportToast.outputPath)
      loadFile(editDialogStore.exportToast.outputPath);
    editDialogStore.exportToast = {
      ...editDialogStore.exportToast,
      visible: false,
    };
  }}
  onSaveClipboardFile={toast.saveClipboardFile}
  onDismissClipboardToast={toast.dismissClipboardToast}
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
  speedTooltipVisible={playbackUI.speedTooltipVisible}
  speedTooltipX={playbackUI.speedTooltipX}
  speedTooltipY={playbackUI.speedTooltipY}
  playbackSpeed={playbackUI.playbackSpeed}
  timestamps={markerStore.timestamps}
  clipBoundaries={clips.clipBoundaries}
  resumePoint={markerStore.resumePoint}
  frameCopyToast={toastStore.frameCopyToast}
  imageCopyToast={toastStore.imageCopyToast}
  clipToast={clips.clipToast}
  exportToast={editDialogStore.exportToast}
  clipboardToast={toastStore.clipboardToast}
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
  ctxShowInExplorer={ctxShowInExplorerFn}
  ctxProperties={ctxPropertiesFn}
  ctxShare={ctxShareFn}
  ctxClearMarkers={ctxClearMarkersFn}
  clipDeleteConfirm={clips.clipDeleteConfirm}
  deleteConfirm={deleteStore.deleteConfirm}
  deleteNoAsk={deleteStore.deleteNoAsk}
  deletePermanently={deleteStore.deletePermanently}
  fileExt={() => getFileExt(filePath)}
  runClipAction={clips.runClipAction}
  corruptionWarning={corruption.state.warning}
  corruptionReason={corruption.state.reason}
  corruptionFixing={corruption.state.fixing}
  corruptionFixError={corruption.state.fixError}
  dismissCorruption={corruption.dismiss}
  fixCopy={() =>
    corruption.fixCopy({
      filePath,
      showFrameCopyToast: toast.showFrameCopyToast,
    })}
  fixReplace={() =>
    corruption.fixReplace({
      filePath,
      loadFile,
      showFrameCopyToast: toast.showFrameCopyToast,
    })}
>
  {#snippet children()}
    <ViewerArea
      {fileSrc} {isVideo} {isAudio} {isPdf} {fileName} {filePath}
      bind:viewerEl bind:imageEl bind:videoEl bind:audioEl
      bind:cropContainerEl bind:pdfContainerEl bind:hoverZone
      {viewer} {style} {markup} {corruption} {slideshow}
      {markerStore} {menuStore} {sort} {discScrubStore}
      {loopModeStore} {playbackUI} {pickAudioFile}
      {currentIndex} {fileList} {isGifVideo} {playing} {muted} {volume}
      {isScrubbing}
      bind:volumeTrackEl bind:speedTrackEl
      bind:audioLayoutMode bind:cassetteFilenameOverflow
      bind:cassetteInfoRowEl
      bind:cdColor bind:cdColorIndex bind:showCdColorPicker
      {coverArtSrc}
      {navigate} {openFileDialog} {toggleThumbnailBar}
      {handleFsPillContext} {minimizeWindow} {maximizeWindow}
      {closeWindow} {startPan} {handleViewerScroll}
      {toggleFullscreen} {fsPillEl}
      {onImageLoad} {onVideoLoad} {onAudioLoad} {onMediaEnded}
      {timelineProps} {playbackProps} {clips}
      {setLoopMode} {setVolume} {toggleMute} {togglePlay}
      {addTimestamp} {addLoopStart} {addLoopEnd}
      {clearAllTimestamps} {clearLoopMarkers} {removeResumePoint}
      {handlePrevClick} {handleNextClick} {toggleTimer}
      {currentTimeDisplay} {durationDisplay} {timerTooltip}
      {setMediaState}
      {startScrubbing} {startDiscScrubbing}
      {toggleVolumeSliderMode} {toggleSpeedSliderMode}
      {progress} {rawCurrentSecs} {rawDurationSecs}
      {onSortChange}
      {pdf}
      {fileDimensions} {fileSize} {fileInfoLoading}
      {isLoadingFile} {loadingFadingOut}
      {anyMenuOpen} {thumbnailBarVisible} {resetZoom}
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
  onClose={closeEditApplyConfirm}
  onConfirm={handleApplyConfirm}
  onExportInstead={handleApplyExportInstead}
/>
