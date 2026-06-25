<script lang="ts">
  import { fly } from "svelte/transition";
  import { onMount } from "svelte";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import {
    visualizerStore,
    type VisualizerType,
  } from "./visualizer-store.svelte";
  import {
    drawBars,
    drawSpectrum,
    drawScope,
    drawParticles,
    drawBackground,
    drawVignette,
    createParticles,
    createBarsState,
    createScopeState,
    type Particle,
    type BarsState,
    type ScopeState,
  } from "./renderers";

  let {
    type,
    onMoved,
  }: {
    type: VisualizerType;
    onMoved?: () => void;
  } = $props();

  const TITLES: Record<VisualizerType, string> = {
    pulse: "Pulse",
    spectrum: "Spectrum",
    heartbeat: "Heartbeat",
    diamonds: "Diamonds",
  };

  const CANVAS_W = 386;
  const CANVAS_H = 140;

  let pinned = $state(false);
  let menuTop = $state(0);
  let layoutX = $state(0);
  let layoutY = $state(0);
  let canvasEl: HTMLCanvasElement | null = $state(null);
  let rafId = 0;
  let lastFrame = 0;
  let particles: Particle[] = [];
  let barsState: BarsState | null = null;
  let scopeState: ScopeState | null = null;
  let mounted = $state(false);

  const visible = $derived(visualizerStore.isActive(type));

  function close() {
    visualizerStore.close(type);
  }

  $effect.pre(() => {
    if (!visible) return;
    const wrapper = document.querySelector(
      ".edit-menu-wrapper",
    ) as HTMLElement | null;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      menuTop = rect.bottom + 10;
    }
    const pos = visualizerStore.getLayoutPosition(type);
    layoutX = pos.left;
    layoutY = pos.top;
  });

  onMount(() => {
    mounted = true;

    if (type === "diamonds") {
      particles = createParticles(60, 512);
    }
    if (type === "pulse") {
      barsState = createBarsState();
    }
    if (type === "heartbeat") {
      scopeState = createScopeState();
    }

    let freqData: Uint8Array<ArrayBuffer> | null = null;
    let timeData: Uint8Array<ArrayBuffer> | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    function tick(timestamp: number) {
      // Self-cancel when unmounted or canvas gone
      if (!mounted) {
        rafId = 0;
        return;
      }

      // Lazily grab context when canvas becomes available
      if (!ctx && canvasEl) {
        ctx = canvasEl.getContext("2d");
      }
      // Drop context when canvas is removed
      if (!canvasEl) {
        ctx = null;
      }

      if (ctx && canvasEl) {
        if (timestamp - lastFrame >= 16.67) {
          const dt = (timestamp - lastFrame) / 1000;
          lastFrame = timestamp;

          const analyser = eqEngine.getAnalyser();
          if (analyser) {
            if (!freqData || freqData.length !== analyser.frequencyBinCount) {
              freqData = new Uint8Array(analyser.frequencyBinCount);
            }
            if (!timeData || timeData.length !== analyser.fftSize) {
              timeData = new Uint8Array(analyser.fftSize);
            }

            ctx.imageSmoothingEnabled = true;
            drawBackground(ctx, CANVAS_W, CANVAS_H);

            if (type === "heartbeat") {
              analyser.getByteTimeDomainData(timeData);
              drawScope(ctx, timeData, CANVAS_W, CANVAS_H, scopeState!, dt);
            } else {
              analyser.getByteFrequencyData(freqData);
              if (type === "pulse") {
                drawBars(ctx, freqData, CANVAS_W, CANVAS_H, barsState!);
              } else if (type === "spectrum") {
                drawSpectrum(ctx, freqData, CANVAS_W, CANVAS_H);
              } else if (type === "diamonds") {
                drawParticles(ctx, freqData, CANVAS_W, CANVAS_H, particles, timestamp / 1000);
              }
            }

            drawVignette(ctx, CANVAS_W, CANVAS_H);
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
</script>

{#if visible}
  <div
    class="visualizer-wrapper"
    style:top="{menuTop + layoutY}px"
    style:left="calc(50% + {layoutX}px)"
  >
    <div
      class="edit-menu visualizer-menu"
      class:pinned
      transition:fly={{ y: -26, duration: 220, opacity: 0.15 }}
    >
      <div
        class="ctx-drag"
        role="button"
        tabindex="0"
        aria-label="Drag to move"
        onpointerdown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          onMoved?.();
          const wrapper = (e.currentTarget as HTMLElement).closest(
            ".visualizer-wrapper",
          ) as HTMLElement;
          if (!wrapper) return;
          const startX = e.clientX;
          const startY = e.clientY;
          const rect = wrapper.getBoundingClientRect();
          const startLeft = rect.left;
          const startTop = rect.top;
          const savedTransition = wrapper.style.transition;
          wrapper.style.transition = "none";

          function onPointerMove(ev: PointerEvent) {
            wrapper.style.left = `${startLeft + ev.clientX - startX}px`;
            wrapper.style.top = `${startTop + ev.clientY - startY}px`;
            wrapper.style.transform = "none";
          }

          function onPointerUp() {
            wrapper.style.transition = savedTransition;
            wrapper.style.transform = "";
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
          }

          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", onPointerUp);
        }}
      >
        <button
          class="ctx-pin tooltip-below"
          class:active={pinned}
          data-tooltip={pinned ? "Unpin" : "Pin"}
          onclick={(e) => {
            e.stopPropagation();
            pinned = !pinned;
            visualizerStore.setPinned(type, pinned);
          }}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 2C8 2 6 5 6 9V11L2 15V18H22V15L18 11V9C18 5 16 2 12 2ZM12 18V23"
            />
          </svg>
        </button>
        <span class="ctx-drag-title">
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
          <span>{TITLES[type]}</span>
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
        </span>
        <button
          class="ctx-close tooltip-below"
          data-tooltip="Close"
          onclick={(e) => {
            e.stopPropagation();
            close();
          }}
          aria-label="Close"
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
  </div>
{/if}

<style>
  .visualizer-wrapper {
    position: fixed;
    z-index: 1099;
    transform: translateX(-1.5%);
    transition:
      left 0.25s cubic-bezier(0.22, 0.9, 0.3, 1),
      top 0.25s cubic-bezier(0.22, 0.9, 0.3, 1);
  }

  .visualizer-menu {
    padding: 0;
  }

  canvas {
    display: block;
    width: 100%;
    border-radius: 0 0 12px 12px;
    background: var(--bg-primary);
  }
</style>
