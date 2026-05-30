<script lang="ts">
  import Marquee from "$lib/shared/Marquee.svelte";

  let {
    src = null,
    color = "var(--green)",
    playing = false,
    onTogglePlay,
    size = "small",
    fileName = "",
    duration = "",
  }: {
    src: string | null;
    color: string;
    playing: boolean;
    onTogglePlay: () => void;
    size?: "small" | "large" | "xlarge";
    fileName?: string;
    duration?: string;
  } = $props();
</script>

<button
  class="album-cover"
  class:has-image={!!src}
  class:large={size === "large"}
  class:xlarge={size === "xlarge"}
  style={src ? "" : `--cover-placeholder-bg: ${color}`}
  onclick={onTogglePlay}
  aria-label="Play / Pause"
>
  {#if src}
    <img {src} alt="Album cover" draggable="false" />
  {:else if size === "xlarge"}
    <div class="album-cover-xlarge-placeholder">
      <svg
        class="album-cover-note"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      {#if fileName}
        <span class="album-cover-xlarge-filename"><Marquee text={fileName} class="album-marquee" /></span>
      {/if}
      {#if duration}
        <span class="album-cover-xlarge-duration">{duration}</span>
      {/if}
    </div>
  {:else}
    <svg
      class="album-cover-note"
      width={size === "large" ? "36" : "22"}
      height={size === "large" ? "36" : "22"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  {/if}
  <div class="album-cover-overlay">
    {#if playing}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <rect x="5" y="4" width="5" height="16" rx="1" />
        <rect x="14" y="4" width="5" height="16" rx="1" />
      </svg>
    {:else}
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <polygon points="6,3 20,12 6,21" />
      </svg>
    {/if}
  </div>
</button>

<style>
  .album-cover {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 4px;
    border: none;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--cover-placeholder-bg, var(--bg-elevated));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
  }
  .album-cover:hover {
    opacity: 0.85;
  }
  .album-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .album-cover:hover .album-cover-overlay {
    opacity: 1;
  }
  .album-cover-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 0.15s;
    color: var(--text-primary);
  }
  .album-cover-note {
    color: rgba(255, 255, 255, 0.6);
  }
  .album-cover.large {
    width: 120px;
    height: 120px;
    border-radius: 8px;
  }
  .album-cover.xlarge {
    width: 100%;
    height: 100%;
    border-radius: 8px;
  }
  .album-cover-xlarge-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.5);
  }
  .album-cover-xlarge-filename {
    font-size: 14px;
    font-family: var(--font-family);
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    max-width: 80%;
  }
  .album-cover-xlarge-duration {
    font-size: 12px;
    font-family: var(--font-family);
    color: var(--text-secondary);
  }
</style>
