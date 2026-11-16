<script lang="ts">
  import type { ClipBoundary, ClipPair, VideoMarker } from "$lib/shared/types";
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
    clipPairs,
    clipBoundaries,
    timestamps,
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
    clipPairs: ClipPair[];
    clipBoundaries: ClipBoundary[];
    timestamps: VideoMarker[];
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
  let previewTimeSecs = $state(0);
  let barWidth = $state(0);
  let barEl = $state<HTMLDivElement | null>(null);
  let isScrubbing = $state(false);
  let previewBucket = -1;
  let previewToken = 0;
  let previewDebounce: ReturnType<typeof setTimeout> | null = null;
  let previewRaf: number | null = null;
  let hoverClientX = 0;

  const PREVIEW_HALF_PX = TIMELINE_PREVIEW_WIDTH / 2 + 8;
  const previewHalfPct = $derived(
    barWidth > 0 ? Math.min(50, (PREVIEW_HALF_PX / barWidth) * 100) : 20,
  );
  const previewLeftPct = $derived(
    Math.min(100 - previewHalfPct, Math.max(previewHalfPct, previewPct)),
  );

  function clearPreviewDebounce() {
    if (previewDebounce) {
      clearTimeout(previewDebounce);
      previewDebounce = null;
    }
  }

  function invalidatePreviewRequests() {
    clearPreviewDebounce();
    previewToken++;
    cancelPendingTimelinePreviews();
  }

  function hidePreview() {
    showPreview = false;
    clearPreviewDebounce();
    previewBucket = -1;
  }

  function schedulePreviewRequest(bucket: number) {
    clearPreviewDebounce();
    const token = ++previewToken;
    const path = previewPath;
    const timeSecs = previewTimeForBucket(bucket, durationSecs);
    previewDebounce = setTimeout(() => {
      previewDebounce = null;
      void requestTimelinePreview(path, bucket, timeSecs).then((src) => {
        if (
          token !== previewToken ||
          bucket !== previewBucket ||
          path !== previewPath
        ) {
          return;
        }
        if (src) previewSrc = src;
      });
    }, 120);
  }

  function showPreviewAt(pct: number) {
    if (!(durationSecs > 0) || !Number.isFinite(durationSecs)) {
      showPreview = false;
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
      return;
    }

    const bucket = previewBucketForPct(previewPct, durationSecs);
    if (bucket === previewBucket) return;

    previewBucket = bucket;
    invalidatePreviewRequests();
    const cached = getCachedTimelinePreview(previewPath, bucket);
    if (cached) {
      previewSrc = cached;
      return;
    }

    schedulePreviewRequest(bucket);
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

  function handleBarMouseEnter(e: MouseEvent) {
    // Warm the layout read before the first move so the preview is not delayed.
    barWidth = barEl?.getBoundingClientRect().width ?? barWidth;
    if (durationSecs > 0) updateHoverPosition(e.clientX);
  }

  function handleBarMouseMove(e: MouseEvent) {
    if (!(durationSecs > 0)) return;
    updateHoverPosition(e.clientX);
  }

  function handleBarMouseLeave() {
    if (isScrubbing) return;
    hidePreview();
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

  $effect(() => {
    const path = previewPath;
    void path;
    invalidatePreviewRequests();
    previewBucket = -1;
    previewSrc = "";
    showPreview = false;
  });

  $effect(() => {
    return () => {
      if (previewRaf !== null) cancelAnimationFrame(previewRaf);
      invalidatePreviewRequests();
    };
  });
</script>

<div
  class={barClass}
  bind:this={barEl}
  data-clipbar={clipBarName}
  class:hide-for-gif={isGifVideo}
  onmousedown={handleBarMouseDown}
  onmouseenter={handleBarMouseEnter}
  onmousemove={handleBarMouseMove}
  onmouseleave={handleBarMouseLeave}
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
  {#if showPreview && !tsEditMenuVisible}
    <div
      class="ts-tooltip white scrubber-tooltip timeline-preview"
      style="left: {previewLeftPct}%; top: -12px;"
      aria-hidden="true"
    >
      {#if previewSrc}
        <img class="timeline-preview-img" src={previewSrc} alt="" />
      {:else if previewPath}
        <div class="timeline-preview-img timeline-preview-placeholder"></div>
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
</div>

<style>
  .timeline-preview {
    padding: 4px;
    gap: 4px;
  }

  .timeline-preview-img {
    display: block;
    /* Keep in sync with TIMELINE_PREVIEW_WIDTH in timelinePreview.ts. */
    width: 160px;
    height: 90px;
    object-fit: contain;
    border-radius: 3px;
    background: #000;
  }

  .timeline-preview-placeholder {
    background: rgba(0, 0, 0, 0.55);
  }

  .timeline-preview-time {
    font-variant-numeric: tabular-nums;
  }
</style>
