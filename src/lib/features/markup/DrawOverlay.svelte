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

  // Transform handle drag state
  type HandleType = "left" | "right" | "top" | "bottom" | "corner" | "rotate";
  let dragHandle = $state<HandleType | null>(null);
  let dragOrigin = $state<{ x: number; y: number } | null>(null);
  let dragStartShape = $state<{
    width: number;
    height: number;
    rotation: number;
    cornerRadius: number;
    cx: number;
    cy: number;
  } | null>(null);

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
    const halfW = (s.width * w) / 2;
    const halfH = (s.height * h) / 2;
    const sw = s.width * w;
    const sh = s.height * h;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.rotation);
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    if (s.shape === "square") {
      if (s.cornerRadius > 0) {
        const r = s.cornerRadius * Math.min(sw, sh);
        ctx.roundRect(-halfW, -halfH, sw, sh, r);
      } else {
        ctx.rect(-halfW, -halfH, sw, sh);
      }
      ctx.stroke();
    } else if (s.shape === "circle") {
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.shape === "triangle") {
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
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

  // ── Transform handle helpers ─────────────────────────

  /** Compute handle positions in CSS pixels for a shape at given overlay dims. */
  function getHandlePositions(s: PlacedShape, w: number, h: number) {
    const cx = s.cx * w;
    const cy = s.cy * h;
    const hw = (s.width * w) / 2;
    const hh = (s.height * h) / 2;
    const hs = 8; // handle half-size in CSS px
    return {
      left: { x: cx - hw, y: cy, hs },
      right: { x: cx + hw, y: cy, hs },
      top: { x: cx, y: cy - hh, hs },
      bottom: { x: cx, y: cy + hh, hs },
      corner: { x: cx - hw, y: cy - hh, hs },
      rotate: { x: cx, y: cy - hh - 24, hs },
    };
  }

  function drawTransformHandles(
    ctx: CanvasRenderingContext2D,
    s: PlacedShape,
    w: number,
    h: number,
  ) {
    const cx = s.cx * w;
    const cy = s.cy * h;
    const hw = (s.width * w) / 2;
    const hh = (s.height * h) / 2;

    // Dashed bounding box
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.setLineDash([]);

    // Width/height handles (blue squares)
    ctx.fillStyle = "#3b82f6";
    const hSize = 4;
    // Left
    ctx.fillRect(cx - hw - hSize, cy - hSize, hSize * 2, hSize * 2);
    // Right
    ctx.fillRect(cx + hw - hSize, cy - hSize, hSize * 2, hSize * 2);
    // Top
    ctx.fillRect(cx - hSize, cy - hh - hSize, hSize * 2, hSize * 2);
    // Bottom
    ctx.fillRect(cx - hSize, cy + hh - hSize, hSize * 2, hSize * 2);

    // Corner-radius handle (green circle) — only for squares with cornerRadius > 0
    if (s.shape === "square" && s.cornerRadius > 0) {
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(cx - hw, cy - hh, hSize + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rotation handle (amber circle + line)
    const rotY = cy - hh - 24;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx, rotY);
    ctx.stroke();

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(cx, rotY, hSize + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Returns which handle is within HIT_RADIUS CSS px of (px, py), or null. */
  const HIT_RADIUS = 10;

  function hitTestHandle(
    s: PlacedShape,
    w: number,
    h: number,
    px: number,
    py: number,
  ): HandleType | null {
    const handles = getHandlePositions(s, w, h);
    for (const [key, pos] of Object.entries(handles)) {
      if (key === "corner" && !(s.shape === "square" && s.cornerRadius > 0))
        continue;
      const dx = px - pos.x;
      const dy = py - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS) return key as HandleType;
    }
    return null;
  }

  /** Check if normalized point (nx, ny) is inside the shape's bounding box. */
  function isInsideShapeBounds(s: PlacedShape, nx: number, ny: number) {
    const halfW = s.width / 2;
    const halfH = s.height / 2;
    return (
      nx >= s.cx - halfW &&
      nx <= s.cx + halfW &&
      ny >= s.cy - halfH &&
      ny <= s.cy + halfH
    );
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

    // Draw transform handles for selected shape
    const sel = markup.selectedIndex;
    if (sel !== null) {
      const stroke = markup.strokes[sel];
      if (stroke && stroke.type === "shape") {
        drawTransformHandles(ctx, stroke, w, h);
      }
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

  // ── Transform handle drag ────────────────────────────

  function handleDragMove(e: PointerEvent) {
    if (!dragHandle || !canvasEl) return;
    e.preventDefault();
    const p = toNormal(e.clientX, e.clientY);
    const sel = markup.selectedIndex;
    if (sel === null || !dragStartShape) return;
    const stroke = markup.strokes[sel];
    if (!stroke || stroke.type !== "shape") return;

    const update: Partial<PlacedShape> = {};
    const dx = p.x - (dragOrigin?.x ?? 0);
    const dy = p.y - (dragOrigin?.y ?? 0);

    switch (dragHandle) {
      case "left": {
        // Left edge follows pointer, right edge stays → center shifts by dx/2
        const newW = Math.max(0.01, dragStartShape.width - dx);
        update.width = newW;
        update.cx = dragStartShape.cx + dx / 2;
        break;
      }
      case "right": {
        // Right edge follows pointer, left edge stays
        const newW = Math.max(0.01, dragStartShape.width + dx);
        update.width = newW;
        update.cx = dragStartShape.cx + dx / 2;
        break;
      }
      case "top": {
        // Top edge follows pointer, bottom edge stays
        const newH = Math.max(0.01, dragStartShape.height - dy);
        update.height = newH;
        update.cy = dragStartShape.cy + dy / 2;
        break;
      }
      case "bottom": {
        // Bottom edge follows pointer, top edge stays
        const newH = Math.max(0.01, dragStartShape.height + dy);
        update.height = newH;
        update.cy = dragStartShape.cy + dy / 2;
        break;
      }
      case "corner": {
        const maxR = 0.5;
        const diag = Math.sqrt(
          dragStartShape.width * dragStartShape.width +
            dragStartShape.height * dragStartShape.height,
        );
        const proj = (-dx * dragStartShape.width + -dy * dragStartShape.height) / (diag || 1);
        update.cornerRadius = Math.max(
          0,
          Math.min(maxR, dragStartShape.cornerRadius + proj / diag),
        );
        break;
      }
      case "rotate": {
        const ocx = dragStartShape.cx;
        const ocy = dragStartShape.cy;
        const currentAngle = Math.atan2(p.y - ocy, p.x - ocx);
        const startAngle = Math.atan2(
          (dragOrigin?.y ?? 0) - ocy,
          (dragOrigin?.x ?? 0) - ocx,
        );
        update.rotation = dragStartShape.rotation + (currentAngle - startAngle);
        break;
      }
    }
    if (Object.keys(update).length > 0) {
      markup.updateShape(sel, update);
    }
    redrawAll();
  }

  // ── Pointer handlers ──────────────────────────────────

  function handlePointerDown(e: PointerEvent) {
    if (!markup.drawActive) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    const p = toNormal(e.clientX, e.clientY);
    const tool = markup.activeTool;
    // Convert normalized coords to CSS-pixel positions relative to overlay (canvas)
    const rawPx = p.x * overlayRect.width;
    const rawPy = p.y * overlayRect.height;

    // Check transform handle hit first — takes priority over all tools
    const sel = markup.selectedIndex;
    if (sel !== null) {
      const stroke = markup.strokes[sel];
      if (stroke && stroke.type === "shape") {
        const hit = hitTestHandle(stroke, overlayRect.width, overlayRect.height, rawPx, rawPy);
        if (hit) {
          dragHandle = hit;
          dragOrigin = p;
          dragStartShape = {
            width: stroke.width,
            height: stroke.height,
            rotation: stroke.rotation,
            cornerRadius: stroke.cornerRadius,
            cx: stroke.cx,
            cy: stroke.cy,
          };
          canvasEl?.setPointerCapture(e.pointerId);
          return; // skip normal tool dispatch
        }
        // Click outside shape bounds → deselect
        if (!isInsideShapeBounds(stroke, p.x, p.y)) {
          markup.selectShape(null);
        }
      }
    }

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
    if (!markup.drawActive) return;
    // Handle drag takes priority
    if (dragHandle) {
      handleDragMove(e);
      return;
    }
    if (!isPointerDown) return;
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
    if (dragHandle) {
      // Finalize handle drag
      dragHandle = null;
      dragOrigin = null;
      dragStartShape = null;
      canvasEl?.releasePointerCapture(e.pointerId);
      return;
    }
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
