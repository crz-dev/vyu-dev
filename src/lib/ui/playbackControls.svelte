<script lang="ts">
  let {
    fullscreen = false,
    isGifVideo,
    playing,
    looping,
    muted,
    volume,
    volumeHovered,
    volumeSegments,
    togglePlay,
    toggleLoop,
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
    speedTooltipVisible,
    speedTooltipX,
    speedTooltipY,
    handleSpeedDiamondHover,
    startSpeedDrag,
    addTimestamp,
    toggleTimer,
    currentTimeDisplay,
    durationDisplay,
    timerTooltip,
    toggleFullscreen,
  }: {
    fullscreen?: boolean;
    isGifVideo: boolean;
    playing: boolean;
    looping: "loop" | "stop" | "next" | "shuffle";
    muted: boolean;
    volume: number;
    volumeHovered: boolean;
    volumeSegments: number;
    togglePlay: () => void;
    toggleLoop: () => void;
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
    speedTooltipVisible: boolean;
    speedTooltipX: number;
    speedTooltipY: number;
    handleSpeedDiamondHover: (e: MouseEvent) => void;
    startSpeedDrag: (e: MouseEvent) => void;
    addTimestamp: () => void;
    toggleTimer: () => void;
    currentTimeDisplay: () => string;
    durationDisplay: string;
    timerTooltip: string;
    toggleFullscreen: () => void;
  } = $props();
</script>

