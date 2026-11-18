import { untrack } from "svelte";
import {
  invokeGetFilesTotalSize,
  invokeBatchStat,
  invokeCreateCollectionFolder,
  invokeDeleteCollectionFolder,
  invokeRenameFile,
  invokeCopyFileUnique,
  invokeDeleteFile,
  invokeMigrateThumbnailCache,
} from "$lib/features/media/api";
// Side effect: registers the PDF.js renderer with the thumbnail service.
import "$lib/features/viewer/pdf.svelte";
import {
  getCached as getCachedThumbnail,
  isGenerating as isGeneratingThumbnails,
  isThumbnailFailed as isThumbnailFailedThumbnail,
  requestThumbnail as requestThumbnailFromCache,
} from "$lib/services/thumbnailCache.svelte";
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
  loadLibraryFileFilters,
  saveLibraryFileFilters,
  loadRecentRetentionDays,
  saveRecentRetentionDays,
  loadPrivacyBlur,
  savePrivacyBlur,
  loadPrivacyHideNames,
  savePrivacyHideNames,
  loadPrivacyRevealHover,
  savePrivacyRevealHover,
  loadLibraryThumbnailSize,
  saveLibraryThumbnailSize,
} from "$lib/services/storage";
import type {
  CollectionItem,
  RecentFileItem,
  FavoriteItem,
  LibraryFileFilters,
} from "$lib/services/storage";
import { exists } from "@tauri-apps/plugin-fs";
import {
  getFileExt,
  getFileName,
  getParentFolder,
  replacePathPrefix,
  samePath,
} from "$lib/services/files";
import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";
import {
  AUDIO_EXTS,
  DOCUMENT_EXTS,
  IMAGE_EXTS,
  VIDEO_EXTS,
} from "$lib/shared/constants";
import type { SortMode } from "$lib/shared/constants";
import type {
  BatchStatItem,
  LibraryTypeCounts,
  LibraryViewInfo,
} from "$lib/shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const THUMBNAIL_SIZES: readonly number[] = [128, 256, 512];
const RECENT_RETENTION_DAYS: readonly number[] = [0, 7, 30, 90];
const INVALID_COLLECTION_NAME_CHARS = /[<>:"\/\\|?*\u0000-\u001f\u007f-\u009f]/;
const RESERVED_COLLECTION_DEVICE_NAME =
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

const IMAGE_SET = new Set(IMAGE_EXTS);
const VIDEO_SET = new Set(VIDEO_EXTS);
const AUDIO_SET = new Set(AUDIO_EXTS);
const DOCUMENT_SET = new Set(DOCUMENT_EXTS);

type ViewInfoSource =
  | { kind: "folder"; path: string; files: string[]; folders: string[] }
  | { kind: "recents" | "favorites"; files: string[] }
  | { kind: "collections"; collections: CollectionItem[] };

function emptyTypeCounts(): LibraryTypeCounts {
  return { images: 0, videos: 0, audio: 0, documents: 0 };
}

function countFileTypes(files: string[]): LibraryTypeCounts {
  const counts = emptyTypeCounts();
  for (const path of files) {
    const ext = getFileExt(path);
    if (IMAGE_SET.has(ext)) {
      counts.images++;
    } else if (VIDEO_SET.has(ext)) {
      counts.videos++;
    } else if (AUDIO_SET.has(ext)) {
      counts.audio++;
    } else if (DOCUMENT_SET.has(ext)) {
      counts.documents++;
    }
  }
  return counts;
}

function isValidCollectionName(name: string): boolean {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.endsWith(".") ||
    INVALID_COLLECTION_NAME_CHARS.test(trimmed)
  ) {
    return false;
  }

  const deviceName = trimmed.split(".")[0].replace(/[ .]+$/, "");
  return !RESERVED_COLLECTION_DEVICE_NAME.test(deviceName);
}

function clampPrivacyBlur(value: number): number {
  return Math.max(4, Math.min(32, Math.round(value / 2) * 2));
}

