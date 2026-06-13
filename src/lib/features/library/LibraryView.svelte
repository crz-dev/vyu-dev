<script lang="ts">
  import { VIDEO_EXTS, AUDIO_EXTS, DOCUMENT_EXTS } from "$lib/shared/constants";
  import { getFileExt } from "$lib/services/files";
  import { library } from "$lib/features/library/library.svelte";

  let {
    fileList,
    currentIndex,
    onSelect,
    onClose,
  }: {
    fileList: string[];
    currentIndex: number;
    onSelect: (path: string) => void;
    onClose: () => void;
  } = $props();

  let scrollEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;
  let mounted = $state(false);
  let scrollActive = $state(false);
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  const VIDEO_SET = new Set(VIDEO_EXTS);
  const AUDIO_SET = new Set(AUDIO_EXTS);

  const activePaths = $derived(
    currentIndex >= 0 && currentIndex < fileList.length
      ? new Set([fileList[currentIndex]])
      : new Set<string>(),
  );

  const sortedFiles = $derived.by(() => {
    const files = [...fileList];
    const mode = library.sortMode;
    const desc = library.sortDesc;
    files.sort((a, b) => {
      let cmp = 0;
      if (mode === "name") {
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      } else if (mode === "type") {
        cmp = getFileExt(a).localeCompare(getFileExt(b));
      } else if (mode === "size") {
        // size sort not available client-side without stat, fall back to name
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      } else {
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      }
      return desc ? -cmp : cmp;
    });
    return files;
  });

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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (library.viewMode === "grid") {
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

  // Observer lifecycle
  $effect(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const path = (entry.target as HTMLElement).dataset.path;
          if (!path) continue;
          if (entry.isIntersecting) {
            library.requestThumbnail(path);
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

  // Scroll to current file on open
  $effect(() => {
    if (!mounted || !scrollEl) return;
    const el = scrollEl.querySelector(`[data-path="${fileList[currentIndex]}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  // Cleanup
  $effect(() => {
    return () => {
      library.clearQueue();
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="library-view"
  class:mounted
  onkeydown={handleKeydown}
  role="region"
  aria-label="File library"
>
  <div
    class="library-scroll"
    class:scroll-active={scrollActive}
    bind:this={scrollEl}
    onscroll={onScroll}
  >
    {#if library.viewMode === "grid"}
      <div class="library-grid">
        {#each sortedFiles as path (path)}
          {@const active = activePaths.has(path)}
          {@const badge = getMediaBadge(path)}
          <div
            class="library-cell"
            class:active
            data-path={path}
            role="button"
            tabindex="0"
            onclick={() => onSelect(path)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(path);
              }
            }}
          >
            {#if thumbFor(path)}
              <img class="library-thumb" src={thumbFor(path)} alt="" draggable="false" />
            {:else}
              <div class="library-placeholder"></div>
            {/if}
            {#if badge === "video"}
              <div class="library-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            {:else if badge === "gif"}
              <div class="library-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </div>
            {:else if badge === "audio"}
              <div class="library-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            {:else if badge === "pdf"}
              <div class="library-badge library-badge-pdf">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="12" y1="13" x2="12" y2="18" />
                </svg>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="library-list">
        <div class="list-header">
          <span class="list-col list-col-thumb"></span>
          <span class="list-col list-col-name">Name</span>
          <span class="list-col list-col-type">Type</span>
        </div>
        {#each sortedFiles as path (path)}
          {@const active = activePaths.has(path)}
          <div
            class="list-row"
            class:active
            data-path={path}
            role="button"
            tabindex="0"
            onclick={() => onSelect(path)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(path);
              }
            }}
          >
            <span class="list-col list-col-thumb">
              {#if thumbFor(path)}
                <img class="list-thumb" src={thumbFor(path)} alt="" draggable="false" />
              {:else}
                <div class="list-placeholder"></div>
              {/if}
            </span>
            <span class="list-col list-col-name">
              {path.split(/[/\\]/).pop()}
            </span>
            <span class="list-col list-col-type">{getExt(path)}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if fileList.length === 0}
      <div class="library-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>No files in this folder</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .library-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary, #0a0a0a);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .library-view.mounted {
    opacity: 1;
  }

  .library-scroll {
    flex: 1;
    overflow-y: auto;
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

  .library-scroll.scroll-active::-webkit-scrollbar-thumb {
    background: var(--bg-shimmer, #333);
  }

  /* Grid view */
  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 6px;
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
    border-color: var(--accent, #4a9eff);
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

  /* List view */
  .library-list {
    display: flex;
    flex-direction: column;
  }

  .list-header {
    display: flex;
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--bg-elevated, #222);
    font-family: var(--font-family);
  }

  .list-row {
    display: flex;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s;
    align-items: center;
    font-family: var(--font-family);
  }

  .list-row:hover {
    background: var(--bg-elevated, #1a1a1a);
  }

  .list-row.active {
    background: rgba(74, 158, 255, 0.1);
  }

  .list-col {
    font-size: 13px;
    color: var(--text-primary, #ccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list-col-thumb {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    margin-right: 10px;
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

  .list-col-type {
    width: 80px;
    flex-shrink: 0;
    text-align: right;
    color: var(--text-muted, #888);
    font-size: 12px;
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
</style>
