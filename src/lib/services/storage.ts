import type { Timestamp, ClipBoundary } from "$lib/types";

export function loadVolume(): number {
  const saved = localStorage.getItem("vyu-volume");
  return saved !== null ? parseFloat(saved) : 1;
}

export function saveVolume(volume: number): void {
  localStorage.setItem("vyu-volume", String(volume));
}

export function loadDeleteNoAsk(): boolean {
  return localStorage.getItem("vyu-delete-no-ask") === "true";
}

export function saveDeleteNoAsk(): void {
  localStorage.setItem("vyu-delete-no-ask", "true");
}

export function loadClipPrefs() {
  return {
    deleteOriginal: localStorage.getItem("vyu-clip-delete-original") === "true",
    useCustomPath: localStorage.getItem("vyu-clip-use-custom-path") === "true",
    mergeSegments: localStorage.getItem("vyu-clip-merge-segments") === "true",
    outputDir: localStorage.getItem("vyu-clip-output-dir") ?? "",
  };
}

export function saveClipPrefs(prefs: {
  deleteOriginal?: boolean;
  useCustomPath?: boolean;
  mergeSegments?: boolean;
  outputDir?: string;
}): void {
  if (prefs.deleteOriginal !== undefined)
    localStorage.setItem(
      "vyu-clip-delete-original",
      String(prefs.deleteOriginal),
    );
  if (prefs.useCustomPath !== undefined)
    localStorage.setItem(
      "vyu-clip-use-custom-path",
      String(prefs.useCustomPath),
    );
  if (prefs.mergeSegments !== undefined)
    localStorage.setItem(
      "vyu-clip-merge-segments",
      String(prefs.mergeSegments),
    );
  if (prefs.outputDir !== undefined)
    localStorage.setItem("vyu-clip-output-dir", prefs.outputDir);
}

export function readTimestamps(filePath: string): Timestamp[] {
  if (!filePath) return [];
  try {
    const raw = localStorage.getItem(`vyu-ts-${filePath}`);
    const parsed = raw ? (JSON.parse(raw) as Array<Partial<Timestamp>>) : [];
    return parsed
      .filter((ts) => typeof ts?.time === "number")
      .map((ts) => ({
        id:
          ts.id || `ts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: ts.time as number,
        title: typeof ts.title === "string" ? ts.title : "",
      }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export function writeTimestamps(
  filePath: string,
  timestamps: Timestamp[],
): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-ts-${filePath}`, JSON.stringify(timestamps));
}

export function eraseTimestamps(filePath: string): void {
  if (filePath) localStorage.removeItem(`vyu-ts-${filePath}`);
}

export function readClipBoundaries(filePath: string): ClipBoundary[] {
  if (!filePath) return [];
  try {
    const raw = localStorage.getItem(`vyu-clips-${filePath}`);
    const parsed = raw ? (JSON.parse(raw) as Array<Partial<ClipBoundary>>) : [];
    return parsed
      .filter(
        (m) =>
          typeof m?.time === "number" &&
          (m.kind === "start" || m.kind === "end"),
      )
      .map((m) => ({
        id:
          m.id ||
          `${m.kind}-${m.time}-${Math.random().toString(36).slice(2, 8)}`,
        time: m.time as number,
        kind: m.kind as "start" | "end",
        title: typeof m.title === "string" ? m.title : "",
      }))
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

export function writeClipBoundaries(
  filePath: string,
  boundaries: ClipBoundary[],
): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-clips-${filePath}`, JSON.stringify(boundaries));
}

export function eraseClipBoundaries(filePath: string): void {
  if (filePath) localStorage.removeItem(`vyu-clips-${filePath}`);
}

export function loadResumePoint(filePath: string): number | null {
  if (!filePath) return null;
  const raw = localStorage.getItem(`vyu-resume-${filePath}`);
  if (raw === null) return null;
  const val = parseFloat(raw);
  return isFinite(val) ? val : null;
}

export function saveResumePoint(filePath: string, time: number): void {
  if (!filePath) return;
  localStorage.setItem(`vyu-resume-${filePath}`, String(time));
}

export function eraseResumePoint(filePath: string): void {
  if (!filePath) return;
  localStorage.removeItem(`vyu-resume-${filePath}`);
}
