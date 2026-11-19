<script lang="ts">
  import { VIDEO_EXTS, AUDIO_EXTS, DOCUMENT_EXTS } from "$lib/shared/constants";
  import { getFileExt } from "$lib/services/files";
  import {
    getCached,
    isGenerating,
    isThumbnailFailed,
    requestThumbnails,
  } from "$lib/services/thumbnailCache.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import ThumbnailGenToast from "$lib/components/ThumbnailGenToast.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    fileList,
    currentIndex,
    visible,
    onSelect,
    fullscreen = false,
  }: {
    fileList: string[];
    currentIndex: number;
    visible: boolean;
    onSelect: (index: number) => void;
    fullscreen?: boolean;
  } = $props();

  // Layout constants
  const ITEM_W = 70;
  const ITEM_GAP = 6;
  const ITEM_STEP = ITEM_W + ITEM_GAP;
  const OVERSCAN = 6;
  const THUMB_SIZE = 120;
  const VIDEO_EXTS_SET = new Set(VIDEO_EXTS);
  const AUDIO_EXTS_SET = new Set(AUDIO_EXTS);
  // Safety net: if the open transition never reports, still start loading.
  const OPEN_FALLBACK_MS = 400;

  let trackEl: HTMLDivElement | null = $state(null);
  let barEl: HTMLDivElement | null = $state(null);
  let trackWidth = $state(0);
  let scrollLeft = $state(0);

  $effect(() => {
    if (trackEl) {
      trackEl.setAttribute("data-colorblind", accessibility.colorBlindMode);
    }
  });

  // RAF scroll
  let _scrollRaf: number | null = null;

  // Animation gate
  // Thumbnails are NOT fetched until the open-transition finishes.
  let afterOpen = $state(false);

  // Delay the toast so it doesn't flash when thumbnails are already cached.
  const generating = $derived(afterOpen && isGenerating());
  let showToast = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (generating) {
      toastTimer = setTimeout(() => {
        showToast = true;
      }, 400);
    } else {
      if (toastTimer) clearTimeout(toastTimer);
      showToast = false;
    }
    return () => {
      if (toastTimer) clearTimeout(toastTimer);
    };
  });

  // Virtual scroll range
  const firstIdx = $derived(
    Math.max(0, Math.floor(scrollLeft / ITEM_STEP) - OVERSCAN),
  );
  const lastIdx = $derived(
    Math.min(
      fileList.length - 1,
      Math.ceil((scrollLeft + trackWidth) / ITEM_STEP) + OVERSCAN,
    ),
  );
  const visibleItems = $derived(
    fileList.slice(firstIdx, lastIdx + 1).map((path, i) => ({
      path,
      index: firstIdx + i,
      isVideo: VIDEO_EXTS_SET.has(getFileExt(path)),
      isGif: getFileExt(path) === "gif",
      isAudio: AUDIO_EXTS_SET.has(getFileExt(path)),
      isPdf: DOCUMENT_EXTS.includes(getFileExt(path)),
    })),
  );

  // Load the rendered strip items. The shared service deduplicates, batches and
  // owns retries, so requesting is always safe and needs no local bookkeeping.
  $effect(() => {
    if (!afterOpen) return;
    requestThumbnails(
      visibleItems.map((item) => item.path),
      THUMB_SIZE,
    );
  });

  // Fall back when the open transition never reports (mount already open).
  $effect(() => {
    if (!visible) {
      afterOpen = false;
      cancelWheelScroll();
      return;
    }
    if (afterOpen) return;
    const timer = setTimeout(() => {
      if (visible) afterOpen = true;
    }, OPEN_FALLBACK_MS);
    return () => clearTimeout(timer);
  });

  function onTransitionEnd(e: TransitionEvent) {
    if (e.propertyName === "transform" && visible) {
      afterOpen = true;
    }
  }

  // Scroll handlers
  function onScroll() {
    if (_scrollRaf === null) {
      _scrollRaf = requestAnimationFrame(() => {
        if (trackEl) scrollLeft = trackEl.scrollLeft;
        _scrollRaf = null;
      });
    }
  }

  // Smooth wheel scrolling: accumulate a target so rapid trackpad events add
  // up, then ease toward it. Wheel pans the strip only; it never selects a
  // file. Arrow keys remain file skipping.
  let wheelTarget: number | null = null;
  let wheelRaf = 0;
  const WHEEL_EASE = 0.22;

  function cancelWheelScroll() {
    if (wheelRaf) cancelAnimationFrame(wheelRaf);
    wheelRaf = 0;
    wheelTarget = null;
  }

  function onWheel(e: WheelEvent) {
    if (!trackEl) return;
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    e.preventDefault();
    let px = delta;
    if (e.deltaMode === 1) px *= ITEM_STEP;
    else if (e.deltaMode === 2) px *= trackEl.clientWidth;
    const max = Math.max(0, trackEl.scrollWidth - trackEl.clientWidth);
    const base = wheelTarget ?? trackEl.scrollLeft;
    const target = Math.max(0, Math.min(max, base + px));
    if (appearance.reducedMotion) {
      cancelWheelScroll();
      trackEl.scrollLeft = target;
      return;
    }
    wheelTarget = target;
    if (!wheelRaf) wheelRaf = requestAnimationFrame(stepWheel);
  }

  function stepWheel() {
    wheelRaf = 0;
    if (!trackEl || wheelTarget === null) return;
    const diff = wheelTarget - trackEl.scrollLeft;
    if (Math.abs(diff) < 0.5) {
      trackEl.scrollLeft = wheelTarget;
      wheelTarget = null;
      return;
    }
    trackEl.scrollLeft += diff * WHEEL_EASE;
    wheelRaf = requestAnimationFrame(stepWheel);
  }

  $effect(() => {
    return cancelWheelScroll;
  });

  // Scroll active item into view when currentIndex changes (and bar is already open)
  $effect(() => {
    if (!afterOpen || !trackEl) return;
    cancelWheelScroll();
    const el = trackEl.querySelector(
      `[data-index="${currentIndex}"]`,
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    } else {
      // Element outside virtual window — center-scroll to target item
      const targetScroll =
        currentIndex * ITEM_STEP - (trackEl.clientWidth - ITEM_W) / 2;
      trackEl.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  });

  function handleClick(index: number) {
    if (index === currentIndex) return;
    onSelect(index);
  }
</script>

<div
  class="thumbnail-bar"
  class:open={visible}
  class:fullscreen
  bind:this={barEl}
  ontransitionend={onTransitionEnd}
>
  {#if showToast}
    <div
      style="position: absolute; top: -36px; left: 0; right: 0; display: flex; justify-content: center; z-index: 95; pointer-events: none;"
    >
      <ThumbnailGenToast />
    </div>
  {/if}

  <div
    class="thumbnail-track"
    class:animating={false}
    bind:this={trackEl}
    bind:clientWidth={trackWidth}
    onscroll={onScroll}
    onwheel={onWheel}
  >
    <!-- Left spacer so the first visible item aligns as if all items are rendered -->
    <div
      class="thumb-spacer"
      style="width: {firstIdx * ITEM_STEP}px; flex-shrink: 0;"
      aria-hidden="true"
    ></div>

    {#each visibleItems as item (item.path)}
      <button
        class="thumbnail-item"
        class:active={item.index === currentIndex}
        class:privacy-blur={library.privacyMode}
        data-path={item.path}
        data-index={item.index}
        style="width: {ITEM_W}px; height: {ITEM_W}px;"
        onclick={() => handleClick(item.index)}
        aria-label={t("menus.thumbnail.openFile")}
      >
        {#if getCached(item.path, THUMB_SIZE)}
          <img
            src={getCached(item.path, THUMB_SIZE)}
            alt=""
            width={ITEM_W}
            height={ITEM_W}
            style="object-fit: cover;"
            decoding="async"
            draggable="false"
          />
        {:else if item.isPdf}
          <div class="thumbnail-pdf-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="12" y1="13" x2="12" y2="18" />
            </svg>
          </div>
        {:else}
          <div
            class="thumb-placeholder"
            class:failed={isThumbnailFailed(item.path, THUMB_SIZE)}
            style="width: {ITEM_W}px; height: {ITEM_W}px;"
          ></div>
        {/if}

        {#if item.isVideo}
          <div class="thumbnail-video-icon">
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
        {/if}

        {#if item.isGif}
          <div class="thumbnail-gif-icon">
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
        {/if}

        {#if item.isPdf && getCached(item.path, THUMB_SIZE)}
          <div class="thumbnail-pdf-badge">
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
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
        {/if}

        {#if item.isAudio}
          <div class="thumbnail-audio-icon">
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
        {/if}
      </button>
    {/each}

    <!-- Right spacer to maintain total scroll width -->
    <div
      class="thumb-spacer"
      style="width: {(fileList.length - 1 - lastIdx) *
        ITEM_STEP}px; flex-shrink: 0;"
      aria-hidden="true"
    ></div>
  </div>
</div>
