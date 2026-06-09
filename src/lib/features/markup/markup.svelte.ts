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

export type HighlightStroke = HighlightFreehand | HighlightStraight;
export type MarkupStroke =
  | FreehandStroke
  | PlacedShape
  | PlacedLine
  | HighlightStroke;

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

  // Highlight state
  let highlightActive = $state(false);
  let highlightColor = $state("#f5c518");
  let highlightThickness = $state(20);
  let highlightOpacity = $state(0.4);
  let highlightMode = $state<"free" | "straight">("free");
  let highlightCustomColors = $state<string[]>(loadHighlightCustomColors());
  let currentHighlight = $state<HighlightFreehand | null>(null);

  // Text state
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
    // Sync selected shape's properties into the draw defaults
    if (index !== null) {
      const s = strokes[index];
      if (s && s.type === "shape") {
        drawColor = s.color;
        drawThickness = s.thickness;
        drawOpacity = s.opacity;
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
  }

  function setTextBgColor(color: string) {
    textBgColor = color;
  }

  function setTextBgEnabled(v: boolean) {
    textBgEnabled = v;
  }

  function setTextCustomColor(index: number, color: string) {
    const next = [...textCustomColors];
    next[index] = color;
    textCustomColors = next;
    saveTextCustomColors(next);
  }

  function setTextFontFamily(family: string) {
    textFontFamily = family;
  }

  function setTextFontSize(size: number) {
    textFontSize = Math.max(6, Math.min(72, Math.round(size)));
  }

  function setTextBold(v: boolean) {
    textBold = v;
  }

  function setTextItalic(v: boolean) {
    textItalic = v;
  }

  function setTextUnderline(v: boolean) {
    textUnderline = v;
  }

  function setTextStrikethrough(v: boolean) {
    textStrikethrough = v;
  }

  function setTextAlign(align: "left" | "center" | "right" | "justify") {
    textAlign = align;
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
    if (
      selectedIndex !== null &&
      (selectedIndex === removedIndex || selectedIndex >= strokes.length)
    ) {
      selectedIndex = null;
    }
    showToast({ message: "Stroke undone", color: "blue" });
  }

  function deleteSelectedShape() {
    if (selectedIndex === null) return;
    const next = strokes.filter((_, i) => i !== selectedIndex);
    strokes = next;
    selectedIndex = null;
  }

  function clearAllStrokes() {
    strokes = [];
    currentStroke = null;
    selectedIndex = null;
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
    highlightActive = false;
    highlightColor = "#f5c518";
    highlightThickness = 20;
    highlightOpacity = 0.4;
    highlightMode = "free";
    currentHighlight = null;
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
    get cursorStyle(): string {
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
    cleanup,
    setActiveTool,
    setRoundedCorner,
    setPathMode,
    selectShape,
    updateShape,
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
