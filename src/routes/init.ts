import { onMount } from "svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { tempDir, join } from "@tauri-apps/api/path";
import { writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import {
  invokeGetClipboardFilePath,
  invokeCopyFile,
} from "$lib/features/media/tools";
import { theme } from "$lib/features/theme/theme.svelte";
import {
  cleanupStaleStorageEntries,
  loadVolume,
  loadLoopMode,
  loadSliderMode,
  saveResumePoint,
  deleteResumePoint,
} from "$lib/services/storage";
import { ALL_EXTS } from "$lib/shared/constants";
import { getFileExt } from "$lib/services/files";
import { showToast } from "$lib/features/toast/toast.svelte";
import type { LoopMode } from "$lib/shared/constants";

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

    cleanupStaleStorageEntries();
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
        const nearEnd = s.rawCurrentSecs.get() >= s.rawDurationSecs.get() - 1.5;
        if (!nearEnd) {
          saveResumePoint(s.filePath.get(), s.rawCurrentSecs.get());
        } else {
          deleteResumePoint(s.filePath.get());
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

    async function handlePaste(e: ClipboardEvent) {
      const mediaItem = Array.from(e.clipboardData?.items ?? []).find(
        (item) =>
          item.kind === "file" &&
          (item.type.startsWith("image/") ||
            item.type.startsWith("video/") ||
            item.type.startsWith("audio/")),
      );
      if (mediaItem) {
        const file = mediaItem.getAsFile();
        if (file) {
          const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
          const arrayBuffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          try {
            const tmp = await tempDir();
            const vyuTemp = await join(tmp, "Vyu-temp");
            await mkdir(vyuTemp, { recursive: true });
            const dest = await join(vyuTemp, `vyu-paste-${Date.now()}.${ext}`);
            await writeFile(dest, uint8);
            await s.loadFile(dest);
            showToast({
              message: "Image pasted from clipboard",
              color: "blue",
              duration: 5000,
              actions: [
                {
                  label: "Save",
                  variant: "accent",
                  icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
                  onClick: async () => {
                    const saveExt = getFileExt(dest) || ext;
                    const defaultName = `vyu-export-${Date.now()}.${saveExt}`;
                    const outputPath = await save({
                      defaultPath: defaultName,
                      filters: [{ name: "Media", extensions: [saveExt] }],
                    });
                    if (!outputPath) return;
                    try {
                      await invokeCopyFile(dest, outputPath);
                      showToast({ message: "File saved", color: "green" });
                    } catch (err) {
                      console.error("Failed to save file:", err);
                      showToast({
                        message: "Failed to save file",
                        color: "red",
                      });
                    }
                  },
                },
              ],
            });
          } catch (err) {
            console.error("Failed to paste media:", err);
          }
        }
        return;
      }

      try {
        const clipboardFile = await invokeGetClipboardFilePath();
        if (clipboardFile) {
          const ext = getFileExt(clipboardFile);
          if (ALL_EXTS.includes(ext)) {
            await s.loadFile(clipboardFile);
            return;
          }
        }
      } catch {}

      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text) {
        const lines = text.split(/\r?\n/).map((l) =>
          l
            .trim()
            .replace(/^file:\/\/\//, "")
            .replace(/^file:\/\//, ""),
        );
        const decoded = lines.map((l) => {
          try {
            return decodeURIComponent(l);
          } catch {
            return l;
          }
        });
        const match = decoded.find((l) => {
          const ext = getFileExt(l);
          return ALL_EXTS.includes(ext);
        });
        if (match) {
          await s.loadFile(match);
        }
      }
    }

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
