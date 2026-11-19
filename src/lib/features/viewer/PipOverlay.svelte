<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { pip } from "./pip.svelte";

  const t = locale.t;

  let {
    fileName,
    currentIndex,
    fileListLength,
    isVideo,
    isAudio,
    isPdf,
    isGifVideo,
    playing,
    progress,
    currentTimeDisplay,
    durationDisplay,
    isScrubbing,
    coverArtSrc,
    cdColor,
    navigate,
    togglePlay,
    startScrubbing,
  }: {
    fileName: string;
    currentIndex: number;
    fileListLength: number;
    isVideo: boolean;
    isAudio: boolean;
    isPdf: boolean;
    isGifVideo: boolean;
    playing: boolean;
    progress: number;
    currentTimeDisplay: () => string;
    durationDisplay: string;
    isScrubbing: boolean;
    coverArtSrc: string;
    cdColor: string;
    navigate: (delta: number) => void;
    togglePlay: () => void;
    startScrubbing: (e: MouseEvent) => void;
  } = $props();

  const canNavigate = $derived(fileListLength > 1);
  const positionLabel = $derived(
    fileListLength > 0 ? `${currentIndex + 1} / ${fileListLength}` : "",
  );
  const showTimedBar = $derived(isVideo && !isGifVideo);
  const audioBackdrop = $derived(
    coverArtSrc
      ? `background-image: url(${JSON.stringify(coverArtSrc)});`
      : `background: ${cdColor};`,
  );

  function onFocusIn(e: FocusEvent) {
    const target = e.target;
    if (target instanceof HTMLElement && target.matches(":focus-visible")) {
      pip.setControlsPinned(true);
    }
  }

  function onFocusOut(e: FocusEvent) {
    const next = e.relatedTarget;
    if (!(next instanceof Node) || !e.currentTarget) {
      pip.setControlsPinned(false);
      return;
    }
    if (!(e.currentTarget as HTMLElement).contains(next)) {
      pip.setControlsPinned(false);
    }
  }

  function startWindowDrag(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  }

  function beginScrub(e: MouseEvent) {
    pip.showControls();
    startScrubbing(e);
  }
</script>

<div
  class="pip-overlay"
  class:controls-visible={pip.state.controlsVisible}
  class:audio={isAudio}
  class:pdf={isPdf}
  class:reduced-motion={appearance.reducedMotion}
  onfocusin={onFocusIn}
  onfocusout={onFocusOut}
  onmouseenter={() => pip.showControls()}
  onmouseleave={() => pip.hideControlsSoon(420)}
  role="presentation"
>
  {#if isAudio}
    <div class="pip-audio-stage">
      <div class="pip-audio-backdrop" style={audioBackdrop}></div>
      <div class="pip-audio-scrim"></div>
      <button
        class="pip-audio-art"
        class:playing
        onclick={togglePlay}
        aria-label={playing
          ? t("media.playback.pauseAria")
          : t("media.playback.playAria")}
      >
        {#if coverArtSrc}
          <img src={coverArtSrc} alt="" draggable="false" />
        {:else}
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        {/if}
        <span class="pip-audio-art-badge" aria-hidden="true">
          {#if playing}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          {:else}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1.6v8.8L10 6z" />
            </svg>
          {/if}
        </span>
      </button>

      <div class="pip-audio-body">
        <div class="pip-audio-heading">
          <div class="pip-audio-title">
            <Marquee text={fileName} scrollOnHover class="pip-audio-marquee" />
          </div>
          {#if positionLabel}
            <span class="pip-file-position">{positionLabel}</span>
          {/if}
        </div>

        <div
          class="pip-audio-progress"
          class:scrubbing={isScrubbing}
          onmousedown={beginScrub}
          role="slider"
          aria-label={t("shell.viewer.pip.progress")}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress)}
          tabindex="-1"
        >
          <div class="pip-progress-fill" style="width: {progress}%"></div>
          <div class="pip-progress-knob" style="left: {progress}%"></div>
        </div>

        <div class="pip-audio-row">
          <span class="pip-time">{currentTimeDisplay()}</span>
          <div class="pip-audio-buttons">
            <button
              class="pip-icon-btn"
              disabled={!canNavigate}
              onclick={() => navigate(-1)}
              aria-label={t("shell.viewer.pip.previous")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 20L9 12l10-8v16zM5 19V5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              class="pip-play-btn"
              onclick={togglePlay}
              aria-label={playing
                ? t("media.playback.pauseAria")
                : t("media.playback.playAria")}
            >
              {#if playing}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <rect x="2" y="1.5" width="3" height="9" rx="1" />
                  <rect x="7" y="1.5" width="3" height="9" rx="1" />
                </svg>
              {:else}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M3 1.6v8.8L10 6z" />
                </svg>
              {/if}
            </button>
            <button
              class="pip-icon-btn"
              disabled={!canNavigate}
              onclick={() => navigate(1)}
              aria-label={t("shell.viewer.pip.next")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 4l10 8-10 8V4zM19 5v14"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          <span class="pip-time">{durationDisplay}</span>
        </div>
      </div>
    </div>
  {:else}
    <div
      class="pip-top pip-fade"
      role="toolbar"
      aria-label={fileName}
      tabindex="-1"
      onmousedown={isPdf ? startWindowDrag : undefined}
    >
      <span class="pip-file-chip">
        <span class="pip-file-name">{fileName}</span>
        {#if positionLabel}
          <span class="pip-file-position">{positionLabel}</span>
        {/if}
      </span>
    </div>

    {#if showTimedBar}
      <div class="pip-bar pip-fade">
        <button
          class="pip-play-btn"
          onclick={togglePlay}
          aria-label={playing
            ? t("media.playback.pauseAria")
            : t("media.playback.playAria")}
        >
          {#if playing}
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1.6v8.8L10 6z" />
            </svg>
          {/if}
        </button>
        <span class="pip-time">{currentTimeDisplay()}</span>
        <div
          class="pip-progress"
          class:scrubbing={isScrubbing}
          onmousedown={beginScrub}
          role="slider"
          aria-label={t("shell.viewer.pip.progress")}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress)}
          tabindex="-1"
        >
          <div class="pip-progress-fill" style="width: {progress}%"></div>
          <div class="pip-progress-knob" style="left: {progress}%"></div>
        </div>
        <span class="pip-time">{durationDisplay}</span>
      </div>
    {:else if isVideo && isGifVideo}
      <div class="pip-bar pip-bar-compact pip-fade">
        <button
          class="pip-play-btn"
          onclick={togglePlay}
          aria-label={playing
            ? t("media.playback.pauseGifAria")
            : t("media.playback.playGifAria")}
        >
          {#if playing}
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 1.6v8.8L10 6z" />
            </svg>
          {/if}
        </button>
      </div>
    {/if}

    {#if isPdf}
      <span class="pip-pdf-hint pip-fade">{t("shell.viewer.pip.scroll")}</span>
    {/if}
  {/if}

  {#if canNavigate && !isAudio}
    <button
      class="pip-nav pip-nav-left pip-fade"
      onclick={() => navigate(-1)}
      aria-label={t("shell.viewer.pip.previous")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <button
      class="pip-nav pip-nav-right pip-fade"
      onclick={() => navigate(1)}
      aria-label={t("shell.viewer.pip.next")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 18l6-6-6-6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/if}

  <button
    class="pip-exit pip-fade"
    onclick={() => void pip.exit()}
    aria-label={t("shell.viewer.pip.exit")}
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx="2.5"
        stroke="currentColor"
        stroke-width="1.4"
      />
      <path
        d="M6 10l4-4M6.4 6H10v3.6"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</div>
