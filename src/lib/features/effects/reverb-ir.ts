// Reverb IR
export function generateReverbIR(
  ctx: AudioContext,
  durationSecs: number,
  decayDb: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSecs);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const decayLinear = Math.pow(10, -decayDb / 20);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * (decayLinear * 8 + 0.3));
    left[i] = (Math.random() * 2 - 1) * envelope;
    right[i] = (Math.random() * 2 - 1) * envelope;
  }

  return buffer;
}
