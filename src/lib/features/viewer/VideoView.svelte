<script lang="ts">
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import Controls from "$lib/components/Controls.svelte";

  let {
    fileSrc,
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
    tsEditMenuVisible,
    timelineProps,
    playbackProps,
    slideshowActive,
    slideshowTransition,
    currentIndex,
  }: {
    fileSrc: string;
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
    tsEditMenuVisible: boolean;
    timelineProps: Record<string, unknown>;
    playbackProps: Record<string, unknown>;
    slideshowActive: boolean;
    slideshowTransition: string;
    currentIndex: number;
  } = $props();

  let videoInnerEl = $state<HTMLDivElement | null>(null);
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
        <video
          bind:this={videoEl}
          src={fileSrc}
          crossorigin="anonymous"
          preload="metadata"
          autoplay
          onloadedmetadata={onVideoLoad}
          onerror={onVideoError}
          onended={onMediaEnded}
        >
          <track kind="captions" srclang="en" label="English" />
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
  >
    <Controls fullscreen={false} {timelineProps} {playbackProps} />
  </div>
</div>
