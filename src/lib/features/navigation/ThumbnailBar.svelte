<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { invoke } from "@tauri-apps/api/core";
  import { tick } from "svelte";
  import {
    VIDEO_EXTS,
    IMAGE_EXTS,
    DOCUMENT_EXTS,
    BROWSER_UNSUPPORTED_IMAGE_EXTS,
    REMUX_VIDEO_EXTS,
  } from "$lib/shared/constants";
  import { getFileExt } from "$lib/services/files";

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

  let trackEl = $state<HTMLDivElement | null>(null);
  let animatingToIndex = $state<number | null>(null);
  let pendingScrollRaf = $state<ReturnType<
    typeof requestAnimationFrame
  > | null>(null);
  let scrollPending = false;
  let rafVisibilityId = $state<ReturnType<typeof requestAnimationFrame> | null>(
    null,
  );

  const LIMIT = 10;
  const TOTAL_SLOTS = LIMIT * 2 + 1;
  const MAX_CONCURRENT = 6;

  const IMAGE_EXTS_SET = new Set(IMAGE_EXTS);

  function needsServerThumbnail(path: string): boolean {
    const ext = getFileExt(path);
    return VIDEO_EXTS.includes(ext) || BROWSER_UNSUPPORTED_IMAGE_EXTS.has(ext);
  }

  function isRemuxVideo(path: string): boolean {
    return REMUX_VIDEO_EXTS.has(getFileExt(path));
  }

  let thumbnailUrls = $state<Record<string, string>>({});
  let fetchingPaths = $state(new Set<string>());
  let visiblePaths = $state(new Set<string>());
  let wantedInViewAt = $state(new Map<string, number>());
  const srcCache = new Map<string, string>();

  function isVideo(path: string): boolean {
    return VIDEO_EXTS.includes(getFileExt(path));
  }

  function isImage(path: string): boolean {
    return IMAGE_EXTS_SET.has(getFileExt(path));
  }

  function isPdfFile(path: string): boolean {
    return DOCUMENT_EXTS.includes(getFileExt(path));
  }

  function getSrc(path: string): string {
    let cached = srcCache.get(path);
    if (!cached) {
      cached = convertFileSrc(path);
      srcCache.set(path, cached);
    }
    return cached;
  }

  const centerIdx = $derived(animatingToIndex ?? currentIndex);

  const slots = $derived(
    Array.from({ length: TOTAL_SLOTS }, (_, i) => {
      const idx = centerIdx - LIMIT + i;
      if (idx >= 0 && idx < fileList.length) {
        return { path: fileList[idx], index: idx };
      }
      return null;
    }),
  );

  function updateVisiblePaths() {
    if (!trackEl) return;
    const margin = 140;
    const viewLeft = trackEl.scrollLeft - margin;
    const viewRight = trackEl.scrollLeft + trackEl.clientWidth + margin;

    const next = new Set<string>();
    const now = performance.now();
    const nextWanted = new Map(wantedInViewAt);

    for (const el of trackEl.querySelectorAll("[data-path]")) {
      const left = (el as HTMLElement).offsetLeft;
      const right = left + (el as HTMLElement).offsetWidth;
      const path = el.getAttribute("data-path");
      if (!path) continue;
      if (right >= viewLeft && left <= viewRight) {
        next.add(path);
        if (!nextWanted.has(path)) nextWanted.set(path, now);
      }
    }

    for (const [p] of wantedInViewAt) {
      if (!next.has(p)) nextWanted.delete(p);
    }

    wantedInViewAt = nextWanted;
    visiblePaths = next;
  }

  function onTrackScroll() {
    if (scrollPending) return;
    scrollPending = true;
    rafVisibilityId = requestAnimationFrame(() => {
      scrollPending = false;
      rafVisibilityId = null;
      updateVisiblePaths();
    });
  }

  $effect(() => {
    if (!visible) return;

    const _ = slots;

    if (trackEl) {
      tick().then(() => updateVisiblePaths());
    }
  });

  $effect(() => {
    const raf = rafVisibilityId;
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  });

  function inSlotWindow(path: string): boolean {
    for (const slot of slots) {
      if (slot && slot.path === path) return true;
    }
    return false;
  }

  async function fetchOneThumbnail(path: string) {
    if (fetchingPaths.has(path)) return;
    fetchingPaths = new Set(fetchingPaths).add(path);

    try {
      const result = await invoke<string | null>("generate_thumbnail", {
        path,
      });

      const enteredAt = wantedInViewAt.get(path);
      if (enteredAt !== undefined) {
        const spent = performance.now() - enteredAt;
        const minDelay = enteredAt > 0 ? Math.max(0, 50 - spent) : 0;
        if (minDelay > 0) {
          await new Promise((r) => setTimeout(r, minDelay));
        }
      }

      if (!inSlotWindow(path)) return;

      if (result) {
        thumbnailUrls = { ...thumbnailUrls, [path]: result };
      } else if (isPdfFile(path)) {
        // PDFs use their own icon in template — mark as resolved
        thumbnailUrls = { ...thumbnailUrls, [path]: path };
      } else if (
        !isVideo(path) &&
        !BROWSER_UNSUPPORTED_IMAGE_EXTS.has(getFileExt(path))
      ) {
        thumbnailUrls = { ...thumbnailUrls, [path]: path };
      }
    } catch {
      if (
        inSlotWindow(path) &&
        !isVideo(path) &&
        !isPdfFile(path) &&
        !BROWSER_UNSUPPORTED_IMAGE_EXTS.has(getFileExt(path))
      ) {
        thumbnailUrls = { ...thumbnailUrls, [path]: path };
      } else if (inSlotWindow(path) && isPdfFile(path)) {
        thumbnailUrls = { ...thumbnailUrls, [path]: path };
      }
    } finally {
      const next = new Set(fetchingPaths);
      next.delete(path);
      fetchingPaths = next;
    }
  }

  $effect(() => {
    if (!visible || fileList.length === 0) return;

    const uncachedImages: string[] = [];
    const uncachedServer: string[] = [];
    for (const slot of slots) {
      if (!slot) continue;
      if (!isImage(slot.path) && !isVideo(slot.path) && !isPdfFile(slot.path))
        continue;
      if (slot.path in thumbnailUrls) continue;
      if (fetchingPaths.has(slot.path)) continue;
      if (needsServerThumbnail(slot.path)) {
        uncachedServer.push(slot.path);
      } else {
        uncachedImages.push(slot.path);
      }
    }

    for (const path of uncachedImages) {
      thumbnailUrls = { ...thumbnailUrls, [path]: path };
    }

    if (uncachedServer.length === 0) return;

    uncachedServer.sort((a, b) => {
      const ia = fileList.indexOf(a);
      const ib = fileList.indexOf(b);
      const distA = Math.abs(ia - centerIdx);
      const distB = Math.abs(ib - centerIdx);
      const inViewA = visiblePaths.has(a) ? 0 : 1000;
      const inViewB = visiblePaths.has(b) ? 0 : 1000;
      return distA + inViewA - (distB + inViewB);
    });

    const remaining = MAX_CONCURRENT - fetchingPaths.size;
    for (let j = 0; j < remaining && j < uncachedServer.length; j++) {
      fetchOneThumbnail(uncachedServer[j]);
    }
  });

  $effect(() => {
    if (visible && trackEl && animatingToIndex === null) {
      const activeEl = trackEl.querySelector(
        `[data-slot-active="true"]`,
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({
          inline: "center",
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  });

  $effect(() => {
    const raf = pendingScrollRaf;
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  });

  $effect(() => {
    if (!visible) {
      thumbnailUrls = {};
      srcCache.clear();
      fetchingPaths = new Set();
      visiblePaths = new Set();
      wantedInViewAt = new Map();
    }
  });

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  async function handleClick(index: number) {
    if (index === currentIndex || fileList.length === 0) return;

    if (pendingScrollRaf !== null) {
      cancelAnimationFrame(pendingScrollRaf);
      pendingScrollRaf = null;
    }

    animatingToIndex = index;
    await tick();

    const target = trackEl?.querySelector(
      `[data-slot-index="${index}"]`,
    ) as HTMLElement | null;

    if (!target || !trackEl) {
      animatingToIndex = null;
      onSelect(index);
      return;
    }

    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const trackCenter = trackEl.clientWidth / 2;
    const targetScroll = targetCenter - trackCenter;
    const startScroll = trackEl.scrollLeft;
    const distance = targetScroll - startScroll;

    if (Math.abs(distance) < 2) {
      animatingToIndex = null;
      onSelect(index);
      return;
    }

    const duration = Math.min(220 + Math.abs(distance) * 0.4, 620);
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      trackEl!.scrollLeft = startScroll + distance * eased;

      if (t < 1) {
        pendingScrollRaf = requestAnimationFrame(animate);
      } else {
        pendingScrollRaf = null;
        animatingToIndex = null;
        onSelect(index);
      }
    };

    pendingScrollRaf = requestAnimationFrame(animate);
  }

  function getThumbSrc(path: string): string | null {
    const thumb = thumbnailUrls[path];
    if (!thumb) return null;
    return getSrc(thumb);
  }
</script>

{#if visible && fileList.length > 0}
  <div class="thumbnail-bar" class:fullscreen>
    <div
      class="thumbnail-track"
      class:animating={animatingToIndex !== null}
      onscroll={onTrackScroll}
      bind:this={trackEl}
    >
      {#each slots as slot, i (slot?.path ?? `_s${i}`)}
        {#if slot}
          {@const active = slot.index === (animatingToIndex ?? currentIndex)}
          {@const video = isVideo(slot.path)}
          {@const pdf = isPdfFile(slot.path)}
          {@const inView = visiblePaths.has(slot.path)}
          {@const thumbSrc = getThumbSrc(slot.path)}
          <button
            class="thumbnail-item"
            class:active
            class:target={slot.index === animatingToIndex}
            data-slot-active={active}
            data-slot-index={slot.index}
            data-path={slot.path}
            onclick={() => handleClick(slot.index)}
            aria-label="Open file"
          >
            {#if video}
              {#if thumbSrc}
                <img
                  src={thumbSrc}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                />
              {:else if !isRemuxVideo(slot.path)}
                <video
                  src={inView ? getSrc(slot.path) : undefined}
                  muted
                  preload={inView ? "metadata" : "none"}
                ></video>
              {/if}
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
            {:else if pdf}
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
                  <path
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="12" y1="13" x2="12" y2="18" />
                </svg>
              </div>
            {:else if thumbSrc && inView}
              <img
                src={thumbSrc}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
              />
            {/if}
          </button>
        {:else}
          <div class="thumbnail-spacer" aria-hidden="true"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if}
