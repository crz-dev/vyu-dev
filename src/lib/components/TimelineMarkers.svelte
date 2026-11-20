<script lang="ts">
  import type {
    ClipBoundary,
    ClipPair,
    MediaChapter,
    VideoMarker,
  } from "$lib/shared/types";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import {
    cancelPendingTimelinePreviews,
    getCachedTimelinePreview,
    previewBucketForPct,
    previewTimeForBucket,
    requestTimelinePreview,
    TIMELINE_PREVIEW_WIDTH,
  } from "$lib/features/media/timelinePreview";

  const t = locale.t;

  let {
    fullscreen = false,
    progress,
    isGifVideo,
    previewPath = "",
    previewAspectRatio = 16 / 9,
    clipPairs,
    clipBoundaries,
    timestamps,
    chapters = [],
    abLoopRegion,
    loopStart,
    loopEnd,
    resumePoint,
    durationSecs = 0,
    clipMarkerJustDragged,
    tsEditMenuVisible,
    startScrubbing,
    getTimestampPct,
    startClipMarkerDrag,
    removeClipBoundary,
    showClipBoundaryTooltip,
    hideTsTooltip,
    seekToTimestamp,
    openSegmentEditor,
    startTimestampDrag,
    timestampDragJustEnded,
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
    loopMarkerJustDragged,
    showLoopMarkerTooltip,
  }: {
    fullscreen?: boolean;
    progress: number;
    isGifVideo: boolean;
    previewPath?: string;
    previewAspectRatio?: number;
    clipPairs: ClipPair[];
    clipBoundaries: ClipBoundary[];
    timestamps: VideoMarker[];
    chapters?: MediaChapter[];
    abLoopRegion: { start: number; end: number } | null;
    loopStart: number | null;
    loopEnd: number | null;
    resumePoint: number | null;
    durationSecs: number;
    clipMarkerJustDragged: boolean;
    tsEditMenuVisible: boolean;
    startScrubbing: (e: MouseEvent) => void;
    getTimestampPct: (time: number) => number;
    startClipMarkerDrag: (e: MouseEvent, id: string) => void;
    removeClipBoundary: (id: string) => void;
    showClipBoundaryTooltip: (e: MouseEvent, marker: ClipBoundary) => void;
    hideTsTooltip: () => void;
    seekToTimestamp: (time: number) => void;
    openSegmentEditor: (e: MouseEvent, id: string) => void;
    startTimestampDrag: (e: MouseEvent, id: string) => void;
    timestampDragJustEnded: boolean;
    removeTimestamp: (id: string) => void;
    showTimestampTooltip: (e: MouseEvent, ts: VideoMarker) => void;
    openTimestampEditor: (e: MouseEvent, id: string) => void;
    showResumeTooltip: (e: MouseEvent) => void;
    hideResumeTooltip: () => void;
    seekToResumePoint: () => void;
    removeResumePoint: () => void;
    clearABLoop: () => void;
    formatTime: (time: number) => string;
    startLoopMarkerDrag: (e: MouseEvent, which: "start" | "end") => void;
    loopMarkerJustDragged: boolean;
    showLoopMarkerTooltip: (e: MouseEvent, which: "start" | "end") => void;
  } = $props();

  const barClass = $derived(fullscreen ? "fs-progress" : "progress-bar");
  const fillClass = $derived(fullscreen ? "fs-progress-fill" : "progress-fill");
  const playheadClass = $derived(
    fullscreen ? "fs-progress-playhead" : "progress-playhead",
  );
  const clipRangeClass = $derived(fullscreen ? "fs-clip-range" : "clip-range");
  const abRangeClass = $derived(fullscreen ? "fs-ab-range" : "ab-range");
  const clipMarkerClass = $derived(
    fullscreen ? "fs-clip-marker" : "clip-marker",
  );
  const loopMarkerClass = $derived(
    fullscreen ? "fs-loop-marker" : "loop-marker",
  );
  const clipPairPrefix = $derived(fullscreen ? "fspair" : "pair");
  const clipBarName = $derived(fullscreen ? "fullscreen" : "normal");
  const clampedProgress = $derived(Math.max(0, Math.min(100, progress)));
  const hoveredChapterIndex = $derived.by(() => {
    if (!chapters || chapters.length === 0 || durationSecs <= 0) return -1;
    const time = (previewPct / 100) * durationSecs;
    return chapters.findIndex(
      (c, i) => time >= c.start && (time < c.end || i === chapters.length - 1),
    );
  });
  // Integer percentage keeps the accessibility tree stable at playback rate.
  const ariaProgress = $derived(Math.round(clampedProgress));
  const showResumeMarker = $derived(
    resumePoint !== null &&
      durationSecs > 0 &&
      resumePoint / durationSecs >= 0.25,
  );
  let showPreview = $state(false);
  let previewPct = $state(0);
  let previewSrc = $state("");
  let previewLoading = $state(false);
  let previewImageAspect = $state(0);
  let previewTimeSecs = $state(0);
  let barWidth = $state(0);
  let barEl = $state<HTMLDivElement | null>(null);
  let isScrubbing = $state(false);
  let previewBucket = -1;
  let previewLoadingBucket = -1;
  let previewRequestTimer: ReturnType<typeof setTimeout> | null = null;
  let previewLastRequestAt = 0;
  let lastPreviewPath = "";
  let previewRaf: number | null = null;
  let hoverClientX = 0;
  let pointerClientX = 0;
  let pointerClientY = 0;
  let pointerKnown = false;

  const PREVIEW_REQUEST_INTERVAL_MS = 100;
  const PREVIEW_MIN_ASPECT = 0.5;
  const PREVIEW_MAX_ASPECT = 2.4;
  const PREVIEW_MAX_HEIGHT = 80;
  const previewBox = $derived.by(() => {
    const sourceAspect =
      previewImageAspect > 0 ? previewImageAspect : previewAspectRatio;
    const raw =
      Number.isFinite(sourceAspect) && sourceAspect > 0 ? sourceAspect : 16 / 9;
    const ratio = Math.max(
      PREVIEW_MIN_ASPECT,
      Math.min(PREVIEW_MAX_ASPECT, raw),
    );
    let width = TIMELINE_PREVIEW_WIDTH;
    let height = width / ratio;
    if (height > PREVIEW_MAX_HEIGHT) {
      height = PREVIEW_MAX_HEIGHT;
      width = height * ratio;
    }
    return { width: Math.round(width), height: Math.round(height) };
  });
  const previewHalfPct = $derived(
    barWidth > 0
      ? Math.min(50, ((previewBox.width / 2 + 3) / barWidth) * 100)
      : 20,
  );
  const previewLeftPct = $derived(
    Math.min(100 - previewHalfPct, Math.max(previewHalfPct, previewPct)),
  );

  function clearPreviewTimer() {
    if (previewRequestTimer) {
      clearTimeout(previewRequestTimer);
      previewRequestTimer = null;
    }
  }

  function hidePreview() {
    showPreview = false;
    previewLoading = false;
    clearPreviewTimer();
    cancelPendingTimelinePreviews();
    previewBucket = -1;
    previewLoadingBucket = -1;
  }

  function ensurePreviewFrame() {
    if (!showPreview || !previewPath || previewBucket < 0) return;
    if (previewLoadingBucket === previewBucket) {
      previewLoading = true;
      return;
    }
    if (previewRequestTimer) {
      previewLoading = true;
      return;
    }

    const cached = getCachedTimelinePreview(previewPath, previewBucket);
    if (cached) {
      previewSrc = cached;
      previewLoading = false;
      return;
    }

    previewLoading = true;
    const delay = Math.max(
      0,
      PREVIEW_REQUEST_INTERVAL_MS - (Date.now() - previewLastRequestAt),
    );
    previewRequestTimer = setTimeout(() => {
      previewRequestTimer = null;
      if (!showPreview || !previewPath || previewBucket < 0) return;

      const bucket = previewBucket;
      const path = previewPath;
      previewLoadingBucket = bucket;
      previewLastRequestAt = Date.now();
      void requestTimelinePreview(
        path,
        bucket,
        previewTimeForBucket(bucket, durationSecs),
      ).then((src) => {
        if (previewLoadingBucket === bucket) previewLoadingBucket = -1;
        if (path !== previewPath) return;
        if (bucket === previewBucket) {
          previewLoading = false;
          if (src) previewSrc = src;
        }
        // The pointer may have moved while this frame was loading.
        if (showPreview && bucket !== previewBucket) ensurePreviewFrame();
      });
    }, delay);
  }

  function showPreviewAt(pct: number) {
    if (!(durationSecs > 0) || !Number.isFinite(durationSecs)) {
      showPreview = false;
      previewLoading = false;
      return;
    }

    showPreview = true;
    previewPct = Math.max(0, Math.min(100, pct));
    previewTimeSecs = Math.max(
      0,
      Math.min((previewPct / 100) * durationSecs, durationSecs - 0.05),
    );

    if (!previewPath) {
      previewSrc = "";
      previewLoading = false;
      return;
    }

    const bucket = previewBucketForPct(previewPct, durationSecs);
    if (bucket === previewBucket) return;

    previewBucket = bucket;
    ensurePreviewFrame();
  }

  function updateHoverPosition(clientX: number) {
    hoverClientX = clientX;
    if (previewRaf !== null) return;
    previewRaf = requestAnimationFrame(() => {
      previewRaf = null;
      const rect = barEl?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      barWidth = rect.width;
      const pct = ((hoverClientX - rect.left) / rect.width) * 100;
      showPreviewAt(pct);
    });
  }

  function handleBarHover(e: MouseEvent) {
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    pointerKnown = true;
    if (durationSecs > 0) updateHoverPosition(e.clientX);
  }

  function handleBarMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isScrubbing = true;
    updateHoverPosition(e.clientX);
    startScrubbing(e);
    const onScrubMove = (ev: MouseEvent) => updateHoverPosition(ev.clientX);
    const stopScrub = (ev: MouseEvent) => {
      isScrubbing = false;
      window.removeEventListener("mousemove", onScrubMove);
      window.removeEventListener("mouseup", stopScrub);
      const rect = barEl?.getBoundingClientRect();
      const over = rect
        ? ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top - 24 &&
          ev.clientY <= rect.bottom + 24
        : false;
      if (!over) {
        hidePreview();
      }
    };

    window.addEventListener("mousemove", onScrubMove);
    window.addEventListener("mouseup", stopScrub);
  }

  function isWithinBarRect(rect: DOMRect, clientX: number, clientY: number) {
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top - 14 &&
      clientY <= rect.bottom + 4
    );
  }

  $effect(() => {
    // Track the cursor at window level so the preview still appears when a
    // child marker or an overlay captures the bar's own mouse events.
    function onWindowMouseMove(e: MouseEvent) {
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      pointerKnown = true;
      const rect = barEl?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      if (isWithinBarRect(rect, e.clientX, e.clientY)) {
        if (durationSecs > 0) updateHoverPosition(e.clientX);
      } else if (showPreview && !isScrubbing) {
        hidePreview();
      }
    }

    window.addEventListener("mousemove", onWindowMouseMove);
    return () => window.removeEventListener("mousemove", onWindowMouseMove);
  });

  $effect(() => {
    // Metadata can arrive after the pointer is already resting on the bar.
    // Re-evaluate then so the first hover does not require a click or drag.
    const duration = durationSecs;
    const path = previewPath;
    const progressValue = progress;
    void duration;
    void path;
    void progressValue;
    if (!pointerKnown || !(duration > 0) || !Number.isFinite(duration)) return;
    if (!path || showPreview) return;
    const rect = barEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    if (isWithinBarRect(rect, pointerClientX, pointerClientY)) {
      updateHoverPosition(pointerClientX);
    }
  });

  $effect(() => {
    const path = previewPath;
    // Spread props can re-run effects without the path actually changing.
    if (path === lastPreviewPath) return;
    lastPreviewPath = path;
    clearPreviewTimer();
    cancelPendingTimelinePreviews();
    previewBucket = -1;
    previewLoadingBucket = -1;
    previewSrc = "";
    previewImageAspect = 0;
    previewLoading = false;
    showPreview = false;
  });

  $effect(() => {
    return () => {
      if (previewRaf !== null) cancelAnimationFrame(previewRaf);
      clearPreviewTimer();
      cancelPendingTimelinePreviews();
    };
  });
