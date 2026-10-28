// Appearance state — scale, density, reduced motion, transparency
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  loadCheckerboard,
  loadDensity,
  loadReducedMotion,
  loadUiScale,
  saveCheckerboard,
  saveDensity,
  saveReducedMotion,
  saveUiScale,
  type DisplayDensity,
} from "$lib/services/storage";

export type { DisplayDensity };

const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 1.5;

function clampUiScale(scale: number): number {
  const percent = Math.round((scale * 100) / 5) * 5;
  return (
    Math.min(UI_SCALE_MAX * 100, Math.max(UI_SCALE_MIN * 100, percent)) / 100
  );
}

function createAppearance() {
  let uiScale = $state(clampUiScale(loadUiScale()));
  let density = $state<DisplayDensity>(loadDensity());
  let reducedMotion = $state(loadReducedMotion());
  let checkerboard = $state(loadCheckerboard());

  function applyRootAttributes() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.density = density;
    root.dataset.transparency = checkerboard ? "checkerboard" : "solid";
    root.dataset.reduceMotion = reducedMotion ? "true" : "false";
  }

  async function applyZoom() {
    try {
      await getCurrentWebview().setZoom(uiScale);
    } catch (e) {
      console.error("Failed to apply UI scale:", e);
    }
  }

  function setUiScale(scale: number) {
    uiScale = clampUiScale(scale);
    saveUiScale(uiScale);
    void applyZoom();
  }

  function setDensity(next: DisplayDensity) {
    density = next;
    saveDensity(next);
    applyRootAttributes();
  }

  function setReducedMotion(enabled: boolean) {
    reducedMotion = enabled;
    saveReducedMotion(enabled);
    applyRootAttributes();
  }

  function setCheckerboard(enabled: boolean) {
    checkerboard = enabled;
    saveCheckerboard(enabled);
    applyRootAttributes();
  }

  function init() {
    applyRootAttributes();
    void applyZoom();
  }

  init();

  return {
    get uiScale() {
      return uiScale;
    },
    get density() {
      return density;
    },
    get reducedMotion() {
      return reducedMotion;
    },
    get checkerboard() {
      return checkerboard;
    },
    setUiScale,
    setDensity,
    setReducedMotion,
    setCheckerboard,
    init,
  };
}

export const appearance = createAppearance();
