<script lang="ts">
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import Controls from "$lib/components/Controls.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
  import type { TrackSelectionStore } from "$lib/features/media/tracks.svelte";

  let {
    fileSrc,
    tracks,
    videoEl = $bindable(null),
    onVideoLoad,
    onVideoError,
    onMediaEnded,
    cropContainerEl = $bindable(null),
    drawActive,
    markupCursor = "crosshair",
    videoWrapperTransform,
    videoInnerStyle,
    panCursor,
    isGifVideo,
    hoverZone = $bindable("none"),
    videoControlsStyle,
    tsEditMenuVisible,
    timelineProps,
    playbackProps,
    slideshowActive,
    slideshowTransition,
    currentIndex,
  }: {
    fileSrc: string;
    tracks: TrackSelectionStore;
    videoEl: HTMLVideoElement | null;
    onVideoLoad: () => void;
    onVideoError: () => void;
    onMediaEnded: () => void;
    cropContainerEl: HTMLElement | null;
    drawActive: boolean;
    markupCursor?: string;
    videoWrapperTransform: string;
    videoInnerStyle: string;
    panCursor: string;
    isGifVideo: boolean;
    hoverZone: string;
    videoControlsStyle: string;
    tsEditMenuVisible: boolean;
    timelineProps: Record<string, unknown>;
    playbackProps: Record<string, unknown>;
    slideshowActive: boolean;
    slideshowTransition: string;
    currentIndex: number;
  } = $props();

  let videoInnerEl = $state<HTMLDivElement | null>(null);
  let subtitleTrackEl = $state<HTMLTrackElement | null>(null);
  const cueTimes = new WeakMap<VTTCue, { start: number; end: number }>();

  function applySubtitleTiming() {
    const cues = subtitleTrackEl?.track.cues;
    if (!cues) return;
    const offset = tracks.subtitleDelayMs / 1000;
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      if (!(cue instanceof VTTCue)) continue;
      let original = cueTimes.get(cue);
      if (!original) {
        original = { start: cue.startTime, end: cue.endTime };
        cueTimes.set(cue, original);
      }
      cue.line = -3;
      cue.lineAlign = "end";
      cue.position = 50;
      cue.positionAlign = "center";
      cue.align = "center";
      cue.startTime = Math.max(0, original.start + offset);
      cue.endTime = Math.max(cue.startTime + 0.01, original.end + offset);
    }
  }

  function handleSubtitleLoad() {
    if (subtitleTrackEl) subtitleTrackEl.track.mode = "showing";
    applySubtitleTiming();
  }

  $effect(() => {
    void tracks.subtitleDelayMs;
    void tracks.subtitleSrc;
    applySubtitleTiming();
  });
</script>

<div
  class="video-wrapper"
  bind:this={cropContainerEl}
  role="presentation"
  onmouseenter={() => (hoverZone = "video")}
  onmouseleave={() => (hoverZone = "none")}
  style="{videoWrapperTransform} cursor: {drawActive
    ? markupCursor
    : panCursor}"
>
  <div class="video-inner" bind:this={videoInnerEl} style={videoInnerStyle}>
    {#key slideshowActive && slideshowTransition !== "none" ? currentIndex : fileSrc}
      <div
        class={slideshowActive && slideshowTransition !== "none"
          ? `transition-${slideshowTransition}`
          : ""}
      >
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={videoEl}
          src={tracks.activeVideoSrc || fileSrc}
          class:subtitle-size-small={tracks.subtitleSize === "small"}
          class:subtitle-size-default={tracks.subtitleSize === "default"}
          class:subtitle-size-large={tracks.subtitleSize === "large"}
          crossorigin="anonymous"
          preload="metadata"
          autoplay={playbackPrefs.autoplay || slideshowActive}
          onloadedmetadata={onVideoLoad}
          onerror={onVideoError}
          onended={onMediaEnded}
        >
          {#if tracks.subtitleSrc}
            <track
              bind:this={subtitleTrackEl}
              kind="subtitles"
              src={tracks.subtitleSrc}
              srclang="und"
              label={tracks.selectedSubtitleLabel || "Subtitles"}
              default
              onload={handleSubtitleLoad}
            />
          {/if}
        </video>
      </div>
    {/key}
  </div>
  <CropOverlay containerEl={cropContainerEl} mediaEl={videoInnerEl} />
  <DrawOverlay containerEl={cropContainerEl} mediaEl={videoInnerEl} />
  <div
    class="video-controls"
    class:gif-only={isGifVideo}
    class:editor-open={tsEditMenuVisible}
    style={videoControlsStyle}
  >
    <Controls fullscreen={false} {timelineProps} {playbackProps} />
  </div>
</div>