</script>

<div
  class={barClass}
  bind:this={barEl}
  data-clipbar={clipBarName}
  class:hide-for-gif={isGifVideo}
  onmousedown={handleBarMouseDown}
  onmouseenter={handleBarHover}
  onmousemove={handleBarHover}
  oncontextmenu={(e) => e.preventDefault()}
  role="slider"
  aria-label={t("shell.timeline.scrubber")}
  aria-valuenow={ariaProgress}
  aria-valuemin={0}
  aria-valuemax={100}
  tabindex="0"
>
  <div class={fillClass} style="width: {progress}%"></div>
  <div
    class={playheadClass}
    style="left: {progress}%"
    role="presentation"
    aria-hidden="true"
  ></div>
  {#if showPreview && !tsEditMenuVisible && hoveredChapterIndex < 0}
    <div
      class="ts-tooltip white scrubber-tooltip timeline-preview"
      style="left: {previewLeftPct}%; top: -12px;"
      aria-hidden="true"
    >
      {#if previewSrc}
        <img
          class="timeline-preview-img"
          style="width: {previewBox.width}px; height: {previewBox.height}px"
          src={previewSrc}
          alt=""
          onload={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              previewImageAspect = img.naturalWidth / img.naturalHeight;
            }
          }}
        />
      {:else if previewPath}
        <div
          class="timeline-preview-img"
          class:timeline-preview-loading={previewLoading}
          style="width: {previewBox.width}px; height: {previewBox.height}px"
        ></div>
      {/if}
      <span class="timeline-preview-time">{formatTime(previewTimeSecs)}</span>
    </div>
  {/if}
  {#each clipPairs as pair (`${clipPairPrefix}-${pair.startId}-${pair.endId}`)}
    <div
      class={clipRangeClass}
      style="left: {getTimestampPct(pair.start)}%; width: {getTimestampPct(
        pair.end,
      ) - getTimestampPct(pair.start)}%;"
    ></div>
  {/each}
  {#if abLoopRegion}
    <div
      role="region"
      aria-label={t("shell.timeline.abLoop")}
      class="{abRangeClass} tooltip-above"
      style="left: {getTimestampPct(
        abLoopRegion.start,
      )}%; width: {getTimestampPct(abLoopRegion.end) -
        getTimestampPct(abLoopRegion.start)}%;"
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        clearABLoop();
      }}
      data-tooltip={t("shell.timeline.abLoopHint")}
    ></div>
  {/if}
  {#if loopStart !== null}
    <div
      class="{loopMarkerClass} start-marker"
      style="left: {getTimestampPct(loopStart)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => {
        startLoopMarkerDrag(e, "start");
        showLoopMarkerTooltip(e, "start");
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        hideTsTooltip();
        loopStart = null;
        loopEnd = null;
        clearABLoop();
      }}
      onclick={(e) => {
        e.stopPropagation();
        if (loopMarkerJustDragged) return;
        seekToTimestamp(loopStart!);
      }}
      onmouseenter={(e) => showLoopMarkerTooltip(e, "start")}
      onmouseleave={hideTsTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          seekToTimestamp(loopStart!);
        }
      }}
      aria-label={t("shell.timeline.loopStart", {
        time: formatTime(loopStart!),
      })}
    ></div>
  {/if}
  {#if loopEnd !== null}
    <div
      class="{loopMarkerClass} end-marker"
      style="left: {getTimestampPct(loopEnd)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => {
        startLoopMarkerDrag(e, "end");
        showLoopMarkerTooltip(e, "end");
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        hideTsTooltip();
        loopEnd = null;
        clearABLoop();
      }}
      onclick={(e) => {
        e.stopPropagation();
        if (loopMarkerJustDragged) return;
        seekToTimestamp(loopEnd!);
      }}
      onmouseenter={(e) => showLoopMarkerTooltip(e, "end")}
      onmouseleave={hideTsTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          seekToTimestamp(loopEnd!);
        }
      }}
      aria-label={t("shell.timeline.loopEnd", { time: formatTime(loopEnd!) })}
    ></div>
  {/if}
  {#if showResumeMarker}
    <div
      class="resume-marker"
      style="left: {getTimestampPct(resumePoint!)}%"
      role="button"
      tabindex="0"
      onclick={(e) => {
        e.stopPropagation();
        seekToResumePoint();
        removeResumePoint();
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        removeResumePoint();
        hideResumeTooltip();
      }}
      onmouseenter={showResumeTooltip}
      onmouseleave={hideResumeTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          seekToResumePoint();
        }
      }}
      aria-label={t("shell.timeline.resume", {
        time: formatTime(resumePoint!),
      })}
    ></div>
  {/if}
  {#each clipBoundaries as marker (marker.id)}
    <div
      class="{clipMarkerClass} {marker.kind === 'start'
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
      onmouseenter={(e) => showClipBoundaryTooltip(e, marker)}
      onmouseleave={hideTsTooltip}
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
      aria-label={marker.kind === "start"
        ? marker.title
          ? t("shell.timeline.clipMarkerStartTitled", {
              title: marker.title,
              time: formatTime(marker.time),
            })
          : t("shell.timeline.clipMarkerStartAt", {
              time: formatTime(marker.time),
            })
        : marker.title
          ? t("shell.timeline.clipMarkerEndTitled", {
              title: marker.title,
              time: formatTime(marker.time),
            })
          : t("shell.timeline.clipMarkerEndAt", {
              time: formatTime(marker.time),
            })}
    ></div>
  {/each}
  {#each timestamps as ts (ts.id)}
    <div
      class="ts-marker"
      style="left: {getTimestampPct(ts.time)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => startTimestampDrag(e, ts.id)}
      onclick={(e) => {
        e.stopPropagation();
        if (timestampDragJustEnded) return;
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
        if (!tsEditMenuVisible) hideTsTooltip();
      }}
      aria-label={ts.title
        ? t("shell.timeline.timestampTitled", {
            title: ts.title,
            time: formatTime(ts.time),
          })
        : t("shell.timeline.timestampAt", { time: formatTime(ts.time) })}
    ></div>
  {/each}
  {#each chapters as ch, i (ch.start)}
    {#if i > 0}
      <div
        class="chapter-divider"
        style="left: {getTimestampPct(ch.start)}%"
        aria-hidden="true"
      ></div>
    {/if}
  {/each}
  {#if hoveredChapterIndex >= 0}
    {@const ch = chapters[hoveredChapterIndex]}
    <div
      class="chapter-highlight"
      style="left: {getTimestampPct(ch.start)}%; width: {getTimestampPct(
        ch.end,
      ) - getTimestampPct(ch.start)}%;"
      aria-hidden="true"
    ></div>
  {/if}
  {#if hoveredChapterIndex >= 0 && !tsEditMenuVisible}
    {@const ch = chapters[hoveredChapterIndex]}
    <div
      class="ts-tooltip white scrubber-tooltip chapter-tooltip"
      style="left: {Math.min(
        95,
        Math.max(5, getTimestampPct((ch.start + ch.end) / 2)),
      )}%; top: -12px;"
      aria-hidden="true"
    >
      <span class="chapter-tooltip-title">{ch.title}</span>
      <span class="chapter-tooltip-time"
        >{formatTime(ch.start)} – {formatTime(ch.end)}</span
      >
    </div>
  {/if}
</div>

<style>
  /* Expand the hover/click target above the thin bar into the controls gap. */
  .progress-bar::before,
  .fs-progress::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: -10px;
    bottom: 0;
  }

  .ts-tooltip.timeline-preview {
    padding: 3px;
    gap: 3px;
    border-radius: 6px;
    background: color-mix(
      in srgb,
      var(--bg-secondary) var(--menu-opacity),
      transparent
    );
    backdrop-filter: blur(var(--menu-blur)) saturate(130%);
    border: 0.5px solid color-mix(in srgb, var(--text-primary) 20%, transparent);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  }

  .timeline-preview-img {
    display: block;
    object-fit: contain;
    border-radius: 4px;
  }

  .timeline-preview-loading {
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--text-primary) 16%, transparent) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: thumbShimmer 3s ease-in-out infinite;
  }

  .timeline-preview-time {
    font-variant-numeric: tabular-nums;
  }

  .chapter-divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--bg-border);
    z-index: 2;
    pointer-events: none;
    transform: translateX(-1px);
  }

  .chapter-highlight {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--text-primary) 14%, transparent);
    z-index: 1;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .chapter-tooltip {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 8px;
  }

  .chapter-tooltip-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .chapter-tooltip-time {
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
</style>
