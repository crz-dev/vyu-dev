<script lang="ts">
  import type { VideoMarker, ClipBoundary } from "$lib/shared/types";

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
  } = $props();

  const NUM_PEAKS = 300;

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let peaks = $state<Float32Array | null>(null);
  let decodeFailed = $state(false);

  /** Decode audio and extract amplitude peaks. */
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

  /** Redraw the waveform canvas with two-tone rendering. */
  function draw() {
    const canvas = canvasEl;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (!peaks || decodeFailed) return;

    const barWidth = w / peaks.length;
    const midY = h / 2;

    // Draw full waveform in faded grey (remaining)
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * midY;
      const x = i * barWidth;
      ctx.fillRect(x, midY - amp, Math.max(barWidth - 1, 1), amp * 2);
    }

    // Clip to played portion and draw in white
    const clipX = (progress / 100) * w;
    if (clipX > 0) {
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

  // Load peaks when file changes
  $effect(() => {
    const path = filePath;
    if (path) loadPeaks(path);
  });

  // Redraw when peaks or progress change
  $effect(() => {
    peaks; // subscribe
    progress; // subscribe
    // Small delay to let canvas get its layout dimensions
    requestAnimationFrame(draw);
  });

  // Redraw on resize
  $effect(() => {
    const canvas = canvasEl;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
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
  {#each timestamps as ts (ts.id)}
    <div
      class="audio-marker audio-ts-marker"
      style="left: {durationSecs > 0 ? (ts.time / durationSecs) * 100 : 0}%"
    ></div>
  {/each}
  {#if loopStart !== null}
    <div
      class="audio-marker audio-loop-marker"
      style="left: {durationSecs > 0 ? (loopStart / durationSecs) * 100 : 0}%"
    ></div>
  {/if}
  {#if loopEnd !== null}
    <div
      class="audio-marker audio-loop-marker"
      style="left: {durationSecs > 0 ? (loopEnd / durationSecs) * 100 : 0}%"
    ></div>
  {/if}
  {#each clipBoundaries as cb (cb.id)}
    <div
      class="audio-marker audio-clip-marker"
      style="left: {durationSecs > 0 ? (cb.time / durationSecs) * 100 : 0}%"
    ></div>
  {/each}
  {#if resumePoint !== null}
    <div
      class="audio-marker audio-resume-marker"
      style="left: {durationSecs > 0 ? (resumePoint / durationSecs) * 100 : 0}%"
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
    pointer-events: none;
    z-index: 1;
    opacity: 0.8;
    transform: translateX(-1px);
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
  .waveform-canvas {
    width: 100%;
    height: 32px;
    display: block;
  }
</style>
