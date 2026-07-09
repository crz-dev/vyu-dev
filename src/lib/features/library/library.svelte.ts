// Library state
import {
  invokeGetThumbnails,
  onThumbnailProgress,
  invokeGetFilesTotalSize,
  invokeBatchStat,
  invokeCreateCollectionFolder,
  invokeDeleteCollectionFolder,
  invokeRenameFile,
  invokeCopyFileUnique,
  invokeDeleteFile,
  invokeMigrateThumbnailCache,
} from "$lib/features/media/tools";
import {
  loadViewDensity,
  saveViewDensity,
  loadViewMode,
  saveViewMode,
  loadRecentFiles,
  saveRecentFiles,
  loadRecentFilesLimit,
  saveRecentFilesLimit,
  loadRecentsDisabled,
  saveRecentsDisabled,
  loadShowFolders,
  saveShowFolders,
  loadShowThumbnails,
  saveShowThumbnails,
  loadCollections,
  saveCollections,
  loadFavorites,
  saveFavorites,
  loadSortMode,
  saveSortMode,
  loadSortDesc,
  saveSortDesc,
  loadDividersOn,
  saveDividersOn,
  loadNamesOn,
  saveNamesOn,
  loadPrivacyMode,
  savePrivacyMode,
} from "$lib/services/storage";
import type {
  CollectionItem,
  RecentFileItem,
  FavoriteItem,
} from "$lib/services/storage";
import { exists } from "@tauri-apps/plugin-fs";
import { getParentFolder } from "$lib/services/files";
import {
  getCached as sharedGetCached,
  setCached as sharedSetCached,
} from "$lib/services/thumbnailCache";
import type { SortMode } from "$lib/shared/constants";
import type { BatchStatItem } from "$lib/shared/types";

const MAX_CONCURRENT = 2;
const THUMB_SIZE = 256;

type LibraryTab = "library" | "recents" | "collections" | "favorites";

const CACHE_MAX = 500;

