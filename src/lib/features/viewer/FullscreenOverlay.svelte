<script lang="ts">
  import type { Snippet } from "svelte";
  import type { SortMode } from "$lib/shared/constants";
  import Marquee from "$lib/shared/Marquee.svelte";
  import SortMenu from "$lib/features/navigation/SortMenu.svelte";

  let {
    fileName,
    isAudio,
    visible,
    cursor,
    onWheel,
    onPan,
    onTouchZoom,
    onTouchEnd,
    onPrev,
    onNext,
    onMinimize,
    onMaximize,
    onClose,
    fileCount,
    currentPosition,
    fsPillEl = $bindable(),
    slideshowActive,
    onToggleThumbnailBar,
    onFsPillContext,
    sortMenuVisible,
    fsSortMenuX,
    fsSortMenuY,
    sortMode,
    sortDesc,
    onSortChange,
    closeSortMenu,
    controls,
  }: {
    fileName: string;
    isAudio: boolean;
    visible: boolean;
    cursor: string;
    onWheel: (e: WheelEvent) => void;
    onPan: ((e: MouseEvent) => void) | undefined;
    onTouchZoom: (e: TouchEvent) => void;
    onTouchEnd: () => void;
    onPrev: () => void;
    onNext: () => void;
    onMinimize: () => void;
    onMaximize: () => void;
    onClose: () => void;
    fileCount: number;
    currentPosition: number;
    fsPillEl?: HTMLButtonElement | null;
    slideshowActive: boolean;
    onToggleThumbnailBar: () => void;
    onFsPillContext: (e: MouseEvent) => void;
    sortMenuVisible: boolean;
    fsSortMenuX: number;
    fsSortMenuY: number;
    sortMode: SortMode;
    sortDesc: boolean;
    onSortChange: (mode: SortMode, desc: boolean) => void;
    closeSortMenu: () => void;
    controls: Snippet;
  } = $props();
</script>

<div
  class="fs-overlay"
  class:visible
  class:audio-fullscreen={isAudio}
  role="button"
  tabindex="0"
  onwheel={onWheel}
  onmousedown={onPan}
  ontouchstart={(e) => {
    if (e.touches.length === 2) e.preventDefault();
  }}
  ontouchmove={onTouchZoom}
  ontouchend={onTouchEnd}
  style="cursor: {cursor}"
>
  <div class="fs-topbar">
    <span class="fs-filename"
      ><Marquee text={fileName} scrollOnHover class="fs-marquee" /></span
    >
    <div class="fs-window-controls">
      <button
        class="fs-wc-btn"
        onclick={onMinimize}
        aria-label="minimize">−</button
      ><button
        class="fs-wc-btn"
        onclick={onMaximize}
        aria-label="maximize">▢</button
      ><button
        class="fs-wc-btn close"
        onclick={onClose}
        aria-label="close">✕</button
      >
    </div>
  </div>
  <div class="fs-nav-left">
    <button
      class="fs-nav-btn"
      onclick={onPrev}
      aria-label="previous file">‹</button
    >
  </div>
  <div class="fs-nav-right">
    <button
      class="fs-nav-btn"
      onclick={onNext}
      aria-label="next file">›</button
    >
  </div>
  {@render controls()}
  {#if fileCount > 0}<button
      bind:this={fsPillEl}
      class="fs-file-count-pill tooltip-above"
      class:slideshow-active={slideshowActive}
      data-tooltip="File position"
      onclick={onToggleThumbnailBar}
      oncontextmenu={onFsPillContext}
      >{currentPosition} / {fileCount}</button
    >{/if}
  {#if sortMenuVisible}
    <SortMenu
      visible={sortMenuVisible}
      onClose={closeSortMenu}
      x={fsSortMenuX}
      y={fsSortMenuY}
      {sortMode}
      {sortDesc}
      {onSortChange}
    />
  {/if}
</div>
