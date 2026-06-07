import { invokeDeleteFile, invokeTrashFile } from "$lib/features/media/tools";
import {
  loadSkipDeleteConfirmation,
  saveSkipDeleteConfirmation,
} from "$lib/services/storage";

export interface DeleteActionsDeps {
  getFilePath: () => string;
  getFileList: () => string[];
  getCurrentIndex: () => number;
  loadFile: (path: string) => Promise<void>;
  closeFile: () => void | Promise<void>;
  showFrameCopyToast: (
    message: string,
    tone: "success" | "error" | "info",
  ) => void;
}

function createDeleteStore() {
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(false);

  return {
    get deleteConfirm() {
      return deleteConfirm;
    },
    set deleteConfirm(v: boolean) {
      deleteConfirm = v;
    },
    get deletePermanently() {
      return deletePermanently;
    },
    set deletePermanently(v: boolean) {
      deletePermanently = v;
    },
    get deleteNoAsk() {
      return deleteNoAsk;
    },
    set deleteNoAsk(v: boolean) {
      deleteNoAsk = v;
    },
  };
}

export const deleteStore = createDeleteStore();

export function createDeleteActions(deps: DeleteActionsDeps) {
  async function performDelete() {
    deleteStore.deleteConfirm = false;
    if (deleteStore.deleteNoAsk) saveSkipDeleteConfirmation();
    const pathToDelete = deps.getFilePath();
    const prevList = [...deps.getFileList()];
    const prevIndex = deps.getCurrentIndex();
    deps.closeFile();
    try {
      if (deleteStore.deletePermanently) await invokeDeleteFile(pathToDelete);
      else await invokeTrashFile(pathToDelete);
      deps.showFrameCopyToast(
        deleteStore.deletePermanently
          ? "File deleted permanently"
          : "File moved to trash",
        "error",
      );
    } catch {
      deps.showFrameCopyToast("Failed to delete file", "error");
    }
    const remaining = prevList.filter((p) => p !== pathToDelete);
    if (remaining.length > 0)
      await deps.loadFile(remaining[Math.min(prevIndex, remaining.length - 1)]);
  }

  function ctxDelete(closeContextMenu: () => void) {
    closeContextMenu();
    if (loadSkipDeleteConfirmation()) void performDelete();
    else deleteStore.deleteConfirm = true;
  }

  return { performDelete, ctxDelete };
}
