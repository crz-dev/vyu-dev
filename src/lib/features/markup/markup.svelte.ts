/** Draw colors — hex values matching CD_COLORS plus black as default. */
export const DRAW_COLORS = [
  "#000000", // Black (default)
  "#f87171", // Red
  "#f97316", // Orange
  "#f5c518", // Yellow
  "#4ade80", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#888888", // Gray
  "#ffffff", // White
];

/** Highlighter colors — bright, saturated tones typical of marker pens. */
export const HIGHLIGHT_COLORS = [
  "#f5c518", // Yellow (default)
  "#4ade80", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#f97316", // Orange
  "#a855f7", // Purple
  "#f87171", // Red
];

import {
  loadMarkupCustomColors,
  saveMarkupCustomColors,
  loadHighlightCustomColors,
  saveHighlightCustomColors,
  loadTextCustomColors,
  saveTextCustomColors,
} from "$lib/services/storage";
import { showToast } from "$lib/features/toast/toast.svelte";

export interface DrawPoint {
  x: number;
  y: number;
}

export interface FreehandStroke {
  type: "freehand";
  points: DrawPoint[];
  color: string;
  thickness: number;
  opacity: number;
}

/** Alias kept for backward compat — tools.ts imports DrawStroke. */
export type DrawStroke = FreehandStroke;

export type ShapeKind = "square" | "circle" | "triangle";
export type LineKind = "line" | "arrow" | "bidirectional-arrow";
export type MarkupTool = "freehand" | ShapeKind | LineKind;

export interface PlacedShape {
  type: "shape";
  shape: ShapeKind;
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
  cornerRadius: number;
  color: string;
  thickness: number;
  opacity: number;
}

export interface PlacedLine {
  type: "line";
  lineType: LineKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isPath: boolean;
  points: DrawPoint[];
  color: string;
  thickness: number;
  opacity: number;
}

export interface HighlightFreehand {
  type: "highlight";
  mode: "free";
  points: DrawPoint[];
  color: string;
  thickness: number;
  opacity: number;
}

export interface HighlightStraight {
  type: "highlight";
  mode: "straight";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  thickness: number;
  opacity: number;
}

export interface PlacedText {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  rotation: number;
  boxExtraWidth: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  align: "left" | "center" | "right" | "justify";
  bgColor: string;
  bgEnabled: boolean;
}

export type HighlightStroke = HighlightFreehand | HighlightStraight;
export type MarkupStroke =
  | FreehandStroke
  | PlacedShape
  | PlacedLine
  | HighlightStroke
  | PlacedText;

