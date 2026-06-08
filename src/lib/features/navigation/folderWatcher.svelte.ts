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

  function stopWatching() {
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
    watchImmediate(
      folderPath,
      () => {
        // Debounce: reset timer on every event
        if (watchDebounce) clearTimeout(watchDebounce);
        watchDebounce = setTimeout(() => {
          watchDebounce = null;
          onFolderChanged(folderPath);
        }, 300);
      },
      { recursive: false },
    )
      .then((unwatch) => {
        unwatchFn = unwatch;
      })
      .catch((e) => {
        console.error("Failed to start file watcher:", e);
      });
  }

  async function onFolderChanged(folderPath: string) {
    const prevPath = opts.getFilePath();
    const prevList = [...opts.getFileList()];
    const prevIndex = opts.getCurrentIndex();

    try {
      const newList = await rescanFolder(
        folderPath,
        opts.getSortMode(),
        opts.getSortDesc(),
      );

      // Current file still exists in the folder
      const stillHere = newList.indexOf(prevPath);
      if (stillHere !== -1) {
        opts.setFileList(newList);
        opts.setCurrentIndex(stillHere);
        return;
      }

      // Current file was removed — advance to nearest neighbor
      if (newList.length > 0) {
        const nextIdx = Math.min(prevIndex, newList.length - 1);
        opts.setFileList(newList);
        await opts.loadFile(newList[nextIdx]);
        return;
      }

      // Folder is now empty
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
