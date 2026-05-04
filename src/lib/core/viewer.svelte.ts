export type CropBounds = {
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
  rotation: number;
  flipped: boolean;
  flippedVertical: boolean;
  cropMode: boolean;
  cropBounds: CropBounds;
};

const cropMap = $state(new Map<string, CropBounds>());
let currentFilePath = $state("");

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
    rotation: 0,
    flipped: false,
    flippedVertical: false,
    cropMode: false,
    cropBounds: { left: 0, top: 0, right: 0, bottom: 0 },
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

    const isQuarterTurn = Math.abs(state.rotation % 180) === 90;
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
    state.rotation = (((state.rotation + angle) % 360) + 360) % 360;
  }

  function setRotation(angle: number) {
    state.rotation = ((angle % 360) + 360) % 360;
  }

  function flip() {
    state.flipped = !state.flipped;
  }

  function flipVertical() {
    state.flippedVertical = !state.flippedVertical;
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
    const isQuarterTurn = Math.abs(state.rotation % 180) === 90;
    let rotationFitScale = 1;
    if (isQuarterTurn && state.videoEl) {
      const w = state.videoEl.videoWidth;
      const h = state.videoEl.videoHeight;
      if (w > 0 && h > 0) {
        const ratio = w / h;
        rotationFitScale = Math.min(ratio, 1 / ratio);
      }
    }
    const scale = (state.zoomLevel / 100) * rotationFitScale;
    return `transform: scale(${scale}) rotate(${state.rotation}deg) scaleX(${state.flipped ? -1 : 1}) scaleY(${state.flippedVertical ? -1 : 1}); transform-origin: center center;`;
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

  function setCurrentFile(path: string) {
    currentFilePath = path;
    const saved = cropMap.get(path);
    if (saved) {
      state.cropBounds = { ...saved };
    } else {
      state.cropBounds = { left: 0, top: 0, right: 0, bottom: 0 };
    }
  }

  function hasCropForCurrentFile(): boolean {
    return cropMap.has(currentFilePath);
  }

  function startCropMode() {
    state.cropMode = true;
    const saved = cropMap.get(currentFilePath);
    if (saved) {
      state.cropBounds = { ...saved };
    } else {
      state.cropBounds = { left: 0, top: 0, right: 0, bottom: 0 };
    }
  }

  function cancelCrop() {
    state.cropMode = false;
    const saved = cropMap.get(currentFilePath);
    if (saved) {
      state.cropBounds = { ...saved };
    } else {
      state.cropBounds = { left: 0, top: 0, right: 0, bottom: 0 };
    }
  }

  function resetCrop() {
    state.cropBounds = { left: 0, top: 0, right: 0, bottom: 0 };
    cropMap.delete(currentFilePath);
  }

  function applyCrop() {
    if (
      state.cropBounds.left === 0 &&
      state.cropBounds.top === 0 &&
      state.cropBounds.right === 0 &&
      state.cropBounds.bottom === 0
    ) {
      cropMap.delete(currentFilePath);
    } else {
      cropMap.set(currentFilePath, { ...state.cropBounds });
    }
    state.cropMode = false;
  }

  function setCropBounds(bounds: Partial<CropBounds>) {
    if (bounds.left !== undefined) state.cropBounds.left = bounds.left;
    if (bounds.top !== undefined) state.cropBounds.top = bounds.top;
    if (bounds.right !== undefined) state.cropBounds.right = bounds.right;
    if (bounds.bottom !== undefined) state.cropBounds.bottom = bounds.bottom;
    state.cropBounds.left = Math.max(
      0,
      Math.min(1 - state.cropBounds.right - 0.01, state.cropBounds.left),
    );
    state.cropBounds.top = Math.max(
      0,
      Math.min(1 - state.cropBounds.bottom - 0.01, state.cropBounds.top),
    );
    state.cropBounds.right = Math.max(
      0,
      Math.min(1 - state.cropBounds.left - 0.01, state.cropBounds.right),
    );
    state.cropBounds.bottom = Math.max(
      0,
      Math.min(1 - state.cropBounds.top - 0.01, state.cropBounds.bottom),
    );
  }

  function getCropBounds(): CropBounds | null {
    if (state.cropMode) return state.cropBounds;
    const saved = cropMap.get(currentFilePath);
    if (saved) return saved;
    return null;
  }

  function clearCropCache() {
    cropMap.clear();
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
    setRotation,
    flip,
    flipVertical,
    getPanCursor,
    getVideoWrapperTransform,
    getVideoInnerTransform,
    handleViewerScroll,
    handleTouchZoom,
    handleTouchEnd,
    setCurrentFile,
    hasCropForCurrentFile,
    startCropMode,
    cancelCrop,
    resetCrop,
    applyCrop,
    setCropBounds,
    getCropBounds,
    clearCropCache,
  };
}

export const viewer = createViewer();
