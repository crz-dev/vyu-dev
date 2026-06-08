<script lang="ts">
  import { fly } from "svelte/transition";
  import CdVisual from "$lib/features/media/CdVisual.svelte";
  import AlbumCover from "$lib/features/media/AlbumCover.svelte";
  import WaveformBar from "$lib/features/media/WaveformBar.svelte";
  import LoopDropdown from "$lib/features/media/LoopDropdown.svelte";
  import MarkerDropdown from "$lib/features/media/MarkerDropdown.svelte";
  import Marquee from "$lib/shared/Marquee.svelte";
  import type { LoopMode } from "$lib/shared/constants";
  import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
  import { showToast } from "$lib/features/toast/toast.svelte";

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
    startDiscScrubbing,
    discScrubHandlers,
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
    onCenterClick,
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
    startDiscScrubbing: (e: MouseEvent | TouchEvent) => void;
    discScrubHandlers: {
      onScrubMove: (e: MouseEvent | TouchEvent, newProgress: number) => void;
      onScrubEnd: () => void;
    };
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
      startVolumeDrag: (e: MouseEvent, isVertical?: boolean) => void;
      handleVolumeDiamondHover: (e: MouseEvent, isVertical?: boolean) => void;
      volumeSliderMode: boolean;
      volumeHovered: boolean;
      volumeDragging: boolean;
      volumeSliderValue: number;
      startVolumeSliderDrag: (
        e: PointerEvent,
        el: HTMLDivElement,
        isVertical?: boolean,
      ) => void;
      handleVolumeSliderChange: (v: number) => void;
      showVolumeSliderTooltip: (
        el: HTMLDivElement | null,
        isVertical?: boolean,
      ) => void;
      hideVolumeSliderTooltip: () => void;
      showSpeedOverlay: () => void;
      handleSpeedAreaLeave: () => void;
      handleSpeedScroll: (e: WheelEvent) => void;
      startSpeedDrag: (e: MouseEvent, isVertical?: boolean) => void;
      handleSpeedDiamondHover: (e: MouseEvent, isVertical?: boolean) => void;
      playbackSpeed: number;
      speedSliderMode: boolean;
      speedHovered: boolean;
      speedDragging: boolean;
      speedSliderValue: number;
      setPlaybackSpeed: (v: number) => void;
      startSpeedSliderDrag: (
        e: PointerEvent,
        el: HTMLDivElement,
        isVertical?: boolean,
      ) => void;
      showSpeedSliderTooltip: (
        el: HTMLDivElement | null,
        isVertical?: boolean,
      ) => void;
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
    onCenterClick: () => void;
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
    showToast({ message: "Markers cleared", color: "yellow" });
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
</script>

<CdVisual
  {progress}
  {audioEl}
  duration={rawDurationSecs}
  currentTime={rawCurrentSecs}
  onScrubStart={startDiscScrubbing}
  onScrubMove={discScrubHandlers.onScrubMove}
  onScrubEnd={discScrubHandlers.onScrubEnd}
  {isScrubbing}
  {fileName}
  color={cdColor}
  {onCenterClick}
