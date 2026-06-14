<script lang="ts">
  import { VIDEO_EXTS, AUDIO_EXTS, DOCUMENT_EXTS } from "$lib/shared/constants";
  import { getFileExt } from "$lib/services/files";
  import { library } from "$lib/features/library/library.svelte";

  let {
    fileList,
    currentIndex,
    onSelect,
    onClose,
    selectMode = false,
  }: {
    fileList: string[];
    currentIndex: number;
    onSelect: (path: string) => void;
    onClose: () => void;
    selectMode?: boolean;
  } = $props();

  let scrollEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;
  let mounted = $state(false);
  let scrollActive = $state(false);
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  let imageDims = $state<Record<string, { w: number; h: number }>>({});

  // Drag-to-select state
  let dragStart: { x: number; y: number } | null = $state(null);
  let dragEnd: { x: number; y: number } | null = $state(null);
  let isDragging = $state(false);
  let dragSuppressedClick = $state(false);

  const RIVER_GAP = 6;

  const VIDEO_SET = new Set(VIDEO_EXTS);
  const AUDIO_SET = new Set(AUDIO_EXTS);

  function densityMap(
    d: number,
    big: number,
    def: number,
    small: number,
  ): number {
    return d <= 0.5
      ? big + (def - big) * (d / 0.5)
      : def + (small - def) * ((d - 0.5) / 0.5);
  }

  const gridMinCol = $derived(densityMap(library.density, 480, 180, 80));
  const riverRowH = $derived(densityMap(library.density, 380, 140, 50));
  const filmstripBase = $derived(densityMap(library.density, 550, 240, 100));
  const listThumbSize = $derived(densityMap(library.density, 72, 32, 18));
  const listRowPad = $derived(densityMap(library.density, 8, 4, 2));
  const listFontSize = $derived(densityMap(library.density, 16, 13, 10));
  const listTypeFontSize = $derived(densityMap(library.density, 14, 12, 9));

  const activePaths = $derived(
    currentIndex >= 0 && currentIndex < fileList.length
      ? new Set([fileList[currentIndex]])
      : new Set<string>(),
  );

  const sortedFiles = $derived.by(() => {
    const files = [...fileList];
    const mode = library.sortMode;
    const desc = library.sortDesc;
    const statMap = library.stats;
    files.sort((a, b) => {
      let cmp = 0;
      if (mode === "name") {
        cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
      } else if (mode === "type") {
        cmp = getFileExt(a).localeCompare(getFileExt(b));
      } else if (mode === "size") {
        const aSize = statMap[a]?.size ?? 0;
        const bSize = statMap[b]?.size ?? 0;
        cmp = aSize - bSize;
      } else if (mode === "date-modified") {
        const aTime = statMap[a]?.mtime_ms ?? 0;
        const bTime = statMap[b]?.mtime_ms ?? 0;
        cmp = aTime - bTime;
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

  function onImageLoad(path: string, e: Event) {
    const img = e.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      imageDims[path] = { w: img.naturalWidth, h: img.naturalHeight };
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (library.viewMode === "grid" || library.viewMode === "filmstrip") {
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

  function onWheel(e: WheelEvent) {
    if (library.viewMode !== "filmstrip") return;
    const container = scrollEl?.querySelector(
      ".library-filmstrip",
    ) as HTMLElement | null;
    if (!container) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }

  function rectsOverlap(
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ): boolean {
    return (
      a.left <= b.right &&
      a.right >= b.left &&
      a.top <= b.bottom &&
      a.bottom >= b.top
    );
  }

  function handleDragStart(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!selectMode && target.closest("[data-path]")) return;
    if (!scrollEl) return;
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY };
    dragEnd = { x: e.clientX, y: e.clientY };
    isDragging = false;
  }

  function handleDragMove(e: MouseEvent) {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isDragging = true;
      if (!e.shiftKey && !selectMode) {
        library.clearSelection();
      }
    }
    if (isDragging) {
      dragEnd = { x: e.clientX, y: e.clientY };
    }
  }

  function handleDragEnd(e: MouseEvent) {
    if (isDragging && dragStart && dragEnd) {
      const selRect = {
        left: Math.min(dragStart.x, dragEnd.x),
        right: Math.max(dragStart.x, dragEnd.x),
        top: Math.min(dragStart.y, dragEnd.y),
        bottom: Math.max(dragStart.y, dragEnd.y),
      };
      const cells = scrollEl?.querySelectorAll("[data-path]");
      const hitPaths: string[] = [];
      if (cells) {
        for (const cell of cells) {
          const r = cell.getBoundingClientRect();
          if (rectsOverlap(selRect, r)) {
            const p = (cell as HTMLElement).dataset.path;
            if (p) hitPaths.push(p);
          }
        }
      }
      if (hitPaths.length > 0) {
        library.selectRange(hitPaths);
      }
      dragSuppressedClick = true;
      queueMicrotask(() => {
        dragSuppressedClick = false;
      });
    }
    dragStart = null;
    dragEnd = null;
    isDragging = false;
  }

  const dragRect = $derived.by(() => {
    if (!dragStart || !dragEnd) return null;
    return {
      left: Math.min(dragStart.x, dragEnd.x),
      top: Math.min(dragStart.y, dragEnd.y),
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y),
    };
  });

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

  // Load file stats for sort by size/date-modified
  $effect(() => {
    if (fileList.length > 0) {
      library.loadStats(fileList);
    }
  });

  // Scroll to current file on open or density change
  $effect(() => {
    if (!mounted || !scrollEl) return;
    void library.density;
    const el = scrollEl.querySelector(
      `[data-path="${fileList[currentIndex]}"]`,
    ) as HTMLElement | null;
    if (el) {
      if (library.viewMode === "filmstrip") {
        el.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: "smooth",
        });
      } else {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Cleanup
  $effect(() => {
    return () => {
      library.clearQueue();
    };
  });

  // Window-level drag handlers
  $effect(() => {
    function onMove(e: MouseEvent) {
      handleDragMove(e);
    }
    function onUp(e: MouseEvent) {
      handleDragEnd(e);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="library-scroll"
    class:scroll-active={scrollActive}
    class:select-mode={selectMode}
    class:dragging={isDragging}
    bind:this={scrollEl}
    onscroll={onScroll}
    onwheel={onWheel}
    onmousedown={handleDragStart}
  >
    {#if library.viewMode === "grid"}
      <div
        class="library-grid"
        style="grid-template-columns: repeat(auto-fill, minmax({gridMinCol}px, 1fr));"
      >
        {#each sortedFiles as path (path)}
          {@const active = activePaths.has(path)}
          {@const selected = library.isSelected(path)}
          {@const badge = getMediaBadge(path)}
          <div
            class="library-cell"
            class:active
            class:selected
            data-path={path}
            role="button"
            tabindex="0"
            onclick={(e) => {
              if (dragSuppressedClick) return;
              if (selectMode || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                library.toggleSelect(path);
              } else {
                onSelect(path);
              }
            }}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (selectMode || e.ctrlKey || e.metaKey) {
                  library.toggleSelect(path);
                } else {
                  onSelect(path);
                }
              }
            }}
          >
            {#if thumbFor(path)}
              <img
                class="library-thumb"
                src={thumbFor(path)}
                alt=""
                draggable="false"
              />
            {:else}
              <div class="library-placeholder"></div>
            {/if}
            <div
              class="library-checkbox"
              class:checked={selected}
              role="checkbox"
              tabindex="0"
              aria-checked={selected}
              aria-label="Select file"
              onclick={(e) => {
                e.stopPropagation();
                library.toggleSelect(path);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  library.toggleSelect(path);
                }
              }}
            >
              {#if selected}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {/if}
            </div>
            {#if badge === "video"}
              <div class="library-badge">
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
            {:else if badge === "gif"}
              <div class="library-badge">
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
            {:else if badge === "audio"}
              <div class="library-badge">
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
            {:else if badge === "pdf"}
              <div class="library-badge library-badge-pdf">
                <svg
                  width="12"
                  height="12"
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
            {/if}
          </div>
        {/each}
      </div>
    {:else if library.viewMode === "river"}
      <div class="library-river">
        {#each sortedFiles as path (path)}
          {@const active = activePaths.has(path)}
          {@const selected = library.isSelected(path)}
          {@const badge = getMediaBadge(path)}
          {@const dim = imageDims[path]}
          {@const ratio = dim ? dim.w / dim.h : 4 / 3}
          <div
            class="river-cell"
            class:active
            class:selected
            data-path={path}
            role="button"
            tabindex="0"
            style="height: {riverRowH}px; flex-grow: {ratio * riverRowH};"
            onclick={(e) => {
              if (dragSuppressedClick) return;
              if (selectMode || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                library.toggleSelect(path);
              } else {
                onSelect(path);
              }
            }}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (selectMode || e.ctrlKey || e.metaKey) {
                  library.toggleSelect(path);
                } else {
                  onSelect(path);
                }
              }
            }}
          >
            {#if thumbFor(path)}
              <img
                class="river-thumb"
                src={thumbFor(path)}
                alt=""
                draggable="false"
                onload={(e) => onImageLoad(path, e)}
              />
            {:else}
              <div class="river-placeholder"></div>
            {/if}
            <div
              class="library-checkbox"
              class:checked={selected}
              role="checkbox"
              tabindex="0"
              aria-checked={selected}
              aria-label="Select file"
              onclick={(e) => {
                e.stopPropagation();
                library.toggleSelect(path);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  library.toggleSelect(path);
                }
              }}
            >
              {#if selected}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {/if}
            </div>
            {#if badge}
              <div
                class="library-badge"
                class:library-badge-pdf={badge === "pdf"}
              >
                {#if badge === "video"}
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
                {:else if badge === "gif"}
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
                {:else if badge === "audio"}
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
                {:else if badge === "pdf"}
                  <svg
                    width="12"
                    height="12"
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
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else if library.viewMode === "filmstrip"}
      <div class="library-filmstrip">
        {#each sortedFiles as path (path)}
          {@const active = activePaths.has(path)}
          {@const selected = library.isSelected(path)}
          {@const badge = getMediaBadge(path)}
          {@const dim = imageDims[path]}
          {@const ratio = dim ? dim.w / dim.h : 4 / 3}
          <div
            class="filmstrip-cell"
            class:active
            class:selected
            data-path={path}
            role="button"
            tabindex="0"
            style="height: {active
              ? filmstripBase * 1.33
              : filmstripBase}px; width: {(active
              ? filmstripBase * 1.33
              : filmstripBase) * ratio}px;"
            onclick={(e) => {
              if (dragSuppressedClick) return;
              if (selectMode || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                library.toggleSelect(path);
              } else {
                onSelect(path);
              }
            }}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (selectMode || e.ctrlKey || e.metaKey) {
                  library.toggleSelect(path);
                } else {
                  onSelect(path);
                }
              }
            }}
          >
            {#if thumbFor(path)}
              <img
                class="filmstrip-thumb"
                src={thumbFor(path)}
                alt=""
                draggable="false"
                onload={(e) => onImageLoad(path, e)}
              />
            {:else}
              <div class="filmstrip-placeholder"></div>
            {/if}
            <div
              class="library-checkbox"
              class:checked={selected}
              role="checkbox"
              tabindex="0"
              aria-checked={selected}
              aria-label="Select file"
              onclick={(e) => {
                e.stopPropagation();
                library.toggleSelect(path);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  library.toggleSelect(path);
                }
              }}
            >
              {#if selected}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              {/if}
            </div>
            {#if badge}
              <div
                class="library-badge"
                class:library-badge-pdf={badge === "pdf"}
              >
                {#if badge === "video"}
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
                {:else if badge === "gif"}
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
                {:else if badge === "audio"}
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
                {:else if badge === "pdf"}
                  <svg
                    width="12"
                    height="12"
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
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div
        class="library-list"
        style="--list-thumb: {listThumbSize}px; --list-pad: {listRowPad}px; --list-font: {listFontSize}px; --list-type-font: {listTypeFontSize}px;"
      >
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
                <img
                  class="list-thumb"
                  src={thumbFor(path)}
                  alt=""
                  draggable="false"
                />
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
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.3"
        >
          <path
            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
          />
        </svg>
        <span>No files in this folder</span>
      </div>
    {/if}

    {#if isDragging && dragRect}
      <div
        class="select-rect"
        style="left: {dragRect.left}px; top: {dragRect.top}px; width: {dragRect.width}px; height: {dragRect.height}px;"
      ></div>
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
    scroll-behavior: smooth;
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

  .library-scroll.dragging {
    user-select: none;
    cursor: crosshair;
  }

  .library-scroll.dragging * {
    user-select: none;
  }

  .library-scroll.scroll-active::-webkit-scrollbar-thumb {
    background: var(--bg-shimmer, #333);
  }

  /* Filmstrip view */
  .library-filmstrip {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 100%;
    padding: 0 calc(50% - 100px);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .library-filmstrip::-webkit-scrollbar {
    display: none;
  }

  .filmstrip-cell {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    scroll-snap-align: center;
    border: 2px solid transparent;
    transition:
      border-color 0.1s,
      height 0.2s,
      width 0.2s;
    background: var(--bg-secondary, #111);
  }

  .filmstrip-cell:hover {
    border-color: var(--border-hover, #555);
  }

  .filmstrip-cell.active {
    border-color: #fff;
  }

  .filmstrip-cell.selected {
    border-color: var(--yellow, #f5c518);
  }

  .filmstrip-cell.active.selected {
    border-color: var(--yellow, #f5c518);
  }

  .filmstrip-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .filmstrip-placeholder {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary, #111);
  }

  /* River view */
  .library-river {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .river-cell {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    min-width: 60px;
    border: 2px solid transparent;
    transition:
      border-color 0.1s,
      transform 0.15s;
    background: var(--bg-secondary, #111);
  }

  .river-cell:hover {
    border-color: var(--border-hover, #555);
    transform: scale(1.02);
  }

  .river-cell.active {
    border-color: #fff;
  }

  .river-cell.selected {
    border-color: var(--yellow, #f5c518);
  }

  .river-cell.active.selected {
    border-color: var(--yellow, #f5c518);
  }

  .river-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .river-placeholder {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary, #111);
  }

  /* Grid view */
  .library-grid {
    display: grid;
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
    border-color: #fff;
  }

  .library-cell.selected {
    border-color: var(--yellow, #f5c518);
  }

  .library-cell.active.selected {
    border-color: var(--yellow, #f5c518);
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

  /* Selection checkbox */
  .library-checkbox {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: none;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition:
      background 0.1s,
      border-color 0.1s,
      opacity 0.1s;
    cursor: pointer;
    z-index: 2;
    color: var(--text-primary, #fff);
  }

  .library-checkbox:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .library-checkbox.checked {
    background: var(--yellow, #f5c518);
    color: #000;
  }

  .select-mode .library-checkbox,
  .library-checkbox.checked {
    opacity: 1;
  }

  .library-cell:hover .library-checkbox,
  .river-cell:hover .library-checkbox,
  .filmstrip-cell:hover .library-checkbox {
    opacity: 1;
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
    padding: var(--list-pad) calc(var(--list-pad) * 2);
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
    background: rgba(255, 255, 255, 0.08);
  }

  .list-col {
    font-size: var(--list-font);
    color: var(--text-primary, #ccc);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list-col-thumb {
    width: var(--list-thumb);
    height: var(--list-thumb);
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
    font-size: var(--list-type-font);
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

  /* Drag selection rectangle */
  .select-rect {
    position: fixed;
    border: 1px dashed var(--yellow, #f5c518);
    background: rgba(245, 197, 24, 0.08);
    pointer-events: none;
    z-index: 10;
  }
</style>
