<script lang="ts">
  import { backgroundAudio } from "$lib/features/media/backgroundAudio.svelte";
</script>

<div class="now-playing-pill" role="status">
  <button
    class="now-playing-btn"
    onclick={() => backgroundAudio.toggle()}
    aria-label={backgroundAudio.playing ? "Pause audio" : "Play audio"}
    title={backgroundAudio.playing ? "Pause" : "Play"}
  >
    {#if backgroundAudio.playing}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    {:else}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    {/if}
  </button>
  <div class="now-playing-info">
    <span class="now-playing-label">Audio playing</span>
    <span class="now-playing-name">{backgroundAudio.name}</span>
  </div>
  <button
    class="now-playing-btn now-playing-close"
    onclick={() => backgroundAudio.stop()}
    aria-label="Stop audio"
    title="Stop"
  >
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  </button>
</div>

<style>
  .now-playing-pill {
    position: fixed;
    left: 14px;
    top: 52px;
    z-index: 950;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 260px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--bg-secondary);
    border: 0.5px solid var(--bg-border);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
    font-family: var(--font-family);
  }

  .now-playing-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 7px;
    background: var(--green-bg-default);
    color: var(--green);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .now-playing-btn:hover {
    background: var(--green-bg-active);
  }

  .now-playing-close {
    background: transparent;
    color: var(--text-muted);
  }

  .now-playing-close:hover {
    background: var(--red-bg-default);
    color: var(--red);
  }

  .now-playing-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .now-playing-label {
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-hint);
    line-height: 1;
  }

  .now-playing-name {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.2;
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