function createMarkupStore() {
  let drawActive = $state(false);
  let drawColor = $state("#000000");
  let drawThickness = $state(3);
  let drawOpacity = $state(1);
  let strokes = $state<MarkupStroke[]>([]);
  let currentStroke = $state<FreehandStroke | null>(null);
  let customColors = $state<string[]>(loadMarkupCustomColors());

  // Shape tools state
  let activeTool = $state<MarkupTool>("freehand");
  let roundedCorner = $state(false);
  let pathMode = $state(false);

  // Selection state
  let selectedIndex = $state<number | null>(null);
  let selectedIndices = $state<number[]>([]);

  // Highlight state
  let highlightActive = $state(false);
  let highlightColor = $state("#f5c518");
  let highlightThickness = $state(20);
  let highlightOpacity = $state(0.4);
  let highlightMode = $state<"free" | "straight">("free");
  let highlightCustomColors = $state<string[]>(loadHighlightCustomColors());
  let currentHighlight = $state<HighlightFreehand | null>(null);

  // Text state
  let textActive = $state(false);
  let textColor = $state("#000000");
  let textBgColor = $state("#ffffff");
  let textBgEnabled = $state(false);
  let textCustomColors = $state<string[]>(loadTextCustomColors());
  let textFontFamily = $state("Arial");
  let textFontSize = $state(16);
  let textBold = $state(false);
  let textItalic = $state(false);
  let textUnderline = $state(false);
  let textStrikethrough = $state(false);
  let textAlign = $state<"left" | "center" | "right" | "justify">("left");

  // Erase submenu states
  let selectActive = $state(false);
  let removeActive = $state(false);
  let strokesHidden = $state(false);

  function setActiveTool(tool: MarkupTool) {
    activeTool = activeTool === tool ? "freehand" : tool;
  }

  function setRoundedCorner(v: boolean) {
    roundedCorner = v;
  }

  function setPathMode(v: boolean) {
    pathMode = v;
  }

  function selectShape(index: number | null) {
    selectedIndex = index;
    selectedIndices = index !== null ? [index] : [];
    // Sync selected shape's properties into the draw defaults
    if (index !== null) {
      const s = strokes[index];
      if (s && s.type === "shape") {
        drawColor = s.color;
        drawThickness = s.thickness;
        drawOpacity = s.opacity;
      }
      if (s && s.type === "text") {
        textColor = s.color;
        textFontFamily = s.fontFamily;
        textFontSize = s.fontSize;
        textBold = s.bold;
        textItalic = s.italic;
        textUnderline = s.underline;
        textStrikethrough = s.strikethrough;
        textAlign = s.align;
        textBgColor = s.bgColor;
        textBgEnabled = s.bgEnabled;
      }
    }
  }

  function selectShapes(indices: number[]) {
    selectedIndices = indices;
    selectedIndex = indices.length > 0 ? indices[indices.length - 1] : null;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "shape") {
        drawColor = s.color;
        drawThickness = s.thickness;
        drawOpacity = s.opacity;
      }
      if (s && s.type === "text") {
        textColor = s.color;
        textFontFamily = s.fontFamily;
        textFontSize = s.fontSize;
        textBold = s.bold;
        textItalic = s.italic;
        textUnderline = s.underline;
        textStrikethrough = s.strikethrough;
        textAlign = s.align;
        textBgColor = s.bgColor;
        textBgEnabled = s.bgEnabled;
      }
    }
  }

  function updateShape(index: number, props: Partial<PlacedShape>) {
    const s = strokes[index];
    if (!s || s.type !== "shape") return;
    const next = [...strokes];
    next[index] = { ...s, ...props };
    strokes = next;
  }

  function updateText(index: number, props: Partial<PlacedText>) {
    const s = strokes[index];
    if (!s || s.type !== "text") return;
    const next = [...strokes];
    next[index] = { ...s, ...props };
    strokes = next;
  }

  function toggleSelectedCornerRadius() {
    const newVal = !roundedCorner;
    roundedCorner = newVal;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "shape" && s.shape === "square") {
        updateShape(selectedIndex, { cornerRadius: newVal ? 0.2 : 0 });
      }
    }
  }

  function toggleDraw() {
    drawActive = !drawActive;
  }

  function setDrawColor(color: string) {
    drawColor = color;
    if (selectedIndex !== null) {
      updateShape(selectedIndex, { color });
    }
  }

  function setDrawThickness(v: number) {
    drawThickness = v;
    if (selectedIndex !== null) {
      updateShape(selectedIndex, { thickness: v });
    }
  }

  function setDrawOpacity(v: number) {
    drawOpacity = v;
    if (selectedIndex !== null) {
      updateShape(selectedIndex, { opacity: v });
    }
  }

  function setCustomColor(index: number, color: string) {
    const next = [...customColors];
    next[index] = color;
    customColors = next;
    saveMarkupCustomColors(next);
    drawColor = color;
    if (selectedIndex !== null) {
      updateShape(selectedIndex, { color });
    }
  }

  function startStroke(x: number, y: number) {
    currentStroke = {
      type: "freehand",
      points: [{ x, y }],
      color: drawColor,
      thickness: drawThickness,
      opacity: drawOpacity,
    };
  }

  function addPoint(x: number, y: number) {
    if (currentStroke) {
      currentStroke.points = [...currentStroke.points, { x, y }];
    }
  }

  function endStroke() {
    if (currentStroke && currentStroke.points.length > 0) {
      strokes = [...strokes, currentStroke];
    }
    currentStroke = null;
  }

  /** Place a shape at normalized (cx, cy) with default size. Auto-selects the new shape. */
  function placeShape(cx: number, cy: number) {
    placeShapeSized(cx, cy, 0.08, 0.08);
  }

  /** Place a shape at normalized (cx, cy) with explicit width/height. Auto-selects. */
  function placeShapeSized(
    cx: number,
    cy: number,
    width: number,
    height: number,
  ) {
    const stroke: PlacedShape = {
      type: "shape",
      shape: activeTool as ShapeKind,
      cx,
      cy,
      width: Math.max(0.005, width),
      height: Math.max(0.005, height),
      rotation: 0,
      cornerRadius: roundedCorner ? 0.2 : 0,
      color: drawColor,
      thickness: drawThickness,
      opacity: drawOpacity,
    };
    strokes = [...strokes, stroke];
    selectedIndex = strokes.length - 1;
  }

  /** Place a sized text box at normalized (x, y) center with explicit fontSize and boxExtraWidth. Auto-selects. */
  function placeTextSized(
    x: number,
    y: number,
    fontSize: number,
    boxExtraWidth: number,
  ) {
    const stroke: PlacedText = {
      type: "text",
      x,
      y,
      text: "",
      color: textColor,
      fontFamily: textFontFamily,
      fontSize,
      rotation: 0,
      boxExtraWidth,
      bold: textBold,
      italic: textItalic,
      underline: textUnderline,
      strikethrough: textStrikethrough,
      align: textAlign,
      bgColor: textBgColor,
      bgEnabled: textBgEnabled,
    };
    strokes = [...strokes, stroke];
    selectedIndex = strokes.length - 1;
  }

  /** Place a text box at normalized (x, y) center. Auto-selects. */
  function placeText(x: number, y: number) {
    const stroke: PlacedText = {
      type: "text",
      x,
      y,
      text: "",
      color: textColor,
      fontFamily: textFontFamily,
      fontSize: textFontSize,
      rotation: 0,
      boxExtraWidth: 0,
      bold: textBold,
      italic: textItalic,
      underline: textUnderline,
      strikethrough: textStrikethrough,
      align: textAlign,
      bgColor: textBgColor,
      bgEnabled: textBgEnabled,
    };
    strokes = [...strokes, stroke];
    selectedIndex = strokes.length - 1;
  }

  /** Place a straight line between two normalized points. */
  function placeLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lineType: LineKind,
  ) {
    const stroke: PlacedLine = {
      type: "line",
      lineType,
      x1,
      y1,
      x2,
      y2,
      isPath: false,
      points: [],
      color: drawColor,
      thickness: drawThickness,
      opacity: drawOpacity,
    };
    strokes = [...strokes, stroke];
  }

  /** Convert the current freehand stroke into a path-based PlacedLine with arrowheads. */
  function endPathLine(lineType: LineKind) {
    if (!currentStroke || currentStroke.points.length === 0) {
      currentStroke = null;
      return;
    }
    const pts = currentStroke.points;
    const stroke: PlacedLine = {
      type: "line",
      lineType,
      x1: pts[0].x,
      y1: pts[0].y,
      x2: pts[pts.length - 1].x,
      y2: pts[pts.length - 1].y,
      isPath: true,
      points: pts,
      color: currentStroke.color,
      thickness: currentStroke.thickness,
      opacity: currentStroke.opacity,
    };
    strokes = [...strokes, stroke];
    currentStroke = null;
  }

  function toggleHighlight() {
    highlightActive = !highlightActive;
  }

  function setHighlightColor(color: string) {
    highlightColor = color;
  }

  function setHighlightThickness(v: number) {
    highlightThickness = v;
  }

  function setHighlightOpacity(v: number) {
    highlightOpacity = v;
  }

  function setHighlightMode(mode: "free" | "straight") {
    highlightMode = mode;
  }

  function setHighlightCustomColor(index: number, color: string) {
    const next = [...highlightCustomColors];
    next[index] = color;
    highlightCustomColors = next;
    saveHighlightCustomColors(next);
    highlightColor = color;
  }

  function setTextColor(color: string) {
    textColor = color;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { color });
    }
  }

  function setTextBgColor(color: string) {
    textBgColor = color;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { bgColor: color });
    }
  }

  function setTextBgEnabled(v: boolean) {
    textBgEnabled = v;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { bgEnabled: v });
    }
  }

  function setTextCustomColor(index: number, color: string) {
    const next = [...textCustomColors];
    next[index] = color;
    textCustomColors = next;
    saveTextCustomColors(next);
  }

  function setTextFontFamily(family: string) {
    textFontFamily = family;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text")
        updateText(selectedIndex, { fontFamily: family });
    }
  }

  function setTextFontSize(size: number) {
    textFontSize = Math.max(6, Math.min(200, Math.round(size)));
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text")
        updateText(selectedIndex, { fontSize: textFontSize });
    }
  }

  function setTextBold(v: boolean) {
    textBold = v;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { bold: v });
    }
  }

  function setTextItalic(v: boolean) {
    textItalic = v;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { italic: v });
    }
  }

  function setTextUnderline(v: boolean) {
    textUnderline = v;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { underline: v });
    }
  }

  function setTextStrikethrough(v: boolean) {
    textStrikethrough = v;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text")
        updateText(selectedIndex, { strikethrough: v });
    }
  }

  function setTextAlign(align: "left" | "center" | "right" | "justify") {
    textAlign = align;
    if (selectedIndex !== null) {
      const s = strokes[selectedIndex];
      if (s && s.type === "text") updateText(selectedIndex, { align });
    }
  }

  function startHighlightStroke(x: number, y: number) {
    if (highlightMode === "free") {
      currentHighlight = {
        type: "highlight",
        mode: "free",
        points: [{ x, y }],
        color: highlightColor,
        thickness: highlightThickness,
        opacity: highlightOpacity,
      };
    }
  }

  function addHighlightPoint(x: number, y: number) {
    if (currentHighlight && currentHighlight.mode === "free") {
      currentHighlight.points = [...currentHighlight.points, { x, y }];
    }
  }

  function endHighlightStroke() {
    if (currentHighlight && currentHighlight.mode === "free") {
      if (currentHighlight.points.length > 0) {
        strokes = [...strokes, currentHighlight];
      }
    }
    currentHighlight = null;
  }

  function placeHighlightLine(x1: number, y1: number, x2: number, y2: number) {
    const stroke: HighlightStraight = {
      type: "highlight",
      mode: "straight",
      x1,
      y1,
      x2,
      y2,
      color: highlightColor,
      thickness: highlightThickness,
      opacity: highlightOpacity,
    };
    strokes = [...strokes, stroke];
  }

  function undoLastStroke() {
    if (strokes.length === 0) {
      showToast({ message: "Nothing to undo", color: "yellow" });
      return;
    }
    const removedIndex = strokes.length - 1;
    strokes = strokes.slice(0, -1);
    selectedIndices = selectedIndices
      .filter((i) => i !== removedIndex)
      .map((i) => (i > removedIndex ? i - 1 : i));
    if (
      selectedIndex !== null &&
      (selectedIndex === removedIndex || selectedIndex >= strokes.length)
    ) {
      selectedIndex = null;
    }
    showToast({ message: "Stroke undone", color: "blue" });
  }

  function deleteSelectedShape() {
    if (selectedIndices.length === 0) return;
    const idxSet = new Set(selectedIndices);
    const next = strokes.filter((_, i) => !idxSet.has(i));
    strokes = next;
    selectedIndex = null;
    selectedIndices = [];
  }

  function clearAllStrokes() {
    strokes = [];
    currentStroke = null;
    selectedIndex = null;
    selectedIndices = [];
  }

  /** Distance in CSS px from point (px,py) to line segment (x1,y1)-(x2,y2). */
  function distToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  /** Find the topmost stroke under normalized point (nx, ny). Returns index or null. */
  function findStrokeAt(
    nx: number,
    ny: number,
    w: number,
    h: number,
  ): number | null {
    const px = nx * w;
    const py = ny * h;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (s.type === "shape") {
        // Check if (nx, ny) is inside the shape's bounding box, accounting for rotation
        const halfW = s.width / 2;
        const halfH = s.height / 2;
        const dx = nx - s.cx;
        const dy = ny - s.cy;
        const cos = Math.cos(-s.rotation);
        const sin = Math.sin(-s.rotation);
        const localX = cos * dx - sin * dy;
        const localY = sin * dx + cos * dy;
        if (
          localX >= -halfW &&
          localX <= halfW &&
          localY >= -halfH &&
          localY <= halfH
        )
          return i;
      } else if (s.type === "text") {
        // Inline a simple bbox check using overlay dimensions
        const fontSize = s.fontSize;
        const estCharW = fontSize * 0.6;
        const textW = Math.max(
          (s.text || "").length * estCharW,
          fontSize * 1.5,
        );
        const pad = 6 * (fontSize / 16);
        const boxW = textW + pad * 2 + (s.boxExtraWidth || 0);
        const boxH = fontSize * 1.2 + pad;
        const left = s.x * w - boxW / 2;
        const top = s.y * h - boxH / 2;
        if (px >= left && px <= left + boxW && py >= top && py <= top + boxH)
          return i;
      } else if (s.type === "freehand") {
        const pts = s.points;
        const halfThick = s.thickness / 2;
        for (let j = 1; j < pts.length; j++) {
          const x1 = pts[j - 1].x * w,
            y1 = pts[j - 1].y * h;
          const x2 = pts[j].x * w,
            y2 = pts[j].y * h;
          if (distToSegment(px, py, x1, y1, x2, y2) <= halfThick) return i;
        }
        if (pts.length === 1) {
          const dx = px - pts[0].x * w;
          const dy = py - pts[0].y * h;
          if (Math.sqrt(dx * dx + dy * dy) <= halfThick) return i;
        }
      } else if (s.type === "line") {
        const halfThick = s.thickness / 2;
        if (s.isPath && s.points.length > 0) {
          const pts = s.points;
          for (let j = 1; j < pts.length; j++) {
            const x1 = pts[j - 1].x * w,
              y1 = pts[j - 1].y * h;
            const x2 = pts[j].x * w,
              y2 = pts[j].y * h;
            if (distToSegment(px, py, x1, y1, x2, y2) <= halfThick) return i;
          }
        } else {
          const x1 = s.x1 * w,
            y1 = s.y1 * h;
          const x2 = s.x2 * w,
            y2 = s.y2 * h;
          if (distToSegment(px, py, x1, y1, x2, y2) <= halfThick) return i;
        }
      } else if (s.type === "highlight") {
        const halfThick = s.thickness / 2;
        if (s.mode === "free") {
          const pts = s.points;
          for (let j = 1; j < pts.length; j++) {
            const x1 = pts[j - 1].x * w,
              y1 = pts[j - 1].y * h;
            const x2 = pts[j].x * w,
              y2 = pts[j].y * h;
            if (distToSegment(px, py, x1, y1, x2, y2) <= halfThick) return i;
          }
          if (pts.length === 1) {
            const dx = px - pts[0].x * w;
            const dy = py - pts[0].y * h;
            if (Math.sqrt(dx * dx + dy * dy) <= halfThick) return i;
          }
        } else {
          const x1 = s.x1 * w,
            y1 = s.y1 * h;
          const x2 = s.x2 * w,
            y2 = s.y2 * h;
          if (distToSegment(px, py, x1, y1, x2, y2) <= halfThick) return i;
        }
      }
    }
    return null;
  }

  /** Delete the topmost stroke under normalized point (nx, ny). Returns true if deleted. */
  function deleteStrokeAt(
    nx: number,
    ny: number,
    w: number,
    h: number,
  ): boolean {
    const idx = findStrokeAt(nx, ny, w, h);
    if (idx === null) return false;
    strokes = strokes.filter((_, i) => i !== idx);
    if (selectedIndex !== null) {
      if (selectedIndex === idx || selectedIndex >= strokes.length) {
        selectedIndex = null;
      } else if (selectedIndex > idx) {
        selectedIndex = selectedIndex - 1;
      }
    }
    return true;
  }

  /** Translate a stroke by normalized delta (dx, dy). */
  function moveStrokeBy(idx: number, dx: number, dy: number) {
    const s = strokes[idx];
    if (!s) return;
    const next = [...strokes];
    switch (s.type) {
      case "shape":
        next[idx] = { ...s, cx: s.cx + dx, cy: s.cy + dy };
        break;
      case "text":
        next[idx] = { ...s, x: s.x + dx, y: s.y + dy };
        break;
      case "freehand":
        next[idx] = {
          ...s,
          points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        };
        break;
      case "line":
        if (s.isPath) {
          next[idx] = {
            ...s,
            points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            x1: s.x1 + dx,
            y1: s.y1 + dy,
            x2: s.x2 + dx,
            y2: s.y2 + dy,
          };
        } else {
          next[idx] = {
            ...s,
            x1: s.x1 + dx,
            y1: s.y1 + dy,
            x2: s.x2 + dx,
            y2: s.y2 + dy,
          };
        }
        break;
      case "highlight":
        if (s.mode === "free") {
          next[idx] = {
            ...s,
            points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          };
        } else {
          next[idx] = {
            ...s,
            x1: s.x1 + dx,
            y1: s.y1 + dy,
            x2: s.x2 + dx,
            y2: s.y2 + dy,
          };
        }
        break;
    }
    strokes = next;
  }

  /** Translate all selected strokes by normalized delta (dx, dy). */
  function moveSelectedStrokesBy(dx: number, dy: number) {
    if (selectedIndices.length === 0) return;
    let next = [...strokes];
    for (const idx of selectedIndices) {
      const s = next[idx];
      if (!s) continue;
      switch (s.type) {
        case "shape":
          next[idx] = { ...s, cx: s.cx + dx, cy: s.cy + dy };
          break;
        case "text":
          next[idx] = { ...s, x: s.x + dx, y: s.y + dy };
          break;
        case "freehand":
          next[idx] = {
            ...s,
            points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          };
          break;
        case "line":
          if (s.isPath) {
            next[idx] = {
              ...s,
              points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
              x1: s.x1 + dx,
              y1: s.y1 + dy,
              x2: s.x2 + dx,
              y2: s.y2 + dy,
            };
          } else {
            next[idx] = {
              ...s,
              x1: s.x1 + dx,
              y1: s.y1 + dy,
              x2: s.x2 + dx,
              y2: s.y2 + dy,
            };
          }
          break;
        case "highlight":
          if (s.mode === "free") {
            next[idx] = {
              ...s,
              points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          } else {
            next[idx] = {
              ...s,
              x1: s.x1 + dx,
              y1: s.y1 + dy,
              x2: s.x2 + dx,
              y2: s.y2 + dy,
            };
          }
          break;
      }
    }
    strokes = next;
  }

  /** Compute overlap between two axis-aligned rectangles. */
  function rectsOverlap(
    ax1: number,
    ay1: number,
    ax2: number,
    ay2: number,
    bx1: number,
    by1: number,
    bx2: number,
    by2: number,
  ): boolean {
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
  }

  /** Find all stroke indices whose bounding box overlaps the normalized rectangle (nx1,ny1)-(nx2,ny2). */
  function findStrokesInRect(
    nx1: number,
    ny1: number,
    nx2: number,
    ny2: number,
    w: number,
    h: number,
  ): number[] {
    const left = Math.min(nx1, nx2) * w;
    const right = Math.max(nx1, nx2) * w;
    const top = Math.min(ny1, ny2) * h;
    const bottom = Math.max(ny1, ny2) * h;
    const hits: number[] = [];
    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i];
      let sl: number, sr: number, st: number, sb: number;
      if (s.type === "shape") {
        const hw = (s.width * w) / 2;
        const hh = (s.height * h) / 2;
        const cx = s.cx * w;
        const cy = s.cy * h;
        sl = cx - hw;
        sr = cx + hw;
        st = cy - hh;
        sb = cy + hh;
      } else if (s.type === "text") {
        const fontSize = s.fontSize;
        const estCharW = fontSize * 0.6;
        const textW = Math.max(
          (s.text || "").length * estCharW,
          fontSize * 1.5,
        );
        const pad = 6 * (fontSize / 16);
        const boxW = textW + pad * 2 + (s.boxExtraWidth || 0);
        const boxH = fontSize * 1.2 + pad;
        sl = s.x * w - boxW / 2;
        st = s.y * h - boxH / 2;
        sr = sl + boxW;
        sb = st + boxH;
      } else if (s.type === "freehand") {
        if (s.points.length === 0) continue;
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        for (const p of s.points) {
          const px = p.x * w,
            py = p.y * h;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
        sl = minX;
        sr = maxX;
        st = minY;
        sb = maxY;
      } else if (s.type === "line") {
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        if (s.isPath && s.points.length > 0) {
          for (const p of s.points) {
            const px = p.x * w,
              py = p.y * h;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        } else {
          const x1 = s.x1 * w,
            y1 = s.y1 * h;
          const x2 = s.x2 * w,
            y2 = s.y2 * h;
          minX = Math.min(x1, x2);
          maxX = Math.max(x1, x2);
          minY = Math.min(y1, y2);
          maxY = Math.max(y1, y2);
        }
        sl = minX;
        sr = maxX;
        st = minY;
        sb = maxY;
      } else if (s.type === "highlight") {
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        if (s.mode === "free") {
          if (s.points.length === 0) continue;
          for (const p of s.points) {
            const px = p.x * w,
              py = p.y * h;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        } else {
          minX = Math.min(s.x1, s.x2) * w;
          maxX = Math.max(s.x1, s.x2) * w;
          minY = Math.min(s.y1, s.y2) * h;
          maxY = Math.max(s.y1, s.y2) * h;
        }
        sl = minX;
        sr = maxX;
        st = minY;
        sb = maxY;
      } else {
        continue;
      }
      if (rectsOverlap(sl, st, sr, sb, left, top, right, bottom)) {
        hits.push(i);
      }
    }
    return hits;
  }

  function cleanup() {
    drawActive = false;
    drawColor = "#000000";
    drawThickness = 3;
    drawOpacity = 1;
    strokes = [];
    currentStroke = null;
    activeTool = "freehand";
    roundedCorner = false;
    pathMode = false;
    selectedIndex = null;
    selectedIndices = [];
    highlightActive = false;
    highlightColor = "#f5c518";
    highlightThickness = 20;
    highlightOpacity = 0.4;
    highlightMode = "free";
    currentHighlight = null;
    textActive = false;
    textColor = "#000000";
    textBgColor = "#ffffff";
    textBgEnabled = false;
    textFontFamily = "Arial";
    textFontSize = 16;
    textBold = false;
    textItalic = false;
    textUnderline = false;
    textStrikethrough = false;
    textAlign = "left";
    selectActive = false;
    removeActive = false;
    strokesHidden = false;
  }

  return {
    get drawActive() {
      return drawActive;
    },
    set drawActive(v: boolean) {
      drawActive = v;
    },
    get drawColor() {
      return drawColor;
    },
    get drawThickness() {
      return drawThickness;
    },
    get drawOpacity() {
      return drawOpacity;
    },
    get strokes() {
      return strokes;
    },
    get currentStroke() {
      return currentStroke;
    },
    get customColors() {
      return customColors;
    },
    get activeTool() {
      return activeTool;
    },
    get roundedCorner() {
      return roundedCorner;
    },
    get pathMode() {
      return pathMode;
    },
    get selectedIndex() {
      return selectedIndex;
    },
    get selectedIndices() {
      return selectedIndices;
    },
    set selectedIndices(v: number[]) {
      selectedIndices = v;
    },
    get highlightActive() {
      return highlightActive;
    },
    set highlightActive(v: boolean) {
      highlightActive = v;
    },
    get highlightColor() {
      return highlightColor;
    },
    get highlightThickness() {
      return highlightThickness;
    },
    get highlightOpacity() {
      return highlightOpacity;
    },
    get highlightMode() {
      return highlightMode;
    },
    get highlightCustomColors() {
      return highlightCustomColors;
    },
    get currentHighlight() {
      return currentHighlight;
    },
    get textColor() {
      return textColor;
    },
    get textBgColor() {
      return textBgColor;
    },
    get textBgEnabled() {
      return textBgEnabled;
    },
    get textCustomColors() {
      return textCustomColors;
    },
    get textFontFamily() {
      return textFontFamily;
    },
    get textFontSize() {
      return textFontSize;
    },
    set textFontSize(v: number) {
      textFontSize = v;
    },
    get textBold() {
      return textBold;
    },
    get textItalic() {
      return textItalic;
    },
    get textUnderline() {
      return textUnderline;
    },
    get textStrikethrough() {
      return textStrikethrough;
    },
    get textAlign() {
      return textAlign;
    },
    get textActive() {
      return textActive;
    },
    set textActive(v: boolean) {
      textActive = v;
    },
    get cursorStyle(): string {
      if (textActive) return "text";
      if (selectActive) return "default";
      if (removeActive) return "crosshair";
      if (!drawActive && !highlightActive) return "default";
      if (highlightActive) return "crosshair";
      if (activeTool === "freehand") return "crosshair";

      const svgs: Record<string, string> = {
        square:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='4' y='4' width='16' height='16' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        circle:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='8' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        triangle:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,4 20,20 4,20' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        line: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        arrow:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='black' stroke-width='2'/%3E%3Cpolyline points='14,6 20,12 14,18' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        "bidirectional-arrow":
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolyline points='7,6 1,12 7,18' fill='none' stroke='black' stroke-width='2'/%3E%3Cline x1='1' y1='12' x2='23' y2='12' stroke='black' stroke-width='2'/%3E%3Cpolyline points='17,6 23,12 17,18' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
      };
      const svg = svgs[activeTool];
      if (svg) return `url('${svg}') 12 12, crosshair`;
      return "crosshair";
    },
    get selectActive() {
      return selectActive;
    },
    set selectActive(v: boolean) {
      selectActive = v;
    },
    get removeActive() {
      return removeActive;
    },
    set removeActive(v: boolean) {
      removeActive = v;
    },
    get strokesHidden() {
      return strokesHidden;
    },
    set strokesHidden(v: boolean) {
      strokesHidden = v;
    },
    toggleDraw,
    setDrawColor,
    setCustomColor,
    setDrawThickness,
    setDrawOpacity,
    startStroke,
    addPoint,
    endStroke,
    undoLastStroke,
    deleteSelectedShape,
    clearAllStrokes,
    findStrokeAt,
    deleteStrokeAt,
    moveStrokeBy,
    moveSelectedStrokesBy,
    findStrokesInRect,
    selectShapes,
    cleanup,
    setActiveTool,
    setRoundedCorner,
    setPathMode,
    selectShape,
    updateShape,
    updateText,
    placeText,
    placeTextSized,
    toggleSelectedCornerRadius,
    placeShape,
    placeShapeSized,
    placeLine,
    endPathLine,
    toggleHighlight,
    setHighlightColor,
    setHighlightCustomColor,
    setHighlightThickness,
    setHighlightOpacity,
    setHighlightMode,
    startHighlightStroke,
    addHighlightPoint,
    endHighlightStroke,
    placeHighlightLine,
    setTextColor,
    setTextBgColor,
    setTextBgEnabled,
    setTextCustomColor,
    setTextFontFamily,
    setTextFontSize,
    setTextBold,
    setTextItalic,
    setTextUnderline,
    setTextStrikethrough,
    setTextAlign,
  };
}

export type MarkupStore = typeof markup;
export const markup = createMarkupStore();
