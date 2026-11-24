<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { viewer } from "$lib/features/viewer/viewer.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import type {
    SubtitleCue,
    SubtitleCueImage,
    SubtitleDocument,
    SubtitleSize,
    SubtitleStyleSettings,
    SubtitleTextRun,
  } from "$lib/shared/types";

  let {
    videoEl,
    subtitleDoc,
    delayMs,
    subtitleStyle,
    offsetX,
    offsetY,
    resetKey,
    videoHovered,
    interactive = true,
    onOffsetChange,
    onResetPosition,
  }: {
    videoEl: HTMLVideoElement | null;
    subtitleDoc: SubtitleDocument | null;
    delayMs: number;
    subtitleStyle: SubtitleStyleSettings;
    offsetX: number;
    offsetY: number;
    resetKey: string;
    videoHovered: boolean;
    interactive?: boolean;
    onOffsetChange: (x: number, y: number) => void;
    onResetPosition: () => void;
  } = $props();

  const t = locale.t;

  const SIZE_FACTORS: Record<SubtitleSize, number> = {
    small: 0.85,
    default: 1,
    large: 1.3,
  };

  const FONT_FALLBACK = `var(--font-family), "Segoe UI", Arial, sans-serif`;
  const CONTROLS_GAP = 8;
  const OFFSET_LIMIT = 50;

  let activeCues = $state.raw<SubtitleCue[]>([]);
  let dragging = $state(false);
  let blockHovered = $state(false);
  let lockedInset = $state(0);
  let controlsInset = $state(0);
  let defaultY = $state(88);
  let positionInitialized = false;
  let previewOffsetX = $state(0);
  let previewOffsetY = $state(0);
  let positionAnnouncement = $state("");
  let videoRect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let containerRect = $state({ left: 0, top: 0, width: 0, height: 0 });

  const displayOffsetX = $derived(dragging ? previewOffsetX : offsetX);
  const displayOffsetY = $derived(dragging ? previewOffsetY : offsetY);

  const fontSize = $derived(
    Math.max(12, videoRect.height * 0.05 * SIZE_FACTORS[subtitleStyle.size]),
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

  const displayY = $derived(clamp(defaultY + displayOffsetY, 0, maxY));

  const activeTextCues = $derived(
    activeCues.filter((cue) => cue.lines.length > 0),
  );
  const activeBitmapCues = $derived(
    activeCues.filter((cue) => cue.images.length > 0),
  );
  const plainTextCues = $derived(activeTextCues.filter((cue) => !cue.anchor));
  const positionedTextCues = $derived(
    activeTextCues.filter((cue) => cue.anchor),
  );
  const plainLines = $derived(plainTextCues.flatMap((cue) => cue.lines));
  const liveText = $derived(
    activeTextCues
      .map((cue) =>
        cue.lines
          .map((line) => line.map((run) => run.text).join(""))
          .join("\n"),
      )
      .join("\n"),
  );

  let frameId = 0;
  let lastLayoutKey = "";
  let rectSyncId = 0;

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function syncCues() {
    const video = videoEl;
    const doc = subtitleDoc;
    if (!video || !doc) {
      if (activeCues.length > 0) activeCues = [];
      return;
    }
    const time = video.currentTime - delayMs / 1000;
    const next: SubtitleCue[] = [];
    for (const cue of doc.cues) {
      if (cue.start <= time && time < cue.end) next.push(cue);
    }
    if (
      next.length !== activeCues.length ||
      next.some((cue, index) => cue !== activeCues[index])
    ) {
      activeCues = next;
    }
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
    const containerBox =
      videoBox.width > 0 && videoBox.height > 0
        ? videoBox
        : (viewerEl?.getBoundingClientRect() ?? videoBox);
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
      ? globalThis.document.querySelector<HTMLElement>(
          ".fs-overlay .fs-controls",
        )
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
    defaultY = clamp(
      ((videoBottom - containerRect.top) / containerRect.height) * 100,
      0,
      100,
    );
    positionInitialized = true;
  }

  function layoutKey(): string {
    const state = viewer.state;
    return `${state.zoomLevel}|${state.translateX}|${state.translateY}|${state.isFullscreen ? 1 : 0}`;
  }

  function tick() {
    frameId = 0;
    syncCues();
    const key = layoutKey();
    if (key !== lastLayoutKey) {
      lastLayoutKey = key;
      refreshMetrics();
    }
    if (videoEl && !videoEl.paused && !videoEl.ended && subtitleDoc) {
      frameId = requestAnimationFrame(tick);
    }
  }

  function startLoop() {
    lastLayoutKey = "";
    if (!frameId) frameId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

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
    void resetKey;
    previewOffsetX = offsetX;
    previewOffsetY = offsetY;
    positionInitialized = false;
    scheduleRectSync();
  });

  $effect(() => {
    void viewer.state.isFullscreen;
    scheduleRectSync();
  });

  $effect(() => {
    void delayMs;
    syncCues();
  });

  $effect(() => {
    void subtitleDoc;
    syncCues();
    scheduleRectSync();
    if (videoEl && !videoEl.paused && subtitleDoc) startLoop();
  });

  $effect(() => {
    const video = videoEl;
    if (!video) {
      activeCues = [];
      return;
    }

    const onPlay = () => {
      if (subtitleDoc) startLoop();
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
    if (!video.paused) startLoop();

    return () => {
      if (rectSyncId) {
        cancelAnimationFrame(rectSyncId);
        rectSyncId = 0;
      }
      stopLoop();
      resizeObserver?.disconnect();
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

  function horizontal(alignment: number): "left" | "center" | "right" {
    const value = (alignment - 1) % 3;
    return value === 0 ? "left" : value === 2 ? "right" : "center";
  }

  function vertical(alignment: number): "top" | "middle" | "bottom" {
    const value = Math.floor((alignment - 1) / 3);
    return value === 0 ? "bottom" : value === 2 ? "top" : "middle";
  }

  function anchorStyle(cue: SubtitleCue): string {
    const anchor = cue.anchor;
    if (!anchor) return "";
    const x = clamp(anchor.x + displayOffsetX, 0, 100);
    const y = clamp(anchor.y + displayOffsetY, 0, 100);
    const h = horizontal(anchor.alignment);
    const v = vertical(anchor.alignment);
    const translateX = h === "left" ? "0%" : h === "center" ? "-50%" : "-100%";
    const translateY =
      v === "bottom" ? "-100%" : v === "middle" ? "-50%" : "0%";
    const maxWidth = anchor.maxWidth ?? 90;
    return `left:${x}%; top:${y}%; transform:translate(${translateX}, ${translateY}); max-width:${maxWidth}%; text-align:${h};`;
  }

  function plainStyle(cue: SubtitleCue | null): string {
    const x = clamp(50 + displayOffsetX, 0, 100);
    const background = blockBackground(cue);
    return `left:${x}%; top:${displayY}%; transform:translate(-50%, -100%); max-width:90%; text-align:center; background:${background};`;
  }

  function blockBackground(cue: SubtitleCue | null): string {
    if (subtitleStyle.useFileStyles && cue) {
      return cue.background ?? "transparent";
    }
    switch (subtitleStyle.background) {
      case "none":
        return "transparent";
      case "solid":
        return "rgba(0, 0, 0, 0.88)";
      default:
        return "rgba(0, 0, 0, 0.68)";
    }
  }

  function fontStack(fontFamily: string): string {
    if (!fontFamily) return FONT_FALLBACK;
    const safe = fontFamily.replace(/["\\\n\r]/g, "");
    return `"${safe}", ${FONT_FALLBACK}`;
  }

  function shadow(width: number, color: string): string {
    const value = Math.max(0.5, width);
    return `-${value}px -${value}px 0 ${color}, ${value}px -${value}px 0 ${color}, -${value}px ${value}px 0 ${color}, ${value}px ${value}px 0 ${color}`;
  }

  function userOutlineWidth(): number {
    return subtitleStyle.outline === "none"
      ? 0
      : subtitleStyle.outline === "thick"
        ? 3
        : 1.5;
  }

  function runStyle(run: SubtitleTextRun): string {
    const fileStyles = subtitleStyle.useFileStyles;
    const font =
      fileStyles && run.font
        ? fontStack(run.font)
        : fontStack(subtitleStyle.fontFamily);
    const scale =
      containerRect.height > 0 && subtitleDoc
        ? containerRect.height / Math.max(1, subtitleDoc.playResY)
        : 1;
    const size =
      fileStyles && run.size != null
        ? Math.max(10, run.size * scale * SIZE_FACTORS[subtitleStyle.size])
        : fontSize;
    const color = fileStyles
      ? (run.color ?? subtitleStyle.textColor)
      : subtitleStyle.textColor;
    const authoredOutline = run.outlineWidth != null;
    const outlineWidth =
      fileStyles && authoredOutline
        ? Math.max(0, run.outlineWidth! * scale)
        : userOutlineWidth();
    const outlineColor = fileStyles
      ? (run.outlineColor ?? "#000000")
      : "#000000";
    return `font-family:${font};font-size:${size}px;color:${color};text-shadow:${outlineWidth > 0 ? shadow(outlineWidth, outlineColor) : "none"};font-weight:${run.bold ? 700 : 400};font-style:${run.italic ? "italic" : "normal"};text-decoration:${run.underline ? "underline" : "none"};`;
  }

  function imageStyle(image: SubtitleCueImage): string {
    const width = subtitleDoc?.canvasWidth || 1920;
    const height = subtitleDoc?.canvasHeight || 1080;
    const left = (image.x / width) * 100 + displayOffsetX;
    const top = (image.y / height) * 100 + displayOffsetY;
    return `left:${left}%;top:${top}%;width:${(image.width / width) * 100}%;height:${(image.height / height) * 100}%;`;
  }

  function imageSrc(path: string): string {
    return convertFileSrc(path);
  }

  function announcePosition(_x: number, _y: number) {
    positionAnnouncement = t("media.subtitles.positionMoved");
  }

  function handleBlockEnter() {
    if (dragging) return;
    lockedInset = displayY < defaultY - 0.1 ? controlsInset : 0;
    blockHovered = true;
  }

  function handleBlockLeave() {
    blockHovered = false;
  }

  function startDrag(event: PointerEvent) {
    if (!interactive || event.button !== 0 || !videoEl) return;

    refreshMetrics();
    const rect = videoEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const block = event.currentTarget as HTMLElement;
    event.preventDefault();
    event.stopPropagation();
    lockedInset = displayY < defaultY - 0.1 ? controlsInset : 0;
    dragging = true;
    previewOffsetX = offsetX;
    previewOffsetY = offsetY;
    const pointerId = event.pointerId;
    try {
      block.setPointerCapture(pointerId);
    } catch {
      // Pointer capture can fail if the pointer is already gone.
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startOffsetX = offsetX;
    const startOffsetY = offsetY;

    function move(pointerEvent: PointerEvent) {
      const dx = ((pointerEvent.clientX - startX) / rect.width) * 100;
      const dy = ((pointerEvent.clientY - startY) / rect.height) * 100;
      previewOffsetX = clamp(startOffsetX + dx, -OFFSET_LIMIT, OFFSET_LIMIT);
      previewOffsetY = clamp(startOffsetY + dy, -OFFSET_LIMIT, OFFSET_LIMIT);
    }

    function end() {
      dragging = false;
      try {
        block.releasePointerCapture(pointerId);
      } catch {
        // Capture may already be released.
      }
      onOffsetChange(previewOffsetX, previewOffsetY);
      announcePosition(previewOffsetX, previewOffsetY);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!interactive) return;
    if (event.key === "Home") {
      event.preventDefault();
      onResetPosition();
      previewOffsetX = 0;
      previewOffsetY = 0;
      positionAnnouncement = t("media.subtitles.positionReset");
      return;
    }
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -1;
    else if (event.key === "ArrowRight") dx = 1;
    else if (event.key === "ArrowUp") dy = -1;
    else if (event.key === "ArrowDown") dy = 1;
    else return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    const nextX = clamp(offsetX + dx * step, -OFFSET_LIMIT, OFFSET_LIMIT);
    const nextY = clamp(offsetY + dy * step, -OFFSET_LIMIT, OFFSET_LIMIT);
    onOffsetChange(nextX, nextY);
    announcePosition(nextX, nextY);
  }
</script>

{#if containerRect.width > 0 && containerRect.height > 0 && (activeTextCues.length > 0 || activeBitmapCues.length > 0)}
  <div
    class="subtitle-overlay"
    style="left: {containerRect.left}px; top: {containerRect.top}px; width: {containerRect.width}px; height: {containerRect.height}px;"
  >
    {#each activeBitmapCues as cue, cueIndex (cueIndex)}
      {#each cue.images as image (image.path)}
        <button
          type="button"
          class="subtitle-image"
          class:draggable={interactive}
          style={imageStyle(image)}
          tabindex={interactive ? 0 : -1}
          aria-label={t("media.subtitles.positionAria")}
          onpointerdown={startDrag}
          onmousedown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
          onkeydown={handleKeyDown}
        >
          <img
            class="subtitle-image-frame"
            src={imageSrc(image.path)}
            alt=""
            draggable="false"
          />
        </button>
      {/each}
    {/each}

    {#if plainLines.length > 0}
      <div
        class="subtitle-block"
        class:draggable={interactive}
        class:dragging
        style={plainStyle(null)}
        tabindex={interactive ? 0 : -1}
        role="button"
        aria-label={t("media.subtitles.positionAria")}
        onpointerdown={startDrag}
        onpointerenter={handleBlockEnter}
        onpointerleave={handleBlockLeave}
        onkeydown={handleKeyDown}
        onmousedown={(event) => event.stopPropagation()}
        onclick={(event) => event.stopPropagation()}
      >
        {#each plainLines as line}
          <div class="subtitle-line">
            {#each line as run}
              <span style={runStyle(run)}>{run.text}</span>
            {/each}
          </div>
        {/each}
      </div>
    {/if}

    {#each positionedTextCues as cue, index (index)}
      <div
        class="subtitle-block ass"
        class:draggable={interactive}
        class:dragging
        style="{anchorStyle(cue)} background:{blockBackground(cue)};"
        tabindex={interactive ? 0 : -1}
        role="button"
        aria-label={t("media.subtitles.positionAria")}
        onpointerdown={startDrag}
        onkeydown={handleKeyDown}
        onmousedown={(event) => event.stopPropagation()}
        onclick={(event) => event.stopPropagation()}
      >
        {#each cue.lines as line}
          <div class="subtitle-line">
            {#each line as run}
              <span style={runStyle(run)}>{run.text}</span>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/if}

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {liveText}
</div>
<div class="sr-only" role="status" aria-live="polite">
  {positionAnnouncement}
</div>
