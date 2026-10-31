import { onMount } from "svelte";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exists } from "@tauri-apps/plugin-fs";
import { confirm } from "@tauri-apps/plugin-dialog";
import { powerStatus } from "$lib/features/system/powerStatus.svelte";
import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
import { invokeCheckForUpdates } from "$lib/features/system/api";
import { showToast } from "$lib/components/toast.svelte";
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
  openLibrary: () => void;
  saveResumePosition: () => void;
  hasPlayback: () => boolean;
  pausePlayback: () => void;
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
    powerStatus.start();
    systemPrefs.setAlwaysOnTop(systemPrefs.alwaysOnTop);

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const initial = await invoke<string | null>("get_initial_file");
        if (initial) {
          await s.loadFile(initial);
          return;
        }
        if (systemPrefs.startupView === "library") {
          s.openLibrary();
          return;
        }
        if (systemPrefs.startupView === "last-file" && systemPrefs.lastFile) {
          const last = systemPrefs.lastFile;
          if (await exists(last)) {
            await s.loadFile(last);
          } else {
            systemPrefs.clearLastFile();
          }
        }
      } catch (e) {
        console.error("Failed to load initial file:", e);
      }
    })();

    if (systemPrefs.checkUpdatesOnLaunch) {
      void invokeCheckForUpdates()
        .then((result) => {
          if (result.status === "update") {
            showToast({
              message: result.message,
              color: "blue",
              duration: 7000,
            });
          }
        })
        .catch(() => {
          // Update checks are best-effort at launch.
        });
    }

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

    let unlistenOpenFile: () => void = () => {};
    listen<string>("system:open-file", (event) => {
      void s.loadFile(event.payload);
    })
      .then((fn) => {
        unlistenOpenFile = fn;
      })
      .catch((e) => {
        console.error("Failed to register second-instance listener:", e);
      });

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    let unlistenFocus: () => void = () => {};
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focusTimer) {
          clearTimeout(focusTimer);
          focusTimer = null;
        }
        if (focused) return;
        focusTimer = setTimeout(() => {
          focusTimer = null;
          if (systemPrefs.pauseOnFocusLoss && s.hasPlayback()) {
            s.pausePlayback();
          }
        }, 400);
      })
      .then((fn) => {
        unlistenFocus = fn;
      })
      .catch((e) => {
        console.error("Failed to register focus listener:", e);
      });

    window.addEventListener("keydown", s.handleKeydown);
    window.addEventListener("keyup", s.handleKeyup);
    window.addEventListener("mousedown", s.handleGlobalMouseDown);

    const handlePaste = createPasteHandler({ loadFile: s.loadFile });

    window.addEventListener("paste", handlePaste);

    let unlistenClose: () => void = () => {};
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!systemPrefs.confirmCloseWhilePlaying || !s.hasPlayback()) {
          return;
        }
        event.preventDefault();
        const quit = await confirm("Playback is still running. Close Vyu?", {
          title: "Close Vyu",
          kind: "warning",
        });
        if (quit) await getCurrentWindow().destroy();
      })
      .then((fn) => {
        unlistenClose = fn;
      })
      .catch((e) => {
        console.error("Failed to register close listener:", e);
      });

    return () => {
      window.removeEventListener("keydown", s.handleKeydown);
      window.removeEventListener("keyup", s.handleKeyup);
      window.removeEventListener("mousedown", s.handleGlobalMouseDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("beforeunload", saveResumeBeforeUnload);
      clearInterval(resumeInterval);
      if (focusTimer) clearTimeout(focusTimer);
      unlistenDragDrop();
      unlistenOpenFile();
      unlistenFocus();
      unlistenClose();
      powerStatus.stop();
    };
  });
}
