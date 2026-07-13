<script lang="ts">
  import type { ClipBoundary, ClipPair, VideoMarker } from "$lib/shared/types";

  let {
    fullscreen = false,
    progress,
    currentTimeSecs,
    isGifVideo,
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
    currentTimeSecs: number;
    isGifVideo: boolean;
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
  const showResumeMarker = $derived(
    resumePoint !== null &&
      durationSecs > 0 &&
      resumePoint / durationSecs >= 0.25,
  );
  let showPlayheadTooltip = $state(false);
  let playheadHovered = $state(false);
  let isScrubbing = $state(false);

  function showPlayheadTimeTooltip() {
    showPlayheadTooltip = true;
  }

  function hidePlayheadTimeTooltip() {
    if (isScrubbing || playheadHovered) return;
    showPlayheadTooltip = false;
  }

  function handlePlayheadMouseEnter() {
    playheadHovered = true;
    showPlayheadTimeTooltip();
  }

  function handlePlayheadMouseLeave() {
    playheadHovered = false;
    hidePlayheadTimeTooltip();
  }

  function handleBarMouseDown(e: MouseEvent) {
    isScrubbing = true;
    showPlayheadTimeTooltip();
    startScrubbing(e);

    const stopScrub = () => {
      isScrubbing = false;
      hidePlayheadTimeTooltip();
      window.removeEventListener("mouseup", stopScrub);
    };

    window.addEventListener("mouseup", stopScrub);
  }

  function handleBarMouseLeave() {
    hidePlayheadTimeTooltip();
  }
</script>

<div
  class={barClass}
  data-clipbar={clipBarName}
  class:hide-for-gif={isGifVideo}
  onmousedown={handleBarMouseDown}
  onmouseleave={handleBarMouseLeave}
  oncontextmenu={(e) => e.preventDefault()}
  role="slider"
  aria-label="video scrubber"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  tabindex="0"
>
  <div class={fillClass} style="width: {progress}%"></div>
  <div
    class={playheadClass}
    style="left: {progress}%"
    onmouseenter={handlePlayheadMouseEnter}
    onmouseleave={handlePlayheadMouseLeave}
    role="presentation"
    aria-hidden="true"
  ></div>
  {#if showPlayheadTooltip && !tsEditMenuVisible}
    <div
      class="ts-tooltip white scrubber-tooltip"
      style="left: {clampedProgress}%; top: -12px;"
    >
      <span>{formatTime(currentTimeSecs)}</span>
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
      aria-label="AB Loop region"
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
      data-tooltip="AB Loop — right-click to clear"
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
      aria-label="Loop start A at {formatTime(loopStart!)}"
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
      aria-label="Loop end B at {formatTime(loopEnd!)}"
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
      aria-label="Resume at {formatTime(resumePoint!)}"
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
      aria-label="timestamp {ts.title
        ? `${ts.title} at ${formatTime(ts.time)}`
        : formatTime(ts.time)}"
    ></div>
  {/each}
</div>
