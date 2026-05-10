import { onMount } from "svelte";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeGetClipboardFilePath } from "$lib/features/media/tools";
import {
  cleanupStaleStorageEntries,
  loadVolume,
  loadLoopMode,
  loadSliderMode,
  loadClipPreferences,
  saveResumePoint,
  deleteResumePoint,
} from "$lib/services/storage";
import { ALL_EXTS } from "$lib/shared/constants";
import { getFileExt } from "$lib/services/files";
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
  clipOutputDir: { get: () => string; set: (v: string) => void };
  clipDeleteOriginal: { get: () => boolean; set: (v: boolean) => void };
  clipUseCustomPath: { get: () => boolean; set: (v: boolean) => void };
  clipMergeSegments: { get: () => boolean; set: (v: boolean) => void };
  isVideo: { get: () => boolean };
  isAudio: { get: () => boolean };
  filePath: { get: () => string };
  rawCurrentSecs: { get: () => number };
  rawDurationSecs: { get: () => number };
  clipboardToast: {
    get: () => { visible: boolean; filePath: string | null };
    set: (v: { visible: boolean; filePath: string | null }) => void;
  };
  playbackUI: { initSliderMode: (v: boolean, s: boolean) => void };
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
    const prefs = loadClipPreferences();
    s.clipOutputDir.set(prefs.outputDir);
    s.clipDeleteOriginal.set(prefs.deleteOriginal);
    s.clipUseCustomPath.set(prefs.useCustomPath);
    s.clipMergeSegments.set(prefs.mergeSegments);

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
            const { tempDir, join } = await import("@tauri-apps/api/path");
            const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
            const tmp = await tempDir();
            const vyuTemp = await join(tmp, "Vyu-temp");
            await mkdir(vyuTemp, { recursive: true });
            const dest = await join(vyuTemp, `vyu-paste-${Date.now()}.${ext}`);
            await writeFile(dest, uint8);
            await s.loadFile(dest);
            s.clipboardToast.set({ visible: true, filePath: dest });
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
          try { return decodeURIComponent(l); } catch { return l; }
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
