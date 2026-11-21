<script lang="ts">
  import { fly } from "svelte/transition";
  import ImageView from "./ImageView.svelte";
  import VideoView from "./VideoView.svelte";
  import PDFView from "./PDFView.svelte";
  import FullscreenOverlay from "./FullscreenOverlay.svelte";
  import PipOverlay from "./PipOverlay.svelte";
  import { pip, PIP_EXPAND_MS } from "./pip.svelte";
  import AudioPlayer from "$lib/features/media/AudioPlayer.svelte";
  import {
    VOLUME_SEGMENTS,
    type LoopMode,
    type SortMode,
  } from "$lib/shared/constants";
  import type { ViewerStore } from "./viewer.svelte";
  import type { ViewerStyleStore } from "./viewerStyle.svelte";
  import type { MarkupStore } from "$lib/features/markup/markup.svelte";
  import type { CorruptionStore } from "$lib/features/media/corruption.svelte";
  import type { SlideshowStore } from "$lib/features/media/slideshow.svelte";
  import type { MarkersStore } from "$lib/features/markers/markers.svelte";
  import type { MenuVisibilityStore } from "$lib/features/menus/menuVisibility.svelte";
  import type { SortStore } from "$lib/features/navigation/sort.svelte";
  import type { DiscScrubStore } from "$lib/features/media/scrubbing.svelte";
  import type { LoopModeStoreType } from "$lib/features/media/loopMode.svelte";
  import type { PlaybackUIStore } from "$lib/features/media/playback.svelte";
  import type { TrackSelectionStore } from "$lib/features/media/tracks.svelte";
  import type { ClipsStore } from "$lib/features/media/clips.svelte";
  import type { PdfStore } from "$lib/features/viewer/pdf.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";

  let {
    fileSrc,
    isVideo,
    isAudio,
    isPdf,
    fileName,
    filePath,
    isRemote,
    viewerEl = $bindable(null),
    imageEl = $bindable(null),
    videoEl = $bindable(null),
    audioEl = $bindable(null),
    cropContainerEl = $bindable(null),
    pdfContainerEl = $bindable(null),
    hoverZone = $bindable("none"),
    dragDropActive = false,
    viewer,
    style,
    markup,
    corruption,
    slideshow,
    markerStore,
    menuStore,
    sort,
    discScrubStore,
    loopModeStore,
    playbackUI,
    tracks,
    pickAudioFile,
    currentIndex,
    fileList,
    isGifVideo,
    playing,
    muted,
    volume,
    isScrubbing,
    volumeTrackEl = $bindable(null),
    speedTrackEl = $bindable(null),
    audioLayoutMode = $bindable("retro"),
    cassetteFilenameOverflow = $bindable(false),
    cassetteInfoRowEl = $bindable(null),
    cdColor = $bindable("var(--green)"),
    cdColorIndex = $bindable(0),
    showCdColorPicker = $bindable(false),
    coverArtSrc = $bindable(""),
    navigate,
    openFileDialog,
    toggleThumbnailBar,
    handleFsPillContext,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    startPan,
    handleViewerScroll,
    toggleFullscreen,
    fsPillEl,
    onImageLoad,
    onVideoLoad,
    onMediaEnded,
    timelineProps,
    playbackProps,
    audioMarkerProps,
    clips,
    setLoopMode,
    setVolume,
    toggleMute,
    togglePlay,
    addTimestamp,
    addLoopStart,
    addLoopEnd,
    clearAllTimestamps,
    clearLoopMarkers,
    removeResumePoint,
    handlePrevClick,
    handleNextClick,
    onRemoteError,
    toggleTimer,
    currentTimeDisplay,
    durationDisplay,
    timerTooltip,
    setMediaState,
    startScrubbing,
    startDiscScrubbing,
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
    progress,
    rawCurrentSecs,
    rawDurationSecs,
    onSortChange,
    onAudioLoad,
    pdf,
    fileDimensions,
    fileSize,
    fileInfoLoading,
    isLoadingFile,
    loadingFadingOut,
    anyMenuOpen,
    thumbnailBarVisible,
    resetZoom,
  }: {
    fileSrc: string;
    isVideo: boolean;
    isAudio: boolean;
    isPdf: boolean;
    fileName: string;
    filePath: string;
    isRemote: boolean;
    viewerEl: HTMLElement | null;
    imageEl: HTMLImageElement | null;
    videoEl: HTMLVideoElement | null;
    audioEl: HTMLAudioElement | null;
    cropContainerEl: HTMLElement | null;
    pdfContainerEl: HTMLElement | null;
    hoverZone: string;
    dragDropActive: boolean;
    viewer: ViewerStore;
    style: ViewerStyleStore;
    markup: MarkupStore;
    corruption: CorruptionStore;
    slideshow: SlideshowStore;
    markerStore: MarkersStore;
    menuStore: MenuVisibilityStore;
    sort: SortStore;
    discScrubStore: DiscScrubStore;
    loopModeStore: LoopModeStoreType;
    playbackUI: PlaybackUIStore;
    tracks: TrackSelectionStore;
    clips: ClipsStore;
    pickAudioFile: () => void;
    currentIndex: number;
    fileList: string[];
    isGifVideo: boolean;
    playing: boolean;
    muted: boolean;
    volume: number;
    isScrubbing: boolean;
    volumeTrackEl: HTMLDivElement | null;
    speedTrackEl: HTMLDivElement | null;
    audioLayoutMode: "retro" | "modern";
    cassetteFilenameOverflow: boolean;
    cassetteInfoRowEl: HTMLElement | null;
    cdColor: string;
    cdColorIndex: number;
    showCdColorPicker: boolean;
    coverArtSrc: string;
    navigate: (d: number) => void;
    openFileDialog: () => void;
    toggleThumbnailBar: () => void;
    handleFsPillContext: (e: MouseEvent) => void;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    startPan: (e: MouseEvent) => void;
    handleViewerScroll: (e: WheelEvent) => void;
    toggleFullscreen: () => void;
    fsPillEl: HTMLButtonElement | null;
    onImageLoad: (e: Event) => void;
    onVideoLoad: () => void;
    onMediaEnded: () => void;
    timelineProps: Record<string, unknown>;
    playbackProps: Record<string, unknown>;
    setLoopMode: (m: LoopMode) => void;
    setVolume: (v: number) => void;
    toggleMute: () => void;
    togglePlay: () => void;
    addTimestamp: () => void;
    addLoopStart: () => void;
    addLoopEnd: () => void;
    clearAllTimestamps: () => void;
    clearLoopMarkers: () => void;
    removeResumePoint: () => void;
    handlePrevClick: () => void;
    handleNextClick: () => void;
    onRemoteError: () => void;
    toggleTimer: () => void;
    currentTimeDisplay: () => string;
    durationDisplay: string;
    timerTooltip: string;
    setMediaState: (d: Record<string, unknown>) => void;
    startScrubbing: (e: MouseEvent) => void;
    startDiscScrubbing: (e: MouseEvent | TouchEvent) => void;
    toggleVolumeSliderMode: () => void;
    toggleSpeedSliderMode: () => void;
    progress: number;
    rawCurrentSecs: number;
    rawDurationSecs: number;
    onSortChange: (m: SortMode, d: boolean) => void;
    onAudioLoad: () => void;
    pdf: PdfStore;
    fileDimensions: string;
    fileSize: string;
    fileInfoLoading: boolean;
    isLoadingFile: boolean;
    loadingFadingOut: boolean;
    anyMenuOpen: boolean;
    thumbnailBarVisible: boolean;
    resetZoom: () => void;
    audioMarkerProps: Record<string, unknown>;
  } = $props();

  let slideshowTransition = $derived(
    appearance.reducedMotion ? "none" : slideshow.transition,
  );

  const pipKind = $derived(
    isVideo ? "video" : isAudio ? "audio" : isPdf ? "pdf" : "image",
  );
  let pipSwap = $state(false);
  let pipAudioSwap = $state(false);
  let pipSwapTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPipSrc = "";
  let lastPipKind = "";

  $effect(() => {
    const active = pip.state.active;
    const src = fileSrc;
    const kind = pipKind;
    if (!active) {
      clearTimeout(pipSwapTimer);
      pipSwap = false;
      pipAudioSwap = false;
      lastPipSrc = src;
      lastPipKind = kind;
      return;
    }
    // Wait for the new source so the fade runs on the element that mounts.
    if (!src) return;
    if (lastPipSrc && src !== lastPipSrc) {
      // The audio layout is an overlay, so the existing file transition on the
      // hidden audio wrapper is not visible. Animate the card itself.
      if (kind === "audio") {
        pipAudioSwap = true;
        clearTimeout(pipSwapTimer);
        pipSwapTimer = setTimeout(() => (pipAudioSwap = false), 280);
      } else if (
        appearance.fileTransition === "none" &&
        !(kind === "image" && lastPipKind === "image")
      ) {
        pipSwap = true;
        clearTimeout(pipSwapTimer);
        pipSwapTimer = setTimeout(() => (pipSwap = false), 280);
      }
    }
    lastPipSrc = src;
    lastPipKind = kind;
    return () => clearTimeout(pipSwapTimer);
  });

  // Remember where the media sits in the normal viewer before PiP takes over,
  // so the card can return to that rect on exit.
  $effect.pre(() => {
    if (pip.state.phase !== "entering") return;
    const target = viewerEl?.querySelector<HTMLElement>(
      ".media-container, .video-wrapper, .audio-wrapper, .pdf-viewer",
    );
    if (!target) {
      pip.setMediaRect(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    pip.setMediaRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  });

  // On exit the media is anchored at its final viewer rect while the window
  // grows back around it. Pinning it with fixed positioning (the window origin
  // is the saved position and does not move during the growth) and sliding it
  // from the app origin to its rect avoids any layout-dependent scaling.
  let pipPinAnimation: Animation | null = null;

  function clearPipPin() {
    const root = document.documentElement;
    root.classList.remove("pip-exit-pin");
    root.style.removeProperty("--pip-pin-left");
    root.style.removeProperty("--pip-pin-top");
    root.style.removeProperty("--pip-pin-width");
    root.style.removeProperty("--pip-pin-height");
    pipPinAnimation?.cancel();
    pipPinAnimation = null;
  }

  $effect(() => {
    if (pip.state.phase !== "returning") {
      clearPipPin();
      return;
    }
    const rect = pip.getMediaRect();
    const target = viewerEl?.querySelector<HTMLElement>(
      ".media-container, .video-wrapper, .audio-wrapper, .pdf-viewer",
    );
    if (!rect || !target || rect.width <= 0 || rect.height <= 0) return;

    const root = document.documentElement;
    root.style.setProperty("--pip-pin-left", `${rect.left}px`);
    root.style.setProperty("--pip-pin-top", `${rect.top}px`);
    root.style.setProperty("--pip-pin-width", `${rect.width}px`);
    root.style.setProperty("--pip-pin-height", `${rect.height}px`);
    root.classList.add("pip-exit-pin");

    pipPinAnimation?.cancel();
    pipPinAnimation = target.animate(
      [
        { transform: `translate(${-rect.left}px, ${-rect.top}px)` },
        { transform: "none" },
      ],
      {
        duration: PIP_EXPAND_MS,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "both",
      },
    );

    return clearPipPin;
  });

  // Fallback only: when no usable media rect was captured, the layout switch
  // happens at full size and this small flip hides the inset correction.
  let pipExpandFrom: DOMRect | null = null;
  let pipExpandAnimation: Animation | null = null;

  $effect.pre(() => {
    if (pip.state.phase !== "expanding") {
      pipExpandFrom = null;
      return;
    }
    const target = viewerEl?.querySelector<HTMLElement>(
      ".media-container, .video-wrapper, .audio-wrapper, .pdf-viewer",
    );
    pipExpandFrom = target?.getBoundingClientRect() ?? null;
  });

  $effect(() => {
    if (pip.state.phase !== "expanding") {
      pipExpandAnimation?.cancel();
      pipExpandAnimation = null;
      return;
    }
    const from = pipExpandFrom;
    pipExpandFrom = null;
    if (!from) return;
    const target = viewerEl?.querySelector<HTMLElement>(
      ".media-container, .video-wrapper, .audio-wrapper, .pdf-viewer",
    );
    if (!target) return;
    const to = target.getBoundingClientRect();
    if (to.width <= 0 || to.height <= 0 || from.width <= 0) return;
    // Animate from the untransformed layout box so the element's own fit zoom
    // is preserved; the last keyframe is the element's current transform.
    const layoutWidth = target.offsetWidth || to.width;
    const layoutHeight = target.offsetHeight || to.height;
    if (layoutWidth <= 0 || layoutHeight <= 0) return;
    const scaleX = from.width / layoutWidth;
    const scaleY = from.height / layoutHeight;
    // A degenerate app layout (very narrow media in a tiny window) would need
    // an absurd upscale; leave the media at its layout rect instead of zooming.
    if (
      !Number.isFinite(scaleX) ||
      !Number.isFinite(scaleY) ||
      scaleX > 6 ||
      scaleY > 6
    ) {
      return;
    }
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const computed = getComputedStyle(target).transform;
    const endTransform = computed && computed !== "none" ? computed : "none";
    pipExpandAnimation?.cancel();
    pipExpandAnimation = target.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
        },
        { transform: endTransform },
      ],
      {
        duration: PIP_EXPAND_MS,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
    );
  });

  // A fitted copy of the outgoing image, shown while the next image decodes.
  // Keeps the viewer from flashing its background between images.
  let staleFrameSrc = $state("");
  let staleFrameTimer: ReturnType<typeof setTimeout> | undefined;
  let staleClearToken = 0;
  let lastSrcChangeAt = 0;
  // Rapid skips should not stack held-back frames on top of the incoming image.
  const RAPID_SKIP_MS = 400;
  // Plain trackers: the effect must not depend on its own writes.
  let lastSeenSrc = "";
  let lastSeenWasImage = false;
  let transitionInitialized = false;
  let lastTransitionPath = "";
  let lastTransitionSrc = "";
  let pendingTransitionPath = "";
  let pendingTransitionDirection = 1;
  let fileTransitionAnimation: Animation | null = null;

  $effect.pre(() => {
    const src = fileSrc;
    const isImage = !!src && !isVideo && !isAudio && !isPdf;
    // Slideshow transitions already keep the outgoing image on screen; a
    // static copy would override the animation.
    const animatingSlideshow =
      slideshow.active && slideshowTransition !== "none";
    if (src !== lastSeenSrc) {
      const now = performance.now();
      const rapidSkip =
        appearance.fileTransition !== "none" &&
        lastSrcChangeAt > 0 &&
        now - lastSrcChangeAt < RAPID_SKIP_MS;
      lastSrcChangeAt = now;
      if (
        lastSeenWasImage &&
        isImage &&
        lastSeenSrc &&
        !animatingSlideshow &&
        !rapidSkip
      ) {
        staleClearToken++;
        staleFrameSrc = lastSeenSrc;
        clearTimeout(staleFrameTimer);
        // Safety net: if the new image never loads, stop covering the viewer.
        staleFrameTimer = setTimeout(() => {
          staleFrameSrc = "";
        }, 4000);
      } else if (staleFrameSrc) {
        clearTimeout(staleFrameTimer);
        staleClearToken++;
        staleFrameSrc = "";
      }
      lastSeenSrc = src;
    }
    lastSeenWasImage = isImage;
  });

  // A cyclic file list should slide in the direction the viewer moved, even
  // when navigating wraps from the first file to the last (or vice versa).
  function slideDirection(previousPath: string, nextPath: string): 1 | -1 {
    const total = fileList.length;
    if (total < 2) return 1;
    const previousIndex = fileList.indexOf(previousPath);
    const nextIndex = fileList.indexOf(nextPath);
    if (previousIndex < 0 || nextIndex < 0 || previousIndex === nextIndex) {
      return 1;
    }
    let step = nextIndex - previousIndex;
    const half = total / 2;
    if (step > half) step -= total;
    else if (step < -half) step += total;
    return step < 0 ? -1 : 1;
  }

  $effect(() => {
    const path = filePath;
    const src = fileSrc;
    const transition = appearance.fileTransition;
    const reducedMotion = appearance.reducedMotion;

    if (!transitionInitialized) {
      transitionInitialized = true;
      lastTransitionPath = path;
      lastTransitionSrc = src;
      return;
    }

    if (path !== lastTransitionPath) {
      pendingTransitionDirection = slideDirection(lastTransitionPath, path);
      pendingTransitionPath = lastTransitionPath && path ? path : "";
      lastTransitionPath = path;
    }
    if (!src) {
      lastTransitionSrc = "";
      return;
    }
    if (src === lastTransitionSrc) return;

    lastTransitionSrc = src;
    if (pendingTransitionPath !== path) {
      pendingTransitionPath = "";
      return;
    }
    pendingTransitionPath = "";

    if (transition === "none" || reducedMotion || slideshow.active) return;

    const target = viewerEl?.querySelector<HTMLElement>(
      ".media-container, .video-wrapper, .audio-wrapper, .pdf-viewer",
    );
    if (!target) return;

    fileTransitionAnimation?.cancel();
    const slideFrom = pendingTransitionDirection < 0 ? "-24px" : "24px";
    fileTransitionAnimation = target.animate(
      transition === "fade"
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, translate: `${slideFrom} 0` },
            { opacity: 1, translate: "0 0" },
          ],
      { duration: 280, easing: "ease-out" },
    );

    return () => {
      fileTransitionAnimation?.cancel();
      fileTransitionAnimation = null;
    };
  });

  function clearStaleFrame() {
    if (!staleFrameSrc) return;
    clearTimeout(staleFrameTimer);
    const token = ++staleClearToken;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token === staleClearToken) staleFrameSrc = "";
      });
    });
  }

  function handleImageLoad(e: Event) {
    onImageLoad(e);
    clearStaleFrame();
  }

  function handleImageError() {
    corruption.onImageError();
    clearStaleFrame();
  }
