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

export interface DrawStroke {
  points: DrawPoint[];
  color: string;
  thickness: number;
  opacity: number;
}

function createMarkupStore() {
  let drawActive = $state(false);
  let drawColor = $state("#000000");
  let drawThickness = $state(3);
  let drawOpacity = $state(1);
  let strokes = $state<DrawStroke[]>([]);
  let currentStroke = $state<DrawStroke | null>(null);
  let customColors = $state<string[]>(loadMarkupCustomColors());

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

  function undoLastStroke() {
    if (strokes.length === 0) {
      showToast({ message: "Nothing to undo", color: "yellow" });
      return;
    }
    strokes = strokes.slice(0, -1);
    showToast({ message: "Stroke undone", color: "blue" });
  }

  function clearAllStrokes() {
    strokes = [];
    currentStroke = null;
  }

  function cleanup() {
    drawActive = false;
    drawColor = "#000000";
    drawThickness = 3;
    drawOpacity = 1;
    strokes = [];
    currentStroke = null;
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
  };
}

export type MarkupStore = typeof markup;
export const markup = createMarkupStore();
