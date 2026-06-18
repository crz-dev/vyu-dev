<script lang="ts">
  import { fly } from "svelte/transition";
  import LoopDropdown from "$lib/features/media/LoopDropdown.svelte";
  import MarkerDropdown from "$lib/features/media/MarkerDropdown.svelte";
  import type { LoopMode } from "$lib/shared/constants";

  let {
    fullscreen = false,
    isAudio = false,
    isGifVideo,
    playing,
    looping,
    muted,
    volume,
    volumeHovered,
    volumeSegments,
    togglePlay,
    toggleLoop,
    setLoopMode,
    toggleMute,
    showVolumeOverlay,
    handleVolumeAreaLeave,
    handleVolumeScroll,
    startVolumeDrag,
    handleVolumeDiamondHover,
    setVolume,
    playbackSpeed,
    speedHovered,
    setPlaybackSpeed,
    showSpeedOverlay,
    handleSpeedAreaLeave,
    handleSpeedScroll,
    handleSpeedDiamondHover,
    startSpeedDrag,
    addTimestamp,
    addClipStart,
    addClipEnd,
    addLoopStart,
    addLoopEnd,
    hasLoopStart,
    hasLoopEnd,
    hasAnyMarkers,
    deleteAllMarkers,
    toggleTimer,
    currentTimeDisplay,
    durationDisplay,
    timerTooltip,
    toggleFullscreen,
    onTsMenuChange,
    volumeSliderMode,
    speedSliderMode,
    volumeSliderValue,
    speedSliderValue,
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
    startVolumeSliderDrag,
    startSpeedSliderDrag,
    handleVolumeSliderChange,
    handleSpeedSliderChange,
    showVolumeSliderTooltip,
    hideVolumeSliderTooltip,
    showSpeedSliderTooltip,
    hideSpeedSliderTooltip,
    volumeDragging,
    speedDragging,
  }: {
    fullscreen?: boolean;
    isAudio?: boolean;
    isGifVideo: boolean;
    playing: boolean;
    looping: LoopMode;
    muted: boolean;
    volume: number;
    volumeHovered: boolean;
    volumeSegments: number;
    togglePlay: () => void;
    toggleLoop?: () => void;
    setLoopMode: (mode: LoopMode) => void;
    toggleMute: () => void;
    showVolumeOverlay: () => void;
    handleVolumeAreaLeave: () => void;
    handleVolumeScroll: (e: WheelEvent) => void;
    startVolumeDrag: (e: MouseEvent) => void;
    handleVolumeDiamondHover: (e: MouseEvent) => void;
    setVolume: (v: number) => void;
    playbackSpeed: number;
    speedHovered: boolean;
    setPlaybackSpeed: (v: number) => void;
    showSpeedOverlay: () => void;
    handleSpeedAreaLeave: () => void;
    handleSpeedScroll: (e: WheelEvent) => void;
    handleSpeedDiamondHover: (e: MouseEvent) => void;
    startSpeedDrag: (e: MouseEvent) => void;
    addTimestamp: () => void;
    addClipStart: () => void;
    addClipEnd: () => void;
    addLoopStart: () => void;
    addLoopEnd: () => void;
    hasLoopStart: boolean;
    hasLoopEnd: boolean;
    hasAnyMarkers: boolean;
    deleteAllMarkers: () => void;
    toggleTimer: () => void;
    currentTimeDisplay: () => string;
    durationDisplay: string;
    timerTooltip: string;
    toggleFullscreen: () => void;
    onTsMenuChange?: (open: boolean) => void;
    volumeSliderMode: boolean;
    speedSliderMode: boolean;
    volumeSliderValue: number;
    speedSliderValue: number;
    toggleVolumeSliderMode: () => void;
    toggleSpeedSliderMode: () => void;
    startVolumeSliderDrag: (e: PointerEvent, track: HTMLDivElement) => void;
    startSpeedSliderDrag: (e: PointerEvent, track: HTMLDivElement) => void;
    handleVolumeSliderChange: (v: number) => void;
    handleSpeedSliderChange: (v: number) => void;
    showVolumeSliderTooltip: (trackEl: HTMLDivElement | null) => void;
    hideVolumeSliderTooltip: () => void;
    showSpeedSliderTooltip: (trackEl: HTMLDivElement | null) => void;
    hideSpeedSliderTooltip: () => void;
    volumeDragging: boolean;
    speedDragging: boolean;
  } = $props();
  let tsMenuOpen = $state(false);
  let loopMenuOpen = $state(false);
  let volumeTrackEl: HTMLDivElement | null = $state(null);
  let speedTrackEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    onTsMenuChange?.(tsMenuOpen);
  });

  function closeLoopDropdown() {
    loopMenuOpen = false;
  }
  function closeTsDropdown() {
    tsMenuOpen = false;
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

  function handleVolumeTrackPointerDown(e: PointerEvent) {
    if (!volumeTrackEl) return;
    startVolumeSliderDrag(e, volumeTrackEl);
  }

  function handleSpeedTrackPointerDown(e: PointerEvent) {
    if (!speedTrackEl) return;
    startSpeedSliderDrag(e, speedTrackEl);
  }

  const speedDisplayValue = $derived.by(() => {
    if (!speedSliderMode) return "";
    const speed =
      speedSliderValue <= 0.5
        ? 0.1 + 0.9 * (speedSliderValue / 0.5)
        : 1 + 2 * ((speedSliderValue - 0.5) / 0.5);
    return speed.toFixed(2) + "x";
  });

  const speedStepMarkers = [
    { step: 0.1, pct: 0 },
    { step: 1, pct: 50 },
    { step: 3, pct: 100 },
  ];
</script>

{#if !fullscreen}
  <div class="controls-row" class:hide-for-gif={isGifVideo}>
    <button
      class="ctrl-btn tooltip-ctrl"
      data-tooltip={playing ? "Pause" : "Play"}
      onclick={togglePlay}
      aria-label={playing ? "pause" : "play"}
    >
      {#key playing}
        {#if playing}
          <svg
            class="loop-mode-icon"
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            ><rect
              x="3"
              y="2"
              width="3.5"
              height="12"
              rx="1"
              fill="currentColor"
            /><rect
              x="9.5"
              y="2"
              width="3.5"
              height="12"
              rx="1"
              fill="currentColor"
            /></svg
          >
        {:else}
          <svg
            class="loop-mode-icon"
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
          >
        {/if}
      {/key}
    </button>
    <div class="loop-menu-anchor" style="position:relative;">
      <button
        class="ctrl-btn loop-btn tooltip-ctrl"
        class:loop-menu-open={loopMenuOpen}
        data-tooltip={loopMenuOpen
          ? undefined
          : looping === "loop"
            ? "Loop"
            : looping === "stop"
              ? "Stop at end"
              : looping === "next"
                ? "Play next"
                : looping === "shuffle-songs"
                  ? "Shuffle songs"
                  : "Shuffle"}
        onclick={() => {
          loopMenuOpen = !loopMenuOpen;
        }}
        aria-label="loop mode menu"
      >
        {#if looping === "loop"}
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
        {:else if looping === "stop"}
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
        {:else if looping === "next"}
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
        {:else if looping === "shuffle-songs"}
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
        onClose={closeLoopDropdown}
        {looping}
        {setLoopMode}
        {isAudio}
      />
    </div>
    <div
      class="volume-control"
      class:audio-off={muted || volume === 0}
      onmouseenter={showVolumeOverlay}
      onmouseleave={handleVolumeAreaLeave}
      onwheel={handleVolumeScroll}
      role="presentation"
    >
      <button
        class="ctrl-btn volume-btn tooltip-ctrl"
        class:active={!(muted || volume === 0)}
        data-tooltip={muted || volume === 0 ? "Unmute" : "Mute"}
        onclick={toggleMute}
        aria-label={muted ? "unmute" : "mute"}
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
      {#if volumeSliderMode && (volumeHovered || volumeDragging)}
        <div
          class="playback-slider-track"
          class:muted={muted || volume === 0}
          style="width: 140px;"
          transition:fly={{ x: -8, duration: 150, opacity: 0 }}
          bind:this={volumeTrackEl}
          role="slider"
          tabindex="0"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volumeSliderValue * 100)}
          aria-label="Volume slider"
          onpointerdown={handleVolumeTrackPointerDown}
          oncontextmenu={handleVolumeRightClick}
          onmouseenter={() => showVolumeSliderTooltip(volumeTrackEl)}
          onmouseleave={hideVolumeSliderTooltip}
        >
          <div
            class="playback-slider-fill"
            style="width: {volumeSliderValue * 100}%"
          ></div>
          {#each [0, 50, 100] as pct}
            <div
              class="playback-slider-marker"
              style="left: {pct}%"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                handleVolumeSliderChange(pct / 100);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleVolumeSliderChange(pct / 100);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Set volume to {pct}%"
            ></div>
          {/each}
          <div
            class="playback-slider-scrubber"
            style="left: {volumeSliderValue * 100}%"
          ></div>
        </div>
      {:else if volumeHovered || volumeDragging}
        <div
          class="volume-diamonds"
          onmousedown={startVolumeDrag}
          onmousemove={handleVolumeDiamondHover}
          role="presentation"
        >
          {#each Array(volumeSegments) as _, i}
            <button
              class="volume-diamond"
              class:filled={i < Math.round(volume * volumeSegments)}
              class:muted-diamond={muted}
              style="--i: {i}"
              onclick={() => setVolume((i + 1) / volumeSegments)}
              aria-label="set volume {Math.round(
                ((i + 1) / volumeSegments) * 100,
              )}%"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="controls-spacer"></div>
    <div
      class="speed-control"
      onmouseenter={showSpeedOverlay}
      onmouseleave={handleSpeedAreaLeave}
      onwheel={handleSpeedScroll}
      role="presentation"
    >
      <button
        class="ctrl-btn speed-btn tooltip-ctrl"
        class:active={playbackSpeed !== 1}
        data-tooltip="Playback speed"
        aria-label="playback speed"
        onclick={() => setPlaybackSpeed(1)}
        oncontextmenu={handleSpeedRightClick}
      >
        {#if playbackSpeed < 1}
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
        {:else if playbackSpeed > 1}
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
      {#if speedSliderMode && (speedHovered || speedDragging)}
        <div
          class="playback-slider-track"
          transition:fly={{ x: 8, duration: 150, opacity: 0 }}
          bind:this={speedTrackEl}
          role="slider"
          tabindex="0"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(speedSliderValue * 100)}
          aria-label="Playback speed slider"
          onpointerdown={handleSpeedTrackPointerDown}
          oncontextmenu={handleSpeedRightClick}
          onmouseenter={() => showSpeedSliderTooltip(speedTrackEl)}
          onmouseleave={hideSpeedSliderTooltip}
        >
          <div
            class="playback-slider-fill"
            style="width: {speedSliderValue * 100}%"
          ></div>
          {#each speedStepMarkers as marker}
            <div
              class="playback-slider-marker"
              style="left: {marker.pct}%"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                setPlaybackSpeed(marker.step);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPlaybackSpeed(marker.step);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Set speed to {marker.step}x"
            ></div>
          {/each}
          <div
            class="playback-slider-scrubber"
            style="left: {speedSliderValue * 100}%"
          ></div>
        </div>
      {:else if speedHovered || speedDragging}
        <div
          class="speed-diamonds"
          onmousedown={startSpeedDrag}
          onmousemove={handleSpeedDiamondHover}
          role="presentation"
        >
          {#each [0.25, 0.5, 0.75, 1, 1.25, 2, 3] as step, i}
            {@const selectedIdx = [0.25, 0.5, 0.75, 1, 1.25, 2, 3].indexOf(
              playbackSpeed,
            )}
            {@const dist = Math.abs(i - selectedIdx)}
            <button
              class="speed-diamond"
              class:filled={dist === 0}
              class:grey={dist === 1}
              class:dim={dist === 2}
              class:hidden={dist >= 3}
              style="--i: {6 - i}"
              onclick={() => setPlaybackSpeed(step)}
              aria-label="set speed {step}x"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="ts-menu-anchor" style="position:relative;">
      <button
        class="ctrl-btn add-ts-btn tooltip-ctrl"
        data-tooltip="Marker menu"
        class:ts-menu-open={tsMenuOpen}
        class:menu-active={tsMenuOpen}
        onclick={() => {
          tsMenuOpen = !tsMenuOpen;
        }}
        aria-label="markers menu"
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
        onClose={closeTsDropdown}
        {hasAnyMarkers}
        {addTimestamp}
        {addLoopStart}
        {addLoopEnd}
        {addClipStart}
        {addClipEnd}
        {deleteAllMarkers}
      />
    </div>
    <button
      class="time-display tooltip-ctrl"
      data-tooltip={timerTooltip}
      onclick={toggleTimer}
      aria-label="toggle timer mode"
    >
      {currentTimeDisplay()} / {durationDisplay}
    </button>
  </div>
  {#if isGifVideo}
    <button
      class="ctrl-btn gif-center-btn tooltip-ctrl"
      data-tooltip={playing ? "Pause GIF" : "Play GIF"}
      onclick={togglePlay}
      aria-label={playing ? "pause gif" : "play gif"}
    >
      {#if playing}
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
          ><rect
            x="3"
            y="2"
            width="3.5"
            height="12"
            rx="1"
            fill="currentColor"
          /><rect
            x="9.5"
            y="2"
            width="3.5"
            height="12"
            rx="1"
            fill="currentColor"
          /></svg
        >
      {:else}
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none"
          ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
        >
      {/if}
    </button>
  {/if}
{:else}
  <div class="fs-controls-row" class:hide-for-gif={isGifVideo}>
    <button
      class="fs-ctrl-btn tooltip-ctrl"
      data-tooltip={playing ? "Pause" : "Play"}
      onclick={togglePlay}
      aria-label={playing ? "pause" : "play"}
    >
      {#key playing}
        {#if playing}
          <svg
            class="loop-mode-icon"
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            ><rect
              x="3"
              y="2"
              width="3.5"
              height="12"
              rx="1"
              fill="currentColor"
            /><rect
              x="9.5"
              y="2"
              width="3.5"
              height="12"
              rx="1"
              fill="currentColor"
            /></svg
          >
        {:else}
          <svg
            class="loop-mode-icon"
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
          >
        {/if}
      {/key}
    </button>
    <div class="loop-menu-anchor" style="position:relative;">
      <button
        class="fs-ctrl-btn loop-btn tooltip-ctrl"
        class:loop-menu-open={loopMenuOpen}
        data-tooltip={loopMenuOpen
          ? undefined
          : looping === "loop"
            ? "Loop"
            : looping === "stop"
              ? "Stop at end"
              : looping === "next"
                ? "Play next"
                : looping === "shuffle-songs"
                  ? "Shuffle songs"
                  : "Shuffle"}
        onclick={() => {
          loopMenuOpen = !loopMenuOpen;
        }}
        aria-label="loop mode menu"
      >
        {#if looping === "loop"}
          <svg
            class="loop-mode-icon"
            width="15"
            height="15"
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
        {:else if looping === "stop"}
          <svg
            class="loop-mode-icon"
            width="15"
            height="15"
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
        {:else if looping === "next"}
          <svg
            class="loop-mode-icon"
            width="15"
            height="15"
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
        {:else if looping === "shuffle-songs"}
          <svg
            class="loop-mode-icon"
            width="15"
            height="15"
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
            width="15"
            height="15"
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
        onClose={closeLoopDropdown}
        {looping}
        {setLoopMode}
        {isAudio}
      />
    </div>
    <div
      class="volume-control"
      class:audio-off={muted || volume === 0}
      onmouseenter={showVolumeOverlay}
      onmouseleave={handleVolumeAreaLeave}
      onwheel={handleVolumeScroll}
      role="presentation"
    >
      <button
        class="fs-ctrl-btn volume-btn tooltip-ctrl"
        class:active={!(muted || volume === 0)}
        data-tooltip={muted || volume === 0 ? "Unmute" : "Mute"}
        onclick={toggleMute}
        aria-label={muted ? "unmute" : "mute"}
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
      {#if volumeSliderMode && (volumeHovered || volumeDragging)}
        <div
          class="playback-slider-track"
          class:muted={muted || volume === 0}
          style="width: 140px;"
          transition:fly={{ x: -8, duration: 150, opacity: 0 }}
          bind:this={volumeTrackEl}
          role="slider"
          tabindex="0"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volumeSliderValue * 100)}
          aria-label="Volume slider"
          onpointerdown={handleVolumeTrackPointerDown}
          oncontextmenu={handleVolumeRightClick}
          onmouseenter={() => showVolumeSliderTooltip(volumeTrackEl)}
          onmouseleave={hideVolumeSliderTooltip}
        >
          <div
            class="playback-slider-fill"
            style="width: {volumeSliderValue * 100}%"
          ></div>
          {#each [0, 50, 100] as pct}
            <div
              class="playback-slider-marker"
              style="left: {pct}%"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                handleVolumeSliderChange(pct / 100);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleVolumeSliderChange(pct / 100);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Set volume to {pct}%"
            ></div>
          {/each}
          <div
            class="playback-slider-scrubber"
            style="left: {volumeSliderValue * 100}%"
          ></div>
        </div>
      {:else if volumeHovered || volumeDragging}
        <div
          class="volume-diamonds"
          onmousedown={startVolumeDrag}
          onmousemove={handleVolumeDiamondHover}
          role="presentation"
        >
          {#each Array(volumeSegments) as _, i}
            <button
              class="volume-diamond"
              class:filled={i < Math.round(volume * volumeSegments)}
              class:muted-diamond={muted}
              style="--i: {i}"
              onclick={() => setVolume((i + 1) / volumeSegments)}
              aria-label="set volume {Math.round(
                ((i + 1) / volumeSegments) * 100,
              )}%"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="controls-spacer"></div>
    <div
      class="speed-control"
      onmouseenter={showSpeedOverlay}
      onmouseleave={handleSpeedAreaLeave}
      onwheel={handleSpeedScroll}
      role="presentation"
    >
      <button
        class="fs-ctrl-btn speed-btn tooltip-ctrl"
        class:active={playbackSpeed !== 1}
        data-tooltip="Playback speed"
        aria-label="playback speed"
        onclick={() => setPlaybackSpeed(1)}
        oncontextmenu={handleSpeedRightClick}
      >
        {#if playbackSpeed < 1}
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
        {:else if playbackSpeed > 1}
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
      {#if speedSliderMode && (speedHovered || speedDragging)}
        <div
          class="playback-slider-track"
          transition:fly={{ x: 8, duration: 150, opacity: 0 }}
          bind:this={speedTrackEl}
          role="slider"
          tabindex="0"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(speedSliderValue * 100)}
          aria-label="Playback speed slider"
          onpointerdown={handleSpeedTrackPointerDown}
          oncontextmenu={handleSpeedRightClick}
          onmouseenter={() => showSpeedSliderTooltip(speedTrackEl)}
          onmouseleave={hideSpeedSliderTooltip}
        >
          <div
            class="playback-slider-fill"
            style="width: {speedSliderValue * 100}%"
          ></div>
          {#each speedStepMarkers as marker}
            <div
              class="playback-slider-marker"
              style="left: {marker.pct}%"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                setPlaybackSpeed(marker.step);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPlaybackSpeed(marker.step);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Set speed to {marker.step}x"
            ></div>
          {/each}
          <div
            class="playback-slider-scrubber"
            style="left: {speedSliderValue * 100}%"
          ></div>
        </div>
      {:else if speedHovered || speedDragging}
        <div
          class="speed-diamonds"
          onmousedown={startSpeedDrag}
          onmousemove={handleSpeedDiamondHover}
          role="presentation"
        >
          {#each [0.25, 0.5, 0.75, 1, 1.25, 2, 3] as step, i}
            {@const selectedIdx = [0.25, 0.5, 0.75, 1, 1.25, 2, 3].indexOf(
              playbackSpeed,
            )}
            {@const dist = Math.abs(i - selectedIdx)}
            <button
              class="speed-diamond"
              class:filled={dist === 0}
              class:grey={dist === 1}
              class:dim={dist === 2}
              class:hidden={dist >= 3}
              style="--i: {6 - i}"
              onclick={() => setPlaybackSpeed(step)}
              aria-label="set speed {step}x"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="ts-menu-anchor" style="position:relative;">
      <button
        class="fs-ctrl-btn add-ts-btn tooltip-ctrl"
        data-tooltip="Marker menu"
        class:ts-menu-open={tsMenuOpen}
        class:menu-active={tsMenuOpen}
        onclick={() => {
          tsMenuOpen = !tsMenuOpen;
        }}
        aria-label="markers menu"
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
        onClose={closeTsDropdown}
        {hasAnyMarkers}
        {addTimestamp}
        {addLoopStart}
        {addLoopEnd}
        {addClipStart}
        {addClipEnd}
        {deleteAllMarkers}
      />
    </div>
    <button
      class="fs-time tooltip-ctrl"
      data-tooltip={timerTooltip}
      onclick={toggleTimer}
      aria-label="toggle timer mode"
    >
      {currentTimeDisplay()} / {durationDisplay}
    </button>
    <div class="fs-right">
      <button
        class="fs-ctrl-btn tooltip-ctrl"
        data-tooltip="Unfullscreen"
        onclick={toggleFullscreen}
        aria-label="exit fullscreen"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          ><path
            d="M4 1v3h-3M8 1v3h3M8 11v-3h3M4 11v-3h-3"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
      </button>
    </div>
  </div>
  {#if isGifVideo}
    <button
      class="fs-ctrl-btn fs-gif-center-btn tooltip-ctrl"
      data-tooltip={playing ? "Pause GIF" : "Play GIF"}
      onclick={togglePlay}
      aria-label={playing ? "pause gif" : "play gif"}
    >
      {#key playing}
        {#if playing}
          <svg
            class="loop-mode-icon"
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            ><rect
              x="3"
              y="2"
              width="3.5"
              height="12"
              rx="1"
              fill="currentColor"
            /><rect
              x="9.5"
              y="2"
              width="3.5"
              height="12"
              rx="1"
              fill="currentColor"
            /></svg
          >
        {:else}
          <svg
            class="loop-mode-icon"
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
          >
        {/if}
      {/key}
    </button>
  {/if}
{/if}

<svelte:window />
