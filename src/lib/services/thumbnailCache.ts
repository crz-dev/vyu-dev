// Thumbnail cache
import { invokeGetThumbnails } from "$lib/features/media/api";

const cache = new Map<string, string>();
const MAX_CACHE = 500;

let pendingSet = new Set<string>();
let pendingOrder: string[] = [];
let inflight = 0;
const MAX_CONCURRENT = 4;
const BATCH_SIZE = 8;

function cacheKey(path: string, size: number): string {
  return `${path}\0${size}`;
}

function evictOne() {
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) cache.delete(firstKey);
}

function touch(key: string) {
  const val = cache.get(key);
  if (val !== undefined) {
    cache.delete(key);
    cache.set(key, val);
  }
}

async function loadOne(key: string, path: string, size: number) {
  inflight++;
  pendingSet.delete(key);

  // Batch with adjacent queued items (same size)
  const batchPaths: string[] = [path];
  const defer: string[] = [];
  for (const k of pendingOrder) {
    const [p, s] = k.split("\0");
    if (Number(s) === size && batchPaths.length < BATCH_SIZE) {
      pendingSet.delete(k);
      batchPaths.push(p);
    } else {
      defer.push(k);
    }
  }
  pendingOrder = defer;

  try {
    const results = await invokeGetThumbnails(batchPaths, size);
    for (const [p, dataUrl] of Object.entries(results)) {
      if (dataUrl) {
        const ck = cacheKey(p, size);
        cache.set(ck, dataUrl);
        if (cache.size > MAX_CACHE) evictOne();
      }
    }
  } catch {
  } finally {
    inflight--;
    kick();
  }
}

function kick() {
  if (inflight >= MAX_CONCURRENT || pendingOrder.length === 0) return;
  const next = pendingOrder.shift()!;
  pendingSet.delete(next);
  const [path, size] = next.split("\0");
  loadOne(next, path, Number(size));
}

export function requestThumbnail(path: string, size: number = 120): string {
  const key = cacheKey(path, size);
  const hit = cache.get(key);
  if (hit) {
    touch(key);
    return hit;
  }
  if (!pendingSet.has(key)) {
    pendingSet.add(key);
    pendingOrder.push(key);
  }
  kick();
  return "";
}

export function setCached(path: string, size: number, dataUrl: string): void {
  const key = cacheKey(path, size);
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, dataUrl);
  if (cache.size > MAX_CACHE) evictOne();
}

export function getCached(
  path: string,
  size: number = 120,
): string | undefined {
  const key = cacheKey(path, size);
  const val = cache.get(key);
  if (val) touch(key);
  return val;
}

export function cancelPending(path: string) {
  const prefix = `${path}\0`;
  pendingOrder = pendingOrder.filter((k) => {
    const keep = !k.startsWith(prefix);
    if (!keep) pendingSet.delete(k);
    return keep;
  });
}
