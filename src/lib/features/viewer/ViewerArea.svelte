<script lang="ts">
  import ImageView from "./ImageView.svelte";
  import VideoView from "./VideoView.svelte";
  import PDFView from "./PDFView.svelte";
  import FullscreenOverlay from "./FullscreenOverlay.svelte";
  import AudioPlayer from "$lib/features/media/AudioPlayer.svelte";
  import {
    VOLUME_SEGMENTS,
    type LoopMode,
    type SortMode,
  } from "$lib/shared/constants";

  let {
    fileSrc,
    isVideo,
    isAudio,
    isPdf,
    fileName,
    filePath,
    viewerEl = $bindable(null),
    imageEl = $bindable(null),
    videoEl = $bindable(null),
    audioEl = $bindable(null),
    cropContainerEl = $bindable(null),
    pdfContainerEl = $bindable(null),
    hoverZone = $bindable("none"),
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
    viewerEl: HTMLElement | null;
    imageEl: HTMLImageElement | null;
    videoEl: HTMLVideoElement | null;
    audioEl: HTMLAudioElement | null;
    cropContainerEl: HTMLElement | null;
    pdfContainerEl: HTMLElement | null;
    hoverZone: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    viewer: any;
    style: any;
    markup: any;
    corruption: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slideshow: any;
    markerStore: any;
    menuStore: any;
    sort: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discScrubStore: any;
    loopModeStore: any;
    playbackUI: any;
    clips: any;
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
    pdf: Record<string, unknown>;
    fileDimensions: string;
    fileSize: string;
    fileInfoLoading: boolean;
    isLoadingFile: boolean;
    loadingFadingOut: boolean;
    anyMenuOpen: boolean;
    thumbnailBarVisible: boolean;
    resetZoom: () => void;
  } = $props();
</script>

