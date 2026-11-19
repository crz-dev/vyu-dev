<script lang="ts">
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import Controls from "$lib/components/Controls.svelte";
  import SubtitleOverlay from "$lib/features/viewer/SubtitleOverlay.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
  import {
    attachHls,
    canPlayHlsNatively,
    type HlsHandle,
  } from "$lib/features/media/hls";
  import { isHlsUrl } from "$lib/shared/mediaKind";
  import type { TrackSelectionStore } from "$lib/features/media/tracks.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    fileSrc,
    isRemote,
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
    isRemote: boolean;
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
  let hlsHandle: HlsHandle | null = null;

  const isHlsSource = $derived(isHlsUrl(fileSrc));
  const nativeHls = $derived(!!videoEl && canPlayHlsNatively(videoEl));
  const useHlsJs = $derived(isHlsSource && !nativeHls);

  $effect(() => {
    const el = videoEl;
    const url = fileSrc;
    if (!el || !url || !isHlsUrl(url) || canPlayHlsNatively(el)) return;

    let disposed = false;
    void attachHls(el, url, onVideoError)
      .then((handle) => {
        if (disposed) {
          handle?.destroy();
          return;
        }
        if (!handle) {
          onVideoError();
          return;
        }
        hlsHandle = handle;
      })
      .catch(() => {
        if (!disposed) onVideoError();
      });

    return () => {
      disposed = true;
      hlsHandle?.destroy();
      hlsHandle = null;
    };
  });

  function handleSubtitleLoad() {
    if (subtitleTrackEl) subtitleTrackEl.track.mode = "hidden";
  }

  $effect(() => {
    if (subtitleTrackEl) subtitleTrackEl.track.mode = "hidden";
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
          src={useHlsJs ? undefined : tracks.activeVideoSrc || fileSrc}
          crossorigin={isRemote ? undefined : "anonymous"}
          preload="metadata"
          autoplay={playbackPrefs.autoplay || slideshowActive || isRemote}
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
              label={tracks.selectedSubtitleLabel ||
                t("shell.viewer.subtitles")}
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

<SubtitleOverlay
  {videoEl}
  trackEl={subtitleTrackEl}
  delayMs={tracks.subtitleDelayMs}
  size={tracks.subtitleSize}
  resetKey={fileSrc}
  videoHovered={hoverZone === "video"}
  interactive={!drawActive}
/>
