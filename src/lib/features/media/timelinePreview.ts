import { invokeGetVideoPreview } from "$lib/features/media/api";

export const TIMELINE_PREVIEW_BUCKET_SECS = 2;
// Maximum preview width; the tooltip shrinks it for vertical videos.
export const TIMELINE_PREVIEW_WIDTH = 128;

const PREVIEW_CACHE_LIMIT = 64;
const SLOW_PREVIEW_THRESHOLD_MS = 500;

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const slowPaths = new Set<string>();

interface PendingPreviewRequest {
  path: string;
  bucket: number;
  timeSecs: number;
  resolve: (src: string) => void;
}

let pending: PendingPreviewRequest | null = null;
let draining = false;
let currentPath = "";

function cacheKey(path: string, bucket: number): string {
  return `${path}\0${bucket}`;
}

function store(path: string, bucket: number, src: string) {
  if (!src) return;
  const key = cacheKey(path, bucket);
  cache.delete(key);
  cache.set(key, src);
  while (cache.size > PREVIEW_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function getCachedTimelinePreview(
  path: string,
  bucket: number,
): string | undefined {
  if (!path) return undefined;
  const key = cacheKey(path, bucket);
  const src = cache.get(key);
  if (src === undefined) return undefined;
  cache.delete(key);
  cache.set(key, src);
  return src;
}

export function previewBucketForPct(pct: number, durationSecs: number): number {
  if (!(durationSecs > 0) || !Number.isFinite(durationSecs)) return 0;
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const time = (clamped / 100) * durationSecs;
  return Math.max(0, Math.floor(time / TIMELINE_PREVIEW_BUCKET_SECS));
}

export function previewTimeForBucket(
  bucket: number,
  durationSecs: number,
): number {
  if (!(durationSecs > 0) || !Number.isFinite(durationSecs)) return 0;
  const time = (bucket + 0.5) * TIMELINE_PREVIEW_BUCKET_SECS;
  return Math.max(0, Math.min(time, Math.max(0, durationSecs - 0.05)));
}

function loadPreview(
  path: string,
  bucket: number,
  timeSecs: number,
): Promise<string> {
  const cached = getCachedTimelinePreview(path, bucket);
  if (cached) return Promise.resolve(cached);

  const key = cacheKey(path, bucket);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const started = performance.now();
  const promise = invokeGetVideoPreview(
    path,
    bucket,
    timeSecs,
    TIMELINE_PREVIEW_WIDTH,
    slowPaths.has(path),
  )
    .then((src) => {
      if (src) store(path, bucket, src);
      return src;
    })
    .catch(() => "")
    .finally(() => {
      if (performance.now() - started > SLOW_PREVIEW_THRESHOLD_MS)
        slowPaths.add(path);
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

async function drain() {
  if (draining) return;
  draining = true;
  while (pending) {
    const request = pending;
    pending = null;
    const src = await loadPreview(
      request.path,
      request.bucket,
      request.timeSecs,
    );
    request.resolve(src);
  }
  draining = false;
}

/**
 * Schedules a preview frame request. Only one FFmpeg request runs at a time
 * across the app; a newer request supersedes the previous queued one.
 */
export function requestTimelinePreview(
  path: string,
  bucket: number,
  timeSecs: number,
): Promise<string> {
  if (!path || !Number.isFinite(timeSecs) || timeSecs < 0) {
    return Promise.resolve("");
  }

  if (path !== currentPath) {
    currentPath = path;
    cancelPendingTimelinePreviews();
  }

  const cached = getCachedTimelinePreview(path, bucket);
  if (cached) return Promise.resolve(cached);

  cancelPendingTimelinePreviews();
  return new Promise<string>((resolve) => {
    pending = { path, bucket, timeSecs, resolve };
    void drain();
  });
}

export function cancelPendingTimelinePreviews(): void {
  if (!pending) return;
  pending.resolve("");
  pending = null;
}
