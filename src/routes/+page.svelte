<!-- DATAFLOW: loadFile → media.loadFile → displayFile → services.
  navigate → media.navigate → displayFile. videoEl bound and injected into viewer/playback/slideshow. -->
<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { open } from "@tauri-apps/plugin-dialog";
  import { invoke } from "@tauri-apps/api/core";
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
    type LoopMode,
  } from "$lib/shared/constants";
  import type {
    ContextMenu,
    VideoMarker,
    ClipBoundary,
    MediaProperties,
    VideoMarkerDragRange,
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
  } from "$lib/services/storage";
  import {
    invokeDeleteFile,
    invokeTrashFile,
    invokeOpenFolder,
    invokeOpenDirectory,
    invokeCleanupTempFolder,
    exportEditedImage,
    invokeExportEditedMedia,
    invokeCheckMediaIntegrity,
    invokeFixMedia,
  } from "$lib/features/media/tools";
  import { computeContextMenuPosition } from "$lib/services/session";
  import {
    copyAllPropertiesToClipboard,
    copyPathToClipboard,
    showValue,
  } from "$lib/services/clipboard";
  import {
    getParentFolder,
    getFileExt,
    clearFolderCache,
  } from "$lib/services/files";
  import { createMedia } from "$lib/features/media/media";
  import { viewer } from "$lib/features/viewer/viewer.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import TimelineMarkers from "$lib/features/timeline/TimelineMarkers.svelte";
  import PlaybackControls from "$lib/features/media/PlaybackControls.svelte";
  import Shell from "$lib/shared/Shell.svelte";
  import { createToastHelpers } from "$lib/shared/toast";
  import {
    ctxCopyImage,
    ctxCopyFrame,
    ctxCopyPath,
    ctxShowInExplorer,
  } from "$lib/features/dialogs/contextActions";
  import {
    loadMediaProperties,
    refreshFfprobeAvailability,
    installFfmpegAndWait,
  } from "$lib/features/media/ffmpeg";
  import { setupInit } from "./init";
  import { createPdf } from "$lib/features/pdf/pdf.svelte";

  // ── State ──────────────────────────────────────────────
  let filePath = $state("");
  let fileSrc = $state("");
  let fileName = $state("no file open");
  let isVideo = $state(false);
  let isAudio = $state(false);
  let isPdf = $state(false);
  let waveformSrc = $state("");
  let fileList: string[] = $state([]);
  let currentIndex = $state(0);
  let fileSize = $state("");
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
  let lastTimeupdate = 0;
  let isScrubbing = false;
  let contextMenu = $state<ContextMenu>({ x: 0, y: 0, visible: false });
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(false);
  let propertiesOpen = $state(false);
  let editMenuVisible = $state(false);
  let processMenuVisible = $state(false);
  let slideshowMenuVisible = $state(false);
  let appDropdownVisible = $state(false);
  let settingsOpen = $state(false);
  let accessibilityOpen = $state(false);
  let helpOpen = $state(false);
  let aboutOpen = $state(false);
  let feedbackOpen = $state(false);
  let tsMenuOpen = $state(false);
  let thumbnailBarVisible = $state(false);
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
    tone?: "yellow" | "blue" | "green" | "red";
  }>({ visible: false, x: 0, y: 0, title: "", timeLabel: "", tone: "yellow" });
  let tsEditMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    targetId: string;
    targetType: "timestamp" | "segment";
  }>({ visible: false, x: 0, y: 0, targetId: "", targetType: "timestamp" });
  let tsDragRange = $state<VideoMarkerDragRange>({
    visible: false,
    start: 0,
    end: 0,
    phase: "idle",
  });
  let tsMarkerDragJustEnded = $state(false);
  let tsDragFadeTimer: ReturnType<typeof setTimeout> | undefined;
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
    !viewer.state.fsControlsVisible && !tsEditMenu.visible ? "none" : panCursor,
  );
  const isGifVideo = $derived(isVideo && getFileExt(filePath) === "gif");
  const anyMenuOpen = $derived(
    contextMenu.visible ||
      appDropdownVisible ||
      slideshowMenuVisible ||
      editMenuVisible ||
      processMenuVisible ||
      settingsOpen ||
      accessibilityOpen ||
      helpOpen ||
      aboutOpen ||
      feedbackOpen ||
      tsEditMenu.visible ||
      deleteConfirm ||
      propertiesOpen ||
      clipDeleteConfirm.visible ||
      tsMenuOpen ||
      corruptionWarning,
  );
  function currentTimeDisplay(): string {
    if (!timerShowRemaining) return formatTime(rawCurrentSecs);
    return `-${formatTime(rawDurationSecs - rawCurrentSecs)}`;
  }
  const durationDisplay = $derived(formatTime(rawDurationSecs));
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
      imageNaturalWidth > 0 &&
      imageNaturalHeight > 0
    ) {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(width, height, imageNaturalWidth, imageNaturalHeight);
    }
  });
  function toggleFullscreen() {
    viewer.toggleFullscreen();
  }
  function resetZoom() {
    if (viewerEl && imageNaturalWidth > 0 && imageNaturalHeight > 0) {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(width, height, imageNaturalWidth, imageNaturalHeight);
    } else {
      viewer.resetZoom();
    }
  }
  function handleViewerScroll(e: WheelEvent) {
    viewer.handleViewerScroll(e, fileSrc);
  }

  // ── Playback ───────────────────────────────────────────
  const getMediaEl = () => (isVideo ? videoEl : isAudio ? audioEl : null);
  const playback = createPlaybackActions(getMediaEl);
  const playbackUI = createPlaybackUI(getMediaEl, () => volume, setVolume);
  function updateProgress() {
    if (isScrubbing) return;
    const now = performance.now();
    if (now - lastTimeupdate < 100) return;
    lastTimeupdate = now;
    playback.updateProgress((data) => {
      rawCurrentSecs = data.rawCurrentSecs;
      rawDurationSecs = data.rawDurationSecs;
      progress = data.progress;
      playing = data.playing;
    });
  }
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
  function toggleTimer() {
    timerShowRemaining = !timerShowRemaining;
  }
  function startScrubbing(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const mediaEl = isVideo ? videoEl : audioEl;
    if (!mediaEl) return;
    const bar = e.currentTarget as HTMLElement;
    const wasPlaying = !mediaEl.paused;
    mediaEl.pause();
    isScrubbing = true;
    let rafId = 0;
    let pendingX = e.clientX;
    let pending = false;
    function scrubTo(clientX: number) {
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      mediaEl!.currentTime = ratio * mediaEl!.duration;
      rawCurrentSecs = mediaEl!.currentTime;
      progress = ratio * 100;
    }
    function scheduleScrub(clientX: number) {
      pendingX = clientX;
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(() => {
          scrubTo(pendingX);
          pending = false;
        });
      }
    }
    scrubTo(e.clientX);
    function onMouseMove(ev: MouseEvent) {
      scheduleScrub(ev.clientX);
    }
    function onMouseUp() {
      cancelAnimationFrame(rafId);
      isScrubbing = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      scrubTo(pendingX);
      if (wasPlaying) mediaEl!.play();
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }
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

  // ── Timeline / timestamps ──────────────────────────────
  const timeline = createTimeline();
  function saveTimestamps() {
    writeTimestamps(filePath, timestamps);
  }
  function addTimestamp() {
    timeline.addTimestamp(rawCurrentSecs, timestamps, (v) => (timestamps = v));
  }
  function removeTimestamp(id: string) {
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
    timeline.removeTimestamp(id, timestamps, (v) => (timestamps = v));
  }
  function clearAllTimestamps() {
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
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
      y: rect.top,
      title: ts.title,
      timeLabel: formatTime(ts.time),
      tone: "yellow",
    };
  }
  function openTimestampEditor(e: MouseEvent, id: string) {
    e.stopPropagation();
    const ts = getTimestampById(id);
    if (!ts) return;
    tsEditMenu = {
      visible: true,
      x: e.clientX + 8,
      y: e.clientY - 12,
      targetId: id,
      targetType: "timestamp",
    };
  }
  function openSegmentEditor(e: MouseEvent, id: string) {
    e.stopPropagation();
    const b = clips.getBoundaryById(id);
    if (!b) return;
    tsEditMenu = {
      visible: true,
      x: e.clientX + 8,
      y: e.clientY - 12,
      targetId: id,
      targetType: "segment",
    };
  }
  function closeTimestampEditor() {
    tsEditMenu = { ...tsEditMenu, visible: false };
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
    else if (tsEditMenu.targetType === "segment")
      clips.updateBoundaryTitle(tsEditMenu.targetId, v);
  }
  function onEditorScissor(kind: "start" | "end") {
    const seg = getActiveEditorSegment();
    if (!seg) return;
    clips.setBoundaryKind(seg.id, kind);
    closeTimestampEditor();
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
    clips.removeClipBoundary(id);
  }
  function showClipBoundaryTooltip(e: MouseEvent, marker: ClipBoundary) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      title: marker.title,
      timeLabel: formatTime(marker.time),
      tone: marker.kind === "start" ? "green" : "red",
    };
  }
  function clearAllSegments() {
    clips.clearBoundaries();
  }
  function hideTsTooltip() {
    tsTooltip = { ...tsTooltip, visible: false };
  }

  // ── Timestamp drag ─────────────────────────────────────
  function clearTimestampDragRange() {
    tsDragRange = { ...tsDragRange, visible: false, phase: "fading" };
    clearTimeout(tsDragFadeTimer);
    tsDragFadeTimer = setTimeout(() => {
      tsDragRange = { ...tsDragRange, visible: false, phase: "idle" };
    }, 600);
  }
  function getTimestampPct(time: number): number {
    return timeline.getTimestampPct(time, rawDurationSecs);
  }
  function startTimestampRangeDrag(e: MouseEvent, id: string) {
    // planned feature — not yet implemented
  }
  function getDragRangeStyle(): string {
    if (!tsDragRange.visible) return "";
    const startPct = getTimestampPct(tsDragRange.start);
    const endPct = getTimestampPct(tsDragRange.end);
    return `left: ${startPct}%; width: ${endPct - startPct}%`;
  }

  // ── Resume point ───────────────────────────────────────
  function seekToTimestamp(time: number) {
    const mediaEl = isVideo ? videoEl : audioEl;
    if (mediaEl) mediaEl.currentTime = time;
  }
  function removeResumePoint() {
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
      y: rect.top,
      title: "Resume",
      timeLabel: formatTime(resumePoint ?? 0),
      tone: "green",
    };
  }
  function hideResumeTooltip() {
    tsTooltip = { ...tsTooltip, visible: false };
  }

  // ── Clip marker drag ───────────────────────────────────
  function startClipMarkerDrag(e: MouseEvent, id: string) {
    // planned feature — not yet implemented
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
    // planned feature — not yet implemented
  }
  function toggleClipDeleteOriginal() {
    clipDeleteOriginal = !clipDeleteOriginal;
    persistClipPrefs();
  }
  function toggleClipMergeSegments() {
    clipMergeSegments = !clipMergeSegments;
    persistClipPrefs();
  }
  function triggerClipSegments() {
    // planned feature — not yet implemented
  }

  // ── File loading / navigation ──────────────────────────
  function setMediaState(
    data: Partial<import("$lib/features/media/media").MediaState>,
  ) {
    if (data.filePath !== undefined) filePath = data.filePath;
    if (data.fileSrc !== undefined) fileSrc = data.fileSrc;
    if (data.fileName !== undefined) fileName = data.fileName;
    if (data.isVideo !== undefined) isVideo = data.isVideo;
    if (data.isAudio !== undefined) isAudio = data.isAudio;
    if (data.isPdf !== undefined) isPdf = data.isPdf;
    if (data.fileList !== undefined) fileList = data.fileList;
    if (data.currentIndex !== undefined) currentIndex = data.currentIndex;
    if (data.fileSize !== undefined) fileSize = data.fileSize;
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
      clearTimeout(tsDragFadeTimer);
      clearTimestampDragRange();
      tsTooltip = { ...tsTooltip, visible: false };
      tsEditMenu = { ...tsEditMenu, visible: false };
      resetZoom();
      viewer.state.baseZoomLevel = 100;
      if (newPath) {
        editing.switchFile(newPath);
      } else {
        editing.cleanup();
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
    waveformSrc = "";
    import("@tauri-apps/api/core").then(({ convertFileSrc }) => {
      invoke<string | null>("generate_thumbnail", { path: filePath }).then(
        (thumbPath) => {
          if (thumbPath) waveformSrc = convertFileSrc(thumbPath);
        },
      );
    });
  }
  async function loadFile(path: string) {
    slideshow.stop();
    editing.exitCropMode();
    await media.loadFile(path, setMediaState, (list, index) => {
      fileList = list;
      currentIndex = index >= 0 ? index : 0;
    });
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
  function toggleThumbnailBar() {
    thumbnailBarVisible = !thumbnailBarVisible;
  }
  function closeFile() {
    slideshow.stop();
    clearTimeout(pendingPlay);
    resumeTooltipVisible = false;
    editing.cleanup();
    viewer.state.zoomLevel = 100;
    viewer.state.baseZoomLevel = 100;
    viewer.state.translateX = 0;
    viewer.state.translateY = 0;
    media.closeFile(setMediaState);
    pdf.cleanup();
    waveformSrc = "";
    mediaProps = null;
    mediaPropsLoading = false;
    clearFolderCache();
    corruptionWarning = false;
    corruptionReason = "";
    corruptionFixError = "";
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
        ".video-controls, .fs-controls, .fs-topbar, .fs-nav-left, .fs-nav-right, .context-menu, .delete-overlay",
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
    if ((e.target as HTMLElement).closest("button, .filename")) return;
    await getCurrentWindow().startDragging();
  }

  // ── Keybinds ───────────────────────────────────────────
  const configuredKeydown = createKeybindHandler({
    areDialogsOpen: () =>
      contextMenu.visible ||
      deleteConfirm ||
      propertiesOpen ||
      editMenuVisible ||
      processMenuVisible ||
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
      editMenuVisible = false;
      processMenuVisible = false;
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
      corruptionWarning = false;
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
  function openProcessMenu() {
    closeContextMenu();
    processMenuVisible = true;
    if (!ffprobeChecked)
      void refreshFfprobeAvailability({
        setFfprobeChecked: (v) => (ffprobeChecked = v),
        setFfprobeAvailable: (v) => (ffprobeAvailable = v),
      });
  }
  function closeProcessMenu() {
    processMenuVisible = false;
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
  }
  async function ctxShowInExplorerFn() {
    await ctxShowInExplorer({ filePath, closeContextMenu });
  }
  function ctxEdit() {
    openEditMenu();
  }
  function ctxProcess() {
    openProcessMenu();
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
      if (ffprobeAvailable)
        await loadMediaProperties({
          filePath,
          setMediaProps: (v) => (mediaProps = v),
          setMediaPropsLoading: (v) => (mediaPropsLoading = v),
        });
    })();
  }
  async function handleApplyEdits() {
    if (!editing.getHasEdits() && !editing.getCropBounds()) return;
    editMenuVisible = false;
    editing.exitCropMode();
    try {
      editing.isApplying = true;
      await editing.backupOriginal(filePath);

      const s = editing.snapshot;
      const ext = getFileExt(filePath);

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
      } else {
        await exportEditedImage(filePath, s, filePath);
      }

      editing.isApplying = false;
      editing.isApplied = true;
      toast.showFrameCopyToast("Edits applied", "success");
    } catch (err) {
      editing.isApplying = false;
      const message =
        err instanceof Error ? err.message : "Failed to apply edits";
      toast.showFrameCopyToast(message, "error");
    }
  }

  async function handleExportEdits() {
    if (!editing.getHasEdits() && !editing.getCropBounds()) {
      toast.showFrameCopyToast("No edits to export", "info");
      return;
    }
    try {
      const ext = getFileExt(filePath);
      const defaultName = fileName.replace(/\.[^.]+$/, "") + "_edited." + ext;

      const { save } = await import("@tauri-apps/plugin-dialog");
      const outputPath = await save({
        defaultPath: defaultName,
        filters: isVideo
          ? [{ name: "Video", extensions: [ext] }]
          : [{ name: "Image", extensions: [ext] }],
      });

      if (!outputPath) return;

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

  function handleUndo() {
    editing.undo();
  }

  async function handleReset() {
    await editing.reset();
    toast.showFrameCopyToast("Edits reset", "info");
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
  async function propsCopyPath() {
    try {
      await copyPathToClipboard(filePath);
      toast.showFrameCopyToast("Copied file path to clipboard", "info");
    } catch {
      toast.showFrameCopyToast("Failed to copy file path", "error");
    }
  }
  async function propsOpenFolder() {
    try {
      await invokeOpenFolder(filePath);
    } catch {}
  }
  async function propsCopyAll() {
    try {
      await copyAllPropertiesToClipboard(
        fileName,
        filePath,
        isVideo,
        isPdf,
        getFileExt(filePath),
        fileDimensions,
        fileSize,
        fileCreated,
        fileModified,
        durationDisplay,
        getParentFolder(filePath),
        mediaProps,
      );
      toast.showFrameCopyToast("Copied all properties to clipboard", "info");
    } catch {
      toast.showFrameCopyToast("Failed to copy properties", "error");
    }
  }
  async function copyPropValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.showFrameCopyToast("Property copied to clipboard", "info");
    } catch {
      toast.showFrameCopyToast("Failed to copy property", "error");
    }
  }

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
      processMenuVisible &&
      e.button === 2 &&
      !target.closest(".process-menu") &&
      !document.querySelector(".process-menu.pinned")
    )
      closeProcessMenu();
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
  viewerResetFsTimer={viewer.resetFsTimer}
  viewerToggleFullscreen={toggleFullscreen}
  {thumbnailBarVisible}
  zoomLevel={viewer.state.zoomLevel}
  {resetZoom}
  clipCount={clips.clipCount}
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
  {closeEditMenu}
  {processMenuVisible}
  {closeProcessMenu}
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
  {ctxProcess}
  ctxShowInExplorer={ctxShowInExplorerFn}
  {ctxProperties}
  {ctxDelete}
  {ctxClearMarkers}
  {clipDeleteConfirm}
  {deleteConfirm}
  {deleteNoAsk}
  {deletePermanently}
  {propertiesOpen}
  fileExt={() => getFileExt(filePath)}
  {fileCreated}
  {fileModified}
  {durationDisplay}
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
        onmousedown={!isVideo && !isPdf ? startPan : undefined}
        ontouchstart={(e) => {
          if (e.touches.length === 2) e.preventDefault();
        }}
        ontouchmove={viewer.handleTouchZoom}
        ontouchend={viewer.handleTouchEnd}
        style="cursor: {!isVideo && !isPdf ? panCursor : 'default'}"
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
          </div>
        {:else if fileSrc && isVideo}
          <div
            class="video-wrapper"
            bind:this={cropContainerEl}
            role="presentation"
            onmouseenter={() => (hoverZone = "video")}
            onmouseleave={() => (hoverZone = "none")}
            onmousedown={startPan}
            style="{videoWrapperTransform} cursor: {panCursor}"
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
                    ontimeupdate={updateProgress}
                    onloadedmetadata={onVideoLoad}
                    onerror={onVideoError}
                    onended={() => {
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
                    }}
                  >
                    <track kind="captions" srclang="en" label="English" />
                  </video>
                </div>
              {/key}
            </div>
            <CropOverlay containerEl={cropContainerEl} mediaEl={videoInnerEl} />
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
                {tsDragRange}
                {resumePoint}
                clipMarkerJustDragged={clips.clipMarkerJustDragged}
                {tsMarkerDragJustEnded}
                tsEditMenuVisible={tsEditMenu.visible}
                {startScrubbing}
                {getTimestampPct}
                {getDragRangeStyle}
                {startClipMarkerDrag}
                {removeClipBoundary}
                {showClipBoundaryTooltip}
                {hideTsTooltip}
                {seekToTimestamp}
                {openSegmentEditor}
                {startTimestampRangeDrag}
                {removeTimestamp}
                {showTimestampTooltip}
                {openTimestampEditor}
                {showResumeTooltip}
                {hideResumeTooltip}
                {seekToResumePoint}
                {removeResumePoint}
                {formatTime}
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
                toggleLoop={cycleLoopMode}
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
                addClipEnd5s={() =>
                  addClipBoundaryAt("end", rawCurrentSecs + 5)}
                hasMarkers={timestamps.length > 0 ||
                  clips.clipBoundaries.length > 0}
                deleteAllMarkers={() => {
                  clearAllTimestamps();
                  clearAllSegments();
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
              />
            </div>
          </div>
        {:else if fileSrc && isAudio}
          <div
            class="audio-wrapper"
            role="presentation"
            onmouseenter={() => (hoverZone = "video")}
            onmouseleave={() => (hoverZone = "none")}
          >
            <audio
              bind:this={audioEl}
              src={fileSrc}
              crossorigin="anonymous"
              preload="metadata"
              autoplay
              ontimeupdate={updateProgress}
              onloadedmetadata={onAudioLoad}
              onerror={onAudioError}
              onended={() => {
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
              }}
            ></audio>
            <div class="audio-waveform">
              {#if waveformSrc}
                <img src={waveformSrc} alt="waveform" />
              {:else}
                <div class="audio-waveform-placeholder"></div>
              {/if}
            </div>
            <div
              class="audio-progress-bar"
              class:editor-open={tsEditMenu.visible}
              onmousedown={startScrubbing}
              role="button"
              tabindex="0"
              aria-label="Seek audio"
            >
              <div class="audio-progress-fill" style="width: {progress}%"></div>
              <div
                class="audio-progress-playhead"
                style="left: {progress}%"
              ></div>
            </div>
            <div class="audio-controls">
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
                toggleLoop={cycleLoopMode}
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
                addTimestamp={() => {}}
                addClipStart={() => {}}
                addClipEnd={() => {}}
                addClipEnd5s={() => {}}
                hasMarkers={false}
                deleteAllMarkers={() => {}}
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
              />
            </div>
          </div>
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
                  <canvas
                    bind:this={page.canvasRef}
                    class="pdf-canvas"
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
              aria-label="Zoom out"
            >−</button>
            <span class="pdf-zoom-label">{Math.round(pdf.state.scale * 100)}%</span>
            <button
              class="pdf-zoom-btn"
              onclick={() => pdf.setScale(pdf.state.scale + 0.25)}
              disabled={pdf.state.scale >= 5}
              aria-label="Zoom in"
            >+</button>
            <button
              class="pdf-zoom-btn pdf-zoom-reset"
              onclick={() => pdf.setScale(1)}
              aria-label="Reset zoom"
            >Reset</button>
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

    {#if viewer.state.isFullscreen}
      <div
        class="fs-overlay"
        class:visible={viewer.state.fsControlsVisible || tsEditMenu.visible}
        role="button"
        tabindex="0"
        onwheel={handleViewerScroll}
        onmousedown={startPan}
        ontouchstart={(e) => {
          if (e.touches.length === 2) e.preventDefault();
        }}
        ontouchmove={viewer.handleTouchZoom}
        ontouchend={viewer.handleTouchEnd}
        style="cursor: {fsCursor}"
      >
        <div class="fs-topbar">
          <span class="fs-filename">{fileName}</span>
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
              {tsDragRange}
              {resumePoint}
              clipMarkerJustDragged={clips.clipMarkerJustDragged}
              {tsMarkerDragJustEnded}
              tsEditMenuVisible={tsEditMenu.visible}
              {startScrubbing}
              {getTimestampPct}
              {getDragRangeStyle}
              {startClipMarkerDrag}
              {removeClipBoundary}
              {showClipBoundaryTooltip}
              {hideTsTooltip}
              {seekToTimestamp}
              {openSegmentEditor}
              {startTimestampRangeDrag}
              {removeTimestamp}
              {showTimestampTooltip}
              {openTimestampEditor}
              {showResumeTooltip}
              {hideResumeTooltip}
              {seekToResumePoint}
              {removeResumePoint}
              {formatTime}
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
              toggleLoop={cycleLoopMode}
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
              addClipEnd5s={() => addClipBoundaryAt("end", rawCurrentSecs + 5)}
              hasMarkers={timestamps.length > 0 ||
                clips.clipBoundaries.length > 0}
              deleteAllMarkers={() => {
                clearAllTimestamps();
                clearAllSegments();
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
            />
          </div>
        {:else}
          <div class="fs-controls image-only">
            <div class="fs-controls-row">
              <div class="fs-right">
                <button
                  class="fs-ctrl-btn"
                  onclick={viewer.toggleFullscreen}
                  aria-label="exit fullscreen"
                  ><svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                    ><path
                      d="M4 1H1V4M8 1H11V4M11 8V11H8M4 11H1V8"
                      stroke="currentColor"
                      stroke-width="1.2"
                      stroke-linecap="round"
                    /></svg
                  ></button
                >
              </div>
            </div>
          </div>
        {/if}
        {#if fileList.length > 0}<button
            class="fs-file-count-pill tooltip-above"
            class:slideshow-active={slideshow.active}
            data-tooltip="File position"
            onclick={toggleThumbnailBar}
            >{currentIndex + 1} / {fileList.length}</button
          >{/if}
      </div>
    {/if}
  {/snippet}
</Shell>
