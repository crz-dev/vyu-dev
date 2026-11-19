import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
  type Monitor,
} from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { invokeSetPipActive } from "$lib/features/system/api";
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
    controlsVisible: true,
    userSized: false,
  });

  let busy = false;
  let pinned = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
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
    if (state.active) showControls();
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
    const win = getCurrentWindow();
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

    applying = true;
    suppressResizeUntil = performance.now() + RESIZE_SUPPRESS_MS;
    try {
      await win.setSize(new PhysicalSize(physicalWidth, physicalHeight));
      await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
    } finally {
      applying = false;
      suppressResizeUntil = performance.now() + RESIZE_SUPPRESS_MS;
    }
  }

  async function applyFittedGeometry(media: PipMedia) {
    const monitor = await targetMonitor();
    if (!monitor) return;
    const win = getCurrentWindow();
    const { width, height, scale } = sizeFor(media, monitor);
    const physicalWidth = Math.round(width * scale);
    const physicalHeight = Math.round(height * scale);
    const work = monitor.workArea;

    const position = await win.outerPosition().catch(() => null);
    const currentX = position?.x ?? work.position.x;
    const currentY = position?.y ?? work.position.y;
    const x = clamp(
      currentX,
      work.position.x,
      work.position.x + work.size.width - physicalWidth,
    );
    const y = clamp(
      currentY,
      work.position.y,
      work.position.y + work.size.height - physicalHeight,
    );

    applying = true;
    suppressResizeUntil = performance.now() + RESIZE_SUPPRESS_MS;
    try {
      await win.setSize(new PhysicalSize(physicalWidth, physicalHeight));
      if (x !== currentX || y !== currentY) {
        await win.setPosition(
          new PhysicalPosition(Math.round(x), Math.round(y)),
        );
      }
    } finally {
      applying = false;
      suppressResizeUntil = performance.now() + RESIZE_SUPPRESS_MS;
    }
  }

  function mediaKey(media: PipMedia): string {
    return `${media.kind}:${Math.round(media.width)}x${Math.round(media.height)}:${media.rotation ?? 0}`;
  }

  async function fitTo(media: PipMedia) {
    if (!state.active || busy || state.userSized) return;
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
    await win.setMinSize(CONFIG_MIN_SIZE).catch(() => {});
    if (await win.isMaximized().catch(() => false)) {
      await win.unmaximize().catch(() => {});
    }
    if (saved?.size) {
      await win.setSize(saved.size).catch(() => {});
    }
    if (saved?.position) {
      await win.setPosition(saved.position).catch(() => {});
    }
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
      showControls();
      return true;
    } catch (e) {
      console.error("Failed to enter PiP:", e);
      state.active = false;
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
