import { accessibility } from "$lib/features/menus/accessibility.svelte";

type CueKind = "play" | "pause" | "navigate" | "seek";

let ctx: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function playAudioCue(kind: CueKind): void {
  if (!accessibility.audioCues) return;
  const context = ensureContext();
  if (!context) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency =
    kind === "pause"
      ? 440
      : kind === "navigate"
        ? 660
        : kind === "seek"
          ? 780
          : 880;

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  const peak = Math.max(0.0001, 0.045 * accessibility.volumeLimit);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}
