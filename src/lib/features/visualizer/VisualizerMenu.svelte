<script lang="ts">
  import { fly } from "svelte/transition";
  import { onMount } from "svelte";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import {
    calculateAudioMetrics,
    createEmptyAudioMetrics,
    formatBandDb,
    formatFrequency,
    formatLevelDb,
    smoothAudioMetrics,
    type AudioMetrics,
  } from "./audioMetrics";
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
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    type,
    onMoved,
  }: {
    type: VisualizerType;
    onMoved?: () => void;
  } = $props();

  const TITLES: Record<VisualizerType, string> = {
    pulse: "media.visualizer.title.pulse",
    spectrum: "media.visualizer.title.spectrum",
    heartbeat: "media.visualizer.title.heartbeat",
    diamonds: "media.visualizer.title.diamonds",
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
  let menuWrapper = $state<HTMLElement | null>(null);
  let metrics = $state<AudioMetrics>(createEmptyAudioMetrics());

  const visible = $derived(visualizerStore.isActive(type));

  function clampMenuPosition() {
    const menu = menuWrapper;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const left = Math.max(0, Math.min(rect.left, maxLeft));
    const top = Math.max(0, Math.min(rect.top, maxTop));
    if (left !== rect.left) {
      menu.style.left = `${left}px`;
      menu.style.transform = "none";
    }
    if (top !== rect.top) menu.style.top = `${top}px`;
  }

  $effect(() => {
    if (!visible || !menuWrapper) return;
    void menuTop;
    void layoutX;
    void layoutY;
    const frame = requestAnimationFrame(clampMenuPosition);
    return () => cancelAnimationFrame(frame);
  });

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
    if (type === "diamonds") {
      particles = createParticles(60, 512);
    }
    if (type === "pulse") {
      barsState = createBarsState();
    }
    if (type === "heartbeat") {
      scopeState = createScopeState();
    }
  });

  $effect(() => {
    if (!visible || !canvasEl) return;

    let freqData: Uint8Array<ArrayBuffer> | null = null;
    let timeData: Uint8Array<ArrayBuffer> | null = null;
    let ctx = canvasEl.getContext("2d");
    let cancelled = false;
    let lastPublishedMetricKey = "";
    let lastMetricSample = -Infinity;
    let liveMetrics = createEmptyAudioMetrics();

    const publishMetrics = (next: AudioMetrics) => {
      const key = [
        formatLevelDb(next.levelDb),
        formatFrequency(next.peakFrequencyHz),
        formatBandDb(next.lowDb),
        formatBandDb(next.midDb),
        formatBandDb(next.highDb),
      ].join("|");
      if (key === lastPublishedMetricKey) return;
      lastPublishedMetricKey = key;
      metrics = next;
    };

    function tick(timestamp: number) {
      if (cancelled || !visible) {
        return;
      }

      if (!ctx && canvasEl) {
        ctx = canvasEl.getContext("2d");
      }

      if (
        ctx &&
        canvasEl &&
        timestamp - lastFrame >=
          (systemPrefs.batterySaverActive ? 1000 / 30 : 16.67)
      ) {
        const dt = lastFrame === 0 ? 0 : (timestamp - lastFrame) / 1000;
        lastFrame = timestamp;

        const analyser = eqEngine.getAnalyser();
        if (!analyser) {
          liveMetrics = createEmptyAudioMetrics();
          lastMetricSample = timestamp;
          publishMetrics(liveMetrics);
        } else {
          try {
            if (!freqData || freqData.length !== analyser.frequencyBinCount) {
              freqData = new Uint8Array(analyser.frequencyBinCount);
            }
            if (!timeData || timeData.length !== analyser.fftSize) {
              timeData = new Uint8Array(analyser.fftSize);
            }

            const sampleMetrics = timestamp - lastMetricSample >= 100;
            if (type === "heartbeat" || sampleMetrics) {
              analyser.getByteTimeDomainData(timeData);
            }
            if (type !== "heartbeat" || sampleMetrics) {
              analyser.getByteFrequencyData(freqData);
            }
            if (sampleMetrics) {
              const metricDt =
                lastMetricSample === -Infinity
                  ? 0
                  : (timestamp - lastMetricSample) / 1000;
              const nextMetrics = calculateAudioMetrics(
                timeData,
                freqData,
                eqEngine.getContext()?.sampleRate ?? 0,
                analyser.fftSize,
                analyser.minDecibels,
                analyser.maxDecibels,
              );
              liveMetrics = smoothAudioMetrics(
                liveMetrics,
                nextMetrics,
                metricDt,
              );
              lastMetricSample = timestamp;
              publishMetrics(liveMetrics);
            }

            ctx.imageSmoothingEnabled = true;
            drawBackground(ctx, CANVAS_W, CANVAS_H);

            if (type === "heartbeat") {
              drawScope(ctx, timeData, CANVAS_W, CANVAS_H, scopeState!, dt);
            } else if (type === "pulse") {
              drawBars(ctx, freqData, CANVAS_W, CANVAS_H, barsState!);
            } else if (type === "spectrum") {
              drawSpectrum(ctx, freqData, CANVAS_W, CANVAS_H);
            } else if (type === "diamonds") {
              drawParticles(
                ctx,
                freqData,
                CANVAS_W,
                CANVAS_H,
                particles,
                timestamp / 1000,
              );
            }
            drawVignette(ctx, CANVAS_W, CANVAS_H);
          } catch {
            // The analyser can be invalid briefly while media resources change.
            liveMetrics = createEmptyAudioMetrics();
            lastMetricSample = timestamp;
            publishMetrics(liveMetrics);
          }
        }
      }

      if (!cancelled && visible) rafId = requestAnimationFrame(tick);
    }

    lastFrame = 0;
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrame = 0;
      ctx = null;
      freqData = null;
      timeData = null;
      metrics = createEmptyAudioMetrics();
    };
  });