</script>

<div
  class="content"
  class:checkerboard={appearance.checkerboard && !isVideo && !isAudio && !isPdf}
>
  <div
    class="sidebar left"
    onmouseenter={() => (hoverZone = "sidebar")}
    onmouseleave={() => (hoverZone = "none")}
    role="presentation"
  >
    {#if fileSrc}
      <button
        class="nav-btn tooltip-ctrl tooltip-right"
        data-tooltip="Previous file"
        transition:fly={{ x: -24, duration: 220 }}
        onclick={() => navigate(-1)}
        aria-label="previous file"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
  </div>
  <div
    class="viewer"
    class:pip-swap={pipSwap && pip.state.active}
    class:pip-audio-swap={pipAudioSwap && pip.state.active}
    bind:this={viewerEl}
    onmouseenter={() => (hoverZone = "sidebar")}
    onmouseleave={() => (hoverZone = "none")}
    onmousemove={pip.state.active ? pip.notifyPointerActivity : undefined}
    onwheel={isPdf || isAudio ? undefined : handleViewerScroll}
    onmousedown={!markup.drawActive &&
    !markup.selectActive &&
    !markup.removeActive
      ? isPdf
        ? undefined
        : startPan
      : undefined}
    ontouchstart={(e) => {
      if (!isAudio && e.touches.length === 2) e.preventDefault();
    }}
    ontouchmove={isAudio ? undefined : viewer.handleTouchZoom}
    ontouchend={isAudio ? undefined : viewer.handleTouchEnd}
    style="cursor: {pip.state.active &&
    appearance.cursorAutoHide &&
    !pip.state.controlsVisible
      ? 'none'
      : markup.drawActive || markup.selectActive || markup.removeActive
        ? markup.cursorStyle
        : !isVideo
          ? style.panCursor
          : 'default'}"
    role="presentation"
  >
    {#if fileSrc && !isVideo && !isAudio && !isPdf}
      <ImageView
        {fileSrc}
        {fileName}
        bind:imageEl
        onImageLoad={handleImageLoad}
        onImageError={handleImageError}
        imageStyle={style.imageStyle}
        bind:cropContainerEl
        slideshowActive={slideshow.active}
        {slideshowTransition}
        {currentIndex}
      />
    {:else if fileSrc && isVideo}
      <VideoView
        {fileSrc}
        {isRemote}
        {tracks}
        bind:videoEl
        {onVideoLoad}
        onVideoError={() => {
          if (!fileSrc) return;
          if (isRemote) {
            onRemoteError();
            return;
          }
          if (!tracks.onVideoSourceError()) corruption.onVideoError(videoEl);
        }}
        {onMediaEnded}
        bind:cropContainerEl
        drawActive={markup.drawActive}
        markupCursor={markup.cursorStyle}
        videoWrapperTransform={style.videoWrapperTransform}
        videoInnerStyle={style.videoInnerStyle}
        videoControlsStyle={style.videoControlsStyle}
        panCursor={style.panCursor}
        {isGifVideo}
        bind:hoverZone
        tsEditMenuVisible={markerStore.tsEditMenu.visible}
        {timelineProps}
        {playbackProps}
        slideshowActive={slideshow.active}
        {slideshowTransition}
        {currentIndex}
      />
    {:else if fileSrc && isPdf}
      <PDFView
        bind:pdfContainerEl
        loading={pdf.state.loading}
        error={pdf.state.error}
        pages={pdf.state.pages}
        scale={pdf.state.scale}
        fitScale={pdf.state.fitScale}
        zoomLocked={viewer.state.zoomLocked}
        currentPage={pdf.state.currentPage}
        pageCount={pdf.state.pageCount}
        setScale={pdf.setScale}
        prevPage={pdf.prevPage}
        nextPage={pdf.nextPage}
        scrollToPage={pdf.scrollToPage}
        centerPage={pdf.centerPage}
        findOpen={pdf.state.findOpen}
        findQuery={pdf.state.findQuery}
        findResults={pdf.state.findResults}
        findCurrentIdx={pdf.state.findCurrentIdx}
        findHighlights={pdf.state.findHighlights}
        toggleFind={pdf.toggleFind}
        findText={pdf.findText}
        findNext={pdf.findNext}
        findPrev={pdf.findPrev}
        showPagePanel={pdf.state.showPagePanel}
        togglePagePanel={pdf.togglePagePanel}
        getPageThumbnail={pdf.getPageThumbnail}
        preloadAllThumbnails={pdf.preloadAllThumbnails}
        isFullscreen={viewer.state.isFullscreen}
        resetFsTimer={viewer.resetFsTimer}
      />
    {:else if fileSrc && isAudio}
      <AudioPlayer
        {fileSrc}
        {filePath}
        {fileName}
        {isRemote}
        bind:cdColor
        bind:cdColorIndex
        bind:showCdColorPicker
        {coverArtSrc}
        bind:audioEl
        {onAudioLoad}
        onAudioError={() => {
          if (!fileSrc) return;
          if (isRemote) onRemoteError();
          else corruption.onAudioError(audioEl);
        }}
        onAudioEnded={onMediaEnded}
        bind:playing
        loopMode={loopModeStore.loopMode}
        {setLoopMode}
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
        discScrubHandlers={discScrubStore.discScrubHandlers}
        {startScrubbing}
        {clips}
        timestamps={markerStore.timestamps}
        chapters={markerStore.chapters}
        loopStart={markerStore.loopStart}
        loopEnd={markerStore.loopEnd}
        resumePoint={markerStore.resumePoint}
        tsEditMenuVisible={markerStore.tsEditMenu.visible}
        tsMenuOpen={menuStore.tsMenuOpen}
        loopMenuOpen={menuStore.loopMenuOpen}
        onTsMenuChange={(v: boolean) => (menuStore.tsMenuOpen = v)}
        onLoopMenuChange={(v: boolean) => (menuStore.loopMenuOpen = v)}
        {addTimestamp}
        {addLoopStart}
        {addLoopEnd}
        addClipBoundary={clips.addClipBoundaryFromMedia}
        {clearAllTimestamps}
        clearAllSegments={clips.clearBoundaries}
        {removeResumePoint}
        {clearLoopMarkers}
        {fileList}
        bind:currentIndex
        {setMediaState}
        {navigate}
        slideshowActive={slideshow.active}
        volumeSegments={VOLUME_SEGMENTS}
        {playbackUI}
        {pickAudioFile}
        bind:volumeTrackEl
        bind:speedTrackEl
        {toggleVolumeSliderMode}
        {toggleSpeedSliderMode}
        bind:audioLayoutMode
        bind:cassetteFilenameOverflow
        bind:cassetteInfoRowEl
        {audioMarkerProps}
      />
    {:else if !pip.state.active}
      <button
        class="empty"
        class:drag-active={dragDropActive}
        onclick={openFileDialog}
      >
        <span class="empty-icon-frame" aria-hidden="true">
          <svg
            class="empty-glyph"
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M13 3v6h6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="empty-add">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M5 1.5v7M1.5 5h7"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            </svg>
          </span>
        </span>
        <span class="empty-copy">
          <span class="empty-text">Open a file</span>
          <span class="empty-hint">Drag &amp; drop or paste a file or link</span
          >
        </span>
      </button>
    {/if}
    {#if staleFrameSrc}
      <div
        class="stale-frame"
        class:upscale={viewer.state.isFullscreen}
        aria-hidden="true"
      >
        <img src={staleFrameSrc} alt="" decoding="async" />
      </div>
    {/if}
    {#if pip.state.active && filePath}
      <PipOverlay
        {fileName}
        {currentIndex}
        fileListLength={fileList.length}
        {isVideo}
        {isAudio}
        {isPdf}
        {isGifVideo}
        {playing}
        {progress}
        {currentTimeDisplay}
        {durationDisplay}
        {isScrubbing}
        {coverArtSrc}
        {volume}
        {muted}
        {navigate}
        {togglePlay}
        {startScrubbing}
        {setVolume}
        {toggleMute}
      />
    {/if}
  </div>
  <div
    class="sidebar right"
    onmouseenter={() => (hoverZone = "sidebar")}
    onmouseleave={() => (hoverZone = "none")}
    role="presentation"
  >
    {#if fileSrc}
      <button
        class="nav-btn tooltip-ctrl tooltip-left"
        data-tooltip="Next file"
        transition:fly={{ x: 24, duration: 220 }}
        onclick={() => navigate(1)}
        aria-label="next file"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
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
  </div>
</div>

<FullscreenOverlay
  isFullscreen={viewer.state.isFullscreen && !!fileSrc}
  fsControlsVisible={viewer.state.fsControlsVisible}
  tsEditMenuVisible={markerStore.tsEditMenu.visible}
  {isAudio}
  {isPdf}
  showPagePanel={pdf.state.showPagePanel}
  {fileName}
  {handleViewerScroll}
  drawActive={markup.drawActive}
  {startPan}
  handleTouchZoom={viewer.handleTouchZoom}
  handleTouchEnd={viewer.handleTouchEnd}
  fsCursor={style.fsCursor}
  {minimizeWindow}
  {maximizeWindow}
  {closeWindow}
  {navigate}
  {isVideo}
  {videoEl}
  {isGifVideo}
  {timelineProps}
  {playbackProps}
  toggleFullscreen={viewer.toggleFullscreen}
  fileListLength={fileList.length}
  {currentIndex}
  {fsPillEl}
  slideshowActive={slideshow.active}
  {toggleThumbnailBar}
  {handleFsPillContext}
  sortMenuVisible={sort.menuVisible}
  sortMenuX={sort.menuX}
  sortMenuY={sort.menuY}
  sortMode={sort.mode}
  sortDesc={sort.desc}
  {onSortChange}
  sortClose={sort.close}
/>
