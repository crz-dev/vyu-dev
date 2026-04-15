<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { stat } from "@tauri-apps/plugin-fs";
  import { open } from "@tauri-apps/plugin-dialog";
  import { createPlaybackActions } from "$lib/core/playback.svelte";
  import { createTimeline } from "$lib/core/timeline.svelte";
  import { createClips } from "$lib/core/clips.svelte";

  import {
    IMAGE_EXTS,
    VIDEO_EXTS,
    ALL_EXTS,
    VOLUME_SEGMENTS,
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
    readTimestamps,
    writeTimestamps,
    eraseTimestamps,
    readClipBoundaries,
    writeClipBoundaries,
    eraseClipBoundaries,
    loadResumePoint,
    saveResumePoint,
    eraseResumePoint,
  } from "$lib/services/storage";

  import {
    invokeGetMediaProperties,
    invokeCheckFfprobe,
    invokeInstallFfmpeg,
    invokeProcessVideoClips,
    invokeDeleteFile,
    invokeTrashFile,
    invokeShowInExplorer,
    invokeOpenFolder,
    invokeOpenDirectory,
  } from "$lib/services/mediaTools";

  import {
    copyImageToClipboard,
    copyFrameToClipboard,
    copyPathToClipboard,
    copyAllPropertiesToClipboard,
  } from "$lib/services/clipboard";

  import {
    readMediaFilesInFolder,
    getParentFolder,
    getFileExt,
    getFileName,
  } from "$lib/services/files";

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
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let videoEl = $state<HTMLVideoElement | null>(null);

  const playback = createPlaybackActions(() => videoEl);
  const timeline = createTimeline();
  const clips = createClips();

  let playing = $state(false);
  let muted = $state(false);
  let looping = $state(true);
  let progress = $state(0);
  let rawCurrentSecs = $state(0);
  let rawDurationSecs = $state(0);
  let timerShowRemaining = $state(false);
  let imageRotation = $state(0);
  let imageFlipped = $state(false);
  let imageNaturalWidth = $state(0);
  let imageNaturalHeight = $state(0);

  let volume = $state(1);
  let volumeHovered = $state(false);
  let volumeTooltipX = $state(0);
  let volumeTooltipY = $state(0);
  let volumeTooltipVisible = $state(false);

  let hoverZone = $state("none");
  let isFullscreen = $state(false);
  let fsControlsVisible = $state(true);
  let fsHideTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPinchDist = 0;

  let zoomLevel = $state(100);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let dragStart = $state({ x: 0, y: 0, tx: 0, ty: 0 });
  let lastLeftClickTime = 0;
  let pendingPlay: ReturnType<typeof setTimeout> | undefined;

  let contextMenu = $state<CtxMenu>({ x: 0, y: 0, visible: false });
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(false);
  let propertiesOpen = $state(false);

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
  let clipMarkerJustDragged = false;
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
  let tsMarkerDragJustEnded = false;
  let tsDragFadeTimer: ReturnType<typeof setTimeout> | undefined;
  let frameCopyToast = $state<{
    visible: boolean;
    message: string;
    tone: "success" | "error";
  }>({
    visible: false,
    message: "",
    tone: "success",
  });
  let frameCopyToastTimer: ReturnType<typeof setTimeout> | undefined;

  const isQuarterTurn = $derived(Math.abs(imageRotation % 180) === 90);
  const rotationFitScale = $derived.by(() => {
    if (!isQuarterTurn || imageNaturalWidth <= 0 || imageNaturalHeight <= 0)
      return 1;
    const ratio = imageNaturalWidth / imageNaturalHeight;
    return Math.min(ratio, 1 / ratio);
  });
  const imageScale = $derived((zoomLevel / 100) * rotationFitScale);
  const imageStyle = $derived(
    `transform: scale(${imageScale}) translate(${translateX / imageScale}px, ${translateY / imageScale}px) rotate(${imageRotation}deg) scaleX(${imageFlipped ? -1 : 1}); transform-origin: center center; max-width: 100%; max-height: 100%; object-fit: contain; display: block;`,
  );
  const videoWrapperTransform = $derived(
    `transform: scale(${zoomLevel / 100}) translate(${translateX / (zoomLevel / 100)}px, ${translateY / (zoomLevel / 100)}px); transform-origin: center center;`,
  );
  const panCursor = $derived(
    zoomLevel > 100 ? (isDragging ? "grabbing" : "grab") : "default",
  );
  const fsCursor = $derived(!fsControlsVisible ? "none" : panCursor);
  const isGifVideo = $derived(isVideo && fileExt() === "gif");
  const clipPairs = $derived.by(() => {
    return clips.computePairs(clipBoundaries);
  });
  const clipCount = $derived(clipPairs.length);

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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatMetaDate(value: unknown): string {
    if (value === null || value === undefined) return "Unknown";
    const asNumber = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(asNumber)) return "Unknown";
    const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString();
  }

  function showFrameCopyToast(message: string, tone: "success" | "error") {
    clearTimeout(frameCopyToastTimer);
    frameCopyToast = { visible: true, message, tone };
    frameCopyToastTimer = setTimeout(() => {
      frameCopyToast = { ...frameCopyToast, visible: false };
    }, 2200);
  }

  function getMetaValue(obj: unknown, key: string): unknown {
    if (!obj || typeof obj !== "object") return undefined;
    return (obj as Record<string, unknown>)[key];
  }

  function finishLoading() {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      loadingFadingOut = true;
      setTimeout(() => {
        isLoadingFile = false;
        loadingFadingOut = false;
      }, 400);
    }, 400);
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

  function toggleLoop() {
    playback.toggleLoop((v) => (looping = v), looping);
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

  function handleVolumeAreaLeave() {
    volumeTooltipVisible = false;
    volumeHovered = false;
  }

  function loadTimestamps() {
    timestamps = readTimestamps(filePath);
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
    timestamps = [];
    eraseTimestamps(filePath);
  }

  function updateTimestampTitle(id: string, title: string) {
    timestamps = timestamps.map((ts) =>
      ts.id === id
        ? {
            ...ts,
            title,
          }
        : ts,
    );
    saveTimestamps();
  }

  function updateClipBoundaryTitle(id: string, title: string) {
    clipBoundaries = clipBoundaries.map((marker) =>
      marker.id === id
        ? {
            ...marker,
            title,
          }
        : marker,
    );
    saveClipBoundaries();
  }

  function getTimestampById(id: string): Timestamp | undefined {
    return timestamps.find((ts) => ts.id === id);
  }

  function getClipBoundaryById(id: string): ClipBoundary | undefined {
    return clipBoundaries.find((marker) => marker.id === id);
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
    clipBoundaries = [];
    eraseClipBoundaries(filePath);
  }

  function setClipBoundaryKind(id: string, kind: "start" | "end") {
    const marker = getClipBoundaryById(id);
    if (!marker || marker.kind === kind) return;
    clipBoundaries = clipBoundaries
      .map((m) => (m.id === id ? { ...m, kind } : m))
      .sort((a, b) => a.time - b.time);
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

  function getTimestampTouchTarget(
    currentTime: number,
    threshold: number,
    sourceId: string,
  ): string | null {
    let found: Timestamp | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const ts of timestamps) {
      if (ts.id === sourceId) continue;
      const dist = Math.abs(ts.time - currentTime);
      if (dist <= threshold && dist < best) {
        best = dist;
        found = ts;
      }
    }
    return found?.id ?? null;
  }

  function getBoundaryTouchTarget(
    currentTime: number,
    threshold: number,
  ): string | null {
    let found: ClipBoundary | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const marker of clipBoundaries) {
      const dist = Math.abs(marker.time - currentTime);
      if (dist <= threshold && dist < best) {
        best = dist;
        found = marker;
      }
    }
    return found?.id ?? null;
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
    const startPct = getTimestampPct(tsDragRange.start);
    const endPct = getTimestampPct(tsDragRange.end);
    return `left: ${startPct}%; width: ${Math.max(0, endPct - startPct)}%;`;
  }

  function seekToTimestamp(i: number) {
    timeline.seekToTimestamp(i, timestamps, videoEl);
  }

  function getTimestampPct(time: number): number {
    return rawDurationSecs > 0 ? (time / rawDurationSecs) * 100 : 0;
  }

  function loadResumePointForFile() {
    resumePoint = loadResumePoint(filePath);
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

  function loadClipBoundaries() {
    clipBoundaries = readClipBoundaries(filePath);
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
    filePath = path;
    fileName = getFileName(path);
    const ext = path.split(".").pop()?.toLowerCase() || "";
    isVideo = VIDEO_EXTS.includes(ext);
    fileSrc = convertFileSrc(path);
    fileSize = "";
    fileDimensions = "";
    fileCreated = "";
    fileModified = "";
    fileInfoLoading = true;
    imageRotation = 0;
    imageFlipped = false;
    imageNaturalWidth = 0;
    imageNaturalHeight = 0;
    rawCurrentSecs = 0;
    rawDurationSecs = 0;
    progress = 0;
    playing = false;
    clearTimeout(tsDragFadeTimer);
    clearTimestampDragRange();
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
    timestamps = [];
    clipBoundaries = [];
    resetZoom();
    if (isVideo) loadTimestamps();
    if (isVideo) loadClipBoundaries();
    if (isVideo) loadResumePointForFile();
    try {
      const info = await stat(path);
      fileSize = formatFileSize(info.size);
      fileCreated = formatMetaDate(
        getMetaValue(info, "birthtime") ??
          getMetaValue(info, "birthtimeMs") ??
          getMetaValue(info, "createdAt"),
      );
      fileModified = formatMetaDate(
        getMetaValue(info, "mtime") ??
          getMetaValue(info, "mtimeMs") ??
          getMetaValue(info, "modifiedAt"),
      );
    } catch {}
  }

  function onImageLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    imageNaturalWidth = img.naturalWidth;
    imageNaturalHeight = img.naturalHeight;
    fileDimensions = `${img.naturalWidth} × ${img.naturalHeight}`;
    fileInfoLoading = false;
    if (isLoadingFile) finishLoading();
  }

  function onVideoLoad() {
    if (!videoEl) return;
    fileDimensions = `${videoEl.videoWidth} × ${videoEl.videoHeight}`;
    videoEl.volume = volume;
    videoEl.muted = muted;
    videoEl.loop = looping;
    fileInfoLoading = false;
    rawCurrentSecs = 0;
    rawDurationSecs = videoEl.duration || 0;
    progress = 0;
    playing = !videoEl.paused;
    if (isLoadingFile) finishLoading();
  }

  async function loadFile(path: string) {
    clearTimeout(loadingTimer);
    isLoadingFile = true;
    loadingFadingOut = false;
    await displayFile(path);
    try {
      fileList = await readMediaFilesInFolder(path);
      currentIndex = fileList.indexOf(path);
    } catch {}
  }

  function navigate(direction: number) {
    if (fileList.length === 0) return;
    currentIndex =
      (currentIndex + direction + fileList.length) % fileList.length;
    displayFile(fileList[currentIndex]);
  }

  function navigateToEdge(first: boolean) {
    if (fileList.length === 0) return;
    currentIndex = first ? 0 : fileList.length - 1;
    displayFile(fileList[currentIndex]);
  }

  function closeFile() {
    filePath = "";
    fileSrc = "";
    fileName = "no file open";
    isVideo = false;
    fileList = [];
    currentIndex = 0;
    playing = false;
    progress = 0;
    rawCurrentSecs = 0;
    rawDurationSecs = 0;
    fileSize = "";
    fileDimensions = "";
    fileCreated = "";
    fileModified = "";
    isLoadingFile = false;
    loadingFadingOut = false;
    imageRotation = 0;
    imageFlipped = false;
    imageNaturalWidth = 0;
    imageNaturalHeight = 0;
    clearTimeout(tsDragFadeTimer);
    clearTimestampDragRange();
    tsTooltip = { ...tsTooltip, visible: false };
    tsEditMenu = { ...tsEditMenu, visible: false };
    timestamps = [];
    clipBoundaries = [];
    resumePoint = null;
    resumeTooltipVisible = false;
    clearTimeout(loadingTimer);
    resetZoom();
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

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    if (isFullscreen) resetFsTimer();
  }

  function resetFsTimer() {
    fsControlsVisible = true;
    clearTimeout(fsHideTimer);
    fsHideTimer = setTimeout(() => {
      fsControlsVisible = false;
    }, 1500);
  }

  function resetZoom() {
    zoomLevel = 100;
    translateX = 0;
    translateY = 0;
  }

  function handleViewerScroll(e: WheelEvent) {
    if (!fileSrc) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    const oldScale = zoomLevel / 100;
    const raw = zoomLevel * (e.deltaY > 0 ? 1 / 1.1 : 1.1);
    const newZoom = Math.max(
      100,
      Math.min(1000, zoomLevel > 100 && raw < 100 ? 100 : raw),
    );
    const newScale = newZoom / 100;
    if (newZoom === 100) {
      translateX = 0;
      translateY = 0;
    } else {
      translateX = mouseX - (mouseX - translateX) * (newScale / oldScale);
      translateY = mouseY - (mouseY - translateY) * (newScale / oldScale);
    }
    zoomLevel = newZoom;
  }

  function handleTouchZoom(e: TouchEvent) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (lastPinchDist === 0) {
      lastPinchDist = dist;
      return;
    }
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = midX - rect.left - rect.width / 2;
    const mouseY = midY - rect.top - rect.height / 2;
    const oldScale = zoomLevel / 100;
    const newZoom = Math.max(
      100,
      Math.min(1000, zoomLevel * (dist / lastPinchDist)),
    );
    const newScale = newZoom / 100;
    if (newZoom === 100) {
      translateX = 0;
      translateY = 0;
    } else {
      translateX = mouseX - (mouseX - translateX) * (newScale / oldScale);
      translateY = mouseY - (mouseY - translateY) * (newScale / oldScale);
    }
    zoomLevel = newZoom;
    lastPinchDist = dist;
  }

  function handleTouchEnd() {
    lastPinchDist = 0;
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
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY, tx: translateX, ty: translateY };

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - dragStart.x;
      const dy = ev.clientY - dragStart.y;
      if (!hasMoved && Math.sqrt(dx * dx + dy * dy) < 8) return;
      hasMoved = true;
      if (zoomLevel > 100) {
        translateX = dragStart.tx + dx;
        translateY = dragStart.ty + dy;
      }
    }

    function onUp() {
      isDragging = false;
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

  function handleKeydown(e: KeyboardEvent) {
    if (contextMenu.visible || deleteConfirm || propertiesOpen) {
      if (e.key === "Escape") {
        contextMenu.visible = false;
        deleteConfirm = false;
        propertiesOpen = false;
      }
      return;
    }
    if (e.ctrlKey && e.key === "ArrowRight") {
      e.preventDefault();
      navigateToEdge(false);
      return;
    }
    if (e.ctrlKey && e.key === "ArrowLeft") {
      e.preventDefault();
      navigateToEdge(true);
      return;
    }
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      navigate(1);
      return;
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      navigate(-1);
      return;
    }
    if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
      return;
    }
    if (e.key === "Escape" && isFullscreen) {
      toggleFullscreen();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setVolume(volume + 0.125);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setVolume(volume - 0.125);
      return;
    }
    if (["ArrowRight", "ArrowLeft", " "].includes(e.key)) e.preventDefault();
    if (isVideo && videoEl && (hoverZone === "video" || isFullscreen)) {
      if (e.key === " ") togglePlay();
      if (e.key === "ArrowRight")
        videoEl.currentTime = Math.min(
          videoEl.currentTime + 5,
          videoEl.duration,
        );
      if (e.key === "ArrowLeft")
        videoEl.currentTime = Math.max(videoEl.currentTime - 5, 0);
    } else {
      if (e.key === " " && isVideo && videoEl) togglePlay();
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    }
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
    let x = e.clientX;
    let y = e.clientY;
    const menuW = 200;
    const menuH = isVideo ? 300 : 260;
    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
    contextMenu = { x, y, visible: true };
  }

  function closeContextMenu() {
    contextMenu = { ...contextMenu, visible: false };
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
    try {
      mediaProps = await invokeGetMediaProperties(filePath);
    } catch {
      mediaProps = null;
    } finally {
      mediaPropsLoading = false;
    }
  }

  async function refreshFfprobeAvailability() {
    ffprobeChecked = false;
    try {
      ffprobeAvailable = await invokeCheckFfprobe();
    } catch {
      ffprobeAvailable = false;
    } finally {
      ffprobeChecked = true;
    }
  }

  async function installFfmpegAndWait() {
    ffmpegInstallError = "";
    ffmpegInstalling = true;
    try {
      await invokeInstallFfmpeg();
      const attempts = 60;
      for (let i = 0; i < attempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await refreshFfprobeAvailability();
        if (ffprobeAvailable) {
          await loadMediaProperties();
          break;
        }
      }
      if (!ffprobeAvailable) {
        ffmpegInstallError =
          "Install still running. Reopen Properties in a moment.";
      }
    } catch (e) {
      ffmpegInstallError =
        e instanceof Error ? e.message : "Failed to start FFmpeg install.";
    } finally {
      ffmpegInstalling = false;
    }
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

  function ctxCopyPath() {
    closeContextMenu();
    copyPathToClipboard(filePath);
  }
  function ctxRotate() {
    closeContextMenu();
    imageRotation = (imageRotation + 90) % 360;
  }
  function ctxFlip() {
    closeContextMenu();
    imageFlipped = !imageFlipped;
  }
  function ctxToggleLoop() {
    closeContextMenu();
    toggleLoop();
  }
  function ctxAddTimestamp() {
    closeContextMenu();
    addTimestamp();
  }
  function ctxClearTimestamps() {
    closeContextMenu();
    clearAllTimestamps();
  }
  function ctxClearSegments() {
    closeContextMenu();
    clearAllSegments();
  }
  function ctxStartClipHere() {
    closeContextMenu();
    addClipBoundary("start");
  }
  function ctxEndClipHere() {
    closeContextMenu();
    addClipBoundary("end");
  }

  async function ctxShowInExplorer() {
    closeContextMenu();
    try {
      await invokeShowInExplorer(filePath);
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
    const remaining = prevList.filter((p) => p !== pathToDelete);
    if (remaining.length > 0) {
      const nextIndex = Math.min(prevIndex, remaining.length - 1);
      loadFile(remaining[nextIndex]);
    }
  }

  function showFilenameTooltip(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const tip = document.getElementById("filename-tooltip");
    if (!tip) return;
    tip.textContent = "File name";
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.bottom + 6}px`;
    tip.style.opacity = "1";
  }

  function hideFilenameTooltip() {
    const tip = document.getElementById("filename-tooltip");
    if (tip) tip.style.opacity = "0";
  }

  function handleGlobalMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (contextMenu.visible && !target.closest(".context-menu"))
      closeContextMenu();
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

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("mousedown", handleGlobalMouseDown);
      clearTimeout(frameCopyToastTimer);
      clearTimeout(clipToastTimer);
      clearTimeout(tsDragFadeTimer);
    };
  });
</script>

<main
  class:fullscreen={isFullscreen}
  onmousemove={isFullscreen ? resetFsTimer : undefined}
  ondrop={(e) => e.preventDefault()}
  ondragover={(e) => e.preventDefault()}
  oncontextmenu={openContextMenu}
>
  <div class="topbar" onmousedown={startDrag} role="toolbar" tabindex="-1">
    <span class="app-name">vyu</span>
    <span class="divider">/</span>
    <span
      class="filename"
      role="presentation"
      onmouseenter={showFilenameTooltip}
      onmouseleave={hideFilenameTooltip}>{fileName}</span
    >
    {#if fileSrc}
      <span class="divider">/</span>
      <button
        class="folder-btn close-file-btn tooltip-below"
        data-tooltip="Close file"
        onclick={closeFile}
        aria-label="close file"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
            stroke="currentColor"
            stroke-width="2"
          />
          <path d="M15 3v5h5" stroke="currentColor" stroke-width="2" />
          <path
            d="M11 12H4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M7 9l-3 3 3 3"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="divider">/</span>
      <button
        class="folder-btn open-file-btn tooltip-below"
        data-tooltip="Open file"
        onclick={openFileDialog}
        aria-label="open file"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
      </button>
    {/if}
    <div class="window-controls">
      <button
        class="wc-btn tooltip-below"
        data-tooltip="Minimize"
        onclick={minimizeWindow}
        aria-label="minimize">−</button
      >
      <button
        class="wc-btn tooltip-below"
        data-tooltip="Maximize"
        onclick={maximizeWindow}
        aria-label="maximize">▢</button
      >
      <button
        class="wc-btn close tooltip-below"
        data-tooltip="Close"
        onclick={closeWindow}
        aria-label="close">✕</button
      >
    </div>
  </div>

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
      ontouchmove={handleTouchZoom}
      ontouchend={handleTouchEnd}
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
          <video
            bind:this={videoEl}
            src={fileSrc}
            crossorigin="anonymous"
            autoplay
            ontimeupdate={updateProgress}
            onloadedmetadata={onVideoLoad}
          >
            <track kind="captions" />
          </video>
          <div class="video-controls" class:gif-only={isGifVideo}>
            <div
              class="progress-bar"
              data-clipbar="normal"
              class:hide-for-gif={isGifVideo}
              onmousedown={startScrubbing}
              oncontextmenu={(e) => e.preventDefault()}
              role="slider"
              aria-label="video scrubber"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              tabindex="0"
            >
              <div class="progress-fill" style="width: {progress}%"></div>
              <div class="progress-playhead" style="left: {progress}%"></div>
              {#each clipPairs as pair (`pair-${pair.startId}-${pair.endId}`)}
                <div
                  class="clip-range"
                  style="left: {getTimestampPct(
                    pair.start,
                  )}%; width: {getTimestampPct(pair.end) -
                    getTimestampPct(pair.start)}%;"
                ></div>
              {/each}
              {#if tsDragRange.visible}
                <div
                  class="ts-drag-range"
                  class:converting={tsDragRange.phase === "converting"}
                  class:fading={tsDragRange.phase === "fading"}
                  style={getDragRangeStyle()}
                ></div>
              {/if}
              {#each clipBoundaries as marker (marker.id)}
                <div
                  class="clip-marker {marker.kind === 'start'
                    ? 'start-marker'
                    : 'end-marker'}"
                  style="left: {getTimestampPct(marker.time)}%"
                  role="button"
                  tabindex="0"
                  onmousedown={(e) => startClipMarkerDrag(e, marker.id)}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeClipBoundary(marker.id);
                  }}
                  onmouseenter={(e) => {
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    tsTooltip = {
                      visible: true,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      title: marker.title?.trim() || "",
                      timeLabel: formatTime(marker.time),
                      tone: "blue",
                    };
                  }}
                  onmouseleave={() => {
                    tsTooltip = { ...tsTooltip, visible: false };
                  }}
                  onclick={(e) => {
                    e.stopPropagation();
                    if (clipMarkerJustDragged) return;
                    seekToTimestamp(marker.time);
                  }}
                  ondblclick={(e) => openSegmentEditor(e, marker.id)}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      seekToTimestamp(marker.time);
                    }
                  }}
                  aria-label={marker.title
                    ? `${marker.kind} clip marker ${marker.title} at ${formatTime(marker.time)}`
                    : `${marker.kind} clip marker at ${formatTime(marker.time)}`}
                ></div>
              {/each}
              {#each timestamps as ts (ts.id)}
                <div
                  class="ts-marker"
                  style="left: {getTimestampPct(ts.time)}%"
                  role="button"
                  tabindex="0"
                  onmousedown={(e) => startTimestampRangeDrag(e, ts.id)}
                  onclick={(e) => {
                    e.stopPropagation();
                    if (tsMarkerDragJustEnded) return;
                    seekToTimestamp(ts.time);
                  }}
                  ondblclick={(e) => openTimestampEditor(e, ts.id)}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      seekToTimestamp(ts.time);
                    }
                  }}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeTimestamp(ts.id);
                  }}
                  onmouseenter={(e) => showTimestampTooltip(e, ts)}
                  onmouseleave={() => {
                    if (!tsEditMenu.visible)
                      tsTooltip = { ...tsTooltip, visible: false };
                  }}
                  aria-label="timestamp {ts.title
                    ? `${ts.title} at ${formatTime(ts.time)}`
                    : formatTime(ts.time)}"
                ></div>
              {/each}
              {#if resumePoint !== null}
                <div
                  class="resume-marker"
                  style="left: {getTimestampPct(resumePoint)}%"
                  role="button"
                  tabindex="0"
                  onclick={(e) => {
                    e.stopPropagation();
                    tsTooltip = { ...tsTooltip, visible: false };
                    seekToResumePoint();
                    removeResumePoint();
                  }}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tsTooltip = { ...tsTooltip, visible: false };
                    removeResumePoint();
                  }}
                  onmouseenter={(e) => {
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    tsTooltip = {
                      visible: true,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      title: "Resume",
                      timeLabel: formatTime(resumePoint!),
                      tone: "green",
                    };
                    resumeTooltipVisible = true;
                  }}
                  onmouseleave={() => {
                    tsTooltip = { ...tsTooltip, visible: false };
                    resumeTooltipVisible = false;
                  }}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      seekToResumePoint();
                    }
                  }}
                  aria-label="Resume at {formatTime(resumePoint)}"
                ></div>
              {/if}
            </div>
            <div class="controls-row" class:hide-for-gif={isGifVideo}>
              <button
                class="ctrl-btn tooltip-ctrl"
                data-tooltip={playing ? "Pause" : "Play"}
                onclick={togglePlay}
                aria-label={playing ? "pause" : "play"}
              >
                {#if playing}
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
                    ><rect
                      x="3"
                      y="2"
                      width="3.5"
                      height="12"
                      rx="1"
                      fill="currentColor"
                    /><rect
                      x="9.5"
                      y="2"
                      width="3.5"
                      height="12"
                      rx="1"
                      fill="currentColor"
                    /></svg
                  >
                {:else}
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
                    ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
                  >
                {/if}
              </button>
              <button
                class="ctrl-btn loop-btn tooltip-ctrl"
                class:active={looping}
                data-tooltip="Loop video"
                onclick={toggleLoop}
                aria-label="toggle loop"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 2L21 6L17 10"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M3 11V9C3 7.9 3.9 7 5 7H21"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M7 22L3 18L7 14"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M21 13V15C21 16.1 20.1 17 19 17H3"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <div
                class="volume-control"
                class:audio-off={muted || volume === 0}
                onmouseenter={() => (volumeHovered = true)}
                onmouseleave={handleVolumeAreaLeave}
                onwheel={handleVolumeScroll}
                role="presentation"
              >
                <button
                  class="ctrl-btn volume-btn tooltip-ctrl"
                  class:active={!(muted || volume === 0)}
                  data-tooltip={muted || volume === 0 ? "Unmute" : "Mute"}
                  onclick={toggleMute}
                  aria-label={muted ? "unmute" : "mute"}
                >
                  {#if muted || volume === 0}
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
                      ><path
                        d="M9 4L5 7H2V11H5L9 14V4Z"
                        fill="currentColor"
                      /><line
                        x1="12"
                        y1="6"
                        x2="16"
                        y2="12"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /><line
                        x1="16"
                        y1="6"
                        x2="12"
                        y2="12"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /></svg
                    >
                  {:else if volume < 0.5}
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
                      ><path
                        d="M9 4L5 7H2V11H5L9 14V4Z"
                        fill="currentColor"
                      /><path
                        d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /></svg
                    >
                  {:else}
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
                      ><path
                        d="M9 4L5 7H2V11H5L9 14V4Z"
                        fill="currentColor"
                      /><path
                        d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /><path
                        d="M13.5 5C15.5 6.5 16.5 7.7 16.5 9C16.5 10.3 15.5 11.5 13.5 13"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /></svg
                    >
                  {/if}
                </button>
                {#if volumeHovered}
                  <div
                    class="volume-diamonds"
                    onmousedown={startVolumeDrag}
                    onmousemove={handleVolumeDiamondHover}
                    role="presentation"
                  >
                    {#each Array(VOLUME_SEGMENTS) as _, i}
                      <button
                        class="volume-diamond"
                        class:filled={i < Math.round(volume * VOLUME_SEGMENTS)}
                        class:muted-diamond={muted}
                        style="--i: {i}"
                        onclick={() => setVolume((i + 1) / VOLUME_SEGMENTS)}
                        aria-label="set volume {Math.round(
                          ((i + 1) / VOLUME_SEGMENTS) * 100,
                        )}%"
                      ></button>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="controls-spacer"></div>
              <button
                class="ctrl-btn add-ts-btn tooltip-ctrl"
                data-tooltip="Place timestamp"
                onclick={addTimestamp}
                aria-label="add timestamp"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  ><circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    stroke-width="2"
                  /><path
                    d="M12 7v5l3 3"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><path
                    d="M18.5 3.5L20 2"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><path
                    d="M12 3V1"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                >
              </button>
              <button
                class="time-display tooltip-ctrl"
                data-tooltip={timerTooltip}
                onclick={toggleTimer}
                aria-label="toggle timer mode"
              >
                {currentTimeDisplay()} / {durationDisplay}
              </button>
            </div>
            {#if isGifVideo}
              <button
                class="ctrl-btn gif-center-btn tooltip-ctrl"
                data-tooltip={playing ? "Pause GIF" : "Play GIF"}
                onclick={togglePlay}
                aria-label={playing ? "pause gif" : "play gif"}
              >
                {#if playing}
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                    ><rect
                      x="3"
                      y="2"
                      width="3.5"
                      height="12"
                      rx="1"
                      fill="currentColor"
                    /><rect
                      x="9.5"
                      y="2"
                      width="3.5"
                      height="12"
                      rx="1"
                      fill="currentColor"
                    /></svg
                  >
                {:else}
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                    ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
                  >
                {/if}
              </button>
            {/if}
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

  <div class="bottombar">
    <span
      class="file-count tooltip-above-shift-right"
      data-tooltip="File position"
      >{fileList.length > 0
        ? `${currentIndex + 1} / ${fileList.length}`
        : "—"}</span
    >
    <span class="file-info tooltip-above" data-tooltip="Resolution · File size">
      {#if fileDimensions && fileSize}
        {fileDimensions} · {fileSize}
      {:else if !fileInfoLoading && fileName !== "no file open"}
        {fileName}
      {:else if !fileSrc}
        no file open
      {/if}
    </span>
    <div class="bottombar-right">
      <button
        class="zoom tooltip-above"
        data-tooltip="Reset zoom"
        onclick={resetZoom}>{Math.round(zoomLevel)}%</button
      >
      <button
        class="fs-btn tooltip-above-shift-left"
        data-tooltip="Fullscreen"
        onclick={toggleFullscreen}
        aria-label="toggle fullscreen"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          ><path
            d="M1 4V1H4M8 1H11V4M11 8V11H8M4 11H1V8"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round"
          /></svg
        >
      </button>
    </div>
  </div>

  {#if isVideo && clipCount > 0}
    <div
      class="clip-actions"
      transition:fly={{ y: 26, duration: 190, opacity: 0.08 }}
    >
      <button
        class="clip-main-btn"
        onclick={triggerClipSegments}
        disabled={clipJobRunning}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><circle
            cx="6.5"
            cy="8"
            r="2.5"
            stroke="currentColor"
            stroke-width="2"
          /><circle
            cx="6.5"
            cy="16"
            r="2.5"
            stroke="currentColor"
            stroke-width="2"
          /><path
            d="M9 9.5L20 4M9 14.5L20 20"
            stroke="currentColor"
            stroke-width="2"
          /></svg
        >
        <span>Clip Segments</span>
      </button>
      <div class="clip-options-grid">
        <button
          class="clip-toggle-btn red"
          class:is-on={clipDeleteOriginal}
          onclick={toggleClipDeleteOriginal}
          disabled={clipJobRunning}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2M3 6h18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          <span>Delete Original</span>
        </button>
        <button
          class="clip-toggle-btn yellow tooltip-above"
          class:is-on={clipUseCustomPath}
          data-tooltip={getClipTargetDir() || "No output path"}
          title={getClipTargetDir() || "No output path"}
          onclick={toggleClipPathSelection}
          disabled={clipJobRunning}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          <span>Select Path</span>
        </button>
        <button
          class="clip-toggle-btn green"
          class:is-on={clipMergeSegments}
          onclick={toggleClipMergeSegments}
          disabled={clipJobRunning}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M5 7h14M5 12h14M5 17h14M8 7v10M16 7v10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          <span>Merge Segments</span>
        </button>
      </div>
      {#if clipJobRunning}
        <div class="clip-job-progress">
          <span>{clipJobLabel}</span>
          <div class="clip-job-bar"><span></span></div>
        </div>
      {/if}
    </div>
  {/if}

  {#if isFullscreen}
    <div
      class="fs-overlay"
      class:visible={fsControlsVisible}
      role="button"
      tabindex="0"
      onwheel={handleViewerScroll}
      onmousedown={startPan}
      ontouchstart={(e) => {
        if (e.touches.length === 2) e.preventDefault();
      }}
      ontouchmove={handleTouchZoom}
      ontouchend={handleTouchEnd}
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
          <div
            class="fs-progress"
            data-clipbar="fullscreen"
            class:hide-for-gif={isGifVideo}
            onmousedown={startScrubbing}
            oncontextmenu={(e) => e.preventDefault()}
            role="slider"
            aria-label="video scrubber"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            tabindex="0"
          >
            <div class="fs-progress-fill" style="width: {progress}%"></div>
            <div class="fs-progress-playhead" style="left: {progress}%"></div>
            {#each clipPairs as pair (`fspair-${pair.startId}-${pair.endId}`)}
              <div
                class="fs-clip-range"
                style="left: {getTimestampPct(
                  pair.start,
                )}%; width: {getTimestampPct(pair.end) -
                  getTimestampPct(pair.start)}%;"
              ></div>
            {/each}
            {#if resumePoint !== null}
              <div
                class="resume-marker"
                style="left: {getTimestampPct(resumePoint)}%"
                role="button"
                tabindex="0"
                onclick={(e) => {
                  e.stopPropagation();
                  tsTooltip = { ...tsTooltip, visible: false };
                  seekToResumePoint();
                  removeResumePoint();
                }}
                oncontextmenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  tsTooltip = { ...tsTooltip, visible: false };
                  removeResumePoint();
                }}
                onmouseenter={(e) => {
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  tsTooltip = {
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    title: "Resume",
                    timeLabel: formatTime(resumePoint!),
                    tone: "green",
                  };
                  resumeTooltipVisible = true;
                }}
                onmouseleave={() => {
                  tsTooltip = { ...tsTooltip, visible: false };
                  resumeTooltipVisible = false;
                }}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    seekToResumePoint();
                  }
                }}
                aria-label="Resume at {formatTime(resumePoint)}"
              ></div>
            {/if}
            {#if tsDragRange.visible}
              <div
                class="ts-drag-range"
                class:converting={tsDragRange.phase === "converting"}
                class:fading={tsDragRange.phase === "fading"}
                style={getDragRangeStyle()}
              ></div>
            {/if}
            {#each clipBoundaries as marker (marker.id)}
              <div
                class="fs-clip-marker {marker.kind === 'start'
                  ? 'start-marker'
                  : 'end-marker'}"
                style="left: {getTimestampPct(marker.time)}%"
                role="button"
                tabindex="0"
                onmousedown={(e) => startClipMarkerDrag(e, marker.id)}
                oncontextmenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeClipBoundary(marker.id);
                }}
                onmouseenter={(e) => {
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  tsTooltip = {
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    title: marker.title?.trim() || "",
                    timeLabel: formatTime(marker.time),
                    tone: "blue",
                  };
                }}
                onmouseleave={() => {
                  tsTooltip = { ...tsTooltip, visible: false };
                }}
                onclick={(e) => {
                  e.stopPropagation();
                  if (clipMarkerJustDragged) return;
                  seekToTimestamp(marker.time);
                }}
                ondblclick={(e) => openSegmentEditor(e, marker.id)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    seekToTimestamp(marker.time);
                  }
                }}
                aria-label={marker.title
                  ? `${marker.kind} clip marker ${marker.title} at ${formatTime(marker.time)}`
                  : `${marker.kind} clip marker at ${formatTime(marker.time)}`}
              ></div>
            {/each}
            {#each timestamps as ts (ts.id)}
              <div
                class="ts-marker"
                style="left: {getTimestampPct(ts.time)}%"
                role="button"
                tabindex="0"
                onmousedown={(e) => startTimestampRangeDrag(e, ts.id)}
                onclick={(e) => {
                  e.stopPropagation();
                  if (tsMarkerDragJustEnded) return;
                  seekToTimestamp(ts.time);
                }}
                ondblclick={(e) => openTimestampEditor(e, ts.id)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    seekToTimestamp(ts.time);
                  }
                }}
                oncontextmenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTimestamp(ts.id);
                }}
                onmouseenter={(e) => showTimestampTooltip(e, ts)}
                onmouseleave={() => {
                  if (!tsEditMenu.visible)
                    tsTooltip = { ...tsTooltip, visible: false };
                }}
                aria-label="timestamp {ts.title
                  ? `${ts.title} at ${formatTime(ts.time)}`
                  : formatTime(ts.time)}"
              ></div>
            {/each}
          </div>
          <div class="fs-controls-row" class:hide-for-gif={isGifVideo}>
            <button
              class="fs-ctrl-btn tooltip-ctrl"
              data-tooltip={playing ? "Pause" : "Play"}
              onclick={togglePlay}
              aria-label={playing ? "pause" : "play"}
            >
              {#if playing}
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                  ><rect
                    x="3"
                    y="2"
                    width="3.5"
                    height="12"
                    rx="1"
                    fill="currentColor"
                  /><rect
                    x="9.5"
                    y="2"
                    width="3.5"
                    height="12"
                    rx="1"
                    fill="currentColor"
                  /></svg
                >
              {:else}
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                  ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
                >
              {/if}
            </button>
            <button
              class="fs-ctrl-btn loop-btn tooltip-ctrl"
              class:active={looping}
              data-tooltip="Loop video"
              onclick={toggleLoop}
              aria-label="toggle loop"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 2L21 6L17 10"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 11V9C3 7.9 3.9 7 5 7H21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M7 22L3 18L7 14"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 13V15C21 16.1 20.1 17 19 17H3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <div
              class="volume-control"
              class:audio-off={muted || volume === 0}
              onmouseenter={() => (volumeHovered = true)}
              onmouseleave={handleVolumeAreaLeave}
              onwheel={handleVolumeScroll}
              role="presentation"
            >
              <button
                class="fs-ctrl-btn volume-btn tooltip-ctrl"
                class:active={!(muted || volume === 0)}
                data-tooltip={muted || volume === 0 ? "Unmute" : "Mute"}
                onclick={toggleMute}
                aria-label={muted ? "unmute" : "mute"}
              >
                {#if muted || volume === 0}
                  <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
                    ><path
                      d="M9 4L5 7H2V11H5L9 14V4Z"
                      fill="currentColor"
                    /><line
                      x1="12"
                      y1="6"
                      x2="16"
                      y2="12"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    /><line
                      x1="16"
                      y1="6"
                      x2="12"
                      y2="12"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    /></svg
                  >
                {:else if volume < 0.5}
                  <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
                    ><path
                      d="M9 4L5 7H2V11H5L9 14V4Z"
                      fill="currentColor"
                    /><path
                      d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    /></svg
                  >
                {:else}
                  <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
                    ><path
                      d="M9 4L5 7H2V11H5L9 14V4Z"
                      fill="currentColor"
                    /><path
                      d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    /><path
                      d="M13.5 5C15.5 6.5 16.5 7.7 16.5 9C16.5 10.3 15.5 11.5 13.5 13"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    /></svg
                  >
                {/if}
              </button>
              {#if volumeHovered}
                <div
                  class="volume-diamonds"
                  onmousedown={startVolumeDrag}
                  onmousemove={handleVolumeDiamondHover}
                  role="presentation"
                >
                  {#each Array(VOLUME_SEGMENTS) as _, i}
                    <button
                      class="volume-diamond"
                      class:filled={i < Math.round(volume * VOLUME_SEGMENTS)}
                      class:muted-diamond={muted}
                      style="--i: {i}"
                      onclick={() => setVolume((i + 1) / VOLUME_SEGMENTS)}
                      aria-label="set volume {Math.round(
                        ((i + 1) / VOLUME_SEGMENTS) * 100,
                      )}%"
                    ></button>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="controls-spacer"></div>
            <button
              class="fs-ctrl-btn add-ts-btn tooltip-ctrl"
              data-tooltip="Place timestamp"
              onclick={addTimestamp}
              aria-label="add timestamp"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                ><circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  stroke-width="2"
                /><path
                  d="M12 7v5l3 3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /><path
                  d="M18.5 3.5L20 2"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /><path
                  d="M12 3V1"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /></svg
              >
            </button>
            <button
              class="fs-time tooltip-ctrl"
              data-tooltip={timerTooltip}
              onclick={toggleTimer}
              aria-label="toggle timer mode"
            >
              {currentTimeDisplay()} / {durationDisplay}
            </button>
            <div class="fs-right">
              <button
                class="fs-ctrl-btn"
                onclick={toggleFullscreen}
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
          {#if isGifVideo}
            <button
              class="fs-ctrl-btn fs-gif-center-btn tooltip-ctrl"
              data-tooltip={playing ? "Pause GIF" : "Play GIF"}
              onclick={togglePlay}
              aria-label={playing ? "pause gif" : "play gif"}
            >
              {#if playing}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none"
                  ><rect
                    x="3"
                    y="2"
                    width="3.5"
                    height="12"
                    rx="1"
                    fill="currentColor"
                  /><rect
                    x="9.5"
                    y="2"
                    width="3.5"
                    height="12"
                    rx="1"
                    fill="currentColor"
                  /></svg
                >
              {:else}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none"
                  ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
                >
              {/if}
            </button>
          {/if}
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
                onclick={toggleFullscreen}
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

  {#if contextMenu.visible}
    <div
      class="context-menu"
      style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
      role="menu"
    >
      {#if !isVideo}
        <button class="ctx-item green" onclick={ctxCopyImage} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><rect
              x="8"
              y="8"
              width="13"
              height="13"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M4 16V5a1 1 0 011-1h11"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy image
        </button>
        <button class="ctx-item green" onclick={ctxCopyPath} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy file path
        </button>
        <div class="ctx-sep"></div>
        <button class="ctx-item blue" onclick={ctxRotate} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M21 2v6h-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><path
              d="M21 13a9 9 0 11-3-7.7L21 8"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Rotate 90°
        </button>
        <button class="ctx-item blue" onclick={ctxFlip} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M12 3v18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M5 8l-3 4 3 4M19 8l3 4-3 4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
          Flip horizontal
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorer}
          role="menuitem"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          Show in explorer
        </button>
        <button class="ctx-item yellow" onclick={ctxProperties} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M12 10.5V16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
          >
          Properties
        </button>
        <div class="ctx-sep"></div>
        <button class="ctx-item red" onclick={ctxDelete} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete
        </button>
      {:else}
        <button class="ctx-item green" onclick={ctxCopyFrame} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><rect
              x="2"
              y="4"
              width="20"
              height="16"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            /><circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" /><path
              d="M2 17l5-5 4 4 3-3 5 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy current frame
        </button>
        <button class="ctx-item green" onclick={ctxCopyPath} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy file path
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxStartClipHere}
          role="menuitem"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="7"
              cy="8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><circle
              cx="7"
              cy="15.8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><path
              d="M9.5 9.6L19 5.2M9.5 14.2L19 19"
              stroke="currentColor"
              stroke-width="1.8"
            /></svg
          >
          Start Clip Here
        </button>
        <button class="ctx-item blue" onclick={ctxEndClipHere} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="17"
              cy="8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><circle
              cx="17"
              cy="15.8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><path
              d="M14.5 9.6L5 5.2M14.5 14.2L5 19"
              stroke="currentColor"
              stroke-width="1.8"
            /></svg
          >
          End Clip Here
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorer}
          role="menuitem"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          Show in explorer
        </button>
        <button class="ctx-item yellow" onclick={ctxProperties} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M12 10.5V16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
          >
          Properties
        </button>
        <div class="ctx-sep"></div>
        {#if timestamps.length > 0}
          <button
            class="ctx-item red"
            onclick={ctxClearTimestamps}
            role="menuitem"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2"
              /><path
                d="M9 9l6 6M15 9l-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            Delete Timestamps
          </button>
        {/if}
        {#if clipBoundaries.length > 0}
          <button
            class="ctx-item red"
            onclick={ctxClearSegments}
            role="menuitem"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2"
              /><path
                d="M8 8l8 8M16 8l-8 8"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            Delete Segments
          </button>
        {/if}
        <button class="ctx-item red" onclick={ctxDelete} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete
        </button>
      {/if}
    </div>
  {/if}

  {#if frameCopyToast.visible}
    <div
      class="copy-toast"
      class:error={frameCopyToast.tone === "error"}
      role="status"
      aria-live="polite"
    >
      {frameCopyToast.message}
    </div>
  {/if}
  {#if clipToast.visible}
    <div
      class="clip-toast"
      class:error={clipToast.tone === "error"}
      role="status"
      aria-live="polite"
      transition:fade={{ duration: 220 }}
    >
      <span>{clipToast.message}</span>
      {#if clipToast.tone === "success"}
        <button
          class="clip-toast-folder"
          onclick={async () => {
            try {
              await invokeOpenDirectory(
                clipToast.outputDir || clipOutputDir || parentFolder(),
              );
            } catch {}
          }}
          aria-label="open output folder"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          ></button
        >
      {/if}
    </div>
  {/if}

  {#if clipDeleteConfirm.visible}
    <div
      class="delete-overlay"
      role="presentation"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="delete-dialog" role="dialog" aria-modal="true">
        <p class="delete-title">Delete original after export?</p>
        <p class="delete-subtitle">{fileName}</p>
        <div class="delete-actions">
          <button
            class="delete-cancel"
            onclick={() => (clipDeleteConfirm = { visible: false, mode: null })}
            >Cancel</button
          >
          <button
            class="delete-confirm-btn"
            onclick={() => {
              if (clipDeleteConfirm.mode) runClipAction(clipDeleteConfirm.mode);
            }}>Continue</button
          >
        </div>
      </div>
    </div>
  {/if}

  {#if deleteConfirm}
    <div
      class="delete-overlay"
      role="presentation"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="delete-dialog" role="dialog" aria-modal="true">
        <p class="delete-title">Delete file?</p>
        <p class="delete-subtitle">{fileName}</p>
        <div class="delete-toggles">
          <label class="toggle-row">
            <span class="toggle-label">Do not ask again</span>
            <input type="checkbox" bind:checked={deleteNoAsk} />
            <span class="toggle-track" class:on={deleteNoAsk}
              ><span class="toggle-thumb"></span></span
            >
          </label>
          <label class="toggle-row">
            <span class="toggle-label">Delete permanently</span>
            <input type="checkbox" bind:checked={deletePermanently} />
            <span class="toggle-track" class:on={deletePermanently}
              ><span class="toggle-thumb"></span></span
            >
          </label>
        </div>
        <div class="delete-actions">
          <button class="delete-cancel" onclick={() => (deleteConfirm = false)}
            >Cancel</button
          >
          <button class="delete-confirm-btn" onclick={performDelete}
            >Delete</button
          >
        </div>
      </div>
    </div>
  {/if}

  {#if propertiesOpen}
    <div
      class="delete-overlay"
      role="presentation"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="delete-dialog props-dialog" role="dialog" aria-modal="true">
        <p class="delete-title">Properties</p>
        <p class="delete-subtitle">{fileName}</p>
        <div class="props-list">
          <div class="props-row">
            <span class="props-k">Type</span>
            <span class="props-v"
              >{isVideo ? "Video" : "Image"} ({fileExt() || "unknown"})</span
            >
          </div>
          <div class="props-row">
            <span class="props-k">Dimensions</span>
            <span class="props-v">{fileDimensions || "Unknown"}</span>
          </div>
          {#if ffprobeChecked && !ffprobeAvailable}
            <div class="ffprobe-note">
              <p class="ffprobe-title">Advanced metadata needs FFmpeg</p>
              <p class="ffprobe-sub">
                To show Container, Codec, Color, and Frame Rate, install FFmpeg.
                Your files stay local on your device and are not uploaded
                anywhere.
              </p>
              <div class="ffprobe-actions">
                <button
                  class="props-btn"
                  onclick={installFfmpegAndWait}
                  disabled={ffmpegInstalling}
                >
                  {ffmpegInstalling ? "Installing FFmpeg..." : "Install FFmpeg"}
                </button>
                <button
                  class="props-btn props-btn-secondary"
                  onclick={async () => {
                    await refreshFfprobeAvailability();
                    if (ffprobeAvailable) {
                      ffmpegInstallError = "";
                      await loadMediaProperties();
                    }
                  }}
                  disabled={ffmpegInstalling}
                >
                  Retry detection
                </button>
                {#if ffmpegInstalling}
                  <div class="ffprobe-progress"><span></span></div>
                {/if}
              </div>
              {#if ffmpegInstallError}
                <p class="ffprobe-error">{ffmpegInstallError}</p>
              {/if}
            </div>
          {:else}
            <div class="props-row">
              <span class="props-k">Container</span>
              <span class="props-v"
                >{mediaPropsLoading
                  ? "Loading..."
                  : showValue(mediaProps?.container)}</span
              >
            </div>
            <div class="props-row">
              <span class="props-k">Codec</span>
              <span class="props-v">
                {mediaPropsLoading
                  ? "Loading..."
                  : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`}
              </span>
            </div>
            <div class="props-row">
              <span class="props-k">Color</span>
              <span class="props-v">
                {mediaPropsLoading
                  ? "Loading..."
                  : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`}
              </span>
            </div>
            {#if isVideo}
              <div class="props-row">
                <span class="props-k">Duration</span>
                <span class="props-v">{durationDisplay}</span>
              </div>
              <div class="props-row">
                <span class="props-k">Frame rate</span>
                <span class="props-v"
                  >{mediaPropsLoading
                    ? "Loading..."
                    : showValue(mediaProps?.frame_rate)}</span
                >
              </div>
            {/if}
          {/if}
          <div class="props-row">
            <span class="props-k">Size</span>
            <span class="props-v">{fileSize || "Unknown"}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Created</span>
            <span class="props-v">{fileCreated || "Unknown"}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Modified</span>
            <span class="props-v">{fileModified || "Unknown"}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Folder</span>
            <span class="props-v">{parentFolder() || "Unknown"}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Path</span>
            <span class="props-v">{filePath || "Unknown"}</span>
          </div>
        </div>
        <div class="props-actions">
          <button class="props-btn" onclick={propsCopyPath}>Copy path</button>
          <button class="props-btn" onclick={propsOpenFolder}
            >Open folder</button
          >
          <button class="props-btn" onclick={propsCopyAll}
            >Copy all properties</button
          >
        </div>
        <div class="delete-actions">
          <button class="delete-cancel" onclick={() => (propertiesOpen = false)}
            >Close</button
          >
        </div>
      </div>
    </div>
  {/if}

  {#if tsTooltip.visible && !tsEditMenu.visible}
    <div
      class="ts-tooltip"
      class:blue={tsTooltip.tone === "blue"}
      class:green={tsTooltip.tone === "green"}
      style="left: {tsTooltip.x}px; top: {tsTooltip.y}px;"
    >
      {#if tsTooltip.title}
        <span class="ts-tooltip-title">{tsTooltip.title}</span>
      {/if}
      <span>{tsTooltip.timeLabel}</span>
    </div>
  {/if}

  {#if tsEditMenu.visible}
    {@const editingTimestamp = getActiveEditorTimestamp()}
    {@const editingSegment = getActiveEditorSegment()}
    {@const isSegmentMenu = !!editingSegment}
    {@const currentTitle = getEditorTitle()}
    {#if editingTimestamp || editingSegment}
      <div
        class="ts-edit-menu"
        class:blue={isSegmentMenu}
        style="left: {tsEditMenu.x}px; top: {tsEditMenu.y}px;"
        transition:fade={{ duration: 130 }}
      >
        <input
          class="ts-title-input"
          type="text"
          maxlength="100"
          placeholder="Title"
          value={currentTitle}
          style="width: {getTitleEditorWidthCh(currentTitle)}ch;"
          oninput={(e) =>
            updateEditorTitle((e.currentTarget as HTMLInputElement).value)}
          onkeydown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeTimestampEditor();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              closeTimestampEditor();
            }
          }}
        />
        <div
          class="ts-scissor-split"
          class:segment-toggle={isSegmentMenu}
          role="group"
          aria-label="segment type"
        >
          <button
            class="ts-split-btn left tooltip-ctrl"
            class:is-active={isSegmentMenu
              ? editingSegment?.kind === "start"
              : false}
            class:is-inactive={isSegmentMenu
              ? editingSegment?.kind !== "start"
              : false}
            data-tooltip="Start Clip Here"
            onclick={(e) => {
              e.stopPropagation();
              onEditorScissor("start");
            }}
            aria-label="Start Clip Here"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              ><circle
                cx="7"
                cy="8"
                r="2.2"
                stroke="currentColor"
                stroke-width="1.8"
              /><circle
                cx="7"
                cy="15.8"
                r="2.2"
                stroke="currentColor"
                stroke-width="1.8"
              /><path
                d="M9.5 9.6L19 5.2M9.5 14.2L19 19"
                stroke="currentColor"
                stroke-width="1.8"
              /></svg
            >
          </button>
          <button
            class="ts-split-btn right tooltip-ctrl"
            class:is-active={isSegmentMenu
              ? editingSegment?.kind === "end"
              : false}
            class:is-inactive={isSegmentMenu
              ? editingSegment?.kind !== "end"
              : false}
            data-tooltip="End Clip Here"
            onclick={(e) => {
              e.stopPropagation();
              onEditorScissor("end");
            }}
            aria-label="End Clip Here"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              ><circle
                cx="17"
                cy="8"
                r="2.2"
                stroke="currentColor"
                stroke-width="1.8"
              /><circle
                cx="17"
                cy="15.8"
                r="2.2"
                stroke="currentColor"
                stroke-width="1.8"
              /><path
                d="M14.5 9.6L5 5.2M14.5 14.2L5 19"
                stroke="currentColor"
                stroke-width="1.8"
              /></svg
            >
          </button>
        </div>
      </div>
    {/if}
  {/if}

  {#if volumeTooltipVisible}
    <div
      class="vol-tooltip"
      style="left: {volumeTooltipX}px; top: {volumeTooltipY - 32}px;"
    >
      {muted ? "0" : Math.round(volume * 100)}%
    </div>
  {/if}

  <div
    id="filename-tooltip"
    style="position:fixed;opacity:0;transition:opacity 0.15s ease 0.4s;background:#1a1a1a;color:#aaaaaa;font-size:11px;font-family:Inter,sans-serif;white-space:nowrap;padding:4px 8px;border-radius:4px;border:0.5px solid #2a2a2a;pointer-events:none;z-index:9999;"
  ></div>
</main>
