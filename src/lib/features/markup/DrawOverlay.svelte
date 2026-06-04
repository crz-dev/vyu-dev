<script lang="ts">
  import { markup } from "$lib/features/markup/markup.svelte";

  let {
    containerEl,
    mediaEl,
  }: { containerEl: HTMLElement | null; mediaEl: HTMLElement | null } =
    $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let overlayRect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let resizeObs: ResizeObserver | null = $state(null);
  let isPointerDown = $state(false);

  function updateOverlayRect() {
    if (!containerEl || !mediaEl) return;
    const cr = containerEl.getBoundingClientRect();
    const mr = mediaEl.getBoundingClientRect();
    overlayRect = {
      left: mr.left - cr.left,
      top: mr.top - cr.top,
      width: mr.width,
      height: mr.height,
    };
  }

  function redrawAll() {
    const canvas = canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = overlayRect.width;
    const h = overlayRect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const allStrokes = markup.currentStroke
      ? [...markup.strokes, markup.currentStroke]
      : markup.strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 1) continue;
      ctx.beginPath();
      ctx.globalAlpha = stroke.opacity;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.arc(pts[0].x * w, pts[0].y * h, stroke.thickness / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * w, pts[i].y * h);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  $effect(() => {
    if (markup.drawActive && mediaEl && containerEl) {
      updateOverlayRect();
      if (!resizeObs) {
        resizeObs = new ResizeObserver(() => {
          updateOverlayRect();
          redrawAll();
        });
        resizeObs.observe(mediaEl);
        resizeObs.observe(containerEl);
      }
    } else {
      if (resizeObs) {
        resizeObs.disconnect();
        resizeObs = null;
      }
    }
  });

  $effect(() => {
    // Redraw when strokes change
    const _strokes = markup.strokes;
    const _current = markup.currentStroke;
    redrawAll();
  });

  function toNormal(clientX: number, clientY: number) {
    if (overlayRect.width <= 0 || overlayRect.height <= 0)
      return { x: 0, y: 0 };
    const canvas = canvasEl;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width,
      y: (clientY - r.top) / r.height,
    };
  }

  function handlePointerDown(e: PointerEvent) {
    if (!markup.drawActive) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    const p = toNormal(e.clientX, e.clientY);
    markup.startStroke(p.x, p.y);
    canvasEl?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPointerDown || !markup.drawActive) return;
    e.preventDefault();
    const p = toNormal(e.clientX, e.clientY);
    markup.addPoint(p.x, p.y);
    redrawAll();
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;
    markup.endStroke();
    canvasEl?.releasePointerCapture(e.pointerId);
    redrawAll();
  }
</script>

{#if markup.drawActive && overlayRect.width > 0 && overlayRect.height > 0}
  <canvas
    bind:this={canvasEl}
    class="draw-overlay"
    style="position: absolute; left: {overlayRect.left}px; top: {overlayRect.top}px; width: {overlayRect.width}px; height: {overlayRect.height}px; cursor: crosshair; z-index: 999;"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
  ></canvas>
{/if}
