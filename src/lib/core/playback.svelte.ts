import { VOLUME_SEGMENTS } from "$lib/constants";

export function createPlaybackActions(
  videoElRef: () => HTMLVideoElement | null,
) {
  function updateProgress(
    set: (data: {
      rawCurrentSecs: number;
      rawDurationSecs: number;
      progress: number;
      playing: boolean;
    }) => void,
  ) {
    const videoEl = videoElRef();
    if (!videoEl) return;

    const rawCurrentSecs = videoEl.currentTime;
    const rawDurationSecs = videoEl.duration || 0;
    const progress =
      rawDurationSecs > 0 ? (rawCurrentSecs / rawDurationSecs) * 100 : 0;

    set({
      rawCurrentSecs,
      rawDurationSecs,
      progress,
      playing: !videoEl.paused,
    });
  }

  function togglePlay() {
    const videoEl = videoElRef();
    if (!videoEl) return;

    videoEl.paused ? videoEl.play() : videoEl.pause();
  }

  function toggleMute(set: (muted: boolean) => void, currentMuted: boolean) {
    const videoEl = videoElRef();
    if (!videoEl) return;

    const next = !currentMuted;
    videoEl.muted = next;
    set(next);
  }

  function setVolume(
    val: number,
    set: (data: { volume: number; muted: boolean }) => void,
  ) {
    const videoEl = videoElRef();
    const volume = Math.max(0, Math.min(1, val));

    if (videoEl) {
      videoEl.volume = volume;
      videoEl.muted = volume === 0;
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
  videoElRef: () => HTMLVideoElement | null,
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
    const videoEl = videoElRef();
    if (videoEl) videoEl.playbackRate = val;
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
      const steps = [0.25, 0.5, 0.75, 1, 1.25, 2, 3];
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
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 2, 3];
    const cur = steps.reduce((a, b) =>
      Math.abs(b - playbackSpeed) < Math.abs(a - playbackSpeed) ? b : a,
    );
    const idx = steps.indexOf(cur);
    const next =
      e.deltaY > 0 ? Math.max(0, idx - 1) : Math.min(steps.length - 1, idx + 1);
    setPlaybackSpeed(steps[next]);
  }

  return {
    get volumeHovered() { return volumeHovered; },
    get speedHovered() { return speedHovered; },
    get playbackSpeed() { return playbackSpeed; },
    get volumeTooltipX() { return volumeTooltipX; },
    get volumeTooltipY() { return volumeTooltipY; },
    get volumeTooltipVisible() { return volumeTooltipVisible; },
    get speedTooltipX() { return speedTooltipX; },
    get speedTooltipY() { return speedTooltipY; },
    get speedTooltipVisible() { return speedTooltipVisible; },
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
  };
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
