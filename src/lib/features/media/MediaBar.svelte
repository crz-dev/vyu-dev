<script lang="ts">
  import { fly, scale } from "svelte/transition";
  import SlideshowMenu from "$lib/features/menus/SlideshowMenu.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import SortMenu from "$lib/features/navigation/SortMenu.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { SORT_MODES } from "$lib/shared/constants";
  import type { SortMode } from "$lib/shared/constants";

  const SORT_ICONS: Record<string, string> = {
    name: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>`,
    "date-modified": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    "date-created": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`,
    size: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    type: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  };

  let dismissed = $state(false);
  let pinned = $state(false);
  let fileCountEl: HTMLButtonElement | null = $state(null);
  let sortMenuX = $state(0);
  let sortMenuY = $state(0);

  // Library sort menu state
  let libSortMenuVisible = $state(false);
  let libSortMenuX = $state(0);
  let libSortMenuY = $state(0);

  $effect(() => {
    if (dismissed) {
      pinned = false;
    }
  });

  let {
    fileListLength,
    currentIndex,
    fileDimensions,
    fileSize,
    fileInfoLoading,
    fileName,
    fileSrc,
    zoomLevel,
    zoomLocked,
    resetZoom,
    toggleZoomLock,
    toggleFullscreen,
    isVideo,
    isAudio,
    isPdf = false,
    durationDisplay,
    audioBitrateDisplay,
    fullscreen = false,
    clipCount,
    triggerClipSegments,
    clipJobRunning,
    clipDeleteOriginal,
    clipUseCustomPath,
    clipMergeSegments,
    getClipTargetDir,
    toggleClipDeleteOriginal,
    toggleClipPathSelection,
    toggleClipMergeSegments,
    clipJobLabel,
    toggleSlideshowMenu,
    slideshowMenuVisible,
    closeSlideshowMenu,
    thumbnailBarVisible,
    toggleThumbnailBar,
    sortMode,
    sortDesc,
    sortMenuVisible,
    toggleSortMenu,
    closeSortMenu,
    onSortChange,
    editMenuVisible = false,
    markupMenuVisible = false,
    editMenuMoved = false,
    markupMenuMoved = false,
    clipMenuMoved = false,
    clipMenuResetKey = 0,
    onClipMenuMoved,
    onClipMenuDismissed,
    clipMenuDismissed = false,
    editMenuStyleOverride = "",
    markupMenuStyleOverride = "",
    clipMenuStyleOverride = "",
    libraryOpen = false,
  }: {
    fileListLength: number;
    currentIndex: number;
    fileDimensions: string;
    fileSize: string;
    fileInfoLoading: boolean;
    fileName: string;
    fileSrc: string;
    zoomLevel: number;
    zoomLocked: boolean;
    resetZoom: () => void;
    toggleZoomLock?: () => void;
    toggleFullscreen: () => void;
    isVideo: boolean;
    isAudio: boolean;
    isPdf?: boolean;
    durationDisplay: string;
    audioBitrateDisplay: string;
    fullscreen?: boolean;
    clipCount: number;
    triggerClipSegments: () => void;
    clipJobRunning: boolean;
    clipDeleteOriginal: boolean;
    clipUseCustomPath: boolean;
    clipMergeSegments: boolean;
    getClipTargetDir: () => string;
    toggleClipDeleteOriginal: () => void;
    toggleClipPathSelection: () => void;
    toggleClipMergeSegments: () => void;
    clipJobLabel: string;
    toggleSlideshowMenu: () => void;
    slideshowMenuVisible: boolean;
    closeSlideshowMenu: () => void;
    thumbnailBarVisible: boolean;
    toggleThumbnailBar: () => void;
    sortMode: "name" | "date-modified" | "date-created" | "size" | "type";
    sortDesc: boolean;
    sortMenuVisible: boolean;
    toggleSortMenu: () => void;
    closeSortMenu: () => void;
    onSortChange: (
      mode: "name" | "date-modified" | "date-created" | "size" | "type",
      desc: boolean,
    ) => void;
    editMenuVisible?: boolean;
    markupMenuVisible?: boolean;
    editMenuMoved?: boolean;
    markupMenuMoved?: boolean;
    clipMenuMoved?: boolean;
    clipMenuResetKey?: number;
    onClipMenuMoved?: () => void;
    onClipMenuDismissed?: () => void;
    clipMenuDismissed?: boolean;
    editMenuStyleOverride?: string;
    markupMenuStyleOverride?: string;
    clipMenuStyleOverride?: string;
    libraryOpen?: boolean;
  } = $props();

  $effect(() => {
    if (clipCount > 0) dismissed = false;
  });

  // Reopen clip menu when a clip marker is dragged on the timeline
  $effect(() => {
    if (clipMenuResetKey && clipMenuResetKey > 0) {
      dismissed = false;
    }
  });

  function handleFileCountContext(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (fileListLength <= 0) return;
    if (fileCountEl) {
      const rect = fileCountEl.getBoundingClientRect();
      sortMenuX = rect.left;
      sortMenuY = window.innerHeight - rect.top + 4;
    }
    toggleSortMenu();
  }

  function handleLibSortClick(e: MouseEvent) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    libSortMenuX = rect.left;
    libSortMenuY = window.innerHeight - rect.top + 4;
    libSortMenuVisible = !libSortMenuVisible;
  }

  function handleLibSortChange(mode: SortMode, desc: boolean) {
    library.setSortMode(mode, desc);
    libSortMenuVisible = false;
  }

  function toggleViewMode() {
    library.setViewMode(library.viewMode === "grid" ? "list" : "grid");
  }

  function formatTotalSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
