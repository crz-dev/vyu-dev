// DATAFLOW: createPlaybackActions monitors <video> element via videoElRef callback.
// updateProgress called on 'timeupdate' event from +page.svelte.
import { VOLUME_SEGMENTS } from "$lib/shared/constants";

const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 2, 3];

export function createPlaybackActions(
  mediaElRef: () => HTMLMediaElement | null,
) {
  function updateProgress(
    set: (data: {
      rawCurrentSecs: number;
      rawDurationSecs: number;
      progress: number;
      playing: boolean;
    }) => void,
  ) {
    const mediaEl = mediaElRef();
    if (!mediaEl) return;

    const rawCurrentSecs = mediaEl.currentTime;
    const rawDurationSecs = mediaEl.duration || 0;
    const progress =
      rawDurationSecs > 0 ? (rawCurrentSecs / rawDurationSecs) * 100 : 0;

    set({
      rawCurrentSecs,
      rawDurationSecs,
      progress,
      playing: !mediaEl.paused,
    });
  }

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
      mediaEl.muted = volume === 0;
    }

    set({
      volume,
      muted: volume === 0,
    });
  }

  return {
    updateProgress,
    togglePlay,
    toggleMute,
    setVolume,
  };
}

export function createPlaybackUI(
  mediaElRef: () => HTMLMediaElement | null,
  getVolume: () => number,
  setVolume: (v: number) => void,
) {
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
    volumeTooltipVisible = false;
    volumeHovered = false;
  }

  function handleVolumeDiamondHover(e: MouseEvent) {
    volumeTooltipX = e.clientX;
    volumeTooltipY = e.clientY;
    volumeTooltipVisible = true;
  }

  function startVolumeDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const diamonds = (e.currentTarget as HTMLElement).querySelectorAll(
      ".volume-diamond",
    );

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - first.left) / (last.right - first.left)),
      );
      setVolume(Math.ceil(ratio * VOLUME_SEGMENTS) / VOLUME_SEGMENTS);
      volumeTooltipX = clientX;
      volumeTooltipY = clientY;
      volumeTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      dragTo(ev.clientX, ev.clientY);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      volumeTooltipVisible = false;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleVolumeScroll(e: WheelEvent) {
    e.preventDefault();
    setVolume(getVolume() + (e.deltaY > 0 ? -0.125 : 0.125));
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
    speedTooltipVisible = false;
    speedHovered = false;
  }

  function handleSpeedDiamondHover(e: MouseEvent) {
    speedTooltipX = e.clientX;
    speedTooltipY = e.clientY;
    speedTooltipVisible = true;
  }

  function startSpeedDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const diamonds = (e.currentTarget as HTMLElement).querySelectorAll(
      ".speed-diamond",
    );

    function dragTo(clientX: number, clientY: number) {
      const first = diamonds[0].getBoundingClientRect();
      const last = diamonds[diamonds.length - 1].getBoundingClientRect();
      const steps = SPEED_STEPS;
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - first.left) / (last.right - first.left)),
      );
      const idx = Math.round(ratio * (steps.length - 1));
      setPlaybackSpeed(steps[idx]);
      speedTooltipX = clientX;
      speedTooltipY = clientY;
      speedTooltipVisible = true;
    }

    dragTo(e.clientX, e.clientY);

    function onMouseMove(ev: MouseEvent) {
      dragTo(ev.clientX, ev.clientY);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
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
    volumeSliderMode = !volumeSliderMode;
    if (volumeSliderMode) {
      volumeSliderValue = getVolume();
    }
  }

  function toggleSpeedSliderMode() {
    speedSliderMode = !speedSliderMode;
    if (speedSliderMode) {
      speedSliderValue = speedToSliderVal(playbackSpeed);
    }
  }

  function handleVolumeSliderChange(val: number) {
    volumeSliderValue = val;
    setVolume(val);
  }

  function handleSpeedSliderChange(val: number) {
    speedSliderValue = val;
    const speed = Math.round(sliderValToSpeed(val) * 100) / 100;
    playbackSpeed = speed;
    const mediaEl = mediaElRef();
    if (mediaEl) mediaEl.playbackRate = speed;
  }

  function initSliderMode(volume: boolean, speed: boolean) {
    volumeSliderMode = volume;
    speedSliderMode = speed;
  }

  function startVolumeSliderDrag(e: PointerEvent, track: HTMLDivElement) {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);

    function update(clientX: number) {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      handleVolumeSliderChange(pct);
    }

    update(e.clientX);

    function onMove(ev: PointerEvent) {
      update(ev.clientX);
    }
    function onUp(ev: PointerEvent) {
      track.releasePointerCapture(ev.pointerId);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
    }

    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
  }

  function startSpeedSliderDrag(e: PointerEvent, track: HTMLDivElement) {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);

    function update(clientX: number) {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      handleSpeedSliderChange(pct);
    }

    update(e.clientX);

    function onMove(ev: PointerEvent) {
      update(ev.clientX);
    }
    function onUp(ev: PointerEvent) {
      track.releasePointerCapture(ev.pointerId);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
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
  };
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
