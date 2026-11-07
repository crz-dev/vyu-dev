<script lang="ts">
  import { fly } from "svelte/transition";
  import AlbumCover from "$lib/features/media/AlbumCover.svelte";
  import WaveformBar from "$lib/features/media/WaveformBar.svelte";
  import LoopDropdown from "$lib/features/media/LoopDropdown.svelte";
  import MarkerDropdown from "$lib/features/media/MarkerDropdown.svelte";
  import Marquee from "$lib/components/Marquee.svelte";
  import type { LoopMode } from "$lib/shared/constants";
  import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
  import { showToast } from "$lib/components/toast.svelte";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { nearestSpeedStepIndex } from "$lib/features/media/playback.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  function shortcutSuffix(id: string): string {
    const label = keybindStore.label(id);
    return label ? ` (${label})` : "";
  }

  let {
    fileName,
    filePath,
    cdColor,
    coverArtSrc,
    playing,
    muted,
    volume,
    setVolume,
    toggleMute,
    togglePlay,
    handlePrevClick,
    handleNextClick,
    toggleTimer,
    currentTimeDisplay,
    durationDisplay,
    timerTooltip,
    progress,
    rawCurrentSecs,
    rawDurationSecs,
    isScrubbing,
    startScrubbing,
    clips,
    timestamps,
    loopStart,
    loopEnd,
    resumePoint,
    tsEditMenuVisible,
    tsMenuOpen,
    loopMenuOpen,
    onTsMenuChange,
    onLoopMenuChange,
    addTimestamp,
    addLoopStart,
    addLoopEnd,
    addClipBoundary,
    clearAllTimestamps,
    clearAllSegments,
    removeResumePoint,
    clearLoopMarkers,
    volumeSegments,
    playbackUI,
    pickAudioFile,
    volumeTrackEl = $bindable(),
    speedTrackEl = $bindable(),
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
    loopMode,
    setLoopMode,
    audioEl,
    cassetteFilenameOverflow = $bindable(),
    cassetteInfoRowEl = $bindable(),
    audioMarkerProps,
  }: {
    fileName: string;
    filePath: string;
    cdColor: string;
    coverArtSrc: string;
    playing: boolean;
    muted: boolean;
    volume: number;
    setVolume: (v: number) => void;
    toggleMute: () => void;
    togglePlay: () => void;
    handlePrevClick: () => void;
    handleNextClick: () => void;
    toggleTimer: () => void;
    currentTimeDisplay: () => string;
    durationDisplay: string;
    timerTooltip: string;
    progress: number;
    rawCurrentSecs: number;
    rawDurationSecs: number;
    isScrubbing: boolean;
    startScrubbing: (e: MouseEvent) => void;
    clips: {
      clipBoundaries: ClipBoundary[];
    };
    timestamps: VideoMarker[];
    loopStart: number | null;
    loopEnd: number | null;
    resumePoint: number | null;
    tsEditMenuVisible: boolean;
    tsMenuOpen: boolean;
    loopMenuOpen: boolean;
    onTsMenuChange: (v: boolean) => void;
    onLoopMenuChange: (v: boolean) => void;
    addTimestamp: () => void;
    addLoopStart: () => void;
    addLoopEnd: () => void;
    addClipBoundary: (kind: "start" | "end") => void;
    clearAllTimestamps: () => void;
    clearAllSegments: () => void;
    removeResumePoint: () => void;
    clearLoopMarkers: () => void;
    volumeSegments: number;
    playbackUI: {
      showVolumeOverlay: () => void;
      handleVolumeAreaLeave: () => void;
      handleVolumeScroll: (e: WheelEvent) => void;
      startVolumeDrag: (e: MouseEvent) => void;
      handleVolumeDiamondHover: (e: MouseEvent) => void;
      volumeSliderMode: boolean;
      volumeHovered: boolean;
      volumeDragging: boolean;
      volumeSliderValue: number;
      startVolumeSliderDrag: (e: PointerEvent, el: HTMLDivElement) => void;
      handleVolumeSliderChange: (v: number) => void;
      showVolumeSliderTooltip: (el: HTMLDivElement | null) => void;
      hideVolumeSliderTooltip: () => void;
      showSpeedOverlay: () => void;
      handleSpeedAreaLeave: () => void;
      handleSpeedScroll: (e: WheelEvent) => void;
      startSpeedDrag: (e: MouseEvent) => void;
      handleSpeedDiamondHover: (e: MouseEvent) => void;
      playbackSpeed: number;
      speedSliderMode: boolean;
      speedHovered: boolean;
      speedDragging: boolean;
      speedSliderValue: number;
      setPlaybackSpeed: (v: number) => void;
      startSpeedSliderDrag: (e: PointerEvent, el: HTMLDivElement) => void;
      showSpeedSliderTooltip: (el: HTMLDivElement | null) => void;
      hideSpeedSliderTooltip: () => void;
    };
    pickAudioFile: () => void;
    volumeTrackEl: HTMLDivElement | null;
    speedTrackEl: HTMLDivElement | null;
    toggleVolumeSliderMode: () => void;
    toggleSpeedSliderMode: () => void;
    loopMode: LoopMode;
    setLoopMode: (mode: LoopMode) => void;
    audioEl: () => HTMLAudioElement | null;
    cassetteFilenameOverflow: boolean;
    cassetteInfoRowEl: HTMLElement | null;
    audioMarkerProps: Record<string, unknown>;
  } = $props();

  const hasAnyMarkers = $derived(
    timestamps.length > 0 ||
      clips.clipBoundaries.length > 0 ||
      resumePoint !== null ||
      loopStart !== null ||
      loopEnd !== null,
  );

  function deleteAllMarkers() {
    clearAllTimestamps();
    clearAllSegments();
    removeResumePoint();
    clearLoopMarkers();
    showToast({ message: t("media.audio.markersCleared"), color: "yellow" });
  }

  function handleVolumeRightClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    volumeTrackEl = null;
    toggleVolumeSliderMode();
  }

  function handleSpeedRightClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    speedTrackEl = null;
    toggleSpeedSliderMode();
  }

  $effect(() => {
    const el = audioEl();
    if (!el) return;
    eqEngine.connectMediaElement(el);
  });
