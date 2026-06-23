// Scrub state
function createDiscScrubStore() {
  let discScrubHandlers = $state<{
    onScrubMove: (e: MouseEvent | TouchEvent, newProgress: number) => void;
    onScrubEnd: () => void;
  }>({ onScrubMove: () => {}, onScrubEnd: () => {} });

  return {
    get discScrubHandlers() {
      return discScrubHandlers;
    },
  };
}

export type DiscScrubStore = typeof discScrubStore;
export const discScrubStore = createDiscScrubStore();

export interface ScrubbingDeps {
  getIsVideo: () => boolean;
  getAudioEl: () => HTMLAudioElement | null;
  getVideoEl: () => HTMLVideoElement | null;
  setRawCurrentSecs: (v: number) => void;
  setProgress: (v: number) => void;
  setIsScrubbing: (v: boolean) => void;
}

export function createScrubbingActions(deps: ScrubbingDeps) {
  function startScrubbing(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const mediaEl = deps.getIsVideo() ? deps.getVideoEl() : deps.getAudioEl();
    if (!mediaEl || !mediaEl.duration) return;
    const bar = e.currentTarget as HTMLElement;
    const wasPlaying = !mediaEl.paused;
    mediaEl.pause();
    deps.setIsScrubbing(true);

    // Cache rect at drag start to avoid forced layouts on every mousemove
    const barRect = bar.getBoundingClientRect();
    const SEEK_THROTTLE_MS = 100; // max ~10 seeks/sec during drag — prevents overwhelming 4K decoder
    let pendingTime: number | null = null;
    let seekInProgress = false;
    let lastSeekTime = 0;
    // RAF-coalesced UI updates at vsync rate
    let uiRafId: number | null = null;
    let uiSecs: number | null = null;
    let uiProgress: number | null = null;

    const computeTime = (clientX: number): number => {
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - barRect.left) / barRect.width),
      );
      return ratio * mediaEl!.duration;
    };

    const doSeek = (time: number) => {
      seekInProgress = true;
      mediaEl!.currentTime = time;
      // Use intended position, not currentTime (may lag behind setter)
      deps.setRawCurrentSecs(time);
      deps.setProgress((time / mediaEl!.duration) * 100);
    };

    const onSeeked = () => {
      seekInProgress = false;
      if (pendingTime !== null) {
        const t = pendingTime;
        pendingTime = null;
        lastSeekTime = Date.now();
        doSeek(t);
      }
    };

    mediaEl.addEventListener("seeked", onSeeked);
    doSeek(computeTime(e.clientX));

    function flushUI() {
      if (uiSecs !== null) {
        deps.setRawCurrentSecs(uiSecs);
        deps.setProgress(uiProgress!);
        uiSecs = null;
        uiProgress = null;
      }
      uiRafId = null;
    }

    function onMouseMove(ev: MouseEvent) {
      const time = computeTime(ev.clientX);
      // RAF-coalesce UI updates
      uiSecs = time;
      uiProgress = (time / mediaEl!.duration) * 100;
      if (!uiRafId) {
        uiRafId = requestAnimationFrame(flushUI);
      }

      if (seekInProgress) {
        // A seek is in flight — coalesce into pendingTime; the seeked handler will pick it up.
        pendingTime = time;
      } else if (Date.now() - lastSeekTime >= SEEK_THROTTLE_MS) {
        doSeek(time);
        lastSeekTime = Date.now();
      } else {
        // Within throttle window — queue for the next seeked or mouseup
        pendingTime = time;
      }
    }

    function onMouseUp() {
      deps.setIsScrubbing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      mediaEl!.removeEventListener("seeked", onSeeked);
      if (uiRafId !== null) {
        cancelAnimationFrame(uiRafId);
        uiRafId = null;
      }
      flushUI();
      // Final seek to the last pending position. Cancels any in-flight seek — the browser will decode the new target.
      if (pendingTime !== null) {
        seekInProgress = true;
        mediaEl!.currentTime = pendingTime;
        deps.setRawCurrentSecs(pendingTime);
        deps.setProgress((pendingTime / mediaEl!.duration) * 100);
      }
      if (wasPlaying) mediaEl!.play();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function startDiscScrubbing(e: MouseEvent | TouchEvent) {
    const audioEl = deps.getAudioEl();
    if (!audioEl || !audioEl.duration) return;
    const wasPlaying = !audioEl.paused;
    audioEl.pause();
    deps.setIsScrubbing(true);

    const SEEK_THROTTLE_MS = 100;
    let pendingTime: number | null = null;
    let seekInProgress = false;
    let lastSeekTime = 0;
    // RAF-coalesce UI updates
    let uiRafId: number | null = null;
    let uiSecs: number | null = null;
    let uiProgress: number | null = null;

    const doSeek = (time: number) => {
      seekInProgress = true;
      audioEl!.currentTime = time;
      deps.setRawCurrentSecs(time);
      deps.setProgress((time / audioEl!.duration) * 100);
    };

    const onSeeked = () => {
      seekInProgress = false;
      if (pendingTime !== null) {
        const t = pendingTime;
        pendingTime = null;
        lastSeekTime = Date.now();
        doSeek(t);
      }
    };

    audioEl.addEventListener("seeked", onSeeked);

    function flushUI() {
      if (uiSecs !== null) {
        deps.setRawCurrentSecs(uiSecs);
        deps.setProgress(uiProgress!);
        uiSecs = null;
        uiProgress = null;
      }
      uiRafId = null;
    }

    discScrubStore.discScrubHandlers.onScrubMove = (_e, newProgress) => {
      const time = (newProgress / 100) * audioEl!.duration;
      // RAF-coalesce UI updates
      uiSecs = time;
      uiProgress = newProgress;
      if (!uiRafId) {
        uiRafId = requestAnimationFrame(flushUI);
      }

      if (seekInProgress) {
        pendingTime = time;
      } else if (Date.now() - lastSeekTime >= SEEK_THROTTLE_MS) {
        doSeek(time);
        lastSeekTime = Date.now();
      } else {
        pendingTime = time;
      }
    };

    discScrubStore.discScrubHandlers.onScrubEnd = () => {
      deps.setIsScrubbing(false);
      audioEl!.removeEventListener("seeked", onSeeked);
      if (uiRafId !== null) {
        cancelAnimationFrame(uiRafId);
        uiRafId = null;
      }
      flushUI();
      if (pendingTime !== null) {
        seekInProgress = true;
        audioEl!.currentTime = pendingTime;
        deps.setRawCurrentSecs(pendingTime);
        deps.setProgress((pendingTime / audioEl!.duration) * 100);
      }
      if (wasPlaying) audioEl!.play();
      discScrubStore.discScrubHandlers.onScrubMove = () => {};
      discScrubStore.discScrubHandlers.onScrubEnd = () => {};
    };
  }

  return {
    startScrubbing,
    startDiscScrubbing,
  };
}
