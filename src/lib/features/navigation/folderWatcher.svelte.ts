// Folder watcher
import { watchImmediate } from "@tauri-apps/plugin-fs";
import { rescanFolder } from "$lib/services/files";
import type { SortMode } from "$lib/shared/constants";

export function createFolderWatcher(opts: {
  getFilePath: () => string;
  getFileList: () => string[];
  getCurrentIndex: () => number;
  getSortMode: () => SortMode;
  getSortDesc: () => boolean;
  setFileList: (v: string[]) => void;
  setCurrentIndex: (v: number) => void;
  loadFile: (path: string) => Promise<void>;
  closeFile: () => void;
}) {
  let unwatchFn: (() => void) | null = null;
  let watchDebounce: ReturnType<typeof setTimeout> | null = null;
  let lastStartedAt = 0;
  let watchGen = 0;

  function stopWatching() {
    watchGen++;
    if (watchDebounce) {
      clearTimeout(watchDebounce);
      watchDebounce = null;
    }
    if (unwatchFn) {
      unwatchFn();
      unwatchFn = null;
    }
  }

  function startWatching(folderPath: string) {
    stopWatching();
    const gen = ++watchGen;
    lastStartedAt = Date.now();
    watchImmediate(
      folderPath,
      () => {
        if (gen !== watchGen) return;
        // Debounce: reset timer on every event
        if (watchDebounce) clearTimeout(watchDebounce);
        watchDebounce = setTimeout(() => {
          watchDebounce = null;
          if (gen !== watchGen) return;
          onFolderChanged(folderPath);
        }, 300);
      },
      { recursive: false },
    )
      .then((unwatch) => {
        if (gen !== watchGen) {
          unwatch();
          return;
        }
        unwatchFn = unwatch;
      })
      .catch((e) => {
        console.error("Failed to start file watcher:", e);
      });
  }

  async function onFolderChanged(folderPath: string) {
    // Suppress the initial watchImmediate callback — it fires right after
    // startWatching but no real filesystem change occurred yet. A 1s window
    // covers the loadFile + rescan cascade without missing real events.
    if (Date.now() - lastStartedAt < 1000) return;

    const prevPath = opts.getFilePath();
    const prevList = [...opts.getFileList()];
    const prevIndex = opts.getCurrentIndex();

    try {
      const newList = await rescanFolder(
        folderPath,
        opts.getSortMode(),
        opts.getSortDesc(),
      );

      const stillHere = newList.indexOf(prevPath);
      if (stillHere !== -1) {
        opts.setFileList(newList);
        opts.setCurrentIndex(stillHere);
        return;
      }

      // File removed — advance to nearest
      if (newList.length > 0) {
        const nextIdx = Math.min(prevIndex, newList.length - 1);
        opts.setFileList(newList);
        await opts.loadFile(newList[nextIdx]);
        return;
      }

      opts.closeFile();
    } catch (e) {
      console.error("onFolderChanged failed:", e);
    }
  }

  return {
    startWatching,
    stopWatching,
    onFolderChanged,
  };
}
