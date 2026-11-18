import { untrack } from "svelte";
import { invokeGetThumbnails } from "$lib/features/media/api";
import { DOCUMENT_EXTS } from "$lib/shared/constants";
import { getFileExt } from "$lib/services/files";

// Single owner of thumbnail requests. Components ask for a path/size and read
// the reactive entry back; they never keep their own queues, in-flight sets or
// retry counters. Every queued key always reaches a terminal state (ready or
// error), so a cell can never be left in the loading state by a dropped
// request.

export type ThumbEntry = {
  status: "ready" | "error";
  dataUrl: string;
  /** Timestamp of the last state change, used to cool down failed requests. */
  at: number;
};

export type DocumentThumbnailRenderer = (
  path: string,
  size: number,
) => Promise<string>;

const MAX_ENTRIES = 500;
const BATCH_SIZE = 8;
const MAX_CONCURRENT = 2;
const BATCH_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;
const ERROR_RETRY_COOLDOWN_MS = 30_000;

const entries = $state<Record<string, ThumbEntry>>({});
const lru = new Map<string, true>();

let queue: string[] = [];
const queued = new Set<string>();
const attempts = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const active = new Set<string>();
let inflight = 0;
let pending = $state(0);

let documentRenderer: DocumentThumbnailRenderer | null = null;

/** Register the frontend PDF renderer (the backend cannot decode PDFs). */
export function registerDocumentThumbnailRenderer(
  renderer: DocumentThumbnailRenderer,
): void {
  documentRenderer = renderer;
}

function keyFor(path: string, size: number): string {
  return `${path}\0${size}`;
}

function splitKey(key: string): [string, number] {
  const sep = key.lastIndexOf("\0");
  return [key.slice(0, sep), Number(key.slice(sep + 1))];
}

function isDocumentPath(path: string): boolean {
  return DOCUMENT_EXTS.includes(getFileExt(path));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Thumbnail request timed out")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function touch(key: string): void {
  lru.delete(key);
  lru.set(key, true);
}

function trimCache(): void {
  while (lru.size > MAX_ENTRIES) {
    const oldest = lru.keys().next().value;
    if (oldest === undefined) return;
    lru.delete(oldest);
    delete entries[oldest];
  }
}

function clearRetry(key: string): void {
  const timer = retryTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    retryTimers.delete(key);
  }
}

function complete(key: string, dataUrl: string): void {
  if (!dataUrl) return;
  clearRetry(key);
  attempts.delete(key);
  entries[key] = { status: "ready", dataUrl, at: Date.now() };
  touch(key);
  trimCache();
}

function fail(key: string): void {
  if (entries[key]?.status === "ready") return;
  const count = (attempts.get(key) ?? 0) + 1;
  if (count >= MAX_ATTEMPTS) {
    // Terminal: the UI renders a static placeholder instead of a shimmer.
    attempts.delete(key);
    entries[key] = { status: "error", dataUrl: "", at: Date.now() };
    return;
  }
  attempts.set(key, count);
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (count - 1));
  const existing = retryTimers.get(key);
  if (existing !== undefined) clearTimeout(existing);
  const timer = setTimeout(() => {
    retryTimers.delete(key);
    enqueue(key);
  }, delay);
  retryTimers.set(key, timer);
}

function enqueue(key: string): void {
  if (queued.has(key) || active.has(key) || retryTimers.has(key)) return;
  const entry = entries[key];
  if (entry?.status === "ready" || entry?.status === "error") return;
  queued.add(key);
  queue.push(key);
  pending++;
  pump();
}

function takeBatch(firstKey: string, size: number): string[] {
  const [firstPath] = splitKey(firstKey);
  const paths = [firstPath];
  const rest: string[] = [];
  for (const key of queue) {
    if (paths.length < BATCH_SIZE) {
      const [path, keySize] = splitKey(key);
      if (keySize === size) {
        queued.delete(key);
        paths.push(path);
        continue;
      }
    }
    rest.push(key);
  }
  queue = rest;
  return paths;
}