/>
<div class="audio-controls-card">
  <div class="audio-controls-new">
    <div class="audio-thumb-wrapper">
      <AlbumCover
        src={coverArtSrc || null}
        color={cdColor}
        {playing}
        onPickAudio={pickAudioFile}
      />
    </div>
    <div class="audio-content-right">
      <div class="audio-filename-row">
        <span class="audio-filename"
          ><Marquee text={fileName} class="audio-marquee" /></span
        >
        <button
          class="time-display tooltip-ctrl tooltip-right"
          data-tooltip={timerTooltip}
          onclick={toggleTimer}
          aria-label="toggle timer mode"
        >
          {currentTimeDisplay()} / {durationDisplay}
        </button>
      </div>
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
        />
      </div>
      <div class="retro-controls-row">
        <div class="retro-transport-group">
          <div class="audio-transport-card">
            <button
              class="retro-transport-btn tooltip-ctrl"
              data-tooltip="Previous track"
              onclick={handlePrevClick}
              aria-label="Previous track"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 4v16M18 4l-12 8 12 8V4z" />
              </svg>
            </button>
          </div>
          <div class="audio-transport-card">
            <button
              class="retro-transport-btn is-playpause tooltip-ctrl"
              data-tooltip={playing ? "Pause track" : "Play track"}
              onclick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
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
              class="retro-transport-btn tooltip-ctrl"
              data-tooltip="Next track"
              onclick={handleNextClick}
              aria-label="Next track"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 4l12 8-12 8V4zM18 4v16" />
              </svg>
            </button>
          </div>
        </div>
        <div class="controls-spacer"></div>
        <div class="audio-controls-right">
          <div class="audio-right-controls-card">
            <div
              class="volume-control"
              class:audio-off={muted || volume === 0}
              onmouseenter={playbackUI.showVolumeOverlay}
              onmouseleave={playbackUI.handleVolumeAreaLeave}
              onwheel={playbackUI.handleVolumeScroll}
              role="presentation"
            >
              <button
                class="retro-slider-btn tooltip-ctrl"
                class:active={!(muted || volume === 0)}
                data-tooltip={muted || volume === 0 ? "Unmute" : "Mute"}
                onclick={toggleMute}
                aria-label={muted ? "unmute" : "mute"}
                oncontextmenu={handleVolumeRightClick}
              >
                {#key muted || volume === 0 ? 0 : volume < 0.5 ? 1 : 2}
                  {#if muted || volume === 0}
                    <svg class="loop-mode-icon" viewBox="0 0 18 18" fill="none"
                      ><path
                        d="M9 4L5 7H2V11H5L9 14V4Z"
                        fill="currentColor"
                      /><line
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
                      ><path
                        d="M9 4L5 7H2V11H5L9 14V4Z"
                        fill="currentColor"
                      /><path
                        d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      /></svg
                    >
                  {:else}
                    <svg class="loop-mode-icon" viewBox="0 0 18 18" fill="none"
                      ><path
                        d="M9 4L5 7H2V11H5L9 14V4Z"
                        fill="currentColor"
                      /><path
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
                  class="retro-slider-container"
                  class:muted={muted || volume === 0}
                  transition:fly={{ y: 12, duration: 150, opacity: 0 }}
                  role="presentation"
                  onmouseenter={() => playbackUI.showVolumeOverlay()}
                >
                  <div
                    class="retro-slider-track-vertical"
                    bind:this={volumeTrackEl}
                    role="slider"
                    tabindex="0"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      playbackUI.volumeSliderValue * 100,
                    )}
                    aria-label="Volume slider"
                    onpointerdown={(e) => {
                      if (volumeTrackEl)
                        playbackUI.startVolumeSliderDrag(
                          e,
                          volumeTrackEl,
                          true,
                        );
                    }}
                    oncontextmenu={handleVolumeRightClick}
                    onmouseenter={() =>
                      playbackUI.showVolumeSliderTooltip(volumeTrackEl, true)}
                    onmouseleave={playbackUI.hideVolumeSliderTooltip}
                  >
                    <div
                      class="retro-slider-fill-vertical"
                      style="height: {playbackUI.volumeSliderValue * 100}%"
                    ></div>
                    {#each [0, 50, 100] as pct}
                      <div
                        class="retro-slider-marker-vertical"
                        style="bottom: {pct}%"
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
                        aria-label="Set volume to {pct}%"
                      ></div>
                    {/each}
                    <div
                      class="retro-slider-scrubber-vertical"
                      style="bottom: {playbackUI.volumeSliderValue * 100}%"
                    ></div>
                  </div>
                </div>
              {:else if playbackUI.volumeHovered || playbackUI.volumeDragging}
                <div
                  class="retro-diamonds-wrapper"
                  transition:fly={{ y: 12, duration: 150, opacity: 0 }}
                >
                  <div
                    class="volume-diamonds"
                    onmousedown={(e) => playbackUI.startVolumeDrag(e, true)}
                    onmousemove={(e) =>
                      playbackUI.handleVolumeDiamondHover(e, true)}
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
                </div>
              {/if}
            </div>
            <div
              class="speed-control"
              onmouseenter={playbackUI.showSpeedOverlay}
              onmouseleave={playbackUI.handleSpeedAreaLeave}
              onwheel={playbackUI.handleSpeedScroll}
              role="presentation"
            >
              <button
                class="retro-slider-btn tooltip-ctrl"
                class:active={playbackUI.playbackSpeed !== 1}
                data-tooltip="Playback speed"
                aria-label="playback speed"
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
                  class="retro-slider-container"
                  transition:fly={{ y: 12, duration: 150, opacity: 0 }}
                  role="presentation"
                  onmouseenter={() => playbackUI.showSpeedOverlay()}
                >
                  <div
                    class="retro-slider-track-vertical"
                    bind:this={speedTrackEl}
                    role="slider"
                    tabindex="0"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      playbackUI.speedSliderValue * 100,
                    )}
                    aria-label="Playback speed slider"
                    onpointerdown={(e) => {
                      if (speedTrackEl)
                        playbackUI.startSpeedSliderDrag(e, speedTrackEl, true);
                    }}
                    oncontextmenu={handleSpeedRightClick}
                    onmouseenter={() =>
                      playbackUI.showSpeedSliderTooltip(speedTrackEl, true)}
                    onmouseleave={playbackUI.hideSpeedSliderTooltip}
                  >
                    <div
                      class="retro-slider-fill-vertical"
                      style="height: {playbackUI.speedSliderValue * 100}%"
                    ></div>
                    {#each [{ step: 0.1, pct: 0 }, { step: 1, pct: 50 }, { step: 3, pct: 100 }] as marker}
                      <div
                        class="retro-slider-marker-vertical"
                        style="bottom: {marker.pct}%"
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
                        aria-label="Set speed to {marker.step}x"
                      ></div>
                    {/each}
                    <div
                      class="retro-slider-scrubber-vertical"
                      style="bottom: {playbackUI.speedSliderValue * 100}%"
                    ></div>
                  </div>
                </div>
              {:else if playbackUI.speedHovered || playbackUI.speedDragging}
                <div
                  class="retro-diamonds-wrapper"
                  transition:fly={{ y: 12, duration: 150, opacity: 0 }}
                >
                  <div
                    class="speed-diamonds"
                    onmousedown={(e) => playbackUI.startSpeedDrag(e, true)}
                    onmousemove={(e) =>
                      playbackUI.handleSpeedDiamondHover(e, true)}
                    role="presentation"
                  >
                    {#each [0.25, 0.5, 0.75, 1, 1.25, 2, 3] as step, i}
                      {@const selectedIdx = [
                        0.25, 0.5, 0.75, 1, 1.25, 2, 3,
                      ].indexOf(playbackUI.playbackSpeed)}
                      {@const dist = Math.abs(i - selectedIdx)}
                      <button
                        class="speed-diamond"
                        class:filled={dist === 0}
                        class:grey={dist === 1}
                        class:dim={dist === 2}
                        class:hidden={dist >= 3}
                        style="--i: {6 - i}"
                        onclick={() => playbackUI.setPlaybackSpeed(step)}
                        aria-label="set speed {step}x"
                      ></button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            <div
              class="loop-menu-anchor"
              style="position:relative;"
              role="presentation"
            >
              <button
                class="retro-slider-btn tooltip-ctrl"
                class:loop-menu-open={loopMenuOpen}
                data-tooltip={loopMenuOpen
                  ? undefined
                  : loopMode === "loop"
                    ? "Loop"
                    : loopMode === "stop"
                      ? "Stop at end"
                      : loopMode === "next"
                        ? "Play next"
                        : "Shuffle"}
                onclick={() => onLoopMenuChange(!loopMenuOpen)}
                aria-label="loop mode menu"
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
              />
            </div>
            <div
              class="ts-menu-anchor"
              style="position:relative;"
              role="presentation"
            >
              <button
                class="retro-slider-btn tooltip-ctrl"
                data-tooltip="Marker menu"
                class:ts-menu-open={tsMenuOpen}
                onclick={() => onTsMenuChange(!tsMenuOpen)}
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
                onClose={() => onTsMenuChange(false)}
                {hasAnyMarkers}
                {addTimestamp}
                {addLoopStart}
                {addLoopEnd}
                addClipStart={() => addClipBoundary("start")}
                addClipEnd={() => addClipBoundary("end")}
                {deleteAllMarkers}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
