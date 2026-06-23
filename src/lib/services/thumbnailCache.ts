import { invokeGetThumbnail } from "$lib/features/media/tools";

const cache = new Map<string, string>();
const cacheOrder: string[] = [];
const MAX_CACHE = 500;

let pendingSet = new Set<string>();
let pendingOrder: string[] = [];
let inflight = 0;
const MAX_CONCURRENT = 4;

function cacheKey(path: string, size: number): string {
  return `${path}\0${size}`;
}

function evictOne() {
  const oldest = cacheOrder.shift();
  if (oldest !== undefined) cache.delete(oldest);
}

function touch(key: string) {
  const idx = cacheOrder.indexOf(key);
  if (idx !== -1) cacheOrder.splice(idx, 1);
  cacheOrder.push(key);
}

async function loadOne(key: string, path: string, size: number) {
  inflight++;
  pendingSet.delete(key);
  try {
    const dataUrl = await invokeGetThumbnail(path, size);
    if (dataUrl) {
      cache.set(key, dataUrl);
      cacheOrder.push(key);
      if (cacheOrder.length > MAX_CACHE) evictOne();
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
  if (cache.has(key)) touch(key);
  else {
    cache.set(key, dataUrl);
    cacheOrder.push(key);
    if (cacheOrder.length > MAX_CACHE) evictOne();
  }
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