function pump(): void {
  while (inflight < MAX_CONCURRENT && queue.length > 0) {
    const key = queue.shift()!;
    queued.delete(key);
    if (entries[key]?.status === "ready") {
      pending = Math.max(0, pending - 1);
      continue;
    }
    const [, size] = splitKey(key);
    const paths = takeBatch(key, size);
    for (const path of paths) active.add(keyFor(path, size));
    void runBatch(paths, size);
  }
}

async function runBatch(paths: string[], size: number): Promise<void> {
  inflight++;
  try {
    const backendPaths: string[] = [];
    const documentPaths: string[] = [];
    for (const path of paths) {
      if (isDocumentPath(path)) documentPaths.push(path);
      else backendPaths.push(path);
    }

    if (backendPaths.length > 0) {
      const results = await withTimeout(
        invokeGetThumbnails(backendPaths, size),
        BATCH_TIMEOUT_MS,
      );
      for (const path of backendPaths) {
        const key = keyFor(path, size);
        const dataUrl = results[path];
        if (dataUrl) complete(key, dataUrl);
        else fail(key);
      }
    }

    if (documentPaths.length > 0) {
      const renderer = documentRenderer;
      if (!renderer) {
        for (const path of documentPaths) fail(keyFor(path, size));
      } else {
        await Promise.all(
          documentPaths.map(async (path) => {
            const key = keyFor(path, size);
            const dataUrl = await renderer(path, size);
            if (dataUrl) complete(key, dataUrl);
            else fail(key);
          }),
        );
      }
    }
  } catch {
    for (const path of paths) fail(keyFor(path, size));
  } finally {
    inflight--;
    for (const path of paths) {
      active.delete(keyFor(path, size));
      pending = Math.max(0, pending - 1);
    }
    pump();
  }
}

/** Ready thumbnail for this path/size, or undefined. Reactive. */
export function getCached(
  path: string,
  size: number = 120,
): string | undefined {
  const key = keyFor(path, size);
  const entry = entries[key];
  if (entry?.status !== "ready") return undefined;
  touch(key);
  return entry.dataUrl;
}

/** True once the request has failed for good; the cell is not loading. */
export function isThumbnailFailed(path: string, size: number = 120): boolean {
  return entries[keyFor(path, size)]?.status === "error";
}

/** True while any thumbnail work is queued or running. Reactive. */
export function isGenerating(): boolean {
  return pending > 0 || inflight > 0;
}

/**
 * Ask for a thumbnail and return the data URL if it is already available.
 * Repeated calls are idempotent.
 */
export function requestThumbnail(path: string, size: number = 120): string {
  // Requests are imperative: never subscribe the calling effect to the cache,
  // or every completed thumbnail would re-trigger the whole folder prefetch.
  return untrack(() => {
    const key = keyFor(path, size);
    const entry = entries[key];
    if (entry?.status === "ready") {
      touch(key);
      return entry.dataUrl;
    }
    if (entry?.status === "error") {
      // A later visit to the same cells may retry, but never in a tight loop.
      if (Date.now() - entry.at >= ERROR_RETRY_COOLDOWN_MS) {
        delete entries[key];
        attempts.delete(key);
        enqueue(key);
      }
      return "";
    }
    enqueue(key);
    return "";
  });
}

/** Queue several paths at once (keeps the shared queue in request order). */
export function requestThumbnails(
  paths: readonly string[],
  size: number = 120,
): void {
  untrack(() => {
    for (const path of paths) {
      const key = keyFor(path, size);
      const entry = entries[key];
      if (entry?.status === "ready") {
        touch(key);
        continue;
      }
      if (entry?.status === "error") {
        if (Date.now() - entry.at >= ERROR_RETRY_COOLDOWN_MS) {
          delete entries[key];
          attempts.delete(key);
          enqueue(key);
        }
        continue;
      }
      enqueue(key);
    }
  });
}

/** Store a thumbnail produced elsewhere (PDF.js render). */
export function setCached(path: string, size: number, dataUrl: string): void {
  if (!dataUrl) return;
  complete(keyFor(path, size), dataUrl);
}
