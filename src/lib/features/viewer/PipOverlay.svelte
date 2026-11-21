<script lang="ts">
  import Marquee from "$lib/components/Marquee.svelte";
  import { fly } from "svelte/transition";
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
    volume,
    muted,
    navigate,
    togglePlay,
    startScrubbing,
    setVolume,
    toggleMute,
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
    volume: number;
    muted: boolean;
    navigate: (delta: number) => void;
    togglePlay: () => void;
    startScrubbing: (e: MouseEvent) => void;
    setVolume: (value: number) => void;
    toggleMute: () => void;
  } = $props();

  const canNavigate = $derived(fileListLength > 1);
  const positionLabel = $derived(
    fileListLength > 0 ? `${currentIndex + 1} / ${fileListLength}` : "",
  );
  const showTimedBar = $derived(isVideo && !isGifVideo);
  const fitLabel = $derived(
    isVideo
      ? t("shell.viewer.pip.fitVideo")
      : isAudio
        ? t("shell.viewer.pip.fitAudio")
        : isPdf
          ? t("shell.viewer.pip.fitPdf")
          : t("shell.viewer.pip.fitImage"),
  );
  const volumePercent = $derived(
    Math.round(Math.max(0, Math.min(1, muted ? 0 : volume)) * 100),
  );
  const silent = $derived(muted || volume === 0);
  let volumeOpen = $state(false);
  let volumeDragging = $state(false);
  let volumeHovered = false;
  let volumeCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let volumeTrackEl = $state<HTMLDivElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let menuX = $state(0);
  let menuY = $state(0);

  $effect(() => {
    if (!pip.state.menuOpen) return;
    menuX = pip.state.menuX;
    menuY = pip.state.menuY;
  });

  $effect(() => {
    if (!pip.state.menuOpen) return;
    const el = menuEl;
    if (!el) return;
    const maxX = Math.max(8, window.innerWidth - el.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - el.offsetHeight - 8);
    menuX = Math.max(8, Math.min(pip.state.menuX, maxX));
    menuY = Math.max(8, Math.min(pip.state.menuY, maxY));
  });

  $effect(() => {
    if (!pip.state.menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuEl?.contains(e.target as Node)) return;
      pip.closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      pip.closeMenu();
    };
    const onBlur = () => pip.closeMenu();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
    };
  });

  $effect(() => {
    if (!pip.state.controlsVisible && volumeOpen) {
      volumeOpen = false;
      clearTimeout(volumeCloseTimer);
    }
  });

  $effect(() => {
    if (!(isVideo || isAudio) && volumeOpen) {
      volumeOpen = false;
      clearTimeout(volumeCloseTimer);
      pip.setControlsPinned(false);
    }
  });
  const audioBackdrop = $derived(
    coverArtSrc
      ? `background-image: url(${JSON.stringify(coverArtSrc)});`
      : "background: linear-gradient(135deg, #32363c, #17191d 58%, #0b0c0e);",
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
    if ((e.target as HTMLElement).closest("button, .pip-volume")) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  }

  function beginScrub(e: MouseEvent) {
    pip.showControls();
    startScrubbing(e);
  }

  function openVolumePanel() {
    clearTimeout(volumeCloseTimer);
    volumeHovered = true;
    volumeOpen = true;
    pip.setControlsPinned(true);
  }

  function scheduleCloseVolumePanel() {
    volumeHovered = false;
    if (volumeDragging) return;
    clearTimeout(volumeCloseTimer);
    volumeCloseTimer = setTimeout(() => {
      volumeOpen = false;
      pip.setControlsPinned(false);
    }, 240);
  }

  function onVolumeFocusOut(e: FocusEvent) {
    const next = e.relatedTarget;
    if (
      next instanceof Node &&
      e.currentTarget instanceof HTMLElement &&
      e.currentTarget.contains(next)
    ) {
      return;
    }
    scheduleCloseVolumePanel();
  }

  function setVolumeFromClientY(clientY: number) {
    const el = volumeTrackEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    setVolume(Math.max(0, Math.min(1, ratio)));
  }

  function startVolumeDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    volumeDragging = true;
    openVolumePanel();
    setVolumeFromClientY(e.clientY);
    const onMove = (ev: PointerEvent) => setVolumeFromClientY(ev.clientY);
    const onUp = () => {
      volumeDragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!volumeHovered) scheduleCloseVolumePanel();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onVolumeKey(e: KeyboardEvent) {
    const step = 0.05;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      setVolume(Math.min(1, volume + step));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      setVolume(Math.max(0, volume - step));
    }
  }
</script>

<div
  class="pip-overlay"
  class:controls-visible={pip.state.controlsVisible}
  class:entering={pip.state.phase === "entering"}
  class:moving={pip.state.phase === "moving"}
  class:exiting={pip.state.phase === "exiting"}
  class:returning={pip.state.phase === "returning"}
  class:expanding={pip.state.phase === "expanding"}
  class:audio={isAudio}
  class:pdf={isPdf}
  class:bar={showTimedBar || (isVideo && isGifVideo)}
  class:reduced-motion={appearance.reducedMotion}
  onfocusin={onFocusIn}
  onfocusout={onFocusOut}
  onmouseenter={() => pip.showControls()}
  onmouseleave={() => pip.hideControlsSoon(420)}
  role="presentation"