</script>

{#if visible}
  <div
    class="visualizer-wrapper"
    bind:this={menuWrapper}
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
        aria-label={t("media.visualizer.dragToMove")}
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
          const maxLeft = Math.max(0, window.innerWidth - rect.width);
          const maxTop = Math.max(0, window.innerHeight - rect.height);
          const savedTransition = wrapper.style.transition;
          wrapper.style.transition = "none";

          function onPointerMove(ev: PointerEvent) {
            wrapper.style.left = `${Math.max(0, Math.min(startLeft + ev.clientX - startX, maxLeft))}px`;
            wrapper.style.top = `${Math.max(0, Math.min(startTop + ev.clientY - startY, maxTop))}px`;
            wrapper.style.transform = "none";
          }

          function onPointerUp() {
            wrapper.style.transition = savedTransition;
            wrapper.style.transform = "";
            clampMenuPosition();
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
          data-tooltip={pinned
            ? t("media.visualizer.unpin")
            : t("media.visualizer.pin")}
          onclick={(e) => {
            e.stopPropagation();
            pinned = !pinned;
            visualizerStore.setPinned(type, pinned);
          }}
          aria-label={pinned
            ? t("media.visualizer.unpin")
            : t("media.visualizer.pin")}
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
          <span>{t(TITLES[type])}</span>
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
        </span>
        <button
          class="ctx-close tooltip-below"
          data-tooltip={t("common.close")}
          onclick={(e) => {
            e.stopPropagation();
            close();
          }}
          aria-label={t("common.close")}
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

      <div
        class="visualizer-metrics"
        aria-label={t("media.visualizer.metricsAria")}
      >
        <div
          class="visualizer-metric-pill tooltip-below"
          data-tooltip={t("media.visualizer.levelTooltip")}
          aria-label={t("media.visualizer.levelAria", {
            value: formatLevelDb(metrics.levelDb),
          })}
        >
          <span class="visualizer-metric-label"
            >{t("media.visualizer.level")}</span
          >
          <span class="visualizer-metric-value"
            >{formatLevelDb(metrics.levelDb)}</span
          >
        </div>
        <div
          class="visualizer-metric-pill tooltip-below"
          data-tooltip={t("media.visualizer.freqTooltip")}
          aria-label={t("media.visualizer.freqAria", {
            value: formatFrequency(metrics.peakFrequencyHz),
          })}
        >
          <span class="visualizer-metric-label"
            >{t("media.visualizer.freq")}</span
          >
          <span class="visualizer-metric-value"
            >{formatFrequency(metrics.peakFrequencyHz)}</span
          >
        </div>
        <div
          class="visualizer-metric-pill tooltip-below"
          data-tooltip={t("media.visualizer.lowTooltip")}
          aria-label={t("media.visualizer.lowAria", {
            value: formatBandDb(metrics.lowDb),
          })}
        >
          <span class="visualizer-metric-label"
            >{t("media.visualizer.low")}</span
          >
          <span class="visualizer-metric-value"
            >{formatBandDb(metrics.lowDb)}</span
          >
        </div>
        <div
          class="visualizer-metric-pill tooltip-below"
          data-tooltip={t("media.visualizer.midTooltip")}
          aria-label={t("media.visualizer.midAria", {
            value: formatBandDb(metrics.midDb),
          })}
        >
          <span class="visualizer-metric-label"
            >{t("media.visualizer.mid")}</span
          >
          <span class="visualizer-metric-value"
            >{formatBandDb(metrics.midDb)}</span
          >
        </div>
        <div
          class="visualizer-metric-pill tooltip-below"
          data-tooltip={t("media.visualizer.highTooltip")}
          aria-label={t("media.visualizer.highAria", {
            value: formatBandDb(metrics.highDb),
          })}
        >
          <span class="visualizer-metric-label"
            >{t("media.visualizer.high")}</span
          >
          <span class="visualizer-metric-value"
            >{formatBandDb(metrics.highDb)}</span
          >
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .visualizer-wrapper {
    position: fixed;
    z-index: 1099;
    overflow: visible;
    transform: translateX(-1.5%);
    transition:
      left 0.25s cubic-bezier(0.22, 0.9, 0.3, 1),
      top 0.25s cubic-bezier(0.22, 0.9, 0.3, 1);
  }

  .visualizer-menu {
    padding: 0;
    overflow: visible;
  }

  .visualizer-metrics {
    width: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 3px;
    padding: 4px 5px;
    overflow: visible;
    border-top: 0.5px solid var(--bg-elevated);
    border-radius: 0 0 12px 12px;
    background: var(--bg-primary);
  }

  .visualizer-metric-pill {
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 27px;
    padding: 3px 2px;
    overflow: visible;
    border: 0.5px solid var(--bg-elevated);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.035);
    color: var(--text-muted);
    font-family: var(--font-family);
    line-height: 1;
    text-align: center;
  }

  .visualizer-metric-pill[data-tooltip] {
    position: relative;
    display: flex;
  }

  .visualizer-metric-label {
    color: var(--text-hint);
    font-size: 7px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .visualizer-metric-value {
    max-width: 100%;
    overflow: hidden;
    color: var(--text-secondary);
    font-size: 9px;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  canvas {
    display: block;
    width: 100%;
    border-radius: 0;
    background: var(--bg-primary);
  }
</style>
