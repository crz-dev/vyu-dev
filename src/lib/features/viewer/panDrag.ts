import { getCurrentWindow } from "@tauri-apps/api/window";
import { viewer } from "./viewer.svelte";

export interface PanDragDeps {
  getIsVideo: () => boolean;
  toggleFullscreen: () => void;
  togglePlay: () => void;
}

export function createPanDrag(deps: PanDragDeps) {
  let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastLeftClickTime = 0;
  let pendingPlay: ReturnType<typeof setTimeout> | undefined;

  function startPan(e: MouseEvent) {
    if (e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest(
        ".video-controls, .fs-controls, .fs-topbar, .fs-nav-left, .fs-nav-right, .fs-file-count-pill, .context-menu, .delete-overlay",
      )
    )
      return;
    e.preventDefault();
    let hasMoved = false;
    viewer.setDragging(true);
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      tx: viewer.state.translateX,
      ty: viewer.state.translateY,
    };
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - dragStart.x;
      const dy = ev.clientY - dragStart.y;
      if (!hasMoved && Math.sqrt(dx * dx + dy * dy) < 8) return;
      hasMoved = true;
      if (viewer.state.zoomLevel > viewer.state.baseZoomLevel)
        viewer.setTranslation(dragStart.tx + dx, dragStart.ty + dy);
    }
    function onUp() {
      viewer.setDragging(false);
      if (!hasMoved) {
        const now = Date.now();
        const timeSinceLast = now - lastLeftClickTime;
        lastLeftClickTime = now;
        if (deps.getIsVideo()) {
          if (timeSinceLast < 300) {
            clearTimeout(pendingPlay);
            deps.toggleFullscreen();
            lastLeftClickTime = 0;
          } else {
            pendingPlay = setTimeout(deps.togglePlay, 150);
          }
        } else {
          if (timeSinceLast < 300) {
            deps.toggleFullscreen();
            lastLeftClickTime = 0;
          }
        }
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function startDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, .filename, .filename-input"))
      return;
    document.activeElement && (document.activeElement as HTMLElement).blur();
    await getCurrentWindow().startDragging();
  }

  return { startPan, startDrag };
}
