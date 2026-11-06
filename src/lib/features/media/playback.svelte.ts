import { VOLUME_SEGMENTS } from "$lib/shared/constants";

const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 2, 3];

export function nearestSpeedStepIndex(speed: number): number {
  return SPEED_STEPS.reduce(
    (nearestIndex, step, index) =>
      Math.abs(step - speed) < Math.abs(SPEED_STEPS[nearestIndex] - speed)
        ? index
        : nearestIndex,
    0,
  );
}

export function volumeToActual(v: number): number {
  return 0.75 * Math.pow(v, 1.5);
}

export function createPlaybackActions(
  mediaElRef: () => HTMLMediaElement | null,
) {
  function togglePlay() {
    const mediaEl = mediaElRef();
    if (!mediaEl) return;

    if (mediaEl.paused) {
      mediaEl.play().catch(() => {});
    } else {
      mediaEl.pause();
    }
  }

  function toggleMute(set: (muted: boolean) => void, currentMuted: boolean) {
    const mediaEl = mediaElRef();
    if (!mediaEl) return;

    const next = !currentMuted;
    mediaEl.muted = next;
    set(next);
  }

  function setVolume(
    val: number,
    set: (data: { volume: number; muted: boolean }) => void,
  ) {
    const mediaEl = mediaElRef();
    const volume = Math.max(0, Math.min(1, val));

    if (mediaEl) {
      mediaEl.volume = volumeToActual(volume);
    }

    set({
      volume,
      muted: volume === 0,
    });
  }

  return {
    togglePlay,
    toggleMute,
    setVolume,
  };
}

function applyVolume(el: HTMLMediaElement, vol: number) {
  el.volume = volumeToActual(Math.max(0, Math.min(1, vol)));
}

export type PlaybackUIStore = ReturnType<typeof createPlaybackUI>;

