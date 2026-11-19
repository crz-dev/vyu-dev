import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  primaryMonitor,
  type Monitor,
  type PhysicalPosition,
  type PhysicalSize,
} from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  invokeSetPipActive,
  invokeSetWindowBounds,
} from "$lib/features/system/api";
import { appearance } from "$lib/features/theme/appearance.svelte";

export type PipMediaKind = "image" | "video" | "audio" | "pdf";

export interface PipMedia {
  kind: PipMediaKind;
  width: number;
  height: number;
  rotation?: number;
}

type GeometrySnapshot = {
  position: PhysicalPosition | null;
  size: PhysicalSize | null;
  wasMaximized: boolean;
  wasAlwaysOnTop: boolean;
};

const TARGET_WIDTH = 400;
const AUDIO_WIDTH = 400;
const AUDIO_HEIGHT = 164;
const MARGIN = 24;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 158;
const MAX_WIDTH_FRACTION = 0.72;
const MAX_HEIGHT_FRACTION = 0.62;
// Mirrors tauri.conf.json so exiting restores the configured minimum.
const CONFIG_MIN_SIZE = new LogicalSize(400, 300);
const CONTROL_HIDE_MS = 1600;
const RESIZE_SUPPRESS_MS = 500;
const SLIDE_MS = 240;
const FIT_SLIDE_MS = 190;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function effectiveAspect(media: PipMedia): number {
  if (media.kind === "audio") return AUDIO_WIDTH / AUDIO_HEIGHT;
  const rotation = Math.abs((media.rotation ?? 0) % 180);
  const quarterTurn = rotation === 90;
  const width = quarterTurn ? media.height : media.width;
  const height = quarterTurn ? media.width : media.height;
  if (width <= 0 || height <= 0) return 16 / 9;
  return width / height;
}

