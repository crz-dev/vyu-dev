<script lang="ts">
  import {
    markup,
    type PlacedShape,
    type PlacedLine,
    type FreehandStroke,
    type HighlightFreehand,
    type HighlightStraight,
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

  // Shape drag state
  let shapeDragStart = $state<{ x: number; y: number } | null>(null);
  let shapePreviewEnd = $state<{ x: number; y: number } | null>(null);

  // Straight highlight drag state
  let highlightStraightStart = $state<{ x: number; y: number } | null>(null);
  let highlightStraightPreview = $state<{ x: number; y: number } | null>(null);

  // Transform handle drag state
  type HandleType = "left" | "right" | "top" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "rotate" | "delete";
  let dragHandle = $state<HandleType | null>(null);
  let dragOrigin = $state<{ x: number; y: number } | null>(null);
  let dragStartShape = $state<{
    width: number;
    height: number;
    rotation: number;
    cx: number;
    cy: number;
  } | null>(null);
  let hoveredHandle = $state<HandleType | null>(null);
  let hoverScale = $state(0);
  let hoverTarget = $state(0);
  let hoverRaf = 0;

  // Shape move drag state
  let isMovingShape = $state(false);
  let moveOrigin = $state<{ x: number; y: number } | null>(null);
  let moveStartCx = $state(0);
  let moveStartCy = $state(0);

  // ── Helpers ───────────────────────────────────────────

  function lerpHover() {
    const target = hoverTarget;
    const speed = 0.25;
    const next = hoverScale + (target - hoverScale) * speed;
    // Snap when close enough to avoid infinite frames
    if (Math.abs(next - target) < 0.01) {
      hoverScale = target;
      redrawAll();
      return;
    }
    hoverScale = next;
    redrawAll();
    hoverRaf = requestAnimationFrame(lerpHover);
  }

  function startHoverAnim(target: number) {
    hoverTarget = target;
    if (hoverRaf) cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(lerpHover);
  }

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

  function drawHighlightFreehand(
    ctx: CanvasRenderingContext2D,
    stroke: HighlightFreehand,
    w: number,
    h: number,
  ) {
    const pts = stroke.points;
    if (pts.length < 1) return;
    ctx.beginPath();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

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

  function drawHighlightStraightBar(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w: number,
    h: number,
    color: string,
    thickness: number,
    opacity: number,
  ) {
    const px1 = x1 * w;
    const py1 = y1 * h;
    const px2 = x2 * w;
    const py2 = y2 * h;
    const angle = Math.atan2(py2 - py1, px2 - px1);
    const halfThick = thickness / 2;
    const cos = Math.cos(angle + Math.PI / 2);
    const sin = Math.sin(angle + Math.PI / 2);

    ctx.beginPath();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.moveTo(px1 + cos * halfThick, py1 + sin * halfThick);
    ctx.lineTo(px2 + cos * halfThick, py2 + sin * halfThick);
    ctx.lineTo(px2 - cos * halfThick, py2 - sin * halfThick);
    ctx.lineTo(px1 - cos * halfThick, py1 - sin * halfThick);
    ctx.closePath();
    ctx.fill();
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

  function drawShapePreview(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w: number,
    h: number,
  ) {
    const tool = markup.activeTool;
    if (!isShapeTool(tool)) return;
    const cx = ((x1 + x2) / 2) * w;
    const cy = ((y1 + y2) / 2) * h;
    const halfW = (Math.abs(x2 - x1) / 2) * w;
    const halfH = (Math.abs(y2 - y1) / 2) * h;
    if (halfW < 1 && halfH < 1) return;

    ctx.save();
    ctx.globalAlpha = markup.drawOpacity;
    ctx.strokeStyle = markup.drawColor;
    ctx.lineWidth = markup.drawThickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    if (tool === "square") {
      const sw = halfW * 2;
      const sh = halfH * 2;
      if (markup.roundedCorner) {
        const r = 0.2 * Math.min(sw, sh);
        ctx.roundRect(cx - halfW, cy - halfH, sw, sh, r);
      } else {
        ctx.rect(cx - halfW, cy - halfH, sw, sh);
      }
      ctx.stroke();
    } else if (tool === "circle") {
      ctx.ellipse(cx, cy, halfW, halfH, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === "triangle") {
      ctx.moveTo(cx, cy - halfH);
      ctx.lineTo(cx + halfW, cy + halfH);
      ctx.lineTo(cx - halfW, cy + halfH);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Find the topmost shape under the given normalized point, or null. */
  function findShapeAtPoint(nx: number, ny: number): number | null {
    const strokesArr = markup.strokes;
    for (let i = strokesArr.length - 1; i >= 0; i--) {
      const s = strokesArr[i];
      if (s.type === "shape" && isInsideShapeBounds(s, nx, ny)) {
        return i;
      }
    }
    return null;
  }

  // ── Transform handle helpers ─────────────────────────

  /** Compute handle positions in local (unrotated) shape space. */
  function getHandlePositions(s: PlacedShape, w: number, h: number) {
    const cx = s.cx * w;
    const cy = s.cy * h;
    const hw = (s.width * w) / 2;
    const hh = (s.height * h) / 2;

    if (s.shape === "circle") {
      // Corner handles on the ellipse edge (parametric: x = hw*cos(t), y = hh*sin(t))
      // At 45° increments for diagonal corners
      const diag = 1 / Math.SQRT2;
      return {
        left: { x: cx - hw, y: cy },
        right: { x: cx + hw, y: cy },
        top: { x: cx, y: cy - hh },
        bottom: { x: cx, y: cy + hh },
        topLeft: { x: cx - hw * diag, y: cy - hh * diag },
        topRight: { x: cx + hw * diag, y: cy - hh * diag },
        bottomLeft: { x: cx - hw * diag, y: cy + hh * diag },
        bottomRight: { x: cx + hw * diag, y: cy + hh * diag },
        rotate: { x: cx, y: cy - hh - 22 },
        delete: { x: cx + hw * diag + 14, y: cy - hh * diag - 14 },
      };
    }

    if (s.shape === "triangle") {
      // Vertices + edge midpoints (no topLeft/topRight — no shape there)
      return {
        left: { x: cx - hw / 2, y: cy },
        right: { x: cx + hw / 2, y: cy },
        bottom: { x: cx, y: cy + hh },
        top: { x: cx, y: cy - hh },
        bottomLeft: { x: cx - hw, y: cy + hh },
        bottomRight: { x: cx + hw, y: cy + hh },
        rotate: { x: cx, y: cy - hh - 22 },
        delete: { x: cx + hw / 2 + 14, y: cy - 14 },
      };
    }

    // Square — all handles
    return {
      left: { x: cx - hw, y: cy },
      right: { x: cx + hw, y: cy },
      top: { x: cx, y: cy - hh },
      bottom: { x: cx, y: cy + hh },
      topLeft: { x: cx - hw, y: cy - hh },
      topRight: { x: cx + hw, y: cy - hh },
      bottomLeft: { x: cx - hw, y: cy + hh },
      bottomRight: { x: cx + hw, y: cy + hh },
      rotate: { x: cx, y: cy - hh - 22 },
      delete: { x: cx + hw + 14, y: cy - hh - 14 },
    };
  }

  function drawDiamond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    fill: string,
    stroke: string,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.strokeRect(-size, -size, size * 2, size * 2);
    ctx.restore();
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

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.rotation);

    const t = hoverScale;
    const edgeSize = 4 + t * 1.5;
    const vertexSize = 5 + t * 2;

    const drawHandle = (hx: number, hy: number, size: number) => {
      drawDiamond(ctx, hx, hy, size, "#ffffff", "#ffffff");
    };

    // Default delete position (square)
    let delX = hw + 14;
    let delY = -hh - 14;

    if (s.shape === "circle") {
      drawHandle(-hw, 0, edgeSize);
      drawHandle(hw, 0, edgeSize);
      drawHandle(0, -hh, edgeSize);
      drawHandle(0, hh, edgeSize);
      const diag = 1 / Math.SQRT2;
      drawHandle(-hw * diag, -hh * diag, vertexSize);
      drawHandle(hw * diag, -hh * diag, vertexSize);
      drawHandle(-hw * diag, hh * diag, vertexSize);
      drawHandle(hw * diag, hh * diag, vertexSize);
      delX = hw * diag + 14;
      delY = -hh * diag - 14;
    } else if (s.shape === "triangle") {
      drawHandle(-hw / 2, 0, edgeSize);
      drawHandle(hw / 2, 0, edgeSize);
      drawHandle(0, hh, edgeSize);
      drawHandle(0, -hh, vertexSize);
      drawHandle(-hw, hh, vertexSize);
      drawHandle(hw, hh, vertexSize);
      delX = hw / 2 + 14;
      delY = -14;
    } else {
      drawHandle(-hw, 0, edgeSize);
      drawHandle(hw, 0, edgeSize);
      drawHandle(0, -hh, edgeSize);
      drawHandle(0, hh, edgeSize);
      drawHandle(-hw, -hh, vertexSize);
      drawHandle(hw, -hh, vertexSize);
      drawHandle(-hw, hh, vertexSize);
      drawHandle(hw, hh, vertexSize);
    }

    // Rotation handle — white circle
    const rotGap = 22;
    const rotY = -hh - rotGap;
    const rotR = 5 + t;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, rotY, rotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Delete handle — red X
    const delR = 6 + t;
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(delX, delY, delR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Draw X
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(delX - 3, delY - 3);
    ctx.lineTo(delX + 3, delY + 3);
    ctx.moveTo(delX + 3, delY - 3);
    ctx.lineTo(delX - 3, delY + 3);
    ctx.stroke();

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
    const cx = s.cx * w;
    const cy = s.cy * h;
    // Un-rotate mouse into shape-local coordinate space
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const dx = px - cx;
    const dy = py - cy;
    const localPx = cos * dx - sin * dy + cx;
    const localPy = sin * dx + cos * dy + cy;

    const handles = getHandlePositions(s, w, h);
    for (const [key, pos] of Object.entries(handles)) {
      const hx = localPx - pos.x;
      const hy = localPy - pos.y;
      if (Math.sqrt(hx * hx + hy * hy) <= HIT_RADIUS) return key as HandleType;
    }
    return null;
  }

  /** Check if normalized point (nx, ny) is inside the shape's bounding box, accounting for rotation. */
  function isInsideShapeBounds(s: PlacedShape, nx: number, ny: number) {
    const halfW = s.width / 2;
    const halfH = s.height / 2;
    // Un-rotate the point into shape-local space
    const dx = nx - s.cx;
    const dy = ny - s.cy;
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const localX = cos * dx - sin * dy;
    const localY = sin * dx + cos * dy;
    return (
      localX >= -halfW &&
      localX <= halfW &&
      localY >= -halfH &&
      localY <= halfH
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
      } else if (stroke.type === "highlight") {
        if (stroke.mode === "free") {
          drawHighlightFreehand(ctx, stroke, w, h);
        } else {
          drawHighlightStraightBar(
            ctx,
            stroke.x1,
            stroke.y1,
            stroke.x2,
            stroke.y2,
            w,
            h,
            stroke.color,
            stroke.thickness,
            stroke.opacity,
          );
        }
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

    // Draw in-progress highlight freehand stroke
    const curHL = markup.currentHighlight;
    if (curHL && curHL.mode === "free") {
      drawHighlightFreehand(ctx, curHL, w, h);
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

    // Draw shape preview during drag
    if (shapeDragStart && shapePreviewEnd) {
      drawShapePreview(
        ctx,
        shapeDragStart.x,
        shapeDragStart.y,
        shapePreviewEnd.x,
        shapePreviewEnd.y,
        w,
        h,
      );
    }

    // Draw straight highlight preview during drag
    if (highlightStraightStart && highlightStraightPreview) {
      drawHighlightStraightBar(
        ctx,
        highlightStraightStart.x,
        highlightStraightStart.y,
        highlightStraightPreview.x,
        highlightStraightPreview.y,
        w,
        h,
        markup.highlightColor,
        markup.highlightThickness,
        markup.highlightOpacity,
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
    if ((markup.drawActive || markup.highlightActive) && mediaEl && containerEl) {
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
      // Reset drag state when draw/highlight deactivated
      lineStart = null;
      previewEnd = null;
      shapeDragStart = null;
      shapePreviewEnd = null;
      isMovingShape = false;
      moveOrigin = null;
      highlightStraightStart = null;
      highlightStraightPreview = null;
    }
  });

  $effect(() => {
    // Redraw when strokes, current stroke, tool, path mode, or highlight state change
    const _strokes = markup.strokes;
    const _current = markup.currentStroke;
    const _tool = markup.activeTool;
    const _path = markup.pathMode;
    const _hlActive = markup.highlightActive;
    const _hlCur = markup.currentHighlight;
    redrawAll();
  });

  $effect(() => {
    if ((markup.drawActive || markup.highlightActive) && canvasEl) {
      canvasEl.focus();
    }
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

    // Un-rotate drag delta into shape-local coordinate space
    const cos = Math.cos(-stroke.rotation);
    const sin = Math.sin(-stroke.rotation);
    const ldx = cos * dx - sin * dy;
    const ldy = sin * dx + cos * dy;

    switch (dragHandle) {
      case "left": {
        const newW = Math.max(0.01, dragStartShape.width - ldx);
        update.width = newW;
        update.cx = dragStartShape.cx + ldx / 2;
        break;
      }
      case "right": {
        const newW = Math.max(0.01, dragStartShape.width + ldx);
        update.width = newW;
        update.cx = dragStartShape.cx + ldx / 2;
        break;
      }
      case "top": {
        const newH = Math.max(0.01, dragStartShape.height - ldy);
        update.height = newH;
        update.cy = dragStartShape.cy + ldy / 2;
        break;
      }
      case "bottom": {
        const newH = Math.max(0.01, dragStartShape.height + ldy);
        update.height = newH;
        update.cy = dragStartShape.cy + ldy / 2;
        break;
      }
      case "topLeft": {
        // Bottom-right corner stays fixed
        const newW = Math.max(0.01, dragStartShape.width - ldx);
        const newH = Math.max(0.01, dragStartShape.height - ldy);
        update.width = newW;
        update.height = newH;
        update.cx = dragStartShape.cx + ldx / 2;
        update.cy = dragStartShape.cy + ldy / 2;
        break;
      }
      case "topRight": {
        // Bottom-left corner stays fixed
        const newW = Math.max(0.01, dragStartShape.width + ldx);
        const newH = Math.max(0.01, dragStartShape.height - ldy);
        update.width = newW;
        update.height = newH;
        update.cx = dragStartShape.cx + ldx / 2;
        update.cy = dragStartShape.cy + ldy / 2;
        break;
      }
      case "bottomLeft": {
        // Top-right corner stays fixed
        const newW = Math.max(0.01, dragStartShape.width - ldx);
        const newH = Math.max(0.01, dragStartShape.height + ldy);
        update.width = newW;
        update.height = newH;
        update.cx = dragStartShape.cx + ldx / 2;
        update.cy = dragStartShape.cy + ldy / 2;
        break;
      }
      case "bottomRight": {
        // Top-left corner stays fixed
        const newW = Math.max(0.01, dragStartShape.width + ldx);
        const newH = Math.max(0.01, dragStartShape.height + ldy);
        update.width = newW;
        update.height = newH;
        update.cx = dragStartShape.cx + ldx / 2;
        update.cy = dragStartShape.cy + ldy / 2;
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
    if (!markup.drawActive && !markup.highlightActive) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    const p = toNormal(e.clientX, e.clientY);

    // Highlight mode — handle separately
    if (markup.highlightActive) {
      if (markup.highlightMode === "free") {
        markup.startHighlightStroke(p.x, p.y);
      } else {
        highlightStraightStart = p;
        highlightStraightPreview = p;
      }
      canvasEl?.setPointerCapture(e.pointerId);
      return;
    }

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
        if (hit === "delete") {
          markup.deleteSelectedShape();
          redrawAll();
          return;
        }
        if (hit) {
          dragHandle = hit;
          dragOrigin = p;
          dragStartShape = {
            width: stroke.width,
            height: stroke.height,
            rotation: stroke.rotation,
            cx: stroke.cx,
            cy: stroke.cy,
          };
          canvasEl?.setPointerCapture(e.pointerId);
          return; // skip normal tool dispatch
        }
        // Click inside selected shape → start move drag
        if (isInsideShapeBounds(stroke, p.x, p.y)) {
          isMovingShape = true;
          moveOrigin = p;
          moveStartCx = stroke.cx;
          moveStartCy = stroke.cy;
          canvasEl?.setPointerCapture(e.pointerId);
          return;
        }
        // Click outside shape bounds → deselect
        markup.selectShape(null);
      }
    }

    if (isShapeTool(tool)) {
      // Click on existing shape → select it for transform
      const hitIdx = findShapeAtPoint(p.x, p.y);
      if (hitIdx !== null) {
        markup.selectShape(hitIdx);
        canvasEl?.setPointerCapture(e.pointerId);
        redrawAll();
        return;
      }
      // Start shape drag — sized on release, default size on click-only
      shapeDragStart = p;
      shapePreviewEnd = p;
      canvasEl?.setPointerCapture(e.pointerId);
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
    if (!markup.drawActive && !markup.highlightActive) return;
    // Handle drag takes priority
    if (dragHandle) {
      handleDragMove(e);
      return;
    }
    // Shape move drag
    if (isMovingShape && moveOrigin) {
      const p = toNormal(e.clientX, e.clientY);
      const dx = p.x - moveOrigin.x;
      const dy = p.y - moveOrigin.y;
      const idx = markup.selectedIndex;
      if (idx !== null) {
        markup.updateShape(idx, { cx: moveStartCx + dx, cy: moveStartCy + dy });
        redrawAll();
      }
      return;
    }

    // Highlight mode — handle separately
    if (markup.highlightActive && isPointerDown) {
      e.preventDefault();
      const p = toNormal(e.clientX, e.clientY);
      if (markup.highlightMode === "free") {
        markup.addHighlightPoint(p.x, p.y);
        redrawAll();
      } else if (highlightStraightStart) {
        highlightStraightPreview = p;
        redrawAll();
      }
      return;
    }

    // Hover detection when not dragging
    if (!isPointerDown) {
      const sel = markup.selectedIndex;
      if (sel !== null) {
        const stroke = markup.strokes[sel];
        if (stroke && stroke.type === "shape") {
          const p = toNormal(e.clientX, e.clientY);
          const rawPx = p.x * overlayRect.width;
          const rawPy = p.y * overlayRect.height;
          const hit = hitTestHandle(stroke, overlayRect.width, overlayRect.height, rawPx, rawPy);
          if (hit !== hoveredHandle) {
            hoveredHandle = hit;
            startHoverAnim(hit ? 1 : 0);
          }
          return;
        }
      }
      if (hoveredHandle !== null) {
        hoveredHandle = null;
        startHoverAnim(0);
      }
      return;
    }

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
    } else if (isShapeTool(tool) && shapeDragStart) {
      // Shape drag — update preview
      shapePreviewEnd = p;
      redrawAll();
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (dragHandle) {
      // Finalize handle drag
      dragHandle = null;
      dragOrigin = null;
      dragStartShape = null;
      isPointerDown = false;
      canvasEl?.releasePointerCapture(e.pointerId);
      return;
    }
    if (isMovingShape) {
      isMovingShape = false;
      moveOrigin = null;
      isPointerDown = false;
      canvasEl?.releasePointerCapture(e.pointerId);
      return;
    }

    // Highlight mode — finalize
    if (markup.highlightActive && isPointerDown) {
      isPointerDown = false;
      if (markup.highlightMode === "free") {
        markup.endHighlightStroke();
      } else if (highlightStraightStart && highlightStraightPreview) {
        const dx = Math.abs(highlightStraightPreview.x - highlightStraightStart.x);
        const dy = Math.abs(highlightStraightPreview.y - highlightStraightStart.y);
        if (dx > 0.002 || dy > 0.002) {
          markup.placeHighlightLine(
            highlightStraightStart.x,
            highlightStraightStart.y,
            highlightStraightPreview.x,
            highlightStraightPreview.y,
          );
        }
        highlightStraightStart = null;
        highlightStraightPreview = null;
      }
      redrawAll();
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
    } else if (isShapeTool(tool) && shapeDragStart) {
      // Finalize shape drag
      const end = shapePreviewEnd ?? shapeDragStart;
      const dx = Math.abs(end.x - shapeDragStart.x);
      const dy = Math.abs(end.y - shapeDragStart.y);
      const cx = (shapeDragStart.x + end.x) / 2;
      const cy = (shapeDragStart.y + end.y) / 2;
      // If drag was negligible, place default-sized shape; otherwise use drag bounds
      if (dx < 0.005 && dy < 0.005) {
        markup.placeShape(cx, cy);
      } else {
        markup.placeShapeSized(cx, cy, dx, dy);
      }
      shapeDragStart = null;
      shapePreviewEnd = null;
      redrawAll();
    }

    canvasEl?.releasePointerCapture(e.pointerId);
  }

  // Cursor is provided by markup.cursorStyle (avoids duplicating SVG URLs)
</script>

{#if (markup.drawActive || markup.highlightActive) && overlayRect.width > 0 && overlayRect.height > 0}
  <canvas
    bind:this={canvasEl}
    class="draw-overlay"
    tabindex="-1"
    style="position: absolute; left: {overlayRect.left}px; top: {overlayRect.top}px; width: {overlayRect.width}px; height: {overlayRect.height}px; cursor: {markup.cursorStyle}; z-index: 999;"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onpointerleave={() => { hoveredHandle = null; startHoverAnim(0); }}
    onkeydown={(e) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        markup.undoLastStroke();
        redrawAll();
      }
      if ((e.key === "Backspace" || e.key === "Delete") && markup.selectedIndex !== null) {
        e.preventDefault();
        markup.deleteSelectedShape();
        redrawAll();
      }
    }}
  ></canvas>
{/if}