<div class="content">
  <div
    class="sidebar left"
    onmouseenter={() => (hoverZone = "sidebar")}
    onmouseleave={() => (hoverZone = "none")}
    role="presentation"
  >
    <button
      class="nav-btn"
      onclick={() => navigate(-1)}
      aria-label="previous file">‹</button
    >
  </div>
  <div
    class="viewer"
    bind:this={viewerEl}
    onmouseenter={() => (hoverZone = "sidebar")}
    onmouseleave={() => (hoverZone = "none")}
    onwheel={handleViewerScroll}
    onmousedown={!isVideo &&
    !isPdf &&
    !(markup as { drawActive: boolean }).drawActive
      ? startPan
      : undefined}
    ontouchstart={(e) => {
      if (e.touches.length === 2) e.preventDefault();
    }}
    ontouchmove={(viewer as { handleTouchZoom: (e: TouchEvent) => void })
      .handleTouchZoom}
    ontouchend={(viewer as { handleTouchEnd: () => void }).handleTouchEnd}
    style="cursor: {(markup as { drawActive: boolean }).drawActive
      ? 'crosshair'
      : !isVideo && !isPdf
        ? (style as { panCursor: string }).panCursor
        : 'default'}"
    role="presentation"
  >
    {#if fileSrc && !isVideo && !isAudio && !isPdf}
      <ImageView
        {fileSrc}
        {fileName}
        bind:imageEl
        {onImageLoad}
        onImageError={(corruption as { onImageError: (e: Event) => void })
          .onImageError}
        imageStyle={(style as { imageStyle: string }).imageStyle}
        bind:cropContainerEl
        slideshowActive={(slideshow as { active: boolean }).active}
        slideshowTransition={(slideshow as { transition: string }).transition}
        {currentIndex}
      />
    {:else if fileSrc && isVideo}
      <VideoView
        {fileSrc}
        bind:videoEl
        {onVideoLoad}
        onVideoError={() =>
          (
            corruption as {
              onVideoError: (ve: HTMLVideoElement | null) => void;
            }
          ).onVideoError(videoEl)}
        {onMediaEnded}
        bind:cropContainerEl
        drawActive={(markup as { drawActive: boolean }).drawActive}
        {startPan}
        videoWrapperTransform={(style as { videoWrapperTransform: string })
          .videoWrapperTransform}
        videoInnerStyle={(style as { videoInnerStyle: string }).videoInnerStyle}
        panCursor={(style as { panCursor: string }).panCursor}
        {isGifVideo}
        bind:hoverZone
        tsEditMenuVisible={(markerStore as { tsEditMenu: { visible: boolean } })
          .tsEditMenu.visible}
        {timelineProps}
        {playbackProps}
        slideshowActive={(slideshow as { active: boolean }).active}
        slideshowTransition={(slideshow as { transition: string }).transition}
        {currentIndex}
      />
    {:else if fileSrc && isPdf}
      <PDFView
        bind:pdfContainerEl
        loading={(pdf as { state: { loading: boolean } }).state.loading}
        error={(pdf as { state: { error: string } }).state.error}
        pages={(
          pdf as { state: { pages: { canvasRef: HTMLCanvasElement | null }[] } }
        ).state.pages}
        scale={(pdf as { state: { scale: number } }).state.scale}
        setScale={(pdf as { setScale: (s: number) => void }).setScale}
      />
    {:else if fileSrc && isAudio}
      <AudioPlayer
        {fileSrc}
        {filePath}
        {fileName}
        bind:cdColor
        bind:cdColorIndex
        bind:showCdColorPicker
        {coverArtSrc}
        bind:audioEl
        {onAudioLoad}
        onAudioError={() =>
          (
            corruption as {
              onAudioError: (ae: HTMLAudioElement | null) => void;
            }
          ).onAudioError(audioEl)}
        onAudioEnded={onMediaEnded}
        bind:playing
        loopMode={(loopModeStore as { loopMode: LoopMode }).loopMode}
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
        discScrubHandlers={(discScrubStore as any).discScrubHandlers}
        {startScrubbing}
        {clips}
        timestamps={(markerStore as any).timestamps}
        loopStart={(markerStore as { loopStart: number | null }).loopStart}
        loopEnd={(markerStore as { loopEnd: number | null }).loopEnd}
        resumePoint={(markerStore as { resumePoint: number | null })
          .resumePoint}
        tsEditMenuVisible={(markerStore as { tsEditMenu: { visible: boolean } })
          .tsEditMenu.visible}
        tsMenuOpen={(menuStore as { tsMenuOpen: boolean }).tsMenuOpen}
        loopMenuOpen={(menuStore as { loopMenuOpen: boolean }).loopMenuOpen}
        onTsMenuChange={(v: boolean) =>
          ((menuStore as { tsMenuOpen: boolean }).tsMenuOpen = v)}
        onLoopMenuChange={(v: boolean) =>
          ((menuStore as { loopMenuOpen: boolean }).loopMenuOpen = v)}
        {addTimestamp}
        {addLoopStart}
        {addLoopEnd}
        addClipBoundary={(
          clips as { addClipBoundaryFromMedia: (side: "start" | "end") => void }
        ).addClipBoundaryFromMedia}
        {clearAllTimestamps}
        clearAllSegments={(clips as { clearBoundaries: () => void })
          .clearBoundaries}
        {removeResumePoint}
        {clearLoopMarkers}
        {fileList}
        bind:currentIndex
        {setMediaState}
        {navigate}
        slideshowActive={(slideshow as { active: boolean }).active}
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
      />
    {:else}
      <button class="empty" onclick={openFileDialog}
        ><span class="empty-icon">+</span><span class="empty-text"
          >open a file</span
        ></button
      >
    {/if}
  </div>
  <div
    class="sidebar right"
    onmouseenter={() => (hoverZone = "sidebar")}
    onmouseleave={() => (hoverZone = "none")}
    role="presentation"
  >
    <button class="nav-btn" onclick={() => navigate(1)} aria-label="next file"
      >›</button
    >
  </div>
</div>

<FullscreenOverlay
  isFullscreen={(viewer as { state: { isFullscreen: boolean } }).state
    .isFullscreen && !!fileSrc}
  fsControlsVisible={(viewer as { state: { fsControlsVisible: boolean } }).state
    .fsControlsVisible}
  tsEditMenuVisible={(markerStore as { tsEditMenu: { visible: boolean } })
    .tsEditMenu.visible}
  {isAudio}
  {fileName}
  {handleViewerScroll}
  drawActive={(markup as { drawActive: boolean }).drawActive}
  {startPan}
  handleTouchZoom={(viewer as { handleTouchZoom: (e: TouchEvent) => void })
    .handleTouchZoom}
  handleTouchEnd={(viewer as { handleTouchEnd: () => void }).handleTouchEnd}
  fsCursor={(style as { fsCursor: string }).fsCursor}
  {minimizeWindow}
  {maximizeWindow}
  {closeWindow}
  {navigate}
  {isVideo}
  {videoEl}
  {isGifVideo}
  {timelineProps}
  {playbackProps}
  toggleFullscreen={(viewer as { toggleFullscreen: () => void })
    .toggleFullscreen}
  fileListLength={fileList.length}
  {currentIndex}
  {fsPillEl}
  slideshowActive={(slideshow as { active: boolean }).active}
  {toggleThumbnailBar}
  {handleFsPillContext}
  sortMenuVisible={(sort as { menuVisible: boolean }).menuVisible}
  sortMenuX={(sort as { menuX: number }).menuX}
  sortMenuY={(sort as { menuY: number }).menuY}
  sortMode={(sort as { mode: SortMode }).mode}
  sortDesc={(sort as { desc: boolean }).desc}
  {onSortChange}
  sortClose={(sort as { close: () => void }).close}
/>
