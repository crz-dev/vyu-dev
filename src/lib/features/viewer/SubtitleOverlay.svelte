<script lang="ts">
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import type { SubtitleSize } from "$lib/features/media/tracks.svelte";
  import { viewer } from "$lib/features/viewer/viewer.svelte";

  let {
    videoEl,
    trackEl,
    delayMs,
    size,
    resetKey,
    videoHovered,
    interactive = true,
  }: {
    videoEl: HTMLVideoElement | null;
    trackEl: HTMLTrackElement | null;
    delayMs: number;
    size: SubtitleSize;
    resetKey: string;
    videoHovered: boolean;
    interactive?: boolean;
  } = $props();

  const SIZE_FACTORS: Record<SubtitleSize, number> = {
    small: 0.85,
    default: 1,
    large: 1.3,
  };

  const CONTROLS_GAP = 8;

  let activeText = $state("");
  let dragging = $state(false);
  let blockHovered = $state(false);
  let lockedInset = $state(0);
  let controlsInset = $state(0);
  let x = $state(50);
  let y = $state(88);
  let positionInitialized = false;
  let videoRect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let containerRect = $state({ left: 0, top: 0, width: 0, height: 0 });

  const fontSize = $derived(
    Math.max(12, videoRect.height * 0.05 * SIZE_FACTORS[size]),
  );

  const controlsVisible = $derived(
    viewer.state.isFullscreen
      ? viewer.state.fsControlsVisible
      : videoHovered || accessibility.alwaysShowControls,
  );

  const effectiveInset = $derived(
    dragging || blockHovered
      ? lockedInset
      : controlsVisible
        ? controlsInset
        : 0,
  );

  const maxY = $derived(
    containerRect.height > 0
      ? Math.max(0, 100 - (effectiveInset / containerRect.height) * 100)
      : 100,
  );

  const displayY = $derived(Math.min(y, maxY));

  let frameId = 0;

  $effect(() => {
    void resetKey;
    x = 50;
    y = 88;
    positionInitialized = false;
    scheduleRectSync();
  });

  function cleanCueText(text: string): string {
    return text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\r/g, "")
      .trim();
  }

  function syncCues() {
    const video = videoEl;
    const track = trackEl?.track;
    if (!video || !track) {
      activeText = "";
      return;
    }

    const time = video.currentTime - delayMs / 1000;
    const cues = track.cues;
    const parts: string[] = [];

    if (cues) {
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i] as VTTCue;
        if (!cue) continue;
        const text = cue.text;
        if (typeof text !== "string") continue;
        if (cue.startTime <= time && time < cue.endTime) {
          const cleaned = cleanCueText(text);
          if (cleaned) parts.push(cleaned);
        }
      }
    }

    activeText = parts.join("\n");
  }

  function updateRect() {
    const video = videoEl;
    if (!video) return;

    const videoBox = video.getBoundingClientRect();
    if (
      Math.abs(videoBox.left - videoRect.left) >= 0.5 ||
      Math.abs(videoBox.top - videoRect.top) >= 0.5 ||
      Math.abs(videoBox.width - videoRect.width) >= 0.5 ||
      Math.abs(videoBox.height - videoRect.height) >= 0.5
    ) {
      videoRect = {
        left: videoBox.left,
        top: videoBox.top,
        width: videoBox.width,
        height: videoBox.height,
      };
    }

    const viewerEl = video.closest(".viewer");
    const containerBox = viewerEl?.getBoundingClientRect() ?? videoBox;
    if (
      Math.abs(containerBox.left - containerRect.left) >= 0.5 ||
      Math.abs(containerBox.top - containerRect.top) >= 0.5 ||
      Math.abs(containerBox.width - containerRect.width) >= 0.5 ||
      Math.abs(containerBox.height - containerRect.height) >= 0.5
    ) {
      containerRect = {
        left: containerBox.left,
        top: containerBox.top,
        width: containerBox.width,
        height: containerBox.height,
      };
    }
  }

  function updateControlsInset() {
    const video = videoEl;
    if (!video) return;

    const controls = viewer.state.isFullscreen
      ? document.querySelector<HTMLElement>(".fs-overlay .fs-controls")
      : (video
          .closest(".video-wrapper")
          ?.querySelector<HTMLElement>(".video-controls") ?? null);

    if (!controls) {
      if (controlsInset !== 0) controlsInset = 0;
      return;
    }

    const controlsRect = controls.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.top + containerRect.height;
    const overlap = Math.max(
      0,
      Math.min(containerBottom, controlsRect.bottom) -
        Math.max(containerTop, controlsRect.top),
    );
    const inset = overlap > 0 ? overlap + CONTROLS_GAP : 0;
    if (Math.abs(inset - controlsInset) >= 0.5) controlsInset = inset;
  }

  function refreshMetrics() {
    updateRect();
    updateControlsInset();
    initializePosition();
  }

  function initializePosition() {
    if (positionInitialized) return;
    if (videoRect.height <= 0 || containerRect.height <= 0) return;
    const videoBottom = videoRect.top + videoRect.height;
    y = clamp(
      ((videoBottom - containerRect.top) / containerRect.height) * 100,
      0,
      100,
    );
    positionInitialized = true;
  }

  function tick() {
    frameId = 0;
    syncCues();
    refreshMetrics();
    if (videoEl && !videoEl.paused && !videoEl.ended) {
      frameId = requestAnimationFrame(tick);
    }
  }

  function startLoop() {
    if (!frameId) frameId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  let rectSyncId = 0;

  function scheduleRectSync() {
    if (rectSyncId) return;
    rectSyncId = requestAnimationFrame(() => {
      refreshMetrics();
      rectSyncId = requestAnimationFrame(() => {
        refreshMetrics();
        rectSyncId = requestAnimationFrame(() => {
          refreshMetrics();
          rectSyncId = 0;
        });
      });
    });
  }

  $effect(() => {
    void viewer.state.isFullscreen;
    scheduleRectSync();
  });

  $effect(() => {
    const video = videoEl;
    if (!video) {
      activeText = "";
      return;
    }

    const onPlay = () => {
      if (trackElement) startLoop();
    };
    const onStop = () => {
      stopLoop();
      syncCues();
      scheduleRectSync();
    };
    const onSeek = () => {
      syncCues();
      scheduleRectSync();
    };
    const onResize = () => scheduleRectSync();
    const onWheel = () => scheduleRectSync();

    const viewerEl = video.closest(".viewer");
    let resizeObserver: ResizeObserver | null = null;
    if (viewerEl) {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(viewerEl);
    }

    const trackElement = trackEl;
    const track = trackElement?.track;
    track?.addEventListener("cuechange", syncCues);
    trackElement?.addEventListener("load", syncCues);

    video.addEventListener("play", onPlay);
    video.addEventListener("playing", onPlay);
    video.addEventListener("pause", onStop);
    video.addEventListener("ended", onStop);
    video.addEventListener("seeking", onSeek);
    video.addEventListener("seeked", onSeek);
    video.addEventListener("timeupdate", syncCues);
    video.addEventListener("loadedmetadata", onSeek);
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerup", onResize);

    syncCues();
    scheduleRectSync();
    if (!video.paused && trackElement) startLoop();

    return () => {
      if (rectSyncId) {
        cancelAnimationFrame(rectSyncId);
        rectSyncId = 0;
      }
      stopLoop();
      resizeObserver?.disconnect();
      track?.removeEventListener("cuechange", syncCues);
      trackElement?.removeEventListener("load", syncCues);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("playing", onPlay);
      video.removeEventListener("pause", onStop);
      video.removeEventListener("ended", onStop);
      video.removeEventListener("seeking", onSeek);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("timeupdate", syncCues);
      video.removeEventListener("loadedmetadata", onSeek);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerup", onResize);
    };
  });

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function handleBlockEnter() {
    if (dragging) return;
    lockedInset = displayY < y - 0.1 ? controlsInset : 0;
    blockHovered = true;
  }

  function handleBlockLeave() {
    blockHovered = false;
  }

  function startDrag(e: PointerEvent) {
    if (!interactive || e.button !== 0 || !videoEl) return;

    refreshMetrics();
    const viewerEl = videoEl.closest(".viewer");
    const rect = (viewerEl ?? videoEl).getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const block = e.currentTarget as HTMLElement;
    e.preventDefault();
    e.stopPropagation();
    lockedInset = displayY < y - 0.1 ? controlsInset : 0;
    dragging = true;
    const pointerId = e.pointerId;
    try {
      block.setPointerCapture(pointerId);
    } catch {
      // Pointer capture can fail if the pointer is already gone.
    }

    const blockRect = block.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = x;
    const startTop = displayY;
    const halfWidth = Math.min((blockRect.width / rect.width) * 50, 50);
    const height = Math.min((blockRect.height / rect.height) * 100, 100);

    function move(ev: PointerEvent) {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      x = clamp(startLeft + dx, halfWidth, 100 - halfWidth);
      y = clamp(startTop + dy, height, 100);
    }

    function end() {
      dragging = false;
      try {
        block.releasePointerCapture(pointerId);
      } catch {
        // Capture may already be released.
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
</script>

{#if activeText && containerRect.width > 0 && containerRect.height > 0}
  <div
    class="subtitle-overlay"
    style="left: {containerRect.left}px; top: {containerRect.top}px; width: {containerRect.width}px; height: {containerRect.height}px;"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="subtitle-block"
      class:draggable={interactive}
      class:dragging
      style="left: {x}%; top: {displayY}%; font-size: {fontSize}px;"
      onpointerdown={startDrag}
      onpointerenter={handleBlockEnter}
      onpointerleave={handleBlockLeave}
      onmousedown={(e) => e.stopPropagation()}
    >
      {activeText}
    </div>
  </div>
{/if}