>
  <div
    class="pip-top pip-fade"
    role="toolbar"
    aria-label={fileName}
    tabindex="-1"
    onmousedown={isPdf ? startWindowDrag : undefined}
  >
    {#if !isAudio}
      <span class="pip-file-chip">
        <span class="pip-file-name">{fileName}</span>
        {#if positionLabel}
          <span class="pip-file-position">{positionLabel}</span>
        {/if}
      </span>
    {/if}

    <div class="pip-top-controls">
      {#if isVideo || isAudio}
        <div
          class="pip-volume"
          class:open={volumeOpen}
          role="group"
          aria-label={t("media.bar.volumeControlsAria")}
          onpointerenter={openVolumePanel}
          onpointerleave={scheduleCloseVolumePanel}
          onfocusin={openVolumePanel}
          onfocusout={onVolumeFocusOut}
          in:fly={{ x: 8, duration: 160 }}
          out:fly={{ x: 8, duration: 120 }}
        >
          <button
            class="pip-icon-btn"
            onclick={toggleMute}
            aria-label={silent
              ? t("media.playback.unmute")
              : t("media.playback.mute")}
          >
            {#if silent}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <path d="m16 9 5 6M21 9l-5 6" />
              </svg>
            {:else}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 6a9 9 0 0 1 0 12" />
              </svg>
            {/if}
          </button>
          <div class="pip-volume-panel">
            <div
              class="pip-volume-track"
              bind:this={volumeTrackEl}
              onpointerdown={startVolumeDrag}
              role="slider"
              tabindex="0"
              aria-label={t("media.playback.volumeSlider")}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={volumePercent}
              aria-valuetext={`${volumePercent}%`}
              onkeydown={onVolumeKey}
            >
              <div
                class="pip-volume-fill"
                style="height: {volumePercent}%"
              ></div>
              <div
                class="pip-volume-knob"
                style="bottom: {volumePercent}%"
              ></div>
            </div>
          </div>
        </div>
      {/if}

      <button
        class="pip-icon-btn pip-close-btn"
        onclick={() => void pip.exit()}
        aria-label={t("shell.viewer.pip.exit")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
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
  </div>

  {#if isAudio}
    <div class="pip-audio-stage">
      <div class="pip-audio-backdrop" style={audioBackdrop}></div>
      <div class="pip-audio-scrim"></div>
      <button
        class="pip-audio-art"
        onclick={togglePlay}
        aria-label={playing
          ? t("media.playback.pauseAria")
          : t("media.playback.playAria")}
      >
        {#if coverArtSrc}
          <img src={coverArtSrc} alt="" draggable="false" />
        {:else}
          <svg
            width="32"
            height="32"
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
              class="pip-icon-btn"
              onclick={togglePlay}
              aria-label={playing
                ? t("media.playback.pauseAria")
                : t("media.playback.playAria")}
            >
              {#if playing}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9 5v14M15 5v14" />
                </svg>
              {:else}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M8 5l11 7-11 7V5z" />
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
  {:else if showTimedBar}
    <div class="pip-bar pip-fade">
      <button
        class="pip-play-btn"
        onclick={togglePlay}
        aria-label={playing
          ? t("media.playback.pauseAria")
          : t("media.playback.playAria")}
      >
        {#if playing}
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="1.5" width="3" height="9" rx="1" />
            <rect x="7" y="1.5" width="3" height="9" rx="1" />
          </svg>
        {:else}
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
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
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="1.5" width="3" height="9" rx="1" />
            <rect x="7" y="1.5" width="3" height="9" rx="1" />
          </svg>
        {:else}
          <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.6v8.8L10 6z" />
          </svg>
        {/if}
      </button>
    </div>
  {/if}

  {#if canNavigate && !isAudio}
    <button
      class="pip-nav pip-nav-left pip-fade"
      onclick={() => navigate(-1)}
      aria-label={t("shell.viewer.pip.previous")}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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

  {#if pip.state.menuOpen}
    <div
      class="context-menu pip-menu"
      bind:this={menuEl}
      style="left: {menuX}px; top: {menuY}px;"
      transition:fly={{ y: -4, duration: 160, opacity: 0.08 }}
      role="menu"
      tabindex="-1"
      aria-label={t("shell.viewer.pip.menu")}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onmousedown={(e) => e.stopPropagation()}
    >
      <button
        class="ctx-item"
        role="menuitemcheckbox"
        aria-checked={pip.state.sizeLocked}
        onclick={() => {
          pip.closeMenu();
          void pip.toggleSizeLock();
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <rect
            x="5"
            y="11"
            width="14"
            height="10"
            rx="2"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M8 11V7a4 4 0 018 0v4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        {t("shell.viewer.pip.lockSize")}
        <span class="pip-menu-check" aria-hidden="true">
          {#if pip.state.sizeLocked}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {/if}
        </span>
      </button>
      <div class="ctx-sep"></div>
      <button
        class="ctx-item"
        role="menuitem"
        onclick={() => {
          pip.closeMenu();
          void pip.snapToNextCorner();
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {t("shell.viewer.pip.snapCorner")}
      </button>
      <button
        class="ctx-item"
        role="menuitem"
        onclick={() => {
          pip.closeMenu();
          void pip.resetSize();
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {fitLabel}
      </button>
      <button
        class="ctx-item"
        role="menuitem"
        onclick={() => {
          pip.closeMenu();
          void pip.exit();
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
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
        {t("shell.viewer.pip.restoreWindow")}
      </button>
    </div>
  {/if}
</div>
