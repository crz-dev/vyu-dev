<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
  import { slide } from "svelte/transition";
  import { TS_DROP_ANIM_DELAYS_MS } from "$lib/features/menus/dropAnimations";
  import { menuOut } from "$lib/features/menus/menuTransition";
  import type {
    MediaTrack,
    SubtitleBackground,
    SubtitleOutline,
    SubtitlePreset,
    SubtitleSidecar,
    SubtitleSize,
    SubtitleStyleSettings,
  } from "$lib/shared/types";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

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
    subtitleStyle,
    onSelect,
    onLoadSubtitle,
    onAdjustDelay,
    onSetSize,
    onSetPreset,
    onSetFont,
    onSetColor,
    onSetOutline,
    onSetBackground,
    onResetPosition,
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
    subtitleStyle: SubtitleStyleSettings;
    onSelect: (id: string) => Promise<void>;
    onLoadSubtitle: () => Promise<void>;
    onAdjustDelay: (deltaMs: number) => void;
    onSetSize: (size: SubtitleSize) => void;
    onSetPreset: (preset: SubtitlePreset) => void;
    onSetFont: (font: string) => void;
    onSetColor: (color: string) => void;
    onSetOutline: (outline: SubtitleOutline) => void;
    onSetBackground: (background: SubtitleBackground) => void;
    onResetPosition: () => void;
  } = $props();

  let settingsPanel = $state<"timing" | "text" | "nearby" | null>(null);
  let pendingId = $state<string | null>(null);

  const SIZE_STEPS: SubtitleSize[] = ["small", "default", "large"];
  const FONTS = [
    "",
    "Segoe UI",
    "Arial",
    "Calibri",
    "Verdana",
    "Tahoma",
    "Georgia",
    "Times New Roman",
    "Consolas",
  ];
  const PRESETS: Array<{
    id: SubtitlePreset;
    key: string;
  }> = [
    { id: "default", key: "media.subtitles.sizeDefault" },
    { id: "highContrast", key: "media.subtitles.highContrast" },
    { id: "yellow", key: "media.subtitles.yellow" },
  ];

  $effect(() => {
    if (!open) {
      settingsPanel = null;
      pendingId = null;
    }
  });

  function togglePanel(panel: "timing" | "text" | "nearby") {
    settingsPanel = settingsPanel === panel ? null : panel;
  }

  function stepSize(delta: number) {
    const next = SIZE_STEPS[SIZE_STEPS.indexOf(subtitleStyle.size) + delta];
    if (next) onSetSize(next);
  }

  function toggleFileStyles() {
    onSetPreset(subtitleStyle.useFileStyles ? "custom" : "fileStyles");
  }

  function previewStyle(): string {
    const font = subtitleStyle.fontFamily
      ? `"${subtitleStyle.fontFamily}", var(--font-family)`
      : "var(--font-family)";
    const outline =
      subtitleStyle.outline === "none"
        ? "none"
        : subtitleStyle.outline === "thick"
          ? "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
          : "0.5px 0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px -0.5px 0 #000";
    const background =
      subtitleStyle.background === "none"
        ? "transparent"
        : subtitleStyle.background === "solid"
          ? "rgba(0, 0, 0, 0.88)"
          : "rgba(0, 0, 0, 0.68)";
    const size =
      subtitleStyle.size === "small"
        ? 11
        : subtitleStyle.size === "large"
          ? 15
          : 13;
    return `font-family:${font};color:${subtitleStyle.textColor};text-shadow:${outline};background:${background};font-size:${size}px;`;
  }

  function sizeLabel(): string {
    const key =
      subtitleStyle.size === "small"
        ? "media.subtitles.sizeSmall"
        : subtitleStyle.size === "large"
          ? "media.subtitles.sizeLarge"
          : "media.subtitles.sizeDefault";
    return t(key);
  }

  function trackTitle(track: MediaTrack, position: number): string {
    return (
      track.title ||
      track.language?.toUpperCase() ||
      t("media.subtitles.subtitleN", { n: position + 1 })
    );
  }

  function bitmapCodecLabel(track: MediaTrack): string {
    switch (track.codec) {
      case "hdmv_pgs_subtitle":
        return "PGS";
      case "dvd_subtitle":
        return "DVD";
      case "vobsub":
        return "VobSub";
      default:
        return track.codec?.toUpperCase() ?? "";
    }
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

  function animStyle(index: number): string {
    const delay =
      TS_DROP_ANIM_DELAYS_MS[
        Math.min(index, TS_DROP_ANIM_DELAYS_MS.length - 1)
      ];
    return `animation: tsDropItemPopIn 200ms cubic-bezier(0.22, 0.8, 0.3, 1) backwards; animation-delay: ${delay}ms`;
  }
</script>

{#if open}
  <div
    class="track-menu subtitle-menu"
    role="menu"
    aria-label={t("media.subtitles.aria")}
    out:menuOut={{ y: 8, scale: 0.9, duration: 220 }}
  >
    <div class="track-menu-heading" style={animStyle(0)}>
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
      <span>{t("media.subtitles.heading")}</span>
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
    <div class="edit-menu-card" style={animStyle(1)}>
      <div class="track-menu-options">
        <button
          type="button"
          class="track-menu-option"
          class:selected={selectedId === "off"}
          role="menuitemradio"
          aria-checked={selectedId === "off"}
          disabled={loading}
          onclick={() => void select("off")}
          style={animStyle(2)}
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
            <span class="track-menu-option-title"
              >{t("media.subtitles.off")}</span
            >
            {#if tracks.length === 0 && sidecars.length === 0 && !error}
              <span class="track-menu-option-detail"
                >{t("media.subtitles.none")}</span
              >
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
            style={animStyle(i + 3)}
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
                  >{t("media.subtitles.unavailable")}</span
                >
              {:else if track.bitmap}
                <span class="track-menu-option-detail">
                  {[t("media.subtitles.image"), bitmapCodecLabel(track)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
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
    </div>

    {#if catalogLoading}
      <div class="track-menu-message" style={animStyle(1)} role="status">
        {t("media.tracks.reading")}
      </div>
    {/if}
    {#if loading}
      <div class="track-menu-message" style={animStyle(1)} role="status">
        {t("media.subtitles.preparing")}
      </div>
    {/if}
    {#if error}
      <div class="track-menu-error" style={animStyle(1)} role="status">
        {error}
      </div>
    {/if}

    <div class="track-menu-divider" style={animStyle(tracks.length + 3)}></div>
    <div
      class="track-menu-actions"
      role="group"
      aria-label={t("media.subtitles.optionsAria")}
      style={animStyle(tracks.length + 3)}
    >
      <button
        type="button"
        class="track-menu-icon-btn tooltip-ctrl"
        class:active={settingsPanel === "timing"}
        class:accent={delayMs !== 0}
        data-tooltip={t("media.subtitles.timing")}
        aria-label={t("media.subtitles.timingAria")}
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
        class:active={settingsPanel === "text"}
        class:accent={subtitleStyle.size !== "default" ||
          subtitleStyle.preset !== "fileStyles"}
        data-tooltip={t("media.subtitles.textStyle")}
        aria-label={t("media.subtitles.textStyleAria")}
        aria-expanded={settingsPanel === "text"}
        onclick={() => togglePanel("text")}
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
        data-tooltip={t("media.subtitles.nearby")}
        aria-label={t("media.subtitles.nearbyAria")}
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
        data-tooltip={t("media.subtitles.add")}
        aria-label={t("media.subtitles.add")}
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
        <span>{t("media.subtitles.add")}</span>
      </button>
    </div>

    {#if settingsPanel}
      <div class="track-menu-subpanel" transition:slide={{ duration: 180 }}>
        {#if settingsPanel === "timing"}
          <div class="track-menu-setting">
            <div class="track-menu-setting-head">
              <span class="track-menu-setting-label"
                >{t("media.subtitles.timing")}</span
              >
              <button
                type="button"
                class="track-menu-reset"
                disabled={selectedId === "off" || delayMs === 0 || loading}
                onclick={() => onAdjustDelay(-delayMs)}
                >{t("media.subtitles.reset")}</button
              >
            </div>
            <div class="track-menu-card">
              <div class="track-menu-stepper">
                <button
                  type="button"
                  class="track-menu-small-button"
                  aria-label={t("media.subtitles.delayEarlier")}
                  disabled={selectedId === "off" || loading}
                  onclick={() => onAdjustDelay(-250)}>−0.25</button
                >
                <span class="track-menu-delay">{delayLabel()}</span>
                <button
                  type="button"
                  class="track-menu-small-button"
                  aria-label={t("media.subtitles.delayLater")}
                  disabled={selectedId === "off" || loading}
                  onclick={() => onAdjustDelay(250)}>+0.25</button
                >
              </div>
            </div>
          </div>
        {:else if settingsPanel === "text"}
          <div class="track-menu-setting">
            <div class="track-menu-setting-head subtitle-style-head">
              <span class="track-menu-setting-label"
                >{t("media.subtitles.textStyle")}</span
              >
              <button
                type="button"
                class="track-menu-reset"
                aria-label={t("media.subtitles.resetPosition")}
                title={t("media.subtitles.resetPosition")}
                onclick={onResetPosition}>{t("media.subtitles.reset")}</button
              >
            </div>

            <div class="track-menu-field subtitle-size-row">
              <span>{t("media.subtitles.size")}</span>
              <div class="track-menu-stepper">
                <button
                  type="button"
                  class="track-menu-small-button"
                  aria-label={t("media.subtitles.sizeDecrease")}
                  disabled={subtitleStyle.size === "small"}
                  onclick={() => stepSize(-1)}>−</button
                >
                <span class="track-menu-delay">{sizeLabel()}</span>
                <button
                  type="button"
                  class="track-menu-small-button"
                  aria-label={t("media.subtitles.sizeIncrease")}
                  disabled={subtitleStyle.size === "large"}
                  onclick={() => stepSize(1)}>+</button
                >
              </div>
            </div>

            <div class="track-menu-field subtitle-style-toggle">
              <span>{t("media.subtitles.fileStyles")}</span>
              <button
                type="button"
                class="subtitle-toggle"
                role="switch"
                aria-checked={subtitleStyle.useFileStyles}
                aria-label={t("media.subtitles.fileStyles")}
                onclick={toggleFileStyles}
              >
                <span
                  class="toggle-track"
                  class:on={subtitleStyle.useFileStyles}
                  ><span class="toggle-thumb"></span></span
                >
              </button>
            </div>

            {#if !subtitleStyle.useFileStyles}
              <div
                class="track-menu-presets"
                role="group"
                aria-label={t("media.subtitles.textStyle")}
              >
                {#each PRESETS as preset (preset.id)}
                  <button
                    type="button"
                    class="track-menu-small-button preset"
                    class:active={subtitleStyle.preset === preset.id}
                    aria-pressed={subtitleStyle.preset === preset.id}
                    title={t(preset.key)}
                    onclick={() => onSetPreset(preset.id)}
                    >{t(preset.key)}</button
                  >
                {/each}
              </div>

              <div
                class="subtitle-style-preview"
                style={previewStyle()}
                aria-hidden="true"
              >
                {t("media.subtitles.preview")}
              </div>

              <label class="track-menu-field">
                <span>{t("media.subtitles.font")}</span>
                <select
                  class="track-menu-select"
                  value={subtitleStyle.fontFamily}
                  onchange={(event) =>
                    onSetFont((event.currentTarget as HTMLSelectElement).value)}
                >
                  {#each FONTS as font (font)}
                    <option value={font}
                      >{font || t("media.subtitles.fontSystem")}</option
                    >
                  {/each}
                </select>
              </label>
              <label class="track-menu-field">
                <span>{t("media.subtitles.textColor")}</span>
                <input
                  class="track-menu-color"
                  type="color"
                  value={subtitleStyle.textColor}
                  oninput={(event) =>
                    onSetColor((event.currentTarget as HTMLInputElement).value)}
                />
              </label>
              <label class="track-menu-field">
                <span>{t("media.subtitles.outline")}</span>
                <select
                  class="track-menu-select"
                  value={subtitleStyle.outline}
                  onchange={(event) =>
                    onSetOutline(
                      (event.currentTarget as HTMLSelectElement)
                        .value as SubtitleOutline,
                    )}
                >
                  <option value="none">{t("common.none")}</option>
                  <option value="thin"
                    >{t("media.subtitles.outlineThin")}</option
                  >
                  <option value="thick"
                    >{t("media.subtitles.outlineThick")}</option
                  >
                </select>
              </label>
              <label class="track-menu-field">
                <span>{t("media.subtitles.background")}</span>
                <select
                  class="track-menu-select"
                  value={subtitleStyle.background}
                  onchange={(event) =>
                    onSetBackground(
                      (event.currentTarget as HTMLSelectElement)
                        .value as SubtitleBackground,
                    )}
                >
                  <option value="none">{t("common.none")}</option>
                  <option value="soft"
                    >{t("media.subtitles.backgroundSoft")}</option
                  >
                  <option value="solid"
                    >{t("media.subtitles.backgroundSolid")}</option
                  >
                </select>
              </label>
            {/if}
          </div>
        {:else}
          <div class="track-menu-setting">
            <div class="track-menu-setting-head">
              <span class="track-menu-setting-label"
                >{t("media.subtitles.nearby")}</span
              >
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
                  <span>{t("media.subtitles.noneNearby")}</span>
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
                      <span class="track-menu-option-copy">
                        <Marquee
                          text={sidecar.name}
                          scrollOnHover
                          class="track-menu-marquee"
                        />
                        {#if sidecar.bitmap}
                          <span class="track-menu-option-detail"
                            >{t("media.subtitles.image")}</span
                          >
                        {/if}
                      </span>
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
