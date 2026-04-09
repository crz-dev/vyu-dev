<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { convertFileSrc, invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { readDir, stat } from '@tauri-apps/plugin-fs';
  import { open } from '@tauri-apps/plugin-dialog';

  let filePath = $state('');
  let fileSrc = $state('');
  let fileName = $state('no file open');
  let isVideo = $state(false);
  let fileList: string[] = $state([]);
  let currentIndex = $state(0);
  let fileSize = $state('');
  let fileDimensions = $state('');
  let fileCreated = $state('');
  let fileModified = $state('');
  let fileInfoLoading = $state(false);
  let isLoadingFile = $state(false);
  let loadingFadingOut = $state(false);
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;

  let videoEl = $state<HTMLVideoElement | null>(null);
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
  const VOLUME_SEGMENTS = 8;

  let hoverZone = $state('none');
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

  interface CtxMenu {
    x: number;
    y: number;
    visible: boolean;
  }
  let contextMenu = $state<CtxMenu>({ x: 0, y: 0, visible: false });
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(false);
  let propertiesOpen = $state(false);

  interface Timestamp {
    time: number;
  }
  let timestamps = $state<Timestamp[]>([]);
  interface ClipBoundary {
    id: string;
    time: number;
    kind: 'start' | 'end';
  }
  interface ClipPair {
    start: number;
    end: number;
    startId: string;
    endId: string;
  }
  interface ClipJobResult {
    outputs: string[];
    deleted_original: boolean;
    output_dir: string;
  }
  let clipBoundaries = $state<ClipBoundary[]>([]);
  let clipOutputDir = $state('');
  let clipDeleteOriginal = $state(false);
  let clipUseCustomPath = $state(false);
  let clipMergeSegments = $state(false);
  let clipJobRunning = $state(false);
  let clipJobLabel = $state('');
  let clipDeleteConfirm = $state<{ visible: boolean; mode: 'separate' | 'merge' | null }>({
    visible: false,
    mode: null,
  });
  let clipToast = $state<{
    visible: boolean;
    tone: 'success' | 'error';
    message: string;
    outputDir: string;
  }>({ visible: false, tone: 'success', message: '', outputDir: '' });
  let clipToastTimer: ReturnType<typeof setTimeout> | undefined;
  let clipMarkerJustDragged = false;
  interface MediaProperties {
    container?: string;
    video_codec?: string;
    audio_codec?: string;
    pixel_format?: string;
    color_space?: string;
    color_primaries?: string;
    color_transfer?: string;
    bit_depth?: string;
    frame_rate?: string;
  }
  let mediaProps = $state<MediaProperties | null>(null);
  let mediaPropsLoading = $state(false);
  let ffprobeAvailable = $state(true);
  let ffprobeChecked = $state(false);
  let ffmpegInstalling = $state(false);
  let ffmpegInstallError = $state('');
  let tsTooltip = $state<{
    visible: boolean;
    x: number;
    y: number;
    label: string;
    tone?: 'yellow' | 'blue';
  }>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    tone: 'yellow',
  });
  let frameCopyToast = $state<{ visible: boolean; message: string; tone: 'success' | 'error' }>({
    visible: false,
    message: '',
    tone: 'success',
  });
  let frameCopyToastTimer: ReturnType<typeof setTimeout> | undefined;

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv'];
  const allExts = [...imageExts, ...videoExts];

  const isQuarterTurn = $derived(Math.abs(imageRotation % 180) === 90);
  const rotationFitScale = $derived.by(() => {
    if (!isQuarterTurn || imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return 1;
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
  const panCursor = $derived(zoomLevel > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default');
  const fsCursor = $derived(!fsControlsVisible ? 'none' : panCursor);
  const isGifVideo = $derived(isVideo && fileExt() === 'gif');
  const clipPairs = $derived.by(() => {
    const sorted = [...clipBoundaries].sort((a, b) => a.time - b.time);
    const pendingStarts: ClipBoundary[] = [];
    const pairs: ClipPair[] = [];
    for (const marker of sorted) {
      if (marker.kind === 'start') {
        pendingStarts.push(marker);
      } else if (pendingStarts.length > 0) {
        const start = pendingStarts.shift()!;
        if (marker.time > start.time) {
          pairs.push({ start: start.time, end: marker.time, startId: start.id, endId: marker.id });
        }
      }
    }
    return pairs.sort((a, b) => a.start - b.start);
  });
  const clipCount = $derived(clipPairs.length);

  function currentTimeDisplay(): string {
    if (!timerShowRemaining) return formatTime(rawCurrentSecs);
    const rem = rawDurationSecs - rawCurrentSecs;
    return `-${formatTime(rem)}`;
  }
  const durationDisplay = $derived(formatTime(rawDurationSecs));
  const timerTooltip = $derived(timerShowRemaining ? 'Remaining' : 'Elapsed');

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatMetaDate(value: unknown): string {
    if (value === null || value === undefined) return 'Unknown';
    const asNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(asNumber)) return 'Unknown';
    const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleString();
  }

  function showFrameCopyToast(message: string, tone: 'success' | 'error') {
    clearTimeout(frameCopyToastTimer);
    frameCopyToast = { visible: true, message, tone };
    frameCopyToastTimer = setTimeout(() => {
      frameCopyToast = { ...frameCopyToast, visible: false };
    }, 2200);
  }

  function getMetaValue(obj: unknown, key: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;
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
    if (!videoEl) return;
    rawCurrentSecs = videoEl.currentTime;
    rawDurationSecs = videoEl.duration || 0;
    progress = rawDurationSecs > 0 ? (rawCurrentSecs / rawDurationSecs) * 100 : 0;
    playing = !videoEl.paused;
  }

  function togglePlay() {
    if (!videoEl) return;
    videoEl.paused ? videoEl.play() : videoEl.pause();
    playing = !videoEl.paused;
  }

  function toggleMute() {
    if (!videoEl) return;
    muted = !muted;
    videoEl.muted = muted;
  }

  function toggleLoop() {
    looping = !looping;
    if (videoEl) videoEl.loop = looping;
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
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
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
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (wasPlaying) videoEl!.play();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function setVolume(val: number) {
    volume = Math.max(0, Math.min(1, val));
    if (videoEl) {
      videoEl.volume = volume;
      muted = volume === 0;
      videoEl.muted = muted;
    }
    localStorage.setItem('vyu-volume', String(volume));
  }

  function handleVolumeScroll(e: WheelEvent) {
    e.preventDefault();
    setVolume(volume + (e.deltaY > 0 ? -0.125 : 0.125));
  }

  function startVolumeDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const diamonds = (e.currentTarget as HTMLElement).querySelectorAll('.volume-diamond');

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - first.left) / (last.right - first.left)));
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
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      volumeTooltipVisible = false;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
    if (!filePath) {
      timestamps = [];
      return;
    }
    try {
      const raw = localStorage.getItem(`vyu-ts-${filePath}`);
      timestamps = raw ? (JSON.parse(raw) as Timestamp[]) : [];
    } catch {
      timestamps = [];
    }
  }

  function saveTimestamps() {
    if (!filePath) return;
    localStorage.setItem(`vyu-ts-${filePath}`, JSON.stringify(timestamps));
  }

  function addTimestamp() {
    if (!videoEl || rawDurationSecs <= 0) return;
    const t = videoEl.currentTime;
    if (timestamps.some((ts) => Math.abs(ts.time - t) < 0.3)) return;
    timestamps = [...timestamps, { time: t }].sort((a, b) => a.time - b.time);
    saveTimestamps();
  }

  function removeTimestamp(time: number) {
    tsTooltip = { ...tsTooltip, visible: false };
    timestamps = timestamps.filter((ts) => ts.time !== time);
    saveTimestamps();
  }

  function clearAllTimestamps() {
    tsTooltip = { ...tsTooltip, visible: false };
    timestamps = [];
    if (filePath) localStorage.removeItem(`vyu-ts-${filePath}`);
  }

  function seekToTimestamp(time: number) {
    if (!videoEl) return;
    videoEl.currentTime = time;
    rawCurrentSecs = time;
    progress = rawDurationSecs > 0 ? (time / rawDurationSecs) * 100 : 0;
  }

  function getTimestampPct(time: number): number {
    return rawDurationSecs > 0 ? (time / rawDurationSecs) * 100 : 0;
  }

  function loadClipBoundaries() {
    if (!filePath) {
      clipBoundaries = [];
      return;
    }
    try {
      const raw = localStorage.getItem(`vyu-clips-${filePath}`);
      const parsed = raw ? (JSON.parse(raw) as ClipBoundary[]) : [];
      clipBoundaries = parsed
        .filter((m) => typeof m?.time === 'number' && (m.kind === 'start' || m.kind === 'end'))
        .map((m) => ({ ...m, id: m.id || `${m.kind}-${m.time}-${Math.random().toString(36).slice(2, 8)}` }))
        .sort((a, b) => a.time - b.time);
    } catch {
      clipBoundaries = [];
    }
  }

  function saveClipBoundaries() {
    if (!filePath) return;
    localStorage.setItem(`vyu-clips-${filePath}`, JSON.stringify(clipBoundaries));
  }

  function addClipBoundary(kind: 'start' | 'end') {
    if (!videoEl || rawDurationSecs <= 0) return;
    const time = Math.max(0, Math.min(videoEl.currentTime, rawDurationSecs));
    if (clipBoundaries.some((m) => m.kind === kind && Math.abs(m.time - time) < 0.25)) return;
    clipBoundaries = [
      ...clipBoundaries,
      { id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, time, kind },
    ].sort((a, b) => a.time - b.time);
    saveClipBoundaries();
  }

  function startClipMarkerDrag(e: MouseEvent, id: string) {
    if (e.button !== 0 || rawDurationSecs <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const markerEl = e.currentTarget as HTMLElement;
    const bar = markerEl.closest('.progress-bar, .fs-progress') as HTMLElement | null;
    if (!bar) return;
    const barEl = bar;

    let moved = false;

    function update(clientX: number, clientY: number) {
      const rect = barEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
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
          label: formatTime(marker.time),
          tone: 'blue',
        };
      }
    }

    function onMove(ev: MouseEvent) {
      moved = true;
      update(ev.clientX, ev.clientY);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      tsTooltip = { ...tsTooltip, visible: false };
      if (moved) {
        clipMarkerJustDragged = true;
        saveClipBoundaries();
        setTimeout(() => {
          clipMarkerJustDragged = false;
        }, 0);
      }
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function removeClipBoundary(id: string) {
    tsTooltip = { ...tsTooltip, visible: false };
    clipBoundaries = clipBoundaries.filter((m) => m.id !== id);
    saveClipBoundaries();
  }

  function persistClipPrefs() {
    localStorage.setItem('vyu-clip-delete-original', String(clipDeleteOriginal));
    localStorage.setItem('vyu-clip-use-custom-path', String(clipUseCustomPath));
    localStorage.setItem('vyu-clip-merge-segments', String(clipMergeSegments));
  }

  function getClipTargetDir(): string {
    return clipUseCustomPath ? clipOutputDir || parentFolder() : parentFolder();
  }

  function showClipToast(
    message: string,
    tone: 'success' | 'error',
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
    if (typeof e === 'string' && e.trim()) return e;
    if (e && typeof e === 'object') {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    try {
      const asJson = JSON.stringify(e);
      if (asJson && asJson !== '{}') return asJson;
    } catch {}
    return 'Failed to create clips.';
  }

  async function runClipAction(mode: 'separate' | 'merge') {
    if (!isVideo || clipCount === 0 || clipJobRunning) return;
    clipJobRunning = true;
    clipJobLabel = mode === 'separate' ? 'Separating clips...' : 'Merging clips...';
    try {
      const result = (await invoke('process_video_clips', {
        path: filePath,
        outputDir: getClipTargetDir(),
        segments: sanitizeClipPairs(),
        mode,
        deleteOriginal: clipDeleteOriginal,
      })) as ClipJobResult;
      const count = result.outputs.length;
      const noun = count === 1 ? 'clip' : 'clips';
      const msg =
        mode === 'merge'
          ? `${count} ${noun} created${result.deleted_original ? ' and original file deleted' : ''}.`
          : `${count} ${noun} created${result.deleted_original ? ' and original file deleted' : ''}.`;
      showClipToast(msg, 'success', result.output_dir || clipOutputDir || parentFolder());
      clipBoundaries = [];
      saveClipBoundaries();
      if (result.deleted_original) {
        const deletedPath = filePath;
        const prevList = [...fileList];
        const prevIndex = currentIndex;
        closeFile();
        const remaining = prevList.filter((p) => p !== deletedPath);
        if (remaining.length > 0) {
          const nextIndex = Math.max(0, Math.min(prevIndex, remaining.length - 1));
          loadFile(remaining[nextIndex]);
        }
      } else {
        await displayFile(filePath);
      }
    } catch (e) {
      const msg = extractInvokeErrorMessage(e);
      showClipToast(msg, 'error');
    } finally {
      clipJobRunning = false;
      clipJobLabel = '';
      clipDeleteConfirm = { visible: false, mode: null };
    }
  }

  function requestClipAction(mode: 'separate' | 'merge') {
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
    localStorage.setItem('vyu-clip-output-dir', clipOutputDir);
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
    requestClipAction(clipMergeSegments ? 'merge' : 'separate');
  }

  async function displayFile(path: string) {
    filePath = path;
    fileName = path.split('\\').pop() || path.split('/').pop() || path;
    const ext = path.split('.').pop()?.toLowerCase() || '';
    isVideo = videoExts.includes(ext);
    fileSrc = convertFileSrc(path);
    fileSize = '';
    fileDimensions = '';
    fileCreated = '';
    fileModified = '';
    fileInfoLoading = true;
    imageRotation = 0;
    imageFlipped = false;
    imageNaturalWidth = 0;
    imageNaturalHeight = 0;
    rawCurrentSecs = 0;
    rawDurationSecs = 0;
    progress = 0;
    playing = false;
    timestamps = [];
    clipBoundaries = [];
    resetZoom();
    if (isVideo) loadTimestamps();
    if (isVideo) loadClipBoundaries();
    try {
      const info = await stat(path);
      fileSize = formatFileSize(info.size);
      fileCreated = formatMetaDate(
        getMetaValue(info, 'birthtime') ??
          getMetaValue(info, 'birthtimeMs') ??
          getMetaValue(info, 'createdAt'),
      );
      fileModified = formatMetaDate(
        getMetaValue(info, 'mtime') ??
          getMetaValue(info, 'mtimeMs') ??
          getMetaValue(info, 'modifiedAt'),
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
    const sep = path.includes('\\') ? '\\' : '/';
    const folder = path.substring(0, path.lastIndexOf(sep));
    try {
      const entries = await readDir(folder);
      fileList = entries
        .filter((e) => allExts.includes(e.name?.split('.').pop()?.toLowerCase() ?? ''))
        .map((e) => `${folder}${sep}${e.name}`)
        .sort();
      currentIndex = fileList.indexOf(path);
    } catch {}
  }

  function navigate(direction: number) {
    if (fileList.length === 0) return;
    currentIndex = (currentIndex + direction + fileList.length) % fileList.length;
    displayFile(fileList[currentIndex]);
  }

  function navigateToEdge(first: boolean) {
    if (fileList.length === 0) return;
    currentIndex = first ? 0 : fileList.length - 1;
    displayFile(fileList[currentIndex]);
  }

  function closeFile() {
    filePath = '';
    fileSrc = '';
    fileName = 'no file open';
    isVideo = false;
    fileList = [];
    currentIndex = 0;
    playing = false;
    progress = 0;
    rawCurrentSecs = 0;
    rawDurationSecs = 0;
    fileSize = '';
    fileDimensions = '';
    fileCreated = '';
    fileModified = '';
    isLoadingFile = false;
    loadingFadingOut = false;
    imageRotation = 0;
    imageFlipped = false;
    imageNaturalWidth = 0;
    imageNaturalHeight = 0;
    timestamps = [];
    clipBoundaries = [];
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
    const newZoom = Math.max(100, Math.min(1000, zoomLevel > 100 && raw < 100 ? 100 : raw));
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
    const newZoom = Math.max(100, Math.min(1000, zoomLevel * (dist / lastPinchDist)));
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
        '.video-controls, .fs-controls, .fs-topbar, .fs-nav-left, .fs-nav-right, .context-menu, .delete-overlay',
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
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async function startDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, .filename')) return;
    await getCurrentWindow().startDragging();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (contextMenu.visible || deleteConfirm || propertiesOpen) {
      if (e.key === 'Escape') {
        contextMenu.visible = false;
        deleteConfirm = false;
        propertiesOpen = false;
      }
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowRight') {
      e.preventDefault();
      navigateToEdge(false);
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateToEdge(true);
      return;
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      navigate(1);
      return;
    }
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      navigate(-1);
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
      return;
    }
    if (e.key === 'Escape' && isFullscreen) {
      toggleFullscreen();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVolume(volume + 0.125);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVolume(volume - 0.125);
      return;
    }
    if (['ArrowRight', 'ArrowLeft', ' '].includes(e.key)) e.preventDefault();
    if (isVideo && videoEl && (hoverZone === 'video' || isFullscreen)) {
      if (e.key === ' ') togglePlay();
      if (e.key === 'ArrowRight')
        videoEl.currentTime = Math.min(videoEl.currentTime + 5, videoEl.duration);
      if (e.key === 'ArrowLeft') videoEl.currentTime = Math.max(videoEl.currentTime - 5, 0);
    } else {
      if (e.key === ' ' && isVideo && videoEl) togglePlay();
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft') navigate(-1);
    }
  }

  async function openFileDialog() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Media', extensions: [...imageExts, ...videoExts] }],
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
    return filePath.split('.').pop()?.toLowerCase() || '';
  }

  function parentFolder(): string {
    const sep = filePath.includes('\\') ? '\\' : '/';
    return filePath.includes(sep) ? filePath.substring(0, filePath.lastIndexOf(sep)) : '';
  }

  function showValue(v: string | undefined): string {
    return v && v.trim() ? v : 'Unknown';
  }

  async function loadMediaProperties() {
    mediaPropsLoading = true;
    try {
      mediaProps = (await invoke('get_media_properties', { path: filePath })) as MediaProperties;
    } catch {
      mediaProps = null;
    } finally {
      mediaPropsLoading = false;
    }
  }

  async function refreshFfprobeAvailability() {
    ffprobeChecked = false;
    try {
      ffprobeAvailable = (await invoke('check_ffprobe')) as boolean;
    } catch {
      ffprobeAvailable = false;
    } finally {
      ffprobeChecked = true;
    }
  }

  async function installFfmpegAndWait() {
    ffmpegInstallError = '';
    ffmpegInstalling = true;
    try {
      await invoke('install_ffmpeg');
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
        ffmpegInstallError = 'Install still running. Reopen Properties in a moment.';
      }
    } catch (e) {
      ffmpegInstallError = e instanceof Error ? e.message : 'Failed to start FFmpeg install.';
    } finally {
      ffmpegInstalling = false;
    }
  }

  async function ctxCopyImage() {
    closeContextMenu();
    try {
      const response = await fetch(fileSrc);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {}
  }

  async function ctxCopyFrame() {
    closeContextMenu();
    if (!videoEl) return;
    if (videoEl.readyState < 2 || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
      showFrameCopyToast('Frame not ready yet.', 'error');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    try {
      // Use synchronous PNG encoding to keep clipboard write in the click activation path.
      const dataUrl = canvas.toDataURL('image/png');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) throw new Error('Could not encode frame as PNG.');
      const binary = atob(dataUrl.slice(commaIdx + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('Image clipboard API is unavailable in this runtime.');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showFrameCopyToast('Current frame copied as PNG.', 'success');
    } catch (err) {
      console.error('Failed to copy current frame to clipboard:', err);
      const message =
        err instanceof DOMException && err.name === 'SecurityError'
          ? 'Frame copy blocked by canvas security (cross-origin source).'
          : err instanceof Error
            ? err.message
            : 'Could not copy frame to clipboard.';
      showFrameCopyToast(message, 'error');
    }
  }

  function ctxCopyPath() {
    closeContextMenu();
    navigator.clipboard.writeText(filePath);
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
  function ctxStartClipHere() {
    closeContextMenu();
    addClipBoundary('start');
  }
  function ctxEndClipHere() {
    closeContextMenu();
    addClipBoundary('end');
  }

  async function ctxShowInExplorer() {
    closeContextMenu();
    try {
      await invoke('show_in_explorer', { path: filePath });
    } catch {}
  }

  function ctxProperties() {
    closeContextMenu();
    propertiesOpen = true;
    mediaProps = null;
    ffmpegInstallError = '';
    void (async () => {
      await refreshFfprobeAvailability();
      if (ffprobeAvailable) await loadMediaProperties();
    })();
  }

  async function propsCopyPath() {
    try {
      await navigator.clipboard.writeText(filePath);
    } catch {}
  }

  async function propsOpenFolder() {
    try {
      await invoke('open_folder', { path: filePath });
    } catch {}
  }

  async function propsCopyAll() {
    const lines = [
      `Name: ${fileName}`,
      `Type: ${isVideo ? 'Video' : 'Image'} (${fileExt() || 'unknown'})`,
      `Container: ${showValue(mediaProps?.container)}`,
      `Video codec: ${showValue(mediaProps?.video_codec)}`,
      `Audio codec: ${showValue(mediaProps?.audio_codec)}`,
      `Pixel format: ${showValue(mediaProps?.pixel_format)}`,
      `Color space: ${showValue(mediaProps?.color_space)}`,
      `Color primaries: ${showValue(mediaProps?.color_primaries)}`,
      `Color transfer: ${showValue(mediaProps?.color_transfer)}`,
      `Bit depth: ${showValue(mediaProps?.bit_depth)}`,
      `Frame rate: ${showValue(mediaProps?.frame_rate)}`,
      `Dimensions: ${fileDimensions || 'Unknown'}`,
      ...(isVideo ? [`Duration: ${durationDisplay}`] : []),
      `Size: ${fileSize || 'Unknown'}`,
      `Created: ${fileCreated || 'Unknown'}`,
      `Modified: ${fileModified || 'Unknown'}`,
      `Folder: ${parentFolder() || 'Unknown'}`,
      `Path: ${filePath || 'Unknown'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {}
  }

  function ctxDelete() {
    closeContextMenu();
    const noAsk = localStorage.getItem('vyu-delete-no-ask') === 'true';
    if (noAsk) performDelete();
    else deleteConfirm = true;
  }

  async function performDelete() {
    deleteConfirm = false;
    if (deleteNoAsk) localStorage.setItem('vyu-delete-no-ask', 'true');
    const pathToDelete = filePath;
    const prevList = [...fileList];
    const prevIndex = currentIndex;
    closeFile();
    try {
      if (deletePermanently) await invoke('delete_file', { path: pathToDelete });
      else await invoke('trash_file', { path: pathToDelete });
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
    const tip = document.getElementById('filename-tooltip');
    if (!tip) return;
    tip.textContent = 'File name';
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.bottom + 6}px`;
    tip.style.opacity = '1';
  }

  function hideFilenameTooltip() {
    const tip = document.getElementById('filename-tooltip');
    if (tip) tip.style.opacity = '0';
  }

  onMount(() => {
    const initial = (window as any).__INITIAL_FILE__;
    if (initial) loadFile(initial);

    const saved = localStorage.getItem('vyu-volume');
    if (saved !== null) volume = parseFloat(saved);
    const savedClipOutput = localStorage.getItem('vyu-clip-output-dir');
    if (savedClipOutput) clipOutputDir = savedClipOutput;
    clipDeleteOriginal = localStorage.getItem('vyu-clip-delete-original') === 'true';
    clipUseCustomPath = localStorage.getItem('vyu-clip-use-custom-path') === 'true';
    clipMergeSegments = localStorage.getItem('vyu-clip-merge-segments') === 'true';

    getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'drop' && event.payload.paths?.length > 0)
        loadFile(event.payload.paths[0]);
    });

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('mousedown', (e) => {
      if (contextMenu.visible && !(e.target as HTMLElement).closest('.context-menu'))
        closeContextMenu();
    });

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      clearTimeout(frameCopyToastTimer);
      clearTimeout(clipToastTimer);
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
      onmouseleave={hideFilenameTooltip}
      >{fileName}</span
    >
    {#if fileSrc}
      <span class="divider">/</span>
      <button
        class="folder-btn tooltip-below"
        data-tooltip="Close file"
        onclick={closeFile}
        aria-label="close file">⏏️</button
      >
      <span class="divider">/</span>
      <button
        class="folder-btn tooltip-below"
        data-tooltip="Open file"
        onclick={openFileDialog}
        aria-label="open file">📁</button
      >
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
      onmouseenter={() => (hoverZone = 'sidebar')}
      onmouseleave={() => (hoverZone = 'none')}
      role="presentation"
    >
      <button class="nav-btn" onclick={() => navigate(-1)} aria-label="previous file">‹</button>
    </div>

    <div
      class="viewer"
      onmouseenter={() => (hoverZone = isVideo ? 'video' : 'sidebar')}
      onmouseleave={() => (hoverZone = 'none')}
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
        <img src={fileSrc} alt={fileName} onload={onImageLoad} style={imageStyle} />
      {:else if fileSrc && isVideo}
        <div
          class="video-wrapper"
          role="presentation"
          onmouseenter={() => (hoverZone = 'video')}
          onmouseleave={() => (hoverZone = 'none')}
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
                  style="left: {getTimestampPct(pair.start)}%; width: {getTimestampPct(pair.end) - getTimestampPct(pair.start)}%;"
                ></div>
              {/each}
              {#each clipBoundaries as marker (marker.id)}
                <div
                  class="clip-marker {marker.kind === 'start' ? 'start-marker' : 'end-marker'}"
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
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    tsTooltip = {
                      visible: true,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      label: formatTime(marker.time),
                      tone: 'blue',
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
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      seekToTimestamp(marker.time);
                    }
                  }}
                  aria-label="{marker.kind} clip marker at {formatTime(marker.time)}"
                ></div>
              {/each}
              {#each timestamps as ts (ts.time)}
                <div
                  class="ts-marker"
                  style="left: {getTimestampPct(ts.time)}%"
                  role="button"
                  tabindex="0"
                  onmousedown={(e) => e.stopPropagation()}
                  onclick={(e) => {
                    e.stopPropagation();
                    seekToTimestamp(ts.time);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      seekToTimestamp(ts.time);
                    }
                  }}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeTimestamp(ts.time);
                  }}
                  onmouseenter={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    tsTooltip = {
                      visible: true,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      label: formatTime(ts.time),
                      tone: 'yellow',
                    };
                  }}
                  onmouseleave={() => {
                    tsTooltip = { ...tsTooltip, visible: false };
                  }}
                  aria-label="timestamp {formatTime(ts.time)}"
                ></div>
              {/each}
            </div>
            <div class="controls-row" class:hide-for-gif={isGifVideo}>
              <button
                class="ctrl-btn tooltip-ctrl"
                data-tooltip={playing ? 'Pause' : 'Play'}
                onclick={togglePlay}
                aria-label={playing ? 'pause' : 'play'}
              >
                {#if playing}
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
                    ><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect
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
                  data-tooltip={muted || volume === 0 ? 'Unmute' : 'Mute'}
                  onclick={toggleMute}
                  aria-label={muted ? 'unmute' : 'mute'}
                >
                  {#if muted || volume === 0}
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
                      ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><line
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
                      ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
                        d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /></svg
                    >
                  {:else}
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
                      ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
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
                        aria-label="set volume {Math.round(((i + 1) / VOLUME_SEGMENTS) * 100)}%"
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
                  ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
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
                data-tooltip={playing ? 'Pause GIF' : 'Play GIF'}
                onclick={togglePlay}
                aria-label={playing ? 'pause gif' : 'play gif'}
              >
                {#if playing}
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                    ><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect
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
      onmouseenter={() => (hoverZone = 'sidebar')}
      onmouseleave={() => (hoverZone = 'none')}
      role="presentation"
    >
      <button class="nav-btn" onclick={() => navigate(1)} aria-label="next file">›</button>
    </div>
  </div>

  <div class="bottombar">
    <span class="file-count tooltip-above-shift-right" data-tooltip="File position"
      >{fileList.length > 0 ? `${currentIndex + 1} / ${fileList.length}` : '—'}</span
    >
    <span class="file-info tooltip-above" data-tooltip="Resolution · File size">
      {#if fileDimensions && fileSize}
        {fileDimensions} · {fileSize}
      {:else if !fileInfoLoading && fileName !== 'no file open'}
        {fileName}
      {:else if !fileSrc}
        no file open
      {/if}
    </span>
    <div class="bottombar-right">
      <button class="zoom tooltip-above" data-tooltip="Reset zoom" onclick={resetZoom}
        >{Math.round(zoomLevel)}%</button
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
    <div class="clip-actions" transition:fly={{ y: 26, duration: 190, opacity: 0.08 }}>
      <button class="clip-main-btn" onclick={triggerClipSegments} disabled={clipJobRunning}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><circle cx="6.5" cy="8" r="2.5" stroke="currentColor" stroke-width="2" /><circle
            cx="6.5"
            cy="16"
            r="2.5"
            stroke="currentColor"
            stroke-width="2"
          /><path d="M9 9.5L20 4M9 14.5L20 20" stroke="currentColor" stroke-width="2" /></svg
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
          data-tooltip={getClipTargetDir() || 'No output path'}
          title={getClipTargetDir() || 'No output path'}
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
          <button class="fs-wc-btn" onclick={minimizeWindow} aria-label="minimize">−</button>
          <button class="fs-wc-btn" onclick={maximizeWindow} aria-label="maximize">▢</button>
          <button class="fs-wc-btn close" onclick={closeWindow} aria-label="close">✕</button>
        </div>
      </div>
      <div class="fs-nav-left">
        <button class="fs-nav-btn" onclick={() => navigate(-1)} aria-label="previous file">‹</button
        >
      </div>
      <div class="fs-nav-right">
        <button class="fs-nav-btn" onclick={() => navigate(1)} aria-label="next file">›</button>
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
                style="left: {getTimestampPct(pair.start)}%; width: {getTimestampPct(pair.end) - getTimestampPct(pair.start)}%;"
              ></div>
            {/each}
            {#each clipBoundaries as marker (marker.id)}
              <div
                class="fs-clip-marker {marker.kind === 'start' ? 'start-marker' : 'end-marker'}"
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
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  tsTooltip = {
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    label: formatTime(marker.time),
                    tone: 'blue',
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
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    seekToTimestamp(marker.time);
                  }
                }}
                aria-label="{marker.kind} clip marker at {formatTime(marker.time)}"
              ></div>
            {/each}
            {#each timestamps as ts (ts.time)}
              <div
                class="ts-marker"
                style="left: {getTimestampPct(ts.time)}%"
                role="button"
                tabindex="0"
                onmousedown={(e) => e.stopPropagation()}
                onclick={(e) => {
                  e.stopPropagation();
                  seekToTimestamp(ts.time);
                }}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    seekToTimestamp(ts.time);
                  }
                }}
                oncontextmenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTimestamp(ts.time);
                }}
                onmouseenter={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  tsTooltip = {
                    visible: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 8,
                    label: formatTime(ts.time),
                    tone: 'yellow',
                  };
                }}
                onmouseleave={() => {
                  tsTooltip = { ...tsTooltip, visible: false };
                }}
                aria-label="timestamp {formatTime(ts.time)}"
              ></div>
            {/each}
          </div>
          <div class="fs-controls-row" class:hide-for-gif={isGifVideo}>
            <button
              class="fs-ctrl-btn tooltip-ctrl"
              data-tooltip={playing ? 'Pause' : 'Play'}
              onclick={togglePlay}
              aria-label={playing ? 'pause' : 'play'}
            >
              {#if playing}
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
                  ><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect
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
                data-tooltip={muted || volume === 0 ? 'Unmute' : 'Mute'}
                onclick={toggleMute}
                aria-label={muted ? 'unmute' : 'mute'}
              >
                {#if muted || volume === 0}
                  <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
                    ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><line
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
                    ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
                      d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    /></svg
                  >
                {:else}
                  <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
                    ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
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
                      aria-label="set volume {Math.round(((i + 1) / VOLUME_SEGMENTS) * 100)}%"
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
                ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
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
              <button class="fs-ctrl-btn" onclick={toggleFullscreen} aria-label="exit fullscreen">
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
              data-tooltip={playing ? 'Pause GIF' : 'Play GIF'}
              onclick={togglePlay}
              aria-label={playing ? 'pause gif' : 'play gif'}
            >
              {#if playing}
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none"
                  ><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect
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
              >{fileList.length > 0 ? `${currentIndex + 1} / ${fileList.length}` : ''}</span
            >
            <div class="fs-right">
              <button class="fs-ctrl-btn" onclick={toggleFullscreen} aria-label="exit fullscreen">
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
    <div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;" role="menu">
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
        <button class="ctx-item yellow" onclick={ctxShowInExplorer} role="menuitem">
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
            ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
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
        <button class="ctx-item blue" onclick={ctxStartClipHere} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle cx="7" cy="8" r="2.2" stroke="currentColor" stroke-width="1.8" /><circle
              cx="7"
              cy="15.8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><path d="M9.5 9.6L19 5.2M9.5 14.2L19 19" stroke="currentColor" stroke-width="1.8" /></svg
          >
          Start Clip Here
        </button>
        <button class="ctx-item blue" onclick={ctxEndClipHere} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle cx="17" cy="8" r="2.2" stroke="currentColor" stroke-width="1.8" /><circle
              cx="17"
              cy="15.8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><path d="M14.5 9.6L5 5.2M14.5 14.2L5 19" stroke="currentColor" stroke-width="1.8" /></svg
          >
          End Clip Here
        </button>
        <div class="ctx-sep"></div>
        <button class="ctx-item yellow" onclick={ctxShowInExplorer} role="menuitem">
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
            ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
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
          <button class="ctx-item red" onclick={ctxClearTimestamps} role="menuitem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
                d="M9 9l6 6M15 9l-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            Delete Timestamps
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
    <div class="copy-toast" class:error={frameCopyToast.tone === 'error'} role="status" aria-live="polite">
      {frameCopyToast.message}
    </div>
  {/if}
  {#if clipToast.visible}
    <div
      class="clip-toast"
      class:error={clipToast.tone === 'error'}
      role="status"
      aria-live="polite"
      transition:fade={{ duration: 220 }}
    >
      <span>{clipToast.message}</span>
      {#if clipToast.tone === 'success'}
        <button
          class="clip-toast-folder"
          onclick={async () => {
            try {
              await invoke('open_directory', { path: clipToast.outputDir || clipOutputDir || parentFolder() });
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
    <div class="delete-overlay" role="presentation" onmousedown={(e) => e.stopPropagation()}>
      <div class="delete-dialog" role="dialog" aria-modal="true">
        <p class="delete-title">Delete original after export?</p>
        <p class="delete-subtitle">{fileName}</p>
        <div class="delete-actions">
          <button class="delete-cancel" onclick={() => (clipDeleteConfirm = { visible: false, mode: null })}
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
    <div class="delete-overlay" role="presentation" onmousedown={(e) => e.stopPropagation()}>
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
          <button class="delete-cancel" onclick={() => (deleteConfirm = false)}>Cancel</button>
          <button class="delete-confirm-btn" onclick={performDelete}>Delete</button>
        </div>
      </div>
    </div>
  {/if}

  {#if propertiesOpen}
    <div class="delete-overlay" role="presentation" onmousedown={(e) => e.stopPropagation()}>
      <div class="delete-dialog props-dialog" role="dialog" aria-modal="true">
        <p class="delete-title">Properties</p>
        <p class="delete-subtitle">{fileName}</p>
        <div class="props-list">
          <div class="props-row">
            <span class="props-k">Type</span>
            <span class="props-v">{isVideo ? 'Video' : 'Image'} ({fileExt() || 'unknown'})</span>
          </div>
          <div class="props-row">
            <span class="props-k">Dimensions</span>
            <span class="props-v">{fileDimensions || 'Unknown'}</span>
          </div>
          {#if ffprobeChecked && !ffprobeAvailable}
            <div class="ffprobe-note">
              <p class="ffprobe-title">Advanced metadata needs FFmpeg</p>
              <p class="ffprobe-sub">
                To show Container, Codec, Color, and Frame Rate, install FFmpeg. Your files stay
                local on your device and are not uploaded anywhere.
              </p>
              <div class="ffprobe-actions">
                <button
                  class="props-btn"
                  onclick={installFfmpegAndWait}
                  disabled={ffmpegInstalling}
                >
                  {ffmpegInstalling ? 'Installing FFmpeg...' : 'Install FFmpeg'}
                </button>
                <button
                  class="props-btn props-btn-secondary"
                  onclick={async () => {
                    await refreshFfprobeAvailability();
                    if (ffprobeAvailable) {
                      ffmpegInstallError = '';
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
                >{mediaPropsLoading ? 'Loading...' : showValue(mediaProps?.container)}</span
              >
            </div>
            <div class="props-row">
              <span class="props-k">Codec</span>
              <span class="props-v">
                {mediaPropsLoading
                  ? 'Loading...'
                  : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ''}`}
              </span>
            </div>
            <div class="props-row">
              <span class="props-k">Color</span>
              <span class="props-v">
                {mediaPropsLoading
                  ? 'Loading...'
                  : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ''}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ''}`}
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
                  >{mediaPropsLoading ? 'Loading...' : showValue(mediaProps?.frame_rate)}</span
                >
              </div>
            {/if}
          {/if}
          <div class="props-row">
            <span class="props-k">Size</span>
            <span class="props-v">{fileSize || 'Unknown'}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Created</span>
            <span class="props-v">{fileCreated || 'Unknown'}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Modified</span>
            <span class="props-v">{fileModified || 'Unknown'}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Folder</span>
            <span class="props-v">{parentFolder() || 'Unknown'}</span>
          </div>
          <div class="props-row">
            <span class="props-k">Path</span>
            <span class="props-v">{filePath || 'Unknown'}</span>
          </div>
        </div>
        <div class="props-actions">
          <button class="props-btn" onclick={propsCopyPath}>Copy path</button>
          <button class="props-btn" onclick={propsOpenFolder}>Open folder</button>
          <button class="props-btn" onclick={propsCopyAll}>Copy all properties</button>
        </div>
        <div class="delete-actions">
          <button class="delete-cancel" onclick={() => (propertiesOpen = false)}>Close</button>
        </div>
      </div>
    </div>
  {/if}

  {#if tsTooltip.visible}
    <div class="ts-tooltip" class:blue={tsTooltip.tone === 'blue'} style="left: {tsTooltip.x}px; top: {tsTooltip.y}px;">
      {tsTooltip.label}
    </div>
  {/if}

  {#if volumeTooltipVisible}
    <div class="vol-tooltip" style="left: {volumeTooltipX}px; top: {volumeTooltipY - 32}px;">
      {muted ? '0' : Math.round(volume * 100)}%
    </div>
  {/if}

  <div
    id="filename-tooltip"
    style="position:fixed;opacity:0;transition:opacity 0.15s ease 0.4s;background:#1a1a1a;color:#aaaaaa;font-size:11px;font-family:Inter,sans-serif;white-space:nowrap;padding:4px 8px;border-radius:4px;border:0.5px solid #2a2a2a;pointer-events:none;z-index:9999;"
  ></div>
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    background: #000;
    margin: 0;
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    height: 36px;
    background: #111111;
    border-bottom: 0.5px solid #222222;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 8px;
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }
  .app-name {
    font-size: 16px;
    color: #888888;
    font-family: Inter, sans-serif;
  }
  .divider {
    font-size: 14px;
    color: #444444;
    font-family: Inter, sans-serif;
  }
  .filename {
    font-size: 12px;
    color: #cccccc;
    font-family: Inter, sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
    pointer-events: auto;
    cursor: default;
  }
  .folder-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.2s;
    color: #666666;
  }
  .folder-btn:hover {
    background: #1a1a1a;
    color: #aaaaaa;
  }
  .window-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .wc-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s,
      color 0.2s;
    color: #666666;
  }
  .wc-btn:hover {
    background: #1a1a1a;
    color: #cccccc;
  }
  .wc-btn.close:hover {
    background: #3a1a1a;
    color: #ff6666;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    background: #0a0a0a;
  }
  .sidebar {
    width: 48px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .nav-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #1a1a1a;
    border: 0.5px solid #2a2a2a;
    color: #444444;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      color 0.2s,
      background 0.2s;
    line-height: 1;
  }
  .nav-btn:hover {
    color: #cccccc;
    background: #222222;
  }

  .viewer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0a;
    overflow: hidden;
    padding: 16px;
    box-sizing: border-box;
  }

  .empty {
    background: none;
    border: 1px dashed #222222;
    border-radius: 8px;
    padding: 32px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .empty:hover {
    border-color: #444444;
  }
  .empty-icon {
    font-size: 24px;
    color: #333333;
  }
  .empty-text {
    font-size: 13px;
    color: #333333;
    font-family: Inter, sans-serif;
  }

  .bottombar {
    height: 36px;
    background: #0d0d0d;
    border-top: 0.5px solid #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
  }
  .file-count,
  .file-info {
    font-size: 12px;
    color: #444444;
    font-family: Inter, sans-serif;
  }
  .bottombar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .zoom {
    font-size: 12px;
    color: #444444;
    font-family: Inter, sans-serif;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.2s;
    background: none;
    border: none;
  }
  .zoom:hover {
    color: #888888;
  }
  .fs-btn {
    background: none;
    border: none;
    color: #444444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 3px;
    transition: color 0.2s;
  }
  .fs-btn:hover {
    color: #888888;
  }

  .video-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
    line-height: 0;
    border-radius: 2px;
    outline: 4px solid transparent;
    transition: outline-color 0.5s;
  }
  .video-wrapper:hover {
    outline-color: #7a7a7a;
  }
  
  .video-wrapper video {
    display: block;
    max-width: calc(100vw - 96px - 32px);
    max-height: calc(100vh - 36px - 36px - 32px);
    width: auto;
    height: auto;
    object-fit: contain;
    cursor: pointer;
  }

  .video-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px 12px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    display: flex;
    flex-direction: column;
    gap: 6px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .video-wrapper:hover .video-controls {
    opacity: 1;
  }
  .video-controls.gif-only {
    top: 0;
    padding: 0;
    background: none;
    gap: 0;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .video-controls.gif-only .hide-for-gif {
    display: none;
  }
  .gif-center-btn {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.25);
    pointer-events: auto;
  }
  .gif-center-btn:hover {
    background: rgba(0, 0, 0, 0.62);
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #333333;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    border: none;
    padding: 0;
    overflow: visible;
  }
  .progress-fill {
    height: 100%;
    background: #ffffff;
    border-radius: 2px;
    pointer-events: none;
  }
  .progress-playhead {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #ffffff;
    transform: translate(-50%, -50%) rotate(45deg);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .video-wrapper:hover .progress-playhead {
    opacity: 1;
  }
  .clip-range {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(59, 130, 246, 0.46);
    border-left: 1px solid rgba(147, 197, 253, 0.9);
    border-right: 1px solid rgba(147, 197, 253, 0.9);
    pointer-events: none;
    z-index: 1;
  }
  .clip-marker {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    background: #3b82f6;
    transform: translate(-50%, -50%) rotate(45deg);
    cursor: pointer;
    z-index: 3;
    border: 1px solid rgba(191, 219, 254, 0.75);
    transition: transform 0.15s;
  }
  .clip-marker:hover {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.25);
  }
  .clip-marker.start-marker::before,
  .clip-marker.start-marker::after,
  .clip-marker.end-marker::before,
  .clip-marker.end-marker::after {
    content: '';
    position: absolute;
    width: 5px;
    height: 1.5px;
    background: #dbeafe;
    top: 50%;
    border-radius: 999px;
    transform-origin: center;
  }
  .clip-marker.start-marker::before {
    left: -8px;
    transform: translateY(-3px) rotate(45deg);
  }
  .clip-marker.start-marker::after {
    left: -8px;
    transform: translateY(2px) rotate(-45deg);
  }
  .clip-marker.end-marker::before {
    right: -8px;
    transform: translateY(-3px) rotate(-45deg);
  }
  .clip-marker.end-marker::after {
    right: -8px;
    transform: translateY(2px) rotate(45deg);
  }

  .ts-marker {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    background: #f5c518;
    transform: translate(-50%, -50%) rotate(45deg);
    cursor: pointer;
    z-index: 2;
    transition: transform 0.15s;
  }
  .ts-marker:hover {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.4);
  }

  .ts-tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    background: #1a1a1a;
    color: #f5c518;
    font-size: 11px;
    font-family: Inter, sans-serif;
    padding: 3px 7px;
    border-radius: 4px;
    border: 0.5px solid #f5c518;
    pointer-events: none;
    z-index: 9999;
    white-space: nowrap;
  }
  .ts-tooltip.blue {
    color: #60a5fa;
    border-color: #60a5fa;
  }
  .vol-tooltip {
    position: fixed;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: #ffffff;
    font-size: 11px;
    font-family: Inter, sans-serif;
    padding: 3px 8px;
    border-radius: 4px;
    border: 0.5px solid #333333;
    pointer-events: none;
    z-index: 9999;
    white-space: nowrap;
  }

  .controls-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .controls-spacer {
    flex: 1;
  }

  .ctrl-btn {
    background: none;
    border: none;
    color: #cccccc;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 4px;
    line-height: 0;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .ctrl-btn svg {
    width: 18px;
    height: 18px;
    display: block;
    margin: 0 auto;
    flex-shrink: 0;
  }
  .ctrl-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }
  .loop-btn {
    color: #555555;
  }
  .loop-btn.active {
    color: #ffffff;
  }
  .loop-btn:hover {
    color: #aaaaaa;
  }
  .loop-btn.active:hover {
    color: #ffffff;
  }
  .add-ts-btn {
    color: #555555;
  }
  .add-ts-btn:hover {
    color: #f5c518;
    background: rgba(245, 197, 24, 0.1);
  }

  .time-display {
    font-size: 13px;
    color: #cccccc;
    font-family: Inter, sans-serif;
    background: none;
    border: none;
    cursor: pointer;
    height: 34px;
    padding: 0 10px;
    border-radius: 4px;
    transition:
      background 0.15s,
      color 0.15s;
    white-space: nowrap;
  }
  .time-display:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .volume-control {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 34px;
  }
  .volume-btn {
    width: 34px;
    height: 34px;
    color: #555555;
  }
  .volume-btn svg {
    width: 20px;
    height: 20px;
  }
  .volume-btn.active {
    color: #ffffff;
  }
  .volume-btn:hover {
    color: #aaaaaa;
  }
  .volume-btn.active:hover {
    color: #ffffff;
  }
  .volume-control.audio-off .volume-diamonds {
    opacity: 0.45;
  }
  .volume-diamonds {
    display: flex;
    align-items: center;
    gap: 5px;
    animation: volumeBarIn 0.2s ease forwards;
    cursor: pointer;
  }
  @keyframes volumeBarIn {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .volume-diamond {
    width: 13px;
    height: 13px;
    background: none;
    border: 1px solid #555555;
    transform: rotate(45deg);
    cursor: pointer;
    padding: 0;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      opacity 0.15s ease;
    flex-shrink: 0;
    animation: diamondSpin 0.25s ease forwards;
    animation-delay: calc(var(--i) * 0.03s);
    opacity: 0;
  }
  @keyframes diamondSpin {
    from {
      opacity: 0;
      transform: rotate(0deg) scale(0.3);
    }
    to {
      opacity: 1;
      transform: rotate(45deg) scale(1);
    }
  }
  .volume-diamond.filled {
    background: #ffffff;
    border-color: #ffffff;
  }
  .volume-diamond.muted-diamond {
    opacity: 0.25;
  }
  .volume-diamond.muted-diamond.filled {
    background: #666666;
    border-color: #666666;
  }
  .volume-diamond:hover {
    border-color: #aaaaaa;
  }

  main.fullscreen .topbar {
    display: none;
  }
  main.fullscreen .bottombar {
    display: none;
  }
  main.fullscreen .sidebar {
    display: none;
  }
  main.fullscreen .viewer {
    padding: 0;
  }
  main.fullscreen .video-controls {
    display: none;
  }
  main.fullscreen .video-wrapper {
    width: 100%;
    height: 100%;
  }
  main.fullscreen .video-wrapper video {
    max-width: 100vw;
    max-height: 100vh;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .fs-overlay {
    position: fixed;
    inset: 0;
    pointer-events: all;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 100;
  }
  .fs-overlay.visible {
    opacity: 1;
  }
  .fs-topbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 0 16px;
    height: 40px;
    background: linear-gradient(rgba(0, 0, 0, 0.85), transparent);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .fs-filename {
    font-size: 12px;
    color: #888888;
    font-family: Inter, sans-serif;
  }
  .fs-window-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .fs-wc-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.2s,
      color 0.2s;
    color: #666666;
  }
  .fs-wc-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #cccccc;
  }
  .fs-wc-btn.close:hover {
    background: rgba(255, 0, 0, 0.2);
    color: #ff6666;
  }

  .fs-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fs-controls.image-only {
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  }
  .fs-controls.gif-only {
    top: 0;
    padding: 0;
    background: none;
    gap: 0;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .fs-controls.gif-only .hide-for-gif {
    display: none;
  }
  .fs-gif-center-btn {
    width: 66px;
    height: 66px;
    border-radius: 999px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.28);
    pointer-events: auto;
  }
  .fs-gif-center-btn:hover {
    background: rgba(0, 0, 0, 0.68);
  }
  .fs-progress {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    overflow: visible;
  }
  .fs-progress-fill {
    height: 100%;
    background: #ffffff;
    border-radius: 2px;
    pointer-events: none;
  }
  .fs-progress-playhead {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: #ffffff;
    transform: translate(-50%, -50%) rotate(45deg);
    pointer-events: none;
  }
  .fs-clip-range {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(59, 130, 246, 0.46);
    border-left: 1px solid rgba(147, 197, 253, 0.9);
    border-right: 1px solid rgba(147, 197, 253, 0.9);
    pointer-events: none;
    z-index: 1;
  }
  .fs-clip-marker {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    background: #3b82f6;
    transform: translate(-50%, -50%) rotate(45deg);
    cursor: pointer;
    z-index: 3;
    border: 1px solid rgba(191, 219, 254, 0.75);
    transition: transform 0.15s;
  }
  .fs-clip-marker:hover {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.25);
  }
  .fs-clip-marker.start-marker::before,
  .fs-clip-marker.start-marker::after,
  .fs-clip-marker.end-marker::before,
  .fs-clip-marker.end-marker::after {
    content: '';
    position: absolute;
    width: 5px;
    height: 1.5px;
    background: #dbeafe;
    top: 50%;
    border-radius: 999px;
    transform-origin: center;
  }
  .fs-clip-marker.start-marker::before {
    left: -8px;
    transform: translateY(-3px) rotate(45deg);
  }
  .fs-clip-marker.start-marker::after {
    left: -8px;
    transform: translateY(2px) rotate(-45deg);
  }
  .fs-clip-marker.end-marker::before {
    right: -8px;
    transform: translateY(-3px) rotate(-45deg);
  }
  .fs-clip-marker.end-marker::after {
    right: -8px;
    transform: translateY(2px) rotate(45deg);
  }
  .fs-controls-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .fs-ctrl-btn {
    background: none;
    border: none;
    color: #cccccc;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 4px;
    line-height: 0;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .fs-ctrl-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }
  .fs-ctrl-btn svg {
    width: 22px;
    height: 22px;
    display: block;
    margin: 0 auto;
    flex-shrink: 0;
  }
  .fs-ctrl-btn.loop-btn {
    color: #555555;
  }
  .fs-ctrl-btn.loop-btn.active {
    color: #ffffff;
  }
  .fs-ctrl-btn.loop-btn:hover {
    color: #aaaaaa;
  }
  .fs-ctrl-btn.loop-btn.active:hover {
    color: #ffffff;
  }
  .fs-ctrl-btn.add-ts-btn {
    color: #555555;
  }
  .fs-ctrl-btn.add-ts-btn:hover {
    color: #f5c518;
    background: rgba(245, 197, 24, 0.1);
  }
  .fs-ctrl-btn.volume-btn {
    color: #555555;
  }
  .fs-ctrl-btn.volume-btn svg {
    width: 24px;
    height: 24px;
  }
  .fs-ctrl-btn.volume-btn.active {
    color: #ffffff;
  }
  .fs-ctrl-btn.volume-btn:hover {
    color: #aaaaaa;
  }
  .fs-ctrl-btn.volume-btn.active:hover {
    color: #ffffff;
  }
  .fs-time {
    font-size: 14px;
    color: #888888;
    font-family: Inter, sans-serif;
    background: none;
    border: none;
    cursor: pointer;
    height: 42px;
    padding: 0 12px;
    border-radius: 4px;
    transition:
      background 0.15s,
      color 0.15s;
    white-space: nowrap;
  }
  .fs-time:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
  .fs-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fs-nav-left,
  .fs-nav-right {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fs-nav-left {
    left: 16px;
  }
  .fs-nav-right {
    right: 16px;
  }
  .fs-nav-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 0.5px solid rgba(255, 255, 255, 0.1);
    color: #666666;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      color 0.2s,
      background 0.2s;
    line-height: 1;
  }
  .fs-nav-btn:hover {
    color: #cccccc;
    background: rgba(0, 0, 0, 0.7);
  }

  .context-menu {
    position: fixed;
    background: #141414;
    border: 0.5px solid #2a2a2a;
    border-radius: 10px;
    padding: 5px;
    z-index: 1000;
    min-width: 185px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ctx-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-family: Inter, sans-serif;
    text-align: left;
    transition: filter 0.12s;
  }
  .ctx-item.green {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }
  .ctx-item.green:hover {
    background: rgba(34, 197, 94, 0.26);
  }
  .ctx-item.blue {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }
  .ctx-item.blue:hover {
    background: rgba(59, 130, 246, 0.26);
  }
  .ctx-item.yellow {
    background: rgba(234, 179, 8, 0.15);
    color: #facc15;
  }
  .ctx-item.yellow:hover {
    background: rgba(234, 179, 8, 0.26);
  }
  .ctx-item.red {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  .ctx-item.red:hover {
    background: rgba(239, 68, 68, 0.26);
  }
  .ctx-sep {
    height: 0.5px;
    background: #2a2a2a;
    margin: 2px 4px;
  }
  .copy-toast {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 1105;
    background: rgba(22, 101, 52, 0.94);
    border: 0.5px solid rgba(74, 222, 128, 0.45);
    color: #dcfce7;
    font-size: 12px;
    font-family: Inter, sans-serif;
    padding: 8px 11px;
    border-radius: 8px;
    max-width: min(420px, calc(100vw - 32px));
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  }
  .copy-toast.error {
    background: rgba(127, 29, 29, 0.95);
    border-color: rgba(248, 113, 113, 0.5);
    color: #fee2e2;
  }
  .clip-actions {
    position: fixed;
    left: 50%;
    bottom: 48px;
    transform: translateX(-50%);
    z-index: 1100;
    width: min(430px, calc(100vw - 24px));
    background: rgba(17, 17, 17, 0.97);
    border: 0.5px solid #2a2a2a;
    border-radius: 9px;
    padding: 7px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5);
    align-items: center;
  }
  .clip-main-btn {
    width: 100%;
    border: 0.5px solid rgba(96, 165, 250, 0.42);
    background: rgba(59, 130, 246, 0.24);
    color: #bfdbfe;
    border-radius: 7px;
    font-family: Inter, sans-serif;
    font-size: 11px;
    font-weight: 600;
    padding: 8px 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    cursor: pointer;
    transition: background 0.16s;
  }
  .clip-main-btn:hover {
    background: rgba(59, 130, 246, 0.35);
  }
  .clip-main-btn:disabled,
  .clip-toggle-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .clip-options-grid {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 5px;
  }
  .clip-toggle-btn {
    min-width: 0;
    border-radius: 7px;
    border: 0.5px solid #323232;
    background: rgba(255, 255, 255, 0.055);
    color: #7d7d7d;
    font-family: Inter, sans-serif;
    font-size: 11px;
    padding: 7px 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition:
      background 0.16s,
      color 0.16s,
      border-color 0.16s,
      opacity 0.16s;
    opacity: 0.58;
  }
  .clip-toggle-btn span {
    white-space: nowrap;
  }
  .clip-toggle-btn.is-on {
    opacity: 1;
  }
  .clip-toggle-btn.red.is-on {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(248, 113, 113, 0.45);
    color: #fda4af;
  }
  .clip-toggle-btn.yellow.is-on {
    background: rgba(245, 197, 24, 0.2);
    border-color: rgba(245, 197, 24, 0.45);
    color: #facc15;
  }
  .clip-toggle-btn.green.is-on {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(74, 222, 128, 0.45);
    color: #86efac;
  }
  .clip-toggle-btn:not(.is-on):hover {
    opacity: 0.74;
  }
  .clip-job-progress {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .clip-job-progress > span {
    font-size: 11px;
    color: #9aa4b2;
    font-family: Inter, sans-serif;
  }
  .clip-job-bar {
    width: 100%;
    height: 4px;
    border-radius: 999px;
    background: #1f2937;
    overflow: hidden;
  }
  .clip-job-bar span {
    display: block;
    width: 38%;
    height: 100%;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0.35), #60a5fa);
    animation: clipJobAnim 1s ease-in-out infinite;
  }
  @keyframes clipJobAnim {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(280%);
    }
  }
  .clip-toast {
    position: fixed;
    right: 16px;
    bottom: 58px;
    z-index: 1106;
    max-width: min(480px, calc(100vw - 28px));
    background: rgba(22, 101, 52, 0.95);
    border: 0.5px solid rgba(74, 222, 128, 0.45);
    color: #dcfce7;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    font-family: Inter, sans-serif;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  }
  .clip-toast.error {
    background: rgba(127, 29, 29, 0.95);
    border-color: rgba(248, 113, 113, 0.5);
    color: #fee2e2;
  }
  .clip-toast-folder {
    width: 24px;
    height: 24px;
    border: 0.5px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .clip-toast-folder:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .delete-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .delete-dialog {
    background: #141414;
    border: 0.5px solid #2a2a2a;
    border-radius: 12px;
    padding: 24px;
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  }
  .props-dialog {
    width: 420px;
    max-width: calc(100vw - 32px);
    gap: 10px;
  }
  .props-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
    border: 0.5px solid #2a2a2a;
    border-radius: 8px;
    padding: 10px;
    background: #101010;
  }
  .props-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .props-k {
    width: 86px;
    flex-shrink: 0;
    font-size: 11px;
    color: #666666;
    font-family: Inter, sans-serif;
  }
  .props-v {
    min-width: 0;
    flex: 1;
    font-size: 11px;
    color: #bbbbbb;
    font-family: Inter, sans-serif;
    word-break: break-word;
  }
  .props-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .ffprobe-note {
    border: 0.5px solid #2a2a2a;
    background: #121212;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ffprobe-title {
    margin: 0;
    font-size: 12px;
    color: #facc15;
    font-family: Inter, sans-serif;
  }
  .ffprobe-sub {
    margin: 0;
    font-size: 11px;
    color: #999999;
    font-family: Inter, sans-serif;
    line-height: 1.4;
  }
  .ffprobe-actions {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .ffprobe-progress {
    width: 100%;
    height: 4px;
    background: #232323;
    border-radius: 999px;
    overflow: hidden;
  }
  .ffprobe-progress span {
    display: block;
    height: 100%;
    width: 40%;
    background: linear-gradient(90deg, rgba(250, 204, 21, 0.35), #facc15);
    animation: ffprobeBar 1s ease-in-out infinite;
  }
  .ffprobe-error {
    margin: 0;
    font-size: 11px;
    color: #f87171;
    font-family: Inter, sans-serif;
  }
  @keyframes ffprobeBar {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(260%);
    }
  }
  .props-btn {
    padding: 6px 10px;
    border-radius: 7px;
    border: 0.5px solid rgba(234, 179, 8, 0.35);
    background: rgba(234, 179, 8, 0.14);
    color: #facc15;
    font-size: 11px;
    font-family: Inter, sans-serif;
    cursor: pointer;
    transition: background 0.15s;
  }
  .props-btn:hover {
    background: rgba(234, 179, 8, 0.24);
  }
  .props-btn.props-btn-secondary {
    background: rgba(255, 255, 255, 0.04);
    border-color: #2f2f2f;
    color: #a9a9a9;
  }
  .props-btn.props-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .props-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .delete-title {
    font-size: 15px;
    color: #ffffff;
    font-family: Inter, sans-serif;
    font-weight: 600;
    margin: 0;
  }
  .delete-subtitle {
    font-size: 11px;
    color: #555555;
    font-family: Inter, sans-serif;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .delete-toggles {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 0;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }
  .toggle-row input {
    display: none;
  }
  .toggle-label {
    font-size: 12px;
    color: #888888;
    font-family: Inter, sans-serif;
  }
  .toggle-track {
    width: 36px;
    height: 20px;
    background: #2a2a2a;
    border-radius: 10px;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle-track.on {
    background: #3b82f6;
  }
  .toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    background: #ffffff;
    border-radius: 50%;
    transition: left 0.2s;
  }
  .toggle-track.on .toggle-thumb {
    left: 19px;
  }
  .delete-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .delete-cancel {
    padding: 7px 16px;
    border-radius: 7px;
    border: 0.5px solid #2a2a2a;
    background: #1a1a1a;
    color: #888888;
    font-size: 12px;
    font-family: Inter, sans-serif;
    cursor: pointer;
    transition:
      background 0.2s,
      color 0.2s;
  }
  .delete-cancel:hover {
    background: #222222;
    color: #cccccc;
  }
  .delete-confirm-btn {
    padding: 7px 16px;
    border-radius: 7px;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    font-size: 12px;
    font-family: Inter, sans-serif;
    cursor: pointer;
    transition: background 0.2s;
  }
  .delete-confirm-btn:hover {
    background: rgba(239, 68, 68, 0.35);
  }

  :global(.border-sweep) {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 200;
    overflow: hidden;
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask-composite: exclude;
    padding: 3px;
  }
  :global(.border-sweep::before) {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 300%;
    height: 300%;
    translate: -50% -50%;
    background: conic-gradient(
      from 70deg,
      transparent 60%,
      rgba(255, 255, 255, 0.8) 80%,
      white 85%,
      rgba(255, 255, 255, 0.8) 90%,
      transparent 100%
    );
    animation: borderSweep 1.2s linear infinite;
  }
  :global(.border-sweep.fading::before) {
    animation:
      borderSweep 1s linear infinite,
      sweepFade 0.5s ease-out forwards;
  }
  @keyframes borderSweep {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes sweepFade {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  [data-tooltip] {
    position: relative;
    display: inline-block;
  }
  [data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: #aaaaaa;
    font-size: 11px;
    font-family: Inter, sans-serif;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 4px;
    border: 0.5px solid #2a2a2a;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    transition-delay: 0.4s;
    z-index: 999;
  }
  [data-tooltip].tooltip-above::after {
    bottom: calc(100% + 6px);
  }
  [data-tooltip].tooltip-above-shift-right::after {
    bottom: calc(100% + 6px);
    left: 0;
    transform: translateX(-10px);
  }
  [data-tooltip].tooltip-above-shift-left::after {
    bottom: calc(100% + 6px);
    left: auto;
    right: 0;
    transform: translateX(8px);
  }
  [data-tooltip].tooltip-below::after {
    top: calc(100% + 6px);
  }
  [data-tooltip]:hover::after {
    opacity: 1;
  }

  .tooltip-ctrl {
    position: relative;
  }
  .tooltip-ctrl::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: #aaaaaa;
    font-size: 11px;
    font-family: Inter, sans-serif;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 4px;
    border: 0.5px solid #2a2a2a;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    transition-delay: 0.5s;
    z-index: 9999;
  }
  .tooltip-ctrl:hover::after {
    opacity: 1;
  }
</style>
