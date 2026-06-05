<!-- Layout shell: wires feature modules into the template. State and handlers live in src/lib/features/*/. -->
<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { open } from "@tauri-apps/plugin-dialog";
  import { invoke, convertFileSrc } from "@tauri-apps/api/core";
  import { watchImmediate } from "@tauri-apps/plugin-fs";
  import {
    createPlaybackActions,
    createPlaybackUI,
    formatTime,
  } from "$lib/features/media/playback.svelte";
  import { createTimeline } from "$lib/features/timeline/timeline";
  import { createClips } from "$lib/features/media/clips.svelte";
  import { createKeybindHandler } from "$lib/shared/keybinds";
  import {
    VOLUME_SEGMENTS,
    LOOP_MODES,
    ALL_EXTS,
    AUDIO_EXTS,
    CD_COLORS,
    type LoopMode,
    type SortMode,
  } from "$lib/shared/constants";
  import type {
    ContextMenu,
    VideoMarker,
    ClipBoundary,
    MediaProperties,
  } from "$lib/shared/types";
  import {
    saveVolume,
    loadSkipDeleteConfirmation,
    saveSkipDeleteConfirmation,
    writeTimestamps,
    deleteTimestamps,
    deleteResumePoint,
    saveLoopMode,
    saveSliderMode,
    saveClipPreferences,
    loadCdColor,
    saveCdColor,
    loadSortMode,
    saveSortMode,
    loadSortDesc,
    saveSortDesc,
    loadAudioLayoutMode,
    saveAudioLayoutMode,
  } from "$lib/services/storage";
  import {
    invokeDeleteFile,
    invokeTrashFile,
    invokeOpenDirectory,
    invokeCleanupTempFolder,
    exportEditedImage,
    invokeExportEditedMedia,
    renderMarkupOnImage,
    invokeCheckMediaIntegrity,
    invokeFixMedia,
    invokeProcessVideoClips,
    invokeExtractCoverArt,
  } from "$lib/features/media/tools";
  import { computeContextMenuPosition } from "$lib/services/session";
  import { showValue } from "$lib/services/clipboard";
  import {
    getParentFolder,
    getFileExt,
    clearFolderCache,
    rescanFolder,
  } from "$lib/services/files";
  import { createMedia } from "$lib/features/media/media.svelte";
  import { viewer } from "$lib/features/viewer/viewer.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import { markup } from "$lib/features/markup/markup.svelte";
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
  } from "$lib/features/dialogs/contextActions";
  import { createPropertiesActions } from "$lib/features/dialogs/propertiesActions";
  import {
    loadMediaProperties,
    refreshFfprobeAvailability,
    installFfmpegAndWait,
  } from "$lib/features/media/ffmpeg";
  import { setupInit } from "./init";
  import { createPdf } from "$lib/features/pdf/pdf.svelte";
  import AudioPlayer from "$lib/features/media/AudioPlayer.svelte";
  import Marquee from "$lib/shared/Marquee.svelte";

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
  let contextMenu = $state<ContextMenu>({ x: 0, y: 0, visible: false });
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(false);
  let editApplyConfirm = $state(false);
  let editTransparencyConfirm = $state(false);
  let pendingEditAction = $state<"apply" | "export" | null>(null);
  let exportFormatOverride = $state<"png" | null>(null);
  let propertiesOpen = $state(false);
  let shareOpen = $state(false);
  let editMenuVisible = $state(false);
  let markupMenuVisible = $state(false);
  let slideshowMenuVisible = $state(false);
  let appDropdownVisible = $state(false);
  let settingsOpen = $state(false);
  let accessibilityOpen = $state(false);
  let helpOpen = $state(false);
  let aboutOpen = $state(false);
  let feedbackOpen = $state(false);
  let tsMenuOpen = $state(false);
  let loopMenuOpen = $state(false);
  let audioLayoutMode: "retro" | "modern" = $state(loadAudioLayoutMode());
  let cassetteFilenameOverflow = $state(false);
  let cassetteInfoRowEl = $state<HTMLElement | null>(null);
  let lastPrevClickTime = $state(0);
  const PREV_DOUBLE_CLICK_MS = 1200;
  let tsDeleteConfirm = $state(false);
  let volumeTrackEl: HTMLDivElement | null = $state(null);
  let speedTrackEl: HTMLDivElement | null = $state(null);
  let thumbnailBarVisible = $state(false);
  let sortMode: SortMode = $state(loadSortMode());
  let sortDesc = $state(loadSortDesc());
  let sortMenuVisible = $state(false);
  let fsPillEl: HTMLButtonElement | null = $state(null);
  let fsSortMenuX = $state(0);
  let fsSortMenuY = $state(0);
  let volumeSliderMode = $state(false);
  let speedSliderMode = $state(false);
  let resumePoint = $state<number | null>(null);
  let resumeTooltipVisible = $state(false);
  let timestamps = $state<VideoMarker[]>([]);
  let clipOutputDir = $state("");
  let clipDeleteOriginal = $state(false);
  let clipUseCustomPath = $state(false);
  let clipMergeSegments = $state(false);
  let clipJobRunning = $state(false);
  let clipJobLabel = $state("");
  let clipMenuResetKey = $state(0);
  let clipDeleteConfirm = $state<{
    visible: boolean;
    mode: "separate" | "merge" | null;
  }>({ visible: false, mode: null });
  let clipToast = $state<{
    visible: boolean;
    tone: "success" | "error";
    message: string;
    outputDir: string;
  }>({ visible: false, tone: "success", message: "", outputDir: "" });
  let clipToastTimer: ReturnType<typeof setTimeout> | undefined;
  let mediaProps = $state<MediaProperties | null>(null);
  let mediaPropsLoading = $state(false);
  let ffprobeAvailable = $state(true);
  let ffprobeChecked = $state(false);
  let ffmpegInstalling = $state(false);
  let ffmpegInstallError = $state("");
  let tsTooltip = $state<{
    visible: boolean;
    x: number;
    y: number;
    title?: string;
    timeLabel: string;
    tone?: "yellow" | "blue" | "green" | "red" | "grey";
    targetId?: string;
  }>({ visible: false, x: 0, y: 0, title: "", timeLabel: "", tone: "yellow" });
  let tsEditMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    targetId: string;
    targetType: "timestamp" | "segment";
  }>({ visible: false, x: 0, y: 0, targetId: "", targetType: "timestamp" });
  let loopStart = $state<number | null>(null);
  let loopEnd = $state<number | null>(null);
  const abLoopRegion = $derived(
    loopStart !== null && loopEnd !== null
      ? { start: loopStart, end: loopEnd }
      : null,
  );
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
  let corruptionWarning = $state(false);
  let corruptionReason = $state("");
  let corruptionFixing = $state(false);
  let corruptionFixError = $state("");

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
      : !viewer.state.fsControlsVisible && !tsEditMenu.visible
        ? "none"
        : panCursor,
  );
  const isGifVideo = $derived(isVideo && getFileExt(filePath) === "gif");
  const anyMenuOpen = $derived(
    contextMenu.visible ||
      appDropdownVisible ||
      slideshowMenuVisible ||
      editMenuVisible ||
      markupMenuVisible ||
      settingsOpen ||
      accessibilityOpen ||
      helpOpen ||
      aboutOpen ||
      feedbackOpen ||
      tsEditMenu.visible ||
      deleteConfirm ||
      propertiesOpen ||
      shareOpen ||
      clipDeleteConfirm.visible ||
      tsMenuOpen ||
      editApplyConfirm ||
      editTransparencyConfirm ||
      corruptionWarning ||
      sortMenuVisible,
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
        if (abLoopRegion && el.currentTime >= abLoopRegion.end) {
          el.currentTime = abLoopRegion.start;
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

  const timeline = createTimeline();
  function saveTimestamps() {
    writeTimestamps(filePath, timestamps);
  }
  function addTimestamp() {
    timeline.addTimestamp(rawCurrentSecs, timestamps, (v) => (timestamps = v));
    saveTimestamps();
  }
  function removeTimestamp(id: string) {
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
    if (abLoopRegion) {
      const ts = timeline.getTimestampById(id, timestamps);
      if (
        ts &&
        (Math.abs(ts.time - abLoopRegion.start) < 0.01 ||
          Math.abs(ts.time - abLoopRegion.end) < 0.01)
      ) {
        clearABLoop();
      }
    }
    timeline.removeTimestamp(id, timestamps, (v) => (timestamps = v));
    saveTimestamps();
  }
  function clearAllTimestamps() {
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
    clearABLoop();
    timeline.clearTimestamps((v) => (timestamps = v));
    deleteTimestamps(filePath);
  }
  function updateTimestampTitle(id: string, title: string) {
    timeline.updateTimestampTitle(
      id,
      title,
      timestamps,
      (v) => (timestamps = v),
    );
    saveTimestamps();
    if (tsTooltip.visible && tsTooltip.targetId === id) {
      tsTooltip = { ...tsTooltip, title: title.trim() };
    }
  }
  function getTimestampById(id: string): VideoMarker | undefined {
    return timeline.getTimestampById(id, timestamps);
  }
  function getTitleEditorWidthCh(title: string): number {
    return Math.min(26, Math.max(10, (title || "").trim().length + 2));
  }
  function showTimestampTooltip(e: MouseEvent, ts: VideoMarker) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: ts.title,
      timeLabel: formatTime(ts.time),
      tone: "yellow",
      targetId: ts.id,
    };
  }
  function openTimestampEditor(e: MouseEvent, id: string) {
    e.stopPropagation();
    const ts = getTimestampById(id);
    if (!ts) return;
    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest(
      ".progress-bar, .fs-progress",
    ) as HTMLElement | null;
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const pct = rawDurationSecs > 0 ? ts.time / rawDurationSecs : 0;
    tsEditMenu = {
      visible: true,
      x: barRect.left + pct * barRect.width,
      y: barRect.top - 12,
      targetId: id,
      targetType: "timestamp",
    };
  }
  function openSegmentEditor(e: MouseEvent, id: string) {
    e.stopPropagation();
    const b = clips.getBoundaryById(id);
    if (!b) return;
    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest(
      ".progress-bar, .fs-progress",
    ) as HTMLElement | null;
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const pct = rawDurationSecs > 0 ? b.time / rawDurationSecs : 0;
    tsEditMenu = {
      visible: true,
      x: barRect.left + pct * barRect.width,
      y: barRect.top - 12,
      targetId: id,
      targetType: "segment",
    };
  }
  function closeTimestampEditor() {
    tsEditMenu = { ...tsEditMenu, visible: false };
    hideTsTooltip();
  }
  function getActiveEditorTimestamp(): VideoMarker | undefined {
    return tsEditMenu.targetType === "timestamp"
      ? getTimestampById(tsEditMenu.targetId)
      : undefined;
  }
  function getActiveEditorSegment(): ClipBoundary | undefined {
    return tsEditMenu.targetType === "segment"
      ? clips.getBoundaryById(tsEditMenu.targetId)
      : undefined;
  }
  function getEditorTitle(): string {
    const ts = getActiveEditorTimestamp();
    if (ts) return ts.title ?? "";
    const seg = getActiveEditorSegment();
    return seg?.title ?? "";
  }
  function updateEditorTitle(v: string) {
    if (tsEditMenu.targetType === "timestamp")
      updateTimestampTitle(tsEditMenu.targetId, v);
    else if (tsEditMenu.targetType === "segment") {
      clips.updateBoundaryTitle(tsEditMenu.targetId, v);
      if (tsTooltip.visible && tsTooltip.targetId === tsEditMenu.targetId) {
        tsTooltip = { ...tsTooltip, title: v.trim() };
      }
    }
  }
  function onEditorScissor(kind: "start" | "end") {
    const seg = getActiveEditorSegment();
    if (seg) {
      clips.setBoundaryKind(seg.id, kind);
      closeTimestampEditor();
    } else {
      const ts = getActiveEditorTimestamp();
      if (ts) {
        clips.addClipBoundary(kind, ts.time);
        removeTimestamp(ts.id);
        const newBoundary = clips.clipBoundaries.find(
          (b) => b.time === ts.time && b.kind === kind,
        );
        if (newBoundary) {
          tsEditMenu = {
            ...tsEditMenu,
            visible: true,
            targetId: newBoundary.id,
            targetType: "segment",
          };
        }
      }
    }
  }
  function onEditorDeleteTimestamp() {
    const ts = getActiveEditorTimestamp();
    if (ts) removeTimestamp(ts.id);
    closeTimestampEditor();
  }
  function onEditorDeleteSegment() {
    const seg = getActiveEditorSegment();
    if (seg) {
      clips.removeClipBoundary(seg.id);
      closeTimestampEditor();
    }
  }

  // ── Clip boundaries ────────────────────────────────────
  const clips = createClips(() => filePath);
  function addClipBoundary(kind: "start" | "end") {
    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || rawDurationSecs <= 0) return;
    clips.addClipBoundary(
      kind,
      Math.max(0, Math.min(mediaEl.currentTime, rawDurationSecs)),
    );
  }
  function addClipBoundaryAt(kind: "start" | "end", time: number) {
    if (rawDurationSecs <= 0) return;
    clips.addClipBoundary(kind, Math.max(0, Math.min(time, rawDurationSecs)));
  }
  function removeClipBoundary(id: string) {
    tsTooltip = { ...tsTooltip, visible: false };
    clips.removeClipBoundary(id);
  }
  function showClipBoundaryTooltip(e: MouseEvent, marker: ClipBoundary) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: marker.title,
      timeLabel: formatTime(marker.time),
      tone: "blue",
      targetId: marker.id,
    };
  }
  function showLoopMarkerTooltip(e: MouseEvent, which: "start" | "end") {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const time = which === "start" ? loopStart : loopEnd;
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: which === "start" ? "Loop A" : "Loop B",
      timeLabel: formatTime(time ?? 0),
      tone: "green",
      targetId: which,
    };
  }
  function clearAllSegments() {
    clips.clearBoundaries();
  }
  function hideTsTooltip() {
    tsTooltip = { ...tsTooltip, visible: false };
  }

  /** Update the tsTooltip position and time to track a marker during drag, floating above the progress bar. */
  function updateTooltipDuringDrag(
    time: number,
    tone: "yellow" | "blue" | "green" | "grey",
    title: string | undefined,
    targetId: string | undefined,
  ) {
    const bar =
      document.querySelector(".fs-progress") ??
      document.querySelector(".progress-bar");
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const pct = rawDurationSecs > 0 ? time / rawDurationSecs : 0;
    tsTooltip = {
      visible: true,
      x: barRect.left + pct * barRect.width,
      y: barRect.top - 12,
      title,
      timeLabel: formatTime(time),
      tone,
      targetId,
    };
  }

  // ── Timestamp drag to reposition ────────────────────────
  let timestampDragJustEnded = $state(false);
  function getTimestampPct(time: number): number {
    return timeline.getTimestampPct(time, rawDurationSecs);
  }
  function startTimestampDrag(e: MouseEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || rawDurationSecs <= 0) return;

    const startTs = timeline.getTimestampById(id, timestamps);
    if (!startTs) return;
    const dragTitle = startTs.title;

    const bar =
      document.querySelector(".fs-progress") ??
      document.querySelector(".progress-bar");
    if (!bar) return;

    // Show tooltip immediately at drag start
    updateTooltipDuringDrag(startTs.time, "yellow", dragTitle, id);

    function timeFromClientX(clientX: number): number {
      const rect = bar!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * rawDurationSecs;
    }

    let moved = false;
    function onMouseMove(ev: MouseEvent) {
      moved = true;
      const time = Math.max(
        0,
        Math.min(timeFromClientX(ev.clientX), rawDurationSecs),
      );
      timeline.updateTimestampTime(
        id,
        time,
        timestamps,
        (v) => (timestamps = v),
      );
      updateTooltipDuringDrag(time, "yellow", dragTitle, id);
      if (tsEditMenu.visible && tsEditMenu.targetId === id && bar) {
        const barRect = bar.getBoundingClientRect();
        const pct = rawDurationSecs > 0 ? time / rawDurationSecs : 0;
        tsEditMenu.x = barRect.left + pct * barRect.width;
        tsEditMenu.y = barRect.top - 12;
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        timestampDragJustEnded = true;
        setTimeout(() => {
          timestampDragJustEnded = false;
        }, 50);
      }
      saveTimestamps();
      hideTsTooltip();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ── AB Loop ────────────────────────────────────────────
  function setABLoop(start: number, end: number) {
    loopStart = start;
    loopEnd = end;
    const mediaEl = getMediaEl();
    if (mediaEl) mediaEl.loop = true;
  }

  function clearABLoop() {
    loopStart = null;
    loopEnd = null;
    const mediaEl = getMediaEl();
    if (mediaEl) mediaEl.loop = loopMode === "loop";
  }

  // ── Loop markers (A/B) ─────────────────────────────────
  function addLoopStart() {
    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || rawDurationSecs <= 0) return;
    const time = Math.max(0, Math.min(mediaEl.currentTime, rawDurationSecs));
    loopStart = time;
    // If end exists but is before new start, clear it
    if (loopEnd !== null && loopEnd < time) {
      loopEnd = null;
    }
    const mEl = getMediaEl();
    if (mEl && loopStart !== null && loopEnd !== null) {
      mEl.loop = true;
    }
  }

  function addLoopEnd() {
    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || rawDurationSecs <= 0 || loopStart === null) return;
    const time = Math.max(0, Math.min(mediaEl.currentTime, rawDurationSecs));
    if (time <= loopStart) return;
    loopEnd = time;
    mediaEl.loop = true;
  }

  function clearLoopMarkers() {
    loopStart = null;
    loopEnd = null;
    const mediaEl = getMediaEl();
    if (mediaEl) mediaEl.loop = loopMode === "loop";
  }

  let loopMarkerJustDragged = $state(false);
  function startLoopMarkerDrag(e: MouseEvent, which: "start" | "end") {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || rawDurationSecs <= 0) return;
    if (which === "start" && loopStart === null) return;
    if (which === "end" && loopEnd === null) return;

    const bar =
      document.querySelector(".fs-progress") ??
      document.querySelector(".progress-bar");
    if (!bar) return;

    function timeFromClientX(clientX: number): number {
      const rect = bar!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * rawDurationSecs;
    }

    let moved = false;
    function onMouseMove(ev: MouseEvent) {
      moved = true;
      const time = timeFromClientX(ev.clientX);
      if (which === "start") {
        loopStart = Math.max(0, Math.min(time, rawDurationSecs));
      } else {
        loopEnd = Math.max(0, Math.min(time, rawDurationSecs));
      }
      updateTooltipDuringDrag(
        time,
        "green",
        which === "start" ? "Loop A" : "Loop B",
        which,
      );
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        loopMarkerJustDragged = true;
        setTimeout(() => {
          loopMarkerJustDragged = false;
        }, 50);
      }
      // Normalize the loop if A crossed B
      if (loopStart !== null && loopEnd !== null) {
        const mediaEl = getMediaEl();
        if (mediaEl) mediaEl.loop = true;
      }
      hideTsTooltip();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ── Resume point ───────────────────────────────────────
  function seekToTimestamp(time: number) {
    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || !mediaEl.duration) return;
    mediaEl.currentTime = time;
    // Update UI immediately — don't wait for throttled timeupdate
    rawCurrentSecs = time;
    progress = (time / mediaEl.duration) * 100;
  }
  function removeResumePoint() {
    tsTooltip = { ...tsTooltip, visible: false };
    resumeTooltipVisible = false;
    resumePoint = null;
    deleteResumePoint(filePath);
  }
  function seekToResumePoint() {
    const mediaEl = isVideo ? videoEl : audioEl;
    if (resumePoint !== null && mediaEl) seekToTimestamp(resumePoint);
  }
  function showResumeTooltip(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 6,
      title: "Resume",
      timeLabel: formatTime(resumePoint ?? 0),
      tone: "grey",
    };
  }
  function hideResumeTooltip() {
    tsTooltip = { ...tsTooltip, visible: false };
  }

  // ── Clip marker drag ───────────────────────────────────
  function startClipMarkerDrag(e: MouseEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Reopen the clipping menu if it was dismissed
    clipMenuResetKey++;

    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl || rawDurationSecs <= 0) return;

    const boundary = clips.getBoundaryById(id);
    if (!boundary) return;
    const dragTitle = boundary.title;

    const bar =
      document.querySelector(".fs-progress") ??
      document.querySelector(".progress-bar");
    if (!bar) return;

    // Show tooltip immediately at drag start
    updateTooltipDuringDrag(boundary.time, "blue", dragTitle, id);

    function timeFromClientX(clientX: number): number {
      const rect = bar!.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * rawDurationSecs;
    }

    let moved = false;
    function onMouseMove(ev: MouseEvent) {
      moved = true;
      const time = timeFromClientX(ev.clientX);
      clips.setBoundaryTime(id, Math.max(0, Math.min(time, rawDurationSecs)));
      updateTooltipDuringDrag(time, "blue", dragTitle, id);
      if (tsEditMenu.visible && tsEditMenu.targetId === id && bar) {
        const barRect = bar.getBoundingClientRect();
        const pct = rawDurationSecs > 0 ? time / rawDurationSecs : 0;
        tsEditMenu.x = barRect.left + pct * barRect.width;
        tsEditMenu.y = barRect.top - 12;
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        clips.clipMarkerJustDragged = true;
        setTimeout(() => {
          clips.clipMarkerJustDragged = false;
        }, 50);
      }
      hideTsTooltip();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ── Clip jobs ──────────────────────────────────────────
  function persistClipPrefs() {
    saveClipPreferences({
      deleteOriginal: clipDeleteOriginal,
      useCustomPath: clipUseCustomPath,
      mergeSegments: clipMergeSegments,
    });
  }
  function getClipTargetDir(): string {
    return clipUseCustomPath
      ? clipOutputDir || getParentFolder(filePath)
      : getParentFolder(filePath);
  }
  function showClipToast(
    message: string,
    tone: "success" | "error",
    outputDir: string = clipOutputDir || getParentFolder(filePath),
  ) {
    clearTimeout(clipToastTimer);
    clipToast = { visible: true, tone, message, outputDir };
    clipToastTimer = setTimeout(() => {
      clipToast = { ...clipToast, visible: false };
    }, 4200);
  }
  function sanitizeClipPairs(): { start: number; end: number }[] {
    return clips.clipPairs.map((p) => ({ start: p.start, end: p.end }));
  }
  function extractInvokeErrorMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === "string" && e.trim()) return e;
    if (e && typeof e === "object") {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return "Unknown error";
    }
  }
  async function runClipAction(mode: "separate" | "merge") {
    // planned feature — not yet implemented
  }
  async function toggleClipPathSelection() {
    const dir = await open({ directory: true });
    if (dir) {
      clipOutputDir = dir as string;
    }
  }
  function toggleClipDeleteOriginal() {
    clipDeleteOriginal = !clipDeleteOriginal;
    persistClipPrefs();
  }
  function toggleClipMergeSegments() {
    clipMergeSegments = !clipMergeSegments;
    persistClipPrefs();
  }
  async function triggerClipSegments() {
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
      if (!ffprobeAvailable) return;
    }

    const segments = sanitizeClipPairs();
    if (segments.length === 0) {
      showClipToast(
        "No clip segments defined. Add clip markers first.",
        "error",
      );
      return;
    }

    const mode = clipMergeSegments ? "merge" : "separate";
    clipJobRunning = true;
    clipJobLabel = `Clipping ${segments.length} segment${segments.length > 1 ? "s" : ""}...`;

    try {
      const result = await invokeProcessVideoClips(
        filePath,
        getClipTargetDir(),
        segments,
        mode,
        clipDeleteOriginal,
      );
      showClipToast(
        `${result.outputs.length} clip${result.outputs.length > 1 ? "s" : ""} saved`,
        "success",
        result.output_dir,
      );
    } catch (err) {
      showClipToast(extractInvokeErrorMessage(err), "error");
    } finally {
      clipJobRunning = false;
      clipJobLabel = "";
    }
  }

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
      const idx = loadCdColor(data.filePath);
      if (idx >= 0 && idx < CD_COLORS.length) {
        cdColorIndex = idx;
        cdColor = CD_COLORS[idx];
      } else {
        const rand = Math.floor(Math.random() * CD_COLORS.length);
        saveCdColor(data.filePath, rand);
        cdColorIndex = rand;
        cdColor = CD_COLORS[rand];
      }
      // Extract embedded album art
      invokeExtractCoverArt(data.filePath)
        .then((coverPath) => {
          if (coverPath) {
            coverArtSrc = convertFileSrc(coverPath);
          } else {
            coverArtSrc = "";
          }
        })
        .catch(() => {
          coverArtSrc = "";
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
    if (data.timestamps !== undefined) timestamps = data.timestamps;
    if (data.clipBoundaries !== undefined)
      clips.setBoundaries(data.clipBoundaries);
    if (data.resumePoint !== undefined) resumePoint = data.resumePoint;
  }
  const media = createMedia(
    () => videoEl,
    () => audioEl,
    () => volume,
    () => muted,
    () => loopMode === "loop",
    (newPath?: string) => {
      tsTooltip = { ...tsTooltip, visible: false };
      tsEditMenu = { ...tsEditMenu, visible: false };
      loopStart = null;
      loopEnd = null;
      resetZoom();
      viewer.state.baseZoomLevel = 100;
      if (newPath) {
        editing.switchFile(newPath);
      } else {
        editing.cleanup();
        markup.cleanup();
        markup.cleanup();
      }
      editMenuVisible = false;
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
      sortMode,
      sortDesc,
    );
    // Start watching the parent folder
    const folder = getParentFolder(path);
    if (folder) startWatching(folder);
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
    stopWatching();
    clearTimeout(pendingPlay);
    resumeTooltipVisible = false;
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
    corruptionWarning = false;
    corruptionReason = "";
    corruptionFixError = "";
  }

  // ── File watcher ─────────────────────────────────────
  let unwatchFn: (() => void) | null = null;
  let watchDebounce: ReturnType<typeof setTimeout> | null = null;

  function startWatching(folderPath: string) {
    stopWatching();
    watchImmediate(
      folderPath,
      () => {
        // Debounce: reset timer on every event
        if (watchDebounce) clearTimeout(watchDebounce);
        watchDebounce = setTimeout(() => {
          watchDebounce = null;
          onFolderChanged(folderPath);
        }, 300);
      },
      { recursive: false },
    )
      .then((unwatch) => {
        unwatchFn = unwatch;
      })
      .catch((e) => {
        console.warn("Failed to start file watcher:", e);
      });
  }

  function stopWatching() {
    if (watchDebounce) {
      clearTimeout(watchDebounce);
      watchDebounce = null;
    }
    if (unwatchFn) {
      unwatchFn();
      unwatchFn = null;
    }
  }

  async function onFolderChanged(folderPath: string) {
    const prevPath = filePath;
    const prevList = [...fileList];
    const prevIndex = currentIndex;

    try {
      const newList = await rescanFolder(folderPath, sortMode, sortDesc);

      // Current file still exists in the folder
      const stillHere = newList.indexOf(prevPath);
      if (stillHere !== -1) {
        fileList = newList;
        currentIndex = stillHere;
        return;
      }

      // Current file was removed — advance to nearest neighbor
      if (newList.length > 0) {
        const nextIdx = Math.min(prevIndex, newList.length - 1);
        fileList = newList;
        await loadFile(newList[nextIdx]);
        return;
      }

      // Folder is now empty
      closeFile();
    } catch (e) {
      console.error("onFolderChanged failed:", e);
    }
  }

  // ── Sort ─────────────────────────────────────────────
  function toggleSortMenu() {
    sortMenuVisible = !sortMenuVisible;
  }
  function closeSortMenu() {
    sortMenuVisible = false;
  }
  function onSortChange(mode: SortMode, desc: boolean) {
    sortMode = mode;
    sortDesc = desc;
    saveSortMode(mode);
    saveSortDesc(desc);
    sortMenuVisible = false;
    // Re-sort the current folder
    if (filePath) {
      const folder = getParentFolder(filePath);
      if (folder) onFolderChanged(folder);
    }
  }
  function handleFsPillContext(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (fileList.length === 0) return;
    if (fsPillEl) {
      const rect = fsPillEl.getBoundingClientRect();
      fsSortMenuX = rect.left;
      fsSortMenuY = window.innerHeight - rect.top + 4;
    }
    sortMenuVisible = !sortMenuVisible;
  }

  // ── Corruption detection ────────────────────────────────
  function onImageError() {
    corruptionWarning = true;
    corruptionReason =
      "This image may be corrupted or in an unsupported format.";
  }

  function onVideoError() {
    const err = videoEl?.error;
    const reason = err
      ? `Video decode error (code: ${err.code})`
      : "This video may be corrupted.";
    corruptionWarning = true;
    corruptionReason = reason;
  }

  function onAudioError() {
    const err = audioEl?.error;
    const reason = err
      ? `Audio decode error (code: ${err.code})`
      : "This audio file may be corrupted.";
    corruptionWarning = true;
    corruptionReason = reason;
  }

  function dismissCorruption() {
    corruptionWarning = false;
    corruptionReason = "";
  }

  async function fixCopy() {
    corruptionFixing = true;
    corruptionFixError = "";
    try {
      const result = await invokeFixMedia(filePath, "copy");
      if (result.success) {
        corruptionWarning = false;
        toast.showFrameCopyToast(
          `Fixed copy saved: ${result.output_path}`,
          "success",
        );
      } else {
        corruptionFixError = result.error || "Failed to fix media";
      }
    } catch (e) {
      corruptionFixError =
        e instanceof Error ? e.message : "Failed to fix media";
    }
    corruptionFixing = false;
  }

  async function fixReplace() {
    corruptionFixing = true;
    corruptionFixError = "";
    try {
      const result = await invokeFixMedia(filePath, "replace");
      if (result.success) {
        corruptionWarning = false;
        await loadFile(result.output_path);
        toast.showFrameCopyToast("File fixed and replaced", "success");
      } else {
        corruptionFixError = result.error || "Failed to fix media";
      }
    } catch (e) {
      corruptionFixError =
        e instanceof Error ? e.message : "Failed to fix media";
    }
    corruptionFixing = false;
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
  async function openConvertedFile(path: string) {
    await loadFile(path);
  }

  // ── Window controls ────────────────────────────────────
  async function minimizeWindow() {
    await getCurrentWindow().minimize();
  }
  async function maximizeWindow() {
    await getCurrentWindow().toggleMaximize();
  }
  async function closeWindow() {
    try {
      await invokeCleanupTempFolder();
    } catch {}
    await getCurrentWindow().close();
  }

  // ── Pan / drag ─────────────────────────────────────────
  function startPan(e: MouseEvent) {
    if (e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest(
        ".video-controls, .fs-controls, .fs-topbar, .fs-nav-left, .fs-nav-right, .fs-file-count-pill, .context-menu, .delete-overlay",
      )
    )
      return;
    e.preventDefault();
    let hasMoved = false;
    viewer.setDragging(true);
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      tx: viewer.state.translateX,
      ty: viewer.state.translateY,
    };
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - dragStart.x;
      const dy = ev.clientY - dragStart.y;
      if (!hasMoved && Math.sqrt(dx * dx + dy * dy) < 8) return;
      hasMoved = true;
      if (viewer.state.zoomLevel > viewer.state.baseZoomLevel)
        viewer.setTranslation(dragStart.tx + dx, dragStart.ty + dy);
    }
    function onUp() {
      viewer.setDragging(false);
      if (!hasMoved) {
        const now = Date.now();
        const timeSinceLast = now - lastLeftClickTime;
        lastLeftClickTime = now;
        if (isVideo) {
          if (timeSinceLast < 300) {
            clearTimeout(pendingPlay);
            toggleFullscreen();
          } else {
            pendingPlay = setTimeout(togglePlay, 150);
          }
        } else {
          if (timeSinceLast < 300) toggleFullscreen();
        }
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  async function startDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, .filename, .filename-input"))
      return;
    document.activeElement && (document.activeElement as HTMLElement).blur();
    await getCurrentWindow().startDragging();
  }

  // ── Keybinds ───────────────────────────────────────────
  const configuredKeydown = createKeybindHandler({
    areDialogsOpen: () =>
      contextMenu.visible ||
      deleteConfirm ||
      propertiesOpen ||
      shareOpen ||
      editMenuVisible ||
      markupMenuVisible ||
      slideshowMenuVisible ||
      appDropdownVisible ||
      settingsOpen ||
      accessibilityOpen ||
      helpOpen ||
      aboutOpen ||
      feedbackOpen ||
      tsEditMenu.visible ||
      tsMenuOpen ||
      clipDeleteConfirm.visible ||
      corruptionWarning,
    closeDialogs: () => {
      contextMenu.visible = false;
      deleteConfirm = false;
      propertiesOpen = false;
      shareOpen = false;
      editMenuVisible = false;
      markupMenuVisible = false;
      slideshowMenuVisible = false;
      appDropdownVisible = false;
      settingsOpen = false;
      accessibilityOpen = false;
      helpOpen = false;
      aboutOpen = false;
      feedbackOpen = false;
      tsEditMenu.visible = false;
      tsMenuOpen = false;
      clipDeleteConfirm.visible = false;
      editApplyConfirm = false;
      editTransparencyConfirm = false;
      pendingEditAction = null;
      exportFormatOverride = null;
      corruptionWarning = false;
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

  // ── File dialog ────────────────────────────────────────
  async function openFileDialog() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Media", extensions: ALL_EXTS }],
    });
    if (selected) loadFile(selected as string);
  }

  async function pickAudioFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: AUDIO_EXTS }],
    });
    if (selected) loadFile(selected as string);
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
    const { x, y } = computeContextMenuPosition(
      e.clientX,
      e.clientY,
      menuW,
      menuH,
    );
    contextMenu = { x, y, visible: true };
  }
  function closeContextMenu() {
    contextMenu = { ...contextMenu, visible: false };
  }

  // ── Menu toggles ───────────────────────────────────────
  function openEditMenu() {
    closeContextMenu();
    editing.setFilePath(filePath);
    editMenuVisible = true;
  }
  function closeEditMenu() {
    editMenuVisible = false;
  }
  function openMarkupMenu() {
    closeContextMenu();
    markupMenuVisible = true;
  }
  function closeMarkupMenu() {
    markupMenuVisible = false;
  }
  function toggleSlideshowMenu() {
    slideshowMenuVisible = !slideshowMenuVisible;
  }
  function closeSlideshowMenu() {
    slideshowMenuVisible = false;
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
  function ctxRotate() {
    closeContextMenu();
    editing.pushUndo();
    viewer.rotate();
  }
  function ctxFlip() {
    closeContextMenu();
    editing.pushUndo();
    viewer.flip();
  }
  function ctxToggleLoop() {
    closeContextMenu();
    cycleLoopMode();
  }
  function ctxAddTimestamp() {
    closeContextMenu();
    addTimestamp();
  }
  function ctxClearMarkers() {
    closeContextMenu();
    clearAllTimestamps();
    clearAllSegments();
    removeResumePoint();
  }
  async function ctxShowInExplorerFn() {
    await ctxShowInExplorer({ filePath, closeContextMenu });
  }
  function ctxEdit() {
    openEditMenu();
  }
  function ctxMarkup() {
    openMarkupMenu();
  }
  function ctxProperties() {
    closeContextMenu();
    propertiesOpen = true;
    mediaProps = null;
    ffmpegInstallError = "";
    void (async () => {
      await refreshFfprobeAvailability({
        setFfprobeChecked: (v) => (ffprobeChecked = v),
        setFfprobeAvailable: (v) => (ffprobeAvailable = v),
      });
      // Bail if the user closed the dialog while ffprobe was being checked
      if (!propertiesOpen) return;
      if (ffprobeAvailable)
        await loadMediaProperties({
          filePath,
          setMediaProps: (v) => (mediaProps = v),
          setMediaPropsLoading: (v) => (mediaPropsLoading = v),
        });
    })();
  }
  function ctxShare() {
    closeContextMenu();
    shareOpen = true;
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
    editMenuVisible = false;
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

  async function handleMarkupApply() {
    if (markup.strokes.length === 0) return;
    try {
      stopWatching();
      await renderMarkupOnImage(filePath, markup.strokes, filePath);
      markup.clearAllStrokes();
      await loadFile(filePath);
      startWatching(getParentFolder(filePath) || "");
      toast.showFrameCopyToast("Markup applied", "success");
    } catch (err) {
      startWatching(getParentFolder(filePath) || "");
      const message =
        err instanceof Error ? err.message : "Failed to apply markup";
      toast.showFrameCopyToast(message, "error");
    }
  }

  async function handleMarkupExport() {
    if (markup.strokes.length === 0) return;
    try {
      const ext = getFileExt(filePath) || "png";
      const defaultName = fileName.replace(/\.[^.]+$/, "") + "_marked." + ext;
      const { save } = await import("@tauri-apps/plugin-dialog");
      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Image", extensions: [ext] }],
      });
      if (!outputPath) return;
      await renderMarkupOnImage(filePath, markup.strokes, outputPath);
      toast.showFrameCopyToast("Markup exported", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export markup";
      toast.showFrameCopyToast(message, "error");
    }
  }
  async function ctxDelete() {
    closeContextMenu();
    if (loadSkipDeleteConfirmation()) performDelete();
    else deleteConfirm = true;
  }
  async function performDelete() {
    deleteConfirm = false;
    if (deleteNoAsk) saveSkipDeleteConfirmation();
    const pathToDelete = filePath;
    const prevList = [...fileList];
    const prevIndex = currentIndex;
    closeFile();
    try {
      if (deletePermanently) await invokeDeleteFile(pathToDelete);
      else await invokeTrashFile(pathToDelete);
      toast.showFrameCopyToast(
        deletePermanently ? "File deleted permanently" : "File moved to trash",
        "error",
      );
    } catch {
      toast.showFrameCopyToast("Failed to delete file", "error");
    }
    const remaining = prevList.filter((p) => p !== pathToDelete);
    if (remaining.length > 0)
      loadFile(remaining[Math.min(prevIndex, remaining.length - 1)]);
  }

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
  function showFilenameTooltip(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    import("$lib/services/session").then(({ showFloatingTooltip }) =>
      showFloatingTooltip(
        "filename-tooltip",
        el.getBoundingClientRect(),
        "File name",
      ),
    );
  }
  async function hideFilenameTooltip() {
    const { hideFloatingTooltip } = await import("$lib/services/session");
    hideFloatingTooltip("filename-tooltip");
  }
  function handleGlobalMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (
      contextMenu.visible &&
      !target.closest(".context-menu") &&
      !document.querySelector(".context-menu.pinned")
    )
      closeContextMenu();
    if (
      editMenuVisible &&
      e.button === 2 &&
      !target.closest(".edit-menu") &&
      !target.closest(".edit-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      closeEditMenu();
    if (
      markupMenuVisible &&
      e.button === 2 &&
      !target.closest(".markup-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      closeMarkupMenu();
    if (
      slideshowMenuVisible &&
      e.button === 2 &&
      !target.closest(".slideshow-menu") &&
      !target.closest(".slideshow-btn") &&
      !document.querySelector(".slideshow-menu.pinned")
    )
      closeSlideshowMenu();
    if (
      tsEditMenu.visible &&
      !target.closest(".ts-edit-menu") &&
      !target.closest(".ts-marker") &&
      !target.closest(".clip-marker") &&
      !target.closest(".fs-clip-marker")
    )
      closeTimestampEditor();
    if (
      appDropdownVisible &&
      !target.closest(".app-dropdown-menu") &&
      !target.closest(".app-dropdown-toggle")
    )
      appDropdownVisible = false;
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
    clipOutputDir: {
      get: () => clipOutputDir,
      set: (v) => (clipOutputDir = v),
    },
    clipDeleteOriginal: {
      get: () => clipDeleteOriginal,
      set: (v) => (clipDeleteOriginal = v),
    },
    clipUseCustomPath: {
      get: () => clipUseCustomPath,
      set: (v) => (clipUseCustomPath = v),
    },
    clipMergeSegments: {
      get: () => clipMergeSegments,
      set: (v) => (clipMergeSegments = v),
    },
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
  {clipMenuResetKey}
  {triggerClipSegments}
  {clipJobRunning}
  {clipDeleteOriginal}
  {clipUseCustomPath}
  {clipMergeSegments}
  {getClipTargetDir}
  {toggleClipDeleteOriginal}
  {toggleClipPathSelection}
  {toggleClipMergeSegments}
  {clipJobLabel}
  {toggleSlideshowMenu}
  {slideshowMenuVisible}
  {closeSlideshowMenu}
  {toggleThumbnailBar}
  {sortMode}
  {sortDesc}
  {sortMenuVisible}
  {toggleSortMenu}
  {closeSortMenu}
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
  {appDropdownVisible}
  toggleAppDropdown={() => (appDropdownVisible = !appDropdownVisible)}
  closeAppDropdown={() => (appDropdownVisible = false)}
  openSettings={() => (settingsOpen = true)}
  openAccessibility={() => (accessibilityOpen = true)}
  openHelp={() => (helpOpen = true)}
  openAbout={() => (aboutOpen = true)}
  openFeedback={() => (feedbackOpen = true)}
  {settingsOpen}
  closeSettings={() => (settingsOpen = false)}
  {accessibilityOpen}
  closeAccessibility={() => (accessibilityOpen = false)}
  {helpOpen}
  closeHelp={() => (helpOpen = false)}
  {aboutOpen}
  closeAbout={() => (aboutOpen = false)}
  {feedbackOpen}
  closeFeedback={() => (feedbackOpen = false)}
  {contextMenu}
  onOpenContextMenu={openContextMenu}
  {editMenuVisible}
  onApply={handleApplyEdits}
  onExport={handleExportEdits}
  onUndo={handleUndo}
  onReset={handleReset}
  onMarkupApply={handleMarkupApply}
  onMarkupExport={handleMarkupExport}
  {closeEditMenu}
  {markupMenuVisible}
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
  onCloseClipDeleteConfirm={() =>
    (clipDeleteConfirm = { visible: false, mode: null })}
  onCloseDeleteConfirm={() => (deleteConfirm = false)}
  onCloseProperties={() => (propertiesOpen = false)}
  onCloseShare={() => (shareOpen = false)}
  onUpdateDeleteNoAsk={(v: boolean) => (deleteNoAsk = v)}
  onUpdateDeletePermanently={(v: boolean) => (deletePermanently = v)}
  onCloseContextMenu={closeContextMenu}
  {tsTooltip}
  tsEditMenuVisible={tsEditMenu.visible}
  {tsEditMenu}
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
  {timestamps}
  clipBoundaries={clips.clipBoundaries}
  {resumePoint}
  {frameCopyToast}
  {imageCopyToast}
  {clipToast}
  {exportToast}
  {clipboardToast}
  {clipOutputDir}
  parentFolder={() => getParentFolder(filePath)}
  {invokeOpenDirectory}
  ctxCopyImage={ctxCopyImageFn}
  ctxCopyFrame={ctxCopyFrameFn}
  ctxCopyPath={ctxCopyPathFn}
  {ctxRotate}
  {ctxFlip}
  {ctxEdit}
  {ctxMarkup}
  ctxShowInExplorer={ctxShowInExplorerFn}
  {ctxProperties}
  {ctxShare}
  {ctxDelete}
  {ctxClearMarkers}
  {clipDeleteConfirm}
  {deleteConfirm}
  {deleteNoAsk}
  {deletePermanently}
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
  {runClipAction}
  {corruptionWarning}
  {corruptionReason}
  {corruptionFixing}
  {corruptionFixError}
  {dismissCorruption}
  {fixCopy}
  {fixReplace}
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
                  onerror={onImageError}
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
                    onerror={onVideoError}
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
              class:editor-open={tsEditMenu.visible}
            >
              <TimelineMarkers
                fullscreen={false}
                {progress}
                currentTimeSecs={rawCurrentSecs}
                {isGifVideo}
                clipPairs={clips.clipPairs}
                clipBoundaries={clips.clipBoundaries}
                {timestamps}
                {abLoopRegion}
                {loopStart}
                {loopEnd}
                {resumePoint}
                durationSecs={rawDurationSecs}
                clipMarkerJustDragged={clips.clipMarkerJustDragged}
                tsEditMenuVisible={tsEditMenu.visible}
                {startScrubbing}
                {getTimestampPct}
                {startClipMarkerDrag}
                {removeClipBoundary}
                {showClipBoundaryTooltip}
                {hideTsTooltip}
                {seekToTimestamp}
                {openSegmentEditor}
                {startTimestampDrag}
                {timestampDragJustEnded}
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
                {loopMarkerJustDragged}
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
                addClipStart={() => addClipBoundary("start")}
                addClipEnd={() => addClipBoundary("end")}
                {addLoopStart}
                {addLoopEnd}
                hasLoopStart={loopStart !== null}
                hasLoopEnd={loopEnd !== null}
                hasAnyMarkers={timestamps.length > 0 ||
                  clips.clipBoundaries.length > 0 ||
                  resumePoint !== null ||
                  loopStart !== null ||
                  loopEnd !== null}
                deleteAllMarkers={() => {
                  clearAllTimestamps();
                  clearAllSegments();
                  removeResumePoint();
                  clearLoopMarkers();
                }}
                {toggleTimer}
                {currentTimeDisplay}
                {durationDisplay}
                {timerTooltip}
                {toggleFullscreen}
                onTsMenuChange={(v) => (tsMenuOpen = v)}
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
            {onAudioError}
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
            {timestamps}
            {loopStart}
            {loopEnd}
            {resumePoint}
            tsEditMenuVisible={tsEditMenu.visible}
            {tsMenuOpen}
            {loopMenuOpen}
            onTsMenuChange={(v) => (tsMenuOpen = v)}
            onLoopMenuChange={(v) => (loopMenuOpen = v)}
            {addTimestamp}
            {addLoopStart}
            {addLoopEnd}
            {addClipBoundary}
            {clearAllTimestamps}
            {clearAllSegments}
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
        class:visible={viewer.state.fsControlsVisible || tsEditMenu.visible}
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
              {timestamps}
              {abLoopRegion}
              {loopStart}
              {loopEnd}
              {resumePoint}
              durationSecs={rawDurationSecs}
              clipMarkerJustDragged={clips.clipMarkerJustDragged}
              tsEditMenuVisible={tsEditMenu.visible}
              {startScrubbing}
              {getTimestampPct}
              {startClipMarkerDrag}
              {removeClipBoundary}
              {showClipBoundaryTooltip}
              {hideTsTooltip}
              {seekToTimestamp}
              {openSegmentEditor}
              {startTimestampDrag}
              {timestampDragJustEnded}
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
              {loopMarkerJustDragged}
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
              addClipStart={() => addClipBoundary("start")}
              addClipEnd={() => addClipBoundary("end")}
              {addLoopStart}
              {addLoopEnd}
              hasLoopStart={loopStart !== null}
              hasLoopEnd={loopEnd !== null}
              hasAnyMarkers={timestamps.length > 0 ||
                clips.clipBoundaries.length > 0 ||
                resumePoint !== null ||
                loopStart !== null ||
                loopEnd !== null}
              deleteAllMarkers={() => {
                clearAllTimestamps();
                clearAllSegments();
                removeResumePoint();
                clearLoopMarkers();
              }}
              {toggleTimer}
              {currentTimeDisplay}
              {durationDisplay}
              {timerTooltip}
              {toggleFullscreen}
              onTsMenuChange={(v) => (tsMenuOpen = v)}
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
        {#if sortMenuVisible}
          <SortMenu
            visible={sortMenuVisible}
            onClose={closeSortMenu}
            x={fsSortMenuX}
            y={fsSortMenuY}
            {sortMode}
            {sortDesc}
            {onSortChange}
          />
        {/if}
      </div>
    {/if}
  {/snippet}
</Shell>

{#if editTransparencyConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="delete-dialog edit-confirm-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="edit-confirm-header">
        <div class="edit-confirm-header-left">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div>
            <p class="delete-title">Transparency Warning</p>
            <p class="delete-subtitle">{fileName}</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={closeEditTransparencyConfirm}
          aria-label="Cancel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="edit-confirm-body-box">
        JPEG and some image formats do not support transparent backgrounds.
        Custom rotation will create transparent areas around the image.
      </div>
      <div class="edit-confirm-actions edit-confirm-actions-vertical">
        <button
          class="edit-confirm-btn-blue edit-confirm-btn-full"
          onclick={() => handleTransparencyChoice("keep")}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Keep as {getFileExt(filePath).toUpperCase()} (black background)
        </button>
        <button
          class="edit-confirm-btn-primary edit-confirm-btn-full"
          onclick={() => handleTransparencyChoice("png")}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          Convert to PNG (transparent background)
        </button>
      </div>
    </div>
  </div>
{/if}

{#if editApplyConfirm}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="delete-dialog edit-confirm-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="edit-confirm-header">
        <div class="edit-confirm-header-left">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="color: var(--blue)"
          >
            <path
              d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            />
          </svg>
          <div>
            <p class="delete-title">Apply Edits?</p>
            <p class="delete-subtitle">{fileName}</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={closeEditApplyConfirm}
          aria-label="Cancel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="edit-confirm-body-box">
        Applying edits will overwrite the current image. A temporary backup is
        created, but you cannot undo after closing the file or app.
      </div>
      <div class="edit-confirm-actions edit-confirm-actions-horizontal">
        <button
          class="edit-confirm-btn-export"
          onclick={handleApplyExportInstead}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Export instead
        </button>
        <button class="edit-confirm-btn-primary" onclick={handleApplyConfirm}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Apply
        </button>
      </div>
    </div>
  </div>
{/if}
