<script lang="ts">
  import { isVideo, isAudio } from "$lib/shared/media-kind";
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

  let gridEl: HTMLDivElement | null = $state(null);
  let observer: IntersectionObserver | null = null;
  let observed = $state(new Set<string>());

  const groups = $derived.by(() => {
    const images: string[] = [];
    const videos: string[] = [];
    const audio: string[] = [];
    for (const path of fileList) {
      if (isVideo(path)) videos.push(path);
      else if (isAudio(path)) audio.push(path);
      else images.push(path);
    }
    return [
      { label: "images", files: images },
      { label: "videos", files: videos },
      { label: "audio", files: audio },
    ].filter((g) => g.files.length > 0);
  });

  function thumbFor(path: string) {
    return library.cache.get(path) || "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  $effect(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const path = (entry.target as HTMLElement).dataset.path;
          if (!path) continue;
          if (entry.isIntersecting) {
            if (!observed.has(path)) {
              observed = new Set(observed).add(path);
              library.requestThumbnail(path);
            }
          } else {
            library.cancelPending(path);
          }
        }
      },
      { rootMargin: "200px" },
    );
    return () => observer?.disconnect();
  });

  $effect(() => {
    groups;
    const els = gridEl?.querySelectorAll("[data-path]");
    if (els && observer) {
      for (const el of els) {
        observer.observe(el);
      }
    }
  });

  $effect(() => {
    return () => {
      observed = new Set();
      library.clearQueue();
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="library-overlay" onkeydown={handleKeydown}>
  <div class="library-scroll" bind:this={gridEl}>
    {#each groups as group}
      <div class="library-group">
        <div class="library-group-label">{group.label}</div>
        <div class="library-grid">
          {#each group.files as path (path)}
            {@const active = fileList.indexOf(path) === currentIndex}
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
                <img class="library-thumb" src={thumbFor(path)} alt="" />
              {:else}
                <div class="library-placeholder"></div>
              {/if}
              <div class="library-filename">{path.split(/[/\\]/).pop()}</div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
    {#if fileList.length === 0}
      <div class="library-empty">No files in this folder</div>
    {/if}
  </div>
</div>

<style>
  .library-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: var(--bg-primary, #1a1a1a);
    display: flex;
    flex-direction: column;
  }

  .library-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
  }

  .library-group {
    margin-bottom: 24px;
  }

  .library-group-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted, #888);
    font-family: var(--font-family);
    text-align: center;
    margin-bottom: 12px;
  }

  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }

  .library-cell {
    width: 160px;
    height: 160px;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    border: 2px solid transparent;
    transition: border-color 0.1s;
  }

  .library-cell:hover {
    border-color: var(--border-hover, #555);
  }

  .library-cell.active {
    border-color: var(--accent, #4a9eff);
  }

  .library-thumb {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
  }

  .library-placeholder {
    width: 100%;
    height: 140px;
    background: var(--bg-secondary, #2a2a2a);
  }

  .library-filename {
    font-size: 11px;
    color: var(--text-primary, #ccc);
    padding: 4px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: var(--bg-secondary, #2a2a2a);
    flex: 1;
    display: flex;
    align-items: center;
  }

  .library-empty {
    color: var(--text-secondary, #888);
    font-size: 14px;
    text-align: center;
    padding: 48px 0;
  }
</style>
