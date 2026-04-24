<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { open } from "@tauri-apps/plugin-dialog";
  import { createPlaybackActions } from "$lib/core/playback.svelte";
  import { createTimeline } from "$lib/core/timeline.svelte";
  import { createClips } from "$lib/core/clips.svelte";
  import { setupKeybinds } from "$lib/keybinds";

  import {
    IMAGE_EXTS,
    VIDEO_EXTS,
    ALL_EXTS,
    VOLUME_SEGMENTS,
    LOOP_MODES,
    type LoopMode,
  } from "$lib/constants";
  import type {
    CtxMenu,
    Timestamp,
    ClipBoundary,
    ClipPair,
    ClipJobResult,
    MediaProperties,
    TimestampDragRange,
  } from "$lib/types";

  import {
    loadVolume,
    saveVolume,
    loadDeleteNoAsk,
    saveDeleteNoAsk,
    loadClipPrefs,
    saveClipPrefs,
    writeTimestamps,
    eraseTimestamps,
    writeClipBoundaries,
    eraseClipBoundaries,
    saveResumePoint,
    eraseResumePoint,
    loadLoopMode,
    saveLoopMode,
  } from "$lib/services/storage";

  import {
    invokeProcessVideoClips,
    invokeDeleteFile,
    invokeTrashFile,
    invokeShowInExplorer,
    invokeOpenFolder,
    invokeOpenDirectory,
    invokeGetClipboardFilePath,
  } from "$lib/services/mediaTools";

  import {
    detectFfprobeAvailability,
    fetchMediaProperties,
    installFfmpegWithPolling,
  } from "$lib/services/mediaSources";

  import {
    computeContextMenuPosition,
    hideFloatingTooltip,
    showFloatingTooltip,
  } from "$lib/services/session";

  import {
    copyImageToClipboard,
    copyFrameToClipboard,
    copyPathToClipboard,
    copyAllPropertiesToClipboard,
  } from "$lib/services/clipboard";

  import { getParentFolder, getFileExt } from "$lib/services/files";
  import { createMedia } from "$lib/core/media.svelte";
  import { viewer } from "$lib/core/viewer.svelte";
  import AppMenu from "$lib/ui/appMenu.svelte";
  import MediaBar from "$lib/ui/mediaBar.svelte";
  import TimelineMarkers from "$lib/ui/timelineMarkers.svelte";
  import PlaybackControls from "$lib/ui/playbackControls.svelte";
  import Dialog from "$lib/ui/dialog.svelte";
  import Tooltip from "$lib/ui/tooltip.svelte";
  import EditMenu from "$lib/ui/editMenu.svelte";

  let filePath = $state("");
  let fileSrc = $state("");
  let fileName = $state("no file open");
  let isVideo = $state(false);
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

  $effect(() => {
    viewer.setVideoEl(videoEl);
  });

  const playback = createPlaybackActions(() => videoEl);
  const timeline = createTimeline();
  const clips = createClips();

  function setMediaState(
    data: Partial<import("$lib/core/media.svelte").MediaState>,
  ) {
    if (data.filePath !== undefined) filePath = data.filePath;
    if (data.fileSrc !== undefined) fileSrc = data.fileSrc;
    if (data.fileName !== undefined) fileName = data.fileName;
    if (data.isVideo !== undefined) isVideo = data.isVideo;
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
    if (data.imageRotation !== undefined) viewer.state.rotation = data.imageRotation;
    if (data.imageFlipped !== undefined) viewer.state.flipped = data.imageFlipped;
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
    if (data.clipBoundaries !== undefined) clipBoundaries = data.clipBoundaries;
    if (data.resumePoint !== undefined) resumePoint = data.resumePoint;
  }

  const media = createMedia(
    () => videoEl,
    () => volume,
    () => muted,
    () => loopMode === "loop",
    () => {
      clearTimeout(tsDragFadeTimer);
      clearTimestampDragRange();
      tsTooltip = { ...tsTooltip, visible: false };
      tsEditMenu = { ...tsEditMenu, visible: false };
      resetZoom();
    },
  );

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
  let volumeHovered = $state(false);
  let speedHovered = $state(false);
  let playbackSpeed = $state(1);
  let volumeTooltipX = $state(0);
  let volumeTooltipY = $state(0);
  let volumeTooltipVisible = $state(false);
  let speedTooltipX = $state(0);
  let speedTooltipY = $state(0);
  let speedTooltipVisible = $state(false);
  let hoverZone = $state("none");
  let dragStart = $state({ x: 0, y: 0, tx: 0, ty: 0 });
  let lastLeftClickTime = 0;
  let pendingPlay: ReturnType<typeof setTimeout> | undefined;

  let contextMenu = $state<CtxMenu>({ x: 0, y: 0, visible: false });
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(false);
  let propertiesOpen = $state(false);
  let editMenuVisible = $state(false);

  let resumePoint = $state<number | null>(null);
  let resumeTooltipVisible = $state(false);
  let timestamps = $state<Timestamp[]>([]);

  let clipBoundaries = $state<ClipBoundary[]>([]);
  let clipOutputDir = $state("");
  let clipDeleteOriginal = $state(false);
  let clipUseCustomPath = $state(false);
  let clipMergeSegments = $state(false);
  let clipJobRunning = $state(false);
  let clipJobLabel = $state("");
  let clipDeleteConfirm = $state<{
    visible: boolean;
    mode: "separate" | "merge" | null;
  }>({
    visible: false,
    mode: null,
  });
  let clipToast = $state<{
    visible: boolean;
    tone: "success" | "error";
    message: string;
    outputDir: string;
  }>({ visible: false, tone: "success", message: "", outputDir: "" });
  let clipToastTimer: ReturnType<typeof setTimeout> | undefined;
  let clipMarkerJustDragged = $state(false);
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
    tone?: "yellow" | "blue" | "green";
  }>({
    visible: false,
    x: 0,
    y: 0,
    title: "",
    timeLabel: "",
    tone: "yellow",
  });
  let tsEditMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    targetId: string;
    targetType: "timestamp" | "segment";
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetId: "",
    targetType: "timestamp",
  });
  let tsDragRange = $state<TimestampDragRange>({
    visible: false,
    start: 0,
    end: 0,
    phase: "idle",
  });
  let tsDragHoverTimestampId = $state<string | null>(null);
  let tsDragHoverBoundaryId = $state<string | null>(null);
  let tsMarkerDragJustEnded = $state(false);
  let tsDragFadeTimer: ReturnType<typeof setTimeout> | undefined;
  let frameCopyToast = $state<{
    visible: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({
    visible: false,
    message: "",
    tone: "success",
  });
  let frameCopyToastTimer: ReturnType<typeof setTimeout> | undefined;

  const isQuarterTurn = $derived(Math.abs(viewer.state.rotation % 180) === 90);
  const rotationFitScale = $derived.by(() => {
    if (!isQuarterTurn || imageNaturalWidth <= 0 || imageNaturalHeight <= 0)
      return 1;
    const ratio = imageNaturalWidth / imageNaturalHeight;
    return Math.min(ratio, 1 / ratio);
  });
  const imageScale = $derived(
    (viewer.state.zoomLevel / 100) * rotationFitScale,
  );
  const imageStyle = $derived(
    `transform: scale(${imageScale}) translate(${viewer.state.translateX / imageScale}px, ${viewer.state.translateY / imageScale}px) rotate(${viewer.state.rotation}deg) scaleX(${viewer.state.flipped ? -1 : 1}); transform-origin: center center; max-width: 100%; max-height: 100%; object-fit: contain; display: block;`,
  );
  const videoWrapperTransform = $derived(viewer.getVideoWrapperTransform());
  const videoInnerTransform = $derived(viewer.getVideoInnerTransform());
  const panCursor = $derived(viewer.getPanCursor());
  const fsCursor = $derived(
    !viewer.state.fsControlsVisible && !tsEditMenu.visible ? "none" : panCursor,
  );
  const isGifVideo = $derived(isVideo && fileExt() === "gif");
  const clipPairs = $derived.by(() => {
    return clips.computePairs(clipBoundaries);
  });
  const clipCount = $derived(clipPairs.length);

  function toggleFullscreen() {
    viewer.toggleFullscreen();
  }

  function resetZoom() {
    viewer.resetZoom();
  }

  function handleViewerScroll(e: WheelEvent) {
    viewer.handleViewerScroll(e, fileSrc);
  }

  function currentTimeDisplay(): string {
    if (!timerShowRemaining) return formatTime(rawCurrentSecs);
    const rem = rawDurationSecs - rawCurrentSecs;
    return `-${formatTime(rem)}`;
  }
  const durationDisplay = $derived(formatTime(rawDurationSecs));
  const timerTooltip = $derived(timerShowRemaining ? "Remaining" : "Elapsed");

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function showFrameCopyToast(
    message: string,
    tone: "success" | "error" | "info",
  ) {
    clearTimeout(frameCopyToastTimer);
    frameCopyToast = { visible: true, message, tone };
    frameCopyToastTimer = setTimeout(() => {
      frameCopyToast = { ...frameCopyToast, visible: false };
    }, 2200);
  }

  function updateProgress() {
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
  }

  function toggleTimer() {
    timerShowRemaining = !timerShowRemaining;
  }

  function startScrubbing(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!videoEl) return;

    const bar = e.currentTarget as HTMLElement;
    const wasPlaying = !videoEl.paused;
    videoEl.pause();

    function scrubTo(clientX: number) {
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      videoEl!.currentTime = ratio * videoEl!.duration;
      rawCurrentSecs = videoEl!.currentTime;
      progress = ratio * 100;
    }

    scrubTo(e.clientX);

    let lastScrub = 0;
    function onMouseMove(ev: MouseEvent) {
      const now = Date.now();
      if (now - lastScrub < 60) return;
      lastScrub = now;
      scrubTo(ev.clientX);
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (wasPlaying) videoEl!.play();
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

  function handleVolumeScroll(e: WheelEvent) {
    e.preventDefault();
    setVolume(volume + (e.deltaY > 0 ? -0.125 : 0.125));
  }

  function startVolumeDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const diamonds = (e.currentTarget as HTMLElement).querySelectorAll(
      ".volume-diamond",
    );

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - first.left) / (last.right - first.left)),
      );
      setVolume(Math.ceil(ratio * VOLUME_SEGMENTS) / VOLUME_SEGMENTS);
      volumeTooltipX = clientX;
      volumeTooltipY = clientY;
      volumeTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      dragTo(ev.clientX, ev.clientY);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      volumeTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleVolumeDiamondHover(e: MouseEvent) {
    volumeTooltipX = e.clientX;
    volumeTooltipY = e.clientY;
    volumeTooltipVisible = true;
  }

  function showVolumeOverlay() {
    volumeHovered = true;
  }

  function handleVolumeAreaLeave() {
    volumeTooltipVisible = false;
    volumeHovered = false;
  }

  function setPlaybackSpeed(val: number) {
    playbackSpeed = val;
    if (videoEl) videoEl.playbackRate = val;
  }

  function showSpeedOverlay() {
    speedHovered = true;
  }

  function handleSpeedAreaLeave() {
    speedTooltipVisible = false;
    speedHovered = false;
  }

  function handleSpeedDiamondHover(e: MouseEvent) {
    speedTooltipX = e.clientX;
    speedTooltipY = e.clientY;
    speedTooltipVisible = true;
  }

  function startSpeedDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const diamonds = (e.currentTarget as HTMLElement).querySelectorAll(
      ".speed-diamond",
    );

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - first.left) / (last.right - first.left)),
      );
      const idx = Math.round(ratio * (steps.length - 1));
      setPlaybackSpeed(steps[idx]);
      speedTooltipX = clientX;
      speedTooltipY = clientY;
      speedTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      dragTo(ev.clientX, ev.clientY);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      speedTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleSpeedScroll(e: WheelEvent) {
    e.preventDefault();
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    const cur = steps.reduce((a, b) =>
      Math.abs(b - playbackSpeed) < Math.abs(a - playbackSpeed) ? b : a,
    );
    const idx = steps.indexOf(cur);
    const next =
      e.deltaY > 0 ? Math.max(0, idx - 1) : Math.min(steps.length - 1, idx + 1);
    setPlaybackSpeed(steps[next]);
  }

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
    eraseTimestamps(filePath);
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

  function updateClipBoundaryTitle(id: string, title: string) {
    clips.updateBoundaryTitle(
      id,
      title,
      clipBoundaries,
      (v) => (clipBoundaries = v),
    );
    saveClipBoundaries();
  }

  function getTimestampById(id: string): Timestamp | undefined {
    return timeline.getTimestampById(id, timestamps);
  }

  function getClipBoundaryById(id: string): ClipBoundary | undefined {
    return clips.getBoundaryById(id, clipBoundaries);
  }

  function getTitleEditorWidthCh(title: string): number {
    return Math.min(26, Math.max(10, (title || "").trim().length + 2));
  }

  function showTimestampTooltip(e: MouseEvent, ts: Timestamp) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: ts.title?.trim() || "",
      timeLabel: formatTime(ts.time),
      tone: "yellow",
    };
  }

  function openTimestampEditor(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const ts = getTimestampById(id);
    if (!ts) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      targetId: id,
      targetType: "timestamp",
    };
  }

  function openSegmentEditor(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const marker = getClipBoundaryById(id);
    if (!marker) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      targetId: id,
      targetType: "segment",
    };
  }

  function closeTimestampEditor() {
    tsEditMenu = { ...tsEditMenu, visible: false };
  }

  function convertTimestampToBoundary(
    id: string,
    kind: "start" | "end",
    keepEditorOpen: boolean = false,
  ): string | null {
    const ts = getTimestampById(id);
    if (!ts) return null;
    let boundaryId = "";
    const existing = clipBoundaries.find(
      (m) => m.kind === kind && Math.abs(m.time - ts.time) < 0.25,
    );
    if (!existing) {
      boundaryId = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      clipBoundaries = [
        ...clipBoundaries,
        {
          id: boundaryId,
          time: ts.time,
          kind,
          title: ts.title || "",
        },
      ].sort((a, b) => a.time - b.time);
      saveClipBoundaries();
    } else if (!existing.title && ts.title) {
      boundaryId = existing.id;
      updateClipBoundaryTitle(existing.id, ts.title);
    } else {
      boundaryId = existing.id;
    }
    timestamps = timestamps.filter((m) => m.id !== id);
    saveTimestamps();
    if (keepEditorOpen && boundaryId) {
      tsEditMenu = {
        ...tsEditMenu,
        visible: true,
        targetType: "segment",
        targetId: boundaryId,
      };
    } else {
      closeTimestampEditor();
    }
    return boundaryId;
  }

  function convertTimestampPairToSegment(aId: string, bId: string) {
    if (aId === bId) return;
    const a = getTimestampById(aId);
    const b = getTimestampById(bId);
    if (!a || !b) return;
    const [left, right] = a.time <= b.time ? [a, b] : [b, a];
    const next = [...clipBoundaries];
    const existingStart = next.find(
      (m) => m.kind === "start" && Math.abs(m.time - left.time) < 0.25,
    );
    if (!existingStart) {
      next.push({
        id: `start-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: left.time,
        kind: "start",
        title: left.title || "",
      });
    } else if (!existingStart.title && left.title) {
      existingStart.title = left.title;
    }
    const existingEnd = next.find(
      (m) => m.kind === "end" && Math.abs(m.time - right.time) < 0.25,
    );
    if (!existingEnd) {
      next.push({
        id: `end-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: right.time,
        kind: "end",
        title: right.title || "",
      });
    } else if (!existingEnd.title && right.title) {
      existingEnd.title = right.title;
    }
    clipBoundaries = next.sort((x, y) => x.time - y.time);
    saveClipBoundaries();
    timestamps = timestamps.filter(
      (ts) => ts.id !== left.id && ts.id !== right.id,
    );
    saveTimestamps();
    closeTimestampEditor();
  }

  function clearAllSegments() {
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
    clips.clearBoundaries((v) => (clipBoundaries = v));
    eraseClipBoundaries(filePath);
  }

  function showClipBoundaryTooltip(e: MouseEvent, marker: ClipBoundary) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: marker.title?.trim() || "",
      timeLabel: formatTime(marker.time),
      tone: "blue",
    };
  }

  function showResumeTooltip(e: MouseEvent) {
    if (resumePoint === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tsTooltip = {
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      title: "Resume",
      timeLabel: formatTime(resumePoint),
      tone: "green",
    };
    resumeTooltipVisible = true;
  }

  function hideResumeTooltip() {
    tsTooltip = { ...tsTooltip, visible: false };
    resumeTooltipVisible = false;
  }

  function hideTsTooltip() {
    tsTooltip = { ...tsTooltip, visible: false };
  }

  function setClipBoundaryKind(id: string, kind: "start" | "end") {
    const marker = getClipBoundaryById(id);
    if (!marker || marker.kind === kind) return;
    clips.setBoundaryKind(
      id,
      kind,
      clipBoundaries,
      (v) => (clipBoundaries = v),
    );
    saveClipBoundaries();
  }

  function getActiveEditorTimestamp(): Timestamp | undefined {
    if (!tsEditMenu.visible || tsEditMenu.targetType !== "timestamp")
      return undefined;
    return getTimestampById(tsEditMenu.targetId);
  }

  function getActiveEditorSegment(): ClipBoundary | undefined {
    if (!tsEditMenu.visible || tsEditMenu.targetType !== "segment")
      return undefined;
    return getClipBoundaryById(tsEditMenu.targetId);
  }

  function getEditorTitle(): string {
    const ts = getActiveEditorTimestamp();
    if (ts) return ts.title || "";
    const seg = getActiveEditorSegment();
    if (seg) return seg.title || "";
    return "";
  }

  function updateEditorTitle(value: string) {
    const ts = getActiveEditorTimestamp();
    if (ts) {
      updateTimestampTitle(ts.id, value);
      return;
    }
    const seg = getActiveEditorSegment();
    if (seg) {
      updateClipBoundaryTitle(seg.id, value);
    }
  }

  function onEditorScissor(kind: "start" | "end") {
    const ts = getActiveEditorTimestamp();
    if (ts) {
      convertTimestampToBoundary(ts.id, kind, true);
      return;
    }
    const seg = getActiveEditorSegment();
    if (seg) {
      setClipBoundaryKind(seg.id, kind);
    }
  }

  function onEditorDeleteTimestamp() {
    const ts = getActiveEditorTimestamp();
    if (!ts) return;
    removeTimestamp(ts.id);
  }

  function onEditorDeleteSegment() {
    const seg = getActiveEditorSegment();
    if (!seg) return;
    removeClipBoundary(seg.id);
  }

  function getTimestampTouchTarget(
    currentTime: number,
    threshold: number,
    sourceId: string,
  ): string | null {
    const found = timeline.findTouchTarget(timestamps, currentTime, threshold);
    if (!found || found.id === sourceId) return null;
    return found.id;
  }

  function getBoundaryTouchTarget(
    currentTime: number,
    threshold: number,
  ): string | null {
    return (
      clips.findTouchTarget(clipBoundaries, currentTime, threshold)?.id ?? null
    );
  }

  function clearTimestampDragRange() {
    clearTimeout(tsDragFadeTimer);
    tsDragRange = { visible: false, start: 0, end: 0, phase: "idle" };
    tsDragHoverTimestampId = null;
    tsDragHoverBoundaryId = null;
  }

  function startTimestampRangeDrag(e: MouseEvent, id: string) {
    if (e.button !== 0 || rawDurationSecs <= 0) return;
    const source = getTimestampById(id);
    if (!source) return;
    const sourceTs = source;
    e.preventDefault();
    e.stopPropagation();

    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest(
      ".progress-bar, .fs-progress",
    ) as HTMLElement | null;
    if (!bar) return;
    const barEl = bar;
    closeTimestampEditor();
    tsTooltip = { ...tsTooltip, visible: false };
    clearTimeout(tsDragFadeTimer);

    tsDragHoverTimestampId = null;
    tsDragHoverBoundaryId = null;
    tsDragRange = {
      visible: true,
      start: sourceTs.time,
      end: sourceTs.time,
      phase: "dragging",
    };

    let moved = false;

    function update(clientX: number) {
      const rect = barEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const time = ratio * rawDurationSecs;
      moved = moved || Math.abs(time - sourceTs.time) > 0.02;
      tsDragRange = {
        visible: true,
        start: Math.min(sourceTs.time, time),
        end: Math.max(sourceTs.time, time),
        phase: "dragging",
      };
      const touchThreshold = Math.max(0.08, (rawDurationSecs / rect.width) * 7);
      tsDragHoverTimestampId = getTimestampTouchTarget(
        time,
        touchThreshold,
        sourceTs.id,
      );
      tsDragHoverBoundaryId = getBoundaryTouchTarget(time, touchThreshold);
    }

    function onMove(ev: MouseEvent) {
      update(ev.clientX);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      if (moved) {
        tsMarkerDragJustEnded = true;
        setTimeout(() => {
          tsMarkerDragJustEnded = false;
        }, 0);
      }

      const targetTsId = tsDragHoverTimestampId;
      if (moved && targetTsId && sourceTs.id !== targetTsId) {
        const target = getTimestampById(targetTsId);
        if (target) {
          tsDragRange = {
            visible: true,
            start: Math.min(sourceTs.time, target.time),
            end: Math.max(sourceTs.time, target.time),
            phase: "converting",
          };
          convertTimestampPairToSegment(sourceTs.id, targetTsId);
          tsDragFadeTimer = setTimeout(() => {
            clearTimestampDragRange();
          }, 260);
          return;
        }
      }

      const targetBoundaryId = tsDragHoverBoundaryId;
      if (moved && targetBoundaryId) {
        const boundary = getClipBoundaryById(targetBoundaryId);
        if (boundary) {
          tsDragRange = {
            visible: true,
            start: Math.min(sourceTs.time, boundary.time),
            end: Math.max(sourceTs.time, boundary.time),
            phase: "converting",
          };
          convertTimestampToBoundary(sourceTs.id, boundary.kind);
          tsDragFadeTimer = setTimeout(() => {
            clearTimestampDragRange();
          }, 260);
          return;
        }
      }

      if (tsDragRange.visible) {
        tsDragRange = { ...tsDragRange, phase: "fading" };
        tsDragFadeTimer = setTimeout(() => {
          clearTimestampDragRange();
        }, 140);
      } else {
        clearTimestampDragRange();
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function getDragRangeStyle() {
    const startPct = timeline.getTimestampPct(
      tsDragRange.start,
      rawDurationSecs,
    );
    const endPct = timeline.getTimestampPct(tsDragRange.end, rawDurationSecs);
    return `left: ${startPct}%; width: ${Math.max(0, endPct - startPct)}%;`;
  }

  function seekToTimestamp(time: number) {
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, time);
  }

  function getTimestampPct(time: number): number {
    return timeline.getTimestampPct(time, rawDurationSecs);
  }

  function removeResumePoint() {
    tsTooltip = { ...tsTooltip, visible: false };
    resumeTooltipVisible = false;
    resumePoint = null;
    eraseResumePoint(filePath);
  }

  function seekToResumePoint() {
    if (videoEl && resumePoint !== null) {
      videoEl.currentTime = resumePoint;
    }
  }

  function saveClipBoundaries() {
    writeClipBoundaries(filePath, clipBoundaries);
  }

  function addClipBoundary(kind: "start" | "end") {
    if (!videoEl || rawDurationSecs <= 0) return;

    const time = Math.max(0, Math.min(videoEl.currentTime, rawDurationSecs));

    clips.addClipBoundary(kind, time, clipBoundaries, (v) => {
      clipBoundaries = v;
    });

    saveClipBoundaries();
  }

  function addClipBoundaryAt(kind: "start" | "end", time: number) {
    if (rawDurationSecs <= 0) return;
    const clamped = Math.max(0, Math.min(time, rawDurationSecs));
    clips.addClipBoundary(kind, clamped, clipBoundaries, (v) => {
      clipBoundaries = v;
    });
    saveClipBoundaries();
  }

  function startClipMarkerDrag(e: MouseEvent, id: string) {
    if (e.button !== 0 || rawDurationSecs <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest(
      ".progress-bar, .fs-progress",
    ) as HTMLElement | null;
    if (!bar) return;
    const barEl = bar;

    let moved = false;

    function update(clientX: number, clientY: number) {
      const rect = barEl.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const time = ratio * rawDurationSecs;
      clipBoundaries = clipBoundaries
        .map((m) => (m.id === id ? { ...m, time } : m))
        .sort((a, b) => a.time - b.time);
      const marker = clipBoundaries.find((m) => m.id === id);
      if (marker) {
        tsTooltip = {
          visible: true,
          x: clientX,
          y: clientY - 10,
          title: marker.title?.trim() || "",
          timeLabel: formatTime(marker.time),
          tone: "blue",
        };
      }
    }

    function onMove(ev: MouseEvent) {
      moved = true;
      update(ev.clientX, ev.clientY);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      tsTooltip = { ...tsTooltip, visible: false };
      if (moved) {
        clipMarkerJustDragged = true;
        saveClipBoundaries();
        setTimeout(() => {
          clipMarkerJustDragged = false;
        }, 0);
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function removeClipBoundary(id: string) {
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };

    clips.removeClipBoundary(id, clipBoundaries, (v) => {
      clipBoundaries = v;
    });

    saveClipBoundaries();
  }

  function persistClipPrefs() {
    saveClipPrefs({
      deleteOriginal: clipDeleteOriginal,
      useCustomPath: clipUseCustomPath,
      mergeSegments: clipMergeSegments,
    });
  }

  function getClipTargetDir(): string {
    return clipUseCustomPath ? clipOutputDir || parentFolder() : parentFolder();
  }

  function showClipToast(
    message: string,
    tone: "success" | "error",
    outputDir: string = clipOutputDir || parentFolder(),
  ) {
    clearTimeout(clipToastTimer);
    clipToast = { visible: true, tone, message, outputDir };
    clipToastTimer = setTimeout(() => {
      clipToast = { ...clipToast, visible: false };
    }, 4200);
  }

  function sanitizeClipPairs(): { start: number; end: number }[] {
    return clipPairs.map((p) => ({ start: p.start, end: p.end }));
  }

  function extractInvokeErrorMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === "string" && e.trim()) return e;
    if (e && typeof e === "object") {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    try {
      const asJson = JSON.stringify(e);
      if (asJson && asJson !== "{}") return asJson;
    } catch {}
    return "Failed to create clips.";
  }

  async function runClipAction(mode: "separate" | "merge") {
    if (!isVideo || clipCount === 0 || clipJobRunning) return;
    clipJobRunning = true;
    clipJobLabel =
      mode === "separate" ? "Separating clips..." : "Merging clips...";
    try {
      const result = await invokeProcessVideoClips(
        filePath,
        getClipTargetDir(),
        sanitizeClipPairs(),
        mode,
        clipDeleteOriginal,
      );
      const count = result.outputs.length;
      const noun = count === 1 ? "clip" : "clips";
      const msg =
        mode === "merge"
          ? `${count} ${noun} created${result.deleted_original ? " and original file deleted" : ""}.`
          : `${count} ${noun} created${result.deleted_original ? " and original file deleted" : ""}.`;
      showClipToast(
        msg,
        "success",
        result.output_dir || clipOutputDir || parentFolder(),
      );
      clipBoundaries = [];
      saveClipBoundaries();
      if (result.deleted_original) {
        const deletedPath = filePath;
        const prevList = [...fileList];
        const prevIndex = currentIndex;
        closeFile();
        const remaining = prevList.filter((p) => p !== deletedPath);
        if (remaining.length > 0) {
          const nextIndex = Math.max(
            0,
            Math.min(prevIndex, remaining.length - 1),
          );
          loadFile(remaining[nextIndex]);
        }
      } else {
        await displayFile(filePath);
      }
    } catch (e) {
      const msg = extractInvokeErrorMessage(e);
      showClipToast(msg, "error");
    } finally {
      clipJobRunning = false;
      clipJobLabel = "";
      clipDeleteConfirm = { visible: false, mode: null };
    }
  }

  function requestClipAction(mode: "separate" | "merge") {
    if (clipDeleteOriginal) {
      clipDeleteConfirm = { visible: true, mode };
      return;
    }
    runClipAction(mode);
  }

  async function toggleClipPathSelection() {
    if (clipUseCustomPath) {
      clipUseCustomPath = false;
      persistClipPrefs();
      return;
    }
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: clipOutputDir || parentFolder() || undefined,
    });
    if (!selected) {
      clipUseCustomPath = false;
      persistClipPrefs();
      return;
    }
    clipOutputDir = selected as string;
    saveClipPrefs({ outputDir: clipOutputDir });
    clipUseCustomPath = true;
    persistClipPrefs();
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
    requestClipAction(clipMergeSegments ? "merge" : "separate");
  }

  async function displayFile(path: string) {
    await media.displayFile(path, setMediaState);
  }

  function onImageLoad(e: Event) {
    media.onImageLoad(e, isLoadingFile, setMediaState, () =>
      media.finishLoading(setMediaState),
    );
  }

  function onVideoLoad() {
    media.onVideoLoad(isLoadingFile, setMediaState, () =>
      media.finishLoading(setMediaState),
    );
  }

  async function loadFile(path: string) {
    await media.loadFile(path, setMediaState, (list, index) => {
      fileList = list;
      currentIndex = index;
    });
  }

  function navigate(direction: number) {
    currentIndex = media.navigate(
      direction,
      fileList,
      currentIndex,
      setMediaState,
    );
  }

  function navigateToEdge(first: boolean) {
    currentIndex = media.navigateToEdge(first, fileList, setMediaState);
  }

  function closeFile() {
    resumeTooltipVisible = false;
    viewer.state.rotation = 0;
    viewer.state.flipped = false;
    media.closeFile(setMediaState);
  }

  async function minimizeWindow() {
    await getCurrentWindow().minimize();
  }
  async function maximizeWindow() {
    await getCurrentWindow().toggleMaximize();
  }
  async function closeWindow() {
    await getCurrentWindow().close();
  }

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
      if (viewer.state.zoomLevel > 100) {
        viewer.setTranslation(dragStart.tx + dx, dragStart.ty + dy);
      }
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

  const configuredKeydown = setupKeybinds({
    areDialogsOpen: () =>
      contextMenu.visible || deleteConfirm || propertiesOpen || editMenuVisible,
    closeDialogs: () => {
      contextMenu.visible = false;
      deleteConfirm = false;
      propertiesOpen = false;
      editMenuVisible = false;
    },
    navigateToEdge,
    navigate,
    toggleFullscreen,
    setVolume,
    getVolume: () => volume,
    isVideo: () => isVideo,
    getVideoEl: () => videoEl,
    getHoverZone: () => hoverZone,
    isFullscreen: () => viewer.state.isFullscreen,
    togglePlay,
  });

  function handleKeydown(e: KeyboardEvent) {
    configuredKeydown(e);
  }

  async function openFileDialog() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Media", extensions: [...IMAGE_EXTS, ...VIDEO_EXTS] }],
    });
    if (selected) loadFile(selected as string);
  }

  function openContextMenu(e: MouseEvent) {
    if (!fileSrc) return;
    e.preventDefault();
    e.stopPropagation();
    const menuW = 200;
    const menuH = isVideo ? 300 : 260;
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

  function openEditMenu() {
    closeContextMenu();
    editMenuVisible = true;
  }

  function closeEditMenu() {
    editMenuVisible = false;
  }

  function fileExt(): string {
    return getFileExt(filePath);
  }

  function parentFolder(): string {
    return getParentFolder(filePath);
  }

  function showValue(v: string | undefined): string {
    return v && v.trim() ? v : "Unknown";
  }

  async function loadMediaProperties() {
    mediaPropsLoading = true;
    mediaProps = await fetchMediaProperties(filePath);
    mediaPropsLoading = false;
  }

  async function refreshFfprobeAvailability() {
    ffprobeChecked = false;
    ffprobeAvailable = await detectFfprobeAvailability();
    ffprobeChecked = true;
  }

  async function installFfmpegAndWait() {
    ffmpegInstallError = "";
    ffmpegInstalling = true;
    const result = await installFfmpegWithPolling();
    ffprobeAvailable = result.available;
    ffprobeChecked = true;
    ffmpegInstallError = result.error;
    if (result.available) {
      ffmpegInstallError = "";
      await loadMediaProperties();
    }
    ffmpegInstalling = false;
  }

  async function ctxCopyImage() {
    closeContextMenu();
    try {
      await copyImageToClipboard(fileSrc);
    } catch {}
  }

  async function ctxCopyFrame() {
    closeContextMenu();
    if (!videoEl) return;
    try {
      await copyFrameToClipboard(videoEl);
      showFrameCopyToast("Current frame copied as PNG.", "success");
    } catch (err) {
      console.error("Failed to copy current frame to clipboard:", err);
      const message =
        err instanceof DOMException && err.name === "SecurityError"
          ? "Frame copy blocked by canvas security (cross-origin source)."
          : err instanceof Error
            ? err.message
            : "Could not copy frame to clipboard.";
      showFrameCopyToast(message, "error");
    }
  }

  async function ctxCopyPath() {
    closeContextMenu();
    try {
      await copyPathToClipboard(filePath);
      showFrameCopyToast("Copied file path.", "success");
    } catch {
      showFrameCopyToast("Failed to copy file path.", "error");
    }
  }
  function ctxRotate() {
    closeContextMenu();
    viewer.rotate();
  }
  function ctxFlip() {
    closeContextMenu();
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

  async function ctxShowInExplorer() {
    closeContextMenu();
    try {
      await invokeShowInExplorer(filePath);
    } catch {}
  }

  function ctxEdit() {
    openEditMenu();
  }

  function ctxConvert() {
    closeContextMenu();
  }

  function ctxProperties() {
    closeContextMenu();
    propertiesOpen = true;
    mediaProps = null;
    ffmpegInstallError = "";
    void (async () => {
      await refreshFfprobeAvailability();
      if (ffprobeAvailable) await loadMediaProperties();
    })();
  }

  async function propsCopyPath() {
    try {
      await copyPathToClipboard(filePath);
      showFrameCopyToast("Copied file path.", "info");
    } catch {
      showFrameCopyToast("Failed to copy file path.", "error");
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
        fileExt(),
        fileDimensions,
        fileSize,
        fileCreated,
        fileModified,
        durationDisplay,
        parentFolder(),
        mediaProps,
      );
      showFrameCopyToast("Copied properties.", "info");
    } catch {
      showFrameCopyToast("Failed to copy properties.", "error");
    }
  }

  function ctxDelete() {
    closeContextMenu();
    const noAsk = loadDeleteNoAsk();
    if (noAsk) performDelete();
    else deleteConfirm = true;
  }

  async function performDelete() {
    deleteConfirm = false;
    if (deleteNoAsk) saveDeleteNoAsk();
    const pathToDelete = filePath;
    const prevList = [...fileList];
    const prevIndex = currentIndex;
    closeFile();
    try {
      if (deletePermanently) await invokeDeleteFile(pathToDelete);
      else await invokeTrashFile(pathToDelete);
      showFrameCopyToast(
        deletePermanently
          ? "File deleted permanently."
          : "File moved to trash.",
        "error",
      );
    } catch {
      showFrameCopyToast("Failed to delete file.", "error");
    }
    const remaining = prevList.filter((p) => p !== pathToDelete);
    if (remaining.length > 0) {
      const nextIndex = Math.min(prevIndex, remaining.length - 1);
      loadFile(remaining[nextIndex]);
    }
  }

  function showFilenameTooltip(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    showFloatingTooltip(
      "filename-tooltip",
      el.getBoundingClientRect(),
      "File name",
    );
  }

  function hideFilenameTooltip() {
    hideFloatingTooltip("filename-tooltip");
  }

  function handleGlobalMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (contextMenu.visible && !target.closest(".context-menu"))
      closeContextMenu();
    if (editMenuVisible && !target.closest(".edit-menu"))
      closeEditMenu();
    if (
      tsEditMenu.visible &&
      !target.closest(".ts-edit-menu") &&
      !target.closest(".ts-marker") &&
      !target.closest(".clip-marker") &&
      !target.closest(".fs-clip-marker")
    ) {
      closeTimestampEditor();
    }
  }

  onMount(() => {
    const initial = (window as any).__INITIAL_FILE__;
    if (initial) loadFile(initial);

    volume = loadVolume();
    loopMode = (loadLoopMode() as LoopMode) ?? "loop";
    const prefs = loadClipPrefs();
    clipOutputDir = prefs.outputDir;
    clipDeleteOriginal = prefs.deleteOriginal;
    clipUseCustomPath = prefs.useCustomPath;
    clipMergeSegments = prefs.mergeSegments;

    window.addEventListener("beforeunload", () => {
      if (isVideo && filePath && rawCurrentSecs > 0 && rawDurationSecs > 0) {
        const nearEnd = rawCurrentSecs >= rawDurationSecs - 1.5;
        if (!nearEnd) {
          saveResumePoint(filePath, rawCurrentSecs);
        } else {
          eraseResumePoint(filePath);
        }
      }
    });

    getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop" && event.payload.paths?.length > 0)
        loadFile(event.payload.paths[0]);
    });

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("mousedown", handleGlobalMouseDown);

    async function handlePaste(e: ClipboardEvent) {
      const imageItem = Array.from(e.clipboardData?.items ?? []).find(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          try {
            const { tempDir } = await import("@tauri-apps/api/path");
            const { writeFile } = await import("@tauri-apps/plugin-fs");
            const tmp = await tempDir();
            const dest = `${tmp}vyu-paste-${Date.now()}.${ext}`;
            await writeFile(dest, uint8);
            await loadFile(dest);
          } catch (err) {
            console.error("Failed to paste image:", err);
          }
        }
        return;
      }

      try {
        const clipboardFile = await invokeGetClipboardFilePath();
        if (clipboardFile) {
          const ext = clipboardFile.split(".").pop()?.toLowerCase() ?? "";
          if ([...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext)) {
            await loadFile(clipboardFile);
            return;
          }
        }
      } catch {}

      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text) {
        const lines = text.split(/\r?\n/).map((l) =>
          l
            .trim()
            .replace(/^file:\/\/\//, "")
            .replace(/^file:\/\//, "")
            .replace(/%20/g, " "),
        );
        const match = lines.find((l) => {
          const ext = l.split(".").pop()?.toLowerCase() ?? "";
          return [...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext);
        });
        if (match) {
          await loadFile(match);
        }
      }
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("mousedown", handleGlobalMouseDown);
      window.removeEventListener("paste", handlePaste);
      clearTimeout(frameCopyToastTimer);
      clearTimeout(clipToastTimer);
      clearTimeout(tsDragFadeTimer);
    };
  });
