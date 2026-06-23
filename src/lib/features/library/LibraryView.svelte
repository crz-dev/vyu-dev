<script lang="ts">
  import {
    VIDEO_EXTS,
    AUDIO_EXTS,
    DOCUMENT_EXTS,
    ALL_EXTS,
  } from "$lib/shared/constants";
  import {
    getFileExt,
    getFileName,
    getParentFolder,
  } from "$lib/services/files";
  import { fade } from "svelte/transition";
  import { library } from "$lib/features/library/library.svelte";
  import { getSections, type Section } from "$lib/features/library/sections";
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
  } from "$lib/features/media/tools";
  import { showToast } from "$lib/features/toast/toast.svelte";
  import { menuStore } from "$lib/features/stores/menuVisibility.svelte";
  import { computeContextMenuPosition } from "$lib/services/session";
  import { TS_DROP_ANIM_DELAYS_MS } from "$lib/features/menus/dropAnimations";

  let {
    fileList,
    currentIndex,
    onSelect,
    onClose,
    selectMode = false,
  }: {
    fileList: string[];
    currentIndex: number;
    onSelect: (path: string) => void;
    onClose: () => void;
    selectMode?: boolean;
  } = $props();

  let scrollEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;
  let mounted = $state(false);
  let scrollActive = $state(false);
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  let imageDims = $state<Record<string, { w: number; h: number }>>({});

  // Drag-to-select state
  let dragStart: { x: number; y: number } | null = $state(null);
  let dragEnd: { x: number; y: number } | null = $state(null);
  let isDragging = $state(false);
  let dragSuppressedClick = $state(false);
  let lastClickedIndex: number | null = null;

  // Collection state
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

  // Library folder browsing state
  let libraryDirPath = $state<string | null>(null);
  let libraryBasePath = $state<string | null>(null);
  let libraryDirFolders = $state<string[]>([]);
  let libraryDirFiles = $state<string[]>([]);
  let folderStats = $state<Record<string, BatchStatItem>>({});

  // Library context menu state
  let libCtxMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
  }>({ visible: false, x: 0, y: 0, path: "" });
  let libCtxPinned = $state(false);
  let libCtxKey = $state(0);

  // Collection context menu state
  let colCtxMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
    name: string;
  }>({ visible: false, x: 0, y: 0, path: "", name: "" });
  let colCtxPinned = $state(false);
  let colCtxKey = $state(0);

  const VIDEO_SET = new Set(VIDEO_EXTS);
  const AUDIO_SET = new Set(AUDIO_EXTS);

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

  const activePaths = $derived(
    currentIndex >= 0 && currentIndex < fileList.length
      ? new Set([fileList[currentIndex]])
      : new Set<string>(),
  );

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

  const recentFilesWarning = $derived(
    !library.recentsDisabled &&
      library.recentFiles.length / library.recentFilesLimit >= 0.9,
  );

  function openRecentsSettings() {
    localStorage.setItem("vyu-settings-last-section", "library");
    menuStore.settingsOpen = true;
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
    return sorted;
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
      { label: "Library", path: base },
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
      { label: "Collections", path: null },
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

  const displayFiles = $derived.by(() => {
    if (library.activeTab === "recents") return library.getRecentPaths();
    if (library.activeTab === "favorites") return library.getFavoritePaths();
    if (isViewingCollection) return collectionFiles;
    if (library.activeTab === "library" && libraryDirPath)
      return libraryDirFiles;
    return fileList;
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
        cmp = getFileExt(a).localeCompare(getFileExt(b));
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
    library.dividersOn
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

  const sortedCollections = $derived.by(() => {
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

  const collectionSections = $derived.by(() => {
    const cols = sortedCollections;
    if (!library.dividersOn || cols.length === 0) {
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
        if (items) sections.push({ label, items });
      }
    } else if (mode === "type") {
      const order = library.sortDesc
        ? ["Custom collection", "Linked folder"]
        : ["Linked folder", "Custom collection"];
      for (const label of order) {
        const items = groups.get(label);
        if (items) sections.push({ label, items });
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
        if (items) sections.push({ label, items });
      }
      for (const [label, items] of groups) {
        if (!ordered.includes(label)) sections.push({ label, items });
      }
    } else {
      for (const [label, items] of groups) {
        sections.push({ label, items });
      }
    }

    return sections;
  });

  const folderPathSet = $derived(new Set(currentFolderPaths));

  // For filmstrip — track which section label is currently visible
  let filmstripSectionLabel = $state("");

  // Build a quick path→section lookup when sections change
  const pathSectionMap = $derived.by(() => {
    const map = new Map<string, string>();
    for (const s of sections) {
      for (const p of s.items) {
        map.set(p, s.label);
      }
    }
    return map;
  });

  const displaySections = $derived(
    library.dividersOn && sections.length > 0
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
    return library.cache[path] || "";
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
    if (wasYesterday) return "Yesterday";
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
          name: "Images",
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
    clearNameError();
    showAddCollectionDialog = false;
    await library.createCustomCollection(
      name,
      newCollectionThumbnail ?? undefined,
    );
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
    await library.removeCollection(path);
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
      } else if (ALL_EXTS.includes(getFileExt(e.name ?? ""))) {
        filesList.push(full);
      }
    }
    collectionFolders = folders;
    collectionFiles = filesList;
  }

  function startRename(path: string, currentName: string) {
    renamingPath = path;
    renameValue = currentName;
    renameOriginal = currentName;
  }

  function confirmRename() {
    if (!renamingPath) return;
    if (renameValue !== renameOriginal) {
      library.renameCollection(renamingPath, renameValue);
    }
    renamingPath = null;
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
    libCtxKey++;
  }

  function closeLibCtxMenu() {
    if (libCtxPinned) return;
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
      showToast({ message: "Failed to open with dialog", color: "red" });
    }
  }

  async function ctxMoveTo() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    try {
      const destDir = await open({ directory: true });
      if (!destDir) return;
      const fileName = getFileName(path);
      const destPath = `${destDir}\\${fileName}`;
      await invokeRenameFile(path, destPath);
      showToast({ message: "File moved", color: "blue" });
    } catch {
      showToast({ message: "Failed to move file", color: "red" });
    }
  }

  function ctxCollect() {
    closeLibCtxMenu();
    library.setCollectMode(true);
    library.setActiveTab("collections");
  }

  function ctxFavorite() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    if (library.isFavorite(path)) {
      library.removeFavorite(path);
      showToast({ message: "Removed from favorites", color: "yellow" });
    } else {
      library.addFavorite(path);
      showToast({ message: "Added to favorites", color: "yellow" });
    }
  }

  async function ctxDelete() {
    const path = libCtxMenu.path;
    closeLibCtxMenu();
    try {
      await invokeTrashFile(path);
      library.triggerRescan();
      showToast({ message: "File deleted", color: "red" });
    } catch {
      showToast({ message: "Failed to delete file", color: "red" });
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
    colCtxKey++;
  }

  function closeColCtxMenu() {
    if (colCtxPinned) return;
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

  function ctxCollectCol() {
    closeColCtxMenu();
    library.setCollectMode(true);
    library.setActiveTab("collections");
  }

  function ctxShowInExplorerCol() {
    const path = colCtxMenu.path;
    closeColCtxMenu();
    invokeOpenDirectory(path);
  }

  function ctxDeleteCol() {
    const path = colCtxMenu.path;
    closeColCtxMenu();
    library.removeCollection(path);
  }

  async function addFavoriteFromFile() {
    try {
      const file = await open({ multiple: false });
      if (file) {
        library.addFavorite(file as string);
        showToast({ message: "Added to favorites", color: "yellow" });
      }
    } catch {
      showToast({ message: "Failed to add favorite", color: "red" });
    }
  }

  function onImageLoad(path: string, e: Event) {
    const img = e.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      imageDims[path] = { w: img.naturalWidth, h: img.naturalHeight };
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && target.closest("input, textarea, [contenteditable='true']")) {
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (isViewingCollection) {
        library.closeCollection();
      } else {
        onClose();
      }
      return;
    }
    if (
      library.viewMode === "grid" ||
      library.viewMode === "filmstrip" ||
      library.viewMode === "list"
    ) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const idx = Math.min(currentIndex + 1, fileList.length - 1);
        if (idx !== currentIndex) onSelect(fileList[idx]);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = Math.max(currentIndex - 1, 0);
        if (idx !== currentIndex) onSelect(fileList[idx]);
      }
    }
  }

  // Scrollbar auto-hide
  function onScroll() {
    scrollActive = true;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollActive = false;
    }, 3000);
  }

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

  // Fade-in on mount
  $effect(() => {
    requestAnimationFrame(() => {
      mounted = true;
    });
    return () => {
      mounted = false;
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  });

  // Reset scroll to top when switching tabs
  $effect(() => {
    library.activeTab;
    if (scrollEl) {
      scrollEl.scrollTop = 0;
    }
  });

  // Observer lifecycle
  $effect(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const path = (entry.target as HTMLElement).dataset.path;
          if (!path) continue;
          if (entry.isIntersecting) {
            if (library.showThumbnails) library.requestThumbnail(path);
          } else {
            library.cancelPending(path);
          }
        }
      },
      { rootMargin: "200px" },
    );
    return () => observer?.disconnect();
  });

  // Re-observe elements when content changes
  $effect(() => {
    sortedFiles;
    const els = scrollEl?.querySelectorAll("[data-path]");
    if (els && observer) {
      for (const el of els) {
        observer.observe(el);
      }
    }
  });

  // Rebuild center-outward load queue
  $effect(() => {
    library.rebuildQueue(fileList, currentIndex);
  });

  // Compute total size on mount
  $effect(() => {
    if (fileList.length > 0) {
      library.computeTotalSize(fileList);
    }
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

  // Scan library directory for subfolders and files
  $effect(() => {
    const path = libraryDirPath;
    library.scanKey;
    if (!path || library.activeTab !== "library") {
      libraryDirFolders = [];
      libraryDirFiles = [];
      return;
    }
    (async () => {
      try {
        const sep = path.includes("\\") ? "\\" : "/";
        const entries = await readDir(path);
        const folders: string[] = [];
        const files: string[] = [];
        for (const e of entries) {
          const full = `${path}${sep}${e.name}`;
          if (e.isDirectory) {
            folders.push(full);
          } else if (ALL_EXTS.includes(getFileExt(e.name ?? ""))) {
            files.push(full);
          }
        }
        const sortFn = (a: string, b: string) =>
          getFileName(a).localeCompare(getFileName(b), undefined, {
            sensitivity: "base",
          });
        folders.sort(sortFn);
        files.sort(sortFn);
        libraryDirFolders = folders;
        libraryDirFiles = files;
      } catch {
        libraryDirFolders = [];
        libraryDirFiles = [];
      }
    })();
  });

  // Load folder stats for date-modified and size sort
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

  // Load collection files when active collection changes
  $effect(() => {
    const path = library.activeCollectionPath;
    library.scanKey;
    if (!path) {
      collectionFiles = [];
      collectionFolders = [];
      return;
    }
    (async () => {
      try {
        const sep = path.includes("\\") ? "\\" : "/";
        const entries = await readDir(path);
        const folders: string[] = [];
        const files: string[] = [];
        for (const e of entries) {
          const full = `${path}${sep}${e.name}`;
          if (e.isDirectory) {
            folders.push(full);
          } else if (ALL_EXTS.includes(getFileExt(e.name ?? ""))) {
            files.push(full);
          }
        }
        const sortFn = (a: string, b: string) =>
          getFileName(a).localeCompare(getFileName(b), undefined, {
            sensitivity: "base",
          });
        folders.sort(sortFn);
        files.sort(sortFn);
        collectionFolders = folders;
        collectionFiles = files;
      } catch {
        collectionFiles = [];
        collectionFolders = [];
      }
    })();
  });

  // Load stats and size for collection files
  $effect(() => {
    if (isViewingCollection && collectionFiles.length > 0) {
      library.computeTotalSize(collectionFiles);
      library.loadStats(collectionFiles);
    }
  });

  // Load first file for each collection card thumbnail
  $effect(() => {
    if (library.activeTab !== "collections") return;
    const cols = library.collections;
    for (const col of cols) {
      if (collectionFirstFiles[col.path]) continue;
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
            ALL_EXTS.includes(getFileExt(e.name ?? "")),
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

  // Scroll to current file on open, density change, or view mode switch
  $effect(() => {
    if (!mounted || !scrollEl) return;
    void library.density;
    void library.viewMode;
    const el = scrollEl.querySelector(
      `[data-path="${fileList[currentIndex]}"]`,
    ) as HTMLElement | null;
    if (el) {
      if (library.viewMode === "filmstrip") {
        el.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: "smooth",
        });
      } else {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Cleanup
  $effect(() => {
    return () => {
      library.clearQueue();
    };
  });

  function updateFilmstripSection() {
    if (!scrollEl) return;
    const filmstrip = scrollEl.querySelector(
      ".library-filmstrip",
    ) as HTMLElement | null;
    if (!filmstrip) return;
    const items = filmstrip.querySelectorAll<HTMLElement>("[data-path]");
    const scrollLeft = filmstrip.scrollLeft;
    const containerRight = scrollLeft + filmstrip.clientWidth;
    // Find the first visible item
    for (const el of items) {
      const offset = el.offsetLeft;
      const width = el.offsetWidth;
      if (offset + width > scrollLeft && offset < containerRight) {
        const path = el.dataset.path;
        if (path) {
          const label = pathSectionMap.get(path);
          if (label && label !== filmstripSectionLabel) {
            filmstripSectionLabel = label;
          }
        }
        return;
      }
    }
  }

  // Attach non-passive wheel listener directly on filmstrip for horizontal scroll
  $effect(() => {
    if (library.viewMode !== "filmstrip" || !scrollEl) return;
    void library.activeTab;
    const filmstrip = scrollEl.querySelector(
      ".library-filmstrip",
    ) as HTMLElement | null;
    if (!filmstrip) return;
    const el = filmstrip;

    // Initial section detection
    requestAnimationFrame(updateFilmstripSection);

    function onFilmstripWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        e.stopPropagation();
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollLeft = Math.max(
          0,
          Math.min(el.scrollLeft + e.deltaY, maxScroll),
        );
        // Update section after scroll
        requestAnimationFrame(updateFilmstripSection);
      }
    }
    function onFilmstripScroll() {
      requestAnimationFrame(updateFilmstripSection);
    }
    el.addEventListener("wheel", onFilmstripWheel, { passive: false });
    el.addEventListener("scroll", onFilmstripScroll);
    return () => {
      el.removeEventListener("wheel", onFilmstripWheel);
      el.removeEventListener("scroll", onFilmstripScroll);
    };
  });

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
  onkeydown={handleKeydown}
  onclick={() => {
    confirmRename();
    closeLibCtxMenu();
    closeColCtxMenu();
  }}
  role="region"
  aria-label="File library"
>
  <div class="library-tabs">
    <button
      class="library-tab"
      class:active={library.activeTab === "library"}
      onclick={() => library.setActiveTab("library")}>Library</button
    >
    <button
      class="library-tab"
      class:active={library.activeTab === "recents"}
      onclick={() => library.setActiveTab("recents")}>Recents</button
    >
    <button
      class="library-tab"
      class:active={library.activeTab === "collections"}
      class:collect-mode={library.collectMode}
      onclick={() => {
        if (isViewingCollection) {
          library.closeCollection();
        } else {
          library.setActiveTab("collections");
        }
      }}>Collections</button
    >
    <button
      class="library-tab"
      class:active={library.activeTab === "favorites"}
      onclick={() => library.setActiveTab("favorites")}>Favorites</button
    >
  </div>

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
          >Collections <span class="library-header-count"
            >({library.collections.length})</span
          ></span
        >
      {/if}
    </div>
  {/if}

  {#if library.activeTab === "recents"}
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
        ><circle cx="12" cy="12" r="10" /><polyline
          points="12 6 12 12 16 14"
        /></svg
      >
      <span class="library-breadcrumb-segment active"
        >Recents
        {#if library.recentsDisabled}
          <span class="library-header-count">(Off)</span>
        {:else}
          <button
            class="library-header-count tooltip-ctrl"
            class:warning={recentFilesWarning}
            data-tooltip="Recents limit — older files drop off once full"
            onclick={openRecentsSettings}
            >({library.recentFiles.length}/{library.recentFilesLimit})</button
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
        >Favorites <span class="library-header-count"
          >({library.favorites.length})</span
        ></span
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
          <span class="library-header-count">({libraryDirFiles.length})</span
          ></button
        >
      {/if}
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="library-scroll"
    class:scroll-active={scrollActive}
    class:select-mode={selectMode}
    class:dragging={isDragging}
    bind:this={scrollEl}
    onscroll={onScroll}
    onmousedown={handleDragStart}
  >
    <div
      style="display: grid; grid-template: 1fr / 1fr; align-items: start; height: 100%;"
    >
      {#key library.activeTab}
        <div
          class="tab-content"
          transition:fade={{ duration: 150 }}
          style="grid-area: 1 / 1;"
        >
          {#if showFileGrid}
            {#if library.viewMode === "grid"}
              <div
                class="library-grid"
                style="grid-template-columns: repeat(auto-fill, minmax({gridMinCol}px, 1fr));"
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
                {#if isCustomCollection}
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
                {#each displaySections as section (section.label || "all")}
                  {#if section.label}
                    <div class="divider-header" style="grid-column: 1 / -1;">
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
                          />
                        {:else}
                          <div class="library-placeholder"></div>
                        {/if}
                        {#if library.namesOn}
                          <div class="file-name-label">{getFileName(path)}</div>
                        {/if}
                        <div
                          class="library-checkbox"
                          class:checked={selected}
                          role="checkbox"
                          tabindex="0"
                          aria-checked={selected}
                          aria-label="Select file"
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
              </div>
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
                {#if isShowingFolders}
                  {#each currentFolderPaths as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="river-cell river-subfolder-cell"
                      role="button"
                      tabindex="0"
                      style="height: {riverRowH}px; min-width: {riverRowH}px; flex-grow: 0;"
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
                      <div class="river-subfolder-name">
                        {getFileName(folderPath)}
                      </div>
                    </div>
                  {/each}
                {/if}
                {#each displaySections as section (section.label || "all")}
                  {#if section.label}
                    <div
                      class="divider-header"
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
                            onload={(e) => onImageLoad(path, e)}
                          />
                        {:else}
                          <div class="river-placeholder"></div>
                        {/if}
                        {#if library.namesOn}
                          <div class="file-name-label">{getFileName(path)}</div>
                        {/if}
                        <div
                          class="library-checkbox"
                          class:checked={selected}
                          role="checkbox"
                          tabindex="0"
                          aria-checked={selected}
                          aria-label="Select file"
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
              <div class="library-filmstrip" style="position: relative;">
                {#if library.dividersOn && filmstripSectionLabel}
                  <div
                    class="filmstrip-section-header"
                    style="position: absolute; top: 8px; left: 28px; z-index: 5; pointer-events: none;"
                  >
                    {#key filmstripSectionLabel}
                      <span transition:fade={{ duration: 150 }}
                        >{filmstripSectionLabel}</span
                      >
                    {/key}
                  </div>
                {/if}
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
                {#each sortedFiles as path (path)}
                  {@const active = activePaths.has(path)}
                  {@const selected = library.isSelected(path)}
                  {@const badge = getMediaBadge(path)}
                  {@const dim = imageDims[path]}
                  {@const ratio = dim ? dim.w / dim.h : 4 / 3}
                  <div
                    class="filmstrip-cell"
                    class:active
                    class:selected
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
                        onload={(e) => onImageLoad(path, e)}
                      />
                    {:else}
                      <div class="filmstrip-placeholder"></div>
                    {/if}
                    {#if library.namesOn}
                      <div class="file-name-label">{getFileName(path)}</div>
                    {/if}
                    <div
                      class="library-checkbox"
                      class:checked={selected}
                      role="checkbox"
                      tabindex="0"
                      aria-checked={selected}
                      aria-label="Select file"
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
                      aria-label="Select all files"
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
                    Name
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
                    Size
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
                    Date Modified
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
                    Type
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
                      Add to favorites...
                    </span>
                    <span class="list-col list-col-size"></span>
                    <span class="list-col list-col-date"></span>
                    <span class="list-col list-col-type"></span>
                  </div>
                {/if}
                {#if isShowingFolders}
                  {#each currentFolderPaths as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="list-row list-subfolder-row"
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
                      <span class="list-col list-col-check"></span>
                      <span class="list-col list-col-thumb">
                        <svg
                          width="16"
                          height="16"
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
                      </span>
                      <span class="list-col list-col-name">
                        {getFileName(folderPath)}
                      </span>
                      <span class="list-col list-col-size"></span>
                      <span class="list-col list-col-date"></span>
                      <span class="list-col list-col-type">Folder</span>
                    </div>
                  {/each}
                {/if}
                {#each displaySections as section (section.label || "all")}
                  {#if section.label}
                    <div class="list-divider-row">
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
                            aria-label="Select file"
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
                            />
                          {:else}
                            <div class="list-placeholder"></div>
                          {/if}
                        </span>
                        <span class="list-col list-col-name">
                          {path.split(/[/\\]/).pop()}
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

          {#if library.activeTab === "favorites" && displayFiles.length === 0}
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
              <span>No files favorited</span>
            </div>
          {/if}

          {#if library.activeTab === "recents" && displayFiles.length === 0}
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
              <span>No recent files</span>
            </div>
          {/if}

          {#if library.activeTab === "library" && displayFiles.length === 0}
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
              <span>No files in this folder</span>
            </div>
          {/if}

          {#if isViewingCollection && displayFiles.length === 0}
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
              <span>No files in this folder</span>
            </div>
          {/if}
          {#if library.activeTab === "library" && libraryDirPath && displayFiles.length === 0 && currentFolderPaths.length === 0}
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
              <span>No files in this folder</span>
            </div>
          {/if}

          {#if library.activeTab === "collections" && !library.activeCollectionPath}
            <div
              class="library-placeholder-grid"
              style="grid-template-columns: repeat(auto-fill, minmax({gridMinCol}px, 1fr));"
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
                  <div class="divider-header" style="grid-column: 1 / -1;">
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
                    {#if library.showThumbnails && firstFilePath && library.cache[firstFilePath]}
                      <img
                        class="library-collection-thumb"
                        src={library.cache[firstFilePath]}
                        alt=""
                        draggable="false"
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
                    <div class="library-collection-name">
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
                        <span>{col.name}</span>
                      {/if}
                    </div>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="library-collection-remove"
                      role="button"
                      tabindex="0"
                      aria-label="Remove collection"
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
                <span>No collections saved</span>
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
    {#key libCtxKey}
      <div
        class="context-menu lib-ctx"
        class:pinned={libCtxPinned}
        style="left: {libCtxMenu.x}px; top: {libCtxMenu.y}px;"
        role="menu"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div
          class="ctx-drag"
          role="button"
          tabindex="0"
          aria-label="Drag to move"
          onmousedown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startMenuX = libCtxMenu.x;
            const startMenuY = libCtxMenu.y;

            function onMouseMove(ev: MouseEvent) {
              libCtxMenu.x = startMenuX + ev.clientX - startX;
              libCtxMenu.y = startMenuY + ev.clientY - startY;
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
            data-tooltip={libCtxPinned ? "Unpin" : "Pin"}
            onclick={(e) => {
              e.stopPropagation();
              libCtxPinned = !libCtxPinned;
            }}
            onmousedown={(e) => e.stopPropagation()}
            aria-label={libCtxPinned ? "Unpin" : "Pin"}
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
            data-tooltip="Close"
            onclick={(e) => {
              e.stopPropagation();
              forceCloseLibCtxMenu();
            }}
            onmousedown={(e) => e.stopPropagation()}
            aria-label="Close"
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
            Move to
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
            Collect
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
              fill={library.isFavorite(libCtxMenu.path)
                ? "currentColor"
                : "none"}
              ><polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
            {library.isFavorite(libCtxMenu.path) ? "Unfavorite" : "Favorite"}
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
            Delete
          </button>
        </div>
      </div>
    {/key}
  {/if}

  {#if colCtxMenu.visible}
    {#key colCtxKey}
      <div
        class="context-menu lib-ctx"
        class:pinned={colCtxPinned}
        style="left: {colCtxMenu.x}px; top: {colCtxMenu.y}px;"
        role="menu"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div
          class="ctx-drag"
          role="button"
          tabindex="0"
          aria-label="Drag to move"
          onmousedown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startMenuX = colCtxMenu.x;
            const startMenuY = colCtxMenu.y;
            function onMouseMove(ev: MouseEvent) {
              colCtxMenu.x = startMenuX + ev.clientX - startX;
              colCtxMenu.y = startMenuY + ev.clientY - startY;
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
            data-tooltip={colCtxPinned ? "Unpin" : "Pin"}
            onclick={(e) => {
              e.stopPropagation();
              colCtxPinned = !colCtxPinned;
            }}
            onmousedown={(e) => e.stopPropagation()}
            aria-label={colCtxPinned ? "Unpin" : "Pin"}
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
            data-tooltip="Close"
            onclick={(e) => {
              e.stopPropagation();
              forceCloseColCtxMenu();
            }}
            onmousedown={(e) => e.stopPropagation()}
            aria-label="Close"
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
            Rename
          </button>
          <div class="ctx-sep"></div>
          <button
            class="ctx-item blue"
            onclick={ctxCollectCol}
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
            Collect
          </button>
          <div class="ctx-sep"></div>
          <button
            class="ctx-item yellow"
            onclick={ctxShowInExplorerCol}
            role="menuitem"
            style="animation-delay: 110ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><polyline
                points="15 3 21 3 21 9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><line
                x1="10"
                y1="14"
                x2="21"
                y2="3"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
            Show in explorer
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
            Delete
          </button>
        </div>
      </div>
    {/key}
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
            <p class="library-dialog-title">Add Collection</p>
          </div>
          <button
            class="library-dialog-close"
            onclick={() => (showAddCollectionDialog = false)}
            aria-label="Close"
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
              <span>Sync folder from computer</span>
            </button>
          </div>
          <div class="library-dialog-or">
            <span class="library-dialog-or-line"></span>
            <span class="library-dialog-or-text">or</span>
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
              <span>Create new collection</span>
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
                  placeholder="Name"
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
                  <span>Cover</span>
                {/if}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if collectionToDelete}
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
            <p class="library-dialog-title">Delete collection?</p>
          </div>
          <button
            class="library-dialog-close"
            onclick={cancelDeleteCollection}
            aria-label="Close"
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
              This will permanently delete the collection folder and all files
              inside it.
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
              onclick={cancelDeleteCollection}>Cancel</button
            >
            <button
              class="library-dialog-btn library-dialog-btn-danger"
              onclick={confirmDeleteCollection}>Delete</button
            >
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .library-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary, #0a0a0a);
  }

  .tab-content {
    width: 100%;
    height: 100%;
  }

  .library-tabs {
    display: flex;
    justify-content: center;
    gap: 2px;
    padding: 12px 24px 8px;
  }

  .library-tab {
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
      color 0.15s;
  }

  .library-tab:hover {
    background: var(--bg-secondary, #111);
    color: var(--text-secondary, #ccc);
  }

  .library-tab.active {
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-primary, #fff);
  }

  .library-tab.collect-mode {
    background: var(--accent-blue, #3b82f6);
    color: #fff;
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

  /* Collection header / breadcrumb */
  .library-collection-header {
    font-family: var(--font-family);
    font-size: 15px;
    padding: 8px 24px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    flex-shrink: 0;
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
    border: 1px solid var(--bg-border, #2a2a2a);
    background: var(--bg-secondary, #111);
    color: var(--text-primary, #fff);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  .library-collection-card:hover {
    border-color: var(--text-muted, #888);
    background: var(--bg-elevated, #1a1a1a);
  }

  .library-collection-card.collect-mode {
    border-color: var(--accent-blue, #3b82f6);
  }

  .library-collection-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    inset: 0;
    border-radius: 3px;
  }

  .library-collection-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--blue-light);
    padding-bottom: 16px;
  }

  .library-collection-name {
    position: absolute;
    bottom: 4px;
    left: 4px;
    right: 4px;
    padding: 4px 6px;
    background: rgba(0, 0, 0, 0.35);
    border-radius: 4px;
    font-family: var(--font-family);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 1;
    transition: background 0.15s;
  }

  .library-collection-card:hover .library-collection-name,
  .library-collection-card.renaming .library-collection-name {
    background: rgba(0, 0, 0, 0.65);
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

  .library-collection-card:hover .library-collection-remove {
    opacity: 1;
  }

  .library-collection-remove:hover {
    background: #3a1a1a;
    color: var(--red, #dc2626);
  }

  .library-scroll {
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;
    scroll-behavior: smooth;
    padding: 16px 24px;
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    transition: scrollbar-color 0.3s;
  }

  .library-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .library-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .library-scroll::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 2px;
    transition: background 0.3s;
  }

  .library-scroll.scroll-active {
    scrollbar-color: var(--bg-shimmer, #333) transparent;
  }

  .library-scroll.dragging {
    user-select: none;
    cursor: crosshair;
  }

  .library-scroll.dragging * {
    user-select: none;
  }

  .library-scroll.scroll-active::-webkit-scrollbar-thumb {
    background: var(--bg-shimmer, #333);
  }

  /* Filmstrip view */
  .library-filmstrip {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 24px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .library-filmstrip::-webkit-scrollbar {
    display: none;
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
    border-color: #fff;
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
    background: var(--bg-secondary, #111);
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
      transform 0.15s;
    background: var(--bg-secondary, #111);
  }

  .river-cell:hover {
    border-color: var(--border-hover, #555);
    transform: scale(1.02);
  }

  .river-cell.active {
    border-color: #fff;
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
    background: var(--bg-secondary, #111);
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
    border-color: #fff;
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
    background: var(--bg-secondary, #111);
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
    color: var(--text-primary, #fff);
    pointer-events: none;
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
    color: var(--text-primary, #fff);
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
    background: var(--bg-secondary, #111);
  }

  /* Empty state */
  .library-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    min-height: 200px;
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
    padding: 0 20px 16px;
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
</style>
