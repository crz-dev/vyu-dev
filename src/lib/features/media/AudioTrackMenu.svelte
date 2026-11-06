<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
  import type { MediaTrack } from "$lib/shared/types";

  let {
    open,
    tracks,
    selectedIndex,
    loading,
    catalogLoading,
    error,
    onSelect,
  }: {
    open: boolean;
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
  }
</script>

{#if open}
  <div
    class="track-menu audio-track-menu"
    role="menu"
    aria-label="Audio tracks"
  >
    <div class="track-menu-heading">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 10v4M9 7v10M15 7v10M19 10v4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      <span>Audio track</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 10v4M9 7v10M15 7v10M19 10v4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    </div>
    {#if loading}
      <div class="track-menu-message" role="status">Preparing track…</div>
    {:else if catalogLoading}
      <div class="track-menu-message" role="status">Reading tracks…</div>
    {:else if error}
      <div class="track-menu-error" role="status">{error}</div>
    {:else}
      <div class="track-menu-options">
        {#if tracks.length === 0}
          <div
            class="track-menu-option selected track-menu-option-static"
            role="presentation"
          >
            <span class="track-menu-check" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="m3 8 3.2 3.2L13 4.8"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="track-menu-option-copy">
              <span class="track-menu-option-title">Off</span>
              <span class="track-menu-option-detail">No audio track</span>
            </span>
          </div>
        {:else}
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
                {#if selectedIndex === track.index}
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path
                      d="m3 8 3.2 3.2L13 4.8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                {/if}
              </span>
              <span class="track-menu-option-copy">
                <Marquee
                  text={trackTitle(track, i)}
                  scrollOnHover
                  class="track-menu-marquee"
                />
                {#if trackDetails(track)}
                  <span class="track-menu-option-detail"
                    >{trackDetails(track)}</span
                  >
                {/if}
              </span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
{/if}
