<script lang="ts">
  import type {
    ClipBoundary,
    ClipPair,
    MediaChapter,
    VideoMarker,
  } from "$lib/shared/types";
  import { tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
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
  const hasChapters = $derived(chapters.length > 0 && durationSecs > 0);
  // Integer percentage keeps the accessibility tree stable at playback rate.
  const ariaProgress = $derived(Math.round(clampedProgress));
  const showResumeMarker = $derived(
    resumePoint !== null &&
      durationSecs > 0 &&
      resumePoint / durationSecs >= 0.25,
  );
  let showPreview = $state(false);
  let previewPct = $state(0);
  let displayedProgress = $state(0);
  let progressAnimRaf: number | null = null;
  const renderedProgress = $derived(
    Math.max(0, Math.min(100, displayedProgress)),
  );
  const hoveredChapterIndex = $derived.by(() => {
    if (!showPreview || !hasChapters) return -1;
    // Nudge by a tiny amount so a chapter start computed from a percentage
    // still resolves to that chapter after the round trip.
    const time = (previewPct / 100) * durationSecs + 0.02;
    const last = chapters.length - 1;
    return chapters.findIndex(
      (c, i) =>
        time >= (i === 0 ? 0 : c.start) &&
        (time < (i === last ? durationSecs : c.end) || i === last),
    );
  });
  let previewSrc = $state("");
  let previewLoading = $state(false);
  let previewImageAspect = $state(0);
  let previewTimeSecs = $state(0);
  let tooltipLeftPct = $state(0);
  let barWidth = $state(0);
  let barEl = $state<HTMLDivElement | null>(null);
  let previewEl = $state<HTMLDivElement | null>(null);
  let chapterListEl = $state<HTMLDivElement | null>(null);
  let chapterListOpen = $state(false);
  let previewHideTimer: ReturnType<typeof setTimeout> | null = null;
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

  function chapterPct(time: number): number {
    return Math.max(0, Math.min(100, getTimestampPct(time)));
  }

  function chapterFillPct(startPct: number, endPct: number): number {
    const span = endPct - startPct;
    if (span <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, ((renderedProgress - startPct) / span) * 100),
    );
  }

  function clearPreviewTimer() {
    if (previewRequestTimer) {
      clearTimeout(previewRequestTimer);
      previewRequestTimer = null;
    }
  }

  function clearPreviewHideTimer() {
    if (previewHideTimer !== null) {
      clearTimeout(previewHideTimer);
      previewHideTimer = null;
    }
  }

  function scheduleHidePreview() {
    if (isScrubbing || previewHideTimer !== null) return;
    previewHideTimer = setTimeout(() => {
      previewHideTimer = null;
      hidePreview();
    }, 140);
  }

  function hidePreview() {
    clearPreviewHideTimer();
    showPreview = false;
    chapterListOpen = false;
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

    clearPreviewHideTimer();
    showPreview = true;
    chapterListOpen = false;
    previewPct = Math.max(0, Math.min(100, pct));
    tooltipLeftPct = previewPct;
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

  function stopProgressAnimation(snap = false) {
    if (progressAnimRaf !== null) {
      cancelAnimationFrame(progressAnimRaf);
      progressAnimRaf = null;
    }
    if (snap) displayedProgress = clampedProgress;
  }

  function animateProgressTo(targetPct: number) {
    stopProgressAnimation();
    const target = Math.max(0, Math.min(100, targetPct));
    const start = renderedProgress;
    const delta = target - start;
    if (appearance.reducedMotion || Math.abs(delta) < 0.2) {
      displayedProgress = target;
      return;
    }
    const duration = Math.min(260, 140 + Math.abs(delta) * 1.2);
    let startedAt: number | null = null;
    let lastT = 0;
    const step = (now: number) => {
      if (startedAt === null) startedAt = now;
      const rawT = Math.min(1, (now - startedAt) / duration);
      // Never skip more than a fifth per frame so a stalled frame cannot turn
      // the whole tween into a jump.
      const t = Math.min(rawT, lastT + 0.2);
      lastT = t;
      if (t >= 1) {
        progressAnimRaf = null;
        displayedProgress = Math.max(0, Math.min(100, progress));
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      displayedProgress = start + delta * eased;
      progressAnimRaf = requestAnimationFrame(step);
    };
    progressAnimRaf = requestAnimationFrame(step);
  }

  function handleBarMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    clearPreviewHideTimer();
    isScrubbing = true;
    const rect = barEl?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      animateProgressTo(((e.clientX - rect.left) / rect.width) * 100);
    }
    updateHoverPosition(e.clientX);
    startScrubbing(e);
    const downClientX = e.clientX;
    let scrubMoved = false;
    const onScrubMove = (ev: MouseEvent) => {
      if (!scrubMoved && Math.abs(ev.clientX - downClientX) > 3) {
        scrubMoved = true;
        stopProgressAnimation(true);
      }
      updateHoverPosition(ev.clientX);
    };
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
      clientY >= rect.top - 24 &&
      clientY <= rect.bottom + 4
    );
  }

  function isWithinPreviewRect(
    rect: DOMRect,
    clientX: number,
    clientY: number,
  ) {
    const margin = 4;
    return (
      clientX >= rect.left - margin &&
      clientX <= rect.right + margin &&
      clientY >= rect.top - margin &&
      clientY <= rect.bottom + margin
    );
  }

  function selectPreviewChapter(index: number) {
    const chapter = chapters[index];
    if (!chapter || !(durationSecs > 0)) return;
    clearPreviewHideTimer();
    seekToTimestamp(chapter.start);
    previewPct = Math.max(
      0,
      Math.min(100, (chapter.start / durationSecs) * 100),
    );
    previewTimeSecs = Math.max(0, Math.min(chapter.start, durationSecs - 0.05));
    const bucket = previewBucketForPct(previewPct, durationSecs);
    if (bucket !== previewBucket) {
      previewBucket = bucket;
      ensurePreviewFrame();
    }
    if (chapterListOpen) scrollCurrentChapterIntoView();
  }

  function previousPreviewChapter() {
    if (hoveredChapterIndex > 0) {
      selectPreviewChapter(hoveredChapterIndex - 1);
    }
  }

  function nextPreviewChapter() {
    if (hoveredChapterIndex >= 0 && hoveredChapterIndex < chapters.length - 1) {
      selectPreviewChapter(hoveredChapterIndex + 1);
    }
  }

  function scrollCurrentChapterIntoView() {
    void tick().then(() => {
      const list = chapterListEl;
      const current = list?.querySelector<HTMLElement>(
        ".chapter-preview-item.current",
      );
      current?.scrollIntoView({ block: "nearest" });
    });
  }

  function toggleChapterList() {
    chapterListOpen = !chapterListOpen;
    clearPreviewHideTimer();
    if (chapterListOpen) scrollCurrentChapterIntoView();
  }

  function selectChapterFromList(index: number) {
    selectPreviewChapter(index);
    chapterListOpen = false;
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
      const overBar = isWithinBarRect(rect, e.clientX, e.clientY);
      const previewRect = previewEl?.getBoundingClientRect();
      const overPreview =
        !!previewRect && isWithinPreviewRect(previewRect, e.clientX, e.clientY);
      if (overPreview) {
        clearPreviewHideTimer();
      } else if (overBar) {
        clearPreviewHideTimer();
        if (durationSecs > 0) updateHoverPosition(e.clientX);
      } else if (showPreview && !isScrubbing) {
        scheduleHidePreview();
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
    const target = clampedProgress;
    if (progressAnimRaf !== null) return;
    displayedProgress = target;
  });

  $effect(() => {
    return () => {
      if (previewRaf !== null) cancelAnimationFrame(previewRaf);
      stopProgressAnimation();
      clearPreviewTimer();
      clearPreviewHideTimer();
      cancelPendingTimelinePreviews();
    };
  });
