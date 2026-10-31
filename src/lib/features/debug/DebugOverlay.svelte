<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { debugPrefs } from "$lib/features/debug/debugPrefs.svelte";
  import { menuStore } from "$lib/features/menus/menuVisibility.svelte";

  let {
    fileName,
    filePath,
    isVideo,
    isAudio,
    isPdf,
    playing,
    getMediaEl,
    fileDimensions,
    zoomLevel,
    playbackSpeed,
    durationDisplay,
  }: {
    fileName: string;
    filePath: string;
    isVideo: boolean;
    isAudio: boolean;
    isPdf: boolean;
    playing: boolean;
    getMediaEl: () => HTMLMediaElement | null;
    fileDimensions: string;
    zoomLevel: number;
    playbackSpeed: number;
    durationDisplay: string;
  } = $props();

  const visible = $derived(debugPrefs.overlayOpen && !menuStore.isAnyOpen);

  let fps = $state(0);
  let frameMs = $state(0);
  let heapUsed = $state(0);
  let heapLimit = $state(0);
  let mediaTime = $state(0);
  let mediaDuration = $state(0);
  let readyState = $state(0);
  let buffered = $state(0);
  let paused = $state(true);
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  let raf = 0;
  let frames = 0;
  let lastFrame = 0;
  let lastSample = 0;
  let lastMediaSample = 0;

  function shortPath(path: string): string {
    if (!path) return "No file";
    const parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.slice(-2).join("\\");
  }

  function formatSeconds(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "0:00";
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function tick(now: number) {
    if (!lastFrame) {
      lastFrame = now;
      lastSample = now;
      lastMediaSample = now;
    }
    frames++;
    if (now - lastSample >= 500) {
      fps = Math.round((frames * 1000) / (now - lastSample));
      frameMs = (now - lastSample) / Math.max(frames, 1);
      frames = 0;
      lastSample = now;
      const memory = (
        performance as Performance & {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
        }
      ).memory;
      heapUsed = memory?.usedJSHeapSize ?? 0;
      heapLimit = memory?.jsHeapSizeLimit ?? 0;
    }
    if (now - lastMediaSample >= 250) {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      const el = getMediaEl();
      if (el) {
        mediaTime = el.currentTime;
        mediaDuration = el.duration;
        readyState = el.readyState;
        paused = el.paused;
        buffered =
          el.buffered.length > 0 ? el.buffered.end(el.buffered.length - 1) : 0;
      } else {
        mediaTime = 0;
        mediaDuration = 0;
        readyState = 0;
        paused = true;
        buffered = 0;
      }
      lastMediaSample = now;
    }
    lastFrame = now;
    raf = requestAnimationFrame(tick);
  }

  onMount(() => {
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
  });
</script>

{#if visible}
  <div class="debug-overlay" role="status" aria-label="Debug overlay">
    <div class="debug-overlay-header">
      <span>Debug</span>
      <button
        class="debug-overlay-close"
        onclick={() => debugPrefs.setOverlayOpen(false)}
        aria-label="Close debug overlay">×</button
      >
    </div>
    <div class="debug-overlay-grid">
      <span>FPS</span><strong>{fps}</strong>
      <span>Frame</span><strong>{frameMs.toFixed(1)} ms</strong>
      <span>Heap</span>
      <strong
        >{heapUsed
          ? `${(heapUsed / 1024 / 1024).toFixed(1)} MB`
          : "Unavailable"}</strong
      >
      <span>Heap limit</span>
      <strong
        >{heapLimit
          ? `${(heapLimit / 1024 / 1024).toFixed(0)} MB`
          : "—"}</strong
      >
      <span>File</span><strong title={filePath}>{shortPath(filePath)}</strong>
      <span>Type</span>
      <strong
        >{isVideo
          ? "video"
          : isAudio
            ? "audio"
            : isPdf
              ? "pdf"
              : filePath
                ? "image"
                : "none"}</strong
      >
      <span>Dimensions</span><strong>{fileDimensions || "—"}</strong>
      <span>Zoom</span><strong>{zoomLevel}%</strong>
      <span>Speed</span><strong>{playbackSpeed.toFixed(2)}x</strong>
      <span>State</span><strong
        >{paused ? "paused" : playing ? "playing" : "—"}</strong
      >
      <span>Time</span>
      <strong>{formatSeconds(mediaTime)} / {durationDisplay || "0:00"}</strong>
      <span>Ready</span><strong>{readyState}</strong>
      <span>Buffered</span><strong>{formatSeconds(buffered)}</strong>
      <span>Viewport</span>
      <strong>{viewportWidth} × {viewportHeight}</strong>
      <span>Name</span><strong title={fileName}>{fileName}</strong>
    </div>
  </div>
{/if}
