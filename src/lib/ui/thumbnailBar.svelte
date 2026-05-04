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

  let trackEl = $state<HTMLDivElement | null>(null);

  const LIMIT = 20;
  const TOTAL_SLOTS = LIMIT * 2 + 1;

  const slots = $derived(
    Array.from({ length: TOTAL_SLOTS }, (_, i) => {
      const idx = currentIndex - LIMIT + i;
      if (idx >= 0 && idx < fileList.length) {
        return { path: fileList[idx], index: idx };
      }
      return null;
    }),
  );

  function isVideo(path: string): boolean {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return VIDEO_EXTS.includes(ext);
  }

  $effect(() => {
    if (visible && trackEl) {
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
</script>

{#if visible && fileList.length > 0}
  <div class="thumbnail-bar" class:fullscreen>
    <div class="thumbnail-track" bind:this={trackEl}>
      {#each slots as slot}
        {#if slot}
          {@const active = slot.index === currentIndex}
          {@const video = isVideo(slot.path)}
          <button
            class="thumbnail-item"
            class:active
            data-slot-active={active}
            onclick={() => onSelect(slot.index)}
            aria-label="Open file"
          >
            {#if video}
              <video
                src={convertFileSrc(slot.path)}
                muted
                preload="metadata"
              ></video>
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
                src={convertFileSrc(slot.path)}
                alt=""
                loading="lazy"
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
