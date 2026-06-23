<script lang="ts">
  import type { VideoMarker, ClipBoundary, ClipPair } from "$lib/shared/types";

  let {
    filePath,
    progress,
    isScrubbing,
    editorOpen = false,
    timestamps = [],
    durationSecs = 0,
    loopStart = null,
    loopEnd = null,
    clipBoundaries = [],
    resumePoint = null,
    onScrubStart,
    clipPairs = [],
    abLoopRegion = null,
    clipMarkerJustDragged = false,
    timestampDragJustEnded = false,
    loopMarkerJustDragged = false,
    getTimestampPct,
    startClipMarkerDrag,
    removeClipBoundary,
    showClipBoundaryTooltip,
    hideTsTooltip,
    seekToTimestamp,
    openSegmentEditor,
    startTimestampDrag,
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
    showLoopMarkerTooltip,
  }: {
    filePath: string;
    progress: number;
    isScrubbing: boolean;
    editorOpen?: boolean;
    timestamps?: VideoMarker[];
    durationSecs?: number;
    loopStart?: number | null;
    loopEnd?: number | null;
    clipBoundaries?: ClipBoundary[];
    resumePoint?: number | null;
    onScrubStart: (e: MouseEvent) => void;
    clipPairs?: ClipPair[];
    abLoopRegion?: { start: number; end: number } | null;
    clipMarkerJustDragged?: boolean;
    timestampDragJustEnded?: boolean;
    loopMarkerJustDragged?: boolean;
    getTimestampPct?: (time: number) => number;
    startClipMarkerDrag?: (e: MouseEvent, id: string) => void;
    removeClipBoundary?: (id: string) => void;
    showClipBoundaryTooltip?: (e: MouseEvent, marker: ClipBoundary) => void;
    hideTsTooltip?: () => void;
    seekToTimestamp?: (time: number) => void;
    openSegmentEditor?: (e: MouseEvent, id: string) => void;
    startTimestampDrag?: (e: MouseEvent, id: string) => void;
    removeTimestamp?: (id: string) => void;
    showTimestampTooltip?: (e: MouseEvent, ts: VideoMarker) => void;
    openTimestampEditor?: (e: MouseEvent, id: string) => void;
    showResumeTooltip?: (e: MouseEvent) => void;
    hideResumeTooltip?: () => void;
    seekToResumePoint?: () => void;
    removeResumePoint?: () => void;
    clearABLoop?: () => void;
    formatTime?: (time: number) => string;
    startLoopMarkerDrag?: (e: MouseEvent, which: "start" | "end") => void;
    showLoopMarkerTooltip?: (e: MouseEvent, which: "start" | "end") => void;
  } = $props();

  const NUM_PEAKS = 300;

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let peaks = $state<Float32Array | null>(null);
  let decodeFailed = $state(false);
  let cachedCanvasW = 0;
  let cachedCanvasH = 0;
  let bgCanvas: OffscreenCanvas | null = null;
  let bgW = 0;
  let bgH = 0;

  function pct(time: number): number {
    if (getTimestampPct) return getTimestampPct(time);
    return durationSecs > 0 ? (time / durationSecs) * 100 : 0;
  }

  async function loadPeaks(path: string) {
    peaks = null;
    decodeFailed = false;
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(path);
      const ctx = new OfflineAudioContext(1, 1, 44100);
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const raw = audioBuffer.getChannelData(0);
      const samplesPerPeak = Math.floor(raw.length / NUM_PEAKS);
      if (samplesPerPeak <= 0) {
        decodeFailed = true;
        return;
      }
      const result = new Float32Array(NUM_PEAKS);
      for (let i = 0; i < NUM_PEAKS; i++) {
        let max = 0;
        const start = i * samplesPerPeak;
        const end = Math.min(start + samplesPerPeak, raw.length);
        for (let j = start; j < end; j++) {
          const abs = Math.abs(raw[j]);
          if (abs > max) max = abs;
        }
        result[i] = max;
      }
      peaks = result;
    } catch {
      decodeFailed = true;
    }
  }

  function drawBackground(w: number, h: number, dpr: number) {
    if (!peaks || w === 0 || h === 0) return;
    const offscreen = new OffscreenCanvas(w * dpr, h * dpr);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const barWidth = w / peaks.length;
    const midY = h / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * midY;
      const x = i * barWidth;
      ctx.fillRect(x, midY - amp, Math.max(barWidth - 1, 1), amp * 2);
    }

    bgCanvas = offscreen;
    bgW = w;
    bgH = h;
  }

  function draw() {
    const canvas = canvasEl;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    let w = cachedCanvasW;
    let h = cachedCanvasH;
    if (w === 0 || h === 0) {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
    }
    if (w === 0 || h === 0) return;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!peaks || decodeFailed) return;

    if (!bgCanvas || bgW !== w || bgH !== h) {
      drawBackground(w, h, dpr);
    }
    if (bgCanvas) {
      ctx.drawImage(bgCanvas, 0, 0, w, h);
    }

    const clipX = (progress / 100) * w;
    if (clipX > 0) {
      const barWidth = w / peaks.length;
      const midY = h / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipX, h);
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < peaks.length; i++) {
        const amp = peaks[i] * midY;
        const x = i * barWidth;
        ctx.fillRect(x, midY - amp, Math.max(barWidth - 1, 1), amp * 2);
      }
      ctx.restore();
    }
  }

  $effect(() => {
    const path = filePath;
    if (path) {
      bgCanvas = null;
      loadPeaks(path);
    }
  });

  $effect(() => {
    peaks;
    progress;
    requestAnimationFrame(draw);
  });

  $effect(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      cachedCanvasW = rect.width;
      cachedCanvasH = rect.height;
      bgCanvas = null;
      draw();
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  });
</script>

