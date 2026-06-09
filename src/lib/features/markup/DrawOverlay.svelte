<script lang="ts">
  import {
    markup,
    type PlacedShape,
    type PlacedLine,
    type FreehandStroke,
    type ShapeKind,
    type LineKind,
    type MarkupTool,
  } from "$lib/features/markup/markup.svelte";

  let {
    containerEl,
    mediaEl,
  }: { containerEl: HTMLElement | null; mediaEl: HTMLElement | null } =
    $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let overlayRect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let resizeObs: ResizeObserver | null = $state(null);
  let isPointerDown = $state(false);

  // Non-path line drag state
  let lineStart = $state<{ x: number; y: number } | null>(null);
  let previewEnd = $state<{ x: number; y: number } | null>(null);

  // ── Helpers ───────────────────────────────────────────

  function isShapeTool(tool: MarkupTool): tool is ShapeKind {
    return tool === "square" || tool === "circle" || tool === "triangle";
  }

  function isLineTool(tool: MarkupTool): tool is LineKind {
    return (
      tool === "line" ||
      tool === "arrow" ||
      tool === "bidirectional-arrow"
    );
  }

  /** Arrowhead size in CSS px — scales with thickness. */
  function arrowSize(thickness: number) {
    return Math.max(10, thickness * 4);
  }

  function drawArrowhead(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    size: number,
  ) {
    const a = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - size * Math.cos(angle - a),
      y - size * Math.sin(angle - a),
    );
    ctx.lineTo(
      x - size * Math.cos(angle + a),
      y - size * Math.sin(angle + a),
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawPlacedShape(
    ctx: CanvasRenderingContext2D,
    s: PlacedShape,
    w: number,
    h: number,
  ) {
    const cx = s.cx * w;
    const cy = s.cy * h;
    const dim = s.size * Math.min(w, h);
    const half = dim / 2;
    ctx.beginPath();
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.shape === "square") {
      if (s.rounded) {
        const r = dim * 0.2;
        ctx.roundRect(cx - half, cy - half, dim, dim, r);
      } else {
        ctx.rect(cx - half, cy - half, dim, dim);
      }
      ctx.stroke();
    } else if (s.shape === "circle") {
      ctx.arc(cx, cy, half, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.shape === "triangle") {
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx + half, cy + half);
      ctx.lineTo(cx - half, cy + half);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlacedLine(
    ctx: CanvasRenderingContext2D,
    l: PlacedLine,
    w: number,
    h: number,
  ) {
    ctx.beginPath();
    ctx.globalAlpha = l.opacity;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = l.color;

    if (!l.isPath) {
      // Straight line
      const x1 = l.x1 * w,
        y1 = l.y1 * h;
      const x2 = l.x2 * w,
        y2 = l.y2 * h;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const aSize = arrowSize(l.thickness);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      if (
        l.lineType === "arrow" ||
        l.lineType === "bidirectional-arrow"
      ) {
        drawArrowhead(ctx, x2, y2, angle, aSize);
      }
      if (l.lineType === "bidirectional-arrow") {
        drawArrowhead(ctx, x1, y1, angle + Math.PI, aSize);
      }
    } else {
      // Freehand path with arrowhead(s)
      const pts = l.points;
      if (pts.length < 1) return;
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
      ctx.stroke();

      if (pts.length >= 2) {
        const aSize = arrowSize(l.thickness);
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const endAngle = Math.atan2(
          last.y - prev.y,
          last.x - prev.x,
        );
        if (
          l.lineType === "arrow" ||
          l.lineType === "bidirectional-arrow"
        ) {
          drawArrowhead(
            ctx,
            last.x * w,
            last.y * h,
            endAngle,
            aSize,
          );
        }
        if (l.lineType === "bidirectional-arrow") {
          const first = pts[0];
          const second = pts.length > 1 ? pts[1] : pts[0];
          const startAngle = Math.atan2(
            first.y - second.y,
            first.x - second.x,
          );
          drawArrowhead(
            ctx,
            first.x * w,
            first.y * h,
            startAngle,
            aSize,
          );
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFreehand(
    ctx: CanvasRenderingContext2D,
    stroke: FreehandStroke,
    w: number,
    h: number,
  ) {
    const pts = stroke.points;
    if (pts.length < 1) return;
    ctx.beginPath();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pts.length === 1) {
      ctx.arc(
        pts[0].x * w,
        pts[0].y * h,
        stroke.thickness / 2,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCurrentStrokePathPreview(
    ctx: CanvasRenderingContext2D,
    stroke: FreehandStroke,
    w: number,
    h: number,
    lineType: LineKind,
  ) {
    const pts = stroke.points;
    if (pts.length < 2) return;
    ctx.fillStyle = stroke.color;
    const aSize = arrowSize(stroke.thickness);
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const endAngle = Math.atan2(
      last.y - prev.y,
      last.x - prev.x,
    );
    if (lineType === "arrow" || lineType === "bidirectional-arrow") {
      drawArrowhead(ctx, last.x * w, last.y * h, endAngle, aSize);
    }
    if (lineType === "bidirectional-arrow") {
      const first = pts[0];
      const second = pts.length > 1 ? pts[1] : pts[0];
      const startAngle = Math.atan2(
        first.y - second.y,
        first.x - second.x,
      );
      drawArrowhead(ctx, first.x * w, first.y * h, startAngle, aSize);
    }
  }

  function drawLinePreview(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w: number,
    h: number,
  ) {
    const activeTool = markup.activeTool;
    if (!isLineTool(activeTool)) return;
    ctx.beginPath();
    ctx.globalAlpha = markup.drawOpacity;
    ctx.strokeStyle = markup.drawColor;
    ctx.lineWidth = markup.drawThickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const px1 = x1 * w,
      py1 = y1 * h;
    const px2 = x2 * w,
      py2 = y2 * h;
    ctx.moveTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.stroke();

    ctx.fillStyle = markup.drawColor;
    const aSize = arrowSize(markup.drawThickness);
    const angle = Math.atan2(py2 - py1, px2 - px1);
    if (
      activeTool === "arrow" ||
      activeTool === "bidirectional-arrow"
    ) {
      drawArrowhead(ctx, px2, py2, angle, aSize);
    }
    if (activeTool === "bidirectional-arrow") {
      drawArrowhead(ctx, px1, py1, angle + Math.PI, aSize);
    }
    ctx.globalAlpha = 1;
  }

  // ── Overlay geometry ──────────────────────────────────

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

  // ── Rendering ─────────────────────────────────────────

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

    // Draw committed strokes
    for (const stroke of markup.strokes) {
      if (stroke.type === "freehand") {
        drawFreehand(ctx, stroke, w, h);
      } else if (stroke.type === "shape") {
        drawPlacedShape(ctx, stroke, w, h);
      } else if (stroke.type === "line") {
        drawPlacedLine(ctx, stroke, w, h);
      }
    }

    // Draw in-progress freehand / path-line stroke
    const cur = markup.currentStroke;
    if (cur) {
      drawFreehand(ctx, cur, w, h);
      // If in path mode with a line tool, overlay arrowhead preview
      if (markup.pathMode && isLineTool(markup.activeTool)) {
        drawCurrentStrokePathPreview(
          ctx,
          cur,
          w,
          h,
          markup.activeTool,
        );
      }
    }

    // Draw non-path line preview during drag
    if (lineStart && previewEnd) {
      drawLinePreview(
        ctx,
        lineStart.x,
        lineStart.y,
        previewEnd.x,
        previewEnd.y,
        w,
        h,
      );
    }

    ctx.globalAlpha = 1;
  }

  // ── Lifecycle ─────────────────────────────────────────

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
      // Reset drag state when draw deactivated
      lineStart = null;
      previewEnd = null;
    }
  });

  $effect(() => {
    // Redraw when strokes, current stroke, tool, or path mode change
    const _strokes = markup.strokes;
    const _current = markup.currentStroke;
    const _tool = markup.activeTool;
    const _path = markup.pathMode;
    redrawAll();
  });

  // ── Coordinate helpers ───────────────────────────────

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

  // ── Pointer handlers ──────────────────────────────────

  function handlePointerDown(e: PointerEvent) {
    if (!markup.drawActive) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    const p = toNormal(e.clientX, e.clientY);
    const tool = markup.activeTool;

    if (isShapeTool(tool)) {
      // Shape placement — instant on click
      markup.placeShape(p.x, p.y);
      canvasEl?.setPointerCapture(e.pointerId);
      redrawAll();
    } else if (isLineTool(tool) && !markup.pathMode) {
      // Non-path line — start drag
      lineStart = p;
      previewEnd = p;
      canvasEl?.setPointerCapture(e.pointerId);
    } else {
      // Freehand or path-mode line — start stroke
      markup.startStroke(p.x, p.y);
      canvasEl?.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPointerDown || !markup.drawActive) return;
    e.preventDefault();
    const p = toNormal(e.clientX, e.clientY);
    const tool = markup.activeTool;

    if (isLineTool(tool) && !markup.pathMode && lineStart) {
      // Non-path line — update preview
      previewEnd = p;
      redrawAll();
    } else if (isLineTool(tool) && markup.pathMode) {
      // Path-mode line — freehand path
      markup.addPoint(p.x, p.y);
      redrawAll();
    } else if (tool === "freehand") {
      markup.addPoint(p.x, p.y);
      redrawAll();
    }
    // Shapes don't move on pointer move — placed on down
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;
    const tool = markup.activeTool;

    if (isLineTool(tool) && !markup.pathMode && lineStart && previewEnd) {
      // Non-path line — finalize
      markup.placeLine(
        lineStart.x,
        lineStart.y,
        previewEnd.x,
        previewEnd.y,
        tool,
      );
      lineStart = null;
      previewEnd = null;
      redrawAll();
    } else if (isLineTool(tool) && markup.pathMode) {
      // Path-mode line — convert freehand path to PlacedLine
      markup.endPathLine(tool);
      redrawAll();
    } else if (tool === "freehand") {
      markup.endStroke();
      redrawAll();
    }
    // Shapes are already placed on pointer down

    canvasEl?.releasePointerCapture(e.pointerId);
  }

  // Cursor is provided by markup.cursorStyle (avoids duplicating SVG URLs)
</script>

{#if markup.drawActive && overlayRect.width > 0 && overlayRect.height > 0}
  <canvas
    bind:this={canvasEl}
    class="draw-overlay"
    style="position: absolute; left: {overlayRect.left}px; top: {overlayRect.top}px; width: {overlayRect.width}px; height: {overlayRect.height}px; cursor: {markup.cursorStyle}; z-index: 999;"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
  ></canvas>
{/if}