function createPip() {
  const state = $state({
    active: false,
    transitioning: false,
    controlsVisible: true,
    userSized: false,
  });

  let busy = false;
  let pinned = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPointerActivity = 0;
  let unlistenResize: UnlistenFn | null = null;
  let snapshot: GeometrySnapshot | null = null;
  let applying = false;
  let suppressResizeUntil = 0;
  let lastApplied = "";
  let fitQueue: Promise<void> = Promise.resolve();

  function showControls() {
    state.controlsVisible = true;
    clearTimeout(hideTimer);
    if (pinned) return;
    hideTimer = setTimeout(() => {
      if (!pinned) state.controlsVisible = false;
    }, CONTROL_HIDE_MS);
  }

  function hideControlsSoon(delay = 260) {
    if (pinned) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!pinned) state.controlsVisible = false;
    }, delay);
  }

  function notifyPointerActivity() {
    if (!state.active) return;
    const now = performance.now();
    if (now - lastPointerActivity < 80) return;
    lastPointerActivity = now;
    showControls();
  }

  function setControlsPinned(value: boolean) {
    pinned = value;
    clearTimeout(hideTimer);
    if (pinned) {
      state.controlsVisible = true;
    } else {
      showControls();
    }
  }

  async function targetMonitor(): Promise<Monitor | null> {
    return (await currentMonitor()) ?? (await primaryMonitor());
  }

  async function setPipFlag(active: boolean): Promise<boolean> {
    try {
      await invokeSetPipActive(active);
      return true;
    } catch (e) {
      console.error("Failed to update PiP window-state guard:", e);
      return false;
    }
  }

  type BoundsTarget = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function touchResizeSuppression() {
    suppressResizeUntil = performance.now() + RESIZE_SUPPRESS_MS;
  }

  async function applyBounds(target: BoundsTarget) {
    applying = true;
    touchResizeSuppression();
    try {
      await invokeSetWindowBounds(
        target.x,
        target.y,
        target.width,
        target.height,
      );
    } finally {
      applying = false;
      touchResizeSuppression();
    }
  }

  // Slides the native window between bounds. Only the window moves: the PiP
  // layout is already applied, so the webview renders the media full-bleed and
  // the chrome is out of the tree while the geometry steps.
  async function animateBounds(
    target: BoundsTarget,
    duration = SLIDE_MS,
  ): Promise<void> {
    const win = getCurrentWindow();
    if (appearance.reducedMotion || duration <= 0) {
      await applyBounds(target);
      return;
    }

    const [startPosition, startSize] = await Promise.all([
      win.outerPosition().catch(() => null),
      win.innerSize().catch(() => null),
    ]);
    if (!startPosition || !startSize) {
      await applyBounds(target);
      return;
    }

    const start = performance.now();
    applying = true;
    touchResizeSuppression();

    try {
      await new Promise<void>((resolve) => {
        const step = async () => {
          const t = Math.min(1, (performance.now() - start) / duration);
          const eased = easeOutCubic(t);
          touchResizeSuppression();
          await invokeSetWindowBounds(
            Math.round(startPosition.x + (target.x - startPosition.x) * eased),
            Math.round(startPosition.y + (target.y - startPosition.y) * eased),
            Math.round(
              startSize.width + (target.width - startSize.width) * eased,
            ),
            Math.round(
              startSize.height + (target.height - startSize.height) * eased,
            ),
          ).catch(() => {});
          if (t < 1) {
            requestAnimationFrame(() => void step());
          } else {
            resolve();
          }
        };
        requestAnimationFrame(() => void step());
      });
      // Guarantee the final geometry even if an intermediate frame failed.
      await applyBounds(target);
    } finally {
      applying = false;
      touchResizeSuppression();
    }
  }

  function sizeFor(
    media: PipMedia,
    monitor: Monitor,
  ): { width: number; height: number; scale: number } {
    // Webview zoom changes the CSS viewport independently of DPI, so keep the
    // compact layout at the same apparent size for every interface scale.
    const scale = monitor.scaleFactor * appearance.uiScale;
    const maxWidth = monitor.workArea.size.width / scale;
    const maxHeight = monitor.workArea.size.height / scale;
    const widthLimit = Math.max(MIN_WIDTH, maxWidth * MAX_WIDTH_FRACTION);
    const heightLimit = Math.max(MIN_HEIGHT, maxHeight * MAX_HEIGHT_FRACTION);

    if (media.kind === "audio") {
      return {
        width: Math.min(AUDIO_WIDTH, widthLimit),
        height: Math.min(AUDIO_HEIGHT, heightLimit),
        scale,
      };
    }

    const aspect = clamp(effectiveAspect(media), 0.2, 5);
    let width = Math.min(TARGET_WIDTH, widthLimit);
    let height = width / aspect;

    if (height < MIN_HEIGHT) {
      height = MIN_HEIGHT;
      width = Math.min(height * aspect, widthLimit);
    }
    if (height > heightLimit) {
      height = heightLimit;
      width = height * aspect;
    }

    width = clamp(width, MIN_WIDTH, widthLimit);
    height = clamp(height, MIN_HEIGHT, heightLimit);
    return { width, height, scale };
  }

  async function applyInitialGeometry(media: PipMedia) {
    const monitor = await targetMonitor();
    if (!monitor) {
      const aspect = effectiveAspect(media);
      await getCurrentWindow().setSize(
        new LogicalSize(
          TARGET_WIDTH,
          Math.round(TARGET_WIDTH / (aspect || 16 / 9)),
        ),
      );
      return;
    }
    const { width, height, scale } = sizeFor(media, monitor);
    const physicalWidth = Math.round(width * scale);
    const physicalHeight = Math.round(height * scale);
    const margin = Math.round(MARGIN * scale);
    const work = monitor.workArea;

    const x = clamp(
      work.position.x + work.size.width - physicalWidth - margin,
      work.position.x,
      work.position.x + work.size.width - physicalWidth,
    );
    const y = clamp(
      work.position.y + work.size.height - physicalHeight - margin,
      work.position.y,
      work.position.y + work.size.height - physicalHeight,
    );

    await animateBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: physicalWidth,
      height: physicalHeight,
    });
  }

  async function applyFittedGeometry(media: PipMedia) {
    const monitor = await targetMonitor();
    if (!monitor) return;
    const win = getCurrentWindow();
    const { width, height, scale } = sizeFor(media, monitor);
    const physicalWidth = Math.round(width * scale);
    const physicalHeight = Math.round(height * scale);
    const margin = Math.round(MARGIN * scale);
    const work = monitor.workArea;

    const [position, currentSize] = await Promise.all([
      win.outerPosition().catch(() => null),
      win.innerSize().catch(() => null),
    ]);
    const currentX = position?.x ?? work.position.x;
    const currentY = position?.y ?? work.position.y;
    // Keep the card's bottom-right corner fixed so growing media extends up.
    const anchorRight = currentX + (currentSize?.width ?? physicalWidth);
    const anchorBottom = currentY + (currentSize?.height ?? physicalHeight);
    const desiredX = anchorRight - physicalWidth;
    const desiredY = anchorBottom - physicalHeight;
    const minX = work.position.x + margin;
    const minY = work.position.y + margin;
    const maxX = work.position.x + work.size.width - physicalWidth - margin;
    const maxY = work.position.y + work.size.height - physicalHeight - margin;
    const x =
      maxX >= minX
        ? clamp(desiredX, minX, maxX)
        : clamp(
            desiredX,
            work.position.x,
            work.position.x + work.size.width - physicalWidth,
          );
    const y =
      maxY >= minY
        ? clamp(desiredY, minY, maxY)
        : clamp(
            desiredY,
            work.position.y,
            work.position.y + work.size.height - physicalHeight,
          );

    if (
      physicalWidth === 0 ||
      physicalHeight === 0 ||
      (currentSize &&
        Math.abs(physicalWidth - currentSize.width) < 1 &&
        Math.abs(physicalHeight - currentSize.height) < 1 &&
        Math.abs(x - currentX) < 1 &&
        Math.abs(y - currentY) < 1)
    ) {
      return;
    }

    await animateBounds(
      {
        x: Math.round(x),
        y: Math.round(y),
        width: physicalWidth,
        height: physicalHeight,
      },
      FIT_SLIDE_MS,
    );
  }

  function mediaKey(media: PipMedia): string {
    return `${media.kind}:${Math.round(media.width)}x${Math.round(media.height)}:${media.rotation ?? 0}`;
  }

  async function fitTo(media: PipMedia) {
    if (!state.active || busy || state.userSized) return;
    if (media.kind !== "audio" && (media.width <= 0 || media.height <= 0)) {
      return;
    }
    const key = mediaKey(media);
    if (key === lastApplied) return;
    lastApplied = key;
    const run = async () => {
      if (!state.active || state.userSized || key !== lastApplied) return;
      await applyFittedGeometry(media);
    };
    fitQueue = fitQueue.then(run, run).catch((e) => {
      console.error("Failed to fit PiP window:", e);
    });
    await fitQueue;
  }

  async function startResizeTracking() {
    const win = getCurrentWindow();
    unlistenResize?.();
    unlistenResize = await win.onResized(() => {
      if (!state.active) return;
      if (applying || performance.now() < suppressResizeUntil) return;
      state.userSized = true;
      void win.isMaximized().then((maximized) => {
        if (maximized && state.active) void exit();
      });
    });
  }

  async function restoreSavedGeometry(saved: GeometrySnapshot | null) {
    const win = getCurrentWindow();
    await win.setResizable(true).catch(() => {});
    if (await win.isMaximized().catch(() => false)) {
      await win.unmaximize().catch(() => {});
    }
    if (saved?.size && saved.position) {
      await animateBounds({
        x: saved.position.x,
        y: saved.position.y,
        width: saved.size.width,
        height: saved.size.height,
      });
    } else {
      if (saved?.size) await win.setSize(saved.size).catch(() => {});
      if (saved?.position)
        await win.setPosition(saved.position).catch(() => {});
    }
    await win.setMinSize(CONFIG_MIN_SIZE).catch(() => {});
    await win.setAlwaysOnTop(saved?.wasAlwaysOnTop ?? false).catch(() => {});
    if (saved?.wasMaximized) {
      await win.maximize().catch(() => {});
    }
  }

  async function enter(media: PipMedia): Promise<boolean> {
    if (state.active || busy) return false;
    busy = true;
    const win = getCurrentWindow();
    try {
      const [wasMaximized, wasAlwaysOnTop] = await Promise.all([
        win.isMaximized().catch(() => false),
        win.isAlwaysOnTop().catch(() => false),
      ]);
      snapshot = { position: null, size: null, wasMaximized, wasAlwaysOnTop };

      if (!(await setPipFlag(true))) {
        throw new Error(
          "Could not set the picture-in-picture window-state guard",
        );
      }

      if (!appearance.reducedMotion) state.transitioning = true;

      // Unmaximize first so the saved geometry is the window's real restored
      // bounds, not the maximized bounds. Otherwise a later manual unmaximize
      // would restore the tiny PiP size.
      if (wasMaximized) {
        await win.unmaximize();
      }

      const [position, size] = await Promise.all([
        win.outerPosition().catch(() => null),
        win.innerSize().catch(() => null),
      ]);
      if (!position || !size) {
        throw new Error("Could not read window geometry");
      }
      if (snapshot) {
        snapshot.position = position;
        snapshot.size = size;
      }

      state.active = true;
      state.userSized = false;
      state.controlsVisible = true;
      lastApplied = mediaKey(media);

      await win.setResizable(true);
      await win.setMinSize(
        new LogicalSize(
          MIN_WIDTH * appearance.uiScale,
          MIN_HEIGHT * appearance.uiScale,
        ),
      );
      await win.setAlwaysOnTop(true);
      await applyInitialGeometry(media);
      await startResizeTracking();
      state.transitioning = false;
      showControls();
      return true;
    } catch (e) {
      console.error("Failed to enter PiP:", e);
      state.active = false;
      state.transitioning = false;
      unlistenResize?.();
      unlistenResize = null;
      await restoreSavedGeometry(snapshot).catch(() => {});
      snapshot = null;
      await setPipFlag(false);
      return false;
    } finally {
      busy = false;
    }
  }

  async function exit(): Promise<void> {
    if (!state.active || busy) return;
    busy = true;
    const saved = snapshot;
    unlistenResize?.();
    unlistenResize = null;
    clearTimeout(hideTimer);
    pinned = false;
    state.transitioning = !appearance.reducedMotion;

    try {
      // Restore geometry while the persistence guard is still active so the
      // mini window is never written as the real window state.
      await restoreSavedGeometry(saved);
    } catch (e) {
      console.error("Failed to restore window after PiP:", e);
    } finally {
      snapshot = null;
      state.active = false;
      state.userSized = false;
      lastApplied = "";
      state.transitioning = false;
      await setPipFlag(false);
      busy = false;
    }
  }

  async function toggle(media: PipMedia): Promise<void> {
    if (state.active) {
      await exit();
      return;
    }
    await enter(media);
  }

  return {
    state,
    get busy() {
      return busy;
    },
    enter,
    exit,
    toggle,
    fitTo,
    showControls,
    hideControlsSoon,
    notifyPointerActivity,
    setControlsPinned,
  };
}

export const pip = createPip();
