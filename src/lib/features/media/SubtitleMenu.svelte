<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
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

  let settingsPanel = $state<"timing" | "size" | null>(null);

  $effect(() => {
    if (!open) settingsPanel = null;
  });

  function togglePanel(panel: "timing" | "size") {
    settingsPanel = settingsPanel === panel ? null : panel;
  }

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
    <div class="track-menu-heading">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="3"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M7 14h4M13 14h4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      <span>Subtitles</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="3"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          d="M7 14h4M13 14h4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    </div>
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
          {#if selectedId === "off"}
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
        <span class="track-menu-option-title">Off</span>
      </button>

      {#if tracks.length > 0}
        <div class="track-menu-section-label">In this file</div>
      {/if}
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
            {#if selectedId === `embedded:${track.index}`}
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

      {#if sidecars.length > 0}
        <div class="track-menu-section-label">Nearby files</div>
      {/if}
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
            {#if selectedId === `sidecar:${sidecar.path}`}
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
          <Marquee
            text={sidecar.name}
            scrollOnHover
            class="track-menu-marquee"
          />
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
    <div class="track-menu-actions" role="group" aria-label="Subtitle options">
      <button
        type="button"
        class="track-menu-icon-btn"
        class:active={settingsPanel === "timing"}
        class:accent={delayMs !== 0}
        title="Timing"
        aria-label="Subtitle timing"
        aria-expanded={settingsPanel === "timing"}
        disabled={loading}
        onclick={() => togglePanel("timing")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <path
            d="M12 7v5l3 2"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="track-menu-icon-btn"
        class:active={settingsPanel === "size"}
        class:accent={size !== "default"}
        title="Text size"
        aria-label="Subtitle text size"
        aria-expanded={settingsPanel === "size"}
        onclick={() => togglePanel("size")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 19 11 5l6 14M7.5 14h7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="track-menu-actions-spacer"></span>
      <button
        type="button"
        class="track-menu-icon-btn add"
        title="Load subtitle file"
        aria-label="Load subtitle file"
        disabled={loading}
        onclick={() => void loadSubtitle()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    {#if settingsPanel === "timing"}
      <div class="track-menu-subpanel">
        <div class="track-menu-setting">
          <div class="track-menu-setting-head">
            <span class="track-menu-setting-label">Timing</span>
            <button
              type="button"
              class="track-menu-reset"
              disabled={selectedId === "off" || delayMs === 0 || loading}
              onclick={() => onAdjustDelay(-delayMs)}>Reset</button
            >
          </div>
          <div class="track-menu-stepper">
            <button
              type="button"
              class="track-menu-small-button"
              aria-label="Bring subtitles earlier by 0.25 seconds"
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
          </div>
        </div>
      </div>
    {:else if settingsPanel === "size"}
      <div class="track-menu-subpanel">
        <div class="track-menu-setting">
          <span class="track-menu-setting-label">Text size</span>
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
  </div>
{/if}
