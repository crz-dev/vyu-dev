<script lang="ts">
  import {
    IMAGE_EXTS,
    VIDEO_EXTS,
    AUDIO_EXTS,
    DOCUMENT_EXTS,
    ALL_EXTS_SET,
  } from "$lib/shared/constants";
  import {
    getFileExt,
    getFileName,
    getParentFolder,
    joinPath,
    typeRank,
  } from "$lib/services/files";
  import { cubicInOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { tick, untrack } from "svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { isTypingTarget } from "$lib/features/keybinds/keybindUtils";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import {
    getSections,
    translateSectionLabel,
    type Section,
  } from "$lib/features/library/sections";
  import {
    matchesLibrarySearch,
    parseLibrarySearch,
  } from "$lib/features/library/search";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import type { BatchStatItem } from "$lib/shared/types";
  import { open } from "@tauri-apps/plugin-dialog";
  import { readDir } from "@tauri-apps/plugin-fs";
  import {
    invokeOpenWithDialog,
    invokeOpenDirectory,
    invokeTrashFile,
    invokeRenameFile,
    invokeBatchStat,
    invokeCreateCollectionFolder,
    invokeDeleteCollectionFolder,
    invokeCopyFileUnique,
  } from "$lib/features/media/api";
  import { showToast } from "$lib/components/toast.svelte";
  import { maskFileName } from "$lib/shared/privacy";
  import { menuStore } from "$lib/features/menus/menuVisibility.svelte";
  import { saveLastDialogSection } from "$lib/services/storage";
  import { computeContextMenuPosition } from "$lib/services/session";
  import { TS_DROP_ANIM_DELAYS_MS } from "$lib/features/menus/dropAnimations";
  import ThumbnailGenToast from "$lib/components/ThumbnailGenToast.svelte";

  let {
    fileList,
    currentIndex,
    onSelect,
    onClose,
    onFileMoved,
    onFolderMoved,
    selectMode = false,
  }: {
    fileList: string[];
    currentIndex: number;
    onSelect: (path: string) => void;
    onClose: () => void;
    onFileMoved?: (oldPath: string, newPath: string) => void | Promise<void>;
    onFolderMoved?: (
      oldFolderPath: string,
      newFolderPath: string,
    ) => void | Promise<void>;
    selectMode?: boolean;
  } = $props();

  const t = locale.t;
  const tp = locale.tp;
  const swipeDuration = $derived(appearance.reducedMotion ? 0 : 240);
  const headerMotionMs = $derived(appearance.reducedMotion ? 0 : 180);
  const labelMotionMs = $derived(appearance.reducedMotion ? 0 : 160);

  function shortcutSuffix(id: string): string {
    const label = keybindStore.label(id);
    return label ? ` (${label})` : "";
  }

  function scrollBehavior(): ScrollBehavior {
    return appearance.reducedMotion ? "auto" : "smooth";
  }

  let tabsEl: HTMLDivElement | null = $state(null);
  let tabHighlight = $state({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  let tabHighlightReady = $state(false);

  function swipe(
    node: Element,
    {
      direction,
      duration,
      easing,
      enabled = true,
    }: {
      direction: number;
      duration: number;
      easing: (value: number) => number;
      enabled?: boolean;
    },
  ) {
    if (!enabled) return { duration: 0 };

    const width = node.getBoundingClientRect().width;

    return {
      duration,
      easing,
      css: (t: number) => {
        const offset = (1 - t) * direction * width;
        return `transform: translate3d(${offset}px, 0, 0); opacity: ${t};`;
      },
    };
  }

  let scrollEl: HTMLDivElement | null = $state(null);
  let viewEl: HTMLDivElement | null = $state(null);
  let searchEl: HTMLDivElement | null = $state(null);
  let searchInputEl: HTMLInputElement | null = $state(null);
  let searchOpen = $state(false);
  const searchTokens = $derived(parseLibrarySearch(library.searchQuery));

  let filterBtnEl: HTMLButtonElement | null = $state(null);
  let filterOpen = $state(false);
  let filterHintVisible = $state(false);
  let filterHintTimer: ReturnType<typeof setTimeout> | undefined;
  let searchRight = $state(8);
  let searchDismissed = $state(false);
  const searchExpanded = $derived(
    searchOpen || (library.searchActive && !filterOpen && !searchDismissed),
  );
  const searchExtrasVisible = $derived(library.searchActive && searchExpanded);
  const hiddenFilterCount = $derived(
    Object.values(library.fileFilters).filter((visible) => !visible).length,
  );
  const filterKinds: ReadonlyArray<{
    kind: keyof typeof library.fileFilters;
    labelKey: string;
    icon: string;
  }> = [
    {
      kind: "images",
      labelKey: "settings.library.fileTypes.images",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    },
    {
      kind: "videos",
      labelKey: "settings.library.fileTypes.videos",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
    },
    {
      kind: "audio",
      labelKey: "settings.library.fileTypes.audio",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    },
    {
      kind: "documents",
      labelKey: "settings.library.fileTypes.docs",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    },
  ];

  let mounted = $state(false);
  let destroyed = false;
  let keyboardCursorHidden = $state(false);
  let imageDims = $state<Record<string, { w: number; h: number }>>({});
  let highlightIndex = $state(0);
  let renderDividers = $state(library.dividersOn);
  let headersExiting = $state(false);
  let filmstripReady = $state(false);
  let filmstripReadyKey = "";
  let filmstripLastDensity = -1;
  let filmstripLastIndex = -1;
  let lastManualHighlight = 0;

  let dragStart: { x: number; y: number } | null = $state(null);
  let dragEnd: { x: number; y: number } | null = $state(null);
  let isDragging = $state(false);
  let dragSuppressedClick = $state(false);
  let lastClickedIndex: number | null = null;

  let collectionFiles = $state<string[]>([]);
  let collectionFolders = $state<string[]>([]);
  let collectionFirstFiles = $state<Record<string, string>>({});
  let renamingPath = $state<string | null>(null);
  let renameValue = $state("");
  let renameOriginal = $state("");
  let showAddCollectionDialog = $state(false);
  let newCollectionName = $state("");
  let newCollectionThumbnail = $state<string | null>(null);
  let nameError = $state(false);
  let nameErrorTimer: ReturnType<typeof setTimeout> | null = null;
  let collectionToDelete = $state<string | null>(null);

  let showGenToast = $state(false);
  let genToastTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (library.generating) {
      genToastTimer = setTimeout(() => {
        showGenToast = true;
      }, 1000);
    } else {
      if (genToastTimer) clearTimeout(genToastTimer);
      showGenToast = false;
    }
    return () => {
      if (genToastTimer) clearTimeout(genToastTimer);
    };
  });

  let libraryDirPath = $state<string | null>(null);
  let libraryBasePath = $state<string | null>(null);
  let libraryDirFolders = $state<string[]>([]);
  let libraryDirFiles = $state<string[]>([]);
  let folderStats = $state<Record<string, BatchStatItem>>({});

  let libCtxMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
  }>({ visible: false, x: 0, y: 0, path: "" });
  let libCtxPinned = $state(false);

  let colCtxMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
    name: string;
  }>({ visible: false, x: 0, y: 0, path: "", name: "" });
  let colCtxPinned = $state(false);
  let libCtxEl = $state<HTMLDivElement | null>(null);
  let colCtxEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const menu = libCtxEl;
    if (!libCtxMenu.visible || !menu) return;
    const maxX = Math.max(8, window.innerWidth - menu.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - menu.offsetHeight - 8);
    const x = Math.max(8, Math.min(libCtxMenu.x, maxX));
    const y = Math.max(8, Math.min(libCtxMenu.y, maxY));
    if (x !== libCtxMenu.x || y !== libCtxMenu.y) {
      libCtxMenu = { ...libCtxMenu, x, y };
    }
  });

  $effect(() => {
    const menu = colCtxEl;
    if (!colCtxMenu.visible || !menu) return;
    const maxX = Math.max(8, window.innerWidth - menu.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - menu.offsetHeight - 8);
    const x = Math.max(8, Math.min(colCtxMenu.x, maxX));
    const y = Math.max(8, Math.min(colCtxMenu.y, maxY));
    if (x !== colCtxMenu.x || y !== colCtxMenu.y) {
      colCtxMenu = { ...colCtxMenu, x, y };
    }
  });

  const IMAGE_SET = new Set(IMAGE_EXTS);
  const VIDEO_SET = new Set(VIDEO_EXTS);
  const AUDIO_SET = new Set(AUDIO_EXTS);
  function isVisibleFile(path: string): boolean {
    const ext = getFileExt(path);
    if (IMAGE_SET.has(ext)) return library.fileFilters.images;
    if (VIDEO_SET.has(ext)) return library.fileFilters.videos;
    if (AUDIO_SET.has(ext)) return library.fileFilters.audio;
    if (DOCUMENT_EXTS.includes(ext)) return library.fileFilters.documents;
    return true;
  }

  function displayName(path: string): string {
    return library.privacyMode && library.privacyHideNames
      ? maskFileName(path)
      : getFileName(path);
  }

  function densityMap(
    d: number,
    big: number,
    def: number,
    small: number,
  ): number {
    return d <= 0.5
      ? big + (def - big) * (d / 0.5)
      : def + (small - def) * ((d - 0.5) / 0.5);
  }

  const gridMinCol = $derived(densityMap(library.density, 480, 180, 80));
  const riverRowH = $derived(densityMap(library.density, 380, 140, 50));
  const filmstripBase = $derived(densityMap(library.density, 550, 240, 100));
  const listThumbSize = $derived(densityMap(library.density, 72, 32, 18));
  const listRowPad = $derived(densityMap(library.density, 8, 4, 2));
  const listFontSize = $derived(densityMap(library.density, 16, 13, 10));
  const listTypeFontSize = $derived(densityMap(library.density, 14, 12, 9));

  let scrollTop = $state(0);
  let containerHeight = $state(0);
  let containerWidth = $state(0);
  let scrolling = $state(false);
  let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
  const GRID_GAP = 6;
  const GRID_HORIZONTAL_PADDING = 48;
  const GRID_OVERSCAN = 5;
  // Prefetch further ahead than we render so cached thumbnails are already in
  // memory by the time a row scrolls into view.
  const GRID_THUMB_LOOKAHEAD_ROWS = 8;
  const gridContentWidth = $derived(
    containerWidth > 0
      ? Math.max(0, containerWidth - GRID_HORIZONTAL_PADDING)
      : 0,
  );

  const gridColCount = $derived(
    gridContentWidth > 0
      ? Math.max(
          1,
          Math.floor((gridContentWidth + GRID_GAP) / (gridMinCol + GRID_GAP)),
        )
      : 1,
  );
  const gridRowHeight = $derived(
    gridContentWidth > 0 && gridColCount > 0
      ? (gridContentWidth - (gridColCount - 1) * GRID_GAP) / gridColCount
      : gridMinCol,
  );
  const gridRowStep = $derived(gridRowHeight + GRID_GAP);

  const flatGridItems = $derived.by(() => {
    if (library.viewMode !== "grid" || renderDividers) return null;
    const items: { type: "folder" | "file"; path: string }[] = [];
    if (library.activeTab === "favorites") {
      items.push({ type: "file", path: "__add_favorite__" });
    }
    if (isViewingCollection) {
      items.push({ type: "file", path: "__add_files__" });
    }
    for (const section of displaySections) {
      for (const path of section.items) {
        if (!library.showFolders || !folderPathSet.has(path)) {
          items.push({ type: "file", path });
        }
      }
    }
    if (library.showFolders) {
      for (const fp of currentFolderPaths) {
        items.push({ type: "folder", path: fp });
      }
    }
    return items;
  });

  type GridRange = {
    firstIdx: number;
    lastIdx: number;
    topSpacer: number;
    bottomSpacer: number;
  };
  let lastGridRange: GridRange | null = null;

  const gridVirtualRange = $derived.by(() => {
    if (!flatGridItems || flatGridItems.length === 0) {
      lastGridRange = null;
      return null;
    }
    const totalRows = Math.ceil(flatGridItems.length / gridColCount);
    const firstRow = Math.max(
      0,
      Math.floor(scrollTop / gridRowStep) - GRID_OVERSCAN,
    );
    const lastRow = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + containerHeight) / gridRowStep) + GRID_OVERSCAN,
    );
    const firstIdx = firstRow * gridColCount;
    const lastIdx = Math.min(
      flatGridItems.length - 1,
      (lastRow + 1) * gridColCount - 1,
    );
    const topSpacer = firstRow * gridRowStep;
    const bottomSpacer = Math.max(0, (totalRows - lastRow - 1) * gridRowStep);
    const next: GridRange = { firstIdx, lastIdx, topSpacer, bottomSpacer };

    // Reuse the previous object while the rendered window is unchanged so
    // sub-pixel scrolling does not invalidate the grid markup every frame.
    const prev = lastGridRange;
    if (
      prev !== null &&
      prev.firstIdx === next.firstIdx &&
      prev.lastIdx === next.lastIdx &&
      prev.topSpacer === next.topSpacer &&
      prev.bottomSpacer === next.bottomSpacer
    ) {
      return prev;
    }
    lastGridRange = next;
    return next;
  });

  const activePaths = $derived.by(() => {
    const path = sortedFiles[highlightIndex];
    return path ? new Set([path]) : new Set<string>();
  });

  const isPlaceholderTab = $derived(
    library.activeTab === "collections" && !library.activeCollectionPath,
  );

  const isViewingCollection = $derived(
    library.activeTab === "collections" &&
      library.activeCollectionPath !== null,
  );

  const activeCollection = $derived(
    library.collections.find((c) => c.path === library.activeCollectionPath) ??
      null,
  );

  const isCustomCollection = $derived(activeCollection?.type === "custom");

  const collectionItemCount = $derived(
    collectionFolders.length + collectionFiles.filter(isVisibleFile).length,
  );

  const recentFilesWarning = $derived(
    !library.recentsDisabled &&
      library.recentFiles.length / library.recentFilesLimit >= 0.9,
  );

  function openRecentsSettings() {
    saveLastDialogSection("settings", "library");
    menuStore.openSettingsAt("library", "recents");
  }

  const isShowingFolders = $derived(isViewingCollection && library.showFolders);

  const currentFolderPaths = $derived.by(() => {
    if (!library.showFolders) return [];
    const folders = isViewingCollection ? collectionFolders : libraryDirFolders;
    if (folders.length === 0) return folders;
    const sorted = [...folders];
    const mode = library.sortMode;
    const desc = library.sortDesc;
    const stats = folderStats;
    sorted.sort((a, b) => {
      let cmp = 0;
      if (mode === "name" || mode === "type") {
        cmp = getFileName(a).localeCompare(getFileName(b), undefined, {
          sensitivity: "base",
        });
      } else if (
        mode === "date-modified" ||
        mode === "date-opened" ||
        mode === "date-created"
      ) {
        const aTime = stats[a]?.mtime_ms ?? 0;
        const bTime = stats[b]?.mtime_ms ?? 0;
        cmp = aTime - bTime;
      } else if (mode === "size") {
        const aSize = stats[a]?.size ?? 0;
        const bSize = stats[b]?.size ?? 0;
        cmp = aSize - bSize;
      }
      return desc ? -cmp : cmp;
    });
    if (!library.searchActive) return sorted;
    return sorted.filter((path) =>
      matchesLibrarySearch(getFileName(path), searchTokens),
    );
  });

  function navigateToFolder(folderPath: string) {
    if (isViewingCollection) {
      library.openCollection(folderPath);
    } else {
      libraryDirPath = folderPath;
    }
  }

  const libraryRootName = $derived(
    libraryBasePath ? getFileName(libraryBasePath) : "",
  );

  const libraryBreadcrumb = $derived.by(() => {
    const current = libraryDirPath;
    const base = libraryBasePath;
    if (!current || !base) return [];
    if (current === base) return [];
    const sep = current.includes("\\") ? "\\" : "/";
    const relative = current.substring(base.length);
    const stripped = relative.replace(/^[\\/]/, "");
    if (!stripped) return [];
    const parts = stripped.split(/[\\/]/);
    const segments: { label: string; path: string }[] = [
      { label: t("library.tabs.library"), path: base },
    ];
    let acc = base;
    for (const part of parts) {
      acc += sep + part;
      segments.push({ label: part, path: acc });
    }
    return segments;
  });

  const breadcrumb = $derived.by(() => {
    const path = library.activeCollectionPath;
    if (!path) return [];
    const sep = path.includes("\\") ? "\\" : "/";
    const root = library.collections.find(
      (c) => path === c.path || path.startsWith(c.path + sep),
    );
    if (!root) return [];
    const segments: { label: string; path: string | null }[] = [
      { label: t("library.tabs.collections"), path: null },
      { label: root.name, path: root.path },
    ];
    const relative = path.substring(root.path.length);
    const stripped = relative.replace(/^[\\/]/, "");
    if (!stripped) return segments;
    const parts = stripped.split(/[\\/]/);
    let acc = root.path;
    for (const part of parts) {
      acc += sep + part;
      segments.push({ label: part, path: acc });
    }
    return segments;
  });

  const showFileGrid = $derived(
    library.activeTab !== "collections" || isViewingCollection,
  );

  const displayFilesRaw = $derived.by(() => {
    if (
      library.activeTab === "recents" &&
      (library.privacyMode || library.recentsDisabled)
    )
      return [];
    if (library.activeTab === "recents")
      return library.getRecentPaths().filter(isVisibleFile);
    if (library.activeTab === "favorites")
      return library.getFavoritePaths().filter(isVisibleFile);
    if (isViewingCollection) return collectionFiles.filter(isVisibleFile);
    if (library.activeTab === "library" && libraryDirPath)
      return libraryDirFiles.filter(isVisibleFile);
    return fileList.filter(isVisibleFile);
  });

  const displayFiles = $derived.by(() => {
    if (!library.searchActive) return displayFilesRaw;
    return displayFilesRaw.filter((path) =>
      matchesLibrarySearch(getFileName(path), searchTokens),
    );
  });

  const sortedFiles = $derived.by(() => {
    const files = [...displayFiles];
    const mode = library.sortMode;
    const desc = library.sortDesc;
    const statMap = library.stats;
    const openTs = library.recentTimestamps;
    const favTs = library.favoriteTimestamps;
    files.sort((a, b) => {
      let cmp = 0;
      if (mode === "name") {
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      } else if (mode === "type") {
        const aExt = getFileExt(a);
        const bExt = getFileExt(b);
        cmp = typeRank(aExt) - typeRank(bExt) || aExt.localeCompare(bExt);
      } else if (mode === "size") {
        const aSize = statMap[a]?.size ?? 0;
        const bSize = statMap[b]?.size ?? 0;
        cmp = aSize - bSize;
      } else if (mode === "date-modified") {
        const aTime = statMap[a]?.mtime_ms ?? 0;
        const bTime = statMap[b]?.mtime_ms ?? 0;
        cmp = aTime - bTime;
      } else if (mode === "date-opened") {
        const aTime = openTs?.[a] ?? 0;
        const bTime = openTs?.[b] ?? 0;
        cmp = aTime - bTime;
      } else if (mode === "date-created") {
        const aTime = statMap[a]?.birthtime_ms ?? 0;
        const bTime = statMap[b]?.birthtime_ms ?? 0;
        cmp = aTime - bTime;
      } else if (mode === "date-favorited") {
        const aTime = favTs?.[a] ?? 0;
        const bTime = favTs?.[b] ?? 0;
        cmp = aTime - bTime;
      } else {
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      }
      return desc ? -cmp : cmp;
    });
    return files;
  });

  const sectionTimestamps = $derived(
    library.sortMode === "date-favorited"
      ? library.favoriteTimestamps
      : library.sortMode === "date-opened"
        ? library.recentTimestamps
        : undefined,
  );

  const sections = $derived(
    renderDividers
      ? getSections(
          library.activeTab === "library"
            ? library.sortDesc
              ? [...currentFolderPaths, ...sortedFiles]
              : [...sortedFiles, ...currentFolderPaths]
            : [...sortedFiles, ...currentFolderPaths],
          library.sortMode,
          { ...library.stats, ...folderStats },
          library.sortDesc,
          sectionTimestamps,
        )
      : [],
  );

  const sortedCollectionsRaw = $derived.by(() => {
    const cols = [...library.collections];
    const mode = library.sortMode;
    const desc = library.sortDesc;
    if (mode === "date-created" || mode === "date-modified") {
      cols.sort((a, b) => {
        const aTime = a.createdAt ?? 0;
        const bTime = b.createdAt ?? 0;
        return desc ? bTime - aTime : aTime - bTime;
      });
    } else if (mode === "type") {
      cols.sort((a, b) => {
        const aType = a.type ?? "linked";
        const bType = b.type ?? "linked";
        const cmp = aType.localeCompare(bType);
        return desc ? -cmp : cmp;
      });
    } else if (mode === "name" || mode === "size") {
      cols.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
        return desc ? -cmp : cmp;
      });
    }
    return cols;
  });

  const sortedCollections = $derived.by(() => {
    if (!library.searchActive) return sortedCollectionsRaw;
    return sortedCollectionsRaw.filter((col) =>
      matchesLibrarySearch(col.name, searchTokens),
    );
  });

  // Counts for the search field. The collections root shows collections
  // instead of files, so the totals follow the active branch.
  const searchResultCount = $derived(
    showFileGrid
      ? displayFiles.length + currentFolderPaths.length
      : sortedCollections.length,
  );
  const searchTotal = $derived(
    showFileGrid
      ? displayFilesRaw.length +
          (library.showFolders
            ? isViewingCollection
              ? collectionFolders.length
              : libraryDirFolders.length
            : 0)
      : sortedCollectionsRaw.length,
  );
  const searchHasNoResults = $derived(
    library.searchActive && searchResultCount === 0 && searchTotal > 0,
  );

  const collectionSections = $derived.by(() => {
    const cols = sortedCollections;
    if (!renderDividers || cols.length === 0) {
      return [{ label: "", items: cols }];
    }

    const mode = library.sortMode;
    const groups = new Map<string, typeof cols>();

    for (const col of cols) {
      let key: string;
      if (mode === "date-created" || mode === "date-modified") {
        const ts = col.createdAt ?? 0;
        if (!ts) {
          key = "Unknown";
        } else {
          const d = new Date(ts);
          const now = new Date();
          const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const weekStart = new Date(today);
          weekStart.setDate(weekStart.getDate() - today.getDay());

          if (d >= today) key = "Today";
          else if (d >= yesterday) key = "Yesterday";
          else if (d >= weekStart) key = "This Week";
          else key = "Older";
        }
      } else if (mode === "type") {
        key = col.type === "custom" ? "Custom collection" : "Linked folder";
      } else if (mode === "name" || mode === "size") {
        const c = (col.name[0] || "#").toLowerCase();
        if (!/[a-z]/.test(c)) key = "#";
        else if (c <= "c") key = "A-C";
        else if (c <= "f") key = "D-F";
        else if (c <= "i") key = "G-I";
        else if (c <= "l") key = "J-L";
        else if (c <= "o") key = "M-O";
        else if (c <= "r") key = "P-R";
        else if (c <= "u") key = "S-U";
        else key = "V-Z";
      } else {
        key = "Other";
      }

      let arr = groups.get(key);
      if (!arr) {
        arr = [];
        groups.set(key, arr);
      }
      arr.push(col);
    }

    const sections: { label: string; items: typeof cols }[] = [];

    if (mode === "date-created" || mode === "date-modified") {
      const order = ["Today", "Yesterday", "This Week", "Older", "Unknown"];
      for (const label of order) {
        const items = groups.get(label);
        if (items) {
          sections.push({ label: translateSectionLabel(label), items });
        }
      }
    } else if (mode === "type") {
      const order = library.sortDesc
        ? ["Custom collection", "Linked folder"]
        : ["Linked folder", "Custom collection"];
      for (const label of order) {
        const items = groups.get(label);
        if (items) {
          sections.push({ label: translateSectionLabel(label), items });
        }
      }
    } else if (mode === "name" || mode === "size") {
      const order = [
        "#",
        "A-C",
        "D-F",
        "G-I",
        "J-L",
        "M-O",
        "P-R",
        "S-U",
        "V-Z",
      ];
      const ordered = library.sortDesc ? [...order].reverse() : order;
      for (const label of ordered) {
        const items = groups.get(label);
        if (items) {
          sections.push({ label: translateSectionLabel(label), items });
        }
      }
      for (const [label, items] of groups) {
        if (!ordered.includes(label)) {
          sections.push({ label: translateSectionLabel(label), items });
        }
      }
    } else {
      for (const [label, items] of groups) {
        sections.push({ label: translateSectionLabel(label), items });
      }
    }

    return sections;
  });

  const folderPathSet = $derived(new Set(currentFolderPaths));

  // Filmstrip section dividers — files grouped by section label (folders rendered separately)
  const filmstripSections = $derived.by(() => {
    const raw = displaySections;
    return raw
      .map((s) => ({
        label: s.label,
        items: s.items.filter((p) => !folderPathSet.has(p)),
      }))
      .filter((s) => s.items.length > 0);
  });

  const displaySections = $derived(
    renderDividers && sections.length > 0
      ? sections
      : library.activeTab === "library"
        ? [
            {
              label: "",
              items: library.sortDesc
                ? [...currentFolderPaths, ...sortedFiles]
                : [...sortedFiles, ...currentFolderPaths],
            },
          ]
        : [{ label: "", items: sortedFiles }],
  );

  const allFilesSelected = $derived(
    sortedFiles.length > 0 && sortedFiles.every((p) => library.isSelected(p)),
  );
  const someFilesSelected = $derived(
    !allFilesSelected && sortedFiles.some((p) => library.isSelected(p)),
  );

  function thumbFor(path: string) {
    return library.thumbnailUrl(path);
  }

  function thumbFailed(path: string) {
    // A paused generator is not "loading"; do not shimmer forever.
    return (
      library.isThumbnailFailed(path) ||
      (library.thumbnailsPaused && !thumbFor(path))
    );
  }

  function getMediaBadge(path: string) {
    const ext = getFileExt(path);
    if (VIDEO_SET.has(ext)) return "video";
    if (ext === "gif") return "gif";
    if (AUDIO_SET.has(ext)) return "audio";
    if (DOCUMENT_EXTS.includes(ext)) return "pdf";
    return null;
  }

  function getExt(path: string): string {
    return getFileExt(path).toUpperCase();
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
  }

  function formatDate(ms: number): string {
    if (!ms) return "";
    const d = new Date(ms);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (wasYesterday) return t("library.sections.date.yesterday");
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function openAddCollectionDialog() {
    showAddCollectionDialog = true;
    newCollectionName = "";
    newCollectionThumbnail = null;
    clearNameError();
  }

  function addCollAnimStyle(delayIndex: number): string {
    return `animation: tsDropItemPopIn 200ms cubic-bezier(0.22, 0.8, 0.3, 1) backwards; animation-delay: ${TS_DROP_ANIM_DELAYS_MS[delayIndex]}ms`;
  }

  async function addCollection() {
    showAddCollectionDialog = false;
    const dir = await open({ directory: true });
    if (dir) {
      library.addCollection(dir as string);
    }
  }

  function clearNameError() {
    nameError = false;
    if (nameErrorTimer) {
      clearTimeout(nameErrorTimer);
      nameErrorTimer = null;
    }
  }

  function triggerNameError() {
    clearNameError();
    nameError = true;
    nameErrorTimer = setTimeout(() => {
      nameError = false;
      nameErrorTimer = null;
    }, 2000);
  }

  async function pickThumbnail() {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: t("library.dialog.images"),
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "gif",
            "bmp",
            "webp",
            "tiff",
            "avif",
          ],
        },
      ],
    });
    if (selected) {
      newCollectionThumbnail = selected as string;
    }
  }

  async function confirmCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) {
      triggerNameError();
      return;
    }
    if (
      library.collections.some(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      triggerNameError();
      return;
    }
    if (!library.isValidCollectionName(name)) {
      triggerNameError();
      showToast({
        message: t("library.dialog.invalidCollectionName"),
        color: "red",
      });
      return;
    }
    clearNameError();
    const created = await library.createCustomCollection(
      name,
      newCollectionThumbnail ?? undefined,
    );
    if (!created) {
      showToast({
        message: t("library.toasts.collectionCreateFailed"),
        color: "red",
      });
      return;
    }
    showAddCollectionDialog = false;
    newCollectionName = "";
    newCollectionThumbnail = null;
  }

  function startDeleteCollection(path: string) {
    collectionToDelete = path;
  }

  function cancelDeleteCollection() {
    collectionToDelete = null;
  }

  async function confirmDeleteCollection() {
    if (!collectionToDelete) return;
    const path = collectionToDelete;
    collectionToDelete = null;
    const removed = await library.removeCollection(path);
    if (!removed) {
      showToast({
        message: t("library.toasts.collectionDeleteFailed"),
        color: "red",
      });
    }
  }

  async function addFilesToCollection() {
    const path = library.activeCollectionPath;
    if (!path) return;
    const selected = await open({ multiple: true });
    if (!selected || selected.length === 0) return;
    const files = Array.isArray(selected) ? selected : [selected];
    for (const file of files) {
      try {
        await invokeCopyFileUnique(file, path);
      } catch (err) {
        console.error("Failed to copy file to collection:", err);
      }
    }
    const sep = path.includes("\\") ? "\\" : "/";
    const entries = await readDir(path);
    const folders: string[] = [];
    const filesList: string[] = [];
    for (const e of entries) {
      const full = `${path}${sep}${e.name}`;
      if (e.isDirectory) {
        folders.push(full);
      } else if (ALL_EXTS_SET.has(getFileExt(e.name ?? ""))) {
        filesList.push(full);
      }
    }
    collectionFolders = folders;
    collectionFiles = filesList;
    if (!destroyed) {
      library.setViewInfo({ kind: "folder", path, files: filesList, folders });
    }
  }

  function startRename(path: string, currentName: string) {
    renamingPath = path;
    renameValue = currentName;
    renameOriginal = currentName;
  }

  async function confirmRename() {
    if (!renamingPath) return;
    const path = renamingPath;
    const nextName = renameValue.trim();
    renamingPath = null;
    if (nextName === renameOriginal) return;
    if (!library.isValidCollectionName(nextName)) {
      showToast({
        message: t("library.dialog.invalidCollectionName"),
        color: "red",
      });
      return;
    }
    const newPath = await library.renameCollection(path, nextName);
    if (newPath) {
      await onFolderMoved?.(path, newPath);
    } else {
      showToast({
        message: t("library.toasts.collectionRenameFailed"),
        color: "red",
      });
    }
  }

  function cancelRename() {
    renamingPath = null;
  }

  function openLibCtxMenu(e: MouseEvent, path: string) {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 200;
    const menuH = 220;
    const { x, y } = computeContextMenuPosition(
      e.clientX,
      e.clientY,
      menuW,
      menuH,
    );
    libCtxMenu = { visible: true, x, y, path };
    libCtxPinned = false;
  }

  function closeLibCtxMenu() {
    if (libCtxPinned || !libCtxMenu.visible) return;
    libCtxMenu = { ...libCtxMenu, visible: false };
    libCtxPinned = false;
  }

  function forceCloseLibCtxMenu() {
    libCtxMenu = { ...libCtxMenu, visible: false };
    libCtxPinned = false;
  }

  async function ctxOpenWith() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    try {
      await invokeOpenWithDialog(path);
    } catch {
      showToast({ message: t("library.toasts.openWithFailed"), color: "red" });
    }
  }

  async function ctxMoveTo() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    try {
      const destDir = await open({ directory: true });
      if (!destDir) return;
      const fileName = getFileName(path);
      const destPath = joinPath(destDir as string, fileName);
      await invokeRenameFile(path, destPath);
      await onFileMoved?.(path, destPath);
      library.triggerRescan();
      showToast({ message: t("library.toasts.fileMoved"), color: "green" });
    } catch {
      showToast({ message: t("library.toasts.moveFailed"), color: "red" });
    }
  }

  function ctxCollect() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    library.clearSelection();
    library.toggleSelect(path);
    library.closeCollection();
    library.setCollectMode(true);
    library.setActiveTab("collections");
  }

  function ctxFavorite() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    if (library.isFavorite(path)) {
      library.removeFavorite(path);
      showToast({
        message: t("library.toasts.favoriteRemoved"),
        color: "red",
      });
    } else {
      library.addFavorite(path);
      showToast({
        message: t("library.toasts.favoriteAdded"),
        color: "green",
      });
    }
  }

  async function ctxDelete() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    try {
      await invokeTrashFile(path);
      library.triggerRescan();
      showToast({ message: t("library.toasts.fileDeleted"), color: "red" });
    } catch {
      showToast({ message: t("library.toasts.deleteFailed"), color: "red" });
    }
  }

  function openColCtxMenu(e: MouseEvent, path: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 200;
    const menuH = 220;
    const { x, y } = computeContextMenuPosition(
      e.clientX,
      e.clientY,
      menuW,
      menuH,
    );
    colCtxMenu = { visible: true, x, y, path, name };
    colCtxPinned = false;
  }

  function closeColCtxMenu() {
    if (colCtxPinned || !colCtxMenu.visible) return;
    colCtxMenu = { ...colCtxMenu, visible: false };
    colCtxPinned = false;
  }

  function forceCloseColCtxMenu() {
    colCtxMenu = { ...colCtxMenu, visible: false };
    colCtxPinned = false;
  }

  function ctxRenameCol() {
    const { path, name } = colCtxMenu;
    closeColCtxMenu();
    startRename(path, name);
  }

  async function ctxChangeCoverCol() {
    const { path } = colCtxMenu;
    closeColCtxMenu();
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: t("library.dialog.images"),
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "gif",
            "bmp",
            "webp",
            "tiff",
            "avif",
          ],
        },
      ],
    });
    if (selected) {
      library.setCollectionThumbnail(path, selected as string);
      delete collectionFirstFiles[path];
      collectionFirstFiles = { ...collectionFirstFiles };
    }
  }

  function ctxShowInExplorerCol() {
    const path = colCtxMenu.path;
    closeColCtxMenu();
    invokeOpenDirectory(path);
  }

  function ctxDeleteCol() {
    const path = colCtxMenu.path;
    closeColCtxMenu();
    startDeleteCollection(path);
  }

  async function addFavoriteFromFile() {
    try {
      const file = await open({ multiple: false });
      if (file) {
        library.addFavorite(file as string);
        showToast({
          message: t("library.toasts.favoriteAdded"),
          color: "green",
        });
      }
    } catch {
      showToast({
        message: t("library.toasts.favoriteAddFailed"),
        color: "red",
      });
    }
  }

  function onImageLoad(path: string, e: Event) {
    const img = e.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      imageDims[path] = { w: img.naturalWidth, h: img.naturalHeight };
    }
  }

  function openHighlighted() {
    const path = sortedFiles[highlightIndex];
    if (path) onSelect(path);
  }

  function focusSearch() {
    if (searchExpanded) {
      searchDismissed = true;
      searchOpen = false;
      searchInputEl?.blur();
      return;
    }
    filterOpen = false;
    searchDismissed = false;
    searchOpen = true;
    requestAnimationFrame(() => {
      searchInputEl?.focus();
      searchInputEl?.select();
    });
  }

  function clearSearch() {
    searchDismissed = true;
    searchOpen = false;
    library.clearSearch();
    viewEl?.focus({ preventScroll: true });
  }

  function toggleFilterRow() {
    const next = !filterOpen;
    filterOpen = next;
    // One expanded header control at a time: on narrow viewports their cards
    // would otherwise overlap and stack two borders.
    if (next) searchOpen = false;
  }

  function handleFilterFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    filterOpen = false;
  }

  function handleFilterKeydown(e: KeyboardEvent) {
    if (!filterOpen || e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    filterOpen = false;
    filterBtnEl?.focus({ preventScroll: true });
  }

  function isFilterKindLocked(kind: keyof typeof library.fileFilters) {
    return library.fileFilters[kind] && hiddenFilterCount === 3;
  }

  function showFilterHint() {
    filterHintVisible = true;
    if (filterHintTimer) clearTimeout(filterHintTimer);
    filterHintTimer = setTimeout(() => {
      filterHintTimer = undefined;
      filterHintVisible = false;
    }, 2600);
  }

  function toggleFilterKind(kind: keyof typeof library.fileFilters) {
    if (isFilterKindLocked(kind)) {
      showFilterHint();
      return;
    }
    library.setFileKindVisible(kind, !library.fileFilters[kind]);
  }

  // The hint bubble is anchored to the card; drop it when the card closes.
  $effect(() => {
    if (!filterOpen) filterHintVisible = false;
  });

  $effect(() => {
    return () => {
      if (filterHintTimer) clearTimeout(filterHintTimer);
    };
  });

  // Keep the search control aligned to the topbar's close button.
  $effect(() => {
    const sync = () => {
      const closeBtn = document.querySelector<HTMLElement>(
        "[data-topbar-close]",
      );
      if (closeBtn) {
        const rect = closeBtn.getBoundingClientRect();
        if (rect.width > 0) {
          searchRight = Math.round(
            window.innerWidth - (rect.left + rect.width / 2) - 14,
          );
        }
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  });

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (library.searchActive) {
        library.clearSearch();
      } else {
        searchOpen = false;
        viewEl?.focus({ preventScroll: true });
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showFileGrid && sortedFiles.length > 0) openHighlighted();
    }
  }

  function dismissSearch() {
    searchOpen = false;
    // Keep the query and its filtered results; only close the input. The
    // active search button stays highlighted.
    searchDismissed = true;
  }

  function handleSearchFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    dismissSearch();
    // A click on a non-focusable area leaves focus on the body; hand it back
    // to the library so arrow-key navigation keeps working.
    if (!next || next === document.body) viewEl?.focus({ preventScroll: true });
  }

  // Ctrl+F (and the keybind action) bump the nonce instead of holding focus
  // state in the page.
  $effect(() => {
    if (library.searchFocusNonce === 0) return;
    filterOpen = false;
    searchDismissed = false;
    searchOpen = true;
    requestAnimationFrame(() => {
      searchInputEl?.focus();
      searchInputEl?.select();
    });
  });

  // Filtering rewrites the list under the highlight, so restart navigation
  // from the top instead of leaving it on an off-screen index.
  let lastSearchQuery = library.searchQuery;
  $effect(() => {
    const query = library.searchQuery;
    if (query === lastSearchQuery) return;
    lastSearchQuery = query;
    highlightIndex = 0;
    scrollTop = 0;
    scrollEl?.scrollTo({ top: 0, behavior: "instant" });
  });

  // Keep the section headers mounted through their exit animation before
  // swapping back to the virtualized grid.
  $effect(() => {
    if (library.dividersOn) {
      if (!renderDividers) {
        const before = captureCellRects();
        renderDividers = true;
        headersExiting = false;
        void tick().then(() => animateCellShift(before));
      } else {
        headersExiting = false;
      }
      return;
    }
    if (!renderDividers) return;
    headersExiting = true;
    const timer = setTimeout(() => {
      const before = captureCellRects();
      renderDividers = false;
      headersExiting = false;
      void tick().then(() => animateCellShift(before));
    }, headerMotionMs + 20);
    return () => clearTimeout(timer);
  });

  function setHighlight(index: number) {
    if (sortedFiles.length === 0) return;
    const next = Math.max(0, Math.min(sortedFiles.length - 1, index));
    if (next === highlightIndex) return;
    highlightIndex = next;
    scrollHighlightIntoView();
  }

  function moveHighlight(direction: -1 | 1) {
    setHighlight(highlightIndex + direction);
  }

  function moveHighlightVertically(direction: -1 | 1) {
    if (library.viewMode !== "grid" && library.viewMode !== "river") {
      moveHighlight(direction);
      return;
    }
    if (sortedFiles.length === 0 || !scrollEl) return;

    const currentPath = sortedFiles[highlightIndex];
    if (!currentPath) return;
    const currentEl = scrollEl.querySelector<HTMLElement>(
      `[data-path="${cssAttr(currentPath)}"]`,
    );
    if (!currentEl) {
      // The virtualized grid may not have the current row mounted.
      moveHighlight(direction);
      return;
    }

    const fileSet = new Set(sortedFiles);
    const currentRect = currentEl.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    let bestPath: string | null = null;
    let bestRowDistance = Infinity;
    let bestCenterDistance = Infinity;

    for (const el of scrollEl.querySelectorAll<HTMLElement>("[data-path]")) {
      if (el === currentEl) continue;
      const path = el.dataset.path;
      if (!path || !fileSet.has(path)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const rowDistance =
        direction < 0
          ? currentRect.top - rect.bottom
          : rect.top - currentRect.bottom;
      if (rowDistance <= 0) continue;
      const centerDistance = Math.abs(
        rect.left + rect.width / 2 - currentCenterX,
      );
      const sameRow = Math.abs(rowDistance - bestRowDistance) < 1;
      if (
        rowDistance < bestRowDistance - 1 ||
        (sameRow && centerDistance < bestCenterDistance)
      ) {
        bestRowDistance = rowDistance;
        bestCenterDistance = centerDistance;
        bestPath = path;
      }
    }

    if (!bestPath) return;
    const nextIndex = sortedFiles.indexOf(bestPath);
    if (nextIndex !== -1) setHighlight(nextIndex);
  }

  function jumpToEdge(last: boolean) {
    setHighlight(last ? sortedFiles.length - 1 : 0);
  }

  async function deleteLibrarySelection() {
    const selected = library.getSelectedPaths();
    const paths =
      selected.length > 0
        ? selected
        : [sortedFiles[highlightIndex]].filter((p): p is string => !!p);
    if (paths.length === 0) return;
    try {
      for (const path of paths) await invokeTrashFile(path);
      library.clearSelection();
      library.triggerRescan();
      showToast({
        message: tp("library.toasts.filesDeleted", paths.length),
        color: "red",
      });
    } catch {
      showToast({ message: t("library.toasts.deleteFailed"), color: "red" });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && target.closest("input, textarea, [contenteditable='true']")) {
      return;
    }
    if (e.key === "Escape" && (libCtxMenu.visible || colCtxMenu.visible)) {
      e.preventDefault();
      e.stopPropagation();
      forceCloseLibCtxMenu();
      forceCloseColCtxMenu();
      return;
    }
    if (target?.closest(".context-menu, [role='menu']")) return;
    if (keybindStore.isRecording || keybindStore.cheatSheetOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (library.searchActive) {
        library.clearSearch();
        searchOpen = false;
        viewEl?.focus({ preventScroll: true });
        return;
      }
      if (isViewingCollection) {
        library.closeCollection();
      } else {
        onClose();
      }
      return;
    }

    const run = (fn: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };

    if (keybindStore.matches("library-first", e)) {
      run(() => jumpToEdge(false));
      return;
    }
    if (keybindStore.matches("library-last", e)) {
      run(() => jumpToEdge(true));
      return;
    }
    if (keybindStore.matches("library-open", e) || e.key === " ") {
      if (target?.closest("button, [role='button'], a")) return;
      run(openHighlighted);
      return;
    }
    if (keybindStore.matches("library-delete", e)) {
      run(() => void deleteLibrarySelection());
      return;
    }
  }

  function handleGlobalMouseDown(e: MouseEvent) {
    if (!libCtxMenu.visible && !colCtxMenu.visible) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest(".context-menu")) return;
    closeLibCtxMenu();
    closeColCtxMenu();
  }

  function handleGlobalClick(e: MouseEvent) {
    if (!library.searchActive && !searchExpanded) return;
    const target = e.target as HTMLElement | null;
    if (
      !searchEl ||
      !target ||
      searchEl.contains(target) ||
      target.closest(".context-menu")
    )
      return;
    const hadSearchFocus = searchEl.contains(document.activeElement);
    dismissSearch();
    if (hadSearchFocus) viewEl?.focus({ preventScroll: true });
  }

  function hideKeyboardCursor() {
    keyboardCursorHidden = true;
  }

  function showKeyboardCursor() {
    if (keyboardCursorHidden) keyboardCursorHidden = false;
  }

  $effect(() => {
    const root = document.documentElement;
    root.classList.toggle("library-keyboard-nav", keyboardCursorHidden);
    return () => root.classList.remove("library-keyboard-nav");
  });

  function isLibraryNavigationAllowed(e: KeyboardEvent): boolean {
    if (keybindStore.isRecording || keybindStore.cheatSheetOpen) return false;
    if (e.defaultPrevented) return false;
    if (isTypingTarget(e.target)) return false;
    if (menuStore.isAnyOpenExceptLibrary) return false;
    if (libCtxMenu.visible || colCtxMenu.visible) return false;
    return (
      document.querySelector(
        ".library-dialog-overlay, .delete-overlay, [role='dialog'], [role='menu'], .context-menu, .sort-menu, .select-menu.open",
      ) === null
    );
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && (libCtxMenu.visible || colCtxMenu.visible)) {
      e.preventDefault();
      e.stopPropagation();
      forceCloseLibCtxMenu();
      forceCloseColCtxMenu();
      return;
    }

    const isUp = keybindStore.matches("library-up", e);
    const isDown = keybindStore.matches("library-down", e);
    const isLeft = keybindStore.matches("library-left", e);
    const isRight = keybindStore.matches("library-right", e);
    if (!isUp && !isDown && !isLeft && !isRight) return;
    if (!isLibraryNavigationAllowed(e)) return;

    if (isUp) {
      e.preventDefault();
      e.stopPropagation();
      hideKeyboardCursor();
      moveHighlightVertically(-1);
      return;
    }
    if (isDown) {
      e.preventDefault();
      e.stopPropagation();
      hideKeyboardCursor();
      moveHighlightVertically(1);
      return;
    }
    if (isLeft) {
      e.preventDefault();
      e.stopPropagation();
      hideKeyboardCursor();
      moveHighlight(-1);
      return;
    }
    if (isRight) {
      e.preventDefault();
      e.stopPropagation();
      hideKeyboardCursor();
      moveHighlight(1);
    }
  }

  // Virtualization tracking
  function onScroll() {
    if (scrollEl) {
      scrollTop = scrollEl.scrollTop;
    }
    markScrolling();
  }

  function markScrolling() {
    scrolling = true;
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      scrolling = false;
      scrollIdleTimer = null;
    }, 120);
  }

  $effect(() => {
    return () => {
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    };
  });

  function rectsOverlap(
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ): boolean {
    return (
      a.left <= b.right &&
      a.right >= b.left &&
      a.top <= b.bottom &&
      a.bottom >= b.top
    );
  }

  function handleDragStart(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!selectMode && target.closest("[data-path]")) return;
    if (!scrollEl) return;
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY };
    dragEnd = { x: e.clientX, y: e.clientY };
    isDragging = false;
  }

  function handleDragMove(e: MouseEvent) {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isDragging = true;
      if (!e.shiftKey && !selectMode) {
        library.clearSelection();
      }
    }
    if (isDragging) {
      dragEnd = { x: e.clientX, y: e.clientY };
    }
  }

  function handleDragEnd(e: MouseEvent) {
    if (isDragging && dragStart && dragEnd) {
      const selRect = {
        left: Math.min(dragStart.x, dragEnd.x),
        right: Math.max(dragStart.x, dragEnd.x),
        top: Math.min(dragStart.y, dragEnd.y),
        bottom: Math.max(dragStart.y, dragEnd.y),
      };
      const cells = scrollEl?.querySelectorAll("[data-path]");
      const hitPaths: string[] = [];
      if (cells) {
        for (const cell of cells) {
          const r = cell.getBoundingClientRect();
          if (rectsOverlap(selRect, r)) {
            const p = (cell as HTMLElement).dataset.path;
            if (p) hitPaths.push(p);
          }
        }
      }
      if (hitPaths.length > 0) {
        library.selectRange(hitPaths);
      }
      dragSuppressedClick = true;
      queueMicrotask(() => {
        dragSuppressedClick = false;
      });
    }
    dragStart = null;
    dragEnd = null;
    isDragging = false;
  }

  const dragRect = $derived.by(() => {
    if (!dragStart || !dragEnd) return null;
    return {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y),
    };
  });

  $effect(() => {
    requestAnimationFrame(() => {
      mounted = true;
      viewEl?.focus({ preventScroll: true });
    });
    return () => {
      mounted = false;
    };
  });

  $effect(() => {
    const tabs = tabsEl;
    const activeTab = library.activeTab;
    if (!tabs) return;

    const updateHighlight = () => {
      const button = tabs.querySelector<HTMLButtonElement>(
        `[data-tab="${activeTab}"]`,
      );
      if (!button) return;

      const tabsRect = tabs.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      tabHighlight = {
        left: buttonRect.left - tabsRect.left,
        top: buttonRect.top - tabsRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      };
      if (!tabHighlightReady) {
        requestAnimationFrame(() => {
          tabHighlightReady = true;
        });
      }
    };

    const frame = requestAnimationFrame(updateHighlight);
    const observer = new ResizeObserver(updateHighlight);
    observer.observe(tabs);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  $effect(() => {
    library.activeTab;
    if (!scrollEl) return;
    // The shared scroll container can clamp when the next tab is shorter.
    // Mirror the real position so virtualization stays in sync without
    // resetting the viewport.
    scrollTop = scrollEl.scrollTop;
  });

  // Every rendered cell asks the shared service for its thumbnail. For the
  // virtualised grid we also preload several rows beyond the rendered window so
  // a thumbnail is already in memory by the time it scrolls into view.
  $effect(() => {
    if (!library.showThumbnails || library.thumbnailsPaused) return;
    void library.thumbnailSize;

    const items = flatGridItems;
    if (items) {
      const range = gridVirtualRange;
      if (!range) return;
      const lookahead = GRID_THUMB_LOOKAHEAD_ROWS * gridColCount;
      const from = Math.max(0, range.firstIdx - lookahead);
      const to = Math.min(items.length - 1, range.lastIdx + lookahead);
      for (let i = from; i <= to; i++) {
        const item = items[i];
        if (item.type === "file" && !item.path.startsWith("__")) {
          library.requestThumbnail(item.path);
        }
      }
      return;
    }

    // Other view modes render every cell; request whatever is in the DOM.
    void sortedFiles;
    void gridVirtualRange;
    void library.viewMode;
    void library.activeTab;
    void library.dividersOn;
    const root = scrollEl;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-path]")) {
      const path = el.dataset.path;
      if (path && !path.startsWith("__")) library.requestThumbnail(path);
    }
  });

  $effect(() => {
    if (library.activeTab !== "recents") return;
    const files =
      library.privacyMode || library.recentsDisabled
        ? []
        : library.getRecentPaths();
    library.setViewInfo({ kind: "recents", files });
  });

  $effect(() => {
    if (library.activeTab !== "favorites") return;
    library.setViewInfo({
      kind: "favorites",
      files: library.getFavoritePaths(),
    });
  });

  $effect(() => {
    if (library.activeTab !== "collections" || library.activeCollectionPath) {
      return;
    }
    library.setViewInfo({
      kind: "collections",
      collections: library.collections,
    });
  });

  $effect(() => () => {
    destroyed = true;
    library.clearViewInfo();
  });

  // Load file stats for sort by size/date-modified
  $effect(() => {
    if (fileList.length > 0) {
      library.loadStats(fileList);
    }
  });

  // Initialize library directory path when library tab becomes active
  $effect(() => {
    if (library.activeTab !== "library") return;
    if (libraryDirPath !== null) return;
    if (fileList.length === 0) return;
    const parent = getParentFolder(fileList[0]);
    if (parent) {
      libraryDirPath = parent;
      libraryBasePath = parent;
    }
  });

  $effect(() => {
    const path = libraryDirPath;
    library.scanKey;
    if (!path || library.activeTab !== "library") {
      if (library.activeTab === "library") library.clearViewInfo();
      libraryDirFolders = [];
      libraryDirFiles = [];
      return;
    }
    if (untrack(() => library.viewInfo?.path) !== path) {
      library.clearViewInfo();
    }
    (async () => {
      try {
        const sep = path.includes("\\") ? "\\" : "/";
        const entries = await readDir(path);
        if (library.activeTab !== "library") return;
        const folders: string[] = [];
        const files: string[] = [];
        for (const e of entries) {
          const full = `${path}${sep}${e.name}`;
          if (e.isDirectory) {
            folders.push(full);
          } else if (ALL_EXTS_SET.has(getFileExt(e.name ?? ""))) {
            files.push(full);
          }
        }
        const sortFn = (a: string, b: string) =>
          getFileName(a).localeCompare(getFileName(b), undefined, {
            sensitivity: "base",
          });
        folders.sort(sortFn);
        files.sort(sortFn);
        if (destroyed) return;
        if (path !== libraryDirPath || library.activeTab !== "library") return;
        libraryDirFolders = folders;
        libraryDirFiles = files;
        library.setViewInfo({ kind: "folder", path, files, folders });
      } catch {
        if (destroyed) return;
        if (path !== libraryDirPath || library.activeTab !== "library") return;
        libraryDirFolders = [];
        libraryDirFiles = [];
        library.setViewInfo({ kind: "folder", path, files: [], folders: [] });
      }
    })();
  });

  $effect(() => {
    const folders = libraryDirFolders;
    if (folders.length === 0 || library.activeTab !== "library") {
      folderStats = {};
      return;
    }
    (async () => {
      try {
        const items = await invokeBatchStat(folders);
        const map: Record<string, BatchStatItem> = {};
        for (const item of items) {
          map[item.path] = item;
        }
        folderStats = map;
      } catch {
        folderStats = {};
      }
    })();
  });

  $effect(() => {
    const path = library.activeCollectionPath;
    const tab = library.activeTab;
    library.scanKey;
    if (!path) {
      collectionFiles = [];
      collectionFolders = [];
      return;
    }
    if (tab !== "collections") return;
    if (untrack(() => library.viewInfo?.path) !== path) {
      library.clearViewInfo();
    }
    (async () => {
      try {
        const sep = path.includes("\\") ? "\\" : "/";
        const entries = await readDir(path);
        if (library.activeCollectionPath !== path) return;
        const folders: string[] = [];
        const files: string[] = [];
        for (const e of entries) {
          const full = `${path}${sep}${e.name}`;
          if (e.isDirectory) {
            folders.push(full);
          } else if (ALL_EXTS_SET.has(getFileExt(e.name ?? ""))) {
            files.push(full);
          }
        }
        const sortFn = (a: string, b: string) =>
          getFileName(a).localeCompare(getFileName(b), undefined, {
            sensitivity: "base",
          });
        folders.sort(sortFn);
        files.sort(sortFn);
        if (destroyed) return;
        collectionFolders = folders;
        collectionFiles = files;
        if (library.activeTab === "collections") {
          library.setViewInfo({ kind: "folder", path, files, folders });
        }
      } catch {
        if (destroyed) return;
        if (library.activeCollectionPath !== path) return;
        collectionFiles = [];
        collectionFolders = [];
        if (library.activeTab === "collections") {
          library.setViewInfo({ kind: "folder", path, files: [], folders: [] });
        }
      }
    })();
  });

  $effect(() => {
    if (isViewingCollection && collectionFiles.length > 0) {
      library.loadStats(collectionFiles);
    }
  });

  $effect(() => {
    void library.thumbnailSize;
    if (library.activeTab !== "collections") return;
    if (!library.showCollectionCovers || !library.showThumbnails) {
      if (Object.keys(collectionFirstFiles).length > 0) {
        collectionFirstFiles = {};
      }
      return;
    }
    const cols = library.collections;
    for (const col of cols) {
      const existing = collectionFirstFiles[col.path];
      if (existing) {
        library.requestThumbnail(existing);
        continue;
      }
      if (col.thumbnailPath) {
        collectionFirstFiles = {
          ...collectionFirstFiles,
          [col.path]: col.thumbnailPath,
        };
        library.requestThumbnail(col.thumbnailPath);
        continue;
      }
      (async () => {
        try {
          const sep = col.path.includes("\\") ? "\\" : "/";
          const entries = await readDir(col.path);
          const first = entries.find((e) =>
            ALL_EXTS_SET.has(getFileExt(e.name ?? "")),
          );
          if (first) {
            const filePath = `${col.path}${sep}${first.name}`;
            collectionFirstFiles = {
              ...collectionFirstFiles,
              [col.path]: filePath,
            };
            library.requestThumbnail(filePath);
          }
        } catch {
          // folder may not exist — handled by validateCollections
        }
      })();
    }
  });

  // Keep the library selector on the current file when the list changes;
  // arrow navigation then moves it without touching the viewer.
  $effect(() => {
    void currentIndex;
    void library.activeTab;
    void library.activeCollectionPath;
    void library.sortMode;
    void library.sortDesc;
    const files = untrack(() => sortedFiles);
    const currentPath =
      currentIndex >= 0 && currentIndex < fileList.length
        ? fileList[currentIndex]
        : undefined;
    const idx = currentPath ? files.indexOf(currentPath) : -1;
    highlightIndex = idx >= 0 ? idx : 0;
  });

  // Filmstrip: scroll-to-current, wheel scroll, highlight tracking, section labels
  let lastScrollTab = library.activeTab;
  let lastScrollIndex = -1;
  let lastScrollPath: string | undefined;
  let lastScrollMode: string | null = null;
  let lastScrollDensity = -1;
  $effect(() => {
    if (!scrollEl) return;
    const tab = library.activeTab;
    const viewMode = library.viewMode;
    const index = currentIndex;
    const density = library.density;
    const currentPath =
      index >= 0 && index < fileList.length ? fileList[index] : undefined;
    const tabChanged = tab !== lastScrollTab;
    const shouldScroll =
      index !== lastScrollIndex ||
      currentPath !== lastScrollPath ||
      viewMode !== lastScrollMode ||
      density !== lastScrollDensity;
    lastScrollTab = tab;
    lastScrollIndex = index;
    lastScrollPath = currentPath;
    lastScrollMode = viewMode;
    lastScrollDensity = density;

    if (viewMode !== "filmstrip") {
      filmstripReadyKey = "";
      // Grid/list: keep the current file in view, but never move the viewport
      // vertically while a tab swipe is animating or when unrelated state
      // changes cause this effect to run again.
      if (tabChanged || !shouldScroll) return;
      if (currentPath) {
        const el = scrollEl.querySelector(
          `[data-path="${cssAttr(currentPath)}"]`,
        ) as HTMLElement | null;
        if (el)
          el.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
      }
      return;
    }

    const layoutKey = `${library.activeTab}:${library.viewMode}`;
    const needsReady = filmstripReadyKey !== layoutKey;
    const indexChanged = filmstripLastIndex !== currentIndex;
    const densityChanged = filmstripLastDensity !== library.density;
    filmstripLastIndex = currentIndex;
    filmstripLastDensity = library.density;
    if (needsReady) {
      filmstripReady = false;
    }

    let strip: HTMLElement | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    let highlightTimer: ReturnType<typeof setTimeout> | null = null;
    let lastWheel = 0;
    let onWheel: ((e: WheelEvent) => void) | null = null;
    let onScroll: (() => void) | null = null;

    // Double rAF: wait for browser layout + paint before scrolling
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const stripNode = scrollEl?.querySelector(
          ".library-filmstrip",
        ) as HTMLElement | null;
        if (!stripNode) return;
        strip = stripNode;

        // Scroll to current file (instant on open). When only the density
        // changed, keep the cell the user is browsing centered.
        const path =
          !needsReady && densityChanged && !indexChanged
            ? (sortedFiles[highlightIndex] ?? fileList[currentIndex])
            : fileList[currentIndex];
        if (path) {
          scrollToFilmstripCellInstant(path, needsReady);
          if (needsReady) {
            // Fallback: if scroll didn't take effect, retry after layout settles
            readyTimer = setTimeout(() => {
              readyTimer = null;
              if (stripNode.scrollLeft === 0 && currentIndex > 0) {
                scrollToFilmstripCellInstant(path, false);
              }
              filmstripReadyKey = layoutKey;
              filmstripReady = true;
            }, 50);
          }
        } else {
          filmstripReadyKey = layoutKey;
          filmstripReady = true;
        }

        // Wheel: snap to adjacent cell with a cooldown so trackpad inertia
        // doesn't race through the folder.
        onWheel = (e: WheelEvent) => {
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          e.preventDefault();
          e.stopPropagation();
          const now = performance.now();
          if (now - lastWheel < 60) return;
          lastWheel = now;
          let delta = e.deltaY;
          if (e.deltaMode === 1) delta *= 40;
          else if (e.deltaMode === 2)
            delta = Math.sign(delta) * stripNode.clientWidth;
          if (sortedFiles.length === 0) return;
          const dir = delta > 0 ? 1 : -1;
          const next = Math.max(
            0,
            Math.min(sortedFiles.length - 1, highlightIndex + dir),
          );
          if (next === highlightIndex) return;
          lastManualHighlight = performance.now();
          highlightIndex = next;
          scrollToFilmstripCell(sortedFiles[next]);
        };

        // Scroll: update highlight to centered cell
        onScroll = () => {
          if (highlightTimer) clearTimeout(highlightTimer);
          highlightTimer = setTimeout(() => {
            if (performance.now() - lastManualHighlight < 250) return;
            const center = stripNode.scrollLeft + stripNode.clientWidth / 2;
            const cells =
              stripNode.querySelectorAll<HTMLElement>("[data-path]");
            let closestPath = "";
            let closestDist = Infinity;
            cells.forEach((c) => {
              const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
              if (dist < closestDist) {
                closestDist = dist;
                closestPath = c.dataset.path ?? "";
              }
            });
            if (closestPath) {
              const idx = sortedFiles.indexOf(closestPath);
              if (idx >= 0) highlightIndex = idx;
            }
          }, 60);
        };

        stripNode.addEventListener("wheel", onWheel, { passive: false });
        stripNode.addEventListener("scroll", onScroll);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (strip && onWheel) strip.removeEventListener("wheel", onWheel);
      if (strip && onScroll) strip.removeEventListener("scroll", onScroll);
      if (readyTimer) clearTimeout(readyTimer);
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  });

  function cssAttr(path: string) {
    return path.replace(/\\/g, "\\\\");
  }

  function captureCellRects(): Map<string, DOMRect> {
    const rects = new Map<string, DOMRect>();
    const cells = scrollEl?.querySelectorAll<HTMLElement>("[data-path]");
    if (!cells) return rects;
    for (const cell of cells) {
      const path = cell.dataset.path;
      if (path) rects.set(path, cell.getBoundingClientRect());
    }
    return rects;
  }

  // FLIP the visible cells so header layout changes read as movement instead
  // of an instant reflow.
  function animateCellShift(previous: Map<string, DOMRect>) {
    if (appearance.reducedMotion || !scrollEl || previous.size === 0) return;
    const cells = scrollEl.querySelectorAll<HTMLElement>("[data-path]");
    for (const cell of cells) {
      const path = cell.dataset.path;
      const before = path ? previous.get(path) : undefined;
      if (!before) continue;
      const after = cell.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      cell.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 220, easing: "cubic-bezier(0.22, 0.9, 0.3, 1)" },
      );
    }
  }

  function scrollHighlightIntoView() {
    const path = sortedFiles[highlightIndex];
    if (!path || !scrollEl) return;
    if (library.viewMode === "filmstrip") {
      lastManualHighlight = performance.now();
      scrollToFilmstripCell(path);
      return;
    }
    const selector = `[data-path="${cssAttr(path)}"]`;
    const focusCell = () => {
      const el = scrollEl?.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      el.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
      el.focus({ preventScroll: true });
      return true;
    };
    if (focusCell()) return;
    // The virtualized grid only renders the visible rows, so move the scroll
    // window first and focus the cell once it exists.
    if (library.viewMode === "grid" && gridVirtualRange) {
      const row = Math.floor(highlightIndex / gridColCount);
      const rowTop = row * gridRowStep;
      const rowBottom = rowTop + gridRowStep;
      const viewTop = scrollEl.scrollTop;
      const viewHeight = scrollEl.clientHeight;
      let target = viewTop;
      if (rowTop < viewTop) target = rowTop;
      else if (rowBottom > viewTop + viewHeight)
        target = rowBottom - viewHeight;
      if (target !== viewTop) {
        scrollEl.scrollTop = target;
        scrollTop = target;
      }
      requestAnimationFrame(focusCell);
    }
  }

  function scrollToFilmstripCell(path: string) {
    const strip = scrollEl?.querySelector(
      ".library-filmstrip",
    ) as HTMLElement | null;
    if (!strip) return;
    const el = strip.querySelector(
      `[data-path="${cssAttr(path)}"]`,
    ) as HTMLElement | null;
    if (el) {
      const target = Math.max(
        0,
        el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2,
      );
      strip.scrollTo({ left: target, behavior: scrollBehavior() });
      el.focus({ preventScroll: true });
    }
  }

  function scrollToFilmstripCellInstant(path: string, focus = true) {
    const strip = scrollEl?.querySelector(
      ".library-filmstrip",
    ) as HTMLElement | null;
    if (!strip) return;
    const el = strip.querySelector(
      `[data-path="${cssAttr(path)}"]`,
    ) as HTMLElement | null;
    if (el) {
      strip.scrollLeft = Math.max(
        0,
        el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2,
      );
      if (focus) el.focus({ preventScroll: true });
    }
  }

  // Window-level drag handlers
  $effect(() => {
    function onMove(e: MouseEvent) {
      handleDragMove(e);
    }
    function onUp(e: MouseEvent) {
      handleDragEnd(e);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });
</script>

<svelte:window
  onmousedown={handleGlobalMouseDown}
  onclick={handleGlobalClick}
  onpointermove={showKeyboardCursor}
  onpointerdown={showKeyboardCursor}
  onkeydowncapture={handleGlobalKeydown}
/>

{#snippet folderCard(path: string, className: string)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={className}
    role="button"
    tabindex="0"
    onclick={() => navigateToFolder(path)}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigateToFolder(path);
      }
    }}
  >
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--yellow-soft)"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      />
    </svg>
    <div class="library-subfolder-name">{getFileName(path)}</div>
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="library-view"
  tabindex="-1"
  bind:this={viewEl}
  onkeydown={handleKeydown}
  onclick={() => {
    confirmRename();
    closeLibCtxMenu();
    closeColCtxMenu();
  }}
  role="region"
  aria-label={t("library.aria.fileLibrary")}
