// Cached waveform peak data, keyed by file path.
//
// Computing peaks means reading the whole audio file, decoding it and scanning
// every sample. Revisiting a file should reuse that result instead.
//
// Ownership: media service; consumers are WaveformBar and media invalidation.

export const WAVEFORM_PEAK_COUNT = 300;

const MAX_ENTRIES = 100;
const cache = new Map<string, Float32Array>();

export function getWaveformPeaks(path: string): Float32Array | undefined {
  const peaks = cache.get(path);
  if (!peaks) return undefined;
  // Refresh LRU order.
  cache.delete(path);
  cache.set(path, peaks);
  return peaks;
}

export function setWaveformPeaks(path: string, peaks: Float32Array): void {
  cache.delete(path);
  cache.set(path, peaks);
  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

export function forgetWaveformPeaks(path: string): void {
  cache.delete(path);
}

export function clearWaveformPeaks(): void {
  cache.clear();
}