function pruneRecentByAge(
  items: RecentFileItem[],
  retentionDays: number,
): RecentFileItem[] {
  if (retentionDays <= 0) return items;
  const cutoff = Date.now() - retentionDays * DAY_MS;
  return items.filter((item) => item.openedAt >= cutoff);
}

type LibraryTab = "library" | "recents" | "collections" | "favorites";
const TAB_ORDER: LibraryTab[] = [
  "library",
  "recents",
  "collections",
  "favorites",
];

function createLibrary() {
  let activeTab = $state<LibraryTab>("library");
  let tabDirection = $state(1);

  let recentFilesLimit = $state(loadRecentFilesLimit());
  let recentsDisabled = $state(loadRecentsDisabled());
  let recentRetentionDays = $state(loadRecentRetentionDays());
  let recentFiles = $state<RecentFileItem[]>(
    pruneRecentByAge(
      loadRecentFiles(loadRecentFilesLimit()),
      loadRecentRetentionDays(),
    ),
  );
  let recentTimestamps = $derived.by(() => {
    const map: Record<string, number> = {};
    for (const item of recentFiles) {
      map[item.path] = item.openedAt;
    }
    return map;
  });

  let showFolders = $state(loadShowFolders());
  let showThumbnails = $state(loadShowThumbnails());

  let viewMode = $state<"grid" | "list" | "river" | "filmstrip">(
    loadViewMode(),
  );

  let density = $state(loadViewDensity());

  // Sort state (independent from main view)
  let sortMode = $state<SortMode>(loadSortMode());
  let sortDesc = $state(loadSortDesc());
  let savedSortMode = $state<SortMode>(loadSortMode());
  let savedSortDesc = $state(loadSortDesc());

  // Search state is session-only: it filters the active tab and is cleared
  // when the library closes, so reopening never shows a stale filter.
  let searchQuery = $state("");
  let searchFocusNonce = $state(0);
  const searchActive = $derived(searchQuery.trim().length > 0);

  let viewInfo = $state<LibraryViewInfo | null>(null);
  let viewInfoRequestId = 0;

  // Stat cache for sort by size/date-modified
  let stats = $state<Record<string, BatchStatItem>>({});
  let statsLoading = $state(false);

  // Dividers / Names toggle
  let dividersOn = $state(loadDividersOn());
  let namesOn = $state(loadNamesOn());

  let privacyMode = $state(loadPrivacyMode());
  let privacyBlur = $state(clampPrivacyBlur(loadPrivacyBlur()));
  let privacyHideNames = $state(loadPrivacyHideNames());
  let privacyRevealHover = $state(loadPrivacyRevealHover());

  let fileFilters = $state<LibraryFileFilters>(loadLibraryFileFilters());
  let thumbnailSize = $state(loadLibraryThumbnailSize());

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

  function applyPrivacyStyles() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--privacy-blur", `${privacyBlur}px`);
    root.dataset.privacyReveal = privacyRevealHover ? "true" : "false";
  }

  function thumbnailsPaused() {
    return systemPrefs.batterySaverActive;
  }

  function requestThumbnail(path: string) {
    return untrack(() => {
      const cached = getCachedThumbnail(path, thumbnailSize);
      if (cached) return cached;
      if (thumbnailsPaused()) return "";
      return requestThumbnailFromCache(path, thumbnailSize);
    });
  }

  function thumbnailUrl(path: string) {
    return getCachedThumbnail(path, thumbnailSize) ?? "";
  }

  function isThumbnailFailed(path: string) {
    return isThumbnailFailedThumbnail(path, thumbnailSize);
  }

  function setViewMode(mode: "grid" | "list" | "river" | "filmstrip") {
    viewMode = mode;
    saveViewMode(mode);
  }

  function setSearchQuery(value: string) {
    searchQuery = value;
  }

  function clearSearch() {
    searchQuery = "";
    searchFocusNonce = 0;
  }

  function requestSearchFocus() {
    searchFocusNonce += 1;
  }

  function setActiveTab(tab: LibraryTab) {
    if (tab !== activeTab) {
      tabDirection =
        TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(activeTab) ? 1 : -1;
    }

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

  function cycleActiveTab(direction: -1 | 1) {
    const index = TAB_ORDER.indexOf(activeTab);
    const next = (index + direction + TAB_ORDER.length) % TAB_ORDER.length;
    setActiveTab(TAB_ORDER[next]);
  }

  let saveRecentFilesTimer: ReturnType<typeof setTimeout> | undefined;

  function flushRecentSave() {
    if (saveRecentFilesTimer) {
      clearTimeout(saveRecentFilesTimer);
      saveRecentFilesTimer = undefined;
    }
    saveRecentFiles(recentFiles, recentFilesLimit);
  }

  function scheduleRecentSave() {
    if (saveRecentFilesTimer) clearTimeout(saveRecentFilesTimer);
    saveRecentFilesTimer = setTimeout(() => {
      saveRecentFilesTimer = undefined;
      saveRecentFiles(recentFiles, recentFilesLimit);
    }, 400);
  }

  function addRecent(path: string) {
    if (recentsDisabled || privacyMode) return;
    const next = pruneRecentByAge(
      [
        { path, openedAt: Date.now() },
        ...recentFiles.filter((r) => r.path !== path),
      ],
      recentRetentionDays,
    );
    recentFiles = next.slice(0, recentFilesLimit);
    // The in-memory list updates immediately; coalesce the storage write so
    // rapid skipping doesn't serialize on every file.
    scheduleRecentSave();
  }

  function clearRecentFiles() {
    recentFiles = [];
    saveRecentFiles([], recentFilesLimit);
  }

  function setRecentFilesLimit(limit: number) {
    recentFilesLimit = limit;
    saveRecentFilesLimit(limit);
    const pruned = pruneRecentByAge(recentFiles, recentRetentionDays);
    if (pruned.length !== recentFiles.length || recentFiles.length > limit) {
      recentFiles = pruned.slice(0, limit);
      saveRecentFiles(recentFiles, limit);
    }
  }

  function setRecentRetentionDays(days: number) {
    if (!RECENT_RETENTION_DAYS.includes(days)) return;
    recentRetentionDays = days;
    saveRecentRetentionDays(days);
    recentFiles = pruneRecentByAge(recentFiles, days);
    saveRecentFiles(recentFiles, recentFilesLimit);
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

  function setPrivacyBlur(value: number) {
    if (!Number.isFinite(value)) return;
    privacyBlur = clampPrivacyBlur(value);
    savePrivacyBlur(privacyBlur);
    applyPrivacyStyles();
  }

  function setPrivacyHideNames(enabled: boolean) {
    privacyHideNames = enabled;
    savePrivacyHideNames(enabled);
  }

  function setPrivacyRevealHover(enabled: boolean) {
    privacyRevealHover = enabled;
    savePrivacyRevealHover(enabled);
    applyPrivacyStyles();
  }

  function setFileKindVisible(
    kind: keyof LibraryFileFilters,
    enabled: boolean,
  ) {
    const next = { ...fileFilters, [kind]: enabled };
    if (!next.images && !next.videos && !next.audio && !next.documents) return;
    fileFilters = next;
    saveLibraryFileFilters(next);
    clearSelection();
  }

  function setThumbnailSize(size: number) {
    if (!THUMBNAIL_SIZES.includes(size) || size === thumbnailSize) {
      return;
    }
    thumbnailSize = size;
    saveLibraryThumbnailSize(size);
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

  function setViewInfo(source: ViewInfoSource) {
    const requestId = ++viewInfoRequestId;

    if (source.kind === "collections") {
      const linked = source.collections.filter((c) => c.type === "linked");
      viewInfo = {
        kind: "collections",
        path: null,
        name: "",
        fileCount: 0,
        folderCount: 0,
        totalSize: 0,
        loading: false,
        modifiedMs: null,
        typeCounts: emptyTypeCounts(),
        collectionCount: source.collections.length,
        linkedCollectionCount: linked.length,
        customCollectionCount: source.collections.length - linked.length,
      };
      return;
    }

    const files = source.files;
    const isFolder = source.kind === "folder";
    const path = isFolder ? source.path : null;
    const base: LibraryViewInfo = {
      kind: source.kind,
      path,
      name: path ? getFileName(path) : "",
      fileCount: files.length,
      folderCount: isFolder ? source.folders.length : 0,
      totalSize: 0,
      loading: files.length > 0 || isFolder,
      modifiedMs: null,
      typeCounts: countFileTypes(files),
      collectionCount: 0,
      linkedCollectionCount: 0,
      customCollectionCount: 0,
    };
    viewInfo = base;

    if (!isFolder && files.length === 0) {
      viewInfo = { ...base, loading: false };
      return;
    }

    void (async () => {
      const [size, stats] = await Promise.all([
        files.length > 0
          ? invokeGetFilesTotalSize(files).catch(() => 0)
          : Promise.resolve(0),
        isFolder && path
          ? invokeBatchStat([path]).catch(() => [] as BatchStatItem[])
          : Promise.resolve([] as BatchStatItem[]),
      ]);
      if (requestId !== viewInfoRequestId) return;
      const folderStat = isFolder ? stats[0] : undefined;
      const modified = folderStat?.mtime_ms;
      viewInfo = {
        ...base,
        totalSize: size,
        loading: false,
        modifiedMs: modified && modified > 0 ? modified : null,
      };
    })();
  }

  function clearViewInfo() {
    viewInfoRequestId++;
    viewInfo = null;
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

  async function createCustomCollection(
    name: string,
    thumbnailPath?: string,
  ): Promise<boolean> {
    const trimmed = name.trim();
    if (!isValidCollectionName(trimmed)) return false;
    try {
      const path = await invokeCreateCollectionFolder(trimmed);
      if (collections.some((c) => samePath(c.path, path))) return true;
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
      return true;
    } catch {
      return false;
    }
  }

  async function removeCollection(path: string): Promise<boolean> {
    const col = collections.find((c) => c.path === path);
    if (!col) return false;
    if (col?.type === "custom") {
      try {
        await invokeDeleteCollectionFolder(path);
      } catch {
        return false;
      }
    }
    collections = collections.filter((c) => c.path !== path);
    saveCollections(collections);
    if (activeCollectionPath === path) activeCollectionPath = null;
    return true;
  }

  async function renameCollection(
    path: string,
    newName: string,
  ): Promise<string | null> {
    const trimmed = newName.trim();
    if (!isValidCollectionName(trimmed)) return null;
    const col = collections.find((c) => c.path === path);
    if (!col) return null;
    const parent = getParentFolder(path);
    const newPath =
      parent +
      (parent.endsWith("\\") || parent.endsWith("/")
        ? ""
        : path.includes("\\")
          ? "\\"
          : "/") +
      trimmed;
    if (newPath === path) return null;
    try {
      await invokeRenameFile(path, newPath);
    } catch {
      return null;
    }
    try {
      await invokeMigrateThumbnailCache(path, newPath);
    } catch (err) {
      // Thumbnail cache migration is best-effort; the folder is already renamed.
      console.error("Failed to migrate collection thumbnails:", err);
    }
    collections = collections.map((c) =>
      c.path === path ? { ...c, name: trimmed, path: newPath } : c,
    );
    if (activeCollectionPath === path) activeCollectionPath = newPath;
    saveCollections(collections);
    return newPath;
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

  function remapRecentFiles(remap: (path: string) => string): RecentFileItem[] {
    const seen = new Set<string>();
    const next: RecentFileItem[] = [];
    for (const item of recentFiles) {
      const path = remap(item.path);
      const key = path.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ ...item, path });
    }
    return next;
  }

  function remapFavorites(remap: (path: string) => string): FavoriteItem[] {
    const seen = new Set<string>();
    const next: FavoriteItem[] = [];
    for (const item of favorites) {
      const path = remap(item.path);
      const key = path.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ ...item, path });
    }
    return next;
  }

  function remapCollections(remap: (path: string) => string) {
    collections = collections.map((collection) => ({
      ...collection,
      path: remap(collection.path),
      thumbnailPath: collection.thumbnailPath
        ? remap(collection.thumbnailPath)
        : collection.thumbnailPath,
    }));
    if (activeCollectionPath) {
      activeCollectionPath = remap(activeCollectionPath);
    }
  }

  function persistLibraryPaths() {
    saveRecentFiles(recentFiles, recentFilesLimit);
    saveFavorites(favorites);
    saveCollections(collections);
  }

  function migrateFilePath(oldPath: string, newPath: string) {
    if (!oldPath || !newPath || oldPath === newPath) return;
    const remap = (path: string) => (samePath(path, oldPath) ? newPath : path);
    recentFiles = remapRecentFiles(remap);
    favorites = remapFavorites(remap);
    remapCollections(remap);
    persistLibraryPaths();
  }

  function migrateFolderPath(oldFolder: string, newFolder: string) {
    if (!oldFolder || !newFolder || oldFolder === newFolder) return;
    const remap = (path: string) =>
      replacePathPrefix(path, oldFolder, newFolder) ?? path;
    recentFiles = remapRecentFiles(remap);
    favorites = remapFavorites(remap);
    remapCollections(remap);
    persistLibraryPaths();
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
      const { showToast } = await import("$lib/components/toast.svelte");
      showToast({
        message: locale.tp("library.toasts.copySuccess", successCount),
        color: "green",
      });
    }
    if (failCount > 0) {
      const { showToast } = await import("$lib/components/toast.svelte");
      showToast({
        message: locale.tp("library.toasts.copyFailed", failCount),
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

  applyPrivacyStyles();

  return {
    requestThumbnail,
    thumbnailUrl,
    isThumbnailFailed,
    get thumbnailsPaused() {
      return thumbnailsPaused();
    },
    get activeTab() {
      return activeTab;
    },
    get tabDirection() {
      return tabDirection;
    },
    setActiveTab,
    cycleActiveTab,
    get recentFiles() {
      return recentFiles;
    },
    addRecent,
    flushRecentSave,
    clearRecentFiles,
    get recentFilesLimit() {
      return recentFilesLimit;
    },
    setRecentFilesLimit,
    get recentRetentionDays() {
      return recentRetentionDays;
    },
    setRecentRetentionDays,
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
    get fileFilters() {
      return fileFilters;
    },
    setFileKindVisible,
    get thumbnailSize() {
      return thumbnailSize;
    },
    setThumbnailSize,
    get showCollectionCovers() {
      return true;
    },
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
    get searchQuery() {
      return searchQuery;
    },
    get searchActive() {
      return searchActive;
    },
    get searchFocusNonce() {
      return searchFocusNonce;
    },
    setSearchQuery,
    clearSearch,
    requestSearchFocus,
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
    get privacyBlur() {
      return privacyBlur;
    },
    setPrivacyBlur,
    get privacyHideNames() {
      return privacyHideNames;
    },
    setPrivacyHideNames,
    get privacyRevealHover() {
      return privacyRevealHover;
    },
    setPrivacyRevealHover,
    get viewInfo() {
      return viewInfo;
    },
    setViewInfo,
    clearViewInfo,
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
    isValidCollectionName,
    addCollection,
    createCustomCollection,
    removeCollection,
    renameCollection,
    migrateFilePath,
    migrateFolderPath,
    get activeCollectionPath() {
      return activeCollectionPath;
    },
    get generating() {
      return isGeneratingThumbnails();
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
