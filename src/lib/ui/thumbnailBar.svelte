<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
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

  let barEl = $state<HTMLDivElement | null>(null);

  const start = $derived(Math.max(0, currentIndex - 5));
  const end = $derived(Math.min(fileList.length, currentIndex + 6));
  const visibleFiles = $derived(fileList.slice(start, end));

  function isVideo(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return VIDEO_EXTS.includes(ext);
  }

  $effect(() => {
    if (visible && barEl) {
      const el = barEl.querySelector(
        `[data-index="${currentIndex}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({
          inline: "center",
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  });
</script>

{#if visible && fileList.length > 0}
  <div class="thumbnail-bar" class:fullscreen bind:this={barEl}>
    {#each visibleFiles as path, i (path)}
      {@const realIndex = start + i}
      {@const active = realIndex === currentIndex}
      {@const video = isVideo(path)}
      <button
        class="thumbnail-item"
        class:active
        data-index={realIndex}
        onclick={() => onSelect(realIndex)}
        aria-label="Open file"
      >
        {#if video}
          <video src={convertFileSrc(path)} muted preload="metadata"></video>
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
            src={convertFileSrc(path)}
            alt=""
            loading="lazy"
            draggable="false"
          />
        {/if}
      </button>
    {/each}
  </div>
{/if}
