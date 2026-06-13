import { invokeGetThumbnail } from "$lib/features/media/tools";

const MAX_CONCURRENT = 4;

function createLibrary() {
  const cache = $state<Record<string, string>>({});
  let pending: string[] = [];
  let inflight = 0;

  async function loadOne(path: string) {
    inflight++;
    try {
      const dataUrl = await invokeGetThumbnail(path, 256);
      if (dataUrl) {
        cache[path] = dataUrl;
      }
    } catch {
      // generation failed — skip silently
    } finally {
      inflight--;
      kick();
    }
  }

  function kick() {
    if (inflight >= MAX_CONCURRENT || pending.length === 0) return;
    const path = pending.shift()!;
    loadOne(path);
  }

  function requestThumbnail(path: string) {
    if (path in cache) return cache[path];
    if (inflight >= MAX_CONCURRENT) {
      if (!pending.includes(path)) pending.push(path);
    } else {
      if (!pending.includes(path)) pending.push(path);
      kick();
    }
    return "";
  }

  function cancelPending(path: string) {
    pending = pending.filter((p) => p !== path);
  }

  function clearQueue() {
    pending = [];
    inflight = 0;
  }

  function rebuildQueue(fileList: string[], currentIndex: number) {
    pending = [];
    inflight = 0;

    const order: number[] = [currentIndex];
    let l = currentIndex - 1;
    let r = currentIndex + 1;
    while (l >= 0 || r < fileList.length) {
      if (l >= 0) order.push(l--);
      if (r < fileList.length) order.push(r++);
    }

    for (const idx of order) {
      const path = fileList[idx];
      if (!(path in cache)) {
        pending.push(path);
      }
    }

    kick();
  }

  return {
    cache,
    requestThumbnail,
    cancelPending,
    clearQueue,
    rebuildQueue,
  };
}

export const library = createLibrary();
