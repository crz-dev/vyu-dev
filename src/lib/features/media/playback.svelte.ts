import { VOLUME_SEGMENTS } from "$lib/shared/constants";

const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 2, 3];

export function createPlaybackActions(
  mediaElRef: () => HTMLMediaElement | null,
) {
  function togglePlay() {
    const mediaEl = mediaElRef();
    if (!mediaEl) return;

    mediaEl.paused ? mediaEl.play() : mediaEl.pause();
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
      mediaEl.volume = volume;
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
  el.volume = Math.max(0, Math.min(1, vol));
}

export type PlaybackUIStore = ReturnType<typeof createPlaybackUI>;

export function createPlaybackUI(
  mediaElRef: () => HTMLMediaElement | null,
  getVolume: () => number,
  setVolume: (v: number) => void,
) {
  function setVolumeOnMedia(val: number) {
    const mediaEl = mediaElRef();
    if (mediaEl) applyVolume(mediaEl, val);
    setVolume(val);
  }
  let volumeHovered = $state(false);
  let speedHovered = $state(false);
  let playbackSpeed = $state(1);

  let volumeTooltipX = $state(0);
  let volumeTooltipY = $state(0);
  let volumeTooltipVisible = $state(false);

  let speedTooltipX = $state(0);
  let speedTooltipY = $state(0);
  let speedTooltipVisible = $state(false);

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
    const first = diamonds[0].getBoundingClientRect();
    const last = diamonds[diamonds.length - 1].getBoundingClientRect();
    const ratio = getVolume();
    if (vertical) {
      volumeTooltipY =
        first.top +
        first.height / 2 +
        ratio * (last.top + last.height / 2 - first.top - first.height / 2);
      volumeTooltipX = containerRect.right;
    } else {
      volumeTooltipX =
        first.left +
        first.width / 2 +
        ratio * (last.left + last.width / 2 - first.left - first.width / 2);
      volumeTooltipY = containerRect.top;
    }
    volumeTooltipVisible = true;
  }

  function startVolumeDrag(e: MouseEvent, vertical = false) {
    if (e.button !== 0) return;
    e.preventDefault();
    volumeDragging = true;
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const diamonds = container.querySelectorAll(".volume-diamond");
    if (diamonds.length === 0) return;

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      let ratio: number;
      if (vertical) {
        const firstCenter = first.top + first.height / 2;
        const lastCenter = last.top + last.height / 2;
        ratio = Math.max(
          0,
          Math.min(1, (clientY - first.top) / (last.bottom - first.top)),
        );
        setVolumeOnMedia(Math.ceil(ratio * VOLUME_SEGMENTS) / VOLUME_SEGMENTS);
        const valRatio = getVolume();
        volumeTooltipY = firstCenter + valRatio * (lastCenter - firstCenter);
        volumeTooltipX = containerRect.right;
      } else {
        const firstCenter = first.left + first.width / 2;
        const lastCenter = last.left + last.width / 2;
        ratio = Math.max(
          0,
          Math.min(1, (clientX - first.left) / (last.right - first.left)),
        );
        setVolumeOnMedia(Math.ceil(ratio * VOLUME_SEGMENTS) / VOLUME_SEGMENTS);
        const valRatio = getVolume();
        volumeTooltipX = firstCenter + valRatio * (lastCenter - firstCenter);
        volumeTooltipY = containerRect.top;
      }
      volumeTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      dragTo(ev.clientX, ev.clientY);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      volumeDragging = false;
      volumeTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
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
    const first = diamonds[0].getBoundingClientRect();
    const last = diamonds[diamonds.length - 1].getBoundingClientRect();
    const steps = SPEED_STEPS;
    const idx = steps.indexOf(playbackSpeed);
    const ratio = idx / (steps.length - 1);
    if (vertical) {
      speedTooltipY =
        first.top +
        first.height / 2 +
        ratio * (last.top + last.height / 2 - first.top - first.height / 2);
      speedTooltipX = containerRect.right;
    } else {
      speedTooltipX =
        first.left +
        first.width / 2 +
        ratio * (last.left + last.width / 2 - first.left - first.width / 2);
      speedTooltipY = containerRect.top;
    }
    speedTooltipVisible = true;
  }

  function startSpeedDrag(e: MouseEvent, vertical = false) {
    if (e.button !== 0) return;
    e.preventDefault();
    speedDragging = true;
    const container = e.currentTarget as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const diamonds = container.querySelectorAll(".speed-diamond");
    if (diamonds.length === 0) return;

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      const steps = SPEED_STEPS;
      let ratio: number;
      if (vertical) {
        const firstCenter = first.top + first.height / 2;
        const lastCenter = last.top + last.height / 2;
        ratio = Math.max(
          0,
          Math.min(1, (clientY - first.top) / (last.bottom - first.top)),
        );
        const idx = Math.round(ratio * (steps.length - 1));
        setPlaybackSpeed(steps[idx]);
        const currentIdx = steps.indexOf(playbackSpeed);
        const valRatio = currentIdx / (steps.length - 1);
        speedTooltipY = firstCenter + valRatio * (lastCenter - firstCenter);
        speedTooltipX = containerRect.right;
      } else {
        const firstCenter = first.left + first.width / 2;
        const lastCenter = last.left + last.width / 2;
        ratio = Math.max(
          0,
          Math.min(1, (clientX - first.left) / (last.right - first.left)),
        );
        const idx = Math.round(ratio * (steps.length - 1));
        setPlaybackSpeed(steps[idx]);
        const currentIdx = steps.indexOf(playbackSpeed);
        const valRatio = currentIdx / (steps.length - 1);
        speedTooltipX = firstCenter + valRatio * (lastCenter - firstCenter);
        speedTooltipY = containerRect.top;
      }
      speedTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      dragTo(ev.clientX, ev.clientY);
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      speedDragging = false;
      speedTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleSpeedScroll(e: WheelEvent) {
    e.preventDefault();
    const steps = SPEED_STEPS;
    const cur = steps.reduce((a, b) =>
      Math.abs(b - playbackSpeed) < Math.abs(a - playbackSpeed) ? b : a,
    );
    const idx = steps.indexOf(cur);
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

  // Continuous slider tooltip helpers

  function showVolumeSliderTooltip(
    trackEl: HTMLDivElement | null,
    vertical = false,
  ) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    if (vertical) {
      volumeTooltipX = rect.right + 8;
      volumeTooltipY = rect.bottom - volumeSliderValue * rect.height + 22;
    } else {
      volumeTooltipX = rect.left + volumeSliderValue * rect.width + 7;
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
      speedTooltipX = rect.right + 8;
      speedTooltipY = rect.bottom - speedSliderValue * rect.height + 22;
    } else {
      speedTooltipX = rect.left + speedSliderValue * rect.width + 7;
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
  }

  function startVolumeSliderDrag(
    e: PointerEvent,
    track: HTMLDivElement,
    vertical = false,
  ) {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    volumeDragging = true;

    volumeTooltipVisible = true;

    function update(clientX: number, clientY: number) {
      const rect = track.getBoundingClientRect();
      let pct: number;
      if (vertical) {
        pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
        volumeTooltipX = rect.right + 8;
        volumeTooltipY = rect.bottom - volumeSliderValue * rect.height + 22;
      } else {
        pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        volumeTooltipX = rect.left + volumeSliderValue * rect.width + 7;
        volumeTooltipY = rect.top;
      }
      handleVolumeSliderChange(pct);
    }

    update(e.clientX, e.clientY);

    function onMove(ev: PointerEvent) {
      update(ev.clientX, ev.clientY);
    }
    function onUp(ev: PointerEvent) {
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

    speedTooltipVisible = true;

    function update(clientX: number, clientY: number) {
      const rect = track.getBoundingClientRect();
      let pct: number;
      if (vertical) {
        pct = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
        speedTooltipX = rect.right + 8;
        speedTooltipY = rect.bottom - speedSliderValue * rect.height + 22;
      } else {
        pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        speedTooltipX = rect.left + speedSliderValue * rect.width + 7;
        speedTooltipY = rect.top;
      }
      handleSpeedSliderChange(pct);
    }

    update(e.clientX, e.clientY);

    function onMove(ev: PointerEvent) {
      update(ev.clientX, ev.clientY);
    }
    function onUp(ev: PointerEvent) {
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
    get speedTooltipX() {
      return speedTooltipX;
    },
    get speedTooltipY() {
      return speedTooltipY;
    },
    get speedTooltipVisible() {
      return speedTooltipVisible;
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
  };
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