</script>

<main
  class:fullscreen={viewer.state.isFullscreen}
  onmousemove={viewer.state.isFullscreen ? viewer.resetFsTimer : undefined}
  ondrop={(e) => e.preventDefault()}
  ondragover={(e) => e.preventDefault()}
  oncontextmenu={openContextMenu}
>
  <AppMenu
    {fileName}
    {fileSrc}
    {filePath}
    onRenamed={async (newPath) => {
      await loadFile(newPath);
    }}
    {startDrag}
    {showFilenameTooltip}
    {hideFilenameTooltip}
    {closeFile}
    {openFileDialog}
    {minimizeWindow}
    {maximizeWindow}
    {closeWindow}
  />

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
      onmouseenter={() => (hoverZone = isVideo ? "video" : "sidebar")}
      onmouseleave={() => (hoverZone = "none")}
      onwheel={handleViewerScroll}
      onmousedown={!isVideo ? startPan : undefined}
      ontouchstart={(e) => {
        if (e.touches.length === 2) e.preventDefault();
      }}
      ontouchmove={viewer.handleTouchZoom}
      ontouchend={viewer.handleTouchEnd}
      style="cursor: {!isVideo ? panCursor : 'default'}"
      role="presentation"
    >
      {#if fileSrc && !isVideo}
        <img
          src={fileSrc}
          alt={fileName}
          onload={onImageLoad}
          style={imageStyle}
        />
      {:else if fileSrc && isVideo}
        <div
          class="video-wrapper"
          role="presentation"
          onmouseenter={() => (hoverZone = "video")}
          onmouseleave={() => (hoverZone = "none")}
          onmousedown={startPan}
          style="{videoWrapperTransform} cursor: {panCursor}"
        >
          <div class="video-inner" style={videoInnerTransform}>
            <video
              bind:this={videoEl}
              src={fileSrc}
              crossorigin="anonymous"
              autoplay
              ontimeupdate={updateProgress}
              onloadedmetadata={onVideoLoad}
              onended={() => {
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
              <track kind="captions" />
            </video>
          </div>
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
              {clipPairs}
              {clipBoundaries}
              {timestamps}
              {tsDragRange}
              {resumePoint}
              {clipMarkerJustDragged}
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
              {volumeHovered}
              volumeSegments={VOLUME_SEGMENTS}
              {togglePlay}
              toggleLoop={cycleLoopMode}
              {toggleMute}
              {showVolumeOverlay}
              {handleVolumeAreaLeave}
              {handleVolumeScroll}
              {startVolumeDrag}
              {handleVolumeDiamondHover}
              {setVolume}
              {playbackSpeed}
              {speedHovered}
              {setPlaybackSpeed}
              {showSpeedOverlay}
              {handleSpeedAreaLeave}
              {handleSpeedScroll}
              {speedTooltipVisible}
              {speedTooltipX}
              {speedTooltipY}
              {handleSpeedDiamondHover}
              {startSpeedDrag}
              {addTimestamp}
              addClipStart={() => addClipBoundary("start")}
              addClipEnd={() => addClipBoundary("end")}
              addClipEnd5s={() => addClipBoundaryAt("end", rawCurrentSecs + 5)}
              hasMarkers={timestamps.length > 0 || clipBoundaries.length > 0}
              deleteAllMarkers={() => {
                clearAllTimestamps();
                clearAllSegments();
              }}
              {toggleTimer}
              {currentTimeDisplay}
              {durationDisplay}
              {timerTooltip}
              {toggleFullscreen}
            />
          </div>
        </div>
      {:else}
        <button class="empty" onclick={openFileDialog}>
          <span class="empty-icon">+</span>
          <span class="empty-text">open a file</span>
        </button>
      {/if}
    </div>

    <div
      class="sidebar right"
      onmouseenter={() => (hoverZone = "sidebar")}
      onmouseleave={() => (hoverZone = "none")}
      role="presentation"
    >
      <button class="nav-btn" onclick={() => navigate(1)} aria-label="next file"
        >›</button
      >
    </div>
  </div>

  <MediaBar
    fileListLength={fileList.length}
    {currentIndex}
    {fileDimensions}
    {fileSize}
    {fileInfoLoading}
    {fileName}
    {fileSrc}
    zoomLevel={viewer.state.zoomLevel}
    {resetZoom}
    {toggleFullscreen}
    {isVideo}
    {clipCount}
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
  />

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
          >
          <button
            class="fs-wc-btn"
            onclick={maximizeWindow}
            aria-label="maximize">▢</button
          >
          <button
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
            {clipPairs}
            {clipBoundaries}
            {timestamps}
            {tsDragRange}
            {resumePoint}
            {clipMarkerJustDragged}
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
            {volumeHovered}
            volumeSegments={VOLUME_SEGMENTS}
            {togglePlay}
            toggleLoop={cycleLoopMode}
            {toggleMute}
            {showVolumeOverlay}
            {handleVolumeAreaLeave}
            {handleVolumeScroll}
            {startVolumeDrag}
            {handleVolumeDiamondHover}
            {setVolume}
            {playbackSpeed}
            {speedHovered}
            {setPlaybackSpeed}
            {showSpeedOverlay}
            {handleSpeedAreaLeave}
            {handleSpeedScroll}
            {speedTooltipVisible}
            {speedTooltipX}
            {speedTooltipY}
            {handleSpeedDiamondHover}
            {startSpeedDrag}
            {addTimestamp}
            addClipStart={() => addClipBoundary("start")}
            addClipEnd={() => addClipBoundary("end")}
            addClipEnd5s={() => addClipBoundaryAt("end", rawCurrentSecs + 5)}
            hasMarkers={timestamps.length > 0 || clipBoundaries.length > 0}
            deleteAllMarkers={() => {
              clearAllTimestamps();
              clearAllSegments();
            }}
            {toggleTimer}
            {currentTimeDisplay}
            {durationDisplay}
            {timerTooltip}
            {toggleFullscreen}
          />
        </div>
      {:else}
        <div class="fs-controls image-only">
          <div class="fs-controls-row">
            <span class="fs-time"
              >{fileList.length > 0
                ? `${currentIndex + 1} / ${fileList.length}`
                : ""}</span
            >
            <div class="fs-right">
              <button
                class="fs-ctrl-btn"
                onclick={viewer.toggleFullscreen}
                aria-label="exit fullscreen"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  ><path
                    d="M4 1H1V4M8 1H11V4M11 8V11H8M4 11H1V8"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  /></svg
                >
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if isLoadingFile}
    <div class="border-sweep" class:fading={loadingFadingOut}></div>
  {/if}

  <Dialog
    {contextMenu}
    {isVideo}
    {timestamps}
    {clipBoundaries}
    {frameCopyToast}
    {clipToast}
    {clipOutputDir}
    {parentFolder}
    {invokeOpenDirectory}
    {ctxCopyImage}
    {ctxCopyFrame}
    {ctxCopyPath}
    {ctxRotate}
    {ctxFlip}
    {ctxEdit}
    {ctxConvert}
    {ctxShowInExplorer}
    {ctxProperties}
    {ctxDelete}
    {ctxClearMarkers}
    {clipDeleteConfirm}
    {deleteConfirm}
    {propertiesOpen}
    {deleteNoAsk}
    {deletePermanently}
    {fileName}
    {filePath}
    {fileExt}
    {fileDimensions}
    {fileSize}
    {fileCreated}
    {fileModified}
    {durationDisplay}
    {ffprobeChecked}
    {ffprobeAvailable}
    {ffmpegInstalling}
    {ffmpegInstallError}
    {mediaPropsLoading}
    {mediaProps}
    {installFfmpegAndWait}
    {refreshFfprobeAvailability}
    {loadMediaProperties}
    {showValue}
    {propsCopyPath}
    {propsOpenFolder}
    {propsCopyAll}
    {performDelete}
    {runClipAction}
    closeClipDeleteConfirm={() =>
      (clipDeleteConfirm = { visible: false, mode: null })}
    closeDeleteConfirm={() => (deleteConfirm = false)}
    closeProperties={() => (propertiesOpen = false)}
    updateDeleteNoAsk={(v) => (deleteNoAsk = v)}
    updateDeletePermanently={(v) => (deletePermanently = v)}
  />

  <EditMenu visible={editMenuVisible} onRotate={() => viewer.rotate()} onFlip={() => viewer.flip()} />

  <Tooltip
    {tsTooltip}
    tsEditMenuVisible={tsEditMenu.visible}
    {volumeTooltipVisible}
    {volumeTooltipX}
    {volumeTooltipY}
    {muted}
    {volume}
    {speedTooltipVisible}
    {speedTooltipX}
    {speedTooltipY}
    {playbackSpeed}
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
  />
</main>