{#if !fullscreen}
  <div class="controls-row" class:hide-for-gif={isGifVideo}>
    <button
      class="ctrl-btn tooltip-ctrl"
      data-tooltip={playing ? "Pause" : "Play"}
      onclick={togglePlay}
      aria-label={playing ? "pause" : "play"}
    >
      {#if playing}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
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
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
          ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
        >
      {/if}
    </button>
    <button
      class="ctrl-btn loop-btn tooltip-ctrl"
      class:active={looping !== "stop"}
      data-tooltip={looping === "loop"
        ? "Loop"
        : looping === "stop"
          ? "Stop at end"
          : looping === "next"
            ? "Play next"
            : "Shuffle"}
      onclick={toggleLoop}
      aria-label="loop mode"
    >
      {#if looping === "loop"}
        <svg class="loop-mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
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
        <svg class="loop-mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
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
        <svg class="loop-mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 4l10 8-10 8V4z" fill="currentColor" />
          <rect x="19" y="4" width="2" height="16" rx="1" fill="currentColor" />
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
      >
        {#if muted || volume === 0}
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
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
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
            ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
              d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            /></svg
          >
        {:else}
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none"
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
      </button>
      {#if volumeHovered}
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
        style="color: #ffffff;"
      >
        {#if playbackSpeed < 1}
          <svg
            class="speed-mode-icon"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="10.5" cy="13.8" rx="6.2" ry="4.1" />
            <circle cx="16.9" cy="12.8" r="1.5" />
            <circle cx="17.2" cy="9.3" r="1.35" />
            <circle cx="7.8" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="12.6" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <path d="M4.4 12.6q-2.1-1.6-1.8-4.3q0.3-2.5 3.1-2.7q2.2-0.2 3.9 1.3" />
            <path d="M9.7 6.8q2-1.7 4.1-0.5q1.4 0.8 2.3 2.2" />
            <circle cx="18.2" cy="12.5" r="0.25" fill="currentColor" stroke="none" />
          </svg>
        {:else if playbackSpeed > 1}
          <svg
            class="speed-mode-icon"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="10.2" cy="14.2" rx="6.4" ry="3.8" />
            <circle cx="17.8" cy="11.2" r="1.7" />
            <circle cx="20.2" cy="8.5" r="1.2" />
            <circle cx="7.2" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="12.9" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <path d="M4 14q-2.1-3.4 1-6.4q2.7-2.5 6.6-1.4q2.2-1.3 4.5-0.4q2.3 0.9 3.5 3.2" />
            <path d="M18.9 9.8q1.3 1.9 1 4.2" />
            <circle cx="18.3" cy="11.2" r="0.25" fill="currentColor" stroke="none" />
          </svg>
        {:else}
          <svg
            class="speed-mode-icon"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M12 7v5l3 3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        {/if}
      </button>
      {#if speedHovered}
        <div
          class="speed-diamonds"
          onmousedown={startSpeedDrag}
          onmousemove={handleSpeedDiamondHover}
          role="presentation"
        >
          {#each [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as step, i}
            {@const selectedIdx = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].indexOf(
              playbackSpeed,
            )}
            {@const dist = Math.abs(i - selectedIdx)}
            <button
              class="speed-diamond"
              class:filled={dist === 0}
              class:grey={dist === 1}
              style="--i: {6 - i}"
              onclick={() => setPlaybackSpeed(step)}
              aria-label="set speed {step}x"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="ctrl-btn add-ts-btn tooltip-ctrl"
      data-tooltip="Place timestamp"
      onclick={addTimestamp}
      aria-label="add timestamp"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16 L12 6 L20 16"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
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
    <button
      class="ctrl-btn loop-btn tooltip-ctrl"
      class:active={looping !== "stop"}
      data-tooltip={looping === "loop"
        ? "Loop"
        : looping === "stop"
          ? "Stop at end"
          : looping === "next"
            ? "Play next"
            : "Shuffle"}
      onclick={toggleLoop}
      aria-label="loop mode"
    >
      {#if looping === "loop"}
        <svg class="loop-mode-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
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
        <svg class="loop-mode-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
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
        <svg class="loop-mode-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M5 4l10 8-10 8V4z" fill="currentColor" />
          <rect x="19" y="4" width="2" height="16" rx="1" fill="currentColor" />
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
      >
        {#if muted || volume === 0}
          <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
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
          <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
            ><path d="M9 4L5 7H2V11H5L9 14V4Z" fill="currentColor" /><path
              d="M11.5 7C12.5 7.8 13 8.4 13 9C13 9.6 12.5 10.2 11.5 11"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            /></svg
          >
        {:else}
          <svg width="19" height="19" viewBox="0 0 18 18" fill="none"
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
      </button>
      {#if volumeHovered}
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
        style="color: #ffffff;"
      >
        {#if playbackSpeed < 1}
          <svg
            class="speed-mode-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="10.5" cy="13.8" rx="6.2" ry="4.1" />
            <circle cx="16.9" cy="12.8" r="1.5" />
            <circle cx="17.2" cy="9.3" r="1.35" />
            <circle cx="7.8" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="12.6" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <path d="M4.4 12.6q-2.1-1.6-1.8-4.3q0.3-2.5 3.1-2.7q2.2-0.2 3.9 1.3" />
            <path d="M9.7 6.8q2-1.7 4.1-0.5q1.4 0.8 2.3 2.2" />
            <circle cx="18.2" cy="12.5" r="0.25" fill="currentColor" stroke="none" />
          </svg>
        {:else if playbackSpeed > 1}
          <svg
            class="speed-mode-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="10.2" cy="14.2" rx="6.4" ry="3.8" />
            <circle cx="17.8" cy="11.2" r="1.7" />
            <circle cx="20.2" cy="8.5" r="1.2" />
            <circle cx="7.2" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="12.9" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
            <path d="M4 14q-2.1-3.4 1-6.4q2.7-2.5 6.6-1.4q2.2-1.3 4.5-0.4q2.3 0.9 3.5 3.2" />
            <path d="M18.9 9.8q1.3 1.9 1 4.2" />
            <circle cx="18.3" cy="11.2" r="0.25" fill="currentColor" stroke="none" />
          </svg>
        {:else}
          <svg
            class="speed-mode-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M12 7v5l3 3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        {/if}
      </button>
      {#if speedHovered}
        <div
          class="speed-diamonds"
          onmousedown={startSpeedDrag}
          onmousemove={handleSpeedDiamondHover}
          role="presentation"
        >
          {#each [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as step, i}
            {@const selectedIdx = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].indexOf(
              playbackSpeed,
            )}
            {@const dist = Math.abs(i - selectedIdx)}
            <button
              class="speed-diamond"
              class:filled={dist === 0}
              class:grey={dist === 1}
              style="--i: {6 - i}"
              onclick={() => setPlaybackSpeed(step)}
              aria-label="set speed {step}x"
            ></button>
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="fs-ctrl-btn add-ts-btn tooltip-ctrl"
      data-tooltip="Place timestamp"
      onclick={addTimestamp}
      aria-label="add timestamp"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16 L12 6 L20 16"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
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
        class="fs-ctrl-btn"
        onclick={toggleFullscreen}
        aria-label="exit fullscreen"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          ><path
            d="M4 1H1V4M8 1H11V4M11 8V11H8M4 11H1V8"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
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
      {#if playing}
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none"
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
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none"
          ><path d="M3 2L14 8L3 14V2Z" fill="currentColor" /></svg
        >
      {/if}
    </button>
  {/if}
{/if}
