<script lang="ts">
  import { fly } from "svelte/transition";
  import CdColorPicker from "$lib/features/media/CdColorPicker.svelte";
  import AudioRetroLayout from "$lib/features/media/AudioRetroLayout.svelte";
  import AudioModernLayout from "$lib/features/media/AudioModernLayout.svelte";
  import { CD_COLORS, type LoopMode } from "$lib/shared/constants";
  import type { VideoMarker, ClipBoundary } from "$lib/shared/types";
  import { saveAudioLayoutMode, saveCdColor } from "$lib/services/storage";

  let {
    fileSrc,
    filePath,
    fileName,
    cdColor = $bindable(),
    cdColorIndex = $bindable(),
    showCdColorPicker = $bindable(),
    coverArtSrc,
    audioEl = $bindable(),
    onAudioLoad,
    onAudioError,
    onAudioEnded,
    playing = $bindable(),
    loopMode,
    setLoopMode,
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
    fileList,
    currentIndex = $bindable(),
    setMediaState,
    navigate,
    slideshowActive,
    volumeSegments,
    playbackUI,
    pickAudioFile,
    volumeTrackEl = $bindable(),
    speedTrackEl = $bindable(),
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
    audioLayoutMode = $bindable(),
    cassetteFilenameOverflow = $bindable(),
    cassetteInfoRowEl = $bindable(),
  }: {
    fileSrc: string;
    filePath: string;
    fileName: string;
    cdColor: string;
    cdColorIndex: number;
    showCdColorPicker: boolean;
    coverArtSrc: string;
    audioEl: HTMLAudioElement | null;
    onAudioLoad: () => void;
    onAudioError: () => void;
    onAudioEnded: () => void;
    playing: boolean;
    loopMode: LoopMode;
    setLoopMode: (mode: LoopMode) => void;
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
    fileList: string[];
    currentIndex: number;
    setMediaState: (state: {
      currentIndex: number;
      filePath: string;
      fileSrc: string;
      fileName: string;
    }) => void;
    navigate: (delta: number) => void;
    slideshowActive: boolean;
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
    audioLayoutMode: "retro" | "modern";
    cassetteFilenameOverflow: boolean;
    cassetteInfoRowEl: HTMLElement | null;
  } = $props();
</script>

<div class="audio-wrapper" role="presentation">
  <div class="audio-customize-card">
    <button
      class="audio-customize-btn tooltip-ctrl"
      data-tooltip={audioLayoutMode === "retro"
        ? "Swap to Cassette"
        : "Swap to Vinyl"}
      onclick={() => {
        audioLayoutMode = audioLayoutMode === "retro" ? "modern" : "retro";
        saveAudioLayoutMode(audioLayoutMode);
      }}
      aria-label={audioLayoutMode === "retro"
        ? "Swap to cassette layout"
        : "Swap to vinyl layout"}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="8" y="8" width="14" height="14" rx="2" />
        <rect
          x="2"
          y="2"
          width="14"
          height="14"
          rx="2"
          fill="var(--bg-elevated)"
          stroke="currentColor"
        />
      </svg>
    </button>
  </div>
  <audio
    bind:this={audioEl}
    src={fileSrc}
    crossorigin="anonymous"
    preload="metadata"
    autoplay
    onloadedmetadata={onAudioLoad}
    onerror={onAudioError}
    onended={onAudioEnded}
  ></audio>
  <div class="audio-swap-container">
    {#key audioLayoutMode}
      <div
        class="audio-layout-swap"
        in:fly={{
          x: audioLayoutMode === "retro" ? 100 : -100,
          duration: 260,
          delay: 40,
        }}
        out:fly={{
          x: audioLayoutMode === "retro" ? -100 : 100,
          duration: 180,
        }}
      >
        {#if audioLayoutMode === "retro"}
          <AudioRetroLayout
            {fileName}
            {filePath}
            {cdColor}
            {coverArtSrc}
            {playing}
            {muted}
            {volume}
            {setVolume}
            {toggleMute}
            {togglePlay}
            {handlePrevClick}
            {handleNextClick}
            {toggleTimer}
            {currentTimeDisplay}
            {durationDisplay}
            {timerTooltip}
            {progress}
            {rawCurrentSecs}
            {rawDurationSecs}
            {isScrubbing}
            {startDiscScrubbing}
            {discScrubHandlers}
            {startScrubbing}
            {clips}
            {timestamps}
            {loopStart}
            {loopEnd}
            {resumePoint}
            {tsEditMenuVisible}
            {tsMenuOpen}
            {loopMenuOpen}
            {onTsMenuChange}
            {onLoopMenuChange}
            {addTimestamp}
            {addLoopStart}
            {addLoopEnd}
            {addClipBoundary}
            {clearAllTimestamps}
            {clearAllSegments}
            {removeResumePoint}
            {clearLoopMarkers}
            {volumeSegments}
            {playbackUI}
            {pickAudioFile}
            bind:volumeTrackEl
            bind:speedTrackEl
            {toggleVolumeSliderMode}
            {toggleSpeedSliderMode}
            {loopMode}
            {setLoopMode}
            audioEl={() => audioEl}
            onCenterClick={() => (showCdColorPicker = !showCdColorPicker)}
          />
        {:else}
          <AudioModernLayout
            {fileName}
            {filePath}
            {cdColor}
            {coverArtSrc}
            {playing}
            {muted}
            {volume}
            {setVolume}
            {toggleMute}
            {togglePlay}
            {handlePrevClick}
            {handleNextClick}
            {toggleTimer}
            {currentTimeDisplay}
            {durationDisplay}
            {timerTooltip}
            {progress}
            {rawCurrentSecs}
            {rawDurationSecs}
            {isScrubbing}
            {startScrubbing}
            {clips}
            {timestamps}
            {loopStart}
            {loopEnd}
            {resumePoint}
            {tsEditMenuVisible}
            {tsMenuOpen}
            {loopMenuOpen}
            {onTsMenuChange}
            {onLoopMenuChange}
            {addTimestamp}
            {addLoopStart}
            {addLoopEnd}
            {addClipBoundary}
            {clearAllTimestamps}
            {clearAllSegments}
            {removeResumePoint}
            {clearLoopMarkers}
            {volumeSegments}
            {playbackUI}
            {pickAudioFile}
            bind:volumeTrackEl
            bind:speedTrackEl
            {toggleVolumeSliderMode}
            {toggleSpeedSliderMode}
            {loopMode}
            {setLoopMode}
            audioEl={() => audioEl}
            bind:cassetteFilenameOverflow
            bind:cassetteInfoRowEl
          />
        {/if}
      </div>
    {/key}
  </div>
  <CdColorPicker
    visible={showCdColorPicker}
    onClose={() => (showCdColorPicker = false)}
    activeIndex={cdColorIndex}
    onPick={(idx) => {
      cdColorIndex = idx;
      cdColor = CD_COLORS[idx];
      if (filePath) saveCdColor(filePath, idx);
      showCdColorPicker = false;
    }}
  />
</div>
