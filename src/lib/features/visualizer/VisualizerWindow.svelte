<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import {
    drawBars,
    drawSpectrum,
    drawScope,
    drawParticles,
    createParticles,
    type Particle,
  } from "./renderers";

  let {
    type,
    title,
    onClose,
  }: {
    type: "bars" | "spectrum" | "scope" | "particles";
    title: string;
    onClose: () => void;
  } = $props();

  const CANVAS_W = 280;
  const CANVAS_H = 160;

  let windowEl: HTMLDivElement | null = $state(null);
  let canvasEl: HTMLCanvasElement | null = $state(null);
  let rafId = 0;
  let lastFrame = 0;
  let particles: Particle[] = [];

  // Session-scoped position state (starts at default offset)
  let posX = $state(80);
  let posY = $state(80);

  onMount(() => {
    const analyser = eqEngine.getAnalyser();
    if (!analyser) return;

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    if (type === "particles") {
      particles = createParticles(60, analyser.frequencyBinCount);
    }

    const ctx = canvasEl?.getContext("2d");
    if (!ctx) return;

    function tick(timestamp: number) {
      if (timestamp - lastFrame < 16.67) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      lastFrame = timestamp;

      if (type === "scope") {
        analyser!.getByteTimeDomainData(timeData);
        drawScope(ctx!, timeData, CANVAS_W, CANVAS_H);
      } else {
        analyser!.getByteFrequencyData(freqData);
        if (type === "bars") {
          drawBars(ctx!, freqData, CANVAS_W, CANVAS_H);
        } else if (type === "spectrum") {
          drawSpectrum(ctx!, freqData, CANVAS_W, CANVAS_H);
        } else if (type === "particles") {
          drawParticles(
            ctx!,
            freqData,
            CANVAS_W,
            CANVAS_H,
            particles,
            timestamp / 1000,
          );
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });

  function handleTitlePointerDown(e: PointerEvent) {
    e.preventDefault();
    if (!windowEl) return;

    const parent = windowEl.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = posX;
    const startTop = posY;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const maxLeft = parentRect.width - CANVAS_W - 8;
      const maxTop = parentRect.height - CANVAS_H - 28;
      posX = Math.max(0, Math.min(maxLeft, startLeft + dx));
      posY = Math.max(0, Math.min(maxTop, startTop + dy));
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
</script>

<div
  class="visualizer-window"
  bind:this={windowEl}
  style="left: {posX}px; top: {posY}px;"
>
  <div
    class="visualizer-titlebar"
    role="button"
    tabindex="0"
    aria-label="Drag to move"
    onpointerdown={handleTitlePointerDown}
  >
    <span class="visualizer-title">{title}</span>
    <button
      class="visualizer-close"
      aria-label="Close"
      onclick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onpointerdown={(e) => e.stopPropagation()}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
  <canvas bind:this={canvasEl} width={CANVAS_W} height={CANVAS_H}></canvas>
</div>

<style>
  .visualizer-window {
    position: absolute;
    z-index: 10;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
  }

  .visualizer-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    cursor: grab;
    user-select: none;
    height: 24px;
    flex-shrink: 0;
  }

  .visualizer-titlebar:active {
    cursor: grabbing;
  }

  .visualizer-title {
    font-size: 11px;
    color: var(--text-secondary);
    font-family: var(--font-family);
  }

  .visualizer-close {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    line-height: 1;
  }

  .visualizer-close:hover {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.08);
  }

  canvas {
    display: block;
    width: 280px;
    height: 160px;
  }
</style>