function createLibrary() {
  const cache = $state<Record<string, string>>({});
  const cacheOrder: string[] = [];
  const indexMap = new Map<string, number>();
  let pendingSet = new Set<string>();
  let pendingOrder: string[] = [];
  let inflight = 0;
  let _fetchGen = 0;
  let _generating = $state(false);

  let activeTab = $state<LibraryTab>("library");

  let recentFilesLimit = $state(loadRecentFilesLimit());
  let recentsDisabled = $state(loadRecentsDisabled());
  let recentFiles = $state<RecentFileItem[]>(loadRecentFiles(loadRecentFilesLimit()));
  let recentTimestamps = $derived.by(() => {
    const map: Record<string, number> = {};
    for (const item of recentFiles) {
      map[item.path] = item.openedAt;
    }
    return map;
  });

  let showFolders = $state(loadShowFolders());
  let showThumbnails = $state(loadShowThumbnails());

  let viewMode = $state<"grid" | "list" | "river" | "filmstrip">(loadViewMode());

  let density = $state(loadViewDensity());

  // Sort state (independent from main view)
  let sortMode = $state<SortMode>(loadSortMode());
  let sortDesc = $state(loadSortDesc());
  let savedSortMode = $state<SortMode>(loadSortMode());
  let savedSortDesc = $state(loadSortDesc());

  let totalSize = $state(0);
  let totalSizeLoading = $state(false);

  // Stat cache for sort by size/date-modified
  let stats = $state<Record<string, BatchStatItem>>({});
  let statsLoading = $state(false);

  // Dividers / Names toggle
  let dividersOn = $state(loadDividersOn());
  let namesOn = $state(loadNamesOn());

  let privacyMode = $state(loadPrivacyMode());

  let selectedPaths = $state<Record<string, boolean>>({});
  let collectMode = $state(false);
  let deleteOriginalAfterCopy = $state(false);

  // Scan trigger — increment to force directory re-scan
  let scanKey = $state(0);

  let collections = $state<CollectionItem[]>(loadCollections());
  let activeCollectionPath = $state<string | null>(null);

  let favorites = $state<FavoriteItem[]>(loadFavorites());
  let favoriteTimestamps = $derived.by(() => {
    const map: Record<string, number> = {};
    for (const item of favorites) {
      map[item.path] = item.favoritedAt;
    }
    return map;
  });

  function evictCacheOne() {
    while (cacheOrder.length > 0) {
      const oldest = cacheOrder.shift()!;
      indexMap.delete(oldest);
      if (oldest !== "") {
        delete cache[oldest];
        return;
      }
    }
  }

  function touchCache(path: string) {
    const idx = indexMap.get(path);
    if (idx !== undefined) {
      cacheOrder[idx] = "";
      cacheOrder.push(path);
      indexMap.set(path, cacheOrder.length - 1);
    }
  }

  function setCacheEntry(path: string, dataUrl: string) {
    sharedSetCached(path, THUMB_SIZE, dataUrl);
    if (path in cache) touchCache(path);
    else {
      cache[path] = dataUrl;
      cacheOrder.push(path);
      indexMap.set(path, cacheOrder.length - 1);
      if (cacheOrder.length > CACHE_MAX) evictCacheOne();
    }
  }

  async function loadOne(path: string) {
    const localGen = _fetchGen;
    inflight++;
    pendingSet.delete(path);

    // Batch with adjacent queued items
    const BATCH_SIZE = 8;
    const batchPaths: string[] = [path];
    const defer: string[] = [];
    for (const p of pendingOrder) {
      if (batchPaths.length >= BATCH_SIZE) { defer.push(p); continue; }
      pendingSet.delete(p);
      batchPaths.push(p);
    }
    pendingOrder = defer;

    let unlisten: (() => void) | null = null;
    try {
      unlisten = await onThumbnailProgress((p, dataUrl) => {
        if (localGen !== _fetchGen) return;
        if (!dataUrl) return;
        if (!(p in cache)) setCacheEntry(p, dataUrl);
      });

      const results = await invokeGetThumbnails(batchPaths, THUMB_SIZE);
      if (localGen !== _fetchGen) return;
      for (const [p, dataUrl] of Object.entries(results)) {
        if (dataUrl && !(p in cache)) {
          setCacheEntry(p, dataUrl);
        }
      }
    } catch {
    } finally {
      unlisten?.();
      inflight--;
      kick();
      updateGenerating();
    }
  }

  function kick() {
    if (inflight >= MAX_CONCURRENT || pendingOrder.length === 0) return;
    const path = pendingOrder.shift()!;
    pendingSet.delete(path);
    loadOne(path);
    updateGenerating();
  }

  function requestThumbnail(path: string) {
    if (path in cache) {
      touchCache(path);
      return cache[path];
    }
    const shared = sharedGetCached(path, 256);
    if (shared) {
      setCacheEntry(path, shared);
      return shared;
    }
    if (!pendingSet.has(path)) {
      pendingSet.add(path);
      pendingOrder.push(path);
    }
    kick();
    return "";
  }

  function cancelPending(path: string) {
    if (pendingSet.delete(path)) {
      pendingOrder = pendingOrder.filter((p) => p !== path);
    }
    updateGenerating();
  }

  function updateGenerating() {
    _generating = pendingOrder.length > 0 || inflight > 0;
  }

  function clearQueue() {
    pendingSet.clear();
    pendingOrder = [];
    inflight = 0;
    _generating = false;
  }

  function rebuildQueue(fileList: string[], currentIndex: number) {
    _fetchGen++;
    pendingSet.clear();
    pendingOrder = [];

    for (let i = 0; i < fileList.length; i++) {
      const path = fileList[i];
      if (!(path in cache)) {
        pendingSet.add(path);
        pendingOrder.push(path);
      }
    }

    _generating = pendingOrder.length > 0;
    kick();
  }

  function setViewMode(mode: "grid" | "list" | "river" | "filmstrip") {
    viewMode = mode;
    saveViewMode(mode);
  }

  function setActiveTab(tab: LibraryTab) {
    if (tab !== "collections" && collectMode) {
      collectMode = false;
    }

    const prev = activeTab;
    const prevSpecial =
      prev === "recents" || prev === "collections" || prev === "favorites";
    const nextSpecial =
      tab === "recents" || tab === "collections" || tab === "favorites";

    if (nextSpecial && !prevSpecial) {
      savedSortMode = sortMode;
      savedSortDesc = sortDesc;
    } else if (prevSpecial && !nextSpecial) {
      sortMode = savedSortMode;
      sortDesc = savedSortDesc;
    }

    if (tab === "recents") {
      sortMode = "date-opened";
      sortDesc = true;
    } else if (tab === "collections") {
      sortMode = "date-created";
      sortDesc = true;
    } else if (tab === "favorites") {
      sortMode = "date-favorited";
      sortDesc = true;
    }

    activeTab = tab;
  }

  function addRecent(path: string) {
    if (recentsDisabled || privacyMode) return;
    recentFiles = [
      { path, openedAt: Date.now() },
      ...recentFiles.filter((r) => r.path !== path),
    ].slice(0, recentFilesLimit);
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

  function getRecentPaths(): string[] {
    return recentFiles.map((r) => r.path);
  }

  function setRecentsDisabled(disabled: boolean) {
    recentsDisabled = disabled;
    saveRecentsDisabled(disabled);
  }

  function setShowFolders(enabled: boolean) {
    showFolders = enabled;
    saveShowFolders(enabled);
  }

  function setShowThumbnails(enabled: boolean) {
    showThumbnails = enabled;
    saveShowThumbnails(enabled);
  }

  function setDividersOn(enabled: boolean) {
    dividersOn = enabled;
    saveDividersOn(enabled);
  }

  function setNamesOn(enabled: boolean) {
    namesOn = enabled;
    saveNamesOn(enabled);
  }

  function setPrivacyMode(enabled: boolean) {
    privacyMode = enabled;
    savePrivacyMode(enabled);
  }

  function setDensity(v: number) {
    density = Math.max(0, Math.min(1, v));
    saveViewDensity(density);
  }

  function setSortMode(mode: SortMode, desc: boolean) {
    sortMode = mode;
    sortDesc = desc;
    saveSortMode(mode);
    saveSortDesc(desc);
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

  function getSelectedPaths(): string[] {
    return Object.keys(selectedPaths);
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

  function addCollection(path: string) {
    if (collections.some((c) => c.path === path)) return;
    const parts = path.replace(/\\/g, "/").split("/");
    const name = parts[parts.length - 1] || path;
    collections = [
      ...collections,
      { name, path, type: "linked", createdAt: Date.now() },
    ];
    saveCollections(collections);
  }

  async function createCustomCollection(name: string, thumbnailPath?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const path = await invokeCreateCollectionFolder(trimmed);
      if (collections.some((c) => c.path === path)) return;
      collections = [
        ...collections,
        {
          name: trimmed,
          path,
          type: "custom",
          createdAt: Date.now(),
          thumbnailPath,
        },
      ];
      saveCollections(collections);
    } catch (err) {
      console.error("Failed to create collection:", err);
    }
  }

  async function removeCollection(path: string) {
    const col = collections.find((c) => c.path === path);
    if (col?.type === "custom") {
      try {
        await invokeDeleteCollectionFolder(path);
      } catch (err) {
        console.error("Failed to delete collection folder:", err);
      }
    }
    collections = collections.filter((c) => c.path !== path);
    saveCollections(collections);
    if (activeCollectionPath === path) activeCollectionPath = null;
  }

  async function renameCollection(path: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const col = collections.find((c) => c.path === path);
    if (!col) return;
    const parent = getParentFolder(path);
    const newPath =
      parent +
      (parent.endsWith("\\") || parent.endsWith("/")
        ? ""
        : path.includes("\\")
          ? "\\"
          : "/") +
      trimmed;
    if (newPath === path) return;
    try {
      await invokeRenameFile(path, newPath);
      await invokeMigrateThumbnailCache(path, newPath);
      collections = collections.map((c) =>
        c.path === path ? { ...c, name: trimmed, path: newPath } : c,
      );
      if (activeCollectionPath === path) activeCollectionPath = newPath;
    } catch (err) {
      console.error("Failed to rename collection folder:", err);
      return;
    }
    saveCollections(collections);
  }

  function openCollection(path: string) {
    activeCollectionPath = path;
  }

  function closeCollection() {
    activeCollectionPath = null;
  }

  function triggerRescan() {
    scanKey++;
  }

  async function validateCollections() {
    const valid: CollectionItem[] = [];
    for (const c of collections) {
      try {
        if (await exists(c.path)) valid.push(c);
      } catch {
        // treat as missing
      }
    }
    if (valid.length !== collections.length) {
      collections = valid;
      saveCollections(collections);
    }
  }

  function getFavoritePaths(): string[] {
    return favorites.map((f) => f.path);
  }

  function addFavorite(path: string) {
    if (favorites.some((f) => f.path === path)) return;
    favorites = [...favorites, { path, favoritedAt: Date.now() }];
    saveFavorites(favorites);
  }

  function removeFavorite(path: string) {
    favorites = favorites.filter((f) => f.path !== path);
    saveFavorites(favorites);
  }

  function isFavorite(path: string): boolean {
    return favorites.some((f) => f.path === path);
  }

  function setCollectMode(v: boolean) {
    collectMode = v;
    if (!v) deleteOriginalAfterCopy = false;
  }

  async function copySelectedToCollection(colPath: string) {
    const paths = getSelectedPaths();
    if (paths.length === 0) return;
    let successCount = 0;
    let failCount = 0;
    for (const p of paths) {
      try {
        await invokeCopyFileUnique(p, colPath);
        if (deleteOriginalAfterCopy) {
          await invokeDeleteFile(p);
        }
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      const { showToast } = await import("$lib/features/toast/toast.svelte");
      showToast({
        message: `${successCount} file${successCount === 1 ? "" : "s"} copied to collection`,
        color: "blue",
      });
    }
    if (failCount > 0) {
      const { showToast } = await import("$lib/features/toast/toast.svelte");
      showToast({
        message: `Failed to copy ${failCount} file${failCount === 1 ? "" : "s"}`,
        color: "red",
      });
    }
    clearSelection();
    setCollectMode(false);
  }

  function setCollectionThumbnail(path: string, thumbnailPath: string | null) {
    collections = collections.map((c) =>
      c.path === path ? { ...c, thumbnailPath: thumbnailPath ?? undefined } : c,
    );
    saveCollections(collections);
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
    get recentTimestamps() {
      return recentTimestamps;
    },
    getRecentPaths,
    get recentsDisabled() {
      return recentsDisabled;
    },
    setRecentsDisabled,
    get showFolders() {
      return showFolders;
    },
    setShowFolders,
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
    get dividersOn() {
      return dividersOn;
    },
    setDividersOn,
    get namesOn() {
      return namesOn;
    },
    setNamesOn,
    get privacyMode() {
      return privacyMode;
    },
    setPrivacyMode,
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
    getSelectedPaths,
    clearSelection,
    isSelected,
    get selectMode() {
      return getSelectedCount() > 0;
    },
    get selectedCount() {
      return getSelectedCount();
    },
    get collections() {
      return collections;
    },
    addCollection,
    createCustomCollection,
    removeCollection,
    renameCollection,
    get activeCollectionPath() {
      return activeCollectionPath;
    },
    get generating() {
      return _generating;
    },
    get scanKey() {
      return scanKey;
    },
    triggerRescan,
    openCollection,
    closeCollection,
    validateCollections,
    get favorites() {
      return favorites;
    },
    get favoriteTimestamps() {
      return favoriteTimestamps;
    },
    getFavoritePaths,
    addFavorite,
    removeFavorite,
    isFavorite,
    get collectMode() {
      return collectMode;
    },
    get deleteOriginalAfterCopy() {
      return deleteOriginalAfterCopy;
    },
    toggleDeleteOriginalAfterCopy() {
      deleteOriginalAfterCopy = !deleteOriginalAfterCopy;
    },
    setCollectMode,
    copySelectedToCollection,
    setCollectionThumbnail,
  };
}

export const library = createLibrary();