<div
  class="audio-waveform-bar"
  class:editor-open={editorOpen}
  onmousedown={onScrubStart}
  role="button"
  tabindex="0"
  aria-label="Seek audio"
>
  <canvas bind:this={canvasEl} class="waveform-canvas"></canvas>
  <div class="audio-progress-playhead" style="left: {progress}%"></div>

  {#if abLoopRegion}
    <div
      class="audio-ab-range"
      style="left: {pct(abLoopRegion.start)}%; width: {pct(abLoopRegion.end) -
        pct(abLoopRegion.start)}%"
      role="region"
      aria-label="AB Loop region"
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        clearABLoop?.();
      }}
    ></div>
  {/if}

  {#each clipPairs as pair (`pair-${pair.startId}-${pair.endId}`)}
    <div
      class="audio-clip-range"
      style="left: {pct(pair.start)}%; width: {pct(pair.end) -
        pct(pair.start)}%"
    ></div>
  {/each}

  {#each timestamps as ts (ts.id)}
    <div
      class="audio-marker audio-ts-marker"
      style="left: {pct(ts.time)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => {
        e.stopPropagation();
        startTimestampDrag?.(e, ts.id);
      }}
      onclick={(e) => {
        e.stopPropagation();
        if (timestampDragJustEnded) return;
        seekToTimestamp?.(ts.time);
      }}
      ondblclick={(e) => openTimestampEditor?.(e, ts.id)}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        removeTimestamp?.(ts.id);
      }}
      onmouseenter={(e) => showTimestampTooltip?.(e, ts)}
      onmouseleave={() => {
        if (!editorOpen) hideTsTooltip?.();
      }}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          seekToTimestamp?.(ts.time);
        }
      }}
      aria-label="timestamp {ts.title
        ? `${ts.title} at ${formatTime?.(ts.time) ?? ''}`
        : (formatTime?.(ts.time) ?? '')}"
    ></div>
  {/each}

  {#if loopStart !== null}
    <div
      class="audio-marker audio-loop-marker start-marker"
      style="left: {pct(loopStart)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => {
        e.stopPropagation();
        startLoopMarkerDrag?.(e, "start");
        showLoopMarkerTooltip?.(e, "start");
      }}
      onclick={(e) => {
        e.stopPropagation();
        if (loopMarkerJustDragged) return;
        seekToTimestamp?.(loopStart!);
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        hideTsTooltip?.();
        clearABLoop?.();
      }}
      onmouseenter={(e) => showLoopMarkerTooltip?.(e, "start")}
      onmouseleave={hideTsTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          seekToTimestamp?.(loopStart!);
        }
      }}
      aria-label="Loop start A at {formatTime?.(loopStart!) ?? ''}"
    ></div>
  {/if}

  {#if loopEnd !== null}
    <div
      class="audio-marker audio-loop-marker end-marker"
      style="left: {pct(loopEnd)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => {
        e.stopPropagation();
        startLoopMarkerDrag?.(e, "end");
        showLoopMarkerTooltip?.(e, "end");
      }}
      onclick={(e) => {
        e.stopPropagation();
        if (loopMarkerJustDragged) return;
        seekToTimestamp?.(loopEnd!);
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        hideTsTooltip?.();
        clearABLoop?.();
      }}
      onmouseenter={(e) => showLoopMarkerTooltip?.(e, "end")}
      onmouseleave={hideTsTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          seekToTimestamp?.(loopEnd!);
        }
      }}
      aria-label="Loop end B at {formatTime?.(loopEnd!) ?? ''}"
    ></div>
  {/if}

  {#each clipBoundaries as cb (cb.id)}
    <div
      class="audio-marker audio-clip-marker {cb.kind === 'start'
        ? 'start-marker'
        : 'end-marker'}"
      style="left: {pct(cb.time)}%"
      role="button"
      tabindex="0"
      onmousedown={(e) => {
        e.stopPropagation();
        startClipMarkerDrag?.(e, cb.id);
      }}
      onclick={(e) => {
        e.stopPropagation();
        if (clipMarkerJustDragged) return;
        seekToTimestamp?.(cb.time);
      }}
      ondblclick={(e) => openSegmentEditor?.(e, cb.id)}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        removeClipBoundary?.(cb.id);
      }}
      onmouseenter={(e) => showClipBoundaryTooltip?.(e, cb)}
      onmouseleave={hideTsTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          seekToTimestamp?.(cb.time);
        }
      }}
      aria-label={cb.title
        ? `${cb.kind} clip marker ${cb.title} at ${formatTime?.(cb.time) ?? ""}`
        : `${cb.kind} clip marker at ${formatTime?.(cb.time) ?? ""}`}
    ></div>
  {/each}

  {#if resumePoint !== null}
    <div
      class="audio-marker audio-resume-marker"
      style="left: {pct(resumePoint)}%"
      role="button"
      tabindex="0"
      onclick={(e) => {
        e.stopPropagation();
        seekToResumePoint?.();
        removeResumePoint?.();
      }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        removeResumePoint?.();
        hideResumeTooltip?.();
      }}
      onmouseenter={showResumeTooltip}
      onmouseleave={hideResumeTooltip}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          seekToResumePoint?.();
        }
      }}
      aria-label="Resume at {formatTime?.(resumePoint!) ?? ''}"
    ></div>
  {/if}
