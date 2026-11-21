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
  invokeAnimateWindowBounds,
  invokeSetPipActive,
  invokeSetPipBackground,
  invokeSetWindowBounds,
} from "$lib/features/system/api";
import { appearance } from "$lib/features/theme/appearance.svelte";

export type PipMediaKind = "image" | "video" | "audio" | "pdf";

/// Mirrors the phase classes consumed by `main` and `PipOverlay`.
/// entering: app chrome fades out, layout still normal.
/// moving: PiP layout applied, media lifted, native window geometry animating.
/// settling: window landed, PiP chrome fades in.
/// exiting: PiP chrome fades out, window returns home at card size.
/// returning: media anchored at its final viewer rect while the window grows
///            back around it (PiP layout, app background).
/// expanding: fallback only — app layout restored at full size with a small
///            flip correction.
/// revealing: window landed, app chrome fades in around the settled media.
export type PipPhase =
  | "idle"
  | "entering"
  | "moving"
  | "settling"
  | "exiting"
  | "returning"
  | "expanding"
  | "revealing";

export interface PipMedia {
  kind: PipMediaKind;
  width: number;
  height: number;
  rotation?: number;
}

/// On-screen media rect (CSS px, viewport-relative) captured before PiP. Used
/// to return the card to the exact spot the media will occupy in the viewer.
export interface PipMediaRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
// Keep these durations in sync with the matching values in pip.css.
const CHROME_FADE_MS = 80;
const ENTER_MOVE_MS = 300;
const SETTLE_MS = 170;
const SETTLE_LEAD_MS = 70;
const EXIT_FADE_MS = 70;
const EXIT_RETURN_MS = 240;
export const PIP_EXPAND_MS = 190;
const EXIT_REVEAL_MS = 130;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    phase: "idle" as PipPhase,
    controlsVisible: true,
    userSized: false,
    sizeLocked: false,
    menuOpen: false,
    menuX: 0,
    menuY: 0,
  });

  let busy = false;
  let pinned = false;
  let lastMedia: PipMedia | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPointerActivity = 0;
  let unlistenResize: UnlistenFn | null = null;
  let snapshot: GeometrySnapshot | null = null;
  let applying = false;
  let suppressResizeUntil = 0;
  let lastApplied = "";
  let fitQueue: Promise<void> = Promise.resolve();
  let mediaRect: PipMediaRect | null = null;
  let enteredKey = "";

  function setMediaRect(rect: PipMediaRect | null) {
    mediaRect = rect;
  }

  function getMediaRect(): PipMediaRect | null {
    return mediaRect;
  }

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

  function openMenu(x: number, y: number) {
    state.menuX = x;
    state.menuY = y;
    state.menuOpen = true;
  }

  function closeMenu() {
    if (state.menuOpen) state.menuOpen = false;
  }

  async function toggleSizeLock(): Promise<void> {
    if (!state.active || busy) return;
    state.sizeLocked = !state.sizeLocked;
    if (state.sizeLocked || !lastMedia) return;
    state.userSized = false;
    lastApplied = "";
    await fitTo(lastMedia, true);
  }

  type BoundsTarget = {
    x: number;
    y: number;
    width: number;
    height: number;
  };

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

  // Slides the native window between bounds. The animation runs in Rust so the
  // frame pacing is not limited by one IPC round trip per frame. Only the
  // window moves: the PiP layout is already applied, so the webview renders the
  // media full-bleed and the chrome is out of the tree while the geometry steps.
  async function animateBounds(
    target: BoundsTarget,
    duration = SLIDE_MS,
  ): Promise<void> {
    if (appearance.reducedMotion || duration <= 0) {
      await applyBounds(target);
      return;
    }

    applying = true;
    touchResizeSuppression();
    try {
      await invokeAnimateWindowBounds(
        target.x,
        target.y,
        target.width,
        target.height,
        duration,
      );
    } catch {
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

  async function computePipTarget(
    media: PipMedia,
  ): Promise<BoundsTarget | null> {
    const monitor = await targetMonitor();
    if (!monitor) return null;
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

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: physicalWidth,
      height: physicalHeight,
    };
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

  async function fitTo(media: PipMedia, force = false) {
    lastMedia = media;
    if (!state.active) return;
    if (!force && (state.userSized || state.sizeLocked)) return;
    if (media.kind !== "audio" && (media.width <= 0 || media.height <= 0)) {
      return;
    }
    const key = mediaKey(media);
    if (key === lastApplied) return;
    lastApplied = key;
    const run = async () => {
      // Never fight the entry/exit animation; refit once the window has landed.
      // The attempt cap is a safety net so a stuck transition cannot leave a
      // polling timer running.
      let attempts = 0;
      while (
        (busy || state.phase === "entering" || state.phase === "moving") &&
        attempts++ < 75
      ) {
        if (!state.active || key !== lastApplied) return;
        await wait(40);
      }
      if (!state.active || key !== lastApplied) return;
      if (!force && (state.userSized || state.sizeLocked)) return;
      await applyFittedGeometry(media);
    };
    fitQueue = fitQueue.then(run, run).catch((e) => {
      console.error("Failed to fit PiP window:", e);
    });
    await fitQueue;
  }

  async function resetSize(): Promise<void> {
    if (!state.active || busy || !lastMedia) return;
    state.userSized = false;
    lastApplied = "";
    await fitTo(lastMedia, true);
  }

  async function snapToNextCorner(): Promise<void> {
    if (!state.active || busy) return;
    await fitQueue;
    const monitor = await targetMonitor();
    if (!monitor) return;
    const win = getCurrentWindow();
    const [position, size] = await Promise.all([
      win.outerPosition().catch(() => null),
      win.innerSize().catch(() => null),
    ]);
    if (!position || !size) return;

    const scale = monitor.scaleFactor * appearance.uiScale;
    const margin = Math.round(MARGIN * scale);
    const work = monitor.workArea;
    const minX = work.position.x + margin;
    const minY = work.position.y + margin;
    const maxX = work.position.x + work.size.width - size.width - margin;
    const maxY = work.position.y + work.size.height - size.height - margin;
    const left = maxX >= minX ? minX : work.position.x;
    const right =
      maxX >= minX ? maxX : work.position.x + work.size.width - size.width;
    const top = maxY >= minY ? minY : work.position.y;
    const bottom =
      maxY >= minY ? maxY : work.position.y + work.size.height - size.height;

    const corners = [
      { x: right, y: bottom },
      { x: left, y: bottom },
      { x: left, y: top },
      { x: right, y: top },
    ];
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    corners.forEach((corner, index) => {
      const dx = position.x - corner.x;
      const dy = position.y - corner.y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    const target = corners[(nearest + 1) % corners.length];
    await animateBounds({
      x: Math.round(target.x),
      y: Math.round(target.y),
      width: size.width,
      height: size.height,
    });
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

  async function restoreSavedGeometry(
    saved: GeometrySnapshot | null,
    phased = false,
  ) {
    const win = getCurrentWindow();
    await win.setResizable(true).catch(() => {});
    if (await win.isMaximized().catch(() => false)) {
      await win.unmaximize().catch(() => {});
    }
    if (saved?.size && saved.position) {
      const savedBounds: BoundsTarget = {
        x: saved.position.x,
        y: saved.position.y,
        width: saved.size.width,
        height: saved.size.height,
      };
      const sourceRect =
        phased &&
        mediaRect &&
        mediaRect.width >= 180 &&
        mediaRect.height >= 220 &&
        lastMedia &&
        mediaKey(lastMedia) === enteredKey
          ? mediaRect
          : null;

      if (sourceRect) {
        const monitor = await targetMonitor();
        const scale = (monitor?.scaleFactor ?? 1) * appearance.uiScale;
        const mediaWidth = Math.max(1, Math.round(sourceRect.width * scale));
        const mediaHeight = Math.max(1, Math.round(sourceRect.height * scale));
        // Unfold from the saved window corner nearest the PiP card: return the
        // card to that corner at the media size, then grow toward the opposite
        // corner. The media slides from that corner into its viewer rect.
        const [cardPosition, cardSize] = await Promise.all([
          win.outerPosition().catch(() => null),
          win.innerSize().catch(() => null),
        ]);
        const cardX =
          (cardPosition?.x ?? saved.position.x) + (cardSize?.width ?? 0) / 2;
        const cardY =
          (cardPosition?.y ?? saved.position.y) + (cardSize?.height ?? 0) / 2;
        const anchorRight = cardX > saved.position.x + saved.size.width / 2;
        const anchorBottom = cardY > saved.position.y + saved.size.height / 2;
        const anchorX = Math.max(
          saved.position.x,
          anchorRight
            ? saved.position.x + saved.size.width - mediaWidth
            : saved.position.x,
        );
        const anchorY = Math.max(
          saved.position.y,
          anchorBottom
            ? saved.position.y + saved.size.height - mediaHeight
            : saved.position.y,
        );
        await animateBounds(
          { x: anchorX, y: anchorY, width: mediaWidth, height: mediaHeight },
          EXIT_RETURN_MS,
        );
        state.phase = "returning";
        await wait(0);
        await animateBounds(savedBounds, PIP_EXPAND_MS);
      } else if (phased) {
        // No usable media rect: grow first, then cross back to the app layout
        // at full size where the flip is a small, stable correction.
        await animateBounds(savedBounds, PIP_EXPAND_MS);
        state.phase = "expanding";
        await wait(0);
        await wait(PIP_EXPAND_MS);
      } else {
        await animateBounds(savedBounds, SLIDE_MS);
      }
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

  async function enter(
    media: PipMedia,
    onHandoff?: () => void,
  ): Promise<boolean> {
    if (state.active || busy) return false;
    busy = true;
    closeMenu();
    lastMedia = media;
    enteredKey = mediaKey(media);
    const win = getCurrentWindow();
    const animated = !appearance.reducedMotion;
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
      await invokeSetPipBackground(true).catch(() => {});

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

      state.phase = animated ? "entering" : "idle";
      state.active = true;
      state.userSized = false;
      state.sizeLocked = false;
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

      // Let the app chrome fade out before the PiP layout replaces it. The
      // zoom reset happens at the same instant so its snap is hidden by the
      // media lift.
      if (animated) await wait(CHROME_FADE_MS);
      onHandoff?.();
      if (animated) state.phase = "moving";

      const target = await computePipTarget(media);
      if (!target) {
        const aspect = effectiveAspect(media);
        await win.setSize(
          new LogicalSize(
            TARGET_WIDTH,
            Math.round(TARGET_WIDTH / (aspect || 16 / 9)),
          ),
        );
        if (animated) {
          state.phase = "settling";
          await wait(SETTLE_MS);
        }
      } else if (animated) {
        // Shrink and travel in one motion so the window reads as transforming
        // into the card on its way to the corner instead of going in two beats.
        const move = animateBounds(target, ENTER_MOVE_MS);
        // Start the chrome fade-in just before the move lands so the controls
        // settle with the motion instead of popping in afterwards.
        await wait(Math.max(0, ENTER_MOVE_MS - SETTLE_LEAD_MS));
        state.phase = "settling";
        await move;
        await wait(Math.max(0, SETTLE_MS - SETTLE_LEAD_MS));
      } else {
        await applyBounds(target);
      }

      state.phase = "idle";
      await startResizeTracking();
      showControls();
      return true;
    } catch (e) {
      console.error("Failed to enter PiP:", e);
      state.active = false;
      state.phase = "idle";
      unlistenResize?.();
      unlistenResize = null;
      await restoreSavedGeometry(snapshot).catch(() => {});
      snapshot = null;
      await invokeSetPipBackground(false).catch(() => {});
      await setPipFlag(false);
      return false;
    } finally {
      busy = false;
    }
  }

  async function exit(): Promise<void> {
    if (!state.active || busy) return;
    busy = true;
    closeMenu();
    const saved = snapshot;
    unlistenResize?.();
    unlistenResize = null;
    clearTimeout(hideTimer);
    pinned = false;
    const animated = !appearance.reducedMotion;
    if (animated) state.phase = "exiting";

    try {
      if (animated) await wait(EXIT_FADE_MS);
      // Restore geometry while the persistence guard is still active so the
      // mini window is never written as the real window state.
      await restoreSavedGeometry(saved, animated);
    } catch (e) {
      console.error("Failed to restore window after PiP:", e);
    } finally {
      snapshot = null;
      if (animated) state.phase = "revealing";
      state.active = false;
      state.userSized = false;
      state.sizeLocked = false;
      lastApplied = "";
      if (animated) await wait(EXIT_REVEAL_MS);
      state.phase = "idle";
      mediaRect = null;
      await invokeSetPipBackground(false).catch(() => {});
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
    resetSize,
    setMediaRect,
    getMediaRect,
    snapToNextCorner,
    toggleSizeLock,
    openMenu,
    closeMenu,
    showControls,
    hideControlsSoon,
    notifyPointerActivity,
    setControlsPinned,
  };
}

export const pip = createPip();
