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
  setPdfScale: (scale: number) => void;
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

  function getMediaDimensions(): { width: number; height: number } | null {
    if (deps.getIsVideo()) {
      const video = deps.getVideoEl();
      if (!video || video.videoWidth <= 0 || video.videoHeight <= 0)
        return null;
      return { width: video.videoWidth, height: video.videoHeight };
    }

    const width = deps.getImageNaturalWidth();
    const height = deps.getImageNaturalHeight();
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }

  function fitMediaToViewer(): boolean {
    const viewerEl = deps.getViewerEl();
    const dimensions = getMediaDimensions();
    if (!viewerEl || !dimensions) return false;

    const { width, height } = getViewerContentSize();
    viewer.fitToScreen(width, height, dimensions.width, dimensions.height);
    return true;
  }

  function refitPdfIfNeeded() {
    if (viewer.state.zoomLocked) return;
    if (!deps.getPdfAutoFit()) return;
    fitPdfToViewer();
  }

  function resetZoom() {
    if (deps.getIsPdf()) {
      if (viewer.state.zoomLocked) {
        deps.setPdfScale(1);
      } else {
        fitPdfToViewer();
      }
      return;
    }

    if (viewer.state.zoomLocked || !fitMediaToViewer()) {
      viewer.resetZoom();
    }
  }

  function handleToggleZoomLock() {
    const wasLocked = viewer.state.zoomLocked;
    viewer.toggleZoomLock();
    if (deps.getIsPdf()) {
      if (viewer.state.zoomLocked) {
        deps.setPdfScale(1);
      } else {
        fitPdfToViewer();
      }
      return;
    }

    if (wasLocked && !viewer.state.zoomLocked) fitMediaToViewer();
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
            !deps.getIsPdf() &&
            !viewer.state.zoomLocked &&
            Math.abs(viewer.state.zoomLevel - viewer.state.baseZoomLevel) < 0.5
          ) {
            fitMediaToViewer();
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
    } else if (deps.getViewerEl() && deps.getFileSrc() && !deps.getIsPdf()) {
      fitMediaToViewer();
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
