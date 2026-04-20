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
    looping: boolean;
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
      class:active={looping}
      data-tooltip="Loop video"
      onclick={toggleLoop}
      aria-label="toggle loop"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
      </button>
      {#if speedHovered}
        <div
          class="speed-diamonds"
          onmousedown={startSpeedDrag}
          onmousemove={handleSpeedDiamondHover}
          role="presentation"
        >
          {#each [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as step, i}
            <button
              class="speed-diamond"
              class:filled={playbackSpeed === step}
              class:active={playbackSpeed >= step}
              style="--i: {i}"
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
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        ><circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          stroke-width="2"
        /><path
          d="M12 7v5l3 3"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><path
          d="M18.5 3.5L20 2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><path
          d="M12 3V1"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /></svg
      >
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
      class="fs-ctrl-btn loop-btn tooltip-ctrl"
      class:active={looping}
      data-tooltip="Loop video"
      onclick={toggleLoop}
      aria-label="toggle loop"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
      </button>
      {#if speedHovered}
        <div
          class="speed-diamonds"
          onmousedown={startSpeedDrag}
          onmousemove={handleSpeedDiamondHover}
          role="presentation"
        >
          {#each [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as step, i}
            <button
              class="speed-diamond"
              class:filled={playbackSpeed === step}
              class:active={playbackSpeed >= step}
              style="--i: {i}"
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
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        ><circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          stroke-width="2"
        /><path
          d="M12 7v5l3 3"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><path
          d="M18.5 3.5L20 2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><path
          d="M12 3V1"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /></svg
      >
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
