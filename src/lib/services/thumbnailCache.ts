import { invokeGetThumbnail } from "$lib/features/media/tools";

/** Shared module-level cache so ThumbnailBar and LibraryView
 *  never issue duplicate IPC for the same (path, size) pair. */
const cache = new Map<string, string>();

let pending: string[] = [];
let inflight = 0;
const MAX_CONCURRENT = 4;

function cacheKey(path: string, size: number): string {
  return `${path}\0${size}`;
}

async function loadOne(key: string, path: string, size: number) {
  inflight++;
  try {
    const dataUrl = await invokeGetThumbnail(path, size);
    if (dataUrl) cache.set(key, dataUrl);
  } catch {
    // generation failed — skip silently
  } finally {
    inflight--;
    kick();
  }
}

function kick() {
  if (inflight >= MAX_CONCURRENT || pending.length === 0) return;
  const next = pending.shift()!;
  const [path, size] = next.split("\0");
  loadOne(next, path, Number(size));
}

export function requestThumbnail(path: string, size: number = 120): string {
  const key = cacheKey(path, size);
  const hit = cache.get(key);
  if (hit) return hit;
  if (!pending.includes(key)) pending.push(key);
  kick();
  return "";
}

export function setCached(path: string, size: number, dataUrl: string): void {
  cache.set(cacheKey(path, size), dataUrl);
}

export function getCached(
  path: string,
  size: number = 120,
): string | undefined {
  return cache.get(cacheKey(path, size));
}

export function hasCached(path: string, size: number = 120): boolean {
  return cache.has(cacheKey(path, size));
}

export function cancelPending(path: string) {
  pending = pending.filter((k) => !k.startsWith(`${path}\0`));
}

export function clearCache() {
  cache.clear();
  pending = [];
  inflight = 0;
}
