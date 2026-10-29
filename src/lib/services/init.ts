import { onMount } from "svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  cleanupStaleStorageEntries,
  loadVolume,
  loadDefaultVolume,
  loadLoopMode,
  loadSliderMode,
  loadRememberVolume,
} from "$lib/services/storage";
import { migrateFromLocalStorage } from "$lib/services/database";
import type { LoopMode } from "$lib/shared/constants";
import { createPasteHandler } from "$lib/features/file-actions/paste";

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
  saveResumePosition: () => void;
  handleKeydown: (e: KeyboardEvent) => void;
  handleKeyup: (e: KeyboardEvent) => void;
  handleGlobalMouseDown: (e: MouseEvent) => void;
}

export function setupInit(s: InitState) {
  onMount(() => {
    const rememberVolume = loadRememberVolume();
    s.volume.set(rememberVolume ? loadVolume() : loadDefaultVolume());
    s.loopMode.set(loadLoopMode());
    const sliderPrefs = loadSliderMode();
    s.volumeSliderMode.set(sliderPrefs.volume ?? false);
    s.speedSliderMode.set(sliderPrefs.speed ?? false);
    s.playbackUI.initSliderMode(
      s.volumeSliderMode.get(),
      s.speedSliderMode.get(),
    );
    s.clips.loadPrefs();

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const initial = await invoke<string | null>("get_initial_file");
        if (initial) await s.loadFile(initial);
      } catch (e) {
        console.error("Failed to load initial file:", e);
      }
    })();

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

    function saveResumeBeforeUnload() {
      s.saveResumePosition();
    }

    window.addEventListener("beforeunload", saveResumeBeforeUnload);

    const resumeInterval = setInterval(() => {
      if (s.isVideo.get() || s.isAudio.get()) s.saveResumePosition();
    }, 10_000);

    let unlistenDragDrop: () => void = () => {};
    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop" && event.payload.paths?.length > 0)
          s.loadFile(event.payload.paths[0]);
      })
      .then((fn) => {
        unlistenDragDrop = fn;
      })
      .catch((e) => {
        console.error("Failed to register drag-drop listener:", e);
      });

    window.addEventListener("keydown", s.handleKeydown);
    window.addEventListener("keyup", s.handleKeyup);
    window.addEventListener("mousedown", s.handleGlobalMouseDown);

    const handlePaste = createPasteHandler({ loadFile: s.loadFile });

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("keydown", s.handleKeydown);
      window.removeEventListener("keyup", s.handleKeyup);
      window.removeEventListener("mousedown", s.handleGlobalMouseDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("beforeunload", saveResumeBeforeUnload);
      clearInterval(resumeInterval);
      unlistenDragDrop();
    };
  });
}
