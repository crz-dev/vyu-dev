export const BANDS = [30, 60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const BAND_FREQUENCIES: number[] = [...BANDS];

export const BAND_Q = BANDS.map((freq, i, arr) => {
  const lower = i === 0 ? freq / 2 : arr[i - 1];
  const upper = i === arr.length - 1 ? freq * 2 : arr[i + 1];
  const bw = upper - lower;
  const centerFreq = freq;
  return centerFreq / bw;
});

export function formatFreq(hz: number): string {
  if (hz >= 1000) return `${hz / 1000}kHz`;
  return `${hz}Hz`;
}

export function formatDb(val: number): string {
  if (val === 0) return "0dB";
  return val > 0 ? `+${val}dB` : `${val}dB`;
}
