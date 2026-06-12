import { invokeGetThumbnail } from "$lib/features/media/tools";

function createLibrary() {
  const cache = $state(new Map<string, string>());
  let queue: string[] = [];
  let inFlight = 0;

  async function processQueue() {
    if (inFlight >= 1 || queue.length === 0) return;
    const path = queue.shift()!;
    inFlight++;
    try {
      const dataUrl = await invokeGetThumbnail(path, 256);
      cache.set(path, dataUrl);
    } catch {
      // generation failed — skip silently
    } finally {
      inFlight--;
      processQueue();
    }
  }

  function requestThumbnail(path: string) {
    if (cache.has(path)) return cache.get(path)!;
    if (!queue.includes(path)) {
      queue.push(path);
      processQueue();
    }
    return "";
  }

  function cancelPending(path: string) {
    queue = queue.filter((p) => p !== path);
  }

  function clearQueue() {
    queue = [];
    inFlight = 0;
  }

  return {
    cache,
    requestThumbnail,
    cancelPending,
    clearQueue,
  };
}

export const library = createLibrary();
