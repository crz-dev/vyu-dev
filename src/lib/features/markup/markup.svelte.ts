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

import {
  loadMarkupCustomColors,
  saveMarkupCustomColors,
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

export type MarkupStroke = FreehandStroke | PlacedShape | PlacedLine;

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

  function setActiveTool(tool: MarkupTool) {
    activeTool = tool;
  }

  function setRoundedCorner(v: boolean) {
    roundedCorner = v;
  }

  function setPathMode(v: boolean) {
    pathMode = v;
  }

  function selectShape(index: number | null) {
    selectedIndex = index;
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
  }

  function setDrawThickness(v: number) {
    drawThickness = v;
  }

  function setDrawOpacity(v: number) {
    drawOpacity = v;
  }

  function setCustomColor(index: number, color: string) {
    const next = [...customColors];
    next[index] = color;
    customColors = next;
    saveMarkupCustomColors(next);
    drawColor = color;
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

  /** Place a shape at normalized (cx, cy). Auto-selects the new shape. */
  function placeShape(cx: number, cy: number) {
    const stroke: PlacedShape = {
      type: "shape",
      shape: activeTool as ShapeKind,
      cx,
      cy,
      width: 0.08,
      height: 0.08,
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
    get cursorStyle(): string {
      if (!drawActive) return "default";
      if (activeTool === "freehand") return "crosshair";

      const svgs: Record<string, string> = {
        square:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Crect x='4' y='4' width='16' height='16' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        circle:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='8' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        triangle:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpolygon points='12,4 20,20 4,20' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
        line:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='black' stroke-width='2'/%3E%3C/svg%3E",
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
    clearAllStrokes,
    cleanup,
    setActiveTool,
    setRoundedCorner,
    setPathMode,
    selectShape,
    updateShape,
    toggleSelectedCornerRadius,
    placeShape,
    placeLine,
    endPathLine,
  };
}

export type MarkupStore = typeof markup;
export const markup = createMarkupStore();
