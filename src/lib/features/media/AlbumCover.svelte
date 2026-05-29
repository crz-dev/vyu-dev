<script lang="ts">
  let {
    src = null,
    color = "var(--green)",
    onChange,
  }: {
    src: string | null;
    color: string;
    onChange: () => void;
  } = $props();
</script>

<button
  class="album-cover"
  class:has-image={!!src}
  style={src ? "" : `--cover-placeholder-bg: ${color}`}
  onclick={onChange}
  aria-label="Album cover — click to change"
>
  {#if src}
    <img {src} alt="Album cover" draggable="false" />
    <div class="album-cover-overlay">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    </div>
  {:else}
    <svg class="album-cover-note" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  {/if}
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
  .album-cover.has-image:hover .album-cover-overlay {
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
</style>
