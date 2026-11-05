// Keeps a small set of neighbouring images decoded in memory so navigating to
// them can paint from the browser's decoded-image cache instead of re-reading
// and re-decoding from disk.
//
// Ownership: app-wide service; consumers are media prefetch and the viewer.

const MAX_ENTRIES = 3;
// Decoded bitmaps are width * height * 4 bytes. Keep the working set bounded.
const MAX_TOTAL_PIXELS = 48_000_000;
const MAX_IMAGE_PIXELS = 24_000_000;
// Reuse a decoded copy of a path for this long instead of re-fetching it under
// a new URL each time it shows up as a neighbour. Explicit invalidation
// (edit apply, folder change) covers real content changes before this expires.
const REUSE_TTL_MS = 5 * 60_000;

interface Entry {
  el: HTMLImageElement;
  url: string;
  pixels: number;
  at: number;
}

const entries = new Map<string, Entry>();
let totalPixels = 0;

function drop(path: string) {
  const entry = entries.get(path);
  if (!entry) return;
  totalPixels -= entry.pixels;
  entries.delete(path);
}

function evict() {
  while (entries.size > MAX_ENTRIES || totalPixels > MAX_TOTAL_PIXELS) {
    let oldestPath: string | null = null;
    let oldestAt = Infinity;
    for (const [path, entry] of entries) {
      if (entry.at < oldestAt) {
        oldestAt = entry.at;
        oldestPath = path;
      }
    }
    if (oldestPath === null) return;
    drop(oldestPath);
  }
}

/**
 * Start fetching and decoding `url` for `path`. Safe to call repeatedly; a
 * repeated call with the same URL is a no-op.
 */
export function preloadImage(path: string, url: string): void {
  if (!path || !url) return;

  const existing = entries.get(path);
  if (existing) {
    if (existing.url === url) return;
    // Still fresh: keep the decoded copy rather than fetching the same file
    // again under a new cache-busting URL.
    if (Date.now() - existing.at < REUSE_TTL_MS) return;
    drop(path);
  }

  const el = new Image();
  el.decoding = "async";
  const entry: Entry = { el, url, pixels: 0, at: Date.now() };
  entries.set(path, entry);

  el.onload = () => {
    if (entries.get(path) !== entry) return;
    const pixels = el.naturalWidth * el.naturalHeight;
    if (pixels <= 0 || pixels > MAX_IMAGE_PIXELS) {
      // Oversized images cost more to keep than they save; let the viewer
      // decode them on demand instead.
      drop(path);
      return;
    }
    entry.pixels = pixels;
    entry.at = Date.now();
    totalPixels += pixels;
    evict();
  };
  el.onerror = () => {
    if (entries.get(path) === entry) drop(path);
  };

  el.src = url;
  // Force a decode now so displaying this URL later only needs a paint.
  if (typeof el.decode === "function") void el.decode().catch(() => {});
  evict();
}

/** Release every decoded image. */
export function clearPreloadedImages(): void {
  entries.clear();
  totalPixels = 0;
}

/** Drop the decoded copy of a single path (e.g. after an in-place edit). */
export function forgetPreloadedImage(path: string): void {
  drop(path);
}

/**
 * The URL currently held (or loading) for `path`, if the decoded copy is still
 * fresh. Callers should display this exact URL to get a cache hit.
 */
export function getPreloadedUrl(path: string): string | null {
  const entry = entries.get(path);
  if (!entry) return null;
  if (Date.now() - entry.at >= REUSE_TTL_MS) return null;
  return entry.url;
}

/**
 * Natural dimensions of a decoded preload, if it has finished loading. Lets the
 * viewer compute the fit scale before the image element is first laid out.
 */
export function getPreloadedSize(
  path: string,
): { width: number; height: number } | null {
  const entry = entries.get(path);
  if (!entry || entry.pixels <= 0) return null;
  if (Date.now() - entry.at >= REUSE_TTL_MS) return null;
  return { width: entry.el.naturalWidth, height: entry.el.naturalHeight };
}
