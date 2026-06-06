<!-- Layout shell: wires feature modules into the template. State and handlers live in src/lib/features/*/. -->
<script lang="ts">
  import { invoke, convertFileSrc } from "@tauri-apps/api/core";
  import {
    createPlaybackActions,
    createPlaybackUI,
    formatTime,
  } from "$lib/features/media/playback.svelte";
  import { createClips } from "$lib/features/media/clips.svelte";
  import {
    markerStore,
    createMarkerActions,
  } from "$lib/features/markers/markers.svelte";
  import { createKeybindHandler } from "$lib/shared/keybinds";
  import {
    VOLUME_SEGMENTS,
    LOOP_MODES,
    ALL_EXTS,
    AUDIO_EXTS,
    type LoopMode,
    type SortMode,
  } from "$lib/shared/constants";
  import type {
    ClipBoundary,
    MediaProperties,
  } from "$lib/shared/types";
  import {
    saveVolume,
    saveLoopMode,
    saveSliderMode,
    loadAudioLayoutMode,
  } from "$lib/services/storage";
  import {
    invokeOpenDirectory,
    exportEditedImage,
    invokeExportEditedMedia,
    renderMarkupOnImage,
    invokeCheckMediaIntegrity,
  } from "$lib/features/media/tools";

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
  import { createMedia } from "$lib/features/media/media.svelte";
  import { viewer } from "$lib/features/viewer/viewer.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import { markup } from "$lib/features/markup/markup.svelte";
  import { createMarkupActions } from "$lib/features/markup/markupActions";
  import TimelineMarkers from "$lib/features/timeline/TimelineMarkers.svelte";
  import PlaybackControls from "$lib/features/media/PlaybackControls.svelte";
  import Shell from "$lib/shared/Shell.svelte";
  import SortMenu from "$lib/features/navigation/SortMenu.svelte";
  import { createToastHelpers } from "$lib/shared/toast";
  import {
    ctxCopyImage,
    ctxCopyFrame,
    ctxCopyPath,
    ctxShowInExplorer,
    ctxRotate,
    ctxFlip,
    ctxClearMarkers,
    ctxEdit,
    ctxMarkup,
    ctxProperties,
    ctxShare,
  } from "$lib/features/dialogs/contextActions";
  import { createPropertiesActions } from "$lib/features/dialogs/propertiesActions";
  import { contextMenuStore } from "$lib/features/dialogs/contextMenu.svelte";
  import ApplyEditDialog from "$lib/features/dialogs/ApplyEditDialog.svelte";
  import TransparencyConfirmDialog from "$lib/features/dialogs/TransparencyConfirmDialog.svelte";
  import {
    loadMediaProperties,
    refreshFfprobeAvailability,
    installFfmpegAndWait,
  } from "$lib/features/media/ffmpeg";
  import { setupInit } from "./init";
  import { createPdf } from "$lib/features/pdf/pdf.svelte";
  import AudioPlayer from "$lib/features/media/AudioPlayer.svelte";
  import Marquee from "$lib/shared/Marquee.svelte";
  import { corruption } from "$lib/features/media/corruption.svelte";
  import { createFolderWatcher } from "$lib/features/navigation/folderWatcher.svelte";
  import { sort } from "$lib/features/navigation/sort.svelte";
  import {
    minimizeWindow,
    maximizeWindow,
    closeWindow,
  } from "$lib/features/window/windowControls";
  import { createFileOpenActions } from "$lib/features/fileActions/fileOpen";
  import { createPanDrag } from "$lib/features/viewer/panDrag";
  import { loadCdColorForFile } from "$lib/features/media/cdColor";
  import {
    createDeleteActions,
    deleteStore,
  } from "$lib/features/fileActions/deleteFile.svelte";
  import {
    menuStore,
    createMenuActions,
  } from "$lib/features/dialogs/menuVisibility.svelte";

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
  let videoInnerEl = $state<HTMLDivElement | null>(null);
  let viewerEl = $state<HTMLElement | null>(null);
  let pdfContainerEl = $state<HTMLElement | null>(null);
  let playing = $state(false);
  let muted = $state(false);
  let loopMode = $state<LoopMode>("loop");
  let progress = $state(0);
  let rawCurrentSecs = $state(0);
  let rawDurationSecs = $state(0);
  let timerShowRemaining = $state(false);
  let imageNaturalWidth = $state(0);
  let imageNaturalHeight = $state(0);
  let volume = $state(1);
  let hoverZone = $state("none");
  let dragStart = $state({ x: 0, y: 0, tx: 0, ty: 0 });
  let lastLeftClickTime = 0;
  let pendingPlay: ReturnType<typeof setTimeout> | undefined;
  let isScrubbing = $state(false);
  let editApplyConfirm = $state(false);
  let editTransparencyConfirm = $state(false);
  let pendingEditAction = $state<"apply" | "export" | null>(null);
  let exportFormatOverride = $state<"png" | null>(null);
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
  let tsDeleteConfirm = $state(false);
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
  let frameCopyToast = $state<{
    visible: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({ visible: false, message: "", tone: "success" });
  let frameCopyToastTimer: ReturnType<typeof setTimeout> | undefined;
  let imageCopyToast = $state<{
    visible: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({ visible: false, message: "", tone: "success" });
  let imageCopyToastTimer: ReturnType<typeof setTimeout> | undefined;
  let exportToast = $state<{
    visible: boolean;
    phase: string;
    message: string;
    outputPath: string;
  }>({ visible: false, phase: "", message: "", outputPath: "" });
  let clipboardToast = $state<{ visible: boolean; filePath: string | null }>({
    visible: false,
    filePath: null,
  });

  // ── Derived ────────────────────────────────────────────
  const imageScale = $derived(viewer.state.zoomLevel / 100);
  const cropClipPath = $derived.by(() => {
    const bounds = editing.getCropBounds();
    if (!bounds) return "";
    return `inset(${(bounds.top * 100).toFixed(2)}% ${(bounds.right * 100).toFixed(2)}% ${(bounds.bottom * 100).toFixed(2)}% ${(bounds.left * 100).toFixed(2)}%)`;
  });
  const colorFilter = $derived.by(() => {
    const parts: string[] = [];
    const s = editing.snapshot;
    if (s.brightness !== 1) parts.push(`brightness(${s.brightness})`);
    if (s.contrast !== 1) parts.push(`contrast(${s.contrast})`);
    if (s.saturation !== 1) parts.push(`saturate(${s.saturation})`);
    if (s.hue !== 0) parts.push(`hue-rotate(${s.hue}deg)`);
    return parts.length ? ` filter: ${parts.join(" ")};` : "";
  });
  const imageStyle = $derived(
    `transform: scale(${imageScale}) translate(${viewer.state.translateX / imageScale}px, ${viewer.state.translateY / imageScale}px) rotate(${editing.snapshot.rotation}deg) scaleX(${editing.snapshot.flipped ? -1 : 1}) scaleY(${editing.snapshot.flippedVertical ? -1 : 1}); transform-origin: center center; display: block;${colorFilter}${cropClipPath ? ` clip-path: ${cropClipPath};` : ""}`,
  );
  const videoWrapperTransform = $derived(viewer.getVideoWrapperTransform());
  const videoInnerTransform = $derived(viewer.getVideoInnerTransform());
  const videoInnerStyle = $derived(
    `${videoInnerTransform}${colorFilter}${cropClipPath ? `; clip-path: ${cropClipPath}` : ""}`,
  );
  const panCursor = $derived(viewer.getPanCursor());
  const fsCursor = $derived(
    markup.drawActive
      ? "crosshair"
      : !viewer.state.fsControlsVisible && !markerStore.tsEditMenu.visible
        ? "none"
        : panCursor,
  );
  const isGifVideo = $derived(isVideo && getFileExt(filePath) === "gif");
  const clips = createClips({
    getFilePath: () => filePath,
    getRawDurationSecs: () => rawDurationSecs,
    getIsVideo: () => isVideo,
    getVideoEl: () => videoEl,
    getAudioEl: () => audioEl,
    getFileParentFolder: () => getParentFolder(filePath),
    ensureFfprobe: async () => {
      if (!ffprobeChecked) {
        await refreshFfprobeAvailability({
          setFfprobeChecked: (v) => (ffprobeChecked = v),
          setFfprobeAvailable: (v) => (ffprobeAvailable = v),
        });
      }
      if (!ffprobeAvailable) {
        await installFfmpegAndWait({
          setFfmpegInstallError: (v) => (ffmpegInstallError = v),
          setFfmpegInstalling: (v) => (ffmpegInstalling = v),
          setFfprobeAvailable: (v) => (ffprobeAvailable = v),
          setFfprobeChecked: (v) => (ffprobeChecked = v),
          loadMediaProperties: () =>
            loadMediaProperties({
              filePath,
              setMediaProps: (v) => (mediaProps = v),
              setMediaPropsLoading: (v) => (mediaPropsLoading = v),
            }),
        });
      }
      return ffprobeAvailable;
    },
  });
  const anyMenuOpen = $derived(
    contextMenuStore.isOpen ||
      menuStore.appDropdownVisible ||
      menuStore.slideshowMenuVisible ||
      menuStore.editMenuVisible ||
      menuStore.markupMenuVisible ||
      menuStore.settingsOpen ||
      menuStore.accessibilityOpen ||
      menuStore.helpOpen ||
      menuStore.aboutOpen ||
      menuStore.feedbackOpen ||
      markerStore.tsEditMenu.visible ||
      deleteStore.deleteConfirm ||
      propertiesOpen ||
      shareOpen ||
      clips.clipDeleteConfirm.visible ||
      menuStore.tsMenuOpen ||
      editApplyConfirm ||
      editTransparencyConfirm ||
      corruption.state.warning ||
      sort.menuVisible,
  );
  function currentTimeDisplay(): string {
    if (!timerShowRemaining) return formatTime(rawCurrentSecs);
    return `-${formatTime(rawDurationSecs - rawCurrentSecs)}`;
  }
  const durationDisplay = $derived(formatTime(rawDurationSecs));
  const audioBitrateDisplay = $derived.by(() => {
    if (!isAudio || fileSizeBytes <= 0 || rawDurationSecs <= 0) return "";
    const kbps = Math.round((fileSizeBytes * 8) / rawDurationSecs / 1000);
    return `${kbps} kbps`;
  });
  const timerTooltip = $derived(timerShowRemaining ? "Remaining" : "Elapsed");

  // ── Toast helpers ──────────────────────────────────────
  const toast = createToastHelpers({
    getFrameCopyToast: () => frameCopyToast,
    setFrameCopyToast: (v) => (frameCopyToast = v),
    getFrameCopyToastTimer: () => frameCopyToastTimer,
    setFrameCopyToastTimer: (v) => (frameCopyToastTimer = v),
    getImageCopyToast: () => imageCopyToast,
    setImageCopyToast: (v) => (imageCopyToast = v),
    getImageCopyToastTimer: () => imageCopyToastTimer,
    setImageCopyToastTimer: (v) => (imageCopyToastTimer = v),
    getClipboardToast: () => clipboardToast,
    setClipboardToast: (v) => (clipboardToast = v),
  });

  // ── Viewer helpers ─────────────────────────────────────
  $effect(() => {
    viewer.setVideoEl(videoEl);
  });
  function getViewerContentSize(): { width: number; height: number } {
    if (!viewerEl) return { width: 0, height: 0 };
    const style = getComputedStyle(viewerEl);
    const padH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return {
      width: viewerEl.clientWidth - padH,
      height: viewerEl.clientHeight - padV,
    };
  }
  $effect(() => {
    if (!viewerEl) return;
    const el = viewerEl;
    const observer = new ResizeObserver(() => {
      if (
        fileSrc &&
        !isVideo &&
        imageNaturalWidth > 0 &&
        imageNaturalHeight > 0
      ) {
        if (
          Math.abs(viewer.state.zoomLevel - viewer.state.baseZoomLevel) < 0.5
        ) {
          const { width, height } = getViewerContentSize();
          viewer.fitToScreen(
            width,
            height,
            imageNaturalWidth,
            imageNaturalHeight,
          );
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  });
  // Re-fit image when thumbnail bar visibility or rotation changes.
  // Both values are tracked as reactive dependencies but not used in the calculation.
  $effect(() => {
    void thumbnailBarVisible;
    void editing.snapshot.rotation;
    if (
      viewerEl &&
      fileSrc &&
      !isVideo &&
      !viewer.state.isFullscreen &&
      imageNaturalWidth > 0 &&
      imageNaturalHeight > 0
    ) {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(width, height, imageNaturalWidth, imageNaturalHeight);
    }
  });
  // ── Smooth progress via requestAnimationFrame ──────────
  $effect(() => {
    const mediaEl = isVideo ? videoEl : isAudio ? audioEl : null;
    if (!mediaEl) return;

    let rafId: number;

    function poll() {
      const el = mediaEl;
      if (!el) return;

      if (!isScrubbing) {
        rawCurrentSecs = el.currentTime;
        rawDurationSecs = el.duration || 0;
        progress =
          rawDurationSecs > 0 ? (rawCurrentSecs / rawDurationSecs) * 100 : 0;
        playing = !el.paused;

        // AB loop enforcement
        if (markerStore.abLoopRegion && el.currentTime >= markerStore.abLoopRegion.end) {
          el.currentTime = markerStore.abLoopRegion.start;
        }
      }

      rafId = requestAnimationFrame(poll);
    }

    function onPlay() {
      rafId = requestAnimationFrame(poll);
    }

    function onPause() {
      cancelAnimationFrame(rafId);
    }

    mediaEl.addEventListener("play", onPlay);
    mediaEl.addEventListener("pause", onPause);

    // If already playing (e.g. autoplay), start RAF loop immediately
    if (!mediaEl.paused) {
      rafId = requestAnimationFrame(poll);
    }

    return () => {
      cancelAnimationFrame(rafId);
      mediaEl.removeEventListener("play", onPlay);
      mediaEl.removeEventListener("pause", onPause);
    };
  });
  function toggleFullscreen() {
    viewer.toggleFullscreen();
  }
  function resetZoom() {
    if (
      viewer.state.zoomLocked ||
      !viewerEl ||
      imageNaturalWidth <= 0 ||
      imageNaturalHeight <= 0
    ) {
      viewer.resetZoom();
    } else {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(width, height, imageNaturalWidth, imageNaturalHeight);
    }
  }
  function handleToggleZoomLock() {
    const wasLocked = viewer.state.zoomLocked;
    viewer.toggleZoomLock();
    if (wasLocked && !viewer.state.zoomLocked) {
      if (viewerEl && imageNaturalWidth > 0 && imageNaturalHeight > 0) {
        const { width, height } = getViewerContentSize();
        viewer.fitToScreen(
          width,
          height,
          imageNaturalWidth,
          imageNaturalHeight,
        );
      }
    }
  }
  function handleViewerScroll(e: WheelEvent) {
    viewer.handleViewerScroll(e, fileSrc);
  }

  // ── Playback ───────────────────────────────────────────
  const getMediaEl = () => (isVideo ? videoEl : isAudio ? audioEl : null);
  const playback = createPlaybackActions(getMediaEl);
  const playbackUI = createPlaybackUI(getMediaEl, () => volume, setVolume);
  function togglePlay() {
    playback.togglePlay();
    playing = !playing;
  }
  function toggleMute() {
    playback.toggleMute((v) => (muted = v), muted);
  }
  function cycleLoopMode() {
    const idx = LOOP_MODES.indexOf(loopMode);
    loopMode = LOOP_MODES[(idx + 1) % LOOP_MODES.length];
    saveLoopMode(loopMode);
    if (videoEl) videoEl.loop = loopMode === "loop";
    if (audioEl) audioEl.loop = loopMode === "loop";
  }
  function setLoopMode(mode: LoopMode) {
    loopMode = mode;
    saveLoopMode(loopMode);
    if (videoEl) videoEl.loop = loopMode === "loop";
    if (audioEl) audioEl.loop = loopMode === "loop";
  }
  function onMediaEnded() {
    if (slideshow.active) return;
    if (loopMode === "stop") {
      playing = false;
    } else if (loopMode === "next") {
      navigate(1);
    } else if (loopMode === "shuffle") {
      if (fileList.length > 1) {
        let idx;
        do {
          idx = Math.floor(Math.random() * fileList.length);
        } while (idx === currentIndex);
        currentIndex = media.navigate(
          idx - currentIndex,
          fileList,
          currentIndex,
          setMediaState,
        );
      }
    }
  }
  function toggleTimer() {
    timerShowRemaining = !timerShowRemaining;
  }
  function startScrubbing(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || !mediaEl.duration) return;
    const bar = e.currentTarget as HTMLElement;
    const wasPlaying = !mediaEl.paused;
    mediaEl.pause();
    isScrubbing = true;

    // Cache rect at drag start to avoid forced layouts on every mousemove
    const barRect = bar.getBoundingClientRect();
    const SEEK_THROTTLE_MS = 100; // max ~10 seeks/sec during drag — prevents overwhelming 4K decoder
    let pendingTime: number | null = null;
    let seekInProgress = false;
    let lastSeekTime = 0;

    const computeTime = (clientX: number): number => {
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - barRect.left) / barRect.width),
      );
      return ratio * mediaEl!.duration;
    };

    const doSeek = (time: number) => {
      seekInProgress = true;
      mediaEl!.currentTime = time;
      // Update UI immediately from intended position — don't read back
      // currentTime (may lag behind the synchronous setter on some engines).
      rawCurrentSecs = time;
      progress = (time / mediaEl!.duration) * 100;
    };

    const onSeeked = () => {
      seekInProgress = false;
      if (pendingTime !== null) {
        const t = pendingTime;
        pendingTime = null;
        lastSeekTime = Date.now();
        doSeek(t);
      }
    };

    mediaEl.addEventListener("seeked", onSeeked);
    doSeek(computeTime(e.clientX));

    function onMouseMove(ev: MouseEvent) {
      const time = computeTime(ev.clientX);
      // Always update UI immediately — keeps the playhead tracking the mouse smoothly
      rawCurrentSecs = time;
      progress = (time / mediaEl!.duration) * 100;

      if (seekInProgress) {
        // A seek is in flight — coalesce into pendingTime; the seeked
        // handler will pick it up.
        pendingTime = time;
      } else if (Date.now() - lastSeekTime >= SEEK_THROTTLE_MS) {
        // Enough time since last seek — fire one now
        doSeek(time);
        lastSeekTime = Date.now();
      } else {
        // Within throttle window — queue for the next seeked or mouseup
        pendingTime = time;
      }
    }

    function onMouseUp() {
      isScrubbing = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      mediaEl!.removeEventListener("seeked", onSeeked);
      // Final seek to the last pending position.
      // Cancels any in-flight seek — the browser will decode the new target.
      if (pendingTime !== null) {
        seekInProgress = true;
        mediaEl!.currentTime = pendingTime;
        rawCurrentSecs = pendingTime;
        progress = (pendingTime / mediaEl!.duration) * 100;
      }
      if (wasPlaying) mediaEl!.play();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }
  function startDiscScrubbing(e: MouseEvent | TouchEvent) {
    if (!audioEl || !audioEl.duration) return;
    const wasPlaying = !audioEl.paused;
    audioEl.pause();
    isScrubbing = true;

    const SEEK_THROTTLE_MS = 100;
    let pendingTime: number | null = null;
    let seekInProgress = false;
    let lastSeekTime = 0;

    const doSeek = (time: number) => {
      seekInProgress = true;
      audioEl!.currentTime = time;
      rawCurrentSecs = time;
      progress = (time / audioEl!.duration) * 100;
    };

    const onSeeked = () => {
      seekInProgress = false;
      if (pendingTime !== null) {
        const t = pendingTime;
        pendingTime = null;
        lastSeekTime = Date.now();
        doSeek(t);
      }
    };

    audioEl.addEventListener("seeked", onSeeked);

    discScrubHandlers.onScrubMove = (
      e: MouseEvent | TouchEvent,
      newProgress: number,
    ) => {
      const time = (newProgress / 100) * audioEl!.duration;
      rawCurrentSecs = time;
      progress = newProgress;

      if (seekInProgress) {
        pendingTime = time;
      } else if (Date.now() - lastSeekTime >= SEEK_THROTTLE_MS) {
        doSeek(time);
        lastSeekTime = Date.now();
      } else {
        pendingTime = time;
      }
    };

    discScrubHandlers.onScrubEnd = () => {
      isScrubbing = false;
      audioEl!.removeEventListener("seeked", onSeeked);
      if (pendingTime !== null) {
        seekInProgress = true;
        audioEl!.currentTime = pendingTime;
        rawCurrentSecs = pendingTime;
        progress = (pendingTime / audioEl!.duration) * 100;
      }
      if (wasPlaying) audioEl!.play();
      // Reset handlers
      discScrubHandlers.onScrubMove = () => {};
      discScrubHandlers.onScrubEnd = () => {};
    };
  }
  let discScrubHandlers = $state<{
    onScrubMove: (e: MouseEvent | TouchEvent, newProgress: number) => void;
    onScrubEnd: () => void;
  }>({ onScrubMove: () => {}, onScrubEnd: () => {} });
  function setVolume(val: number) {
    playback.setVolume(val, ({ volume: v, muted: m }) => {
      volume = v;
      muted = m;
    });
    saveVolume(volume);
  }
  function toggleVolumeSliderMode() {
    playbackUI.toggleVolumeSliderMode();
    volumeSliderMode = playbackUI.volumeSliderMode;
    saveSliderMode({ volume: volumeSliderMode, speed: speedSliderMode });
  }
  function toggleSpeedSliderMode() {
    playbackUI.toggleSpeedSliderMode();
    speedSliderMode = playbackUI.speedSliderMode;
    saveSliderMode({ volume: volumeSliderMode, speed: speedSliderMode });
  }
  const markerActions = createMarkerActions({
    getFilePath: () => filePath,
    getRawDurationSecs: () => rawDurationSecs,
    getLoopMode: () => loopMode,
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
    updateTimestampTitle,
    getTimestampById,
    getTimestampPct,
    setABLoop,
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
    updateTooltipDuringDrag,
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


  // ── File loading / navigation ──────────────────────────
  function setMediaState(
    data: Partial<import("$lib/features/media/media.svelte").MediaState>,
  ) {
    if (data.filePath !== undefined) filePath = data.filePath;
    if (data.fileSrc !== undefined) fileSrc = data.fileSrc;
    if (data.fileName !== undefined) fileName = data.fileName;
    if (data.isVideo !== undefined) isVideo = data.isVideo;
    if (data.isAudio !== undefined) isAudio = data.isAudio;
    if (data.isAudio && data.filePath) {
      loadCdColorForFile(data.filePath, {
        setCdColor: (v) => (cdColor = v),
        setCdColorIndex: (v) => (cdColorIndex = v),
        setCoverArtSrc: (v) => (coverArtSrc = v),
      });
    }
    if (data.isPdf !== undefined) isPdf = data.isPdf;
    if (data.fileList !== undefined) fileList = data.fileList;
    if (data.currentIndex !== undefined) currentIndex = data.currentIndex;
    if (data.fileSize !== undefined) fileSize = data.fileSize;
    if (data.fileSizeBytes !== undefined) fileSizeBytes = data.fileSizeBytes;
    if (data.fileDimensions !== undefined) fileDimensions = data.fileDimensions;
    if (data.fileCreated !== undefined) fileCreated = data.fileCreated;
    if (data.fileModified !== undefined) fileModified = data.fileModified;
    if (data.fileInfoLoading !== undefined)
      fileInfoLoading = data.fileInfoLoading;
    if (data.isLoadingFile !== undefined) isLoadingFile = data.isLoadingFile;
    if (data.loadingFadingOut !== undefined)
      loadingFadingOut = data.loadingFadingOut;
    if (data.imageRotation !== undefined)
      editing.setRotation(data.imageRotation);
    if (data.imageFlipped !== undefined)
      editing.snapshot.flipped = data.imageFlipped;
    if (data.imageNaturalWidth !== undefined)
      imageNaturalWidth = data.imageNaturalWidth;
    if (data.imageNaturalHeight !== undefined)
      imageNaturalHeight = data.imageNaturalHeight;
    if (data.rawCurrentSecs !== undefined) rawCurrentSecs = data.rawCurrentSecs;
    if (data.rawDurationSecs !== undefined)
      rawDurationSecs = data.rawDurationSecs;
    if (data.progress !== undefined) progress = data.progress;
    if (data.playing !== undefined) playing = data.playing;
    if (data.timestamps !== undefined) markerStore.timestamps = data.timestamps;
    if (data.clipBoundaries !== undefined)
      clips.setBoundaries(data.clipBoundaries);
    if (data.resumePoint !== undefined) markerStore.resumePoint = data.resumePoint;
  }
  const media = createMedia(
    () => videoEl,
    () => audioEl,
    () => volume,
    () => muted,
    () => loopMode === "loop",
    (newPath?: string) => {
      markerStore.tsTooltip = { ...markerStore.tsTooltip, visible: false };
      markerStore.tsEditMenu = { ...markerStore.tsEditMenu, visible: false };
      markerStore.loopStart = null;
      markerStore.loopEnd = null;
      resetZoom();
      viewer.state.baseZoomLevel = 100;
      if (newPath) {
        editing.switchFile(newPath);
      } else {
        editing.cleanup();
        markup.cleanup();
        markup.cleanup();
      }
      menuStore.editMenuVisible = false;
    },
  );
  slideshow.bind(
    () => fileList,
    () => currentIndex,
    advanceSlide,
    () => (isVideo ? videoEl : isAudio ? audioEl : null),
  );

  // ── PDF ─────────────────────────────────────────────────
  const pdf = createPdf();
  function onImageLoad(e: Event) {
    media.onImageLoad(e, isLoadingFile, setMediaState, () =>
      media.finishLoading(setMediaState),
    );
    const img = e.target as HTMLImageElement;
    if (viewerEl && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(width, height, img.naturalWidth, img.naturalHeight);
    }
    if (slideshow.active) slideshow.onMediaLoaded();
  }
  function onVideoLoad() {
    media.onVideoLoad(isLoadingFile, setMediaState, () =>
      media.finishLoading(setMediaState),
    );
    viewer.resetZoom();
    viewer.state.baseZoomLevel = 100;
    if (slideshow.active) slideshow.onMediaLoaded();
    // After metadata load, video intrinsic size may have changed.
    // If the mouse is no longer over the video wrapper, reset hover state
    // so arrow keys don't seek in a stale hover zone.
    if (cropContainerEl && !cropContainerEl.matches(":hover")) {
      hoverZone = "none";
    }
  }
  function onAudioLoad() {
    const el = audioEl;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    el.loop = loopMode === "loop";
    playbackUI.initSliderMode(true, true);
    setMediaState({
      fileDimensions: "",
      fileInfoLoading: false,
      rawCurrentSecs: 0,
      rawDurationSecs: el.duration || 0,
      progress: 0,
      playing: !el.paused,
    });
    if (isLoadingFile) media.finishLoading(setMediaState);
    if (slideshow.active) slideshow.onMediaLoaded();
    // After metadata load, if the mouse is no longer over the audio wrapper,
    // reset hover state so arrow keys don't seek in a stale hover zone.
    if (audioEl?.parentElement && !audioEl.parentElement.matches(":hover")) {
      hoverZone = "none";
    }
  }
  async function loadFile(path: string) {
    slideshow.stop();
    editing.exitCropMode();
    await media.loadFile(
      path,
      setMediaState,
      (list, index) => {
        fileList = list;
        currentIndex = index >= 0 ? index : 0;
      },
      sort.mode,
      sort.desc,
    );
    // Start watching the parent folder
    const folder = getParentFolder(path);
    if (folder) folderWatcher.startWatching(folder);
  }
  function navigate(direction: number) {
    if (fileList.length === 0) return;
    slideshow.stop();
    editing.exitCropMode();
    const next = (currentIndex + direction + fileList.length) % fileList.length;
    currentIndex = media.navigate(
      direction,
      fileList,
      currentIndex,
      setMediaState,
    );
  }
  function navigateToIndex(index: number) {
    if (fileList.length === 0 || index === currentIndex) return;
    slideshow.stop();
    editing.exitCropMode();
    currentIndex = index;
    media.displayFile(fileList[index], setMediaState);
  }
  function navigateToEdge(first: boolean) {
    if (fileList.length === 0) return;
    slideshow.stop();
    editing.exitCropMode();
    currentIndex = media.navigateToEdge(first, fileList, setMediaState);
  }
  /** Navigate to the next/previous audio file in the file list, skipping non-audio files. */
  function navigateToAudioFile(direction: number): void {
    if (fileList.length === 0) return;
    let idx = (currentIndex + direction + fileList.length) % fileList.length;
    const startIdx = idx;
    do {
      const ext = getFileExt(fileList[idx]);
      if (AUDIO_EXTS.includes(ext)) {
        slideshow.stop();
        editing.exitCropMode();
        currentIndex = idx;
        media.displayFile(fileList[idx], setMediaState);
        return;
      }
      idx = (idx + direction + fileList.length) % fileList.length;
    } while (idx !== startIdx);
    // No other audio file found — do nothing
  }

  function handlePrevClick() {
    const now = Date.now();
    if (now - lastPrevClickTime < PREV_DOUBLE_CLICK_MS) {
      // Double-click: navigate to previous audio file
      navigateToAudioFile(-1);
    } else {
      // Single click: restart current audio from beginning
      if (audioEl && audioEl.duration) {
        audioEl.currentTime = 0;
        audioEl.play().catch(() => {});
        playing = true;
      }
    }
    lastPrevClickTime = now;
  }

  function handleNextClick() {
    navigateToAudioFile(1);
  }

  function toggleThumbnailBar() {
    thumbnailBarVisible = !thumbnailBarVisible;
  }
  function closeFile() {
    slideshow.stop();
    folderWatcher.stopWatching();
    clearTimeout(pendingPlay);
    markerStore.resumeTooltipVisible = false;
    editing.cleanup();
    viewer.state.zoomLevel = 100;
    viewer.state.baseZoomLevel = 100;
    viewer.state.translateX = 0;
    viewer.state.translateY = 0;
    media.closeFile(setMediaState);
    pdf.cleanup();
    mediaProps = null;
    mediaPropsLoading = false;
    clearFolderCache();
    corruption.reset();
  }

  // ── File watcher ─────────────────────────────────────
  const folderWatcher = createFolderWatcher({
    getFilePath: () => filePath,
    getFileList: () => fileList,
    getCurrentIndex: () => currentIndex,
    getSortMode: () => sort.mode,
    getSortDesc: () => sort.desc,
    setFileList: (v) => (fileList = v),
    setCurrentIndex: (v) => (currentIndex = v),
    loadFile: (path) => loadFile(path),
    closeFile: () => closeFile(),
  });

  // ── Sort ─────────────────────────────────────────────
  function onSortChange(mode: SortMode, desc: boolean) {
    sort.change(mode, desc);
    // Re-sort the current folder
    if (filePath) {
      const folder = getParentFolder(filePath);
      if (folder) folderWatcher.onFolderChanged(folder);
    }
  }
  function handleFsPillContext(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (fileList.length === 0) return;
    if (fsPillEl) {
      const rect = fsPillEl.getBoundingClientRect();
      sort.toggleAt(rect.left, window.innerHeight - rect.top + 4);
    } else {
      sort.toggle();
    }
  }

  function advanceSlide(nextIndex: number) {
    if (fileList.length === 0) return;
    editing.exitCropMode();
    currentIndex = nextIndex;
    media.displayFile(fileList[nextIndex], setMediaState);
  }

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
      deleteStore.deleteConfirm ||
      propertiesOpen ||
      shareOpen ||
      menuStore.editMenuVisible ||
      menuStore.markupMenuVisible ||
      menuStore.slideshowMenuVisible ||
      menuStore.appDropdownVisible ||
      menuStore.settingsOpen ||
      menuStore.accessibilityOpen ||
      menuStore.helpOpen ||
      menuStore.aboutOpen ||
      menuStore.feedbackOpen ||
      markerStore.tsEditMenu.visible ||
      menuStore.tsMenuOpen ||
      clips.clipDeleteConfirm.visible ||
      corruption.state.warning,
    closeDialogs: () => {
      contextMenuStore.close();
      deleteStore.deleteConfirm = false;
      propertiesOpen = false;
      shareOpen = false;
      menuStore.editMenuVisible = false;
      menuStore.markupMenuVisible = false;
      menuStore.slideshowMenuVisible = false;
      menuStore.appDropdownVisible = false;
      menuStore.settingsOpen = false;
      menuStore.accessibilityOpen = false;
      menuStore.helpOpen = false;
      menuStore.aboutOpen = false;
      menuStore.feedbackOpen = false;
      markerStore.tsEditMenu.visible = false;
      menuStore.tsMenuOpen = false;
      clips.clipDeleteConfirm.visible = false;
      editApplyConfirm = false;
      editTransparencyConfirm = false;
      pendingEditAction = null;
      exportFormatOverride = null;
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
    frameStep: (direction) => {
      if (!videoEl) return;
      videoEl.currentTime = Math.max(
        0,
        Math.min(videoEl.currentTime + direction * (1 / 30), videoEl.duration),
      );
    },
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
  async function ctxCopyImageFn() {
    await ctxCopyImage({
      filePath,
      closeContextMenu,
      showImageCopyToast: toast.showImageCopyToast,
    });
  }
  async function ctxCopyFrameFn() {
    await ctxCopyFrame({
      videoEl,
      closeContextMenu,
      showFrameCopyToast: toast.showFrameCopyToast,
    });
  }
  async function ctxCopyPathFn() {
    await ctxCopyPath({
      filePath,
      closeContextMenu,
      showFrameCopyToast: toast.showFrameCopyToast,
    });
  }
  async function ctxShowInExplorerFn() {
    await ctxShowInExplorer({ filePath, closeContextMenu });
  }
  function ctxRotateFn() {
    ctxRotate({
      closeContextMenu,
      pushUndo: () => editing.pushUndo(),
      rotate: () => viewer.rotate(),
    });
  }
  function ctxFlipFn() {
    ctxFlip({
      closeContextMenu,
      pushUndo: () => editing.pushUndo(),
      flip: () => viewer.flip(),
    });
  }
  function ctxClearMarkersFn() {
    ctxClearMarkers({
      closeContextMenu,
      clearAllTimestamps,
      clearBoundaries: () => clips.clearBoundaries(),
      removeResumePoint,
    });
  }
  function ctxEditFn() {
    ctxEdit({ openEditMenu });
  }
  function ctxMarkupFn() {
    ctxMarkup({ openMarkupMenu });
  }
  function ctxPropertiesFn() {
    ctxProperties({
      closeContextMenu,
      setPropertiesOpen: (v) => (propertiesOpen = v),
      clearMediaProps: () => (mediaProps = null),
      clearFfmpegError: () => (ffmpegInstallError = ""),
      isStillOpen: () => propertiesOpen,
      ensureFfprobeAndLoad: async () => {
        await refreshFfprobeAvailability({
          setFfprobeChecked: (v) => (ffprobeChecked = v),
          setFfprobeAvailable: (v) => (ffprobeAvailable = v),
        });
        if (ffprobeAvailable) {
          await loadMediaProperties({
            filePath,
            setMediaProps: (v) => (mediaProps = v),
            setMediaPropsLoading: (v) => (mediaPropsLoading = v),
          });
        }
      },
    });
  }
  function ctxShareFn() {
    ctxShare({ closeContextMenu, setShareOpen: (v) => (shareOpen = v) });
  }
  function needsTransparencyDialog(): boolean {
    if (isVideo) return false;
    const ext = getFileExt(filePath);
    return (
      ["jpg", "jpeg"].includes(ext) && editing.snapshot.rotation % 90 !== 0
    );
  }

  async function performApply() {
    try {
      editing.isApplying = true;
      await editing.backupOriginal(filePath);

      const s = editing.snapshot;

      if (isVideo) {
        if (!videoEl || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
          throw new Error("Video not ready for export");
        }
        await invokeExportEditedMedia(
          filePath,
          filePath,
          s,
          videoEl.videoWidth,
          videoEl.videoHeight,
        );
      } else if (exportFormatOverride === "png") {
        const pngPath = filePath.replace(/\.\w+$/, ".png");
        await exportEditedImage(filePath, s, pngPath);
        await loadFile(pngPath);
      } else {
        await exportEditedImage(filePath, s, filePath);
      }

      editing.isApplying = false;
      editing.isApplied = true;
      exportFormatOverride = null;
      toast.showFrameCopyToast("Edits applied", "success");
    } catch (err) {
      editing.isApplying = false;
      exportFormatOverride = null;
      const message =
        err instanceof Error ? err.message : "Failed to apply edits";
      toast.showFrameCopyToast(message, "error");
    }
  }

  async function performExport() {
    try {
      const ext = getFileExt(filePath);
      const overrideExt = exportFormatOverride === "png" ? "png" : ext;
      const defaultName =
        fileName.replace(/\.[^.]+$/, "") + "_edited." + overrideExt;

      const { save } = await import("@tauri-apps/plugin-dialog");
      const outputPath = await save({
        defaultPath: defaultName,
        filters: isVideo
          ? [{ name: "Video", extensions: [ext] }]
          : [{ name: "Image", extensions: [overrideExt] }],
      });

      if (!outputPath) return;

      exportFormatOverride = null;

      editing.isExporting = true;
      exportToast = {
        visible: true,
        phase: "exporting",
        message: "Exporting...",
        outputPath,
      };

      const s = editing.snapshot;
      if (isVideo) {
        if (!videoEl || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
          throw new Error("Video not ready for export");
        }
        await invokeExportEditedMedia(
          filePath,
          outputPath,
          s,
          videoEl.videoWidth,
          videoEl.videoHeight,
        );
      } else {
        await exportEditedImage(filePath, s, outputPath);
      }

      editing.isExporting = false;
      exportToast = {
        visible: true,
        phase: "done",
        message: "Exported!",
        outputPath,
      };
    } catch (err) {
      editing.isExporting = false;
      const message =
        err instanceof Error ? err.message : "Failed to export file";
      exportToast = { visible: true, phase: "error", message, outputPath: "" };
    }
  }

  async function handleApplyEdits() {
    if (!editing.getHasEdits() && !editing.getCropBounds()) return;
    menuStore.editMenuVisible = false;
    editing.exitCropMode();

    if (needsTransparencyDialog()) {
      pendingEditAction = "apply";
      editTransparencyConfirm = true;
      return;
    }

    editApplyConfirm = true;
  }

  async function handleExportEdits() {
    if (!editing.getHasEdits() && !editing.getCropBounds()) {
      toast.showFrameCopyToast("No edits to export", "info");
      return;
    }

    if (needsTransparencyDialog()) {
      pendingEditAction = "export";
      editTransparencyConfirm = true;
      return;
    }

    await performExport();
  }

  async function handleTransparencyChoice(choice: "png" | "keep") {
    editTransparencyConfirm = false;
    const action = pendingEditAction;
    pendingEditAction = null;

    if (choice === "png") {
      exportFormatOverride = "png";
    } else {
      exportFormatOverride = null;
    }

    if (action === "apply") {
      editApplyConfirm = true;
    } else if (action === "export") {
      await performExport();
      exportFormatOverride = null;
    }
  }

  async function handleApplyConfirm() {
    editApplyConfirm = false;
    await performApply();
  }

  async function handleApplyExportInstead() {
    editApplyConfirm = false;
    exportFormatOverride = null;
    await performExport();
  }

  function closeEditApplyConfirm() {
    editApplyConfirm = false;
    exportFormatOverride = null;
  }

  function closeEditTransparencyConfirm() {
    editTransparencyConfirm = false;
    pendingEditAction = null;
    exportFormatOverride = null;
  }

  function handleUndo() {
    editing.undo();
  }

  async function handleReset() {
    await editing.reset();
    toast.showFrameCopyToast("Edits reset", "info");
  }

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
  const ctxDelete = () => deleteActions.ctxDelete(closeContextMenu);

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
  function handleGlobalMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (
      contextMenuStore.isOpen &&
      !target.closest(".context-menu") &&
      !document.querySelector(".context-menu.pinned")
    )
      closeContextMenu();
    if (
      menuStore.editMenuVisible &&
      e.button === 2 &&
      !target.closest(".edit-menu") &&
      !target.closest(".edit-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      closeEditMenu();
    if (
      menuStore.markupMenuVisible &&
      e.button === 2 &&
      !target.closest(".markup-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      closeMarkupMenu();
    if (
      menuStore.slideshowMenuVisible &&
      e.button === 2 &&
      !target.closest(".slideshow-menu") &&
      !target.closest(".slideshow-btn") &&
      !document.querySelector(".slideshow-menu.pinned")
    )
      closeSlideshowMenu();
    if (
      markerStore.tsEditMenu.visible &&
      !target.closest(".ts-edit-menu") &&
      !target.closest(".ts-marker") &&
      !target.closest(".clip-marker") &&
      !target.closest(".fs-clip-marker")
    )
      closeTimestampEditor();
    if (
      menuStore.appDropdownVisible &&
      !target.closest(".app-dropdown-menu") &&
      !target.closest(".app-dropdown-toggle")
    )
      menuStore.appDropdownVisible = false;
  }

  // ── Lifecycle ──────────────────────────────────────────
  setupInit({
    volume: { get: () => volume, set: (v) => (volume = v) },
    loopMode: {
      get: () => loopMode,
      set: (v) => (loopMode = v),
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
      get: () => clipboardToast,
      set: (v) => (clipboardToast = v),
    },
    playbackUI,
    loadFile,
    handleKeydown,
    handleGlobalMouseDown,
  });
</script>

<Shell
  {fileName}
  {fileSrc}
  {filePath}
  {fileList}
  {currentIndex}
  {isVideo}
  {isAudio}
  {isPdf}
  {fileDimensions}
  {fileSize}
  {fileInfoLoading}
  {isLoadingFile}
  {loadingFadingOut}
  {anyMenuOpen}
  viewerStateIsFullscreen={viewer.state.isFullscreen}
  viewerFsControlsVisible={viewer.state.fsControlsVisible}
  viewerResetFsTimer={viewer.resetFsTimer}
  viewerToggleFullscreen={toggleFullscreen}
  {thumbnailBarVisible}
  zoomLevel={viewer.state.zoomLevel}
  zoomLocked={viewer.state.zoomLocked}
  {resetZoom}
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
  {toggleSlideshowMenu}
  slideshowMenuVisible={menuStore.slideshowMenuVisible}
  {closeSlideshowMenu}
  {toggleThumbnailBar}
  sortMode={sort.mode}
  sortDesc={sort.desc}
  sortMenuVisible={sort.menuVisible}
  toggleSortMenu={sort.toggle}
  closeSortMenu={sort.close}
  {onSortChange}
  {navigate}
  {startDrag}
  {showFilenameTooltip}
  {hideFilenameTooltip}
  {closeFile}
  {openFileDialog}
  {minimizeWindow}
  {maximizeWindow}
  {closeWindow}
  appDropdownVisible={menuStore.appDropdownVisible}
  toggleAppDropdown={() => (menuStore.appDropdownVisible = !menuStore.appDropdownVisible)}
  closeAppDropdown={() => (menuStore.appDropdownVisible = false)}
  openSettings={() => (menuStore.settingsOpen = true)}
  openAccessibility={() => (menuStore.accessibilityOpen = true)}
  openHelp={() => (menuStore.helpOpen = true)}
  openAbout={() => (menuStore.aboutOpen = true)}
  openFeedback={() => (menuStore.feedbackOpen = true)}
  settingsOpen={menuStore.settingsOpen}
  closeSettings={() => (menuStore.settingsOpen = false)}
  accessibilityOpen={menuStore.accessibilityOpen}
  closeAccessibility={() => (menuStore.accessibilityOpen = false)}
  helpOpen={menuStore.helpOpen}
  closeHelp={() => (menuStore.helpOpen = false)}
  aboutOpen={menuStore.aboutOpen}
  closeAbout={() => (menuStore.aboutOpen = false)}
  feedbackOpen={menuStore.feedbackOpen}
  closeFeedback={() => (menuStore.feedbackOpen = false)}
  contextMenu={contextMenuStore.contextMenu}
  onOpenContextMenu={openContextMenu}
  editMenuVisible={menuStore.editMenuVisible}
  onApply={handleApplyEdits}
  onExport={handleExportEdits}
  onUndo={handleUndo}
  onReset={handleReset}
  onMarkupApply={handleMarkupApply}
  onMarkupExport={handleMarkupExport}
  {closeEditMenu}
  markupMenuVisible={menuStore.markupMenuVisible}
  {closeMarkupMenu}
  {ffprobeChecked}
  {ffprobeAvailable}
  {ffmpegInstalling}
  {ffmpegInstallError}
  installFfmpegAndWait={() =>
    installFfmpegAndWait({
      setFfmpegInstallError: (v) => (ffmpegInstallError = v),
      setFfmpegInstalling: (v) => (ffmpegInstalling = v),
      setFfprobeAvailable: (v) => (ffprobeAvailable = v),
      setFfprobeChecked: (v) => (ffprobeChecked = v),
      loadMediaProperties: () =>
        loadMediaProperties({
          filePath,
          setMediaProps: (v) => (mediaProps = v),
          setMediaPropsLoading: (v) => (mediaPropsLoading = v),
        }),
    })}
  refreshFfprobeAvailability={() =>
    refreshFfprobeAvailability({
      setFfprobeChecked: (v) => (ffprobeChecked = v),
      setFfprobeAvailable: (v) => (ffprobeAvailable = v),
    })}
  {openConvertedFile}
  showInExplorer={ctxShowInExplorerFn}
  {showValue}
  loadMediaProperties={() =>
    loadMediaProperties({
      filePath,
      setMediaProps: (v) => (mediaProps = v),
      setMediaPropsLoading: (v) => (mediaPropsLoading = v),
    })}
  onRenamed={async (newPath: string) => {
    clearFolderCache(getParentFolder(newPath));
    await loadFile(newPath);
  }}
  onSelect={navigateToIndex}
  onOpenExportedFile={async () => {
    if (exportToast.outputPath) loadFile(exportToast.outputPath);
    exportToast = { ...exportToast, visible: false };
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
  onUpdateDeletePermanently={(v: boolean) => (deleteStore.deletePermanently = v)}
  onCloseContextMenu={closeContextMenu}
  tsTooltip={markerStore.tsTooltip}
  tsEditMenuVisible={markerStore.tsEditMenu.visible}
  tsEditMenu={markerStore.tsEditMenu}
  editingTimestamp={getActiveEditorTimestamp()}
  editingSegment={getActiveEditorSegment()}
  currentTitle={getEditorTitle()}
  {getTitleEditorWidthCh}
  {updateEditorTitle}
  {closeTimestampEditor}
  {onEditorScissor}
  {onEditorDeleteTimestamp}
  {onEditorDeleteSegment}
  volumeTooltipVisible={playbackUI.volumeTooltipVisible}
  volumeTooltipX={playbackUI.volumeTooltipX}
  volumeTooltipY={playbackUI.volumeTooltipY}
  speedTooltipVisible={playbackUI.speedTooltipVisible}
  speedTooltipX={playbackUI.speedTooltipX}
  speedTooltipY={playbackUI.speedTooltipY}
  playbackSpeed={playbackUI.playbackSpeed}
  {muted}
  {volume}
  timestamps={markerStore.timestamps}
  clipBoundaries={clips.clipBoundaries}
  resumePoint={markerStore.resumePoint}
  {frameCopyToast}
  {imageCopyToast}
  clipToast={clips.clipToast}
  {exportToast}
  {clipboardToast}
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
  {ctxDelete}
  ctxClearMarkers={ctxClearMarkersFn}
  clipDeleteConfirm={clips.clipDeleteConfirm}
  deleteConfirm={deleteStore.deleteConfirm}
  deleteNoAsk={deleteStore.deleteNoAsk}
  deletePermanently={deleteStore.deletePermanently}
  {propertiesOpen}
  {shareOpen}
  fileExt={() => getFileExt(filePath)}
  {fileCreated}
  {fileModified}
  {durationDisplay}
  {audioBitrateDisplay}
  {mediaPropsLoading}
  {mediaProps}
  {propsCopyPath}
  {propsOpenFolder}
  {propsCopyAll}
  {copyPropValue}
  {performDelete}
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
    <div class="content">
      <div
        class="sidebar left"
        onmouseenter={() => (hoverZone = "sidebar")}
        onmouseleave={() => (hoverZone = "none")}
        role="presentation"
      >
        <button
          class="nav-btn"
          onclick={() => navigate(-1)}
          aria-label="previous file">‹</button
        >
      </div>
      <div
        class="viewer"
        bind:this={viewerEl}
        onmouseenter={() => (hoverZone = "sidebar")}
        onmouseleave={() => (hoverZone = "none")}
        onwheel={handleViewerScroll}
        onmousedown={!isVideo && !isPdf && !markup.drawActive
          ? startPan
          : undefined}
        ontouchstart={(e) => {
          if (e.touches.length === 2) e.preventDefault();
        }}
        ontouchmove={viewer.handleTouchZoom}
        ontouchend={viewer.handleTouchEnd}
        style="cursor: {markup.drawActive
          ? 'crosshair'
          : !isVideo && !isPdf
            ? panCursor
            : 'default'}"
        role="presentation"
      >
        {#if fileSrc && !isVideo && !isAudio && !isPdf}
          <div
            class="media-container"
            bind:this={cropContainerEl}
            style="position: relative; display: flex; align-items: center; justify-content: center; max-width: 100%; max-height: 100%;"
          >
            {#key slideshow.active && slideshow.transition !== "none" ? currentIndex : null}
              <div
                class={slideshow.active && slideshow.transition !== "none"
                  ? `transition-${slideshow.transition}`
                  : ""}
              >
                <img
                  bind:this={imageEl}
                  src={fileSrc}
                  alt={fileName}
                  decoding="async"
                  onload={onImageLoad}
                  onerror={corruption.onImageError}
                  style={imageStyle}
                />
              </div>
            {/key}
            <CropOverlay containerEl={cropContainerEl} mediaEl={imageEl} />
            <DrawOverlay containerEl={cropContainerEl} mediaEl={imageEl} />
          </div>
        {:else if fileSrc && isVideo}
          <div
            class="video-wrapper"
            bind:this={cropContainerEl}
            role="presentation"
            onmouseenter={() => (hoverZone = "video")}
            onmouseleave={() => (hoverZone = "none")}
            onmousedown={markup.drawActive ? undefined : startPan}
            style="{videoWrapperTransform} cursor: {markup.drawActive
              ? 'crosshair'
              : panCursor}"
          >
            <div
              class="video-inner"
              bind:this={videoInnerEl}
              style={videoInnerStyle}
            >
              {#key slideshow.active && slideshow.transition !== "none" ? currentIndex : null}
                <div
                  class={slideshow.active && slideshow.transition !== "none"
                    ? `transition-${slideshow.transition}`
                    : ""}
                >
                  <video
                    bind:this={videoEl}
                    src={fileSrc}
                    crossorigin="anonymous"
                    preload="metadata"
                    autoplay
                    onloadedmetadata={onVideoLoad}
                    onerror={() => corruption.onVideoError(videoEl)}
                    onended={onMediaEnded}
                  >
                    <track kind="captions" srclang="en" label="English" />
                  </video>
                </div>
              {/key}
            </div>
            <CropOverlay containerEl={cropContainerEl} mediaEl={videoInnerEl} />
            <DrawOverlay containerEl={cropContainerEl} mediaEl={videoInnerEl} />
            <div
              class="video-controls"
              class:gif-only={isGifVideo}
              class:editor-open={markerStore.tsEditMenu.visible}
            >
              <TimelineMarkers
                fullscreen={false}
                {progress}
                currentTimeSecs={rawCurrentSecs}
                {isGifVideo}
                clipPairs={clips.clipPairs}
                clipBoundaries={clips.clipBoundaries}
                timestamps={markerStore.timestamps}
                abLoopRegion={markerStore.abLoopRegion}
                loopStart={markerStore.loopStart}
                loopEnd={markerStore.loopEnd}
                resumePoint={markerStore.resumePoint}
                durationSecs={rawDurationSecs}
                clipMarkerJustDragged={clips.clipMarkerJustDragged}
                tsEditMenuVisible={markerStore.tsEditMenu.visible}
                {startScrubbing}
                {getTimestampPct}
                {startClipMarkerDrag}
                {removeClipBoundary}
                {showClipBoundaryTooltip}
                {hideTsTooltip}
                {seekToTimestamp}
                {openSegmentEditor}
                {startTimestampDrag}
                timestampDragJustEnded={markerStore.timestampDragJustEnded}
                {removeTimestamp}
                {showTimestampTooltip}
                {openTimestampEditor}
                {showResumeTooltip}
                {hideResumeTooltip}
                {seekToResumePoint}
                {removeResumePoint}
                {clearABLoop}
                {formatTime}
                {startLoopMarkerDrag}
                loopMarkerJustDragged={markerStore.loopMarkerJustDragged}
                {showLoopMarkerTooltip}
              />
              <PlaybackControls
                fullscreen={false}
                {isGifVideo}
                {playing}
                looping={loopMode}
                {muted}
                {volume}
                volumeHovered={playbackUI.volumeHovered}
                volumeSegments={VOLUME_SEGMENTS}
                {togglePlay}
                {setLoopMode}
                {toggleMute}
                showVolumeOverlay={playbackUI.showVolumeOverlay}
                handleVolumeAreaLeave={playbackUI.handleVolumeAreaLeave}
                handleVolumeScroll={playbackUI.handleVolumeScroll}
                startVolumeDrag={playbackUI.startVolumeDrag}
                handleVolumeDiamondHover={playbackUI.handleVolumeDiamondHover}
                {setVolume}
                playbackSpeed={playbackUI.playbackSpeed}
                speedHovered={playbackUI.speedHovered}
                setPlaybackSpeed={playbackUI.setPlaybackSpeed}
                showSpeedOverlay={playbackUI.showSpeedOverlay}
                handleSpeedAreaLeave={playbackUI.handleSpeedAreaLeave}
                handleSpeedScroll={playbackUI.handleSpeedScroll}
                handleSpeedDiamondHover={playbackUI.handleSpeedDiamondHover}
                startSpeedDrag={playbackUI.startSpeedDrag}
                {addTimestamp}
                addClipStart={() => clips.addClipBoundaryFromMedia("start")}
                addClipEnd={() => clips.addClipBoundaryFromMedia("end")}
                {addLoopStart}
                {addLoopEnd}
                hasLoopStart={markerStore.loopStart !== null}
                hasLoopEnd={markerStore.loopEnd !== null}
                hasAnyMarkers={markerStore.timestamps.length > 0 ||
                  clips.clipBoundaries.length > 0 ||
                  markerStore.resumePoint !== null ||
                  markerStore.loopStart !== null ||
                  markerStore.loopEnd !== null}
                deleteAllMarkers={() => {
                  clearAllTimestamps();
                  clips.clearBoundaries();
                  removeResumePoint();
                  clearLoopMarkers();
                }}
                {toggleTimer}
                {currentTimeDisplay}
                {durationDisplay}
                {timerTooltip}
                {toggleFullscreen}
                onTsMenuChange={(v) => (menuStore.tsMenuOpen = v)}
                volumeSliderMode={playbackUI.volumeSliderMode ||
                  volumeSliderMode}
                speedSliderMode={playbackUI.speedSliderMode || speedSliderMode}
                volumeSliderValue={playbackUI.volumeSliderValue}
                speedSliderValue={playbackUI.speedSliderValue}
                {toggleVolumeSliderMode}
                {toggleSpeedSliderMode}
                startVolumeSliderDrag={playbackUI.startVolumeSliderDrag}
                startSpeedSliderDrag={playbackUI.startSpeedSliderDrag}
                handleVolumeSliderChange={playbackUI.handleVolumeSliderChange}
                handleSpeedSliderChange={playbackUI.handleSpeedSliderChange}
                showVolumeSliderTooltip={playbackUI.showVolumeSliderTooltip}
                hideVolumeSliderTooltip={playbackUI.hideVolumeSliderTooltip}
                showSpeedSliderTooltip={playbackUI.showSpeedSliderTooltip}
                hideSpeedSliderTooltip={playbackUI.hideSpeedSliderTooltip}
                volumeDragging={playbackUI.volumeDragging}
                speedDragging={playbackUI.speedDragging}
              />
            </div>
          </div>
        {:else if fileSrc && isAudio}
          <AudioPlayer
            {fileSrc}
            {filePath}
            {fileName}
            bind:cdColor
            bind:cdColorIndex
            bind:showCdColorPicker
            {coverArtSrc}
            bind:audioEl
            {onAudioLoad}
            onAudioError={() => corruption.onAudioError(audioEl)}
            onAudioEnded={onMediaEnded}
            bind:playing
            {loopMode}
            {setLoopMode}
            {muted}
            {volume}
            {setVolume}
            {toggleMute}
            {togglePlay}
            {handlePrevClick}
            {handleNextClick}
            {toggleTimer}
            {currentTimeDisplay}
            {durationDisplay}
            {timerTooltip}
            {progress}
            {rawCurrentSecs}
            {rawDurationSecs}
            {isScrubbing}
            {startDiscScrubbing}
            {discScrubHandlers}
            {startScrubbing}
            {clips}
            timestamps={markerStore.timestamps}
            loopStart={markerStore.loopStart}
            loopEnd={markerStore.loopEnd}
            resumePoint={markerStore.resumePoint}
            tsEditMenuVisible={markerStore.tsEditMenu.visible}
            tsMenuOpen={menuStore.tsMenuOpen}
            loopMenuOpen={menuStore.loopMenuOpen}
            onTsMenuChange={(v) => (menuStore.tsMenuOpen = v)}
            onLoopMenuChange={(v) => (menuStore.loopMenuOpen = v)}
            {addTimestamp}
            {addLoopStart}
            {addLoopEnd}
            addClipBoundary={clips.addClipBoundaryFromMedia}
            {clearAllTimestamps}
            clearAllSegments={clips.clearBoundaries}
            {removeResumePoint}
            {clearLoopMarkers}
            {fileList}
            bind:currentIndex
            {setMediaState}
            {navigate}
            slideshowActive={slideshow.active}
            volumeSegments={VOLUME_SEGMENTS}
            {playbackUI}
            {pickAudioFile}
            bind:volumeTrackEl
            bind:speedTrackEl
            {toggleVolumeSliderMode}
            {toggleSpeedSliderMode}
            bind:audioLayoutMode
            bind:cassetteFilenameOverflow
            bind:cassetteInfoRowEl
          />
        {:else if fileSrc && isPdf}
          <div
            class="pdf-viewer"
            bind:this={pdfContainerEl}
            role="region"
            aria-label="PDF viewer"
          >
            {#if pdf.state.loading}
              <div class="pdf-loading">
                <div class="pdf-spinner"></div>
                <span>Loading PDF...</span>
              </div>
            {:else if pdf.state.error}
              <div class="pdf-error">{pdf.state.error}</div>
            {:else}
              {#each pdf.state.pages as page, i}
                <div class="pdf-page-wrapper">
                  <canvas bind:this={page.canvasRef} class="pdf-canvas"
                  ></canvas>
                </div>
                {#if i < pdf.state.pages.length - 1}
                  <div class="pdf-page-separator"></div>
                {/if}
              {/each}
            {/if}
          </div>
          <div class="pdf-zoom-controls">
            <button
              class="pdf-zoom-btn"
              onclick={() => pdf.setScale(pdf.state.scale - 0.25)}
              disabled={pdf.state.scale <= 0.25}
              aria-label="Zoom out">−</button
            >
            <span class="pdf-zoom-label"
              >{Math.round(pdf.state.scale * 100)}%</span
            >
            <button
              class="pdf-zoom-btn"
              onclick={() => pdf.setScale(pdf.state.scale + 0.25)}
              disabled={pdf.state.scale >= 5}
              aria-label="Zoom in">+</button
            >
            <button
              class="pdf-zoom-btn pdf-zoom-reset"
              onclick={() => pdf.setScale(1)}
              aria-label="Reset zoom">Reset</button
            >
          </div>
        {:else}
          <button class="empty" onclick={openFileDialog}
            ><span class="empty-icon">+</span><span class="empty-text"
              >open a file</span
            ></button
          >
        {/if}
      </div>
      <div
        class="sidebar right"
        onmouseenter={() => (hoverZone = "sidebar")}
        onmouseleave={() => (hoverZone = "none")}
        role="presentation"
      >
        <button
          class="nav-btn"
          onclick={() => navigate(1)}
          aria-label="next file">›</button
        >
      </div>
    </div>

    {#if viewer.state.isFullscreen && fileSrc}
      <div
        class="fs-overlay"
        class:visible={viewer.state.fsControlsVisible || markerStore.tsEditMenu.visible}
        class:audio-fullscreen={isAudio}
        role="button"
        tabindex="0"
        onwheel={handleViewerScroll}
        onmousedown={markup.drawActive ? undefined : startPan}
        ontouchstart={(e) => {
          if (e.touches.length === 2) e.preventDefault();
        }}
        ontouchmove={viewer.handleTouchZoom}
        ontouchend={viewer.handleTouchEnd}
        style="cursor: {fsCursor}"
      >
        <div class="fs-topbar">
          <span class="fs-filename"
            ><Marquee text={fileName} scrollOnHover class="fs-marquee" /></span
          >
          <div class="fs-window-controls">
            <button
              class="fs-wc-btn"
              onclick={minimizeWindow}
              aria-label="minimize">−</button
            ><button
              class="fs-wc-btn"
              onclick={maximizeWindow}
              aria-label="maximize">▢</button
            ><button
              class="fs-wc-btn close"
              onclick={closeWindow}
              aria-label="close">✕</button
            >
          </div>
        </div>
        <div class="fs-nav-left">
          <button
            class="fs-nav-btn"
            onclick={() => navigate(-1)}
            aria-label="previous file">‹</button
          >
        </div>
        <div class="fs-nav-right">
          <button
            class="fs-nav-btn"
            onclick={() => navigate(1)}
            aria-label="next file">›</button
          >
        </div>
        {#if isVideo && videoEl}
          <div class="fs-controls" class:gif-only={isGifVideo}>
            <TimelineMarkers
              fullscreen={true}
              {progress}
              currentTimeSecs={rawCurrentSecs}
              {isGifVideo}
              clipPairs={clips.clipPairs}
              clipBoundaries={clips.clipBoundaries}
              timestamps={markerStore.timestamps}
              abLoopRegion={markerStore.abLoopRegion}
              loopStart={markerStore.loopStart}
              loopEnd={markerStore.loopEnd}
              resumePoint={markerStore.resumePoint}
              durationSecs={rawDurationSecs}
              clipMarkerJustDragged={clips.clipMarkerJustDragged}
              tsEditMenuVisible={markerStore.tsEditMenu.visible}
              {startScrubbing}
              {getTimestampPct}
              {startClipMarkerDrag}
              {removeClipBoundary}
              {showClipBoundaryTooltip}
              {hideTsTooltip}
              {seekToTimestamp}
              {openSegmentEditor}
              {startTimestampDrag}
              timestampDragJustEnded={markerStore.timestampDragJustEnded}
              {removeTimestamp}
              {showTimestampTooltip}
              {openTimestampEditor}
              {showResumeTooltip}
              {hideResumeTooltip}
              {seekToResumePoint}
              {removeResumePoint}
              {clearABLoop}
              {formatTime}
              {startLoopMarkerDrag}
              loopMarkerJustDragged={markerStore.loopMarkerJustDragged}
              {showLoopMarkerTooltip}
            />
            <PlaybackControls
              fullscreen={true}
              {isGifVideo}
              {playing}
              looping={loopMode}
              {muted}
              {volume}
              volumeHovered={playbackUI.volumeHovered}
              volumeSegments={VOLUME_SEGMENTS}
              {togglePlay}
              {setLoopMode}
              {toggleMute}
              showVolumeOverlay={playbackUI.showVolumeOverlay}
              handleVolumeAreaLeave={playbackUI.handleVolumeAreaLeave}
              handleVolumeScroll={playbackUI.handleVolumeScroll}
              startVolumeDrag={playbackUI.startVolumeDrag}
              handleVolumeDiamondHover={playbackUI.handleVolumeDiamondHover}
              {setVolume}
              playbackSpeed={playbackUI.playbackSpeed}
              speedHovered={playbackUI.speedHovered}
              setPlaybackSpeed={playbackUI.setPlaybackSpeed}
              showSpeedOverlay={playbackUI.showSpeedOverlay}
              handleSpeedAreaLeave={playbackUI.handleSpeedAreaLeave}
              handleSpeedScroll={playbackUI.handleSpeedScroll}
              handleSpeedDiamondHover={playbackUI.handleSpeedDiamondHover}
              startSpeedDrag={playbackUI.startSpeedDrag}
              {addTimestamp}
              addClipStart={() => clips.addClipBoundaryFromMedia("start")}
              addClipEnd={() => clips.addClipBoundaryFromMedia("end")}
              {addLoopStart}
              {addLoopEnd}
              hasLoopStart={markerStore.loopStart !== null}
              hasLoopEnd={markerStore.loopEnd !== null}
              hasAnyMarkers={markerStore.timestamps.length > 0 ||
                clips.clipBoundaries.length > 0 ||
                markerStore.resumePoint !== null ||
                markerStore.loopStart !== null ||
                markerStore.loopEnd !== null}
              deleteAllMarkers={() => {
                clearAllTimestamps();
                clips.clearBoundaries();
                removeResumePoint();
                clearLoopMarkers();
              }}
              {toggleTimer}
              {currentTimeDisplay}
              {durationDisplay}
              {timerTooltip}
              {toggleFullscreen}
              onTsMenuChange={(v) => (menuStore.tsMenuOpen = v)}
              volumeSliderMode={playbackUI.volumeSliderMode || volumeSliderMode}
              speedSliderMode={playbackUI.speedSliderMode || speedSliderMode}
              volumeSliderValue={playbackUI.volumeSliderValue}
              speedSliderValue={playbackUI.speedSliderValue}
              {toggleVolumeSliderMode}
              {toggleSpeedSliderMode}
              startVolumeSliderDrag={playbackUI.startVolumeSliderDrag}
              startSpeedSliderDrag={playbackUI.startSpeedSliderDrag}
              handleVolumeSliderChange={playbackUI.handleVolumeSliderChange}
              handleSpeedSliderChange={playbackUI.handleSpeedSliderChange}
              showVolumeSliderTooltip={playbackUI.showVolumeSliderTooltip}
              hideVolumeSliderTooltip={playbackUI.hideVolumeSliderTooltip}
              showSpeedSliderTooltip={playbackUI.showSpeedSliderTooltip}
              hideSpeedSliderTooltip={playbackUI.hideSpeedSliderTooltip}
              volumeDragging={playbackUI.volumeDragging}
              speedDragging={playbackUI.speedDragging}
            />
          </div>
        {:else}
          <div class="fs-controls image-only">
            <div class="fs-controls-row">
              <div class="fs-right">
                <button
                  class="fs-ctrl-btn tooltip-ctrl"
                  data-tooltip="Unfullscreen"
                  onclick={viewer.toggleFullscreen}
                  aria-label="exit fullscreen"
                  ><svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                    ><path
                      d="M4 1v3h-3M8 1v3h3M8 11v-3h3M4 11v-3h-3"
                      stroke="currentColor"
                      stroke-width="1.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    /></svg
                  ></button
                >
              </div>
            </div>
          </div>
        {/if}
        {#if fileList.length > 0}<button
            bind:this={fsPillEl}
            class="fs-file-count-pill tooltip-above"
            class:slideshow-active={slideshow.active}
            data-tooltip="File position"
            onclick={toggleThumbnailBar}
            oncontextmenu={handleFsPillContext}
            >{currentIndex + 1} / {fileList.length}</button
          >{/if}
        {#if sort.menuVisible}
          <SortMenu
            visible={sort.menuVisible}
            onClose={sort.close}
            x={sort.menuX}
            y={sort.menuY}
            sortMode={sort.mode}
            sortDesc={sort.desc}
            {onSortChange}
          />
        {/if}
      </div>
    {/if}
  {/snippet}
</Shell>

<TransparencyConfirmDialog
  open={editTransparencyConfirm}
  {fileName}
  fileExtUpper={getFileExt(filePath).toUpperCase()}
  onClose={closeEditTransparencyConfirm}
  onChoice={handleTransparencyChoice}
/>

<ApplyEditDialog
  open={editApplyConfirm}
  {fileName}
  onClose={closeEditApplyConfirm}
  onConfirm={handleApplyConfirm}
  onExportInstead={handleApplyExportInstead}
/>


