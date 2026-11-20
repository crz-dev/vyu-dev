<script lang="ts">
  import type {
    VideoMarker,
    ClipBoundary,
    ClipPair,
    MediaChapter,
  } from "$lib/shared/types";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import {
    getWaveformPeaks,
    setWaveformPeaks,
    WAVEFORM_PEAK_COUNT,
  } from "$lib/features/media/waveformPeaks";

  const t = locale.t;

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
    chapters = [],
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
    chapters?: MediaChapter[];
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

  const NUM_PEAKS = WAVEFORM_PEAK_COUNT;

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let hoveredChapterIndex = $state(-1);
  let hoverX = $state(0);
  let peaks = $state<Float32Array | null>(null);
  let decodeFailed = $state(false);
  let cachedCanvasW = 0;
  let cachedCanvasH = 0;
  let bgCanvas: OffscreenCanvas | null = null;
  let playedCanvas: OffscreenCanvas | null = null;
  let bgW = 0;
  let bgH = 0;

  function pct(time: number): number {
    if (getTimestampPct) return getTimestampPct(time);
    return durationSecs > 0 ? (time / durationSecs) * 100 : 0;
  }

  async function loadPeaks(path: string) {
    peaks = null;
    decodeFailed = false;

    const cached = getWaveformPeaks(path);
    if (cached) {
      peaks = cached;
      return;
    }

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
      setWaveformPeaks(path, result);
      peaks = result;
    } catch {
      decodeFailed = true;
    }
  }

  function paintPeaks(
    w: number,
    h: number,
    dpr: number,
    colorName: string,
    fallback: string,
  ): OffscreenCanvas | null {
    if (!peaks || w === 0 || h === 0) return null;
    const offscreen = new OffscreenCanvas(w * dpr, h * dpr);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;
    ctx.scale(dpr, dpr);

    const barWidth = w / peaks.length;
    const midY = h / 2;

    ctx.fillStyle = waveformColor(colorName, fallback);
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * midY;
      const x = i * barWidth;
      ctx.fillRect(x, midY - amp, Math.max(barWidth - 1, 1), amp * 2);
    }

    return offscreen;
  }

  function drawBackground(w: number, h: number, dpr: number) {
    if (!peaks || w === 0 || h === 0) return;

    bgCanvas = paintPeaks(
      w,
      h,
      dpr,
      "--waveform-bar",
      "rgba(255, 255, 255, 0.3)",
    );
    playedCanvas = paintPeaks(w, h, dpr, "--waveform-bar-played", "#ffffff");
    bgW = w;
    bgH = h;
  }

  function waveformColor(name: string, fallback: string): string {
    if (!canvasEl) return fallback;
    return getComputedStyle(canvasEl).getPropertyValue(name).trim() || fallback;
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

    if (!bgCanvas || !playedCanvas || bgW !== w || bgH !== h) {
      drawBackground(w, h, dpr);
    }
    if (bgCanvas && playedCanvas) {
      ctx.drawImage(bgCanvas, 0, 0, w, h);
    }

    const clipX = Math.min(Math.max(progress, 0), 100) * 0.01 * w;
    if (playedCanvas && clipX > 0) {
      const sliceW = Math.min(clipX, w);
      ctx.drawImage(playedCanvas, 0, 0, sliceW * dpr, h * dpr, 0, 0, sliceW, h);
    }
  }

  $effect(() => {
    const path = filePath;
    if (path) {
      bgCanvas = null;
      playedCanvas = null;
      loadPeaks(path);
    }
  });

  $effect(() => {
    peaks;
    progress;
    requestAnimationFrame(draw);
  });

  // Canvas colors are sampled from CSS, so redraw when the theme changes.
  $effect(() => {
    const observer = new MutationObserver(() => {
      bgCanvas = null;
      playedCanvas = null;
      draw();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  });

  $effect(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      cachedCanvasW = rect.width;
      cachedCanvasH = rect.height;
      bgCanvas = null;
      playedCanvas = null;
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
  onmousemove={(e) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = ((e.clientX - rect.left) / rect.width) * 100;
    const time = (p / 100) * durationSecs;
    hoveredChapterIndex =
      durationSecs > 0
        ? chapters.findIndex(
            (c, i) =>
              time >= c.start && (time < c.end || i === chapters.length - 1),
          )
        : -1;
    hoverX = e.clientX - rect.left;
  }}
  onmouseleave={() => (hoveredChapterIndex = -1)}
  role="button"
  tabindex="0"
  aria-label={t("media.waveform.seek")}
>
  <canvas bind:this={canvasEl} class="waveform-canvas"></canvas>
  <div class="audio-progress-playhead" style="left: {progress}%"></div>

  {#if abLoopRegion}
    <div
      class="audio-ab-range"
      style="left: {pct(abLoopRegion.start)}%; width: {pct(abLoopRegion.end) -
        pct(abLoopRegion.start)}%"
      role="region"
      aria-label={t("media.waveform.abLoop")}
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
      aria-label={ts.title
        ? t("media.waveform.timestampTitledAria", {
            title: ts.title,
            time: formatTime?.(ts.time) ?? "",
          })
        : t("media.waveform.timestampAria", {
            time: formatTime?.(ts.time) ?? "",
          })}
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
      aria-label={t("media.waveform.loopStartAria", {
        time: formatTime?.(loopStart!) ?? "",
      })}
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
      aria-label={t("media.waveform.loopEndAria", {
        time: formatTime?.(loopEnd!) ?? "",
      })}
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
        ? t(
            cb.kind === "start"
              ? "media.waveform.clipMarkerStartTitled"
              : "media.waveform.clipMarkerEndTitled",
            { title: cb.title, time: formatTime?.(cb.time) ?? "" },
          )
        : t(
            cb.kind === "start"
              ? "media.waveform.clipMarkerStartAt"
              : "media.waveform.clipMarkerEndAt",
            { time: formatTime?.(cb.time) ?? "" },
          )}
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
      aria-label={t("media.waveform.resumeAria", {
        time: formatTime?.(resumePoint!) ?? "",
      })}
    ></div>
  {/if}
  {#each chapters as ch, i (ch.start)}
    {#if i > 0}
      <div
        class="audio-chapter-divider"
        style="left: {pct(ch.start)}%"
        aria-hidden="true"
      ></div>
    {/if}
  {/each}
  {#if hoveredChapterIndex >= 0}
    {@const ch = chapters[hoveredChapterIndex]}
    <div
      class="audio-chapter-highlight"
      style="left: {pct(ch.start)}%; width: {pct(ch.end) - pct(ch.start)}%"
      aria-hidden="true"
    ></div>
    <div
      class="ts-tooltip white scrubber-tooltip audio-chapter-tooltip"
      style="left: {pct((ch.start + ch.end) / 2)}%; top: -8px;"
    >
      <span class="audio-chapter-tooltip-title">{ch.title}</span>
      <span class="audio-chapter-tooltip-time"
        >{formatTime?.(ch.start) ?? ""} – {formatTime?.(ch.end) ?? ""}</span
      >
    </div>
  {/if}
</div>

<style>
  .audio-waveform-bar {
    --waveform-bar: rgba(255, 255, 255, 0.3);
    --waveform-bar-played: #ffffff;
    position: relative;
    flex: 1;
    cursor: pointer;
    overflow: hidden;
    border-radius: 2px;
  }
  :global([data-theme="light"]) .audio-waveform-bar {
    --waveform-bar: rgba(0, 0, 0, 0.22);
    --waveform-bar-played: var(--text-primary);
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
    border-left: 1px solid var(--blue-lighter);
    border-right: 1px solid var(--blue-lighter);
    pointer-events: none;
    z-index: 0;
  }
  .waveform-canvas {
    width: 100%;
    height: 32px;
    display: block;
  }

  .audio-chapter-divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(0, 0, 0, 0.55);
    z-index: 2;
    pointer-events: none;
    transform: translateX(-1px);
  }

  .audio-chapter-highlight {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.18);
    z-index: 1;
    pointer-events: none;
  }

  .audio-chapter-tooltip {
    position: absolute;
    bottom: 100%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
    backdrop-filter: blur(8px);
    border: 0.5px solid color-mix(in srgb, var(--text-primary) 20%, transparent);
    display: flex;
    flex-direction: column;
    gap: 1px;
    pointer-events: none;
    z-index: 5;
  }

  .audio-chapter-tooltip-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .audio-chapter-tooltip-time {
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
