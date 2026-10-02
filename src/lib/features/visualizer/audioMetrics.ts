// Realtime audio metrics for visualizer overlays

export interface AudioMetrics {
  levelDb: number | null;
  peakFrequencyHz: number | null;
  lowDb: number | null;
  midDb: number | null;
  highDb: number | null;
}

const SILENCE_FLOOR_DB = -96;
const LOW_BAND_MAX_HZ = 250;
const MID_BAND_MAX_HZ = 2000;
const HIGH_BAND_MAX_HZ = 20000;

export function createEmptyAudioMetrics(): AudioMetrics {
  return {
    levelDb: null,
    peakFrequencyHz: null,
    lowDb: null,
    midDb: null,
    highDb: null,
  };
}

function smoothValue(
  current: number | null,
  target: number | null,
  deltaSeconds: number,
  timeConstant: number,
): number | null {
  if (target === null || current === null) return target;
  const response = 1 - Math.exp(-Math.max(0, deltaSeconds) / timeConstant);
  return current + (target - current) * response;
}

function amplitudeToDb(amplitude: number): number | null {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return null;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(amplitude));
}

function frequencyBandDb(
  frequencyData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  minDecibels: number,
  maxDecibels: number,
  minHz: number,
  maxHz: number,
): number | null {
  if (frequencyData.length === 0 || fftSize <= 0 || sampleRate <= 0) {
    return null;
  }

  const binHz = sampleRate / fftSize;
  const maxBin = Math.min(frequencyData.length - 1, Math.ceil(maxHz / binHz));
  const minBin = Math.max(1, Math.floor(minHz / binHz));
  if (minBin > maxBin) return null;

  let energy = 0;
  let count = 0;
  for (let i = minBin; i <= maxBin; i++) {
    const binDb =
      minDecibels +
      ((frequencyData[i] ?? 0) / 255) * (maxDecibels - minDecibels);
    const amplitude = Math.pow(10, binDb / 20);
    energy += amplitude * amplitude;
    count++;
  }

  return amplitudeToDb(Math.sqrt(energy / count));
}

export function calculateAudioMetrics(
  timeData: Uint8Array,
  frequencyData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  minDecibels: number,
  maxDecibels: number,
): AudioMetrics {
  let sumSquares = 0;
  if (timeData.length > 0) {
    for (const sample of timeData) {
      const normalized = (sample - 128) / 128;
      sumSquares += normalized * normalized;
    }
  }

  let peakFrequencyHz: number | null = null;
  let peakValue = 0;
  let peakIndex = 0;
  for (let i = 1; i < frequencyData.length; i++) {
    const value = frequencyData[i] ?? 0;
    if (value > peakValue) {
      peakValue = value;
      peakIndex = i;
    }
  }
  if (peakValue > 1 && fftSize > 0 && sampleRate > 0) {
    peakFrequencyHz = (peakIndex * sampleRate) / fftSize;
  }

  return {
    levelDb:
      timeData.length > 0
        ? amplitudeToDb(Math.sqrt(sumSquares / timeData.length))
        : null,
    peakFrequencyHz,
    lowDb: frequencyBandDb(
      frequencyData,
      sampleRate,
      fftSize,
      minDecibels,
      maxDecibels,
      20,
      LOW_BAND_MAX_HZ,
    ),
    midDb: frequencyBandDb(
      frequencyData,
      sampleRate,
      fftSize,
      minDecibels,
      maxDecibels,
      LOW_BAND_MAX_HZ,
      MID_BAND_MAX_HZ,
    ),
    highDb: frequencyBandDb(
      frequencyData,
      sampleRate,
      fftSize,
      minDecibels,
      maxDecibels,
      MID_BAND_MAX_HZ,
      HIGH_BAND_MAX_HZ,
    ),
  };
}

export function smoothAudioMetrics(
  current: AudioMetrics,
  target: AudioMetrics,
  deltaSeconds: number,
): AudioMetrics {
  return {
    levelDb: smoothValue(current.levelDb, target.levelDb, deltaSeconds, 0.16),
    peakFrequencyHz: smoothValue(
      current.peakFrequencyHz,
      target.peakFrequencyHz,
      deltaSeconds,
      0.1,
    ),
    lowDb: smoothValue(current.lowDb, target.lowDb, deltaSeconds, 0.14),
    midDb: smoothValue(current.midDb, target.midDb, deltaSeconds, 0.14),
    highDb: smoothValue(current.highDb, target.highDb, deltaSeconds, 0.14),
  };
}

export function formatLevelDb(value: number | null): string {
  if (value === null) return "--";
  return `${Math.round(value)} dBFS`;
}

export function formatBandDb(value: number | null): string {
  if (value === null) return "--";
  return `${Math.round(value)} dB`;
}

export function formatFrequency(value: number | null): string {
  if (value === null) return "--";
  if (value < 1000) return `${Math.round(value / 10) * 10} Hz`;
  if (value < 10000) return `${(value / 1000).toFixed(1)} kHz`;
  return `${Math.round(value / 1000)} kHz`;
}
