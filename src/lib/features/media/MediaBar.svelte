<script lang="ts">
  import { fly } from "svelte/transition";
  import SlideshowMenu from "$lib/features/menus/SlideshowMenu.svelte";
  import { slideshow } from "$lib/features/media/slideshow.svelte";

  let dismissed = $state(false);
  let pinned = $state(false);

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
    resetZoom,
    toggleFullscreen,
    isVideo,
    isPdf = false,
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
    editMenuVisible = false,
    processMenuVisible = false,
    editMenuMoved = false,
    processMenuMoved = false,
    clipMenuMoved = false,
    onClipMenuMoved,
    onClipMenuDismissed,
    clipMenuDismissed = false,
    editMenuStyleOverride = "",
    processMenuStyleOverride = "",
    clipMenuStyleOverride = "",
  }: {
    fileListLength: number;
    currentIndex: number;
    fileDimensions: string;
    fileSize: string;
    fileInfoLoading: boolean;
    fileName: string;
    fileSrc: string;
    zoomLevel: number;
    resetZoom: () => void;
    toggleFullscreen: () => void;
    isVideo: boolean;
    isPdf?: boolean;
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
    editMenuVisible?: boolean;
    processMenuVisible?: boolean;
    editMenuMoved?: boolean;
    processMenuMoved?: boolean;
    clipMenuMoved?: boolean;
    onClipMenuMoved?: () => void;
    onClipMenuDismissed?: () => void;
    clipMenuDismissed?: boolean;
    editMenuStyleOverride?: string;
    processMenuStyleOverride?: string;
    clipMenuStyleOverride?: string;
  } = $props();

  $effect(() => {
    if (clipCount > 0) dismissed = false;
  });
</script>

<div class="bottombar">
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
      class="file-count tooltip-above"
      class:active={thumbnailBarVisible}
      data-tooltip="File position"
      onclick={toggleThumbnailBar}
    >
      {fileListLength > 0 ? `${currentIndex + 1} / ${fileListLength}` : "—"}
    </button>
  </div>
  <span class="file-info tooltip-above" data-tooltip="Resolution · File size">
    {#if fileDimensions && fileSize}
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
      data-tooltip="Reset zoom"
      onclick={resetZoom}>{Math.round(zoomLevel)}%</button
    >
    <button
      class="fs-btn tooltip-above-shift-left"
      data-tooltip="Fullscreen"
      onclick={toggleFullscreen}
      aria-label="toggle fullscreen"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
        ><path
          d="M1 4V1H4M8 1H11V4M11 8V11H8M4 11H1V8"
          stroke="currentColor"
          stroke-width="0.6"
          stroke-linecap="round"
        /></svg
      >
    </button>
  </div>
</div>

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
    {#if clipJobRunning}
      <div class="clip-job-progress">
        <span>{clipJobLabel}</span>
        <div class="clip-job-bar"><span></span></div>
      </div>
    {/if}
  </div>
{/if}
