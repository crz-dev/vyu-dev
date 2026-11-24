<script lang="ts">
  import { untrack } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
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
    migrateFilePathStorage,
    migrateFolderPathStorage,
  } from "$lib/services/storage";
  import { loadMediaProperties } from "$lib/features/media/ffmpeg";
  import { installSliderAnimations } from "$lib/services/sliderAnimation";
  import {
    invokeOpenDirectory,
    invokeCleanupTempFolder,
  } from "$lib/features/media/api";
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
    replacePathPrefix,
    samePath,
  } from "$lib/services/files";
  import { viewer } from "$lib/features/viewer/viewer.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import { queue } from "$lib/features/media/queue.svelte";
  import { markup } from "$lib/features/markup/markup.svelte";

  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { createTrackSelection } from "$lib/features/media/tracks.svelte";
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
  import { pip, type PipMedia } from "$lib/features/viewer/pip.svelte";
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
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { playAudioCue } from "$lib/features/accessibility/audioCues";
  import { resetAccessibilitySettings } from "$lib/features/accessibility/accessibilityTransfer";
  import { effectsStore } from "$lib/features/effects/effects-store.svelte";
  import { fxEngine } from "$lib/features/effects/effects-engine";
  import {
    migrateFilePath as dbMigrateFilePath,
    migrateFolderPaths as dbMigrateFolderPaths,
  } from "$lib/services/database";
  import {
    buildTimelineProps,
    buildAudioMarkerProps,
    buildPlaybackProps,
  } from "$lib/shared/pageProps";

  const t = locale.t;

  let filePath = $state("");
  let fileSrc = $state("");
  let fileName = $state(t("shell.noFileOpen"));

  // Keep the empty-state filename in the current language when no file is open.
  $effect(() => {
    if (!filePath && !isRemote) fileName = t("shell.noFileOpen");
  });
  // Delegated click animation for native and custom sliders.
  $effect(() => installSliderAnimations());
  let isVideo = $state(false);
  let isAudio = $state(false);
  let isPdf = $state(false);
  let isRemote = $state(false);
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
  let videoNaturalWidth = $state(0);
  let videoNaturalHeight = $state(0);
  let volume = $state(1);
  let hoverZone = $state("none");
  let dragDropActive = $state(false);
  let dragStart = $state({ x: 0, y: 0, tx: 0, ty: 0 });
  let lastLeftClickTime = 0;
  let pendingPlay: ReturnType<typeof setTimeout> | undefined;
  let isScrubbing = $state(false);
  let propertiesOpen = $state(false);
  let libraryPropertiesOpen = $state(false);
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
    toggleQueueMenu,
    closeQueueMenu,
    toggleSleepTimerMenu,
    closeSleepTimerMenu,
  } = menuActions;
  const menuBindings = createMenuBindings();
  const runLoadMediaProperties = () =>
    loadMediaProperties({
      filePath,
      setMediaProps: (v) => (mediaProps = v),
      setMediaPropsLoading: (v) => (mediaPropsLoading = v),
    });

  const style = createViewerStyle();
  const pdf = createPdf();
  const isGifVideo = $derived(isVideo && getFileExt(filePath) === "gif");
  const trackSelection = createTrackSelection(() => videoEl);
  let previousTrackPath = "";

  $effect(() => {
    const path = isVideo && !isGifVideo && !isRemote ? filePath : "";
    if (path === previousTrackPath) return;
    previousTrackPath = path;
    menuStore.audioTrackMenuOpen = false;
    menuStore.subtitleMenuOpen = false;
    if (path) void trackSelection.loadFile(path);
    else trackSelection.reset();
  });

  async function pickSubtitleFile() {
    try {
      const path = await open({
        multiple: false,
        filters: [
          {
            name: t("shell.subtitles.filter"),
            extensions: ["srt", "vtt", "ass", "ssa", "sup", "idx", "sub"],
          },
        ],
      });
      if (typeof path === "string")
        await trackSelection.loadExternalSubtitle(path);
    } catch (error) {
      showToast({
        message: t("shell.subtitles.openFailed", {
          error: String(error),
        }),
        color: "red",
      });
    }
  }

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
      libraryPropertiesOpen,
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
    getPipActive: () => pip.state.active,
    getPipPhase: () => pip.state.phase,
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

  const pipAvailable = $derived(
    !!fileSrc &&
      !editing.cropMode &&
      !markup.drawActive &&
      !markup.highlightActive &&
      !markup.textActive &&
      !markup.selectActive &&
      !markup.removeActive,
  );

  let pipZoomSnapshot: {
    zoomLevel: number;
    baseZoomLevel: number;
    translateX: number;
    translateY: number;
    zoomLocked: boolean;
  } | null = null;

  function pipMediaSnapshot(): PipMedia {
    let kind: PipMedia["kind"] = "image";
    let width = imageNaturalWidth;
    let height = imageNaturalHeight;
    if (isVideo) {
      kind = "video";
      width = videoNaturalWidth;
      height = videoNaturalHeight;
    } else if (isAudio) {
      kind = "audio";
      width = 0;
      height = 0;
    } else if (isPdf) {
      kind = "pdf";
      const page = pdf.state.pages[0];
      width = page?.width ?? 0;
      height = page?.height ?? 0;
    }
    return {
      kind,
      width,
      height,
      rotation: editing.snapshot.rotation,
    };
  }

  function captureViewerZoomForPip() {
    pipZoomSnapshot = {
      zoomLevel: viewer.state.zoomLevel,
      baseZoomLevel: viewer.state.baseZoomLevel,
      translateX: viewer.state.translateX,
      translateY: viewer.state.translateY,
      zoomLocked: viewer.state.zoomLocked,
    };
    viewer.state.zoomLocked = false;
    viewer.state.zoomLevel = viewer.state.baseZoomLevel;
    viewer.state.translateX = 0;
    viewer.state.translateY = 0;
  }

  function restoreViewerZoomAfterPip() {
    if (!pipZoomSnapshot) return;
    const saved = pipZoomSnapshot;
    pipZoomSnapshot = null;
    viewer.state.zoomLocked = saved.zoomLocked;
    viewer.state.zoomLevel = saved.zoomLevel;
    viewer.state.baseZoomLevel = saved.baseZoomLevel;
    viewer.state.translateX = saved.translateX;
    viewer.state.translateY = saved.translateY;
  }

  let pipToggleInFlight = false;

  async function handleTogglePip() {
    if (pipToggleInFlight || pip.busy) return;
    pipToggleInFlight = true;
    try {
      if (pip.state.active) {
        await pip.exit();
        return;
      }
      if (!pipAvailable) return;
      // Menus are anchored to the full window; close them before the window
      // collapses into PiP.
      contextMenuStore.close();
      menuStore.closeAll();
      menuStore.loopMenuOpen = false;
      menuStore.audioTrackMenuOpen = false;
      menuStore.subtitleMenuOpen = false;
      if (viewer.state.isFullscreen) toggleFullscreen();
      const entered = await pip.enter(
        pipMediaSnapshot(),
        captureViewerZoomForPip,
      );
      if (!entered && !pip.state.active) {
        restoreViewerZoomAfterPip();
        showToast({ message: t("shell.pip.failed"), color: "red" });
      } else if (entered && !filePath) {
        await pip.exit();
      }
    } finally {
      pipToggleInFlight = false;
    }
  }

  function handleToggleFullscreen() {
    if (pip.state.active) {
      void pip.exit().then(() => {
        if (!pip.state.active) toggleFullscreen();
      });
      return;
    }
    toggleFullscreen();
  }

  $effect(() => {
    // Do not carry a previous video's aspect into a new file.
    filePath;
    untrack(() => {
      videoNaturalWidth = 0;
      videoNaturalHeight = 0;
    });
  });

  $effect(() => {
    if (!pip.state.active) {
      restoreViewerZoomAfterPip();
      return;
    }
    const media = pipMediaSnapshot();
    void pip.fitTo(media);
  });

  $effect(() => {
    // Navigation briefly clears fileSrc while audio/video elements are torn
    // down. Only close PiP when there is genuinely no file open.
    if (pip.state.active && !filePath) void pip.exit();
  });

  $effect(() => {
    if (pip.state.active && anyMenuOpen) void pip.exit();
  });

  $effect(() => {
    if (
      pip.state.active &&
      (editing.cropMode ||
        markup.drawActive ||
        markup.highlightActive ||
        markup.textActive ||
        markup.selectActive ||
        markup.removeActive)
    ) {
      void pip.exit();
    }
  });

  const getMediaEl = () => (isVideo ? videoEl : isAudio ? audioEl : null);

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

  const previewAspectRatio = $derived.by(() => {
    // fileDimensions is formatted like "1920 × 1080" (multiplication sign).
    const match = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(fileDimensions.trim());
    if (!match) return 16 / 9;
    const width = Number(match[1]);
    const height = Number(match[2]);
    return width > 0 && height > 0 ? width / height : 16 / 9;
  });

  const timelineProps = $derived(
    buildTimelineProps({
      progress,
      currentTimeSecs: rawCurrentSecs,
      isGifVideo,
      previewPath: isVideo && !isGifVideo ? filePath : "",
      previewAspectRatio,
      clipPairs: clips.clipPairs,
      clipBoundaries: clips.clipBoundaries,
      timestamps: markerStore.timestamps,
      chapters: markerStore.chapters,
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
        showToast({ message: t("shell.markers.cleared"), color: "yellow" });
      },
      toggleTimer,
      currentTimeDisplay,
      durationDisplay,
      timerTooltip,
      toggleFullscreen,
      onTsMenuChange: (v: boolean) => (menuStore.tsMenuOpen = v),
      tracks: trackSelection,
      onLoadSubtitle: pickSubtitleFile,
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
    setIsRemote: (v) => (isRemote = v),
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
    getIsRemote: () => isRemote,
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
    openUrl,
    handleRemoteError,
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

  function handleVideoLoad() {
    onVideoLoad();
    if (videoEl) {
      videoNaturalWidth = videoEl.videoWidth;
      videoNaturalHeight = videoEl.videoHeight;
    }
    trackSelection.restorePlaybackAfterSourceLoad(videoEl);
  }

  queue.configure((path, opts) => loadFile(path, false, opts));

  slideshow.bind(
    () => filePath,
    advanceSlide,
    () => (isVideo ? videoEl : isAudio ? audioEl : null),
  );
  const onMediaEnded = createOnMediaEnded({
    slideshow,
    loopModeStore,
    setPlaying: (v) => (playing = v),
    playNextQueued: () => queue.playNext(),
    navigate,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (v) => (currentIndex = v),
    media,
    setMediaState,
  });
  // A pending queue is an explicit "play next" request. Stop native looping
  // while items remain so the ended event can advance the queue.
  $effect(() => {
    const shouldLoop =
      loopModeStore.loopMode === "loop" &&
      queue.length === 0 &&
      !slideshow.active;
    if (videoEl) videoEl.loop = shouldLoop;
    if (audioEl) audioEl.loop = shouldLoop;
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
    getPipActive: () => pip.state.active,
    exitPip: () => void pip.exit(),
    toggleFullscreen,
    togglePlay,
  });

  const frameStep = createFrameStep({ getVideoEl: () => videoEl });

  function isTimedMedia(): boolean {
    return (isVideo || isAudio) && !isGifVideo;
  }

  function shouldSeekMedia(): boolean {
    return (
      isTimedMedia() &&
      (isAudio ||
        hoverZone === "video" ||
        viewer.state.isFullscreen ||
        pip.state.active)
    );
  }

  function seekDistance(el: HTMLMediaElement): number {
    if (
      playbackPrefs.relativeSeek &&
      Number.isFinite(el.duration) &&
      el.duration > 0
    ) {
      return (el.duration * playbackPrefs.relativeSeekStep) / 100;
    }
    return playbackPrefs.seekStep;
  }

  function compareAvailable(): boolean {
    return (
      !editing.cropMode &&
      (editing.getHasEdits() || editing.getCropBounds() !== null)
    );
  }

  function keybindContext(): "pdf" | "library" | "viewer" {
    return isPdf ? "pdf" : menuStore.libraryOpen ? "library" : "viewer";
  }

  const configuredKeybind = createKeybindHandler({
    getContext: keybindContext,
    areDialogsOpen: () =>
      areDialogsOpen({
        contextMenuStore,
        menuStore,
        markerStore,
        deleteStore,
        propertiesOpen,
        libraryPropertiesOpen,
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
      libraryPropertiesOpen = false;
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
    isPip: () => pip.state.active,
    exitPip: () => void pip.exit(),
    actions: {
      "open-file": openFileDialog,
      "close-file": closeFile,
      "toggle-library": () => (menuStore.libraryOpen = !menuStore.libraryOpen),
      "toggle-pip": () => void handleTogglePip(),
      "library-search": () => {
        if (!menuStore.libraryOpen) return;
        library.requestSearchFocus();
      },
      "reset-accessibility": () => {
        resetAccessibilitySettings();
        showToast({
          message: t("shell.accessibility.reset"),
          color: "green",
        });
      },
      "play-pause": () => {
        if (!isTimedMedia()) return;
        const wasPlaying = playing;
        togglePlay();
        playAudioCue(wasPlaying ? "pause" : "play");
      },
      fullscreen: handleToggleFullscreen,
      "next-file": () => {
        void navigate(1);
        playAudioCue("navigate");
      },
      "previous-file": () => {
        void navigate(-1);
        playAudioCue("navigate");
      },
      "first-file": () => {
        void navigateToEdge(true);
        playAudioCue("navigate");
      },
      "last-file": () => {
        void navigateToEdge(false);
        playAudioCue("navigate");
      },
      "seek-forward": () => {
        const el = getMediaEl();
        if (el && shouldSeekMedia()) {
          const duration = Number.isFinite(el.duration)
            ? el.duration
            : Number.POSITIVE_INFINITY;
          el.currentTime = Math.min(
            el.currentTime + seekDistance(el),
            duration,
          );
          playAudioCue("seek");
        } else {
          void navigate(1);
          playAudioCue("navigate");
        }
      },
      "seek-backward": () => {
        const el = getMediaEl();
        if (el && shouldSeekMedia()) {
          el.currentTime = Math.max(el.currentTime - seekDistance(el), 0);
          playAudioCue("seek");
        } else {
          void navigate(-1);
          playAudioCue("navigate");
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
      "toggle-slideshow": () => {
        if (slideshow.active) {
          slideshow.stop();
          return;
        }
        if (queue.length > 0) {
          void queue.startPlayback();
          return;
        }
        menuStore.queueMenuVisible = true;
      },
      "toggle-sleep-timer": toggleSleepTimerMenu,
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

  // Intercept Ctrl+F before WebView2's built-in find, and route the find
  // binding to whichever surface is visible: library search over PDF find.
  $effect(() => {
    function captureFind(e: KeyboardEvent) {
      if (keybindStore.isRecording || keybindStore.cheatSheetOpen) return;

      const isCtrlF = e.ctrlKey && (e.key === "f" || e.key === "F");
      const libraryOpen = menuStore.libraryOpen;
      const target = e.target as Element | null;

      // Library tab cycling. This lives at the page level so it still works
      // when focus is on the top or bottom bar.
      if (
        libraryOpen &&
        e.key === "Tab" &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !isTypingTarget(e.target) &&
        !libraryPropertiesOpen &&
        document.querySelector(
          ".delete-overlay, .library-dialog-overlay, [role='dialog']",
        ) === null
      ) {
        e.preventDefault();
        e.stopPropagation();
        library.cycleActiveTab(e.shiftKey ? -1 : 1);
        return;
      }

      // WebView2 owns Ctrl+F; suppress its find bar before anything else.
      if (isCtrlF) {
        e.preventDefault();
        e.stopPropagation();
      }

      const overlayOpen = libraryOpen
        ? menuStore.isAnyOpenExceptLibrary
        : menuStore.isAnyOpen;
      if (overlayOpen) return;

      const inLibrarySearch = !!target?.closest?.("[data-library-search]");
      const chord = e.ctrlKey || e.altKey || e.metaKey;
      if (
        libraryOpen &&
        keybindStore.matches("library-search", e) &&
        (inLibrarySearch ? chord : !isTypingTarget(e.target))
      ) {
        e.preventDefault();
        e.stopPropagation();
        library.requestSearchFocus();
        return;
      }

      if (isCtrlF) {
        if (isTypingTarget(e.target)) return;
        if (isPdf && keybindStore.matches("pdf-find", e)) {
          pdf.toggleFind();
        }
        return;
      }

      if (menuStore.isAnyOpen || isTypingTarget(e.target)) return;
      if (isPdf && keybindStore.matches("pdf-find", e)) {
        e.preventDefault();
        e.stopPropagation();
        pdf.toggleFind();
      }
    }
    window.addEventListener("keydown", captureFind, { capture: true });
    return () =>
      window.removeEventListener("keydown", captureFind, { capture: true });
  });
  function openContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (pip.state.active) {
      if (
        target.closest(
          "button, .context-menu, .pip-progress, .pip-audio-progress, .pip-volume, .pip-nav",
        )
      ) {
        return;
      }
      pip.openMenu(e.clientX, e.clientY);
      return;
    }
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
  const {
    propsCopyPath,
    propsOpenFolder,
    propsCopyAll,
    copyPropValue,
    viewPropsOpenFolder,
    viewPropsCopyPath,
    viewPropsCopyAll,
  } = createPropertiesActions({
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
    getViewInfo: () => library.viewInfo,
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
      get queueMenuVisible() {
        return menuStore.queueMenuVisible;
      },
      get sleepTimerMenuVisible() {
        return menuStore.sleepTimerMenuVisible;
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
    closeQueueMenu,
    closeSleepTimerMenu,
    closeTimestampEditor,
  });

  const _shellProps = $derived({
    fileName,
    fileSrc,
    filePath,
    isRemote,
    fileList,
    currentIndex,
    isVideo,
    isAudio,
    isPdf,
    playing,
    getMediaEl,
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
    toggleQueueMenu,
    closeQueueMenu,
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
    markupMenuHasEdits: markup.hasUnapplied,
    openConvertedFile,
    showValue,
    muted,
    volume,
    setVolume,
    propertiesOpen,
    libraryPropertiesOpen,
    onOpenLibraryProperties: () => (libraryPropertiesOpen = true),
    onCloseLibraryProperties: () => (libraryPropertiesOpen = false),
    viewPropsOpenFolder,
    viewPropsCopyPath,
    viewPropsCopyAll,
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

  async function migrateFilePathState(oldPath: string, newPath: string) {
    if (!oldPath || !newPath || oldPath === newPath) return;
    try {
      await dbMigrateFilePath(oldPath, newPath);
    } catch (e) {
      console.error("Failed to migrate file metadata:", e);
    }
    library.migrateFilePath(oldPath, newPath);
    editing.migratePath(oldPath, newPath);
    markup.migratePath(oldPath, newPath);
    queue.replacePath(oldPath, newPath);
    migrateFilePathStorage(oldPath, newPath);
    clearFolderCache(getParentFolder(oldPath));
    clearFolderCache(getParentFolder(newPath));
    if (samePath(filePath, oldPath)) {
      filePath = newPath;
      await loadFile(newPath);
    }
  }

  async function migrateFolderPathState(oldFolder: string, newFolder: string) {
    if (!oldFolder || !newFolder || oldFolder === newFolder) return;
    try {
      await dbMigrateFolderPaths(oldFolder, newFolder);
    } catch (e) {
      console.error("Failed to migrate folder metadata:", e);
    }
    library.migrateFolderPath(oldFolder, newFolder);
    editing.migrateFolderPath(oldFolder, newFolder);
    markup.migrateFolderPath(oldFolder, newFolder);
    queue.replacePrefix(oldFolder, newFolder);
    migrateFolderPathStorage(oldFolder, newFolder);
    clearFolderCache(oldFolder);
    clearFolderCache(newFolder);
    const nextPath = replacePathPrefix(filePath, oldFolder, newFolder);
    if (nextPath) {
      filePath = nextPath;
      await loadFile(nextPath);
    }
  }

  function hasOpenEdits(): boolean {
    return (
      editing.getHasEdits() ||
      editing.getCropBounds() !== null ||
      markup.hasUnapplied
    );
  }

  async function cleanupBeforeClose() {
    saveCurrentPosition();
    library.flushRecentSave();
    backgroundAudio.stop();
    slideshow.stop();
    sleepTimer.clear();
    pdf.cleanup();
    editing.cleanup();
    markup.cleanup();
    fxEngine.destroy();
    eqEngine.destroy();
    await trackSelection.releaseAllAudioVariants();
    try {
      await invokeCleanupTempFolder();
    } catch (e) {
      console.error("Failed to clean temp files on close:", e);
    }
  }

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
    isPlaying: { get: () => playing },
    filePath: { get: () => filePath },
    rawCurrentSecs: { get: () => rawCurrentSecs },
    rawDurationSecs: { get: () => rawDurationSecs },
    playbackUI,
    loadFile,
    openUrl,
    setDragDropActive: (active) => (dragDropActive = active),
    openLibrary: () => (menuStore.libraryOpen = true),
    saveResumePosition: saveCurrentPosition,
    hasPlayback,
    pausePlayback,
    hasOpenEdits,
    cleanupBeforeClose,
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
    eqEngine.setAccessibilityAudio({
      volumeLimit: accessibility.volumeLimit,
      monoAudio: accessibility.monoAudio,
      balance: accessibility.balance,
      normalizeVolume: accessibility.normalizeVolume,
      limitPeaks: accessibility.limitPeaks,
      boostDialogue: accessibility.boostDialogue,
    });
  });

  $effect(() => {
    void accessibility.volumeLimit;
    backgroundAudio.refreshVolume();
  });

  let prevPlayingForAlert = untrack(() => playing);
  $effect(() => {
    const current = playing;
    if (current === prevPlayingForAlert) return;
    prevPlayingForAlert = current;
    if (accessibility.visualAlerts) {
      accessibility.pulseVisualAlert(current ? "play" : "pause");
    }
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
    if (sleepTimer.closeApp) {
      void closeWindow();
      return;
    }
    showToast({
      message: t("shell.sleep.stoppedPlayback"),
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

  // The viewer is unmounted while the library is open, so media elements never
  // fire load events. Clear the loading border instead of leaving it spinning
  // forever when a background load (e.g. the folder watcher advancing past a
  // deleted file) starts while the library covers the viewer.
  $effect(() => {
    if (menuStore.libraryOpen && isLoadingFile) {
      setMediaState({ isLoadingFile: false, loadingFadingOut: false });
    }
  });

  // Save/restore viewer menu state across library transitions
  let prevLibraryOpen = $state(false);
  $effect(() => {
    if (menuStore.libraryOpen && !prevLibraryOpen) {
      menuStore.saveViewerMenus();
    } else if (!menuStore.libraryOpen && prevLibraryOpen) {
      libraryPropertiesOpen = false;
      library.clearSearch();
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
  viewerToggleFullscreen={handleToggleFullscreen}
  pipActive={pip.state.active}
  pipPhase={pip.state.phase}
  {pipAvailable}
  togglePip={handleTogglePip}
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
  queueMenuVisible={menuStore.queueMenuVisible}
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
    await migrateFilePathState(filePath, newPath);
  }}
  onFolderRenamed={async (newFolderPath: string) => {
    await migrateFolderPathState(getParentFolder(filePath), newFolderPath);
  }}
  onFolderMoved={migrateFolderPathState}
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
      {isRemote}
      bind:viewerEl
      bind:imageEl
      bind:videoEl
      bind:audioEl
      bind:cropContainerEl
      bind:pdfContainerEl
      bind:hoverZone
      {dragDropActive}
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
      tracks={trackSelection}
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
      toggleFullscreen={handleToggleFullscreen}
      {fsPillEl}
      {onImageLoad}
      onVideoLoad={handleVideoLoad}
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
      onRemoteError={handleRemoteError}
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

{#if backgroundAudio.active && !pip.state.active}
  <NowPlayingPill />
{/if}
