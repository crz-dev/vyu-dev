<script lang="ts">
  import type { MediaTrack, SubtitleSidecar } from "$lib/shared/types";
  import type { SubtitleSize } from "$lib/features/media/tracks.svelte";

  let {
    open,
    onClose,
    tracks,
    sidecars,
    selectedId,
    loading,
    catalogLoading,
    error,
    delayMs,
    size,
    onSelect,
    onLoadSubtitle,
    onAdjustDelay,
    onSetSize,
  }: {
    open: boolean;
    onClose: () => void;
    tracks: MediaTrack[];
    sidecars: SubtitleSidecar[];
    selectedId: string;
    loading: boolean;
    catalogLoading: boolean;
    error: string;
    delayMs: number;
    size: SubtitleSize;
    onSelect: (id: string) => Promise<void>;
    onLoadSubtitle: () => Promise<void>;
    onAdjustDelay: (deltaMs: number) => void;
    onSetSize: (size: SubtitleSize) => void;
  } = $props();

  function trackTitle(track: MediaTrack, position: number): string {
    return (
      track.title || track.language?.toUpperCase() || `Subtitle ${position + 1}`
    );
  }

  function delayLabel(): string {
    const seconds = Math.abs(delayMs) / 1000;
    return `${delayMs > 0 ? "+" : delayMs < 0 ? "−" : ""}${seconds.toFixed(2)}s`;
  }

  async function select(id: string) {
    await onSelect(id);
    if (!loading) onClose();
  }

  async function loadSubtitle() {
    await onLoadSubtitle();
    if (!loading) onClose();
  }
</script>

{#if open}
  <div class="track-menu subtitle-menu" role="menu" aria-label="Subtitles">
    <div class="track-menu-heading">Subtitles</div>
    <div class="track-menu-options">
      <button
        type="button"
        class="track-menu-option"
        class:selected={selectedId === "off"}
        role="menuitemradio"
        aria-checked={selectedId === "off"}
        disabled={loading}
        onclick={() => void select("off")}
      >
        <span class="track-menu-check" aria-hidden="true">
          {#if selectedId === "off"}✓{/if}
        </span>
        <span class="track-menu-option-title">Off</span>
      </button>

      {#each tracks as track, i (track.index)}
        <button
          type="button"
          class="track-menu-option"
          class:selected={selectedId === `embedded:${track.index}`}
          class:unsupported={!track.supported}
          role="menuitemradio"
          aria-checked={selectedId === `embedded:${track.index}`}
          disabled={loading || !track.supported}
          title={track.supported
            ? undefined
            : "Image-based subtitles are not supported yet"}
          onclick={() => void select(`embedded:${track.index}`)}
        >
          <span class="track-menu-check" aria-hidden="true">
            {#if selectedId === `embedded:${track.index}`}✓{/if}
          </span>
          <span class="track-menu-option-copy">
            <span class="track-menu-option-title">{trackTitle(track, i)}</span>
            {#if !track.supported}
              <span class="track-menu-option-detail"
                >Image subtitles unavailable</span
              >
            {:else if track.codec || (track.title && track.language)}
              <span class="track-menu-option-detail">
                {[
                  track.title && track.language
                    ? track.language.toUpperCase()
                    : "",
                  track.codec?.toUpperCase() ?? "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            {/if}
          </span>
        </button>
      {/each}

      {#each sidecars as sidecar (sidecar.path)}
        <button
          type="button"
          class="track-menu-option"
          class:selected={selectedId === `sidecar:${sidecar.path}`}
          role="menuitemradio"
          aria-checked={selectedId === `sidecar:${sidecar.path}`}
          disabled={loading}
          onclick={() => void select(`sidecar:${sidecar.path}`)}
        >
          <span class="track-menu-check" aria-hidden="true">
            {#if selectedId === `sidecar:${sidecar.path}`}✓{/if}
          </span>
          <span class="track-menu-option-title">{sidecar.name}</span>
        </button>
      {/each}
    </div>

    {#if loading}
      <div class="track-menu-message" role="status">Loading subtitles…</div>
    {:else if catalogLoading}
      <div class="track-menu-message" role="status">Reading tracks…</div>
    {:else if tracks.length === 0 && sidecars.length === 0 && !error}
      <div class="track-menu-message">No subtitle tracks found</div>
    {/if}
    {#if error}
      <div class="track-menu-error" role="status">{error}</div>
    {/if}

    <div class="track-menu-divider"></div>
    <button
      type="button"
      class="track-menu-action"
      disabled={loading}
      onclick={() => void loadSubtitle()}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      Load subtitle file…
    </button>

    <div class="track-menu-divider"></div>
    <div class="track-menu-setting">
      <span>Timing</span>
      <button
        type="button"
        class="track-menu-small-button"
        aria-label="Delay subtitles by 0.25 seconds"
        disabled={selectedId === "off" || loading}
        onclick={() => onAdjustDelay(-250)}>−0.25</button
      >
      <span class="track-menu-delay">{delayLabel()}</span>
      <button
        type="button"
        class="track-menu-small-button"
        aria-label="Delay subtitles by 0.25 seconds"
        disabled={selectedId === "off" || loading}
        onclick={() => onAdjustDelay(250)}>+0.25</button
      >
      <button
        type="button"
        class="track-menu-reset"
        disabled={selectedId === "off" || delayMs === 0 || loading}
        onclick={() => onAdjustDelay(-delayMs)}>Reset</button
      >
    </div>
    <div class="track-menu-setting">
      <span>Text size</span>
      <div
        class="track-menu-size-options"
        role="group"
        aria-label="Subtitle text size"
      >
        {#each ["small", "default", "large"] as option}
          <button
            type="button"
            class="track-menu-size-button"
            class:selected={size === option}
            aria-pressed={size === option}
            onclick={() => onSetSize(option as SubtitleSize)}
          >
            {option === "default"
              ? "Default"
              : option[0].toUpperCase() + option.slice(1)}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
