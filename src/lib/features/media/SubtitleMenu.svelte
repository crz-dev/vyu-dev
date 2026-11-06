<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
  import { slide } from "svelte/transition";
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

  let settingsPanel = $state<"timing" | "size" | "nearby" | null>(null);
  let pendingId = $state<string | null>(null);

  const SIZE_STEPS: SubtitleSize[] = ["small", "default", "large"];

  $effect(() => {
    if (!open) {
      settingsPanel = null;
      pendingId = null;
    }
  });

  function togglePanel(panel: "timing" | "size" | "nearby") {
    settingsPanel = settingsPanel === panel ? null : panel;
  }

  function stepSize(delta: number) {
    const next = SIZE_STEPS[SIZE_STEPS.indexOf(size) + delta];
    if (next) onSetSize(next);
  }

  function sizeLabel(): string {
    return size[0].toUpperCase() + size.slice(1);
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
    if (id === "off") {
      await onSelect(id);
      return;
    }
    pendingId = id;
    try {
      await onSelect(id);
    } finally {
      pendingId = null;
    }
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
        <span class="track-menu-option-copy">
          <span class="track-menu-option-title">Off</span>
          {#if tracks.length === 0 && sidecars.length === 0 && !error}
            <span class="track-menu-option-detail">No subtitle track</span>
          {/if}
        </span>
      </button>

      {#each tracks as track, i (track.index)}
        <button
          type="button"
          class="track-menu-option"
          class:selected={selectedId === `embedded:${track.index}`}
          class:loading={pendingId === `embedded:${track.index}`}
          class:unsupported={!track.supported}
          role="menuitemradio"
          aria-checked={selectedId === `embedded:${track.index}`}
          aria-busy={pendingId === `embedded:${track.index}`}
          disabled={loading || !track.supported}
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
    </div>

    {#if catalogLoading}
      <div class="track-menu-message" role="status">Reading tracks…</div>
    {/if}
    {#if error}
      <div class="track-menu-error" role="status">{error}</div>
    {/if}

    <div class="track-menu-divider"></div>
    <div class="track-menu-actions" role="group" aria-label="Subtitle options">
      <button
        type="button"
        class="track-menu-icon-btn tooltip-ctrl"
        class:active={settingsPanel === "timing"}
        class:accent={delayMs !== 0}
        data-tooltip="Timing"
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
        class="track-menu-icon-btn tooltip-ctrl"
        class:active={settingsPanel === "size"}
        class:accent={size !== "default"}
        data-tooltip="Text size"
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
      <button
        type="button"
        class="track-menu-icon-btn tooltip-ctrl"
        class:active={settingsPanel === "nearby"}
        class:accent={selectedId.startsWith("sidecar:")}
        data-tooltip="Nearby files"
        aria-label="Nearby subtitle files"
        aria-expanded={settingsPanel === "nearby"}
        onclick={() => togglePanel("nearby")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="track-menu-icon-btn track-menu-add-btn add tooltip-ctrl"
        data-tooltip="Add subtitle"
        aria-label="Add subtitle"
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
        <span>Add subtitle</span>
      </button>
    </div>

    {#if settingsPanel}
      <div class="track-menu-subpanel" transition:slide={{ duration: 180 }}>
        {#if settingsPanel === "timing"}
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
            <div class="track-menu-card">
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
          <div class="track-menu-setting">
            <div class="track-menu-setting-head">
              <span class="track-menu-setting-label">Text size</span>
            </div>
            <div class="track-menu-card">
              <div class="track-menu-stepper">
                <button
                  type="button"
                  class="track-menu-small-button"
                  aria-label="Decrease subtitle text size"
                  disabled={size === "small"}
                  onclick={() => stepSize(-1)}>−</button
                >
                <span class="track-menu-delay">{sizeLabel()}</span>
                <button
                  type="button"
                  class="track-menu-small-button"
                  aria-label="Increase subtitle text size"
                  disabled={size === "large"}
                  onclick={() => stepSize(1)}>+</button
                >
              </div>
            </div>
          </div>
        {:else}
          <div class="track-menu-setting">
            <div class="track-menu-setting-head">
              <span class="track-menu-setting-label">Nearby files</span>
            </div>
            <div class="track-menu-card">
              {#if sidecars.length === 0}
                <div class="track-menu-subpanel-empty">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m6 6 12 12M18 6 6 18"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span>No nearby subtitle files</span>
                </div>
              {:else}
                <div class="track-menu-subpanel-list">
                  {#each sidecars as sidecar (sidecar.path)}
                    <button
                      type="button"
                      class="track-menu-option"
                      class:selected={selectedId === `sidecar:${sidecar.path}`}
                      class:loading={pendingId === `sidecar:${sidecar.path}`}
                      role="menuitemradio"
                      aria-checked={selectedId === `sidecar:${sidecar.path}`}
                      aria-busy={pendingId === `sidecar:${sidecar.path}`}
                      disabled={loading}
                      onclick={() => void select(`sidecar:${sidecar.path}`)}
                    >
                      <span class="track-menu-check" aria-hidden="true">
                        {#if selectedId === `sidecar:${sidecar.path}`}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
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
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
