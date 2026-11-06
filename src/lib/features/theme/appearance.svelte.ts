// Appearance state — scale, density, reduced motion, transparency
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  loadCheckerboard,
  loadCursorAutoHide,
  loadDensity,
  loadFileTransition,
  loadHideDangerZone,
  loadHighContrast,
  loadReducedMotion,
  loadRememberLastTab,
  loadUiScale,
  loadViewerBackground,
  saveCheckerboard,
  saveCursorAutoHide,
  saveDensity,
  saveFileTransition,
  saveHideDangerZone,
  saveHighContrast,
  saveReducedMotion,
  saveRememberLastTab,
  saveUiScale,
  saveViewerBackground,
  type DisplayDensity,
  type FileTransition,
  type ViewerBackground,
} from "$lib/services/storage";

export type { DisplayDensity, FileTransition, ViewerBackground };

const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 2.25;

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
  const showTooltips = true;
  let cursorAutoHide = $state(loadCursorAutoHide());
  let highContrast = $state(loadHighContrast());
  let viewerBackground = $state<ViewerBackground>(loadViewerBackground());
  let fileTransition = $state<FileTransition>(loadFileTransition());
  let rememberLastTab = $state(loadRememberLastTab());
  let hideDangerZone = $state(loadHideDangerZone());

  function applyRootAttributes() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.density = density;
    root.dataset.transparency = checkerboard ? "checkerboard" : "solid";
    root.dataset.reduceMotion = reducedMotion ? "true" : "false";
    root.dataset.tooltips = "on";
    root.dataset.highContrast = highContrast ? "true" : "false";
    root.dataset.viewerBg = viewerBackground;
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

  function setCursorAutoHide(enabled: boolean) {
    cursorAutoHide = enabled;
    saveCursorAutoHide(enabled);
  }

  function setHighContrast(enabled: boolean) {
    highContrast = enabled;
    saveHighContrast(enabled);
    applyRootAttributes();
  }

  function setRememberLastTab(enabled: boolean) {
    rememberLastTab = enabled;
    saveRememberLastTab(enabled);
  }

  function setHideDangerZone(enabled: boolean) {
    hideDangerZone = enabled;
    saveHideDangerZone(enabled);
  }

  function setViewerBackground(background: ViewerBackground) {
    viewerBackground = background;
    saveViewerBackground(background);
    applyRootAttributes();
  }

  function setFileTransition(transition: FileTransition) {
    fileTransition = transition;
    saveFileTransition(transition);
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
    get showTooltips() {
      return showTooltips;
    },
    get cursorAutoHide() {
      return cursorAutoHide;
    },
    get highContrast() {
      return highContrast;
    },
    get viewerBackground() {
      return viewerBackground;
    },
    get fileTransition() {
      return fileTransition;
    },
    get rememberLastTab() {
      return rememberLastTab;
    },
    get hideDangerZone() {
      return hideDangerZone;
    },
    setUiScale,
    setDensity,
    setReducedMotion,
    setCheckerboard,
    setCursorAutoHide,
    setHighContrast,
    setRememberLastTab,
    setHideDangerZone,
    setViewerBackground,
    setFileTransition,
    init,
  };
}

export const appearance = createAppearance();
