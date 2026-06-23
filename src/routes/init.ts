import { onMount } from "svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  cleanupStaleStorageEntries,
  loadVolume,
  loadLoopMode,
  loadSliderMode,
  saveResumePoint,
  deleteResumePoint,
} from "$lib/services/storage";
import {
  saveResumePoint as dbSaveResumePoint,
  deleteResumePoint as dbDeleteResumePoint,
  migrateFromLocalStorage,
} from "$lib/services/database";
import type { LoopMode } from "$lib/shared/constants";
import { createPasteHandler } from "$lib/features/fileActions/paste";

export interface InitState {
  volume: { get: () => number; set: (v: number) => void };
  loopMode: {
    get: () => LoopMode;
    set: (v: LoopMode) => void;
    save: (v: LoopMode) => void;
  };
  volumeSliderMode: { get: () => boolean; set: (v: boolean) => void };
  speedSliderMode: { get: () => boolean; set: (v: boolean) => void };
  clips: { loadPrefs: () => void };
  isVideo: { get: () => boolean };
  isAudio: { get: () => boolean };
  isPdf: { get: () => boolean };
  filePath: { get: () => string };
  rawCurrentSecs: { get: () => number };
  rawDurationSecs: { get: () => number };
  playbackUI: {
    initSliderMode: (v: boolean, s: boolean) => void;
    setPlaybackSpeed: (v: number) => void;
  };
  loadFile: (path: string) => Promise<void>;
  handleKeydown: (e: KeyboardEvent) => void;
  handleGlobalMouseDown: (e: MouseEvent) => void;
}

export function setupInit(s: InitState) {
  onMount(() => {
    const initial = window.__INITIAL_FILE__;
    if (initial) s.loadFile(initial);

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(
        () => {
          migrateFromLocalStorage();
          cleanupStaleStorageEntries();
        },
        { timeout: 3000 },
      );
    } else {
      setTimeout(() => {
        migrateFromLocalStorage();
        cleanupStaleStorageEntries();
      }, 1500);
    }
    s.volume.set(loadVolume());
    s.loopMode.set(loadLoopMode());
    const sliderPrefs = loadSliderMode();
    s.volumeSliderMode.set(sliderPrefs.volume ?? false);
    s.speedSliderMode.set(sliderPrefs.speed ?? false);
    s.playbackUI.initSliderMode(
      s.volumeSliderMode.get(),
      s.speedSliderMode.get(),
    );
    const prefs = s.clips.loadPrefs();

    function saveResumeBeforeUnload() {
      if (
        (s.isVideo.get() || s.isAudio.get()) &&
        s.filePath.get() &&
        s.rawCurrentSecs.get() > 0 &&
        s.rawDurationSecs.get() > 0
      ) {
        const path = s.filePath.get();
        const cur = s.rawCurrentSecs.get();
        const nearEnd = cur >= s.rawDurationSecs.get() - 1.5;
        if (!nearEnd) {
          saveResumePoint(path, cur);
          dbSaveResumePoint(path, cur);
        } else {
          deleteResumePoint(path);
          dbDeleteResumePoint(path);
        }
      }
    }

    window.addEventListener("beforeunload", saveResumeBeforeUnload);

    let unlistenDragDrop: () => void = () => {};
    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop" && event.payload.paths?.length > 0)
          s.loadFile(event.payload.paths[0]);
      })
      .then((fn) => {
        unlistenDragDrop = fn;
      });

    window.addEventListener("keydown", s.handleKeydown);
    window.addEventListener("mousedown", s.handleGlobalMouseDown);

    const handlePaste = createPasteHandler({ loadFile: s.loadFile });

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("keydown", s.handleKeydown);
      window.removeEventListener("mousedown", s.handleGlobalMouseDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("beforeunload", saveResumeBeforeUnload);
      unlistenDragDrop();
    };
  });
}
