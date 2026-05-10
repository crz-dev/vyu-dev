import { editing } from "$lib/features/editing/editing.svelte";

type CropBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type ViewerState = {
  videoEl: HTMLVideoElement | null;
  isFullscreen: boolean;
  fsControlsVisible: boolean;
  zoomLevel: number;
  baseZoomLevel: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
};

function clampZoom(value: number, min: number): number {
  return Math.max(min, Math.min(1000, value));
}

function createViewer() {
  const state = $state<ViewerState>({
    videoEl: null,
    isFullscreen: false,
    fsControlsVisible: true,
    zoomLevel: 100,
    baseZoomLevel: 100,
    translateX: 0,
    translateY: 0,
    isDragging: false,
  });

  let fsHideTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPinchDist = 0;

  function setVideoEl(el: HTMLVideoElement | null) {
    state.videoEl = el;
  }

  function setDragging(dragging: boolean) {
    state.isDragging = dragging;
  }

  function setTranslation(x: number, y: number) {
    state.translateX = x;
    state.translateY = y;
  }

  function toggleFullscreen() {
    state.isFullscreen = !state.isFullscreen;
    if (state.isFullscreen) resetFsTimer();
  }

  function resetFsTimer() {
    state.fsControlsVisible = true;
    clearTimeout(fsHideTimer);
    fsHideTimer = setTimeout(() => {
      state.fsControlsVisible = false;
    }, 1500);
  }

  function fitToScreen(
    containerWidth: number,
    containerHeight: number,
    imageWidth: number,
    imageHeight: number,
  ) {
    if (
      imageWidth <= 0 ||
      imageHeight <= 0 ||
      containerWidth <= 0 ||
      containerHeight <= 0
    )
      return;

    const isQuarterTurn = Math.abs(editing.snapshot.rotation % 180) === 90;
    const effectiveWidth = isQuarterTurn ? imageHeight : imageWidth;
    const effectiveHeight = isQuarterTurn ? imageWidth : imageHeight;

    const fitScale = Math.min(
      1,
      containerWidth / effectiveWidth,
      containerHeight / effectiveHeight,
    );
    state.baseZoomLevel = fitScale * 100;
    state.zoomLevel = fitScale * 100;
    state.translateX = 0;
    state.translateY = 0;
  }

  function resetZoom() {
    state.zoomLevel = 100;
    state.translateX = 0;
    state.translateY = 0;
  }

  function rotate(angle: number = 90) {
    editing.rotate(angle);
  }

  function flip() {
    editing.flip();
  }

  function getPanCursor(): "default" | "grab" | "grabbing" {
    if (state.zoomLevel <= state.baseZoomLevel) return "default";
    return state.isDragging ? "grabbing" : "grab";
  }

  function getVideoWrapperTransform(): string {
    const scale = state.zoomLevel / 100;
    return `transform: scale(${scale}) translate(${state.translateX / scale}px, ${state.translateY / scale}px); transform-origin: center center;`;
  }

  function getVideoInnerTransform(): string {
    const scale = state.zoomLevel / 100;
    return `transform: scale(${scale}) rotate(${editing.snapshot.rotation}deg) scaleX(${editing.snapshot.flipped ? -1 : 1}) scaleY(${editing.snapshot.flippedVertical ? -1 : 1}); transform-origin: center center;`;
  }

  function handleViewerScroll(e: WheelEvent, fileSrc: string) {
    if (!fileSrc) return;

    e.preventDefault();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const oldScale = state.zoomLevel / 100;
    const raw = state.zoomLevel * (e.deltaY > 0 ? 1 / 1.1 : 1.1);
    const newZoom = clampZoom(raw, state.baseZoomLevel);
    const newScale = newZoom / 100;

    if (newZoom <= state.baseZoomLevel) {
      state.translateX = 0;
      state.translateY = 0;
    } else {
      state.translateX =
        mouseX - (mouseX - state.translateX) * (newScale / oldScale);
      state.translateY =
        mouseY - (mouseY - state.translateY) * (newScale / oldScale);
    }

    state.zoomLevel = newZoom;
  }

  function handleTouchZoom(e: TouchEvent) {
    if (e.touches.length !== 2) return;

    e.preventDefault();

    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (lastPinchDist === 0) {
      lastPinchDist = dist;
      return;
    }

    state.zoomLevel = clampZoom(
      state.zoomLevel * (dist / lastPinchDist),
      state.baseZoomLevel,
    );
    lastPinchDist = dist;
  }

  function handleTouchEnd() {
    lastPinchDist = 0;
  }

  function getCropBounds() {
    return editing.getCropBounds();
  }

  return {
    state,
    setVideoEl,
    setDragging,
    setTranslation,
    toggleFullscreen,
    resetFsTimer,
    fitToScreen,
    resetZoom,
    rotate,
    flip,
    getPanCursor,
    getVideoWrapperTransform,
    getVideoInnerTransform,
    handleViewerScroll,
    handleTouchZoom,
    handleTouchEnd,
    getCropBounds,
  };
}

export const viewer = createViewer();
