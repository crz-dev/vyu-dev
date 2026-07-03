// Viewer effects
import { viewer } from "./viewer.svelte";
import { editing } from "$lib/features/editing/editing.svelte";

export interface ViewerEffectsDeps {
  getVideoEl: () => HTMLVideoElement | null;
  getViewerEl: () => HTMLElement | null;
  getFileSrc: () => string;
  getIsVideo: () => boolean;
  getImageNaturalWidth: () => number;
  getImageNaturalHeight: () => number;
  getThumbnailBarVisible: () => boolean;
  getIsFullscreen: () => boolean;
}

export function createViewerEffects(deps: ViewerEffectsDeps) {
  function getViewerContentSize(): { width: number; height: number } {
    const viewerEl = deps.getViewerEl();
    if (!viewerEl) return { width: 0, height: 0 };
    const style = getComputedStyle(viewerEl);
    const padH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    return {
      width: viewerEl.clientWidth - padH,
      height: viewerEl.clientHeight - padV,
    };
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
        if (
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
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }

  function refitOnChangeEffect() {
    void deps.getThumbnailBarVisible();
    void editing.snapshot.rotation;
    if (
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
    setVideoElEffect,
    resizeObserverEffect,
    refitOnChangeEffect,
  };
}