</div>

<style>
  .audio-waveform-bar {
    position: relative;
    flex: 1;
    cursor: pointer;
    overflow: hidden;
    border-radius: 2px;
  }
  .audio-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    pointer-events: auto;
    z-index: 1;
    opacity: 0.8;
    transform: translateX(-1px);
    cursor: pointer;
    transition:
      width 0.15s ease,
      opacity 0.15s ease;
  }
  .audio-marker:hover {
    width: 4px;
    opacity: 1;
    transform: translateX(-2px);
  }
  .audio-ts-marker {
    background: var(--yellow);
  }
  .audio-loop-marker {
    background: var(--green);
  }
  .audio-clip-marker {
    background: var(--blue);
  }
  .audio-resume-marker {
    background: rgba(150, 150, 150, 0.5);
  }
  .audio-ab-range {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--green-border);
    border-left: 2px solid var(--green-border-solid);
    border-right: 2px solid var(--green-border-solid);
    pointer-events: auto;
    cursor: context-menu;
    z-index: 0;
    transition: background 0.2s ease;
  }
  .audio-ab-range:hover {
    background: var(--green-border-strong);
  }
  .audio-clip-range {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--blue-bg-strong);
    border-left: 1px solid rgba(147, 197, 253, 0.9);
    border-right: 1px solid rgba(147, 197, 253, 0.9);
    pointer-events: none;
    z-index: 0;
  }
  .waveform-canvas {
    width: 100%;
    height: 32px;
    display: block;
  }
</style>