>
  <div
    class="library-tabs"
    class:no-motion={appearance.reducedMotion}
    bind:this={tabsEl}
  >
    <span
      class="library-tab-highlight"
      class:ready={tabHighlightReady}
      class:collect-mode={library.collectMode}
      aria-hidden="true"
      style={`top: ${tabHighlight.top}px; height: ${tabHighlight.height}px; width: ${tabHighlight.width}px; transform: translateX(${tabHighlight.left}px);`}
    ></span>
    <button
      class="library-tab"
      data-tab="library"
      class:active={library.activeTab === "library"}
      onclick={() => library.setActiveTab("library")}
      >{t("library.tabs.library")}</button
    >
    <button
      class="library-tab"
      data-tab="recents"
      class:active={library.activeTab === "recents"}
      onclick={() => library.setActiveTab("recents")}
      >{t("library.tabs.recents")}</button
    >
    <button
      class="library-tab"
      data-tab="collections"
      class:active={library.activeTab === "collections"}
      class:collect-mode={library.collectMode}
      onclick={() => {
        library.closeCollection();
        library.setActiveTab("collections");
      }}>{t("library.tabs.collections")}</button
    >
    <button
      class="library-tab"
      data-tab="favorites"
      class:active={library.activeTab === "favorites"}
      onclick={() => library.setActiveTab("favorites")}
      >{t("library.tabs.favorites")}</button
    >
  </div>

  <div class="library-toolbar">
    {#if library.activeTab === "collections"}
      <div class="library-collection-header">
        {#if isViewingCollection}
          {#each breadcrumb as seg, i}
            {#if i > 0}
              <span class="library-breadcrumb-sep">/</span>
            {/if}
            <button
              class="library-breadcrumb-segment"
              class:active={i === breadcrumb.length - 1}
              onclick={() =>
                seg.path === null
                  ? library.closeCollection()
                  : i === breadcrumb.length - 1
                    ? invokeOpenDirectory(seg.path)
                    : library.openCollection(seg.path)}
            >
              {#if i === 0}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                  /></svg
                >
              {/if}
              {seg.label}
              {#if i === breadcrumb.length - 1}
                <span class="library-header-count">({collectionItemCount})</span
                >
              {/if}
            </button>
          {/each}
        {:else}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            /></svg
          >
          <span class="library-breadcrumb-segment active"
            >{t("library.tabs.collections")}
            <span class="library-header-count"
              >({sortedCollections.length})</span
            ></span
          >
        {/if}
      </div>
    {/if}

    {#if library.activeTab === "recents"}
      <div
        class="library-collection-header tooltip-ctrl tooltip-right"
        data-tooltip={t("library.header.recentsLimitTooltip")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><circle cx="12" cy="12" r="10" /><polyline
            points="12 6 12 12 16 14"
          /></svg
        >
        <span class="library-breadcrumb-segment active"
          >{t("library.tabs.recents")}
          {#if library.recentsDisabled || library.privacyMode}
            <span class="library-header-count">({t("library.header.off")})</span
            >
          {:else}
            <button
              class="library-header-count"
              class:warning={recentFilesWarning}
              onclick={openRecentsSettings}
              >({displayFilesRaw.length}/{library.recentFilesLimit})</button
            >
          {/if}
        </span>
      </div>
    {/if}

    {#if library.activeTab === "favorites"}
      <div class="library-collection-header">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          /></svg
        >
        <span class="library-breadcrumb-segment active"
          >{t("library.tabs.favorites")}
          <span class="library-header-count">({displayFiles.length})</span
          ></span
        >
      </div>
    {/if}

    {#if library.activeTab === "library" && !libraryDirPath}
      <div class="library-collection-header">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><rect x="3" y="3" width="7" height="7" /><rect
            x="14"
            y="3"
            width="7"
            height="7"
          /><rect x="14" y="14" width="7" height="7" /><rect
            x="3"
            y="14"
            width="7"
            height="7"
          /></svg
        >
        <span class="library-breadcrumb-segment active"
          >{t("library.tabs.library")}</span
        >
      </div>
    {/if}

    {#if library.activeTab === "library" && libraryDirPath}
      <div class="library-collection-header">
        {#if libraryBreadcrumb.length > 0}
          {#each libraryBreadcrumb as seg, i}
            {#if i > 0}
              <span class="library-breadcrumb-sep">/</span>
            {/if}
            <button
              class="library-breadcrumb-segment"
              class:active={i === libraryBreadcrumb.length - 1}
              onclick={() =>
                i === libraryBreadcrumb.length - 1
                  ? invokeOpenDirectory(seg.path)
                  : (libraryDirPath = seg.path)}
            >
              {#if i === 0}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect x="3" y="3" width="7" height="7" /><rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                  /><rect x="14" y="14" width="7" height="7" /><rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                  /></svg
                >
              {/if}
              {i === 0 ? libraryRootName : seg.label}
            </button>
          {/each}
        {:else}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><rect x="3" y="3" width="7" height="7" /><rect
              x="14"
              y="3"
              width="7"
              height="7"
            /><rect x="14" y="14" width="7" height="7" /><rect
              x="3"
              y="14"
              width="7"
              height="7"
            /></svg
          >
          <button
            class="library-breadcrumb-segment active"
            onclick={() => invokeOpenDirectory(libraryDirPath!)}
            >{libraryRootName}
            <span class="library-header-count">({displayFiles.length})</span
            ></button
          >
        {/if}
      </div>
    {/if}

    <div
      class="lib-filter"
      class:expanded={filterOpen}
      class:no-motion={appearance.reducedMotion}
      style="right: {searchRight + 32}px;"
      inert={searchExpanded}
      role="group"
      aria-label={t("library.filter.aria")}
      onfocusout={handleFilterFocusOut}
      onkeydown={handleFilterKeydown}
    >
      <button
        bind:this={filterBtnEl}
        class="lib-filter-toggle tooltip-below"
        class:is-on={hiddenFilterCount > 0}
        data-tooltip={t("library.filter.tooltip")}
        aria-label={t("library.filter.aria")}
        aria-expanded={filterOpen}
        onclick={toggleFilterRow}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </button>
      <span class="lib-filter-divider" aria-hidden="true"></span>
      <div class="lib-filter-chips" inert={!filterOpen}>
        {#each filterKinds as meta (meta.kind)}
          <button
            class="lib-filter-chip tooltip-below"
            class:on={library.fileFilters[meta.kind]}
            class:tooltip-hidden={filterHintVisible &&
              isFilterKindLocked(meta.kind)}
            data-tooltip={t(meta.labelKey)}
            aria-label={t(meta.labelKey)}
            aria-pressed={library.fileFilters[meta.kind]}
            aria-disabled={isFilterKindLocked(meta.kind)}
            onmouseenter={() => {
              if (isFilterKindLocked(meta.kind)) showFilterHint();
            }}
            onmouseleave={() => (filterHintVisible = false)}
            onclick={() => toggleFilterKind(meta.kind)}
          >
            {@html meta.icon}
          </button>
        {/each}
      </div>
      {#if filterHintVisible}
        <span class="lib-filter-hint" role="status"
          >{t("settings.library.fileTypes.hint")}</span
        >
      {/if}
    </div>

    <div
      class="library-search"
      class:expanded={searchExpanded}
      class:no-motion={appearance.reducedMotion}
      role="search"
      aria-label={t("library.search.aria")}
      style="right: {searchRight}px;"
      bind:this={searchEl}
      onfocusout={handleSearchFocusOut}
    >
      {#if searchExtrasVisible}
        <button
          class="library-search-clear tooltip-below-start"
          transition:fly={{
            x: -6,
            duration: appearance.reducedMotion ? 0 : 200,
          }}
          data-tooltip={t("library.search.clear")}
          aria-label={t("library.search.clear")}
          onclick={clearSearch}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      {/if}
      <input
        bind:this={searchInputEl}
        class="library-search-input"
        type="search"
        data-library-search
        value={library.searchQuery}
        placeholder={t("library.search.placeholder")}
        aria-label={t("library.search.aria")}
        aria-hidden={!searchExpanded}
        tabindex={searchExpanded ? 0 : -1}
        autocomplete="off"
        spellcheck="false"
        oninput={(e) => {
          searchDismissed = false;
          library.setSearchQuery(e.currentTarget.value);
        }}
        onkeydown={handleSearchKeydown}
      />
      {#if searchExtrasVisible}
        <span
          class="library-search-count"
          transition:fly={{
            x: 6,
            duration: appearance.reducedMotion ? 0 : 200,
          }}
          aria-live="polite"
          aria-atomic="true"
          >{t("library.search.count", {
            shown: searchResultCount,
            total: searchTotal,
          })}</span
        >
      {/if}
      <button
        class="library-search-toggle tooltip-below-end"
        class:is-on={library.searchActive}
        data-tooltip={`${t("library.search.open")}${shortcutSuffix("library-search")}`}
        aria-label={t("library.search.aria")}
        aria-expanded={searchExpanded}
        onclick={focusSearch}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </button>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="library-scroll"
    class:select-mode={selectMode}
    class:dragging={isDragging}
    class:scrolling
    class:filmstrip={library.viewMode === "filmstrip"}
    bind:this={scrollEl}
    bind:clientHeight={containerHeight}
    bind:offsetWidth={containerWidth}
    onscroll={onScroll}
    onmousedown={handleDragStart}
  >
    <div
      style={library.viewMode === "filmstrip"
        ? "display: grid; grid-template-columns: 1fr; align-items: start; height: 100%; overflow: hidden;"
        : "display: grid; grid-template-columns: 1fr; align-items: start; min-height: 100%;"}
    >
      {#key library.activeTab}
        <div
          class="tab-content"
          class:filmstrip-mode={library.viewMode === "filmstrip"}
          in:swipe={{
            direction: library.tabDirection,
            duration: swipeDuration,
            easing: cubicInOut,
            enabled: mounted,
          }}
          out:swipe={{
            direction: -library.tabDirection,
            duration: swipeDuration,
            easing: cubicInOut,
          }}
          style="grid-area: 1 / 1;"
        >
          {#if searchHasNoResults}
            <div
              class="library-empty library-search-empty"
              class:no-motion={appearance.reducedMotion}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.3"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span
                >{t("library.search.noResults", {
                  query: library.searchQuery.trim(),
                })}</span
              >
              <span class="library-search-empty-hint"
                >{t("library.search.noResultsHint")}</span
              >
              <button class="library-search-empty-clear" onclick={clearSearch}
                >{t("library.search.clearAction")}</button
              >
            </div>
          {/if}
          {#if showFileGrid && !searchHasNoResults}
            {#if library.viewMode === "grid"}
              {#if gridVirtualRange && !renderDividers}
                <!-- Virtualized grid (no dividers) -->
                <div
                  class="library-grid"
                  style="grid-template-columns: repeat({gridColCount}, 1fr); position: relative;"
                >
                  {#if gridVirtualRange.topSpacer > 0}
                    <div
                      style="height: {gridVirtualRange.topSpacer}px; grid-column: 1 / -1;"
                      aria-hidden="true"
                    ></div>
                  {/if}
                  {#each flatGridItems!.slice(gridVirtualRange.firstIdx, gridVirtualRange.lastIdx + 1) as item, i (item.path)}
                    {#if item.type === "folder"}
                      {@render folderCard(item.path, "library-subfolder-card")}
                    {:else if item.path === "__add_favorite__"}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="library-placeholder-card"
                        style="width: {gridMinCol}px; height: {gridMinCol}px; box-sizing: border-box; justify-self: start;"
                        role="button"
                        tabindex="0"
                        onclick={addFavoriteFromFile}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            addFavoriteFromFile();
                          }
                        }}
                      >
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          opacity="0.4"
                        >
                          <polygon
                            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                          />
                        </svg>
                      </div>
                    {:else if item.path === "__add_files__"}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="library-placeholder-card"
                        role="button"
                        tabindex="0"
                        onclick={addFilesToCollection}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            addFilesToCollection();
                          }
                        }}
                      >
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          opacity="0.4"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </div>
                    {:else}
                      {@const path = item.path}
                      {@const active = activePaths.has(path)}
                      {@const selected = library.isSelected(path)}
                      {@const badge = getMediaBadge(path)}
                      <div
                        class="library-cell"
                        class:active
                        class:selected
                        class:names-on={library.namesOn}
                        class:privacy-blur={library.privacyMode}
                        data-path={path}
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                          if (dragSuppressedClick) return;
                          if (selectMode || e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            library.toggleSelect(path);
                          } else {
                            onSelect(path);
                          }
                        }}
                        oncontextmenu={(e) => openLibCtxMenu(e, path)}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selectMode || e.ctrlKey || e.metaKey) {
                              library.toggleSelect(path);
                            } else {
                              onSelect(path);
                            }
                          }
                        }}
                      >
                        {#if thumbFor(path)}
                          <img
                            class="library-thumb"
                            src={thumbFor(path)}
                            alt=""
                            draggable="false"
                            decoding="async"
                          />
                        {:else if DOCUMENT_EXTS.includes(getFileExt(path))}
                          <div class="library-placeholder pdf-placeholder">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path
                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                              />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                        {:else}
                          <div
                            class="library-placeholder"
                            class:failed={thumbFailed(path)}
                          ></div>
                        {/if}
                        {#if library.namesOn}
                          <div
                            class="file-name-label"
                            transition:fly={{ y: 8, duration: labelMotionMs }}
                          >
                            {displayName(path)}
                          </div>
                        {/if}
                        <div
                          class="library-checkbox"
                          class:checked={selected}
                          role="checkbox"
                          tabindex="0"
                          aria-checked={selected}
                          aria-label={t("library.list.selectFile")}
                          onclick={(e) => {
                            e.stopPropagation();
                            library.toggleSelect(path);
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              library.toggleSelect(path);
                            }
                          }}
                        >
                          {#if selected}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="3"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          {/if}
                        </div>
                        {#if badge === "video"}
                          <div class="library-badge">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </div>
                        {:else if badge === "gif"}
                          <div class="library-badge">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polyline points="23 4 23 10 17 10" />
                              <polyline points="1 20 1 14 7 14" />
                              <path
                                d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                              />
                            </svg>
                          </div>
                        {:else if badge === "audio"}
                          <div class="library-badge">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        {:else if badge === "pdf"}
                          <div class="library-badge library-badge-pdf">
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path
                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                              />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="9" y1="13" x2="15" y2="13" />
                              <line x1="12" y1="13" x2="12" y2="18" />
                            </svg>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                  <div
                    style="height: {gridVirtualRange.bottomSpacer}px; grid-column: 1 / -1;"
                    aria-hidden="true"
                  ></div>
                </div>
              {:else}
                <!-- Non-virtualized grid (dividers on or fallback) -->
                <div
                  class="library-grid"
                  style="grid-template-columns: repeat({gridColCount}, 1fr);"
                >
                  {#if library.activeTab === "favorites"}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="library-placeholder-card"
                      role="button"
                      tabindex="0"
                      onclick={addFavoriteFromFile}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          addFavoriteFromFile();
                        }
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.4"
                      >
                        <polygon
                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                        />
                      </svg>
                    </div>
                  {/if}
                  {#if isViewingCollection}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="library-placeholder-card"
                      role="button"
                      tabindex="0"
                      onclick={addFilesToCollection}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          addFilesToCollection();
                        }
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.4"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>
                  {/if}
                  {#each displaySections as section (section.label || "all")}
                    {#if section.label}
                      <div
                        class="divider-header"
                        class:exiting={headersExiting}
                        style="grid-column: 1 / -1;"
                      >
                        {section.label}
                      </div>
                    {/if}
                    {#each section.items as path (path)}
                      {#if folderPathSet.has(path)}
                        {@render folderCard(path, "library-subfolder-card")}
                      {:else}
                        {@const active = activePaths.has(path)}
                        {@const selected = library.isSelected(path)}
                        {@const badge = getMediaBadge(path)}
                        <div
                          class="library-cell"
                          class:active
                          class:selected
                          class:names-on={library.namesOn}
                          class:privacy-blur={library.privacyMode}
                          data-path={path}
                          role="button"
                          tabindex="0"
                          onclick={(e) => {
                            if (dragSuppressedClick) return;
                            if (selectMode || e.ctrlKey || e.metaKey) {
                              e.preventDefault();
                              library.toggleSelect(path);
                            } else {
                              onSelect(path);
                            }
                          }}
                          oncontextmenu={(e) => openLibCtxMenu(e, path)}
                          onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (selectMode || e.ctrlKey || e.metaKey) {
                                library.toggleSelect(path);
                              } else {
                                onSelect(path);
                              }
                            }
                          }}
                        >
                          {#if thumbFor(path)}
                            <img
                              class="library-thumb"
                              src={thumbFor(path)}
                              alt=""
                              draggable="false"
                              decoding="async"
                            />
                          {:else}
                            <div
                              class="library-placeholder"
                              class:failed={thumbFailed(path)}
                            ></div>
                          {/if}
                          {#if library.namesOn}
                            <div
                              class="file-name-label"
                              transition:fly={{ y: 8, duration: labelMotionMs }}
                            >
                              {displayName(path)}
                            </div>
                          {/if}
                          <div
                            class="library-checkbox"
                            class:checked={selected}
                            role="checkbox"
                            tabindex="0"
                            aria-checked={selected}
                            aria-label={t("library.list.selectFile")}
                            onclick={(e) => {
                              e.stopPropagation();
                              library.toggleSelect(path);
                            }}
                            onkeydown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                library.toggleSelect(path);
                              }
                            }}
                          >
                            {#if selected}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            {/if}
                          </div>
                          {#if badge === "video"}
                            <div class="library-badge">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </div>
                          {:else if badge === "gif"}
                            <div class="library-badge">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path
                                  d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                                />
                              </svg>
                            </div>
                          {:else if badge === "audio"}
                            <div class="library-badge">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="16" r="3" />
                              </svg>
                            </div>
                          {:else if badge === "pdf"}
                            <div class="library-badge library-badge-pdf">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path
                                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                                />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="9" y1="13" x2="15" y2="13" />
                                <line x1="12" y1="13" x2="12" y2="18" />
                              </svg>
                            </div>
                          {/if}
                        </div>
                      {/if}
                    {/each}
                  {/each}
                  {#if isShowingFolders}
                    {#each currentFolderPaths as folderPath (folderPath)}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="library-subfolder-card"
                        role="button"
                        tabindex="0"
                        onclick={() => navigateToFolder(folderPath)}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigateToFolder(folderPath);
                          }
                        }}
                      >
                        <svg
                          class="library-subfolder-icon"
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--yellow-soft)"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                          />
                        </svg>
                        <div class="library-subfolder-name">
                          {getFileName(folderPath)}
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              {/if}
            {:else if library.viewMode === "river"}
              <div class="library-river">
                {#if library.activeTab === "favorites"}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="library-placeholder-card river-fav-placeholder"
                    role="button"
                    tabindex="0"
                    style="height: {riverRowH}px; min-width: {riverRowH}px; flex-grow: 0;"
                    onclick={addFavoriteFromFile}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addFavoriteFromFile();
                      }
                    }}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      opacity="0.4"
                    >
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                  </div>
                {/if}
                {#each displaySections as section (section.label || "all")}
                  {#if section.label}
                    <div
                      class="divider-header"
                      class:exiting={headersExiting}
                      style="width: 100%; flex-shrink: 0;"
                    >
                      {section.label}
                    </div>
                  {/if}
                  {#each section.items as path (path)}
                    {#if folderPathSet.has(path)}
                      {@render folderCard(
                        path,
                        "river-cell river-subfolder-cell",
                      )}
                    {:else}
                      {@const active = activePaths.has(path)}
                      {@const selected = library.isSelected(path)}
                      {@const badge = getMediaBadge(path)}
                      {@const dim = imageDims[path]}
                      {@const ratio = dim ? dim.w / dim.h : 4 / 3}
                      <div
                        class="river-cell"
                        class:active
                        class:selected
                        class:names-on={library.namesOn}
                        class:privacy-blur={library.privacyMode}
                        data-path={path}
                        role="button"
                        tabindex="0"
                        style="height: {riverRowH}px; flex-grow: {ratio *
                          riverRowH};"
                        onclick={(e) => {
                          if (dragSuppressedClick) return;
                          if (selectMode || e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            library.toggleSelect(path);
                          } else {
                            onSelect(path);
                          }
                        }}
                        oncontextmenu={(e) => openLibCtxMenu(e, path)}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selectMode || e.ctrlKey || e.metaKey) {
                              library.toggleSelect(path);
                            } else {
                              onSelect(path);
                            }
                          }
                        }}
                      >
                        {#if thumbFor(path)}
                          <img
                            class="river-thumb"
                            src={thumbFor(path)}
                            alt=""
                            draggable="false"
                            decoding="async"
                            onload={(e) => onImageLoad(path, e)}
                          />
                        {:else if DOCUMENT_EXTS.includes(getFileExt(path))}
                          <div class="river-placeholder pdf-placeholder">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path
                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                              />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                        {:else}
                          <div
                            class="river-placeholder"
                            class:failed={thumbFailed(path)}
                          ></div>
                        {/if}
                        {#if library.namesOn}
                          <div
                            class="file-name-label"
                            transition:fly={{ y: 8, duration: labelMotionMs }}
                          >
                            {displayName(path)}
                          </div>
                        {/if}
                        <div
                          class="library-checkbox"
                          class:checked={selected}
                          role="checkbox"
                          tabindex="0"
                          aria-checked={selected}
                          aria-label={t("library.list.selectFile")}
                          onclick={(e) => {
                            e.stopPropagation();
                            library.toggleSelect(path);
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              library.toggleSelect(path);
                            }
                          }}
                        >
                          {#if selected}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="3"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          {/if}
                        </div>
                        {#if badge}
                          <div
                            class="library-badge"
                            class:library-badge-pdf={badge === "pdf"}
                          >
                            {#if badge === "video"}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            {:else if badge === "gif"}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path
                                  d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                                />
                              </svg>
                            {:else if badge === "audio"}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" />
                                <circle cx="18" cy="16" r="3" />
                              </svg>
                            {:else if badge === "pdf"}
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path
                                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                                />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="9" y1="13" x2="15" y2="13" />
                                <line x1="12" y1="13" x2="12" y2="18" />
                              </svg>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                {/each}
              </div>
            {:else if library.viewMode === "filmstrip"}
              <div
                class="library-filmstrip"
                style="position: relative; opacity: {filmstripReady
                  ? 1
                  : 0}; transition: opacity 0.15s ease;"
              >
                {#if library.activeTab === "favorites"}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="library-placeholder-card filmstrip-fav-placeholder"
                    role="button"
                    tabindex="0"
                    style="height: {filmstripBase}px; min-width: {filmstripBase}px; flex-shrink: 0;"
                    onclick={addFavoriteFromFile}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addFavoriteFromFile();
                      }
                    }}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      opacity="0.4"
                    >
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      />
                    </svg>
                  </div>
                {/if}
                {#each filmstripSections as section (section.label || "all")}
                  {#if section.label}
                    <div
                      class="filmstrip-divider"
                      class:exiting={headersExiting}
                    >
                      <span class="filmstrip-divider-label"
                        >{section.label}</span
                      >
                    </div>
                  {/if}
                  {#each section.items as path (path)}
                    {@const active = activePaths.has(path)}
                    {@const selected = library.isSelected(path)}
                    {@const badge = getMediaBadge(path)}
                    {@const dim = imageDims[path]}
                    {@const ratio = dim ? dim.w / dim.h : 4 / 3}
                    <div
                      class="filmstrip-cell"
                      class:active
                      class:selected
                      class:names-on={library.namesOn}
                      class:privacy-blur={library.privacyMode}
                      data-path={path}
                      role="button"
                      tabindex="0"
                      style="height: {active
                        ? filmstripBase * 1.33
                        : filmstripBase}px; width: {(active
                        ? filmstripBase * 1.33
                        : filmstripBase) * ratio}px;"
                      onclick={(e) => {
                        if (dragSuppressedClick) return;
                        if (selectMode || e.ctrlKey || e.metaKey) {
                          e.preventDefault();
                          library.toggleSelect(path);
                        } else {
                          onSelect(path);
                        }
                      }}
                      oncontextmenu={(e) => openLibCtxMenu(e, path)}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (selectMode || e.ctrlKey || e.metaKey) {
                            library.toggleSelect(path);
                          } else {
                            onSelect(path);
                          }
                        }
                      }}
                    >
                      {#if thumbFor(path)}
                        <img
                          class="filmstrip-thumb"
                          src={thumbFor(path)}
                          alt=""
                          draggable="false"
                          decoding="async"
                          onload={(e) => onImageLoad(path, e)}
                        />
                      {:else if DOCUMENT_EXTS.includes(getFileExt(path))}
                        <div class="filmstrip-placeholder pdf-placeholder">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                            />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                      {:else}
                        <div
                          class="filmstrip-placeholder"
                          class:failed={thumbFailed(path)}
                        ></div>
                      {/if}
                      {#if library.namesOn}
                        <div
                          class="file-name-label"
                          transition:fly={{ y: 8, duration: labelMotionMs }}
                        >
                          {displayName(path)}
                        </div>
                      {/if}
                      <div
                        class="library-checkbox"
                        class:checked={selected}
                        role="checkbox"
                        tabindex="0"
                        aria-checked={selected}
                        aria-label={t("library.list.selectFile")}
                        onclick={(e) => {
                          e.stopPropagation();
                          library.toggleSelect(path);
                        }}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            library.toggleSelect(path);
                          }
                        }}
                      >
                        {#if selected}
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        {/if}
                      </div>
                      {#if badge}
                        <div
                          class="library-badge"
                          class:library-badge-pdf={badge === "pdf"}
                        >
                          {#if badge === "video"}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          {:else if badge === "gif"}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polyline points="23 4 23 10 17 10" />
                              <polyline points="1 20 1 14 7 14" />
                              <path
                                d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                              />
                            </svg>
                          {:else if badge === "audio"}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path d="M9 18V5l12-2v13" />
                              <circle cx="6" cy="18" r="3" />
                              <circle cx="18" cy="16" r="3" />
                            </svg>
                          {:else if badge === "pdf"}
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path
                                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                              />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="9" y1="13" x2="15" y2="13" />
                              <line x1="12" y1="13" x2="12" y2="18" />
                            </svg>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                {/each}
                {#if isShowingFolders}
                  {#each currentFolderPaths as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="filmstrip-cell filmstrip-subfolder-cell"
                      role="button"
                      tabindex="0"
                      style="height: {filmstripBase}px; min-width: {filmstripBase}px; flex-shrink: 0;"
                      onclick={() => navigateToFolder(folderPath)}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigateToFolder(folderPath);
                        }
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--yellow-soft)"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                        />
                      </svg>
                      <div class="filmstrip-subfolder-name">
                        {getFileName(folderPath)}
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            {:else}
              <div
                class="library-list"
                style="--list-thumb: {listThumbSize}px; --list-pad: {listRowPad}px; --list-font: {listFontSize}px; --list-type-font: {listTypeFontSize}px;"
              >
                <div class="list-header">
                  <span class="list-col list-col-check">
                    <span
                      class="list-checkbox list-checkbox-header"
                      class:checked={allFilesSelected}
                      class:indeterminate={someFilesSelected}
                      role="checkbox"
                      tabindex="0"
                      aria-checked={allFilesSelected}
                      aria-label={t("library.list.selectAll")}
                      onclick={() => {
                        if (allFilesSelected) {
                          library.clearSelection();
                        } else {
                          library.selectRange(sortedFiles);
                        }
                      }}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (allFilesSelected) {
                            library.clearSelection();
                          } else {
                            library.selectRange(sortedFiles);
                          }
                        }
                      }}
                    >
                      {#if allFilesSelected}
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      {:else if someFilesSelected}
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      {/if}
                    </span>
                  </span>
                  <span class="list-col list-col-thumb"></span>
                  <button
                    class="list-col list-col-name list-sort-btn"
                    onclick={() => {
                      const desc =
                        library.sortMode === "name" && !library.sortDesc;
                      library.setSortMode("name", desc);
                    }}
                  >
                    {t("library.list.name")}
                    {#if library.sortMode === "name"}
                      <span class="list-sort-arrow"
                        >{library.sortDesc ? "▲" : "▼"}</span
                      >
                    {/if}
                  </button>
                  <button
                    class="list-col list-col-size list-sort-btn"
                    onclick={() => {
                      const desc =
                        library.sortMode === "size" && !library.sortDesc;
                      library.setSortMode("size", desc);
                    }}
                  >
                    {t("library.list.size")}
                    {#if library.sortMode === "size"}
                      <span class="list-sort-arrow"
                        >{library.sortDesc ? "▲" : "▼"}</span
                      >
                    {/if}
                  </button>
                  <button
                    class="list-col list-col-date list-sort-btn"
                    onclick={() => {
                      const desc =
                        library.sortMode === "date-modified" &&
                        !library.sortDesc;
                      library.setSortMode("date-modified", desc);
                    }}
                  >
                    {t("library.list.dateModified")}
                    {#if library.sortMode === "date-modified"}
                      <span class="list-sort-arrow"
                        >{library.sortDesc ? "▲" : "▼"}</span
                      >
                    {/if}
                  </button>
                  <button
                    class="list-col list-col-type list-sort-btn"
                    onclick={() => {
                      const desc =
                        library.sortMode === "type" && !library.sortDesc;
                      library.setSortMode("type", desc);
                    }}
                  >
                    {t("library.list.type")}
                    {#if library.sortMode === "type"}
                      <span class="list-sort-arrow"
                        >{library.sortDesc ? "▲" : "▼"}</span
                      >
                    {/if}
                  </button>
                </div>
                {#if library.activeTab === "favorites"}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="list-row list-fav-placeholder"
                    role="button"
                    tabindex="0"
                    onclick={addFavoriteFromFile}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addFavoriteFromFile();
                      }
                    }}
                  >
                    <span class="list-col list-col-check"></span>
                    <span class="list-col list-col-thumb">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.4"
                      >
                        <polygon
                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                        />
                      </svg>
                    </span>
                    <span
                      class="list-col list-col-name"
                      style="color: var(--text-muted, #888);"
                    >
                      {t("library.list.addFavorite")}
                    </span>
                    <span class="list-col list-col-size"></span>
                    <span class="list-col list-col-date"></span>
                    <span class="list-col list-col-type"></span>
                  </div>
                {/if}
                {#each displaySections as section (section.label || "all")}
                  {#if section.label}
                    <div
                      class="list-divider-row"
                      class:exiting={headersExiting}
                    >
                      {section.label}
                    </div>
                  {/if}
                  {#each section.items as path, idx (path)}
                    {#if folderPathSet.has(path)}
                      {@render folderCard(path, "list-row list-subfolder-row")}
                    {:else}
                      {@const active = activePaths.has(path)}
                      {@const selected = library.isSelected(path)}
                      {@const stat = library.stats[path]}
                      <div
                        class="list-row"
                        class:active
                        class:selected
                        class:even={idx % 2 === 0}
                        class:privacy-blur={library.privacyMode}
                        data-path={path}
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                          if (dragSuppressedClick) return;
                          if (e.shiftKey) {
                            if (lastClickedIndex !== null) {
                              const globalIdx = sortedFiles.indexOf(path);
                              const start = Math.min(
                                lastClickedIndex,
                                globalIdx,
                              );
                              const end = Math.max(lastClickedIndex, globalIdx);
                              const range = sortedFiles.slice(start, end + 1);
                              library.selectRange(range);
                            }
                            return;
                          }
                          if (selectMode || e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            library.toggleSelect(path);
                          } else {
                            onSelect(path);
                          }
                          lastClickedIndex = sortedFiles.indexOf(path);
                        }}
                        oncontextmenu={(e) => openLibCtxMenu(e, path)}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selectMode || e.ctrlKey || e.metaKey) {
                              library.toggleSelect(path);
                            } else {
                              onSelect(path);
                            }
                          }
                        }}
                      >
                        <span
                          class="list-col list-col-check"
                          onclick={(e) => {
                            e.stopPropagation();
                            library.toggleSelect(path);
                          }}
                          onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              library.toggleSelect(path);
                            }
                          }}
                        >
                          <span
                            class="list-checkbox"
                            class:checked={selected}
                            role="checkbox"
                            tabindex="0"
                            aria-checked={selected}
                            aria-label={t("library.list.selectFile")}
                          >
                            {#if selected}
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            {/if}
                          </span>
                        </span>
                        <span class="list-col list-col-thumb">
                          {#if thumbFor(path)}
                            <img
                              class="list-thumb"
                              src={thumbFor(path)}
                              alt=""
                              draggable="false"
                              decoding="async"
                            />
                          {:else if DOCUMENT_EXTS.includes(getFileExt(path))}
                            <div class="list-placeholder pdf-placeholder">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <path
                                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                                />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                          {:else}
                            <div
                              class="list-placeholder"
                              class:failed={thumbFailed(path)}
                            ></div>
                          {/if}
                        </span>
                        <span class="list-col list-col-name">
                          {displayName(path)}
                        </span>
                        <span class="list-col list-col-size">
                          {stat?.size != null ? formatFileSize(stat.size) : ""}
                        </span>
                        <span class="list-col list-col-date">
                          {stat?.mtime_ms ? formatDate(stat.mtime_ms) : ""}
                        </span>
                        <span class="list-col list-col-type"
                          >{getExt(path)}</span
                        >
                      </div>
                    {/if}
                  {/each}
                {/each}
              </div>
            {/if}
          {/if}

          {#if library.activeTab === "favorites" && displayFiles.length === 0 && !searchHasNoResults}
            <div class="library-empty">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.3"
              >
                <ellipse cx="9.5" cy="10" rx="1.5" ry="2.2" />
                <ellipse cx="14.5" cy="10" rx="1.5" ry="2.2" />
                <path
                  d="M12 2a9 8 0 0 0-9 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a9 8 0 0 0-9-8z"
                />
              </svg>
              <span
                >{library.favorites.length > 0
                  ? t("library.empty.favoritesFiltered")
                  : t("library.empty.favoritesNone")}</span
              >
            </div>
          {/if}

          {#if library.activeTab === "recents" && displayFiles.length === 0 && !searchHasNoResults}
            <div class="library-empty">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.3"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span
                >{library.privacyMode
                  ? t("library.empty.recentsPrivacy")
                  : library.recentsDisabled
                    ? t("library.empty.recentsOff")
                    : library.getRecentPaths().length > 0
                      ? t("library.empty.recentsFiltered")
                      : t("library.empty.recentsNone")}</span
              >
            </div>
          {/if}

          {#if library.activeTab === "library" && !libraryDirPath && displayFiles.length === 0 && currentFolderPaths.length === 0 && !searchHasNoResults}
            <div class="library-empty">
              <div class="library-empty-icons">
                <svg
                  class="library-empty-icon library-empty-icon-top"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.3"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <svg
                  class="library-empty-icon library-empty-icon-bl"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.3"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                <svg
                  class="library-empty-icon library-empty-icon-br"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.3"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <ellipse cx="9" cy="16" rx="2" ry="1.5" />
                  <ellipse cx="15" cy="14.5" rx="2" ry="1.5" />
                  <line x1="11" y1="16" x2="11" y2="8" />
                  <line x1="17" y1="14.5" x2="17" y2="6.5" />
                  <line x1="11" y1="8" x2="17" y2="6.5" />
                </svg>
              </div>
              <span
                >{fileList.length > 0
                  ? t("library.empty.filesFiltered")
                  : t("library.empty.folderEmpty")}</span
              >
            </div>
          {/if}

          {#if isViewingCollection && displayFiles.length === 0 && currentFolderPaths.length === 0 && !searchHasNoResults}
            <div class="library-empty">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.3"
              >
                <path
                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                />
              </svg>
              <span
                >{collectionFiles.length > 0
                  ? t("library.empty.filesFiltered")
                  : t("library.empty.folderEmpty")}</span
              >
            </div>
          {/if}
          {#if library.activeTab === "library" && libraryDirPath && displayFiles.length === 0 && currentFolderPaths.length === 0 && !searchHasNoResults}
            <div class="library-empty">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.3"
              >
                <path
                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                />
              </svg>
              <span
                >{libraryDirFiles.length > 0
                  ? t("library.empty.filesFiltered")
                  : t("library.empty.folderEmpty")}</span
              >
            </div>
          {/if}

          {#if library.activeTab === "collections" && !library.activeCollectionPath && !searchHasNoResults}
            <div
              class="library-grid"
              style="grid-template-columns: repeat({gridColCount}, 1fr);"
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="library-placeholder-card"
                class:collect-mode={library.collectMode}
                role="button"
                tabindex="0"
                onclick={openAddCollectionDialog}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openAddCollectionDialog();
                  }
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.4"
                >
                  <path
                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                  />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </div>
              {#each collectionSections as section (section.label || "all")}
                {#if section.label}
                  <div
                    class="divider-header"
                    class:exiting={headersExiting}
                    style="grid-column: 1 / -1;"
                  >
                    {section.label}
                  </div>
                {/if}
                {#each section.items as col (col.path)}
                  {@const firstFilePath = collectionFirstFiles[col.path]}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="library-collection-card"
                    class:collect-mode={library.collectMode}
                    class:renaming={renamingPath === col.path}
                    class:privacy-blur={library.privacyMode}
                    role="button"
                    tabindex="0"
                    onclick={() => {
                      if (library.collectMode) {
                        library.copySelectedToCollection(col.path);
                      } else {
                        library.openCollection(col.path);
                      }
                    }}
                    ondblclick={() => startRename(col.path, col.name)}
                    oncontextmenu={(e) => openColCtxMenu(e, col.path, col.name)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (library.collectMode) {
                          library.copySelectedToCollection(col.path);
                        } else {
                          library.openCollection(col.path);
                        }
                      }
                    }}
                  >
                    <div class="library-collection-content">
                      {#if library.showCollectionCovers && library.showThumbnails && firstFilePath && thumbFor(firstFilePath)}
                        <img
                          class="library-collection-thumb"
                          src={thumbFor(firstFilePath)}
                          alt=""
                          draggable="false"
                          decoding="async"
                        />
                      {:else}
                        <div class="library-collection-placeholder">
                          <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                            />
                          </svg>
                        </div>
                      {/if}
                    </div>
                    <div
                      class="file-name-label"
                      class:label-renaming={renamingPath === col.path}
                    >
                      {#if renamingPath === col.path}
                        <!-- svelte-ignore a11y_autofocus -->
                        <input
                          class="library-rename-input"
                          type="text"
                          bind:value={renameValue}
                          autofocus
                          onblur={confirmRename}
                          onmousedown={(e) => e.stopPropagation()}
                          onkeydown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              confirmRename();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              cancelRename();
                            }
                          }}
                        />
                      {:else}
                        {col.name}
                      {/if}
                    </div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="library-collection-remove"
                      role="button"
                      tabindex="0"
                      aria-label={t("library.context.removeCollection")}
                      onclick={(e) => {
                        e.stopPropagation();
                        if (col.type === "custom") {
                          startDeleteCollection(col.path);
                        } else {
                          library.removeCollection(col.path);
                        }
                      }}
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (col.type === "custom") {
                            startDeleteCollection(col.path);
                          } else {
                            library.removeCollection(col.path);
                          }
                        }
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                {/each}
              {/each}
            </div>
            {#if library.collections.length === 0}
              <div class="library-empty">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity="0.3"
                >
                  <path
                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                  />
                </svg>
                <span>{t("library.empty.collectionsNone")}</span>
              </div>
            {/if}
          {/if}
        </div>
      {/key}
    </div>

    {#if isDragging && dragRect}
      <div
        class="select-rect"
        style="left: {dragRect.left}px; top: {dragRect.top}px; width: {dragRect.width}px; height: {dragRect.height}px;"
      ></div>
    {/if}
  </div>

  {#if libCtxMenu.visible}
    <div
      class="context-menu lib-ctx"
      class:pinned={libCtxPinned}
      bind:this={libCtxEl}
      style="left: {libCtxMenu.x}px; top: {libCtxMenu.y}px;"
      role="menu"
      tabindex="-1"
      transition:fly={{ y: -4, duration: 160, opacity: 0.08 }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          forceCloseLibCtxMenu();
        }
      }}
    >
      <div
        class="ctx-drag"
        role="button"
        tabindex="0"
        aria-label={t("library.context.drag")}
        onmousedown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startY = e.clientY;
          const startMenuX = libCtxMenu.x;
          const startMenuY = libCtxMenu.y;
          const menu = (e.currentTarget as HTMLElement).closest(
            ".context-menu",
          );
          const menuRect = menu?.getBoundingClientRect();
          const maxX = menuRect
            ? Math.max(0, window.innerWidth - menuRect.width)
            : Number.POSITIVE_INFINITY;
          const maxY = menuRect
            ? Math.max(0, window.innerHeight - menuRect.height)
            : Number.POSITIVE_INFINITY;

          function onMouseMove(ev: MouseEvent) {
            libCtxMenu.x = Math.max(
              0,
              Math.min(startMenuX + ev.clientX - startX, maxX),
            );
            libCtxMenu.y = Math.max(
              0,
              Math.min(startMenuY + ev.clientY - startY, maxY),
            );
          }

          function onMouseUp() {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          }

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        }}
      >
        <button
          class="ctx-pin tooltip-below"
          class:active={libCtxPinned}
          data-tooltip={libCtxPinned
            ? t("library.context.unpin")
            : t("library.context.pin")}
          onclick={(e) => {
            e.stopPropagation();
            libCtxPinned = !libCtxPinned;
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={libCtxPinned
            ? t("library.context.unpin")
            : t("library.context.pin")}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 2C8 2 6 5 6 9V11L2 15V18H22V15L18 11V9C18 5 16 2 12 2ZM12 18V23"
            />
          </svg>
        </button>
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <button
          class="ctx-close tooltip-below"
          data-tooltip={t("library.context.close")}
          onclick={(e) => {
            e.stopPropagation();
            forceCloseLibCtxMenu();
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={t("library.dialog.close")}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="edit-menu-card">
        <button
          class="ctx-item green"
          onclick={ctxMoveTo}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22 11 13 2 9 22 2" />
          </svg>
          {t("library.context.moveTo")}
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxCollect}
          role="menuitem"
          style="animation-delay: 55ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><line
              x1="12"
              y1="11"
              x2="12"
              y2="17"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><line
              x1="9"
              y1="14"
              x2="15"
              y2="14"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          {t("library.context.collect")}
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxFavorite}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={library.isFavorite(libCtxMenu.path) ? "currentColor" : "none"}
            ><polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
          {library.isFavorite(libCtxMenu.path)
            ? t("library.context.unfavorite")
            : t("library.context.favorite")}
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item red"
          onclick={ctxDelete}
          role="menuitem"
          style="animation-delay: 165ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          {t("library.context.delete")}
        </button>
      </div>
    </div>
  {/if}

  {#if colCtxMenu.visible}
    <div
      class="context-menu lib-ctx"
      class:pinned={colCtxPinned}
      bind:this={colCtxEl}
      style="left: {colCtxMenu.x}px; top: {colCtxMenu.y}px;"
      role="menu"
      tabindex="-1"
      transition:fly={{ y: -4, duration: 160, opacity: 0.08 }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          forceCloseColCtxMenu();
        }
      }}
    >
      <div
        class="ctx-drag"
        role="button"
        tabindex="0"
        aria-label={t("library.context.drag")}
        onmousedown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startY = e.clientY;
          const startMenuX = colCtxMenu.x;
          const startMenuY = colCtxMenu.y;
          const menu = (e.currentTarget as HTMLElement).closest(
            ".context-menu",
          );
          const menuRect = menu?.getBoundingClientRect();
          const maxX = menuRect
            ? Math.max(0, window.innerWidth - menuRect.width)
            : Number.POSITIVE_INFINITY;
          const maxY = menuRect
            ? Math.max(0, window.innerHeight - menuRect.height)
            : Number.POSITIVE_INFINITY;
          function onMouseMove(ev: MouseEvent) {
            colCtxMenu.x = Math.max(
              0,
              Math.min(startMenuX + ev.clientX - startX, maxX),
            );
            colCtxMenu.y = Math.max(
              0,
              Math.min(startMenuY + ev.clientY - startY, maxY),
            );
          }
          function onMouseUp() {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          }
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        }}
      >
        <button
          class="ctx-pin tooltip-below"
          class:active={colCtxPinned}
          data-tooltip={colCtxPinned
            ? t("library.context.unpin")
            : t("library.context.pin")}
          onclick={(e) => {
            e.stopPropagation();
            colCtxPinned = !colCtxPinned;
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={colCtxPinned
            ? t("library.context.unpin")
            : t("library.context.pin")}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 2C8 2 6 5 6 9V11L2 15V18H22V15L18 11V9C18 5 16 2 12 2ZM12 18V23"
            />
          </svg>
        </button>
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <button
          class="ctx-close tooltip-below"
          data-tooltip={t("library.context.close")}
          onclick={(e) => {
            e.stopPropagation();
            forceCloseColCtxMenu();
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={t("library.dialog.close")}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="edit-menu-card">
        <button
          class="ctx-item green"
          onclick={ctxRenameCol}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          {t("library.context.rename")}
        </button>
        <button
          class="ctx-item blue"
          onclick={ctxChangeCoverCol}
          role="menuitem"
          style="animation-delay: 55ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              ry="2"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="8.5"
              cy="8.5"
              r="1.5"
              stroke="currentColor"
              stroke-width="2"
            /><polyline
              points="21 15 16 10 5 21"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
            /></svg
          >
          {t("library.context.changeCover")}
        </button>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorerCol}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            /></svg
          >
          {t("library.context.showInExplorer")}
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item red"
          onclick={ctxDeleteCol}
          role="menuitem"
          style="animation-delay: 165ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          {t("library.context.delete")}
        </button>
      </div>
    </div>
  {/if}

  {#if showAddCollectionDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="library-dialog-overlay"
      class:library-dialog-overlay-anim={showAddCollectionDialog}
      role="presentation"
      onmousedown={(e) => {
        if (e.target === e.currentTarget) showAddCollectionDialog = false;
      }}
    >
      <div
        class="library-dialog library-dialog-anim"
        role="dialog"
        aria-modal="true"
      >
        <div class="library-dialog-header">
          <div class="library-dialog-header-left">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
              />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <p class="library-dialog-title">
              {t("library.dialog.addCollection")}
            </p>
          </div>
          <button
            class="library-dialog-close"
            onclick={() => (showAddCollectionDialog = false)}
            aria-label={t("library.dialog.close")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="library-dialog-body">
          <div class="edit-menu-card">
            <button
              class="library-dialog-option library-dialog-option-yellow"
              style={addCollAnimStyle(0)}
              onclick={addCollection}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                />
              </svg>
              <span>{t("library.dialog.syncFolder")}</span>
            </button>
          </div>
          <div class="library-dialog-or">
            <span class="library-dialog-or-line"></span>
            <span class="library-dialog-or-text">{t("library.dialog.or")}</span>
            <span class="library-dialog-or-line"></span>
          </div>
          <div class="edit-menu-card">
            <button
              class="library-dialog-option library-dialog-option-blue"
              onclick={confirmCreateCollection}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t("library.dialog.createCollection")}</span>
            </button>
            <div class="library-dialog-row">
              <div class="library-dialog-name-wrap">
                <svg
                  class="library-dialog-name-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                  />
                  <path
                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                  />
                </svg>
                <input
                  id="collection-name"
                  class="library-dialog-input"
                  class:library-dialog-input-error={nameError}
                  type="text"
                  autocomplete="off"
                  bind:value={newCollectionName}
                  placeholder={t("library.dialog.name")}
                  onkeydown={(e) => {
                    if (e.key === "Enter") confirmCreateCollection();
                    if (e.key === "Escape") {
                      showAddCollectionDialog = false;
                    }
                  }}
                  oninput={clearNameError}
                />
              </div>
              <button class="library-dialog-thumb-btn" onclick={pickThumbnail}>
                {#if newCollectionThumbnail}
                  <span class="library-dialog-thumb-name"
                    >{getFileName(newCollectionThumbnail)}</span
                  >
                {:else}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>{t("library.dialog.cover")}</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if collectionToDelete}
    {@const delCol = library.collections.find(
      (c) => c.path === collectionToDelete,
    )}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="library-dialog-overlay library-dialog-overlay-anim"
      role="presentation"
      onmousedown={(e) => {
        if (e.target === e.currentTarget) cancelDeleteCollection();
      }}
    >
      <div
        class="library-dialog library-dialog-sm library-dialog-anim"
        role="dialog"
        aria-modal="true"
      >
        <div class="library-dialog-header">
          <div
            class="library-dialog-header-left"
            style="color: var(--red, #e74c3c);"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <p class="library-dialog-title">
              {delCol?.type === "linked"
                ? t("library.dialog.deleteSyncTitle")
                : t("library.dialog.deleteCollectionTitle")}
            </p>
          </div>
          <button
            class="library-dialog-close"
            onclick={cancelDeleteCollection}
            aria-label={t("library.dialog.close")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="library-dialog-body" style="padding-bottom: 4px;">
          <div class="edit-menu-card">
            <p class="library-dialog-warning">
              {#if delCol?.type === "linked"}
                {t("library.dialog.deleteSyncWarning")}
              {:else}
                {t("library.dialog.deleteCollectionWarning")}
              {/if}
            </p>
          </div>
        </div>
        <div class="library-dialog-actions" style="justify-content: center;">
          <div
            class="edit-menu-card"
            style="flex-direction: row; gap: 6px; width: fit-content;"
          >
            <button
              class="library-dialog-btn library-dialog-btn-secondary"
              onclick={cancelDeleteCollection}
              >{t("library.dialog.cancel")}</button
            >
            <button
              class="library-dialog-btn library-dialog-btn-danger"
              onclick={confirmDeleteCollection}
              >{t("library.dialog.delete")}</button
            >
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showGenToast}
    <div class="library-gen-toast-wrapper">
      <ThumbnailGenToast />
    </div>
  {/if}
</div>

<style>
  .library-gen-toast-wrapper {
    position: fixed;
    bottom: 44px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 95;
    pointer-events: none;
  }

  .library-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary, #0a0a0a);
    outline: none;
  }

  .lib-ctx .ctx-sep {
    height: 1px;
    margin: 4px 8px;
  }

  .library-river,
  .library-list {
    animation: ss-fade-in 140ms ease-out both;
  }

  .tab-content {
    width: 100%;
    min-height: 100%;
    min-width: 0;
  }

  .tab-content.filmstrip-mode {
    min-height: 0;
    height: 100%;
  }

  .library-tabs {
    position: relative;
    display: flex;
    justify-content: center;
    gap: 2px;
    padding: 12px 24px 8px;
    border-bottom: 0.5px solid var(--bg-border, #2a2a2a);
  }

  .library-tab-highlight {
    position: absolute;
    left: 0;
    z-index: 0;
    border-radius: 8px;
    background: var(--bg-elevated, #1a1a1a);
    opacity: 0;
    pointer-events: none;
    transition:
      transform 300ms cubic-bezier(0.65, 0, 0.35, 1),
      width 300ms cubic-bezier(0.65, 0, 0.35, 1),
      opacity 120ms ease;
  }

  .library-tab-highlight:not(.ready) {
    transition: none;
  }

  .library-tab-highlight.ready {
    opacity: 1;
  }

  .library-tab-highlight.collect-mode {
    background: var(--accent-blue, #3b82f6);
  }

  .library-tab {
    position: relative;
    z-index: 1;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    font-family: var(--font-family);
    font-size: 13px;
    padding: 6px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      opacity 140ms ease;
  }

  /* Centre the tab group with auto margins so an overflowing row starts at the
     padding edge instead of sliding under the filter button. */
  .library-tab[data-tab="library"] {
    margin-left: auto;
  }

  .library-tab[data-tab="favorites"] {
    margin-right: auto;
  }

  .library-tabs.no-motion .library-tab,
  .library-tabs.no-motion .library-tab-highlight {
    transition-duration: 0ms;
  }

  .library-tab:hover {
    background: var(--bg-secondary, #111);
    color: var(--text-secondary, #ccc);
  }

  .library-tab.active {
    color: var(--text-primary, #fff);
  }

  .library-tab.active:hover {
    background: transparent;
  }

  .library-tab.collect-mode {
    color: #fff;
  }

  /* Search sits absolutely in the toolbar row; the right offset is measured
     from the topbar close button at runtime (8px is the pre-measure fallback). */
  .library-search {
    position: absolute;
    top: 50%;
    right: 8px;
    z-index: 2;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    width: 28px;
    height: 30px;
    /* Right inset is reserved for the icon, so the field grows leftwards while
       the magnifier stays put. */
    padding: 0 32px 0 4px;
    border: 0.5px solid transparent;
    border-radius: 8px;
    background: transparent;
    box-sizing: border-box;
    transition:
      width 200ms cubic-bezier(0.65, 0, 0.35, 1),
      background 160ms ease,
      border-color 160ms ease;
  }

  .library-search.expanded {
    /* Scales with the window: 170px on a narrow window, ~340px on a wide one. */
    width: clamp(170px, 60px + 18vw, 340px);
    border-color: var(--bg-border, #2a2a2a);
    background: var(--bg-primary, #0b0b0b);
  }

  /* Right-side cluster: the cards sit next to the search and open leftwards.
     row-reverse is permanent so the funnel never reorders while a card closes.
     Spacing mirrors the bottombar's view/labels pair: one 28px button plus the
     4px icon gap, flush with the same 8px edge inset. */
  .lib-filter {
    position: absolute;
    top: 50%;
    z-index: 2;
    transform: translateY(-50%);
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    gap: 4px;
    width: 28px;
    height: 30px;
    padding: 0 32px 0 4px;
    border: 0.5px solid transparent;
    border-radius: 8px;
    background: transparent;
    box-sizing: border-box;
    transition:
      width 200ms cubic-bezier(0.65, 0, 0.35, 1),
      background 160ms ease,
      border-color 160ms ease;
  }

  .lib-filter.expanded {
    /* Scales with the window: ~176px on a narrow window, 280px on a wide one. */
    width: clamp(176px, 70px + 11vw, 280px);
    border-color: var(--bg-border, #2a2a2a);
    background: var(--bg-primary, #0b0b0b);
  }

  .lib-filter.expanded:focus-within {
    border-color: var(--text-primary, #fff);
    background: var(--bg-secondary, #111);
  }

  .lib-filter.no-motion {
    transition: none;
  }

  .lib-filter-toggle {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-muted, #888);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .lib-filter-toggle:focus-visible {
    box-shadow: 0 0 0 1px var(--text-muted, #888);
    outline: none;
  }

  .lib-filter.expanded .lib-filter-toggle:focus-visible {
    box-shadow: inset 0 0 0 1px var(--text-muted, #888);
  }

  .lib-filter-toggle:hover {
    background: var(--bg-secondary, #111);
    color: var(--text-secondary, #ccc);
  }

  /* The expanded card already frames the control; a hover fill here would
     cross the card's rounded border. */
  .lib-filter.expanded .lib-filter-toggle:hover {
    background: transparent;
    color: var(--text-primary, #fff);
  }

  .lib-filter-toggle.is-on,
  .lib-filter-toggle.is-on:hover,
  .lib-filter.expanded .lib-filter-toggle.is-on,
  .lib-filter.expanded .lib-filter-toggle.is-on:hover {
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-primary, #fff);
  }

  .lib-filter-divider {
    flex: 0 0 1px;
    width: 1px;
    height: 16px;
    background: var(--bg-border, #2a2a2a);
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .lib-filter.expanded .lib-filter-divider {
    opacity: 0.8;
    transition-delay: 140ms;
  }

  .lib-filter-chips {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 140ms ease;
  }

  .lib-filter.expanded .lib-filter-chips {
    opacity: 1;
    pointer-events: auto;
    transition-delay: 140ms;
  }

  .lib-filter.no-motion .lib-filter-chips,
  .lib-filter.no-motion .lib-filter-divider {
    transition: none;
  }

  .lib-filter-chip {
    flex: 1 1 26px;
    min-width: 24px;
    max-width: 40px;
    height: 24px;
    display: grid;
    place-items: center;
    padding: 0;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-hint, #555);
    cursor: pointer;
    transition:
      color 0.13s ease,
      background 0.13s ease;
  }

  .lib-filter-chip:hover {
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-secondary, #ccc);
  }

  .lib-filter-chip:focus-visible {
    box-shadow: 0 0 0 1px var(--text-muted, #888);
  }

  .lib-filter-chip.on {
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-primary, #fff);
  }

  .lib-filter-chip[aria-disabled="true"] {
    cursor: default;
  }

  .lib-filter-hint {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    z-index: 3;
    transform: translateX(-50%);
    max-width: 190px;
    padding: 5px 9px;
    border: 0.5px solid var(--bg-border, #2a2a2a);
    border-radius: 6px;
    background: color-mix(
      in srgb,
      var(--bg-elevated, #1a1a1a) 92%,
      transparent
    );
    color: var(--text-mid, #bbb);
    font-family: var(--font-family);
    font-size: 11px;
    line-height: 1.35;
    text-align: center;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(8px);
    pointer-events: none;
    animation: lib-filter-hint-in 140ms ease both;
  }

  @keyframes lib-filter-hint-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .lib-filter.no-motion .lib-filter-hint {
    animation: none;
  }

  /* Keep both header buttons clear of the centred tabs on narrow windows. */
  @media (max-width: 620px) {
    .library-tabs {
      padding: 12px 52px 8px;
    }

    .library-tab {
      padding: 6px 11px;
      font-size: 12px;
    }
  }

  /* Keep the two header controls from ever overlapping on very narrow
     viewports (high UI scale or display scaling). */
  @media (max-width: 380px) {
    .library-search.expanded,
    .lib-filter.expanded {
      width: calc(100vw - 60px);
    }

    .lib-filter-chip {
      min-width: 18px;
    }
  }

  .library-search.expanded:focus-within {
    border-color: var(--text-primary, #fff);
    background: var(--bg-secondary, #111);
  }

  .library-search.no-motion {
    transition: none;
  }

  .library-search.no-motion .library-search-input,
  .library-search.no-motion .library-search-clear,
  .library-search.no-motion .library-search-count {
    transition: none;
  }

  .library-search-toggle {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-muted, #888);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .library-search-toggle:hover {
    background: var(--bg-secondary, #111);
    color: var(--text-secondary, #ccc);
  }

  .library-search.expanded .library-search-toggle {
    color: var(--text-hint, #555);
  }

  .library-search.expanded .library-search-toggle:hover {
    background: transparent;
    color: var(--text-secondary, #ccc);
  }

  .library-search-toggle.is-on,
  .library-search-toggle.is-on:hover {
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-primary, #fff);
  }

  /* Inside the expanded field the arc already frames the control; a filled
     square here reads as a badge poking through the rounded edge. */
  .library-search.expanded .library-search-toggle.is-on,
  .library-search.expanded .library-search-toggle.is-on:hover {
    background: transparent;
    color: var(--text-primary, #fff);
  }

  .library-search-input {
    flex: 1 1 0;
    width: 0;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-secondary, #ccc);
    font-family: var(--font-family);
    font-size: 12px;
    opacity: 0;
    transform: translateX(-4px);
    transition:
      opacity 200ms ease,
      transform 200ms cubic-bezier(0.65, 0, 0.35, 1);
  }

  .library-search.expanded .library-search-input {
    opacity: 1;
    transform: none;
    transition-delay: 50ms;
  }

  .library-search-input::placeholder {
    color: var(--text-hint, #555);
  }

  .library-search-input::-webkit-search-cancel-button {
    display: none;
  }

  .library-search-count {
    flex: 0 1 auto;
    min-width: 0;
    margin-left: 6px;
    overflow: hidden;
    color: var(--text-hint, #555);
    font-family: var(--font-family);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .library-search-clear {
    flex: 0 1 18px;
    display: grid;
    place-items: center;
    width: 18px;
    min-width: 0;
    height: 18px;
    margin-right: 2px;
    padding: 0;
    overflow: hidden;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted, #888);
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .library-search-clear:hover {
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-primary, #fff);
  }

  .library-search-empty {
    gap: 10px;
    animation: library-search-fade-in 140ms ease both;
  }

  .library-search-empty.no-motion {
    animation: none;
  }

  .library-search-empty-hint {
    margin-top: -6px;
    color: var(--text-hint, #555);
    font-size: 12px;
  }

  .library-search-empty-clear {
    pointer-events: auto;
    padding: 4px 10px;
    border: 0.5px solid var(--bg-border, #2a2a2a);
    border-radius: 7px;
    background: var(--bg-secondary, #111);
    color: var(--text-secondary, #ccc);
    font-family: var(--font-family);
    font-size: 12px;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .library-search-empty-clear:hover {
    border-color: var(--text-muted, #888);
    color: var(--text-primary, #fff);
  }

  @keyframes library-search-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .library-placeholder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 6px;
  }

  .library-placeholder-card {
    aspect-ratio: 1;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--bg-border, #2a2a2a);
    background: var(--bg-secondary, #111);
    color: var(--text-muted, #888);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .library-placeholder-card:hover {
    border-color: var(--text-muted, #888);
    background: var(--bg-elevated, #1a1a1a);
  }

  .library-placeholder-card.collect-mode {
    border-color: var(--accent-blue, #3b82f6);
  }

  .library-placeholder-card.collect-mode svg {
    color: var(--accent-blue, #3b82f6);
    opacity: 1;
  }

  .river-fav-placeholder,
  .filmstrip-fav-placeholder {
    aspect-ratio: unset;
    flex-shrink: 0;
  }

  .list-fav-placeholder {
    cursor: pointer;
  }

  /* The expanded search paints over the filter on its own (same z-order, later
     in the DOM), so no opacity trick is needed and closing stays fluid. */
  .library-toolbar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-height: 32px;
    flex-shrink: 0;
  }

  /* Collection header / breadcrumb, left-aligned in its toolbar row. The left
     inset centres the 16px leading icon in a 28px slot at the bar's 8px edge,
     lining it up with the Sort by and topbar app menu buttons. */
  .library-collection-header {
    font-family: var(--font-family);
    font-size: 15px;
    padding: 8px 24px 8px 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    flex-shrink: 0;
  }

  /* The 24px trailing padding would otherwise push the right-side recents
     tooltip away from the count; keep the standard 6px gap. */
  .library-collection-header.tooltip-right::after {
    left: calc(100% - 18px);
  }

  .library-breadcrumb-segment {
    background: none;
    border: none;
    padding: 2px 0;
    font-family: var(--font-family);
    font-size: 15px;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.1s;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .library-breadcrumb-segment:hover {
    color: var(--text-primary, #ccc);
  }

  .library-breadcrumb-segment.active {
    color: var(--text-primary, #ccc);
    font-weight: 500;
    cursor: default;
  }

  button.library-breadcrumb-segment.active {
    cursor: pointer;
  }

  button.library-breadcrumb-segment.active:hover {
    opacity: 0.7;
  }

  .library-header-count {
    color: var(--text-dim, #555);
    font-weight: 400;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
  }

  .library-header-count.warning {
    color: var(--red, #dc2626);
    opacity: 0.75;
    transition: opacity 0.15s ease;
  }

  .library-header-count.warning:hover {
    opacity: 1;
  }

  .library-breadcrumb-sep {
    color: var(--text-dim, #555);
    font-size: 14px;
    flex-shrink: 0;
  }

  .library-collection-card {
    aspect-ratio: 1;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 2px solid transparent;
    background: var(--bg-secondary, #111);
    color: var(--text-primary, #fff);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.1s,
      transform 0.15s;
  }

  .library-collection-card:hover {
    border-color: var(--border-hover, #555);
    transform: scale(1.02);
  }

  .library-collection-card.collect-mode {
    border-color: var(--accent-blue, #3b82f6);
  }

  .library-collection-content {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .library-collection-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .library-collection-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--blue-light);
  }

  .label-renaming {
    pointer-events: auto;
  }

  .library-rename-input {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 12px;
    font-family: var(--font-family);
    text-align: center;
    padding: 1px 4px;
    outline: none;
    caret-color: var(--text-primary, #fff);
    cursor: text;
  }

  .library-collection-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #888);
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s,
      background 0.15s;
    z-index: 2;
  }

  :global([data-theme="light"]) .library-collection-remove {
    color: #d4d4d8;
  }

  .library-collection-card:hover .library-collection-remove {
    opacity: 1;
  }

  .library-collection-remove:hover {
    background: #3a1a1a;
    color: var(--red, #dc2626);
  }

  .library-scroll {
    position: relative;
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-behavior: smooth;
    overflow-anchor: none;
    padding: 16px 24px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .library-scroll.filmstrip {
    overflow-y: hidden;
  }

  .library-scroll::-webkit-scrollbar {
    display: none;
  }

  .library-scroll.dragging {
    user-select: none;
    cursor: crosshair;
  }

  .library-scroll.dragging * {
    user-select: none;
  }

  /* Filmstrip view */
  .library-filmstrip {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 100%;
    padding: 0 24px;
    box-sizing: border-box;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    scroll-behavior: smooth;
  }

  .library-filmstrip::-webkit-scrollbar {
    display: none;
  }

  .filmstrip-divider {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    align-self: stretch;
    width: 2rem;
    padding: 10px 0 6px;
    position: relative;
    justify-content: flex-start;
    animation: filmstrip-divider-in 180ms cubic-bezier(0.22, 0.9, 0.3, 1) both;
  }

  @keyframes filmstrip-divider-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .filmstrip-divider.exiting {
    animation: filmstrip-divider-out 180ms cubic-bezier(0.22, 0.9, 0.3, 1) both;
  }

  @keyframes filmstrip-divider-out {
    from {
      opacity: 1;
      transform: none;
    }
    to {
      opacity: 0;
      transform: translateY(-8px);
    }
  }

  .filmstrip-divider::after {
    content: "";
    flex: 1;
    width: 1px;
    background: var(--border-dim, #333);
    min-height: 8px;
  }

  .filmstrip-divider-label {
    font-family: var(--font-family);
    font-size: 10px;
    color: var(--text-dim, #555);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    line-height: 1.2;
  }

  .filmstrip-cell {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    scroll-snap-align: center;
    border: 2px solid transparent;
    transition:
      border-color 0.1s,
      height 0.2s,
      width 0.2s;
    background: var(--bg-secondary, #111);
  }

  .filmstrip-cell:hover {
    border-color: var(--border-hover, #555);
  }

  .filmstrip-cell.active {
    border-color: var(--text-primary, #fff);
  }

  .filmstrip-cell.selected {
    border-color: var(--yellow, #f5c518);
  }

  .filmstrip-cell.active.selected {
    border-color: var(--yellow, #f5c518);
  }

  .filmstrip-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .filmstrip-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 20%,
      var(--bg-shimmer) 50%,
      var(--bg-secondary) 80%
    );
    background-size: 200% 100%;
    animation: thumbShimmer 3s ease-in-out infinite;
  }

  .filmstrip-subfolder-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .filmstrip-subfolder-name {
    font-family: var(--font-family);
    font-size: 11px;
    color: var(--text-primary, #fff);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 90%;
  }

  /* River view */
  .library-river {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .river-cell {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    min-width: 60px;
    border: 2px solid transparent;
    transition:
      border-color 0.1s,
      transform 0.15s,
      flex-grow 0.3s cubic-bezier(0.65, 0, 0.35, 1);
    background: var(--bg-secondary, #111);
  }

  .river-cell:hover {
    border-color: var(--border-hover, #555);
    transform: scale(1.02);
  }

  .river-cell.active {
    border-color: var(--text-primary, #fff);
  }

  .river-cell.selected {
    border-color: var(--yellow, #f5c518);
  }

  .river-cell.active.selected {
    border-color: var(--yellow, #f5c518);
  }

  .river-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .river-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 20%,
      var(--bg-shimmer) 50%,
      var(--bg-secondary) 80%
    );
    background-size: 200% 100%;
    animation: thumbShimmer 3s ease-in-out infinite;
  }

  .river-subfolder-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    aspect-ratio: 1;
    flex-grow: 0 !important;
  }

  .river-subfolder-name {
    font-family: var(--font-family);
    font-size: 11px;
    color: var(--text-primary, #fff);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 90%;
  }

  /* Grid view */
  .library-grid {
    display: grid;
    gap: 6px;
  }

  .library-subfolder-card {
    aspect-ratio: 1;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 2px solid transparent;
    transition:
      border-color 0.1s,
      transform 0.15s;
    background: var(--bg-secondary, #111);
  }

  .library-subfolder-card:hover {
    border-color: var(--border-hover, #555);
    transform: scale(1.02);
  }

  /* Suppress hover motion while scrolling so cells passing under the pointer
     do not scale in and out, which reads as flicker. */
  .library-scroll.scrolling :where(.library-cell, .library-subfolder-card) {
    transition: none;
  }

  .library-scroll.scrolling
    :where(.library-cell:hover, .library-subfolder-card:hover) {
    transform: none;
  }

  .library-subfolder-icon {
    flex-shrink: 0;
  }

  .library-subfolder-name {
    font-family: var(--font-family);
    font-size: 11px;
    color: var(--text-primary, #fff);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 90%;
    padding: 0 4px;
  }

  .library-cell {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    transition:
      border-color 0.1s,
      transform 0.15s;
    position: relative;
    background: var(--bg-secondary, #111);
  }

  .library-cell:hover {
    border-color: var(--border-hover, #555);
    transform: scale(1.02);
  }

  .library-cell.active {
    border-color: var(--text-primary, #fff);
  }

  .library-cell.selected {
    border-color: var(--yellow, #f5c518);
  }

  .library-cell.active.selected {
    border-color: var(--yellow, #f5c518);
  }

  .library-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .library-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 20%,
      var(--bg-shimmer) 50%,
      var(--bg-secondary) 80%
    );
    background-size: 200% 100%;
    animation: thumbShimmer 3s ease-in-out infinite;
  }

  /* Terminal state: a failed request must not look like it is still loading. */
  .library-placeholder.failed,
  .river-placeholder.failed,
  .filmstrip-placeholder.failed,
  .list-placeholder.failed {
    animation: none;
    background: var(--bg-elevated);
    opacity: 0.6;
  }

  /* Shimmer repaints are pure paint work; freeze them while the user scrolls. */
  .library-scroll.scrolling
    :where(
      .library-placeholder,
      .river-placeholder,
      .filmstrip-placeholder,
      .list-placeholder
    ) {
    animation-play-state: paused;
  }

  /* Media-type badges */
  .library-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.65);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    pointer-events: none;
    transition: bottom 190ms cubic-bezier(0.22, 0.9, 0.3, 1);
  }

  .names-on .library-badge {
    bottom: 28px;
  }

  .library-badge-pdf {
    width: 22px;
    height: 22px;
  }

  /* Selection checkbox */
  .library-checkbox {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: none;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition:
      background 0.1s,
      border-color 0.1s,
      opacity 0.1s;
    cursor: pointer;
    z-index: 2;
    color: #fff;
  }

  .library-checkbox:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .library-checkbox.checked {
    background: var(--yellow, #f5c518);
    color: #000;
  }

  .select-mode .library-checkbox,
  .library-checkbox.checked {
    opacity: 1;
  }

  .library-cell:hover .library-checkbox,
  .river-cell:hover .library-checkbox,
  .filmstrip-cell:hover .library-checkbox {
    opacity: 1;
  }

  /* List view */
  .library-list {
    display: flex;
    flex-direction: column;
  }

  .list-header {
    display: flex;
    align-items: center;
    padding: 0 8px;
    height: 28px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--bg-border, #2a2a2a);
    font-family: var(--font-family);
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-primary, #0a0a0a);
    flex-shrink: 0;
  }

  .list-sort-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    text-transform: inherit;
    letter-spacing: inherit;
    border-radius: 3px;
    transition: color 0.1s;
  }

  .list-sort-btn:hover {
    color: var(--text-primary, #fff);
  }

  .list-sort-arrow {
    font-size: 9px;
    line-height: 1;
  }

  .list-row {
    display: flex;
    padding: 0 8px;
    height: 32px;
    cursor: pointer;
    transition: background 0.08s;
    align-items: center;
    font-family: var(--font-family);
    border-bottom: 1px solid var(--bg-border, #2a2a2a);
  }

  .list-subfolder-row {
    cursor: pointer;
  }

  .list-subfolder-row:hover {
    background: var(--bg-elevated, #1a1a1a);
  }

  .list-row.even {
    background: rgba(255, 255, 255, 0.015);
  }

  .list-row:hover {
    background: var(--bg-elevated, #1a1a1a);
  }

  .list-row.active {
    background: rgba(255, 255, 255, 0.06);
  }

  :global([data-theme="light"]) .list-row.active {
    background: rgba(0, 0, 0, 0.06);
  }

  :global([data-theme="light"]) .list-row.even {
    background: rgba(0, 0, 0, 0.02);
  }

  .list-row.selected {
    background: var(--yellow-bg-subtle, rgba(245, 197, 24, 0.08));
  }

  .list-row.selected:hover {
    background: var(--yellow-bg-faint, rgba(245, 197, 24, 0.12));
  }

  .list-col {
    font-size: var(--list-font);
    color: var(--text-primary, #ccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 4px;
  }

  .list-col-check {
    width: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .list-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1.5px solid var(--text-dim, #444);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition:
      background 0.1s,
      border-color 0.1s,
      opacity 0.1s;
    color: #000;
    flex-shrink: 0;
  }

  .list-checkbox:hover {
    border-color: var(--text-muted, #888);
  }

  .list-checkbox.checked {
    background: var(--yellow, #f5c518);
    border-color: var(--yellow, #f5c518);
  }

  .list-checkbox.indeterminate {
    background: var(--yellow, #f5c518);
    border-color: var(--yellow, #f5c518);
  }

  /* Selection ticks use black ink, so keep the fill bright in light theme. */
  :global([data-theme="light"]) .library-checkbox.checked,
  :global([data-theme="light"]) .list-checkbox.checked,
  :global([data-theme="light"]) .list-checkbox.indeterminate {
    background: #f5c518;
    border-color: #f5c518;
  }

  .list-checkbox-header {
    opacity: 1;
  }

  .select-mode .list-checkbox,
  .list-checkbox.checked {
    opacity: 1;
  }

  .list-row:hover .list-checkbox {
    opacity: 1;
  }

  .list-col-thumb {
    width: var(--list-thumb);
    height: var(--list-thumb);
    flex-shrink: 0;
    margin-right: 8px;
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary, #111);
  }

  .list-col-name {
    flex: 1;
    min-width: 0;
  }

  .list-col-size {
    width: 90px;
    flex-shrink: 0;
    text-align: right;
    color: var(--text-muted, #888);
    font-size: var(--list-type-font);
    font-variant-numeric: tabular-nums;
  }

  .list-col-date {
    width: 140px;
    flex-shrink: 0;
    text-align: right;
    color: var(--text-muted, #888);
    font-size: var(--list-type-font);
  }

  .list-col-type {
    width: 80px;
    flex-shrink: 0;
    text-align: right;
    color: var(--text-muted, #888);
    font-size: var(--list-type-font);
  }

  .list-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .list-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 20%,
      var(--bg-shimmer) 50%,
      var(--bg-secondary) 80%
    );
    background-size: 200% 100%;
    animation: thumbShimmer 3s ease-in-out infinite;
  }

  /* Empty state */
  .library-empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    pointer-events: none;
    color: var(--text-muted, #888);
    font-size: 14px;
    font-family: var(--font-family);
  }

  .library-empty-icons {
    position: relative;
    width: 96px;
    height: 96px;
  }

  .library-empty-icon {
    position: absolute;
  }

  .library-empty-icon-top {
    left: 24px;
    top: 0;
  }

  .library-empty-icon-bl {
    left: 0;
    top: 48px;
  }

  .library-empty-icon-br {
    left: 48px;
    top: 48px;
  }

  /* Collection dialog overlay */
  .library-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .library-dialog-overlay-anim {
    animation: uiOverlayFadeIn 150ms ease forwards;
  }

  .library-dialog {
    background: var(--bg-secondary, #111);
    border: 0.5px solid var(--bg-border, #2a2a2a);
    border-radius: 12px;
    padding: 0;
    min-width: 340px;
    max-width: 400px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
  }

  .library-dialog-anim {
    animation: uiDialogPopIn 250ms cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
  }

  .library-dialog-sm {
    min-width: 300px;
    max-width: 360px;
  }

  .library-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 0.5px solid var(--bg-elevated, #1a1a1a);
  }

  .library-dialog-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-primary, #fff);
  }

  .library-dialog-title {
    font-family: var(--font-family);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin: 0;
  }

  .library-dialog-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    border-radius: 7px;
    flex-shrink: 0;
  }

  .library-dialog-close:hover {
    color: var(--red, #e74c3c);
    background: var(--red-bg-faint, rgba(231, 76, 60, 0.1));
  }

  .library-dialog-body {
    padding: 12px 20px;
  }

  .library-dialog-option {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border: 0.5px solid transparent;
    border-radius: 7px;
    font-family: var(--font-family);
    font-size: 12px;
    cursor: pointer;
    transition: filter 0.12s;
    text-align: left;
  }

  .library-dialog-option-blue {
    background: var(--blue-bg);
    color: var(--blue-light);
  }

  .library-dialog-option-blue:hover {
    background: var(--blue-bg-hover);
  }

  .library-dialog-option-yellow {
    background: var(--yellow-bg);
    color: var(--yellow-soft);
  }

  .library-dialog-option-yellow:hover {
    background: var(--yellow-bg-hover);
  }

  .library-dialog-or {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .library-dialog-or-line {
    flex: 1;
    height: 0.5px;
    background: var(--bg-elevated, #1a1a1a);
  }

  .library-dialog-or-text {
    font-family: var(--font-family);
    font-size: 11px;
    color: var(--text-dim, #555);
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .library-dialog-thumb-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: 0.5px solid var(--bg-border, #2a2a2a);
    border-radius: 7px;
    background: var(--bg-primary, #0a0a0a);
    color: var(--text-muted, #888);
    font-family: var(--font-family);
    font-size: 12px;
    cursor: pointer;
    transition:
      background 0.1s,
      border-color 0.1s,
      color 0.1s;
    text-align: left;
    box-sizing: border-box;
    white-space: nowrap;
  }

  .library-dialog-thumb-btn:hover {
    background: var(--bg-secondary, #111);
    border-color: var(--text-muted, #888);
    color: var(--text-secondary, #ccc);
  }

  .library-dialog-thumb-name {
    color: var(--text-secondary, #ccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .library-dialog-row {
    display: flex;
    gap: 6px;
  }

  .library-dialog-name-wrap {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .library-dialog-name-icon {
    position: absolute;
    left: 10px;
    color: var(--text-dim, #555);
    pointer-events: none;
    flex-shrink: 0;
  }

  .library-dialog-name-wrap > .library-dialog-input {
    padding-left: 30px;
  }

  .library-dialog-input {
    padding: 8px 10px;
    background: var(--bg-primary, #0a0a0a);
    border: 0.5px solid var(--bg-border, #2a2a2a);
    border-radius: 7px;
    color: var(--text-primary, #fff);
    font-family: var(--font-family);
    font-size: 12px;
    outline: none;
    transition: border-color 0.1s;
  }

  .library-dialog-input:focus {
    border-color: var(--text-muted, #888);
  }

  .library-dialog-input-error {
    border-color: var(--red-border, rgba(231, 76, 60, 0.35));
  }

  .library-dialog-input-error:focus {
    border-color: var(--red-border, rgba(231, 76, 60, 0.35));
  }

  .library-dialog-input::placeholder {
    color: var(--text-dim, #555);
  }

  .library-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding: 0 20px 8px;
  }

  .library-dialog-btn {
    padding: 7px 16px;
    border-radius: 7px;
    font-family: var(--font-family);
    font-size: 12px;
    border: none;
    cursor: pointer;
    transition: background 0.1s;
  }

  .library-dialog-btn-secondary {
    background: var(--bg-secondary, #111);
    color: var(--text-secondary, #ccc);
    border: 0.5px solid var(--bg-border, #2a2a2a);
  }

  .library-dialog-btn-secondary:hover {
    background: var(--bg-tertiary, #222);
  }

  .library-dialog-btn-danger {
    background: #c0392b;
    color: #fff;
  }

  .library-dialog-btn-danger:hover {
    background: #e74c3c;
  }

  .library-dialog-warning {
    font-family: var(--font-family);
    font-size: 13px;
    color: var(--text-secondary, #ccc);
    margin: 0;
    line-height: 1.5;
  }

  /* Drag selection rectangle */
  .select-rect {
    position: fixed;
    border: 1px dashed var(--yellow, #f5c518);
    background: rgba(245, 197, 24, 0.08);
    pointer-events: none;
    z-index: 10;
    border-radius: 6px;
  }
  /* Hide the pointer while navigating with the keyboard. Any pointer
     movement or press restores it. */
  :global(html.library-keyboard-nav),
  :global(html.library-keyboard-nav *) {
    cursor: none !important;
  }
</style>
