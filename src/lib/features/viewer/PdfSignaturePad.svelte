<script lang="ts">
  import { fly } from "svelte/transition";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import type { DrawPoint } from "$lib/features/markup/markup.svelte";

  const t = locale.t;

  let {
    open,
    onApply,
    onCancel,
  }: {
    open: boolean;
    onApply: (paths: DrawPoint[][]) => void;
    onCancel: () => void;
  } = $props();

  const WIDTH = 420;
  const HEIGHT = 150;

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let paths = $state<DrawPoint[][]>([]);
  let current: DrawPoint[] | null = null;
  let drawing = false;

  function setupCanvas(node: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    node.width = Math.floor(WIDTH * dpr);
    node.height = Math.floor(HEIGHT * dpr);
    node.style.width = `${WIDTH}px`;
    node.style.height = `${HEIGHT}px`;
    const ctx = node.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.2;
    }
    canvasEl = node;
    return {
      destroy() {
        canvasEl = null;
      },
    };
  }

  function toPoint(e: PointerEvent): DrawPoint {
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function redraw() {
    const canvas = canvasEl;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const path of [...paths, ...(current ? [current] : [])]) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path[0].x * WIDTH, path[0].y * HEIGHT);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * WIDTH, path[i].y * HEIGHT);
      }
      ctx.stroke();
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing = true;
    current = [toPoint(e)];
    redraw();
  }

  function onPointerMove(e: PointerEvent) {
    if (!drawing || !current) return;
    const point = toPoint(e);
    const last = current[current.length - 1];
    if (
      Math.abs(point.x - last.x) < 0.002 &&
      Math.abs(point.y - last.y) < 0.002
    ) {
      return;
    }
    current.push(point);
    redraw();
  }

  function onPointerUp(e: PointerEvent) {
    if (!drawing) return;
    drawing = false;
    if (current && current.length >= 2) {
      paths = [...paths, current];
    }
    current = null;
    redraw();
    try {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function clear() {
    paths = [];
    current = null;
    redraw();
  }

  function apply() {
    if (paths.length === 0) return;
    // Paths are normalized to the pad's height for drawing. Convert y to a
    // width-normalized space so the signature keeps its true aspect ratio when
    // it is scaled onto a page with a different aspect.
    const aspect = HEIGHT / WIDTH;
    onApply(
      paths.map((path) =>
        path.map((point) => ({ x: point.x, y: point.y * aspect })),
      ),
    );
    paths = [];
    current = null;
    redraw();
  }

  $effect(() => {
    if (!open) {
      paths = [];
      current = null;
      return;
    }
    requestAnimationFrame(redraw);
  });
</script>

<svelte:window
  onkeydowncapture={(e) => {
    if (!open || e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  }}
/>

{#if open}
  <div class="pdf-password-overlay" role="presentation">
    <div
      class="pdf-signature-card"
      role="dialog"
      aria-modal="true"
      aria-label={t("shell.viewer.pdf.sign")}
      transition:fly={{ y: 10, duration: 160, opacity: 0.08 }}
    >
      <div class="pdf-dialog-header">
        <div class="pdf-password-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 20l4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="m13 8 3 3"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="pdf-password-copy">
          <span class="pdf-password-title">{t("shell.viewer.pdf.sign")}</span>
          <span class="pdf-password-hint">{t("shell.viewer.pdf.signHint")}</span
          >
        </div>
        <button
          type="button"
          class="pdf-dialog-close"
          onclick={onCancel}
          aria-label={t("common.close")}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <canvas
        class="pdf-signature-canvas"
        use:setupCanvas
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        aria-label={t("shell.viewer.pdf.signHint")}
      ></canvas>
      <div class="pdf-password-actions">
        <button type="button" class="pdf-password-btn" onclick={clear}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 19h14M8 15l7-7a2.1 2.1 0 0 1 3 3l-7 7H8v-3Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {t("shell.viewer.pdf.signClear")}
        </button>
        <button type="button" class="pdf-password-btn" onclick={onCancel}>
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          class="pdf-password-btn primary"
          onclick={apply}
          disabled={paths.length === 0}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path
              d="m2 5 2 2 4-4"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {t("common.apply")}
        </button>
      </div>
    </div>
  </div>
{/if}
