import {
  invokeGetThumbnail,
  invokeGetFilesTotalSize,
  invokeBatchStat,
} from "$lib/features/media/tools";
import {
  loadViewDensity,
  saveViewDensity,
  loadRecentFiles,
  saveRecentFiles,
  loadRecentFilesLimit,
  saveRecentFilesLimit,
  loadRecentsDisabled,
  saveRecentsDisabled,
  loadAutoScanFolders,
  saveAutoScanFolders,
  loadShowThumbnails,
  saveShowThumbnails,
} from "$lib/services/storage";
import { getCached as sharedGetCached, setCached } from "$lib/services/thumbnailCache";
import type { SortMode } from "$lib/shared/constants";
import type { BatchStatItem } from "$lib/shared/types";

const MAX_CONCURRENT = 4;

type LibraryTab = "library" | "recents" | "collections" | "favorites";

function createLibrary() {
  const cache = $state<Record<string, string>>({});
  let pending: string[] = [];
  let inflight = 0;

  // Active tab
  let activeTab = $state<LibraryTab>("library");

  // Recent files
  let recentFilesLimit = $state(loadRecentFilesLimit());
  let recentsDisabled = $state(loadRecentsDisabled());
  let recentFiles = $state<string[]>(loadRecentFiles(recentFilesLimit));

  // Library settings
  let autoScanFolders = $state(loadAutoScanFolders());
  let showThumbnails = $state(loadShowThumbnails());

  // View mode
  let viewMode = $state<"grid" | "list" | "river" | "filmstrip">("grid");

  // View density (0 = large thumbnails, 1 = small thumbnails)
  let density = $state(loadViewDensity());

  // Sort state (independent from main view)
  let sortMode = $state<SortMode>("name");
  let sortDesc = $state(false);

  // Total size
  let totalSize = $state(0);
  let totalSizeLoading = $state(false);

  // Stat cache for sort by size/date-modified
  let stats = $state<Record<string, BatchStatItem>>({});
  let statsLoading = $state(false);

  // Multi-select state
  let selectedPaths = $state<Record<string, boolean>>({});

  async function loadOne(path: string) {
    inflight++;
    try {
      const dataUrl = await invokeGetThumbnail(path, 256);
      if (dataUrl) {
        cache[path] = dataUrl;
        setCached(path, 256, dataUrl);
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
    // Check the shared cache before hitting the backend.
    const shared = sharedGetCached(path, 256);
    if (shared) {
      cache[path] = shared;
      return shared;
    }
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

  function setViewMode(mode: "grid" | "list" | "river" | "filmstrip") {
    viewMode = mode;
  }

  function setActiveTab(tab: LibraryTab) {
    activeTab = tab;
  }

  function addRecent(path: string) {
    if (recentsDisabled) return;
    const idx = recentFiles.indexOf(path);
    if (idx !== -1) recentFiles.splice(idx, 1);
    recentFiles.unshift(path);
    if (recentFiles.length > recentFilesLimit)
      recentFiles.length = recentFilesLimit;
    saveRecentFiles(recentFiles, recentFilesLimit);
  }

  function clearRecentFiles() {
    recentFiles = [];
    saveRecentFiles([], recentFilesLimit);
  }

  function setRecentFilesLimit(limit: number) {
    recentFilesLimit = limit;
    saveRecentFilesLimit(limit);
    if (recentFiles.length > limit) {
      recentFiles.length = limit;
      saveRecentFiles(recentFiles, limit);
    }
  }

  function setRecentsDisabled(disabled: boolean) {
    recentsDisabled = disabled;
    saveRecentsDisabled(disabled);
  }

  function setAutoScanFolders(enabled: boolean) {
    autoScanFolders = enabled;
    saveAutoScanFolders(enabled);
  }

  function setShowThumbnails(enabled: boolean) {
    showThumbnails = enabled;
    saveShowThumbnails(enabled);
  }

  function setDensity(v: number) {
    density = Math.max(0, Math.min(1, v));
    saveViewDensity(density);
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

  async function loadStats(paths: string[]) {
    if (paths.length === 0) {
      stats = {};
      return;
    }
    statsLoading = true;
    try {
      const items = await invokeBatchStat(paths);
      const map: Record<string, BatchStatItem> = {};
      for (const item of items) {
        map[item.path] = item;
      }
      stats = map;
    } catch {
      stats = {};
    } finally {
      statsLoading = false;
    }
  }

  function toggleSelect(path: string) {
    if (selectedPaths[path]) {
      delete selectedPaths[path];
    } else {
      selectedPaths[path] = true;
    }
  }

  function selectRange(paths: string[]) {
    for (const p of paths) {
      selectedPaths[p] = true;
    }
  }

  function clearSelection() {
    selectedPaths = {};
  }

  function isSelected(path: string): boolean {
    return !!selectedPaths[path];
  }

  function getSelectedCount(): number {
    return Object.keys(selectedPaths).length;
  }

  return {
    get cache() {
      return cache;
    },
    requestThumbnail,
    cancelPending,
    clearQueue,
    rebuildQueue,
    get activeTab() {
      return activeTab;
    },
    setActiveTab,
    get recentFiles() {
      return recentFiles;
    },
    addRecent,
    clearRecentFiles,
    get recentFilesLimit() {
      return recentFilesLimit;
    },
    setRecentFilesLimit,
    get recentsDisabled() {
      return recentsDisabled;
    },
    setRecentsDisabled,
    get autoScanFolders() {
      return autoScanFolders;
    },
    setAutoScanFolders,
    get showThumbnails() {
      return showThumbnails;
    },
    setShowThumbnails,
    get viewMode() {
      return viewMode;
    },
    setViewMode,
    get density() {
      return density;
    },
    setDensity,
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
    get stats() {
      return stats;
    },
    loadStats,
    toggleSelect,
    selectRange,
    clearSelection,
    isSelected,
    get selectMode() {
      return getSelectedCount() > 0;
    },
    get selectedCount() {
      return getSelectedCount();
    },
  };
}

export const library = createLibrary();
