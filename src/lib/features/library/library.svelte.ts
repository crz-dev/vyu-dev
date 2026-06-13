import { invokeGetThumbnail, invokeGetFilesTotalSize } from "$lib/features/media/tools";
import type { SortMode } from "$lib/shared/constants";

const MAX_CONCURRENT = 4;

function createLibrary() {
  const cache = $state<Record<string, string>>({});
  let pending: string[] = [];
  let inflight = 0;

  // View mode
  let viewMode = $state<"grid" | "list">("grid");

  // Sort state (independent from main view)
  let sortMode = $state<SortMode>("name");
  let sortDesc = $state(false);

  // Total size
  let totalSize = $state(0);
  let totalSizeLoading = $state(false);

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

  function setViewMode(mode: "grid" | "list") {
    viewMode = mode;
  }

  function setSortMode(mode: SortMode, desc: boolean) {
    sortMode = mode;
    sortDesc = desc;
  }

  async function computeTotalSize(paths: string[]) {
    if (paths.length === 0) {
      totalSize = 0;
      return;
    }
    totalSizeLoading = true;
    try {
      totalSize = await invokeGetFilesTotalSize(paths);
    } catch {
      totalSize = 0;
    } finally {
      totalSizeLoading = false;
    }
  }

  return {
    cache,
    requestThumbnail,
    cancelPending,
    clearQueue,
    rebuildQueue,
    get viewMode() {
      return viewMode;
    },
    setViewMode,
    get sortMode() {
      return sortMode;
    },
    get sortDesc() {
      return sortDesc;
    },
    setSortMode,
    get totalSize() {
      return totalSize;
    },
    get totalSizeLoading() {
      return totalSizeLoading;
    },
    computeTotalSize,
  };
}

export const library = createLibrary();
