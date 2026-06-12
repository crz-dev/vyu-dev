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
  import type { ViewerStore } from "./viewer.svelte";
  import type { ViewerStyleStore } from "./viewerStyle.svelte";
  import type { MarkupStore } from "$lib/features/markup/markup.svelte";
  import type { CorruptionStore } from "$lib/features/media/corruption.svelte";
  import type { SlideshowStore } from "$lib/features/media/slideshow.svelte";
  import type { MarkersStore } from "$lib/features/markers/markers.svelte";
  import type { MenuVisibilityStore } from "$lib/features/stores/menuVisibility.svelte";
  import type { SortStore } from "$lib/features/navigation/sort.svelte";
  import type { DiscScrubStore } from "$lib/features/media/scrubbing.svelte";
  import type { LoopModeStoreType } from "$lib/features/media/loopMode.svelte";
  import type { PlaybackUIStore } from "$lib/features/media/playback.svelte";
  import type { ClipsStore } from "$lib/features/media/clips.svelte";
  import type { PdfStore } from "$lib/features/pdf/pdf.svelte";

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
    !markup.drawActive &&
    !markup.selectActive &&
    !markup.removeActive
      ? startPan
      : undefined}
    ontouchstart={(e) => {
      if (e.touches.length === 2) e.preventDefault();
    }}
    ontouchmove={viewer.handleTouchZoom}
    ontouchend={viewer.handleTouchEnd}
    style="cursor: {markup.drawActive ||
    markup.selectActive ||
    markup.removeActive
      ? markup.cursorStyle
      : !isVideo && !isPdf
        ? style.panCursor
        : 'default'}"
    role="presentation"
  >
    {#if fileSrc && !isVideo && !isAudio && !isPdf}
      <ImageView
        {fileSrc}
        {fileName}
        bind:imageEl
        {onImageLoad}
        onImageError={corruption.onImageError}
        imageStyle={style.imageStyle}
        bind:cropContainerEl
        slideshowActive={slideshow.active}
        slideshowTransition={slideshow.transition}
        {currentIndex}
      />
    {:else if fileSrc && isVideo}
      <VideoView
        {fileSrc}
        bind:videoEl
        {onVideoLoad}
        onVideoError={() => corruption.onVideoError(videoEl)}
        {onMediaEnded}
        bind:cropContainerEl
        drawActive={markup.drawActive}
        markupCursor={markup.cursorStyle}
        {startPan}
        videoWrapperTransform={style.videoWrapperTransform}
        videoInnerStyle={style.videoInnerStyle}
        panCursor={style.panCursor}
        {isGifVideo}
        bind:hoverZone
        tsEditMenuVisible={markerStore.tsEditMenu.visible}
        {timelineProps}
        {playbackProps}
        slideshowActive={slideshow.active}
        slideshowTransition={slideshow.transition}
        {currentIndex}
      />
    {:else if fileSrc && isPdf}
      <PDFView
        bind:pdfContainerEl
        loading={pdf.state.loading}
        error={pdf.state.error}
        pages={pdf.state.pages}
        scale={pdf.state.scale}
        setScale={pdf.setScale}
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
        onAudioError={() => corruption.onAudioError(audioEl)}
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
  isFullscreen={viewer.state.isFullscreen && !!fileSrc}
  fsControlsVisible={viewer.state.fsControlsVisible}
  tsEditMenuVisible={markerStore.tsEditMenu.visible}
  {isAudio}
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