</script>

<div
  class={barClass}
  bind:this={barEl}
  data-clipbar={clipBarName}
  class:hide-for-gif={isGifVideo}
  class:chaptered={hasChapters}
  class:chapter-hover={hoveredChapterIndex >= 0}
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
  {#if hasChapters}
    {#each chapters as ch, i (ch.start)}
      {@const startPct = chapterPct(ch.start)}
      {@const endPct = chapterPct(ch.end)}
      {@const displayStartPct = i === 0 ? 0 : startPct}
      {@const displayEndPct = i === chapters.length - 1 ? 100 : endPct}
      {@const gapStart = i === 0 ? 0 : 1}
      {@const gapEnd = i === chapters.length - 1 ? 0 : 1}
      <div
        class="chapter-segment"
        class:hovered={i === hoveredChapterIndex}
        style="left: calc({displayStartPct}% + {gapStart}px); width: calc({displayEndPct -
          displayStartPct}% - {gapStart + gapEnd}px);"
        aria-hidden="true"
      >
        <div
          class="chapter-segment-fill"
          style="width: {chapterFillPct(displayStartPct, displayEndPct)}%"
        ></div>
      </div>
    {/each}
  {:else}
    <div class={fillClass} style="width: {renderedProgress}%"></div>
    {#if showPreview && previewPct > renderedProgress}
      <div
        class="progress-hover-fill"
        style="left: {renderedProgress}%; width: {previewPct -
          renderedProgress}%"
        aria-hidden="true"
      ></div>
    {/if}
  {/if}
  <div
    class={playheadClass}
    style="left: {renderedProgress}%"
    role="presentation"
    aria-hidden="true"
  ></div>
  {#if showPreview && !tsEditMenuVisible}
    {@const hoveredChapter =
      hoveredChapterIndex >= 0 ? chapters[hoveredChapterIndex] : null}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="ts-tooltip white scrubber-tooltip timeline-preview"
      bind:this={previewEl}
      style="left: {hoveredChapter
        ? Math.min(92, Math.max(8, tooltipLeftPct))
        : previewLeftPct}%; top: -12px;"
      role="group"
      aria-label={hoveredChapter ? t("media.chapters.heading") : undefined}
      onmousedown={(e) => e.stopPropagation()}
      onmousemove={(e) => e.stopPropagation()}
      onmouseenter={clearPreviewHideTimer}
    >
      {#if chapterListOpen}
        <div
          class="chapter-preview-list"
          bind:this={chapterListEl}
          style="width: {previewBox.width}px; height: {previewBox.height}px"
          role="group"
          aria-label={t("media.chapters.heading")}
          in:fly={{ y: 6, duration: 160, opacity: 0 }}
          onwheel={(e) => e.stopPropagation()}
        >
          {#each chapters as chapter, index (chapter.start)}
            {@const chapterTitle =
              chapter.title.trim() ||
              t("media.chapters.untitled", { index: index + 1 })}
            <button
              type="button"
              class="chapter-preview-item"
              class:current={index === hoveredChapterIndex}
              onclick={(e) => {
                e.stopPropagation();
                selectChapterFromList(index);
              }}
              title={chapterTitle}
            >
              <span class="chapter-preview-item-title">{chapterTitle}</span>
              <span class="chapter-preview-item-time"
                >{formatTime(chapter.start)}</span
              >
            </button>
          {/each}
        </div>
      {:else if previewSrc}
        <img
          class="timeline-preview-img"
          style="width: {previewBox.width}px; height: {previewBox.height}px"
          src={previewSrc}
          alt=""
          in:fade={{ duration: 120 }}
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
          in:fade={{ duration: 120 }}
        ></div>
      {/if}
      {#if hoveredChapter}
        {@const chapterTitle =
          hoveredChapter.title.trim() ||
          t("media.chapters.untitled", { index: hoveredChapterIndex + 1 })}
        <div class="chapter-tooltip-nav">
          <button
            type="button"
            class="chapter-tooltip-nav-btn"
            onclick={(e) => {
              e.stopPropagation();
              previousPreviewChapter();
            }}
            disabled={hoveredChapterIndex <= 0}
            aria-label={t("media.chapters.previous")}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            class="chapter-tooltip-picker"
            aria-expanded={chapterListOpen}
            onclick={(e) => {
              e.stopPropagation();
              toggleChapterList();
            }}
          >
            <span class="chapter-tooltip-title" title={chapterTitle}
              >{chapterTitle}</span
            >
          </button>
          <button
            type="button"
            class="chapter-tooltip-nav-btn"
            onclick={(e) => {
              e.stopPropagation();
              nextPreviewChapter();
            }}
            disabled={hoveredChapterIndex >= chapters.length - 1}
            aria-label={t("media.chapters.next")}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      {/if}
      <span class="timeline-preview-time"
        >{hoveredChapter
          ? formatTime(Math.max(0, hoveredChapter.end - hoveredChapter.start))
          : formatTime(previewTimeSecs)}</span
      >
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
    pointer-events: auto;
  }

  .chapter-tooltip-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    min-width: 0;
  }

  .chapter-tooltip-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    flex-shrink: 0;
    color: var(--text-secondary);
    background: transparent;
    border: 0.5px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.13s,
      color 0.13s;
  }

  .chapter-tooltip-nav-btn:hover:not(:disabled) {
    color: var(--text-primary);
    background: color-mix(in srgb, var(--text-primary) 12%, transparent);
  }

  .chapter-tooltip-nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .chapter-tooltip-picker {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 1px 4px;
    color: var(--text-muted);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    font-family: var(--font-family);
    font-size: 11px;
    font-weight: 600;
    transition:
      background 0.13s,
      color 0.13s;
  }

  .chapter-tooltip-picker:hover {
    color: var(--text-primary);
    background: color-mix(in srgb, var(--text-primary) 10%, transparent);
  }

  .chapter-tooltip-picker:focus-visible {
    outline: 1px solid var(--blue-light);
    outline-offset: 1px;
  }

  .chapter-preview-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1px;
    box-sizing: border-box;
    border-radius: 4px;
  }

  .chapter-preview-list::-webkit-scrollbar {
    width: 6px;
  }

  .chapter-preview-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .chapter-preview-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.22);
    border: 1px solid transparent;
    border-radius: 99px;
    background-clip: padding-box;
  }

  .chapter-preview-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  :global([data-theme="light"]) .chapter-preview-list::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.25);
  }

  :global([data-theme="light"])
    .chapter-preview-list::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  .chapter-preview-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-width: 0;
    min-height: 22px;
    padding: 2px 5px;
    color: var(--text-secondary);
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    font-family: var(--font-family);
    font-size: 10px;
    box-sizing: border-box;
    transition:
      background 0.13s,
      color 0.13s;
  }

  .chapter-preview-item:hover {
    color: var(--text-primary);
    background: color-mix(in srgb, var(--text-primary) 10%, transparent);
  }

  .chapter-preview-item.current {
    color: var(--blue-light);
    background: var(--blue-bg);
  }

  .chapter-preview-item-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chapter-preview-item-time {
    flex-shrink: 0;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .chapter-preview-item.current .chapter-preview-item-time {
    color: inherit;
    opacity: 0.7;
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

  .progress-bar.chaptered,
  .fs-progress.chaptered {
    background: transparent;
  }

  .progress-hover-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--text-primary) 28%, var(--bg-border));
    border-radius: 2px;
    z-index: 0;
    pointer-events: none;
  }

  .fs-progress .progress-hover-fill {
    background: color-mix(
      in srgb,
      var(--text-primary) 28%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .chapter-segment {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--bg-border);
    border-radius: 2px;
    overflow: hidden;
    z-index: 0;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease;
  }

  .fs-progress .chapter-segment {
    background: rgba(255, 255, 255, 0.2);
  }

  .chapter-segment-fill {
    height: 100%;
    background: var(--text-primary);
    border-radius: inherit;
  }

  .chaptered.chapter-hover .chapter-segment {
    opacity: 0.45;
  }

  .chaptered.chapter-hover .chapter-segment.hovered {
    opacity: 1;
  }

  .chapter-segment.hovered {
    background: color-mix(in srgb, var(--text-primary) 28%, var(--bg-border));
  }

  .fs-progress .chapter-segment.hovered {
    background: color-mix(
      in srgb,
      var(--text-primary) 42%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .chapter-tooltip-title {
    flex: 1;
    min-width: 0;
    padding: 0 2px;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
  }
</style>
