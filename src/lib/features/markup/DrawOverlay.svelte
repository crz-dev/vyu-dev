<script lang="ts">
  import {
    markup,
    type PlacedShape,
    type PlacedLine,
    type PlacedText,
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

  let lineStart = $state<{ x: number; y: number } | null>(null);
  let previewEnd = $state<{ x: number; y: number } | null>(null);

  let shapeDragStart = $state<{ x: number; y: number } | null>(null);
  let shapePreviewEnd = $state<{ x: number; y: number } | null>(null);

  let highlightStraightStart = $state<{ x: number; y: number } | null>(null);
  let highlightStraightPreview = $state<{ x: number; y: number } | null>(null);

  type HandleType =
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "topLeft"
    | "topRight"
    | "bottomLeft"
    | "bottomRight"
    | "rotate"
    | "delete";
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

  let isMovingShape = $state(false);
  let moveOrigin = $state<{ x: number; y: number } | null>(null);
  let moveStartCx = $state(0);
  let moveStartCy = $state(0);

  let textDragOrigin = $state<{ x: number; y: number } | null>(null);
  let textDragStartFontSize = $state(16);
  let textDragStartRotation = $state(0);
  let textDragStartBoxExtra = $state(0);
  let textDragStartX = $state(0);
  let textDragStartY = $state(0);

  let isTextMoving = $state(false);
  let textMoveStartPos = $state<{ x: number; y: number } | null>(null);
  let textMoveStartX = $state(0);
  let textMoveStartY = $state(0);

  let isSelectMoving = $state(false);
  let selectMoveOrigin = $state<{ x: number; y: number } | null>(null);
  let selectMoveStartData = $state<Record<string, number> | null>(null);

  let selectBoxStart = $state<{ x: number; y: number } | null>(null);
  let selectBoxEnd = $state<{ x: number; y: number } | null>(null);

  let textPlaceDragStart = $state<{ x: number; y: number } | null>(null);
  let textPlaceDragEnd = $state<{ x: number; y: number } | null>(null);

  const TEXT_PADDING = 6; // CSS px padding around text for hit area
  let hasTextStrokes = $derived(markup.strokes.some((s) => s.type === "text"));

  let editingTextIndex = $state<number | null>(null);
  let editingCaretVisible = $state(false);
  let editingCaretInterval: ReturnType<typeof setInterval> | null =
    $state(null);

  function startCaretBlink() {
    stopCaretBlink();
    editingCaretVisible = true;
    editingCaretInterval = setInterval(() => {
      editingCaretVisible = !editingCaretVisible;
      redrawAll();
    }, 530);
  }

  function stopCaretBlink() {
    if (editingCaretInterval !== null) {
      clearInterval(editingCaretInterval);
      editingCaretInterval = null;
    }
    editingCaretVisible = false;
  }

  function exitEditing() {
    if (editingTextIndex === null) return;
    const s = markup.strokes[editingTextIndex];
    if (s && s.type === "text" && s.text.length === 0) {
      markup.deleteSelectedShape();
    }
    editingTextIndex = null;
    stopCaretBlink();
  }

  // ── Helpers ──

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
      tool === "line" || tool === "arrow" || tool === "bidirectional-arrow"
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
    ctx.lineTo(x - size * Math.cos(angle - a), y - size * Math.sin(angle - a));
    ctx.lineTo(x - size * Math.cos(angle + a), y - size * Math.sin(angle + a));
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

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.rotation);
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.shape === "square") {
      ctx.beginPath();
      ctx.rect(-halfW, -halfH, s.width * w, s.height * h);
      ctx.stroke();
      if (s.fill) {
        ctx.fillStyle = s.color;
        ctx.fill();
      }
    } else if (s.shape === "circle") {
      ctx.beginPath();
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (s.fill) {
        ctx.fillStyle = s.color;
        ctx.fill();
      }
    } else if (s.shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
      ctx.stroke();
      if (s.fill) {
        ctx.fillStyle = s.color;
        ctx.fill();
      }
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
      if (l.lineType === "arrow" || l.lineType === "bidirectional-arrow") {
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
        const endAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
        if (l.lineType === "arrow" || l.lineType === "bidirectional-arrow") {
          drawArrowhead(ctx, last.x * w, last.y * h, endAngle, aSize);
        }
        if (l.lineType === "bidirectional-arrow") {
          const first = pts[0];
          const second = pts.length > 1 ? pts[1] : pts[0];
          const startAngle = Math.atan2(first.y - second.y, first.x - second.x);
          drawArrowhead(ctx, first.x * w, first.y * h, startAngle, aSize);
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

  function drawPlacedText(
    ctx: CanvasRenderingContext2D,
    t: PlacedText,
    w: number,
    h: number,
    isEditing = false,
    caretVisible = false,
  ) {
    const px = t.x * w;
    const py = t.y * h;
    const fontSize = t.fontSize;
    const fontWeight = t.bold ? "bold" : "normal";
    const fontStyle = t.italic ? "italic" : "normal";
    const fontStr = `${fontStyle} ${fontWeight} ${fontSize}px "${t.fontFamily}"`;
    ctx.font = fontStr;
    ctx.textBaseline = "middle";

    const align = t.align === "justify" ? "left" : t.align;
    ctx.textAlign = align;

    const text = t.text || "";
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const lineHeight = fontSize * 1.2;
    const pad = TEXT_PADDING * (fontSize / 16);
    const boxW = textWidth + pad * 2 + (t.boxExtraWidth || 0);
    const boxH = lineHeight + pad;

    const boxLeft = px - boxW / 2;
    const boxTop = py - boxH / 2;

    let drawX: number;
    if (align === "left") drawX = boxLeft + pad;
    else if (align === "right") drawX = boxLeft + boxW - pad;
    else drawX = px;

    const drawY = boxTop + pad;

    ctx.save();
    if (t.rotation !== 0) {
      ctx.translate(px, py);
      ctx.rotate(t.rotation);
      ctx.translate(-px, -py);
    }

    if (t.bgEnabled) {
      ctx.fillStyle = t.bgColor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(boxLeft, boxTop, boxW, boxH);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = t.color;
    ctx.fillText(text, drawX, drawY + lineHeight / 2);

    if (isEditing && caretVisible) {
      const caretX =
        align === "left"
          ? drawX + textWidth
          : align === "right"
            ? drawX
            : drawX + textWidth / 2;
      const caretY1 = drawY;
      const caretY2 = drawY + lineHeight;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, fontSize / 12);
      ctx.beginPath();
      ctx.moveTo(caretX, caretY1);
      ctx.lineTo(caretX, caretY2);
      ctx.stroke();
    }

    if (t.underline) {
      const underlineY = drawY + lineHeight / 2 + fontSize * 0.4;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, fontSize / 14);
      ctx.beginPath();
      const ulX =
        align === "left"
          ? drawX
          : align === "right"
            ? drawX - textWidth
            : drawX - textWidth / 2;
      ctx.moveTo(ulX, underlineY);
      ctx.lineTo(ulX + textWidth, underlineY);
      ctx.stroke();
    }

    if (t.strikethrough) {
      const strikeY = drawY + lineHeight / 2 + fontSize * 0.05;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, fontSize / 14);
      ctx.beginPath();
      const stX =
        align === "left"
          ? drawX
          : align === "right"
            ? drawX - textWidth
            : drawX - textWidth / 2;
      ctx.moveTo(stX, strikeY);
      ctx.lineTo(stX + textWidth, strikeY);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Estimate text width in CSS px (capped by char count × font size). */
  function estimateTextWidth(t: PlacedText, w: number, h: number): number {
    const fontSize = t.fontSize;
    const text = t.text || "";
    // Rough estimate: average char width ~0.6 * fontSize
    const estCharWidth = fontSize * 0.6;
    const computed = text.length * estCharWidth;
    return Math.max(computed, fontSize * 1.5); // minimum width for empty hit area
  }

  /** Get the bounding rect for a PlacedText in CSS px coords. Uses ctx for precision if available, falls back to estimate. */
  function getTextBbox(
    t: PlacedText,
    w: number,
    h: number,
    ctx?: CanvasRenderingContext2D,
  ): { left: number; right: number; top: number; bottom: number } {
    const fontSize = t.fontSize;
    let textWidth: number;
    if (ctx) {
      const fontWeight = t.bold ? "bold" : "normal";
      const fontStyle = t.italic ? "italic" : "normal";
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${t.fontFamily}"`;
      const text = t.text || "";
      textWidth = ctx.measureText(text).width;
    } else {
      textWidth = estimateTextWidth(t, w, h);
    }
    const pad = TEXT_PADDING * (fontSize / 16);
    const boxW = textWidth + pad * 2 + (t.boxExtraWidth || 0);
    const boxH = fontSize * 1.2 + pad;
    const left = t.x * w - boxW / 2;
    const top = t.y * h - boxH / 2;
    return { left, right: left + boxW, top, bottom: top + boxH };
  }

  function drawTextTransformHandles(
    ctx: CanvasRenderingContext2D,
    t: PlacedText,
    w: number,
    h: number,
  ) {
    const bbox = getTextBbox(t, w, h, ctx);
    const boxW = bbox.right - bbox.left;
    const boxH = bbox.bottom - bbox.top;
    const cx = bbox.left + boxW / 2;
    const cy = bbox.top + boxH / 2;

    ctx.save();
    if (t.rotation !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(t.rotation);
      ctx.translate(-cx, -cy);
    }

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(bbox.left, bbox.top, boxW, boxH);

    const tAnim = hoverScale;
    const cornerSize = 5 + tAnim * 2;
    const rotR = 5 + tAnim;
    const delR = 6 + tAnim;

    drawDiamond(ctx, bbox.left, bbox.top, cornerSize, "#ffffff", "#ffffff");
    drawDiamond(ctx, bbox.right, bbox.top, cornerSize, "#ffffff", "#ffffff");
    drawDiamond(ctx, bbox.left, bbox.bottom, cornerSize, "#ffffff", "#ffffff");
    drawDiamond(ctx, bbox.right, bbox.bottom, cornerSize, "#ffffff", "#ffffff");

    const rotGap = 16;
    const rotY = cy - boxH / 2 - rotGap;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, rotY, rotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const delX = bbox.right + 14;
    const delY = bbox.top - 14;
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(delX, delY, delR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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

  /** Compute text handle positions in CSS px. Requires a canvas context for measurement. */
  function getTextHandlePositions(
    t: PlacedText,
    w: number,
    h: number,
    ctx: CanvasRenderingContext2D,
  ) {
    const bbox = getTextBbox(t, w, h, ctx);
    const boxW = bbox.right - bbox.left;
    const boxH = bbox.bottom - bbox.top;
    const cx = bbox.left + boxW / 2;
    const cy = bbox.top + boxH / 2;
    const rotGap = 16;

    return {
      left: { x: bbox.left, y: cy },
      right: { x: bbox.right, y: cy },
      top: { x: cx, y: bbox.top },
      bottom: { x: cx, y: bbox.bottom },
      topLeft: { x: bbox.left, y: bbox.top },
      topRight: { x: bbox.right, y: bbox.top },
      bottomLeft: { x: bbox.left, y: bbox.bottom },
      bottomRight: { x: bbox.right, y: bbox.bottom },
      rotate: { x: cx, y: bbox.top - rotGap },
      delete: { x: bbox.right + 14, y: bbox.top - 14 },
    };
  }

  /** Returns which text handle is within HIT_RADIUS CSS px of (px, py), or null. */
  function hitTestTextHandle(
    t: PlacedText,
    w: number,
    h: number,
    px: number,
    py: number,
    ctx: CanvasRenderingContext2D,
  ): HandleType | null {
    const cx = t.x * w;
    const cy = t.y * h;
    // un-rotate to text space
    const cos = Math.cos(-t.rotation);
    const sin = Math.sin(-t.rotation);
    const dx = px - cx;
    const dy = py - cy;
    const localPx = cos * dx - sin * dy + cx;
    const localPy = sin * dx + cos * dy + cy;

    const handles = getTextHandlePositions(t, w, h, ctx);

    // corner/rotate/delete hits
    const pointKeys: HandleType[] = [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
      "rotate",
      "delete",
    ];
    for (const key of pointKeys) {
      const pos = handles[key];
      if (!pos) continue;
      const hx = localPx - pos.x;
      const hy = localPy - pos.y;
      if (Math.sqrt(hx * hx + hy * hy) <= HIT_RADIUS) return key;
    }

    // edge hits
    const bbox = getTextBbox(t, w, h, ctx);
    const left = bbox.left,
      right = bbox.right;
    const top = bbox.top,
      bottom = bbox.bottom;

    const edges: {
      type: HandleType;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[] = [
      { type: "top", x1: left, y1: top, x2: right, y2: top },
      { type: "bottom", x1: left, y1: bottom, x2: right, y2: bottom },
      { type: "left", x1: left, y1: top, x2: left, y2: bottom },
      { type: "right", x1: right, y1: top, x2: right, y2: bottom },
    ];

    for (const edge of edges) {
      const segDx = edge.x2 - edge.x1;
      const segDy = edge.y2 - edge.y1;
      const lenSq = segDx * segDx + segDy * segDy;
      if (lenSq === 0) continue;
      let tParam =
        ((localPx - edge.x1) * segDx + (localPy - edge.y1) * segDy) / lenSq;
      tParam = Math.max(0, Math.min(1, tParam));
      const projX = edge.x1 + tParam * segDx;
      const projY = edge.y1 + tParam * segDy;
      const dist = Math.sqrt((localPx - projX) ** 2 + (localPy - projY) ** 2);
      if (dist <= HIT_RADIUS) return edge.type;
    }

    return null;
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
    const endAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
    if (lineType === "arrow" || lineType === "bidirectional-arrow") {
      drawArrowhead(ctx, last.x * w, last.y * h, endAngle, aSize);
    }
    if (lineType === "bidirectional-arrow") {
      const first = pts[0];
      const second = pts.length > 1 ? pts[1] : pts[0];
      const startAngle = Math.atan2(first.y - second.y, first.x - second.x);
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
    if (activeTool === "arrow" || activeTool === "bidirectional-arrow") {
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

    if (tool === "square") {
      ctx.beginPath();
      ctx.rect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
      ctx.stroke();
      if (markup.fillShapes) {
        ctx.fillStyle = markup.drawColor;
        ctx.fill();
      }
    } else if (tool === "circle") {
      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW, halfH, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (markup.fillShapes) {
        ctx.fillStyle = markup.drawColor;
        ctx.fill();
      }
    } else if (tool === "triangle") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfH);
      ctx.lineTo(cx + halfW, cy + halfH);
      ctx.lineTo(cx - halfW, cy + halfH);
      ctx.closePath();
      ctx.stroke();
      if (markup.fillShapes) {
        ctx.fillStyle = markup.drawColor;
        ctx.fill();
      }
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
    const rotGap = 16;

    // All shapes use the same bounding-box handle positions
    return {
      left: { x: cx - hw, y: cy },
      right: { x: cx + hw, y: cy },
      top: { x: cx, y: cy - hh },
      bottom: { x: cx, y: cy + hh },
      topLeft: { x: cx - hw, y: cy - hh },
      topRight: { x: cx + hw, y: cy - hh },
      bottomLeft: { x: cx - hw, y: cy + hh },
      bottomRight: { x: cx + hw, y: cy + hh },
      rotate: { x: cx, y: cy - hh - rotGap },
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

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

    const t = hoverScale;
    const cornerSize = 5 + t * 2;

    drawDiamond(ctx, -hw, -hh, cornerSize, "#ffffff", "#ffffff");
    drawDiamond(ctx, hw, -hh, cornerSize, "#ffffff", "#ffffff");
    drawDiamond(ctx, -hw, hh, cornerSize, "#ffffff", "#ffffff");
    drawDiamond(ctx, hw, hh, cornerSize, "#ffffff", "#ffffff");

    const rotGap = 16;
    const rotY = -hh - rotGap;
    const rotR = 5 + t;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, rotY, rotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const delX = hw + 14;
    const delY = -hh - 14;
    const delR = 6 + t;
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(delX, delY, delR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
    // un-rotate to shape space
    const cos = Math.cos(-s.rotation);
    const sin = Math.sin(-s.rotation);
    const dx = px - cx;
    const dy = py - cy;
    const localPx = cos * dx - sin * dy + cx;
    const localPy = sin * dx + cos * dy + cy;

    const handles = getHandlePositions(s, w, h);

    // corner/rotate/delete hits
    const pointKeys: HandleType[] = [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
      "rotate",
      "delete",
    ];
    for (const key of pointKeys) {
      const pos = handles[key];
      if (!pos) continue;
      const hx = localPx - pos.x;
      const hy = localPy - pos.y;
      if (Math.sqrt(hx * hx + hy * hy) <= HIT_RADIUS) return key;
    }

    // edge hits
    const hw = (s.width * w) / 2;
    const hh = (s.height * h) / 2;
    const left = cx - hw,
      right = cx + hw;
    const top = cy - hh,
      bottom = cy + hh;

    const edges: {
      type: HandleType;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[] = [
      { type: "top", x1: left, y1: top, x2: right, y2: top },
      { type: "bottom", x1: left, y1: bottom, x2: right, y2: bottom },
      { type: "left", x1: left, y1: top, x2: left, y2: bottom },
      { type: "right", x1: right, y1: top, x2: right, y2: bottom },
    ];

    for (const edge of edges) {
      const segDx = edge.x2 - edge.x1;
      const segDy = edge.y2 - edge.y1;
      const lenSq = segDx * segDx + segDy * segDy;
      if (lenSq === 0) continue;
      let tParam =
        ((localPx - edge.x1) * segDx + (localPy - edge.y1) * segDy) / lenSq;
      tParam = Math.max(0, Math.min(1, tParam));
      const projX = edge.x1 + tParam * segDx;
      const projY = edge.y1 + tParam * segDy;
      const dist = Math.sqrt((localPx - projX) ** 2 + (localPy - projY) ** 2);
      if (dist <= HIT_RADIUS) return edge.type;
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
      localX >= -halfW && localX <= halfW && localY >= -halfH && localY <= halfH
    );
  }

  // Overlay geometry

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
    markup.displayWidth = mr.width;
    markup.displayHeight = mr.height;
  }

  // Rendering

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

    if (markup.strokesHidden) return;

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
      } else if (stroke.type === "text") {
        const isEditing =
          editingTextIndex !== null &&
          markup.strokes[editingTextIndex] === stroke;
        drawPlacedText(
          ctx,
          stroke,
          w,
          h,
          isEditing,
          isEditing && editingCaretVisible,
        );
      }
    }

    const cur = markup.currentStroke;
    if (cur) {
      drawFreehand(ctx, cur, w, h);
      // If in path mode with a line tool, overlay arrowhead preview
      if (markup.pathMode && isLineTool(markup.activeTool)) {
        drawCurrentStrokePathPreview(ctx, cur, w, h, markup.activeTool);
      }
    }

    // Draw in-progress highlight freehand stroke
    const curHL = markup.currentHighlight;
    if (curHL && curHL.mode === "free") {
      drawHighlightFreehand(ctx, curHL, w, h);
    }

    // preview during drag
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

    if (textPlaceDragStart && textPlaceDragEnd) {
      const x1 = textPlaceDragStart.x * w;
      const y1 = textPlaceDragStart.y * h;
      const x2 = textPlaceDragEnd.x * w;
      const y2 = textPlaceDragEnd.y * h;
      const pw = Math.abs(x2 - x1);
      const ph = Math.abs(y2 - y1);
      if (pw > 2 || ph > 2) {
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), pw, ph);
        ctx.restore();
      }
    }

    if (selectBoxStart && selectBoxEnd) {
      const x1 = selectBoxStart.x * w;
      const y1 = selectBoxStart.y * h;
      const x2 = selectBoxEnd.x * w;
      const y2 = selectBoxEnd.y * h;
      const bw = Math.abs(x2 - x1);
      const bh = Math.abs(y2 - y1);
      if (bw > 2 || bh > 2) {
        ctx.save();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), bw, bh);
        ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), bw, bh);
        ctx.restore();
      }
    }

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

    for (const selIdx of markup.selectedIndices) {
      const stroke = markup.strokes[selIdx];
      if (stroke && stroke.type === "shape") {
        drawTransformHandles(ctx, stroke, w, h);
      } else if (stroke && stroke.type === "text") {
        drawTextTransformHandles(ctx, stroke, w, h);
      }
    }

    ctx.globalAlpha = 1;
  }

  // Lifecycle

  $effect(() => {
    if (
      (markup.drawActive ||
        markup.highlightActive ||
        markup.textActive ||
        markup.selectActive ||
        markup.removeActive ||
        markup.strokes.length > 0) &&
      mediaEl &&
      containerEl
    ) {
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
      lineStart = null;
      previewEnd = null;
      shapeDragStart = null;
      shapePreviewEnd = null;
      isMovingShape = false;
      moveOrigin = null;
      highlightStraightStart = null;
      highlightStraightPreview = null;
      textPlaceDragStart = null;
      textPlaceDragEnd = null;
      isSelectMoving = false;
      selectMoveOrigin = null;
      selectMoveStartData = null;
      selectBoxStart = null;
      selectBoxEnd = null;
    }
  });

  $effect(() => {
    const _strokes = markup.strokes;
    const _current = markup.currentStroke;
    const _tool = markup.activeTool;
    const _path = markup.pathMode;
    const _hlActive = markup.highlightActive;
    const _hlCur = markup.currentHighlight;
    const _hasTextStrokes = hasTextStrokes;
    const _selectActive = markup.selectActive;
    const _removeActive = markup.removeActive;
    const _strokesHidden = markup.strokesHidden;
    redrawAll();
  });

  $effect(() => {
    if (!markup.textActive) {
      exitEditing();
    }
  });

  $effect(() => {
    if (
      (markup.drawActive ||
        markup.highlightActive ||
        markup.textActive ||
        markup.selectActive ||
        markup.removeActive ||
        markup.strokes.length > 0) &&
      canvasEl
    ) {
      canvasEl.focus();
    }
    return () => {
      stopCaretBlink();
    };
  });

  // Coords

  function toNormal(clientX: number, clientY: number) {
    if (overlayRect.width <= 0 || overlayRect.height <= 0)
      return { x: 0, y: 0 };
    const canvas = canvasEl;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  }

  // Transform handle drag

  function handleDragMove(e: PointerEvent) {
    if (!dragHandle || !canvasEl) return;
    e.preventDefault();
    const p = toNormal(e.clientX, e.clientY);
    const sel = markup.selectedIndex;
    if (sel === null) return;
    const stroke = markup.strokes[sel];
    if (!stroke) return;

    const dx = p.x - (dragOrigin?.x ?? 0);
    const dy = p.y - (dragOrigin?.y ?? 0);

    if (stroke.type === "shape") {
      if (!dragStartShape) return;
      const update: Partial<PlacedShape> = {};

      // un-rotate delta
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
          // BR fixed
          const newW = Math.max(0.01, dragStartShape.width - ldx);
          const newH = Math.max(0.01, dragStartShape.height - ldy);
          update.width = newW;
          update.height = newH;
          update.cx = dragStartShape.cx + ldx / 2;
          update.cy = dragStartShape.cy + ldy / 2;
          break;
        }
        case "topRight": {
          // BL fixed
          const newW = Math.max(0.01, dragStartShape.width + ldx);
          const newH = Math.max(0.01, dragStartShape.height - ldy);
          update.width = newW;
          update.height = newH;
          update.cx = dragStartShape.cx + ldx / 2;
          update.cy = dragStartShape.cy + ldy / 2;
          break;
        }
        case "bottomLeft": {
          // TR fixed
          const newW = Math.max(0.01, dragStartShape.width - ldx);
          const newH = Math.max(0.01, dragStartShape.height + ldy);
          update.width = newW;
          update.height = newH;
          update.cx = dragStartShape.cx + ldx / 2;
          update.cy = dragStartShape.cy + ldy / 2;
          break;
        }
        case "bottomRight": {
          // TL fixed
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
          update.rotation =
            dragStartShape.rotation + (currentAngle - startAngle);
          break;
        }
      }
      if (Object.keys(update).length > 0) {
        markup.updateShape(sel, update);
      }
    } else if (stroke.type === "text") {
      if (!textDragOrigin) return;
      const update: Partial<PlacedText> = {};

      switch (dragHandle) {
        case "left":
        case "right": {
          // Left/right diamonds change box width
          const delta = dx * 60; // horizontal drag sensitivity
          const dir = dragHandle === "left" ? -1 : 1;
          const newExtra = Math.max(
            0,
            Math.round(textDragStartBoxExtra + delta * dir),
          );
          update.boxExtraWidth = newExtra;
          break;
        }
        case "top":
        case "bottom": {
          // Top/bottom diamonds change font size
          const delta = dy * 40; // vertical drag sensitivity
          const dir = dragHandle === "top" ? -1 : 1;
          const newSize = Math.max(
            6,
            Math.min(200, Math.round(textDragStartFontSize + delta * dir)),
          );
          update.fontSize = newSize;
          markup.textFontSize = newSize;
          break;
        }
        case "topLeft":
        case "topRight":
        case "bottomLeft":
        case "bottomRight": {
          // Corner diamonds change both boxExtraWidth and fontSize
          // Use un-rotated delta (matches shape corner behavior)
          const cos = Math.cos(-stroke.rotation);
          const sin = Math.sin(-stroke.rotation);
          const ldx = cos * dx - sin * dy;
          const ldy = sin * dx + cos * dy;

          const isLeft =
            dragHandle === "topLeft" || dragHandle === "bottomLeft";
          const isTop = dragHandle === "topLeft" || dragHandle === "topRight";

          const newExtra = Math.max(
            0,
            Math.round(textDragStartBoxExtra + ldx * 60 * (isLeft ? -1 : 1)),
          );
          update.boxExtraWidth = newExtra;

          const newSize = Math.max(
            6,
            Math.min(
              200,
              Math.round(textDragStartFontSize + ldy * 40 * (isTop ? -1 : 1)),
            ),
          );
          update.fontSize = newSize;
          markup.textFontSize = newSize;
          break;
        }
        case "rotate": {
          const ocx = stroke.x;
          const ocy = stroke.y;
          const currentAngle = Math.atan2(p.y - ocy, p.x - ocx);
          const startAngle = Math.atan2(
            (textDragOrigin?.y ?? 0) - ocy,
            (textDragOrigin?.x ?? 0) - ocx,
          );
          update.rotation = textDragStartRotation + (currentAngle - startAngle);
          break;
        }
      }
      if (Object.keys(update).length > 0) {
        markup.updateText(sel, update);
      }
    }
    redrawAll();
  }

  /** Find the topmost text box under the given normalized point, or null. */
  function findTextAtPoint(nx: number, ny: number): number | null {
    const strokesArr = markup.strokes;
    // Get a temporary context for measurement
    const canvas = canvasEl;
    const tempCtx = canvas?.getContext("2d") ?? undefined;
    for (let i = strokesArr.length - 1; i >= 0; i--) {
      const s = strokesArr[i];
      if (s.type === "text") {
        const bbox = getTextBbox(
          s,
          overlayRect.width,
          overlayRect.height,
          tempCtx,
        );
        const cssX = nx * overlayRect.width;
        const cssY = ny * overlayRect.height;
        if (
          cssX >= bbox.left &&
          cssX <= bbox.right &&
          cssY >= bbox.top &&
          cssY <= bbox.bottom
        ) {
          return i;
        }
      }
    }
    return null;
  }

  // Pointer handlers

  function handlePointerDown(e: PointerEvent) {
    if (
      !markup.drawActive &&
      !markup.highlightActive &&
      !markup.textActive &&
      !markup.selectActive &&
      !markup.removeActive
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    const p = toNormal(e.clientX, e.clientY);

    // eraser mode
    if (markup.removeActive) {
      const w = overlayRect.width;
      const h = overlayRect.height;
      markup.deleteStrokeAt(p.x, p.y, w, h);
      canvasEl?.setPointerCapture(e.pointerId);
      redrawAll();
      return;
    }

    // select mode
    if (markup.selectActive) {
      const w = overlayRect.width;
      const h = overlayRect.height;
      const rawPx = p.x * w;
      const rawPy = p.y * h;

      // 1. handle hit
      const sel = markup.selectedIndex;
      if (sel !== null) {
        const stroke = markup.strokes[sel];
        if (stroke && stroke.type === "shape") {
          const hit = hitTestHandle(stroke, w, h, rawPx, rawPy);
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
            return;
          }
          // body click → move
          if (isInsideShapeBounds(stroke, p.x, p.y)) {
            isSelectMoving = true;
            selectMoveOrigin = p;
            selectMoveStartData = {};
            canvasEl?.setPointerCapture(e.pointerId);
            return;
          }
        } else if (stroke && stroke.type === "text" && canvasEl) {
          const ctx = canvasEl.getContext("2d");
          if (ctx) {
            const hit = hitTestTextHandle(stroke, w, h, rawPx, rawPy, ctx);
            if (hit === "delete") {
              markup.deleteSelectedShape();
              redrawAll();
              return;
            }
            if (hit === "left" || hit === "right") {
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartBoxExtra = stroke.boxExtraWidth;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            if (hit === "top" || hit === "bottom") {
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartFontSize = stroke.fontSize;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            if (
              hit === "topLeft" ||
              hit === "topRight" ||
              hit === "bottomLeft" ||
              hit === "bottomRight"
            ) {
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartBoxExtra = stroke.boxExtraWidth;
              textDragStartFontSize = stroke.fontSize;
              textDragStartRotation = stroke.rotation;
              textDragStartX = stroke.x;
              textDragStartY = stroke.y;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            if (hit === "rotate") {
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartRotation = stroke.rotation;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            // text body → move
            const bbox = getTextBbox(stroke, w, h, ctx);
            if (
              rawPx >= bbox.left &&
              rawPx <= bbox.right &&
              rawPy >= bbox.top &&
              rawPy <= bbox.bottom
            ) {
              isSelectMoving = true;
              selectMoveOrigin = p;
              selectMoveStartData = {};
              canvasEl?.setPointerCapture(e.pointerId);
              redrawAll();
              return;
            }
          }
        }
      }

      // 2. stroke click
      const hitIdx = markup.findStrokeAt(p.x, p.y, w, h);
      if (hitIdx !== null) {
        // multi-select: keep selection, move all
        if (!markup.selectedIndices.includes(hitIdx)) {
          markup.selectShape(hitIdx);
        }
        isSelectMoving = true;
        selectMoveOrigin = p;
        selectMoveStartData = {};
        canvasEl?.setPointerCapture(e.pointerId);
        redrawAll();
        return;
      }

      // 3. empty click → selection box
      markup.selectShape(null);
      selectBoxStart = p;
      selectBoxEnd = p;
      canvasEl?.setPointerCapture(e.pointerId);
      redrawAll();
      return;
    }

    // highlight mode
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

    // text mode
    if (markup.textActive) {
      isPointerDown = false;

      // 1. text handle hit
      const selText = markup.selectedIndex;
      if (selText !== null) {
        const selStroke = markup.strokes[selText];
        if (selStroke && selStroke.type === "text" && canvasEl) {
          const ctx = canvasEl.getContext("2d");
          if (ctx) {
            const rawPx = p.x * overlayRect.width;
            const rawPy = p.y * overlayRect.height;
            const hit = hitTestTextHandle(
              selStroke,
              overlayRect.width,
              overlayRect.height,
              rawPx,
              rawPy,
              ctx,
            );
            if (hit === "delete") {
              markup.deleteSelectedShape();
              redrawAll();
              return;
            }
            if (hit === "left" || hit === "right") {
              // Left/right diamonds change box width
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartBoxExtra = selStroke.boxExtraWidth;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            if (hit === "top" || hit === "bottom") {
              // Top/bottom diamonds change font size
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartFontSize = selStroke.fontSize;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            if (
              hit === "topLeft" ||
              hit === "topRight" ||
              hit === "bottomLeft" ||
              hit === "bottomRight"
            ) {
              // Corner diamonds change both boxExtraWidth and fontSize
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartBoxExtra = selStroke.boxExtraWidth;
              textDragStartFontSize = selStroke.fontSize;
              textDragStartRotation = selStroke.rotation;
              textDragStartX = selStroke.x;
              textDragStartY = selStroke.y;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
            if (hit === "rotate") {
              dragHandle = hit;
              dragOrigin = p;
              textDragOrigin = p;
              textDragStartRotation = selStroke.rotation;
              canvasEl?.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
      }

      // 2. text body → move
      const hitIdx = findTextAtPoint(p.x, p.y);
      if (hitIdx !== null) {
        if (editingTextIndex !== null && editingTextIndex !== hitIdx) {
          exitEditing();
        }
        markup.selectShape(hitIdx);
        editingTextIndex = hitIdx;
        isPointerDown = true;
        isTextMoving = true;
        textMoveStartPos = p;
        const t = markup.strokes[hitIdx];
        if (t && t.type === "text") {
          textMoveStartX = t.x;
          textMoveStartY = t.y;
        }
        canvasEl?.setPointerCapture(e.pointerId);
        canvasEl?.focus();
        redrawAll();
        return;
      }

      // 3. outside → place
      if (editingTextIndex !== null) exitEditing();
      markup.selectShape(null);
      textPlaceDragStart = p;
      textPlaceDragEnd = p;
      isPointerDown = true;
      canvasEl?.setPointerCapture(e.pointerId);
      canvasEl?.focus();
      return;
    }

    const tool = markup.activeTool;
    const rawPx = p.x * overlayRect.width;
    const rawPy = p.y * overlayRect.height;

    // handle hit first
    const sel = markup.selectedIndex;
    if (sel !== null) {
      const stroke = markup.strokes[sel];
      if (stroke && stroke.type === "shape") {
        const hit = hitTestHandle(
          stroke,
          overlayRect.width,
          overlayRect.height,
          rawPx,
          rawPy,
        );
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
          return;
        }
        if (isInsideShapeBounds(stroke, p.x, p.y)) {
          isMovingShape = true;
          moveOrigin = p;
          moveStartCx = stroke.cx;
          moveStartCy = stroke.cy;
          canvasEl?.setPointerCapture(e.pointerId);
          return;
        }
        markup.selectShape(null);
      } else if (stroke && stroke.type === "text" && canvasEl) {
        const ctx = canvasEl.getContext("2d");
        if (ctx) {
          const hit = hitTestTextHandle(
            stroke,
            overlayRect.width,
            overlayRect.height,
            rawPx,
            rawPy,
            ctx,
          );
          if (hit === "delete") {
            markup.deleteSelectedShape();
            redrawAll();
            return;
          }
          if (hit === "left" || hit === "right") {
            dragHandle = hit;
            dragOrigin = p;
            textDragOrigin = p;
            textDragStartBoxExtra = stroke.boxExtraWidth;
            canvasEl?.setPointerCapture(e.pointerId);
            return;
          }
          if (hit === "top" || hit === "bottom") {
            dragHandle = hit;
            dragOrigin = p;
            textDragOrigin = p;
            textDragStartFontSize = stroke.fontSize;
            canvasEl?.setPointerCapture(e.pointerId);
            return;
          }
          if (
            hit === "topLeft" ||
            hit === "topRight" ||
            hit === "bottomLeft" ||
            hit === "bottomRight"
          ) {
            dragHandle = hit;
            dragOrigin = p;
            textDragOrigin = p;
            textDragStartBoxExtra = stroke.boxExtraWidth;
            textDragStartFontSize = stroke.fontSize;
            textDragStartRotation = stroke.rotation;
            textDragStartX = stroke.x;
            textDragStartY = stroke.y;
            canvasEl?.setPointerCapture(e.pointerId);
            return;
          }
          if (hit === "rotate") {
            dragHandle = hit;
            dragOrigin = p;
            textDragOrigin = p;
            textDragStartRotation = stroke.rotation;
            canvasEl?.setPointerCapture(e.pointerId);
            return;
          }
        }
      }
    }

    if (isShapeTool(tool)) {
      const hitIdx = findShapeAtPoint(p.x, p.y);
      if (hitIdx !== null) {
        markup.selectShape(hitIdx);
        canvasEl?.setPointerCapture(e.pointerId);
        redrawAll();
        return;
      }
      // shape drag
      shapeDragStart = p;
      shapePreviewEnd = p;
      canvasEl?.setPointerCapture(e.pointerId);
    } else if (isLineTool(tool) && !markup.pathMode) {
      // non-path line drag
      lineStart = p;
      previewEnd = p;
      canvasEl?.setPointerCapture(e.pointerId);
    } else {
      // freehand stroke
      markup.startStroke(p.x, p.y);
      canvasEl?.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (
      !markup.drawActive &&
      !markup.highlightActive &&
      !markup.textActive &&
      !markup.selectActive &&
      !markup.removeActive
    )
      return;

    if (markup.removeActive && isPointerDown) {
      e.preventDefault();
      const p = toNormal(e.clientX, e.clientY);
      const w = overlayRect.width;
      const h = overlayRect.height;
      markup.deleteStrokeAt(p.x, p.y, w, h);
      redrawAll();
      return;
    }

    // handle drag first
    if (dragHandle) {
      handleDragMove(e);
      return;
    }

    if (markup.selectActive && isSelectMoving && selectMoveOrigin) {
      e.preventDefault();
      const p = toNormal(e.clientX, e.clientY);
      const dx = p.x - selectMoveOrigin.x;
      const dy = p.y - selectMoveOrigin.y;
      markup.moveSelectedStrokesBy(dx, dy);
      selectMoveOrigin = p;
      redrawAll();
      return;
    }

    // Select mode — selection box preview
    if (markup.selectActive && selectBoxStart) {
      e.preventDefault();
      selectBoxEnd = toNormal(e.clientX, e.clientY);
      redrawAll();
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

    // Text move drag
    if (isTextMoving && textMoveStartPos) {
      e.preventDefault();
      const p = toNormal(e.clientX, e.clientY);
      const dx = p.x - textMoveStartPos.x;
      const dy = p.y - textMoveStartPos.y;
      const idx = markup.selectedIndex;
      if (idx !== null) {
        markup.updateText(idx, {
          x: textMoveStartX + dx,
          y: textMoveStartY + dy,
        });
        // Hide caret on first movement
        if (editingTextIndex !== null) {
          stopCaretBlink();
        }
        redrawAll();
      }
      return;
    }

    // Text drag-to-place preview
    if (textPlaceDragStart) {
      e.preventDefault();
      const p = toNormal(e.clientX, e.clientY);
      textPlaceDragEnd = p;
      redrawAll();
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
        const p = toNormal(e.clientX, e.clientY);
        const rawPx = p.x * overlayRect.width;
        const rawPy = p.y * overlayRect.height;
        let hit: HandleType | null = null;
        if (stroke && stroke.type === "shape") {
          hit = hitTestHandle(
            stroke,
            overlayRect.width,
            overlayRect.height,
            rawPx,
            rawPy,
          );
        } else if (stroke && stroke.type === "text" && canvasEl) {
          const ctx = canvasEl.getContext("2d");
          if (ctx) {
            hit = hitTestTextHandle(
              stroke,
              overlayRect.width,
              overlayRect.height,
              rawPx,
              rawPy,
              ctx,
            );
          }
        }
        if (hit !== hoveredHandle) {
          hoveredHandle = hit;
          startHoverAnim(hit ? 1 : 0);
        }
        return;
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
    // Remove mode — release capture
    if (markup.removeActive && isPointerDown) {
      isPointerDown = false;
      canvasEl?.releasePointerCapture(e.pointerId);
      return;
    }

    // Select mode — finalize move
    if (markup.selectActive && isSelectMoving) {
      isSelectMoving = false;
      selectMoveOrigin = null;
      selectMoveStartData = null;
      isPointerDown = false;
      canvasEl?.releasePointerCapture(e.pointerId);
      return;
    }

    // Select mode — finalize selection box
    if (markup.selectActive && selectBoxStart) {
      const end = selectBoxEnd ?? selectBoxStart;
      const dragDx = Math.abs(end.x - selectBoxStart.x);
      const dragDy = Math.abs(end.y - selectBoxStart.y);
      if (dragDx > 0.005 || dragDy > 0.005) {
        const w = overlayRect.width;
        const h = overlayRect.height;
        const hits = markup.findStrokesInRect(
          selectBoxStart.x,
          selectBoxStart.y,
          end.x,
          end.y,
          w,
          h,
        );
        if (hits.length > 0) {
          markup.selectShapes(hits);
        }
      }
      selectBoxStart = null;
      selectBoxEnd = null;
      isPointerDown = false;
      canvasEl?.releasePointerCapture(e.pointerId);
      redrawAll();
      return;
    }

    if (markup.textActive) {
      if (dragHandle) {
        // Finalize text handle drag
        dragHandle = null;
        dragOrigin = null;
        textDragOrigin = null;
        dragStartShape = null;
        isPointerDown = false;
        canvasEl?.releasePointerCapture(e.pointerId);
        return;
      }
      if (isTextMoving) {
        const stroke = markup.strokes[markup.selectedIndex ?? -1];
        if (stroke && stroke.type === "text") {
          const moved =
            Math.abs(stroke.x - textMoveStartX) > 0.001 ||
            Math.abs(stroke.y - textMoveStartY) > 0.001;
          if (moved) {
            // Drag — text was already moved, just clean up
            stopCaretBlink();
          } else {
            // No drag — enter editing mode
            startCaretBlink();
          }
        }
        isTextMoving = false;
        textMoveStartPos = null;
        isPointerDown = false;
        canvasEl?.releasePointerCapture(e.pointerId);
        redrawAll();
        return;
      }
      // Finalize text drag-to-place
      if (textPlaceDragStart) {
        const end = textPlaceDragEnd ?? textPlaceDragStart;
        const dragDx = Math.abs(end.x - textPlaceDragStart.x);
        const dragDy = Math.abs(end.y - textPlaceDragStart.y);
        if (dragDx < 0.005 && dragDy < 0.005) {
          // Click — place default text
          markup.placeText(textPlaceDragStart.x, textPlaceDragStart.y);
          editingTextIndex = markup.strokes.length - 1;
          startCaretBlink();
        } else {
          // Drag — compute fontSize from height, boxExtraWidth from width
          const cx = (textPlaceDragStart.x + end.x) / 2;
          const cy = (textPlaceDragStart.y + end.y) / 2;
          const dragW = dragDx * overlayRect.width;
          const dragH = dragDy * overlayRect.height;
          const fontSize = Math.max(
            6,
            Math.min(200, Math.round(dragH / 1.575)),
          );
          const pad = TEXT_PADDING * (fontSize / 16);
          const boxExtraWidth = Math.max(0, Math.round(dragW - pad * 2));
          markup.placeTextSized(cx, cy, fontSize, boxExtraWidth);
        }
        textPlaceDragStart = null;
        textPlaceDragEnd = null;
        isPointerDown = false;
        canvasEl?.releasePointerCapture(e.pointerId);
        redrawAll();
        return;
      }
      isPointerDown = false;
      return;
    }
    if (dragHandle) {
      // Finalize handle drag
      dragHandle = null;
      dragOrigin = null;
      textDragOrigin = null;
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
        const dx = Math.abs(
          highlightStraightPreview.x - highlightStraightStart.x,
        );
        const dy = Math.abs(
          highlightStraightPreview.y - highlightStraightStart.y,
        );
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

{#if (markup.drawActive || markup.highlightActive || markup.textActive || markup.selectActive || markup.removeActive || markup.strokes.length > 0) && overlayRect.width > 0 && overlayRect.height > 0}
  <canvas
    bind:this={canvasEl}
    class="draw-overlay"
    tabindex="-1"
    style="position: absolute; left: {overlayRect.left}px; top: {overlayRect.top}px; width: {overlayRect.width}px; height: {overlayRect.height}px; cursor: {markup.cursorStyle}; z-index: 999; overflow: hidden;"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onpointerleave={() => {
      hoveredHandle = null;
      startHoverAnim(0);
    }}
    onkeydown={(e) => {
      // Inline text editing — capture keyboard into the text box
      if (editingTextIndex !== null) {
        e.stopPropagation();
        const s = markup.strokes[editingTextIndex];
        if (s && s.type === "text") {
          if (e.key === "Escape") {
            e.preventDefault();
            exitEditing();
            redrawAll();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            exitEditing();
            redrawAll();
            return;
          }
          if (e.key === "Backspace") {
            e.preventDefault();
            const nextText = s.text.slice(0, -1);
            if (nextText.length === 0) {
              markup.deleteSelectedShape();
              editingTextIndex = null;
              markup.selectShape(null);
            } else {
              markup.updateText(editingTextIndex, { text: nextText });
            }
            redrawAll();
            return;
          }
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            markup.updateText(editingTextIndex, { text: s.text + e.key });
            redrawAll();
            return;
          }
          if (e.ctrlKey && e.key === "v") {
            e.preventDefault();
            const idx = editingTextIndex;
            navigator.clipboard.readText().then((txt) => {
              markup.updateText(idx, { text: s.text + txt });
              redrawAll();
            });
            return;
          }
        }
        return;
      }

      // Non-editing keyboard shortcuts
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        markup.undoLastStroke();
        redrawAll();
        return;
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        markup.selectedIndex !== null
      ) {
        e.preventDefault();
        markup.deleteSelectedShape();
        redrawAll();
        return;
      }
    }}
  ></canvas>
{/if}
