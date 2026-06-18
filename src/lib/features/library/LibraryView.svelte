<script lang="ts">
  import {
    VIDEO_EXTS,
    AUDIO_EXTS,
    DOCUMENT_EXTS,
    ALL_EXTS,
  } from "$lib/shared/constants";
  import { getFileExt, getFileName } from "$lib/services/files";
  import { fade } from "svelte/transition";
  import { library } from "$lib/features/library/library.svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { readDir } from "@tauri-apps/plugin-fs";
  import {
    invokeOpenWithDialog,
    invokeTrashFile,
    invokeRenameFile,
  } from "$lib/features/media/tools";
  import { showToast } from "$lib/features/toast/toast.svelte";

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

  // Library context menu state
  let libCtxMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    path: string;
  }>({ visible: false, x: 0, y: 0, path: "" });
  let libCtxPinned = $state(false);

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
    if (library.activeTab === "recents") return library.recentFiles;
    if (library.activeTab === "favorites") return library.favorites;
    if (isViewingCollection) return collectionFiles;
    return fileList;
  });

  const sortedFiles = $derived.by(() => {
    const files = [...displayFiles];
    const mode = library.sortMode;
    const desc = library.sortDesc;
    const statMap = library.stats;
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
      } else {
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      }
      return desc ? -cmp : cmp;
    });
    return files;
  });

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

  async function addCollection() {
    const dir = await open({ directory: true });
    if (dir) {
      library.addCollection(dir as string);
    }
  }

  function startRename(path: string, currentName: string) {
    renamingPath = path;
    renameValue = currentName;
  }

  function confirmRename() {
    if (renamingPath) {
      library.renameCollection(renamingPath, renameValue);
      renamingPath = null;
    }
  }

  function cancelRename() {
    renamingPath = null;
  }

  function openLibCtxMenu(e: MouseEvent, path: string) {
    e.preventDefault();
    e.stopPropagation();
    libCtxMenu = { visible: true, x: e.clientX, y: e.clientY, path };
    libCtxPinned = false;
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
      showToast({ message: "File deleted", color: "red" });
    } catch {
      showToast({ message: "Failed to delete file", color: "red" });
    }
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

  // Load collection files when active collection changes
  $effect(() => {
    const path = library.activeCollectionPath;
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

  // Attach non-passive wheel listener directly on filmstrip for horizontal scroll
  $effect(() => {
    if (library.viewMode !== "filmstrip" || !scrollEl) return;
    void library.activeTab;
    const filmstrip = scrollEl.querySelector(
      ".library-filmstrip",
    ) as HTMLElement | null;
    if (!filmstrip) return;
    const el = filmstrip;
    function onFilmstripWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        e.stopPropagation();
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollLeft = Math.max(
          0,
          Math.min(el.scrollLeft + e.deltaY, maxScroll),
        );
      }
    }
    el.addEventListener("wheel", onFilmstripWheel, { passive: false });
    return () => el.removeEventListener("wheel", onFilmstripWheel);
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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="library-view"
  onkeydown={handleKeydown}
  onclick={closeLibCtxMenu}
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

  {#if isViewingCollection}
    <div class="library-collection-header">
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
              : library.openCollection(seg.path)}
        >
          {seg.label}
        </button>
      {/each}
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
    <div style="display: grid; grid-template: 1fr / 1fr; align-items: start; height: 100%;">
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
                {#if isViewingCollection}
                  {#each collectionFolders as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="library-subfolder-card"
                      role="button"
                      tabindex="0"
                      onclick={() => library.openCollection(folderPath)}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          library.openCollection(folderPath);
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
                {#each sortedFiles as path (path)}
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
                      </div>
                    {/if}
                  </div>
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
                {#if isViewingCollection}
                  {#each collectionFolders as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="river-cell river-subfolder-cell"
                      role="button"
                      tabindex="0"
                      style="height: {riverRowH}px; min-width: {riverRowH}px; flex-grow: 0;"
                      onclick={() => library.openCollection(folderPath)}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          library.openCollection(folderPath);
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
                {#each sortedFiles as path (path)}
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
            {:else if library.viewMode === "filmstrip"}
              <div class="library-filmstrip">
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
                {#if isViewingCollection}
                  {#each collectionFolders as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="filmstrip-cell filmstrip-subfolder-cell"
                      role="button"
                      tabindex="0"
                      style="height: {filmstripBase}px; min-width: {filmstripBase}px; flex-shrink: 0;"
                      onclick={() => library.openCollection(folderPath)}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          library.openCollection(folderPath);
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
                {#if isViewingCollection}
                  {#each collectionFolders as folderPath (folderPath)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="list-row list-subfolder-row"
                      role="button"
                      tabindex="0"
                      onclick={() => library.openCollection(folderPath)}
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          library.openCollection(folderPath);
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
                {#each sortedFiles as path, idx (path)}
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
                          const start = Math.min(lastClickedIndex, idx);
                          const end = Math.max(lastClickedIndex, idx);
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
                      lastClickedIndex = idx;
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
                    <span class="list-col list-col-type">{getExt(path)}</span>
                  </div>
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

          {#if library.activeTab === "collections" && !library.activeCollectionPath}
            <div
              class="library-placeholder-grid"
              style="grid-template-columns: repeat(auto-fill, minmax({gridMinCol}px, 1fr));"
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="library-placeholder-card"
                role="button"
                tabindex="0"
                onclick={addCollection}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addCollection();
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
              {#each library.collections as col (col.path)}
                {@const firstFilePath = collectionFirstFiles[col.path]}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="library-collection-card"
                  role="button"
                  tabindex="0"
                  onclick={() => library.openCollection(col.path)}
                  ondblclick={() => startRename(col.path, col.name)}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    startRename(col.path, col.name);
                  }}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      library.openCollection(col.path);
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
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.3"
                      >
                        <path
                          d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                        />
                      </svg>
                    </div>
                  {/if}
                  <div class="library-collection-name">
                    {#if renamingPath === col.path}
                      <input
                        class="library-rename-input"
                        type="text"
                        bind:value={renameValue}
                        onblur={confirmRename}
                        onkeydown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onclick={(e) => e.stopPropagation()}
                        ondblclick={(e) => e.stopPropagation()}
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
                      library.removeCollection(col.path);
                    }}
                    onkeydown={(e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        library.removeCollection(col.path);
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
          onclick={ctxOpenWith}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
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
          Open with...
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxMoveTo}
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
            /></svg
          >
          Move to...
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
  }

  .library-breadcrumb-segment:hover {
    color: var(--text-primary, #ccc);
  }

  .library-breadcrumb-segment.active {
    color: var(--text-primary, #ccc);
    font-weight: 500;
    cursor: default;
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
    color: var(--text-muted, #888);
    padding-bottom: 28px;
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

  .library-collection-card:hover .library-collection-name {
    background: rgba(0, 0, 0, 0.65);
  }

  .library-rename-input {
    width: 100%;
    background: var(--bg-primary, #000);
    border: 1px solid var(--text-muted, #888);
    border-radius: 2px;
    color: var(--text-primary, #fff);
    font-size: 12px;
    font-family: var(--font-family);
    text-align: center;
    padding: 1px 4px;
    outline: none;
  }

  .library-collection-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #888);
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;
    z-index: 2;
  }

  .library-collection-card:hover .library-collection-remove {
    opacity: 1;
  }

  .library-collection-remove:hover {
    color: var(--text-primary, #fff);
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
