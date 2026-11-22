import { appearance } from "$lib/features/theme/appearance.svelte";

// Sliders that draw their own track and expose the value through inline styles.
const CUSTOM_TRACK_SELECTOR = [
  ".playback-slider-track",
  ".retro-slider-track-vertical",
  ".color-slider-track",
  ".eq-slider-track",
  ".pip-volume-track",
  ".pip-progress",
  ".pip-audio-progress",
  ".view-density-track",
].join(",");

const CUSTOM_ANIM_CLASS = "slider-click-anim";
const CUSTOM_ANIM_MS = 260;
const DRAG_CANCEL_PX = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numberAttr(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function snapToStep(input: HTMLInputElement, raw: number): number {
  const min = numberAttr(input.min, 0);
  const max = numberAttr(input.max, 100);
  const step = input.step;
  if (!step || step === "any") return clamp(raw, min, max);
  const size = Number(step);
  if (!Number.isFinite(size) || size <= 0) return clamp(raw, min, max);
  const decimals = (String(size).split(".")[1] ?? "").length;
  const snapped = min + Math.round((raw - min) / size) * size;
  return clamp(Number(snapped.toFixed(decimals)), min, max);
}

export function installSliderAnimations(): () => void {
  if (typeof document === "undefined") return () => {};

  let activeTrack: HTMLElement | null = null;
  let trackTimer: ReturnType<typeof setTimeout> | null = null;
  let trackStartX = 0;
  let trackStartY = 0;

  let activeInput: HTMLInputElement | null = null;
  let inputRaf: number | null = null;
  let dragRaf: number | null = null;
  let inputDown = false;
  let inputMoved = false;
  let inputStartX = 0;
  let inputStartY = 0;
  let dragX = 0;
  let dragY = 0;
  let pendingChange = false;

  function clearTrackAnimation() {
    if (trackTimer !== null) {
      clearTimeout(trackTimer);
      trackTimer = null;
    }
    if (activeTrack) {
      activeTrack.classList.remove(CUSTOM_ANIM_CLASS);
      activeTrack = null;
    }
  }

  function startTrackAnimation(track: HTMLElement, e: PointerEvent) {
    clearTrackAnimation();
    activeTrack = track;
    trackStartX = e.clientX;
    trackStartY = e.clientY;
    track.classList.add(CUSTOM_ANIM_CLASS);
    trackTimer = setTimeout(() => {
      trackTimer = null;
      clearTrackAnimation();
    }, CUSTOM_ANIM_MS);
  }

  function targetValue(
    input: HTMLInputElement,
    clientX: number,
    clientY: number,
  ): number {
    const rect = input.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return input.valueAsNumber || 0;
    }
    const vertical = getComputedStyle(input).writingMode.startsWith("vertical");
    const ratio = vertical
      ? clamp((rect.bottom - clientY) / rect.height, 0, 1)
      : clamp((clientX - rect.left) / rect.width, 0, 1);
    const min = numberAttr(input.min, 0);
    const max = numberAttr(input.max, 100);
    return snapToStep(input, min + ratio * (max - min));
  }

  function setInputValue(input: HTMLInputElement, value: number) {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function dispatchChange(input: HTMLInputElement) {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function animateInput(input: HTMLInputElement, target: number) {
    const start = input.valueAsNumber;
    const min = numberAttr(input.min, 0);
    const max = numberAttr(input.max, 100);
    const span = Math.max(1, max - min);
    const duration = 140 + Math.min(1, Math.abs(target - start) / span) * 120;
    let startedAt: number | null = null;
    let lastT = 0;

    const step = (now: number) => {
      if (startedAt === null) startedAt = now;
      const rawT = Math.min(1, (now - startedAt) / duration);
      // Never skip more than a fifth per frame so a stalled frame cannot turn
      // the whole tween into a jump.
      const t = Math.min(rawT, lastT + 0.2);
      lastT = t;
      if (t >= 1) {
        inputRaf = null;
        setInputValue(input, target);
        if (pendingChange) {
          pendingChange = false;
          dispatchChange(input);
        }
        if (!inputDown) activeInput = null;
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      setInputValue(input, snapToStep(input, start + (target - start) * eased));
      inputRaf = requestAnimationFrame(step);
    };

    return requestAnimationFrame(step);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || appearance.reducedMotion) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const input = target.closest<HTMLInputElement>('input[type="range"]');
    if (
      input &&
      !input.disabled &&
      !input.classList.contains("slider-locked")
    ) {
      e.preventDefault();
      input.focus({ preventScroll: true });
      if (inputRaf !== null) cancelAnimationFrame(inputRaf);
      if (dragRaf !== null) cancelAnimationFrame(dragRaf);
      inputRaf = null;
      dragRaf = null;
      activeInput = input;
      inputDown = true;
      inputMoved = false;
      pendingChange = false;
      inputStartX = e.clientX;
      inputStartY = e.clientY;
      inputRaf = animateInput(input, targetValue(input, e.clientX, e.clientY));
      return;
    }

    const track = target.closest<HTMLElement>(CUSTOM_TRACK_SELECTOR);
    if (track) startTrackAnimation(track, e);
  }

  function onPointerMove(e: PointerEvent) {
    if (
      activeTrack &&
      (Math.abs(e.clientX - trackStartX) > DRAG_CANCEL_PX ||
        Math.abs(e.clientY - trackStartY) > DRAG_CANCEL_PX)
    ) {
      clearTrackAnimation();
    }

    if (!activeInput || !inputDown) return;
    if (
      !inputMoved &&
      (Math.abs(e.clientX - inputStartX) > DRAG_CANCEL_PX ||
        Math.abs(e.clientY - inputStartY) > DRAG_CANCEL_PX)
    ) {
      inputMoved = true;
      if (inputRaf !== null) {
        cancelAnimationFrame(inputRaf);
        inputRaf = null;
      }
    }
    if (!inputMoved) return;

    dragX = e.clientX;
    dragY = e.clientY;
    if (dragRaf !== null) return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = null;
      if (!activeInput || !inputDown) return;
      setInputValue(activeInput, targetValue(activeInput, dragX, dragY));
    });
  }

  function onPointerUp(e: PointerEvent) {
    if (!activeInput || !inputDown) return;
    inputDown = false;
    if (dragRaf !== null) {
      cancelAnimationFrame(dragRaf);
      dragRaf = null;
    }
    if (inputRaf !== null) {
      pendingChange = true;
      return;
    }
    if (inputMoved) {
      setInputValue(
        activeInput,
        targetValue(activeInput, e.clientX, e.clientY),
      );
    }
    dispatchChange(activeInput);
    activeInput = null;
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerUp, true);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    clearTrackAnimation();
    if (inputRaf !== null) cancelAnimationFrame(inputRaf);
    if (dragRaf !== null) cancelAnimationFrame(dragRaf);
    activeInput = null;
  };
}
