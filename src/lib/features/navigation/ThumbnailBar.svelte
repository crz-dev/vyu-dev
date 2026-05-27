<script lang="ts">
  import { VIDEO_EXTS, DOCUMENT_EXTS } from "$lib/shared/constants";
  import { getFileExt } from "$lib/services/files";
  import { invokeGetThumbnail } from "$lib/features/media/tools";

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

  // ── Layout constants ──
  const ITEM_W = 70;
  const ITEM_GAP = 6;
  const ITEM_STEP = ITEM_W + ITEM_GAP;
  const OVERSCAN = 6;
  const VIDEO_EXTS_SET = new Set(VIDEO_EXTS);

  // ── Element refs ──
  let trackEl: HTMLDivElement | null = $state(null);
  let barEl: HTMLDivElement | null = $state(null);
  let trackWidth = $state(800);
  let scrollLeft = $state(0);

  // ── Animation gate ──
  // Thumbnails are NOT fetched until the open-transition finishes.
  let afterOpen = $state(false);

  // ── Thumbnail state ──
  let loaded = $state(new Map<string, string>());
  let fetching = $state(new Set<string>());

  // ── Virtual-scroll computed range ──
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
      isPdf: DOCUMENT_EXTS.includes(getFileExt(path)),
    })),
  );

  // ── Center-outward loading queue ──
  let loadQueue = $state<string[]>([]);
  let observed = $state(new Set<string>());

  // Rebuild queue when bar opens or currentIndex changes
  $effect(() => {
    if (!afterOpen || fileList.length === 0) {
      loadQueue = [];
      return;
    }

    // Build center-outward order: current, +1, -1, +2, -2, …
    const order: number[] = [currentIndex];
    let l = currentIndex - 1;
    let r = currentIndex + 1;
    while (l >= 0 || r < fileList.length) {
      if (r < fileList.length) order.push(r++);
      if (l >= 0) order.push(l--);
    }

    // Keep all items — will be fetched in center-outward order
    loadQueue = order.map((idx) => fileList[idx]);
  });

  // ── IntersectionObserver ──
  let observer: IntersectionObserver | null = null;

  $effect(() => {
    observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const path = (entry.target as HTMLElement).dataset.path;
            if (path && !observed.has(path)) {
              observed = new Set(observed).add(path);
              changed = true;
            }
          }
        }
      },
      { rootMargin: "150px" },
    );
    return () => {
      observer?.disconnect();
    };
  });

  // Observe newly rendered elements (re-runs when visibleItems changes
  // so that elements created after mount are registered with the observer).
  $effect(() => {
    visibleItems;
    const els = trackEl?.querySelectorAll("[data-path]");
    if (els && observer) {
      for (const el of els) {
        observer.observe(el);
      }
    }
  });

  // ── Queue processor ──
  // Takes one item at a time — `loadQueue` is already in center-outward order.
  $effect(() => {
    if (!afterOpen) return;
    for (const path of loadQueue) {
      if (loaded.has(path) || fetching.has(path)) continue;
      fetchOne(path);
      return; // one at a time
    }
  });

  // ── Fetch logic ──
  async function fetchOne(path: string) {
    fetching = new Set(fetching).add(path);
    try {
      const dataUrl = await invokeGetThumbnail(path);
      if (dataUrl) {
        loaded = new Map(loaded).set(path, dataUrl);
      }
    } catch {
      // Silently fail — thumbnail stays as placeholder
    }
    const next = new Set(fetching);
    next.delete(path);
    fetching = next;
  }

  // ── Cleanup when bar closes ──
  $effect(() => {
    if (!visible) {
      afterOpen = false;
      loaded = new Map();
      observed = new Set();
      loadQueue = [];
      fetching = new Set();
    }
  });

  // ── Open/close animation gate ──
  function onTransitionEnd(e: TransitionEvent) {
    if (e.propertyName === "transform" && visible) {
      afterOpen = true;
    }
  }

  // ── Scroll handlers ──
  function onScroll() {
    if (trackEl) {
      scrollLeft = trackEl.scrollLeft;
    }
  }

  // Scroll active item into view when currentIndex changes (and bar is already open)
  $effect(() => {
    if (!afterOpen || !trackEl) return;
    const el = trackEl.querySelector(
      `[data-index="${currentIndex}"]`,
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  });

  // ── Click handler ──
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
  <div
    class="thumbnail-track"
    class:animating={false}
    bind:this={trackEl}
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
          <div class="thumb-placeholder" style="width: {ITEM_W}px; height: {ITEM_W}px;"></div>
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
      </button>
    {/each}

    <!-- Right spacer to maintain total scroll width -->
    <div
      class="thumb-spacer"
      style="width: {(fileList.length - 1 - lastIdx) * ITEM_STEP}px; flex-shrink: 0;"
      aria-hidden="true"
    ></div>
  </div>
</div>
