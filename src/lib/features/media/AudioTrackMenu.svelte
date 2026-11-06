<script lang="ts">
  import type { MediaTrack } from "$lib/shared/types";

  let {
    open,
    onClose,
    tracks,
    selectedIndex,
    loading,
    catalogLoading,
    error,
    onSelect,
  }: {
    open: boolean;
    onClose: () => void;
    tracks: MediaTrack[];
    selectedIndex: number | null;
    loading: boolean;
    catalogLoading: boolean;
    error: string;
    onSelect: (index: number) => Promise<void>;
  } = $props();

  function trackTitle(track: MediaTrack, position: number): string {
    return (
      track.title || track.language?.toUpperCase() || `Track ${position + 1}`
    );
  }

  function trackDetails(track: MediaTrack): string {
    return [
      track.title && track.language ? track.language.toUpperCase() : "",
      track.channelLayout ||
        (track.channels ? `${track.channels} channels` : ""),
      track.codec?.toUpperCase() ?? "",
      track.isDefault ? "Default" : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function select(index: number) {
    await onSelect(index);
    if (!loading) onClose();
  }
</script>

{#if open}
  <div
    class="track-menu audio-track-menu"
    role="menu"
    aria-label="Audio tracks"
  >
    <div class="track-menu-heading">Audio track</div>
    {#if loading}
      <div class="track-menu-message" role="status">Preparing track…</div>
    {:else if catalogLoading}
      <div class="track-menu-message" role="status">Reading tracks…</div>
    {:else if error}
      <div class="track-menu-error" role="status">{error}</div>
    {:else if tracks.length === 0}
      <div class="track-menu-message">No audio tracks found</div>
    {:else}
      <div class="track-menu-options">
        {#each tracks as track, i (track.index)}
          <button
            type="button"
            class="track-menu-option"
            class:selected={selectedIndex === track.index}
            role="menuitemradio"
            aria-checked={selectedIndex === track.index}
            disabled={loading}
            onclick={() => void select(track.index)}
          >
            <span class="track-menu-check" aria-hidden="true">
              {#if selectedIndex === track.index}✓{/if}
            </span>
            <span class="track-menu-option-copy">
              <span class="track-menu-option-title">{trackTitle(track, i)}</span
              >
              {#if trackDetails(track)}
                <span class="track-menu-option-detail"
                  >{trackDetails(track)}</span
                >
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
