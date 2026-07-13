<script lang="ts">
  import { VIDEO_EXTS, AUDIO_EXTS, DOCUMENT_EXTS } from "$lib/shared/constants";
  import { getFileExt } from "$lib/services/files";
  import {
    invokeGetThumbnails,
    onThumbnailProgress,
  } from "$lib/features/media/api";
  import { getCached, setCached } from "$lib/services/thumbnailCache";
  import { library } from "$lib/features/library/library.svelte";
  import ThumbnailGenToast from "$lib/components/ThumbnailGenToast.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";

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
  const VIDEO_EXTS_SET = new Set(VIDEO_EXTS);
  const AUDIO_EXTS_SET = new Set(AUDIO_EXTS);

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

  // Thumbnails
  let loaded = $state(new Map<string, string>());
  let fetching = $state(new Set<string>());

  // Delay the toast so it doesn't flash when thumbnails are already cached.
  const generating = $derived(afterOpen && loaded.size < fileList.length);
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

  // Center-outward load queue
  let loadQueue = $state<string[]>([]);
  let observed = $state(new Set<string>());

  // Rebuild queue when bar opens or currentIndex changes
  $effect(() => {
    if (!afterOpen || fileList.length === 0) {
      loadQueue = [];
      return;
    }

    // Build center-outward order: current, -1, +1, -2, +2, …
    const order: number[] = [currentIndex];
    let l = currentIndex - 1;
    let r = currentIndex + 1;
    while (l >= 0 || r < fileList.length) {
      if (l >= 0) order.push(l--);
      if (r < fileList.length) order.push(r++);
    }

    // Keep all items — will be fetched in center-outward order
    loadQueue = order.map((idx) => fileList[idx]);
  });

  // IntersectionObserver
  let observer: IntersectionObserver | null = null;

  $effect(() => {
    observer = new IntersectionObserver(
      (entries) => {
        let added: string[] = [];
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const path = (entry.target as HTMLElement).dataset.path;
            if (path && !observed.has(path)) {
              added.push(path);
            }
          }
        }
        if (added.length > 0) {
          observed = new Set([...observed, ...added]);
        }
      },
      { rootMargin: "50px" },
    );
    return () => {
      observer?.disconnect();
    };
  });

  // Observe newly rendered elements (re-runs when visibleItems changes)
  $effect(() => {
    visibleItems;
    const els = trackEl?.querySelectorAll("[data-path]");
    if (els && observer) {
      for (const el of els) {
        observer.observe(el);
      }
    }
  });

  // Stale guard — incremented on close/cleanup to cancel in-flight batches
  let _fetchGen = 0;

  let inflightBatches = $state(0);

  // Queue processor
  // Process queue in center-outward order — fills outward from current file
  const BATCH_SIZE = 6;
  const MAX_CONCURRENT = 4;
  $effect(() => {
    if (!afterOpen) return;
    if (inflightBatches >= MAX_CONCURRENT) return;
    // Collect a batch of uncached paths in queue order
    const batch: string[] = [];
    const cacheHits: [string, string][] = [];
    for (const path of loadQueue) {
      if (loaded.has(path) || fetching.has(path)) continue;
      const cached = getCached(path);
      if (cached) {
        cacheHits.push([path, cached]);
        continue;
      }
      batch.push(path);
      if (batch.length >= BATCH_SIZE) break;
    }
    if (cacheHits.length > 0) {
      const updated = new Map(loaded);
      for (const [path, dataUrl] of cacheHits) updated.set(path, dataUrl);
      loaded = updated;
    }
    if (batch.length > 0) fetchBatch(batch);
  });

  async function fetchBatch(paths: string[]) {
    const localGen = _fetchGen;
    inflightBatches++;
    fetching = new Set([...fetching, ...paths]);

    // Listen for streaming results from the backend
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await onThumbnailProgress((path, dataUrl) => {
        if (localGen !== _fetchGen) return;
        if (!dataUrl) return;
        setCached(path, 120, dataUrl);
        if (!loaded.has(path)) {
          loaded = new Map([...loaded, [path, dataUrl]]);
        }
      });

      const results = await invokeGetThumbnails(paths, 120);
      if (localGen !== _fetchGen) return;
      // Process any results not delivered via streaming
      const updated = new Map(loaded);
      let changed = false;
      for (const [p, dataUrl] of Object.entries(results)) {
        if (dataUrl && !updated.has(p)) {
          updated.set(p, dataUrl);
          setCached(p, 120, dataUrl);
          changed = true;
        }
      }
      if (changed) loaded = updated;
    } catch {
      // Silently fail — thumbnail stays as placeholder
    } finally {
      unlisten?.();
      const next = new Set(fetching);
      for (const p of paths) next.delete(p);
      fetching = next;
      inflightBatches--;
    }
  }

  // Cleanup on close
  $effect(() => {
    if (!visible) {
      _fetchGen++;
      inflightBatches = 0;
      afterOpen = false;
      observed = new Set();
      loadQueue = [];
      fetching = new Set();
    }
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

  // Scroll active item into view when currentIndex changes (and bar is already open)
  $effect(() => {
    if (!afterOpen || !trackEl) return;
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
        aria-label="Open file"
      >
        {#if item.isPdf}
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
        {:else if loaded.has(item.path)}
          <img
            src={loaded.get(item.path)}
            alt=""
            width={ITEM_W}
            height={ITEM_W}
            style="object-fit: cover;"
            decoding="async"
            draggable="false"
          />
        {:else}
          <div
            class="thumb-placeholder"
            class:fetching={fetching.has(item.path)}
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