export function createPlaybackUI(
  mediaElRef: () => HTMLMediaElement | null,
  getVolume: () => number,
  setVolume: (v: number) => void,
  onSpeedChange?: (speed: number) => void,
  initialSpeed = 1,
) {
  function setVolumeOnMedia(val: number) {
    const mediaEl = mediaElRef();
    if (mediaEl) applyVolume(mediaEl, val);
    setVolume(val);
  }
  let volumeHovered = $state(false);
  let speedHovered = $state(false);
  let playbackSpeed = $state(initialSpeed);

  let volumeTooltipX = $state(0);
  let volumeTooltipY = $state(0);
  let volumeTooltipVisible = $state(false);
  let volumeTooltipVertical = $state(false);

  let speedTooltipX = $state(0);
  let speedTooltipY = $state(0);
  let speedTooltipVisible = $state(false);
  let speedTooltipVertical = $state(false);

  let volumeSliderMode = $state(false);
  let speedSliderMode = $state(false);
  let volumeSliderValue = $state(1);
  let speedSliderValue = $state(0.5);

  let volumeDragging = $state(false);
  let speedDragging = $state(false);

  function speedToSliderVal(speed: number): number {
    if (speed <= 1) return 0.5 * ((speed - 0.1) / 0.9);
    return 0.5 + 0.5 * ((speed - 1) / 2);
  }

  function sliderValToSpeed(val: number): number {
    if (val <= 0.5) return 0.1 + 0.9 * (val / 0.5);
    return 1 + 2 * ((val - 0.5) / 0.5);
  }

  function showVolumeOverlay() {
    volumeHovered = true;
  }

  function handleVolumeAreaLeave() {
    if (volumeDragging) return;
    volumeTooltipVisible = false;
    volumeHovered = false;
  }

  function handleVolumeDiamondHover(e: MouseEvent, vertical = false) {
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const diamonds = container.querySelectorAll(".volume-diamond");
    if (diamonds.length === 0) return;
    const selectedIndex = Math.max(
      0,
      Math.min(
        diamonds.length - 1,
        Math.round(getVolume() * diamonds.length) - 1,
      ),
    );
    const selected = diamonds[selectedIndex].getBoundingClientRect();
    if (vertical) {
      volumeTooltipY = selected.top + selected.height / 2;
      volumeTooltipX = containerRect.right;
    } else {
      volumeTooltipX = selected.left + selected.width / 2;
      volumeTooltipY = containerRect.top;
    }
    volumeTooltipVisible = true;
  }

  let activeWindowListeners: Array<{
    type: string;
    handler: EventListenerOrEventListenerObject;
  }> | null = null;

  function cleanupWindowListeners() {
    if (activeWindowListeners) {
      for (const { type, handler } of activeWindowListeners) {
        window.removeEventListener(type, handler);
      }
      activeWindowListeners = null;
    }
  }

  function startVolumeDrag(e: MouseEvent, vertical = false) {
    if (e.button !== 0) return;
    e.preventDefault();
    cleanupWindowListeners();
    volumeDragging = true;
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const diamonds = container.querySelectorAll(".volume-diamond");
    if (diamonds.length === 0) return;

    const firstRect = diamonds[0].getBoundingClientRect();
    const lastRect = diamonds[diamonds.length - 1].getBoundingClientRect();
    let frameId: number | null = null;
    let pendingX = e.clientX;
    let pendingY = e.clientY;

    function dragTo(clientX: number, clientY: number) {
      const ratio = vertical
        ? Math.max(
            0,
            Math.min(
              1,
              (firstRect.bottom - clientY) / (firstRect.bottom - lastRect.top),
            ),
          )
        : Math.max(
            0,
            Math.min(
              1,
              (clientX - firstRect.left) / (lastRect.right - firstRect.left),
            ),
          );
      setVolumeOnMedia(Math.ceil(ratio * VOLUME_SEGMENTS) / VOLUME_SEGMENTS);
      const selectedIndex = Math.max(
        0,
        Math.min(
          diamonds.length - 1,
          Math.round(getVolume() * diamonds.length) - 1,
        ),
      );
      const selected = diamonds[selectedIndex].getBoundingClientRect();
      if (vertical) {
        volumeTooltipY = selected.top + selected.height / 2;
        volumeTooltipX = containerRect.right;
      } else {
        volumeTooltipX = selected.left + selected.width / 2;
        volumeTooltipY = containerRect.top;
      }
      volumeTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      pendingX = ev.clientX;
      pendingY = ev.clientY;
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        dragTo(pendingX, pendingY);
      });
    }
    function onMouseUp(ev: MouseEvent) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      dragTo(ev.clientX, ev.clientY);
      cleanupWindowListeners();
      volumeDragging = false;
      volumeTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    activeWindowListeners = [
      { type: "mousemove", handler: onMouseMove as EventListener },
      { type: "mouseup", handler: onMouseUp as EventListener },
    ];
  }

  function handleVolumeScroll(e: WheelEvent) {
    e.preventDefault();
    setVolumeOnMedia(getVolume() + (e.deltaY > 0 ? -0.125 : 0.125));
  }

  function setPlaybackSpeed(val: number) {
    playbackSpeed = val;
    speedSliderValue = speedToSliderVal(val);
    const mediaEl = mediaElRef();
    if (mediaEl) mediaEl.playbackRate = val;
    onSpeedChange?.(val);
  }

  function setPlaybackRateDirect(val: number) {
    const mediaEl = mediaElRef();
    if (mediaEl) mediaEl.playbackRate = val;
  }

  function showSpeedOverlay() {
    speedHovered = true;
  }

  function handleSpeedAreaLeave() {
    if (speedDragging) return;
    speedTooltipVisible = false;
    speedHovered = false;
  }

  function handleSpeedDiamondHover(e: MouseEvent, vertical = false) {
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const diamonds = container.querySelectorAll(".speed-diamond");
    if (diamonds.length === 0) return;
    const selected =
      diamonds[nearestSpeedStepIndex(playbackSpeed)].getBoundingClientRect();
    if (vertical) {
      speedTooltipY = selected.top + selected.height / 2;
      speedTooltipX = containerRect.right;
    } else {
      speedTooltipX = selected.left + selected.width / 2;
      speedTooltipY = containerRect.top;
    }
    speedTooltipVisible = true;
  }

  function startSpeedDrag(e: MouseEvent, vertical = false) {
    if (e.button !== 0) return;
    e.preventDefault();
    cleanupWindowListeners();
    speedDragging = true;
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const diamonds = container.querySelectorAll(".speed-diamond");
    if (diamonds.length === 0) return;

    const firstRect = diamonds[0].getBoundingClientRect();
    const lastRect = diamonds[diamonds.length - 1].getBoundingClientRect();
    let frameId: number | null = null;
    let pendingX = e.clientX;
    let pendingY = e.clientY;

    function dragTo(clientX: number, clientY: number) {
      const steps = SPEED_STEPS;
      const ratio = vertical
        ? Math.max(
            0,
            Math.min(
              1,
              (firstRect.bottom - clientY) / (firstRect.bottom - lastRect.top),
            ),
          )
        : Math.max(
            0,
            Math.min(
              1,
              (clientX - firstRect.left) / (lastRect.right - firstRect.left),
            ),
          );
      const idx = Math.round(ratio * (steps.length - 1));
      setPlaybackSpeed(steps[idx]);
      const selected = diamonds[idx].getBoundingClientRect();
      if (vertical) {
        speedTooltipY = selected.top + selected.height / 2;
        speedTooltipX = containerRect.right;
      } else {
        speedTooltipX = selected.left + selected.width / 2;
        speedTooltipY = containerRect.top;
      }
      speedTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      pendingX = ev.clientX;
      pendingY = ev.clientY;
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        dragTo(pendingX, pendingY);
      });
    }

    function onMouseUp(ev: MouseEvent) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      dragTo(ev.clientX, ev.clientY);
      cleanupWindowListeners();
      speedDragging = false;
      speedTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    activeWindowListeners = [
      { type: "mousemove", handler: onMouseMove as EventListener },
      { type: "mouseup", handler: onMouseUp as EventListener },
    ];
  }

  function handleSpeedScroll(e: WheelEvent) {
    e.preventDefault();
    const steps = SPEED_STEPS;
    const idx = nearestSpeedStepIndex(playbackSpeed);
    const next =
      e.deltaY > 0 ? Math.max(0, idx - 1) : Math.min(steps.length - 1, idx + 1);
    setPlaybackSpeed(steps[next]);
  }

  function toggleVolumeSliderMode() {
    volumeTooltipVisible = false;
    volumeSliderMode = !volumeSliderMode;
    if (volumeSliderMode) {
      volumeSliderValue = getVolume();
    }
  }

  function toggleSpeedSliderMode() {
    speedTooltipVisible = false;
    speedSliderMode = !speedSliderMode;
    if (speedSliderMode) {
      speedSliderValue = speedToSliderVal(playbackSpeed);
    }
  }

  function handleVolumeSliderChange(val: number) {
    volumeSliderValue = val;
    setVolumeOnMedia(val);
  }

  function handleSpeedSliderChange(val: number) {
    speedSliderValue = val;
    const speed = Math.round(sliderValToSpeed(val) * 100) / 100;
    playbackSpeed = speed;
    const mediaEl = mediaElRef();
    if (mediaEl) mediaEl.playbackRate = speed;
  }

  function showVolumeSliderTooltip(
    trackEl: HTMLDivElement | null,
    vertical = false,
  ) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    if (vertical) {
      volumeTooltipVertical = true;
      volumeTooltipX = rect.right + 8;
      volumeTooltipY = rect.bottom - volumeSliderValue * rect.height + 22;
    } else {
      volumeTooltipVertical = false;
      volumeTooltipX = rect.left + volumeSliderValue * rect.width;
      volumeTooltipY = rect.top;
    }
    volumeTooltipVisible = true;
  }
  function hideVolumeSliderTooltip() {
    volumeTooltipVisible = false;
  }
  function showSpeedSliderTooltip(
    trackEl: HTMLDivElement | null,
    vertical = false,
  ) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    if (vertical) {
      speedTooltipVertical = true;
      speedTooltipX = rect.right + 8;
      speedTooltipY = rect.bottom - speedSliderValue * rect.height + 22;
    } else {
      speedTooltipVertical = false;
      speedTooltipX = rect.left + speedSliderValue * rect.width;
      speedTooltipY = rect.top;
    }
    speedTooltipVisible = true;
  }
  function hideSpeedSliderTooltip() {
    speedTooltipVisible = false;
  }

  function initSliderMode(volume: boolean, speed: boolean) {
    volumeSliderMode = volume;
    speedSliderMode = speed;
    if (volume) {
      volumeSliderValue = getVolume();
    }
    if (speed) {
      speedSliderValue = speedToSliderVal(playbackSpeed);
    }
  }

  function startVolumeSliderDrag(
    e: PointerEvent,
    track: HTMLDivElement,
    vertical = false,
  ) {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    volumeDragging = true;
    let frameId: number | null = null;
    let pendingX = e.clientX;
    let pendingY = e.clientY;

    volumeTooltipVisible = true;

    function update(clientX: number, clientY: number) {
      const rect = track.getBoundingClientRect();
      let pct: number;
      if (vertical) {
        volumeTooltipVertical = true;
        pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
        volumeTooltipX = rect.right + 8;
        volumeTooltipY = rect.bottom - pct * rect.height + 22;
      } else {
        volumeTooltipVertical = false;
        pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        volumeTooltipX = rect.left + pct * rect.width;
        volumeTooltipY = rect.top;
      }
      handleVolumeSliderChange(pct);
    }

    update(e.clientX, e.clientY);

    function onMove(ev: PointerEvent) {
      pendingX = ev.clientX;
      pendingY = ev.clientY;
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        update(pendingX, pendingY);
      });
    }
    function onUp(ev: PointerEvent) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      update(ev.clientX, ev.clientY);
      track.releasePointerCapture(ev.pointerId);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      volumeDragging = false;
      volumeTooltipVisible = false;
    }

    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
  }

  function startSpeedSliderDrag(
    e: PointerEvent,
    track: HTMLDivElement,
    vertical = false,
  ) {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    speedDragging = true;
    let frameId: number | null = null;
    let pendingX = e.clientX;
    let pendingY = e.clientY;

    speedTooltipVisible = true;

    function update(clientX: number, clientY: number) {
      const rect = track.getBoundingClientRect();
      let pct: number;
      if (vertical) {
        speedTooltipVertical = true;
        pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
        speedTooltipX = rect.right + 8;
        speedTooltipY = rect.bottom - pct * rect.height + 22;
      } else {
        speedTooltipVertical = false;
        pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        speedTooltipX = rect.left + pct * rect.width;
        speedTooltipY = rect.top;
      }
      handleSpeedSliderChange(pct);
    }

    update(e.clientX, e.clientY);

    function onMove(ev: PointerEvent) {
      pendingX = ev.clientX;
      pendingY = ev.clientY;
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        update(pendingX, pendingY);
      });
    }
    function onUp(ev: PointerEvent) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      update(ev.clientX, ev.clientY);
      track.releasePointerCapture(ev.pointerId);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      speedDragging = false;
      speedTooltipVisible = false;
    }

    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
  }

  return {
    get volumeHovered() {
      return volumeHovered;
    },
    get speedHovered() {
      return speedHovered;
    },
    get playbackSpeed() {
      return playbackSpeed;
    },
    get volumeTooltipX() {
      return volumeTooltipX;
    },
    get volumeTooltipY() {
      return volumeTooltipY;
    },
    get volumeTooltipVisible() {
      return volumeTooltipVisible;
    },
    get volumeTooltipVertical() {
      return volumeTooltipVertical;
    },
    get speedTooltipX() {
      return speedTooltipX;
    },
    get speedTooltipY() {
      return speedTooltipY;
    },
    get speedTooltipVisible() {
      return speedTooltipVisible;
    },
    get speedTooltipVertical() {
      return speedTooltipVertical;
    },
    get volumeSliderMode() {
      return volumeSliderMode;
    },
    get speedSliderMode() {
      return speedSliderMode;
    },
    get volumeSliderValue() {
      return volumeSliderValue;
    },
    get speedSliderValue() {
      return speedSliderValue;
    },
    get volumeDragging() {
      return volumeDragging;
    },
    get speedDragging() {
      return speedDragging;
    },
    showVolumeOverlay,
    handleVolumeAreaLeave,
    handleVolumeDiamondHover,
    startVolumeDrag,
    handleVolumeScroll,
    setPlaybackSpeed,
    setPlaybackRateDirect,
    showSpeedOverlay,
    handleSpeedAreaLeave,
    handleSpeedDiamondHover,
    startSpeedDrag,
    handleSpeedScroll,
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
    startVolumeSliderDrag,
    startSpeedSliderDrag,
    handleVolumeSliderChange,
    handleSpeedSliderChange,
    speedToSliderVal,
    initSliderMode,
    showVolumeSliderTooltip,
    hideVolumeSliderTooltip,
    showSpeedSliderTooltip,
    hideSpeedSliderTooltip,
    cleanupWindowListeners,
  };
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
