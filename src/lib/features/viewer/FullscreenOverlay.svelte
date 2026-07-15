<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
  import Controls from "$lib/components/Controls.svelte";
  import SortMenu from "$lib/features/navigation/SortMenu.svelte";
  import type { SortMode } from "$lib/shared/constants";

  interface FullscreenOverlayProps {
    isFullscreen: boolean;
    fsControlsVisible: boolean;
    tsEditMenuVisible: boolean;
    isAudio: boolean;
    isPdf: boolean;
    fileName: string;
    handleViewerScroll: (e: WheelEvent) => void;
    drawActive: boolean;
    startPan: (e: MouseEvent) => void;
    handleTouchZoom: (e: TouchEvent) => void;
    handleTouchEnd: () => void;
    fsCursor: string;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    navigate: (delta: number) => void;
    isVideo: boolean;
    videoEl: HTMLVideoElement | null;
    isGifVideo: boolean;
    timelineProps: Record<string, unknown>;
    playbackProps: Record<string, unknown>;
    toggleFullscreen: () => void;
    fileListLength: number;
    currentIndex: number;
    fsPillEl: HTMLButtonElement | null;
    slideshowActive: boolean;
    toggleThumbnailBar: () => void;
    handleFsPillContext: (e: MouseEvent) => void;
    sortMenuVisible: boolean;
    sortMenuX: number;
    sortMenuY: number;
    sortMode: SortMode;
    sortDesc: boolean;
    onSortChange: (mode: SortMode, desc: boolean) => void;
    sortClose: () => void;
  }

  let {
    isFullscreen,
    fsControlsVisible,
    tsEditMenuVisible,
    isAudio,
    isPdf,
    fileName,
    handleViewerScroll,
    drawActive,
    startPan,
    handleTouchZoom,
    handleTouchEnd,
    fsCursor,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    navigate,
    isVideo,
    videoEl,
    isGifVideo,
    timelineProps,
    playbackProps,
    toggleFullscreen,
    fileListLength,
    currentIndex,
    fsPillEl,
    slideshowActive,
    toggleThumbnailBar,
    handleFsPillContext,
    sortMenuVisible,
    sortMenuX,
    sortMenuY,
    sortMode,
    sortDesc,
    onSortChange,
    sortClose,
  }: FullscreenOverlayProps = $props();
</script>

{#if isFullscreen}
  {#if isPdf}
    <!-- PDF fullscreen: floating UI only, no blocking overlay -->
    <div class="fs-topbar" style="position: fixed; top: 0; left: 0; right: 0; z-index: 200;">
      <span class="fs-filename"
        ><Marquee text={fileName} scrollOnHover class="fs-marquee" /></span
      >
      <div class="fs-window-controls">
        <button class="fs-wc-btn" onclick={minimizeWindow} aria-label="minimize"
          >−</button
        ><button
          class="fs-wc-btn"
          onclick={maximizeWindow}
          aria-label="maximize">▢</button
        ><button
          class="fs-wc-btn close"
          onclick={closeWindow}
          aria-label="close">✕</button
        >
      </div>
    </div>
    <div class="fs-nav-left" style="position: fixed; z-index: 200;">
      <button
        class="fs-nav-btn"
        onclick={() => navigate(-1)}
        aria-label="previous file">‹</button
      >
    </div>
    <div class="fs-nav-right" style="position: fixed; z-index: 200;">
      <button
        class="fs-nav-btn"
        onclick={() => navigate(1)}
        aria-label="next file">›</button
      >
    </div>
    <div class="fs-controls image-only" style="position: fixed; bottom: 0; left: 0; right: 0; z-index: 200; transition: opacity 0.25s ease; {fsControlsVisible ? '' : 'opacity: 0; pointer-events: none;'}">
      <div class="fs-controls-row">
        <div class="fs-right">
          <button
            class="fs-ctrl-btn tooltip-ctrl"
            data-tooltip="Unfullscreen"
            onclick={toggleFullscreen}
            aria-label="exit fullscreen"
            ><svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              ><path
                d="M4 1v3h-3M8 1v3h3M8 11v-3h3M4 11v-3h-3"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            ></button
          >
        </div>
      </div>
    </div>
    {#if fileListLength > 0}
      <button
        bind:this={fsPillEl}
        class="fs-file-count-pill tooltip-above"
        class:slideshow-active={slideshowActive}
        class:menu-active={sortMenuVisible}
        data-tooltip="File position"
        onclick={toggleThumbnailBar}
        oncontextmenu={handleFsPillContext}
        style="position: fixed; z-index: 200; transition: opacity 0.25s ease; {fsControlsVisible ? '' : 'opacity: 0; pointer-events: none;'}"
      >
        {currentIndex + 1} / {fileListLength}
      </button>
    {/if}
  {:else}
    <!-- Normal fullscreen: blocking overlay -->
    <div
      class="fs-overlay"
      class:visible={fsControlsVisible || tsEditMenuVisible}
      class:audio-fullscreen={isAudio}
      role="button"
      tabindex="0"
      onwheel={handleViewerScroll}
      onmousedown={drawActive ? undefined : startPan}
      ontouchstart={(e) => {
        if (e.touches.length === 2) e.preventDefault();
      }}
      ontouchmove={handleTouchZoom}
      ontouchend={handleTouchEnd}
      style="cursor: {fsCursor}"
    >
      <div class="fs-topbar">
        <span class="fs-filename"
          ><Marquee text={fileName} scrollOnHover class="fs-marquee" /></span
        >
        <div class="fs-window-controls">
          <button class="fs-wc-btn" onclick={minimizeWindow} aria-label="minimize"
            >−</button
          ><button
            class="fs-wc-btn"
            onclick={maximizeWindow}
            aria-label="maximize">▢</button
          ><button
            class="fs-wc-btn close"
            onclick={closeWindow}
            aria-label="close">✕</button
          >
        </div>
      </div>
      <div class="fs-nav-left">
        <button
          class="fs-nav-btn"
          onclick={() => navigate(-1)}
          aria-label="previous file">‹</button
        >
      </div>
      <div class="fs-nav-right">
        <button
          class="fs-nav-btn"
          onclick={() => navigate(1)}
          aria-label="next file">›</button
        >
      </div>
      {#if isVideo && videoEl}
        <div class="fs-controls" class:gif-only={isGifVideo}>
          <Controls fullscreen={true} {timelineProps} {playbackProps} />
        </div>
      {:else}
        <div class="fs-controls image-only">
          <div class="fs-controls-row">
            <div class="fs-right">
              <button
                class="fs-ctrl-btn tooltip-ctrl"
                data-tooltip="Unfullscreen"
                onclick={toggleFullscreen}
                aria-label="exit fullscreen"
                ><svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  ><path
                    d="M4 1v3h-3M8 1v3h3M8 11v-3h3M4 11v-3h-3"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></button
              >
            </div>
          </div>
        </div>
      {/if}
      {#if fileListLength > 0}
        <button
          bind:this={fsPillEl}
          class="fs-file-count-pill tooltip-above"
          class:slideshow-active={slideshowActive}
          class:menu-active={sortMenuVisible}
          data-tooltip="File position"
          onclick={toggleThumbnailBar}
          oncontextmenu={handleFsPillContext}
        >
          {currentIndex + 1} / {fileListLength}
        </button>
      {/if}
      {#if sortMenuVisible}
        <SortMenu
          visible={sortMenuVisible}
          onClose={sortClose}
          x={sortMenuX}
          y={sortMenuY}
          {sortMode}
          {sortDesc}
          {onSortChange}
        />
      {/if}
    </div>
  {/if}
{/if}