</script>

<div class="bottombar" class:library-mode={libraryOpen}>
{#if libraryOpen}
  <div class="bottombar-left">
    <button
      class="fs-btn tooltip-above-shift-right"
      data-tooltip="Sort by"
      onmousedown={handleLibSortClick}
      aria-label="sort by"
    >
      {#key library.sortMode}
        <span class="icon-swap" in:scale={{ duration: 150, start: 0.6 }}>
          {@html SORT_ICONS[library.sortMode] || SORT_ICONS.name}
        </span>
      {/key}
    </button>
  </div>
  <span class="file-info tooltip-above" data-tooltip="Total files · Folder size">
    {fileListLength}
    {fileListLength === 1 ? "file" : "files"}
    {#if !library.totalSizeLoading && library.totalSize > 0}
      · {formatTotalSize(library.totalSize)}
    {:else if library.totalSizeLoading}
      · ...
    {/if}
  </span>
  <div class="bottombar-right">
    <button
      class="lib-view-toggle fs-btn tooltip-above-shift-left"
      data-tooltip={library.viewMode === "grid" ? "List view" : "Grid view"}
      onclick={toggleViewMode}
      aria-label={library.viewMode === "grid" ? "switch to list view" : "switch to grid view"}
    >
      {#key library.viewMode}
        <span class="icon-swap" in:scale={{ duration: 150, start: 0.6 }}>
          {#if library.viewMode === "grid"}
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
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          {:else}
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
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          {/if}
        </span>
      {/key}
    </button>
  </div>
{:else}
  <div class="bottombar-left">
    <div class="slideshow-anchor">
      <button
        class="slideshow-btn tooltip-above-shift-right"
        class:active={slideshow.active}
        data-tooltip="Slideshow"
        onclick={toggleSlideshowMenu}
        aria-label="toggle slideshow menu"
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
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>
      <SlideshowMenu
        visible={slideshowMenuVisible}
        onClose={closeSlideshowMenu}
      />
    </div>
    <button
      bind:this={fileCountEl}
      class="file-count tooltip-above"
      class:active={thumbnailBarVisible}
      data-tooltip="File position"
      onclick={toggleThumbnailBar}
      oncontextmenu={handleFileCountContext}
    >
      {fileListLength > 0 ? `${currentIndex + 1} / ${fileListLength}` : "—"}
    </button>
  </div>
  <span
    class="file-info tooltip-above"
    data-tooltip={isAudio
      ? "Duration · Bitrate · File size"
      : "Resolution · File size"}
  >
    {#if isAudio && durationDisplay && audioBitrateDisplay && fileSize}
      {durationDisplay} · {audioBitrateDisplay} · {fileSize}
    {:else if fileDimensions && fileSize}
      {fileDimensions} · {fileSize}
    {:else if !fileInfoLoading && fileName !== "no file open"}
      {fileName}
    {:else if !fileSrc}
      no file open
    {/if}
  </span>
  <div class="bottombar-right">
    <button
      class="zoom tooltip-above"
      class:active={zoomLocked}
      data-tooltip="Reset zoom"
      onclick={resetZoom}
      oncontextmenu={(e) => {
        e.preventDefault();
        toggleZoomLock?.();
      }}>{Math.round(zoomLevel)}%{zoomLocked ? "-" : ""}</button
    >
    <button
      class="fs-btn tooltip-above-shift-left"
      data-tooltip={fullscreen ? "Unfullscreen" : "Fullscreen"}
      onclick={toggleFullscreen}
      aria-label={fullscreen ? "exit fullscreen" : "toggle fullscreen"}
    >
      {#if fullscreen}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          ><path
            d="M4 1V4H1M8 1V4H11M8 11V8H11M4 11V8H1"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
      {:else}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          ><path
            d="M1 4V1H4M8 1H11V4M11 8V11H8M4 11H1V8"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round"
          /></svg
        >
      {/if}
    </button>
  </div>
{/if}
</div>

{#if sortMenuVisible}
  <SortMenu
    visible={sortMenuVisible}
    onClose={closeSortMenu}
    x={sortMenuX}
    y={sortMenuY}
    {sortMode}
    {sortDesc}
    {onSortChange}
  />
{/if}

{#if libSortMenuVisible}
  <SortMenu
    visible={libSortMenuVisible}
    onClose={() => (libSortMenuVisible = false)}
    x={libSortMenuX}
    y={libSortMenuY}
    sortMode={library.sortMode}
    sortDesc={library.sortDesc}
    onSortChange={handleLibSortChange}
  />
{/if}

{#if isVideo && clipCount > 0 && !dismissed}
  <div
    class="clip-actions"
    class:pinned
    style={clipMenuStyleOverride}
    transition:fly={{ y: 26, duration: 190, opacity: 0.08 }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label="Drag to move"
      onmousedown={(e) => {
        e.preventDefault();
        onClipMenuMoved?.();
        const menu = (e.currentTarget as HTMLElement).closest(
          ".clip-actions",
        ) as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;
        const savedTransition = menu.style.transition;
        menu.style.transition = "none";

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${startLeft + ev.clientX - startX}px`;
          menu.style.top = `${startTop + ev.clientY - startY}px`;
          menu.style.bottom = "auto";
          menu.style.height = "fit-content";
          menu.style.transform = "none";
        }

        function onMouseUp() {
          menu.style.transition = savedTransition;
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }}
    >
      <button
        class="ctx-pin tooltip-below"
        class:active={pinned}
        data-tooltip={pinned ? "Unpin" : "Pin"}
        onclick={(e) => {
          e.stopPropagation();
          pinned = !pinned;
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={pinned ? "Unpin" : "Pin"}
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
      <span class="ctx-drag-title">
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <span>Clipping</span>
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
      </span>
      <button
        class="ctx-close tooltip-below"
        data-tooltip="Close"
        onclick={(e) => {
          e.stopPropagation();
          dismissed = true;
          onClipMenuDismissed?.();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label="Close"
      >
        <svg
          width="9"
          height="9"
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
        class="clip-main-btn"
        onclick={triggerClipSegments}
        disabled={clipJobRunning}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><circle
            cx="6.5"
            cy="8"
            r="2.5"
            stroke="currentColor"
            stroke-width="2"
          /><circle
            cx="6.5"
            cy="16"
            r="2.5"
            stroke="currentColor"
            stroke-width="2"
          /><path
            d="M9 9.5L20 4M9 14.5L20 20"
            stroke="currentColor"
            stroke-width="2"
          /></svg
        >
        <span>Clip Segments</span>
      </button>
      <div class="edit-menu-separator"></div>
      <div class="clip-options-grid">
        <button
          class="clip-toggle-btn red"
          class:is-on={clipDeleteOriginal}
          onclick={toggleClipDeleteOriginal}
          disabled={clipJobRunning}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2M3 6h18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          <span>Delete Original</span>
        </button>
        <button
          class="clip-toggle-btn yellow tooltip-above"
          class:is-on={clipUseCustomPath}
          data-tooltip={getClipTargetDir() || "No output path"}
          title={getClipTargetDir() || "No output path"}
          onclick={toggleClipPathSelection}
          disabled={clipJobRunning}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          <span>Select Path</span>
        </button>
        <button
          class="clip-toggle-btn green"
          class:is-on={clipMergeSegments}
          onclick={toggleClipMergeSegments}
          disabled={clipJobRunning}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M5 7h14M5 12h14M5 17h14M8 7v10M16 7v10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          <span>Merge Segments</span>
        </button>
      </div>
    </div>
    {#if clipJobRunning}
      <div class="clip-job-progress">
        <span>{clipJobLabel}</span>
        <div class="clip-job-bar"><span></span></div>
  </div>
{/if}

<style>
  .bottombar.library-mode {
    justify-content: space-between;
  }

  .lib-view-toggle {
    line-height: 0;
  }

  .icon-swap {
    display: inline-flex;
    line-height: 0;
  }
</style>
  </div>
{/if}