</script>

<div class="audio-modern-thumbnail">
  <AlbumCover
    size="xlarge"
    src={coverArtSrc || null}
    color={cdColor}
    {playing}
    onPickAudio={pickAudioFile}
    {fileName}
    duration={durationDisplay}
  />
</div>
<div
  class="audio-info-row"
  class:expanded={cassetteFilenameOverflow}
  bind:this={cassetteInfoRowEl}
>
  <button
    class="audio-info-time tooltip-ctrl"
    data-tooltip={timerTooltip}
    onclick={toggleTimer}
    aria-label={t("media.playback.toggleTimerAria")}
  >
    {currentTimeDisplay()}
  </button>
  <span class="audio-info-filename"
    ><Marquee
      text={fileName}
      class="audio-marquee"
      measureWidth={cassetteInfoRowEl
        ? cassetteInfoRowEl.clientWidth / 3
        : undefined}
      onOverflow={(v) => (cassetteFilenameOverflow = v)}
    /></span
  >
  <button
    class="audio-info-time tooltip-ctrl"
    data-tooltip={timerTooltip}
    onclick={toggleTimer}
    aria-label={t("media.playback.toggleTimerAria")}
  >
    {durationDisplay}
  </button>
</div>
<div class="audio-modern-controls-card">
  <div class="audio-waveform-card">
    <WaveformBar
      {filePath}
      {progress}
      {isScrubbing}
      editorOpen={tsEditMenuVisible}
      {timestamps}
      durationSecs={rawDurationSecs}
      {loopStart}
      {loopEnd}
      clipBoundaries={clips.clipBoundaries}
      {resumePoint}
      onScrubStart={startScrubbing}
      {...audioMarkerProps}
    />
  </div>
  <div class="audio-modern-controls-row">
    <div class="audio-controls-left">
      <div class="audio-left-controls-card">
        <div class="loop-menu-anchor" style="position:relative;">
          <button
            class="ctrl-btn loop-btn tooltip-ctrl"
            class:loop-menu-open={loopMenuOpen}
            data-tooltip={loopMenuOpen
              ? undefined
              : loopMode === "loop"
                ? t("media.loop.mode.loop")
                : loopMode === "stop"
                  ? t("media.loop.stopAtEnd")
                  : loopMode === "next"
                    ? t("media.loop.mode.next")
                    : loopMode === "shuffle-songs"
                      ? t("media.loop.mode.shuffleSongs")
                      : t("media.loop.mode.shuffle")}
            onclick={() => onLoopMenuChange(!loopMenuOpen)}
            aria-label={t("media.loop.menuAria")}
          >
            {#if loopMode === "loop"}
              <svg
                class="loop-mode-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M17 2L21 6L17 10"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 11V9C3 7.9 3.9 7 5 7H21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M7 22L3 18L7 14"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 13V15C21 16.1 20.1 17 19 17H3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            {:else if loopMode === "stop"}
              <svg
                class="loop-mode-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
              >
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            {:else if loopMode === "next"}
              <svg
                class="loop-mode-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path d="M5 4l10 8-10 8V4z" fill="currentColor" />
                <rect
                  x="19"
                  y="4"
                  width="2"
                  height="16"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            {:else if loopMode === "shuffle-songs"}
              <svg
                class="loop-mode-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            {:else}
              <svg
                class="loop-mode-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 7h5l9 10h4" />
                <path d="M3 17h5l2-2.2" />
                <path d="M17 5l4 4-4 4" />
                <path d="M17 13l4 4-4 4" />
              </svg>
            {/if}
          </button>
          <LoopDropdown
            open={loopMenuOpen}
            onClose={() => onLoopMenuChange(false)}
            looping={loopMode}
            {setLoopMode}
            isAudio={true}
          />
        </div>
        <div
          class="volume-control"
          class:audio-off={muted || volume === 0}
          onmouseenter={playbackUI.showVolumeOverlay}
          onmouseleave={playbackUI.handleVolumeAreaLeave}
          onwheel={playbackUI.handleVolumeScroll}
          role="presentation"
        >
          <button
            class="ctrl-btn volume-btn tooltip-ctrl"
            class:active={!(muted || volume === 0)}
            data-tooltip={`${muted || volume === 0 ? t("media.playback.unmute") : t("media.playback.mute")}${shortcutSuffix("mute")}`}
            onclick={toggleMute}
            aria-label={muted
              ? t("media.playback.unmuteAria")
              : t("media.playback.muteAria")}
            oncontextmenu={handleVolumeRightClick}
          >
            {#key muted || volume === 0 ? 0 : volume < 0.5 ? 1 : 2}
              {#if muted || volume === 0}
                <svg class="loop-mode-icon" viewBox="0 0 18 18" fill="none"
                  ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><line
                    x1="12"
                    y1="6"
                    x2="16"
                    y2="12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  /><line
                    x1="16"
                    y1="6"
                    x2="12"
                    y2="12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  /></svg
                >
              {:else if volume < 0.5}
                <svg class="loop-mode-icon" viewBox="0 0 18 18" fill="none"
                  ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
                    d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  /></svg
                >
              {:else}
                <svg class="loop-mode-icon" viewBox="0 0 18 18" fill="none"
                  ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
                    d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  /><path
                    d="M13.5 5C15.5 6.5 16.5 7.7 16.5 9C16.5 10.3 15.5 11.5 13.5 13"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  /></svg
                >
              {/if}
            {/key}
          </button>
          {#if playbackUI.volumeSliderMode && (playbackUI.volumeHovered || playbackUI.volumeDragging)}
            <div
              class="playback-slider-track"
              class:muted={muted || volume === 0}
              in:fly={{ x: -8, duration: 150, opacity: 0 }}
              bind:this={volumeTrackEl}
              role="slider"
              tabindex="0"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(playbackUI.volumeSliderValue * 100)}
              aria-label={t("media.playback.volumeSlider")}
              onpointerdown={(e) => {
                if (volumeTrackEl)
                  playbackUI.startVolumeSliderDrag(e, volumeTrackEl);
              }}
              oncontextmenu={handleVolumeRightClick}
              onmouseenter={() =>
                playbackUI.showVolumeSliderTooltip(volumeTrackEl)}
              onmouseleave={playbackUI.hideVolumeSliderTooltip}
            >
              <div
                class="playback-slider-fill"
                style="width: {playbackUI.volumeSliderValue * 100}%"
              ></div>
              {#each [0, 50, 100] as pct}
                <div
                  class="playback-slider-marker"
                  style="left: {pct}%"
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={(e) => {
                    e.stopPropagation();
                    playbackUI.handleVolumeSliderChange(pct / 100);
                  }}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      playbackUI.handleVolumeSliderChange(pct / 100);
                    }
                  }}
                  role="button"
                  tabindex="0"
                  aria-label={t("media.playback.setVolumeTo", { percent: pct })}
                ></div>
              {/each}
              <div
                class="playback-slider-scrubber"
                style="left: {playbackUI.volumeSliderValue * 100}%"
              ></div>
            </div>
          {:else if playbackUI.volumeHovered || playbackUI.volumeDragging}
            <div
              class="volume-diamonds"
              onmousedown={playbackUI.startVolumeDrag}
              onmousemove={playbackUI.handleVolumeDiamondHover}
              role="presentation"
            >
              {#each Array(volumeSegments) as _, i}
                <button
                  class="volume-diamond"
                  class:filled={i < Math.round(volume * volumeSegments)}
                  class:muted-diamond={muted}
                  style="--i: {i}"
                  onclick={() => setVolume((i + 1) / volumeSegments)}
                  aria-label={t("media.playback.setVolume", {
                    percent: Math.round(((i + 1) / volumeSegments) * 100),
                  })}
                ></button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="audio-transport-cards-container">
      <div class="audio-transport-card">
        <button
          class="audio-transport-btn tooltip-ctrl"
          data-tooltip={t("media.track.previous")}
          onclick={handlePrevClick}
          aria-label={t("media.track.previous")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4v16M18 4l-12 8 12 8V4z" />
          </svg>
        </button>
      </div>
      <div class="audio-transport-card">
        <button
          class="audio-transport-btn is-playpause tooltip-ctrl"
          data-tooltip={`${playing ? t("media.track.pause") : t("media.track.play")}${shortcutSuffix("play-pause")}`}
          onclick={togglePlay}
          aria-label={playing
            ? t("media.playback.pause")
            : t("media.playback.play")}
        >
          {#key playing}
            {#if playing}
              <svg
                class="loop-mode-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <rect
                  x="2.5"
                  y="1.5"
                  width="4"
                  height="13"
                  rx="1"
                  fill="currentColor"
                />
                <rect
                  x="9.5"
                  y="1.5"
                  width="4"
                  height="13"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            {:else}
              <svg
                class="loop-mode-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path d="M3 2L14 8L3 14V2Z" fill="currentColor" />
              </svg>
            {/if}
          {/key}
        </button>
      </div>
      <div class="audio-transport-card">
        <button
          class="audio-transport-btn tooltip-ctrl"
          data-tooltip={t("media.track.next")}
          onclick={handleNextClick}
          aria-label={t("media.track.next")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4l12 8-12 8V4zM18 4v16" />
          </svg>
        </button>
      </div>
    </div>
    <div class="controls-spacer"></div>
    <div class="audio-controls-right">
      <div class="audio-right-controls-card">
        <div
          class="speed-control"
          onmouseenter={playbackUI.showSpeedOverlay}
          onmouseleave={playbackUI.handleSpeedAreaLeave}
          onwheel={playbackUI.handleSpeedScroll}
          role="presentation"
        >
          <button
            class="ctrl-btn speed-btn tooltip-ctrl"
            class:active={playbackUI.playbackSpeed !== 1}
            data-tooltip={t("media.playback.speed")}
            aria-label={t("media.playback.speedAria")}
            onclick={() => playbackUI.setPlaybackSpeed(1)}
            oncontextmenu={handleSpeedRightClick}
          >
            {#if playbackUI.playbackSpeed < 1}
              <svg
                class="speed-mode-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M2 12c1.5-2 3.5-3 5.5-3s3.5 1 5 3c1.5 2 3 3 5 3s3.5-1 4.5-3"
                />
                <path
                  d="M2 17c1.5-2 3.5-3 5.5-3s3.5 1 5 3c1.5 2 3 3 5 3s3.5-1 4.5-3"
                />
              </svg>
            {:else if playbackUI.playbackSpeed > 1}
              <svg
                class="speed-mode-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            {:else}
              <svg
                class="speed-mode-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="13" r="7.5" />
                <path d="M12 9.5v4l2.5 2" />
                <path d="M10 3h4" />
                <path d="M12 3v2" />
                <path d="M19 5.5l-1.5 1.5" />
                <circle
                  cx="19.5"
                  cy="5"
                  r="1.2"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            {/if}
          </button>
          {#if playbackUI.speedSliderMode && (playbackUI.speedHovered || playbackUI.speedDragging)}
            <div
              class="playback-slider-track"
              in:fly={{ x: 8, duration: 150, opacity: 0 }}
              bind:this={speedTrackEl}
              role="slider"
              tabindex="0"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(playbackUI.speedSliderValue * 100)}
              aria-label={t("media.playback.speedSlider")}
              onpointerdown={(e) => {
                if (speedTrackEl)
                  playbackUI.startSpeedSliderDrag(e, speedTrackEl);
              }}
              oncontextmenu={handleSpeedRightClick}
              onmouseenter={() =>
                playbackUI.showSpeedSliderTooltip(speedTrackEl)}
              onmouseleave={playbackUI.hideVolumeSliderTooltip}
            >
              <div
                class="playback-slider-fill"
                style="width: {playbackUI.speedSliderValue * 100}%"
              ></div>
              {#each [{ step: 0.1, pct: 0 }, { step: 1, pct: 50 }, { step: 3, pct: 100 }] as marker}
                <div
                  class="playback-slider-marker"
                  style="left: {marker.pct}%"
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={(e) => {
                    e.stopPropagation();
                    playbackUI.setPlaybackSpeed(marker.step);
                  }}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      playbackUI.setPlaybackSpeed(marker.step);
                    }
                  }}
                  role="button"
                  tabindex="0"
                  aria-label={t("media.playback.setSpeedTo", {
                    speed: marker.step,
                  })}
                ></div>
              {/each}
              <div
                class="playback-slider-scrubber"
                style="left: {playbackUI.speedSliderValue * 100}%"
              ></div>
            </div>
          {:else if playbackUI.speedHovered || playbackUI.speedDragging}
            <div
              class="speed-diamonds"
              onmousedown={playbackUI.startSpeedDrag}
              onmousemove={playbackUI.handleSpeedDiamondHover}
              role="presentation"
            >
              {#each [0.25, 0.5, 0.75, 1, 1.25, 2, 3] as step, i}
                {@const selectedIdx = nearestSpeedStepIndex(
                  playbackUI.playbackSpeed,
                )}
                {@const dist = Math.abs(i - selectedIdx)}
                <button
                  class="speed-diamond"
                  class:filled={dist === 0}
                  class:grey={dist === 1}
                  class:dim={dist === 2}
                  class:hidden={dist >= 3}
                  style="--i: {6 - i}"
                  onclick={() => playbackUI.setPlaybackSpeed(step)}
                  aria-label={t("media.playback.setSpeed", { speed: step })}
                ></button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="ts-menu-anchor" style="position:relative;">
          <button
            class="ctrl-btn add-ts-btn tooltip-ctrl"
            data-tooltip={t("media.playback.markerMenu")}
            class:ts-menu-open={tsMenuOpen}
            class:menu-active={tsMenuOpen}
            onclick={() => onTsMenuChange(!tsMenuOpen)}
            aria-label={t("media.playback.markerMenuAria")}
          >
            <svg
              class="ts-drop-arrow-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <polygon
                class="diamond-shape"
                points="12,3 21,12 12,21 3,12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <g class="x-shape">
                <path
                  d="M4.5,4.5 L19.5,19.5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M19.5,4.5 L4.5,19.5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </g>
            </svg>
          </button>
          <MarkerDropdown
            open={tsMenuOpen}
            onClose={() => onTsMenuChange(false)}
            {hasAnyMarkers}
            {addTimestamp}
            {addLoopStart}
            {addLoopEnd}
            addClipStart={() => addClipBoundary("start")}
            addClipEnd={() => addClipBoundary("end")}
            {deleteAllMarkers}
            thin={true}
          />
        </div>
      </div>
    </div>
  </div>
</div>
