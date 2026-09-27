// Viewer effects
import { viewer } from "./viewer.svelte";
import { editing } from "$lib/features/editing/editing.svelte";

export interface ViewerEffectsDeps {
  getVideoEl: () => HTMLVideoElement | null;
  getViewerEl: () => HTMLElement | null;
  getFileSrc: () => string;
  getIsVideo: () => boolean;
  getIsPdf: () => boolean;
  getImageNaturalWidth: () => number;
  getImageNaturalHeight: () => number;
  getPdfPageDimensions: () => { width: number; height: number }[];
  getPdfAutoFit: () => boolean;
  fitPdfToScreen: (width: number, height: number) => void;
  getThumbnailBarVisible: () => boolean;
  getIsFullscreen: () => boolean;
}

export function createViewerEffects(deps: ViewerEffectsDeps) {
  let cachedViewerEl: HTMLElement | null = null;
  let cachedPadH = 0;
  let cachedPadV = 0;

  function getViewerContentSize(): { width: number; height: number } {
    const viewerEl = deps.getViewerEl();
    if (!viewerEl) return { width: 0, height: 0 };
    if (viewerEl !== cachedViewerEl) {
      const style = getComputedStyle(viewerEl);
      cachedPadH =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      cachedPadV =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      cachedViewerEl = viewerEl;
    }
    return {
      width: viewerEl.clientWidth - cachedPadH,
      height: viewerEl.clientHeight - cachedPadV,
    };
  }

  function hasPdfDimensions(): boolean {
    let hasPage = false;
    for (const page of deps.getPdfPageDimensions()) {
      hasPage = true;
      if (page.width <= 0 || page.height <= 0) return false;
    }
    return hasPage;
  }

  function fitPdfToViewer() {
    if (!deps.getIsPdf() || !hasPdfDimensions()) return;
    const { width, height } = getViewerContentSize();
    deps.fitPdfToScreen(width, height);
  }

  function refitPdfIfNeeded() {
    if (!deps.getPdfAutoFit()) return;
    fitPdfToViewer();
  }

  function resetZoom() {
    if (
      viewer.state.zoomLocked ||
      !deps.getViewerEl() ||
      deps.getImageNaturalWidth() <= 0 ||
      deps.getImageNaturalHeight() <= 0
    ) {
      viewer.resetZoom();
    } else {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(
        width,
        height,
        deps.getImageNaturalWidth(),
        deps.getImageNaturalHeight(),
      );
    }
  }

  function handleToggleZoomLock() {
    const wasLocked = viewer.state.zoomLocked;
    viewer.toggleZoomLock();
    if (wasLocked && !viewer.state.zoomLocked) {
      if (
        deps.getViewerEl() &&
        deps.getImageNaturalWidth() > 0 &&
        deps.getImageNaturalHeight() > 0
      ) {
        const { width, height } = getViewerContentSize();
        viewer.fitToScreen(
          width,
          height,
          deps.getImageNaturalWidth(),
          deps.getImageNaturalHeight(),
        );
      }
    }
  }

  function handleViewerScroll(e: WheelEvent) {
    viewer.handleViewerScroll(e, deps.getFileSrc());
  }

  function toggleFullscreen() {
    viewer.toggleFullscreen();
  }

  function setVideoElEffect() {
    viewer.setVideoEl(deps.getVideoEl());
  }

  function resizeObserverEffect() {
    const viewerEl = deps.getViewerEl();
    if (!viewerEl) return;
    const el = viewerEl;
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          cachedViewerEl = null;
          if (deps.getFileSrc() && deps.getIsPdf()) {
            refitPdfIfNeeded();
          } else if (
            deps.getFileSrc() &&
            !deps.getIsVideo() &&
            deps.getImageNaturalWidth() > 0 &&
            deps.getImageNaturalHeight() > 0 &&
            Math.abs(viewer.state.zoomLevel - viewer.state.baseZoomLevel) < 0.5
          ) {
            const { width, height } = getViewerContentSize();
            viewer.fitToScreen(
              width,
              height,
              deps.getImageNaturalWidth(),
              deps.getImageNaturalHeight(),
            );
          }
        } catch (e) {
          console.error("resizeObserverEffect fitToScreen failed:", e);
        }
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }

  function refitOnChangeEffect() {
    cachedViewerEl = null;
    void deps.getThumbnailBarVisible();
    void deps.getIsFullscreen();
    void editing.snapshot.rotation;
    if (deps.getViewerEl() && deps.getFileSrc() && deps.getIsPdf()) {
      refitPdfIfNeeded();
    } else if (
      deps.getViewerEl() &&
      deps.getFileSrc() &&
      !deps.getIsVideo() &&
      deps.getImageNaturalWidth() > 0 &&
      deps.getImageNaturalHeight() > 0
    ) {
      const { width, height } = getViewerContentSize();
      viewer.fitToScreen(
        width,
        height,
        deps.getImageNaturalWidth(),
        deps.getImageNaturalHeight(),
      );
    }
  }

  return {
    getViewerContentSize,
    resetZoom,
    handleToggleZoomLock,
    handleViewerScroll,
    toggleFullscreen,
    fitPdfToViewer,
    setVideoElEffect,
    resizeObserverEffect,
    refitOnChangeEffect,
  };
}
