<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { invoke } from "@tauri-apps/api/core";
  import { tick } from "svelte";
  import { VIDEO_EXTS } from "$lib/constants";

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

  const LIMIT = 5;
  const TOTAL_SLOTS = LIMIT * 2 + 1;
  const MAX_CONCURRENT = 4;

  const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);

  let thumbnailUrls = $state<Record<string, string>>({});
  let fetchingPaths = $state(new Set<string>());
  const srcCache = new Map<string, string>();

  function isVideo(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return VIDEO_EXTS.includes(ext);
  }

  function isImage(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return IMAGE_EXTS.has(ext);
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

  async function fetchOneThumbnail(path: string) {
    if (fetchingPaths.has(path)) return;
    fetchingPaths = new Set(fetchingPaths).add(path);

    try {
      const result = await invoke<string | null>("generate_thumbnail", {
        path,
      });
      if (result) {
        thumbnailUrls = { ...thumbnailUrls, [path]: result };
      } else {
        thumbnailUrls = { ...thumbnailUrls, [path]: path };
      }
    } catch {
      thumbnailUrls = { ...thumbnailUrls, [path]: path };
    } finally {
      const next = new Set(fetchingPaths);
      next.delete(path);
      fetchingPaths = next;
    }
  }

  $effect(() => {
    if (!visible || fileList.length === 0) return;

    const uncached: string[] = [];
    for (const slot of slots) {
      if (!slot) continue;
      if (!isImage(slot.path)) continue;
      if (slot.path in thumbnailUrls) continue;
      if (fetchingPaths.has(slot.path)) continue;
      uncached.push(slot.path);
    }

    const remaining = MAX_CONCURRENT - fetchingPaths.size;
    for (let j = 0; j < remaining && j < uncached.length; j++) {
      fetchOneThumbnail(uncached[j]);
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

  function getThumbSrc(path: string): string {
    return getSrc(thumbnailUrls[path] ?? path);
  }
</script>

{#if visible && fileList.length > 0}
  <div class="thumbnail-bar" class:fullscreen>
    <div
      class="thumbnail-track"
      class:animating={animatingToIndex !== null}
      bind:this={trackEl}
    >
      {#each slots as slot, i (slot?.path ?? `_s${i}`)}
        {#if slot}
          {@const active = slot.index === (animatingToIndex ?? currentIndex)}
          {@const video = isVideo(slot.path)}
          <button
            class="thumbnail-item"
            class:active
            class:target={slot.index === animatingToIndex}
            data-slot-active={active}
            data-slot-index={slot.index}
            onclick={() => handleClick(slot.index)}
            aria-label="Open file"
          >
            {#if video}
              <video src={getSrc(slot.path)} muted preload="metadata"></video>
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
            {:else}
              <img
                src={getThumbSrc(slot.path)}
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
