import { invokeDeleteFile, invokeTrashFile } from "$lib/features/media/api";
import {
  loadSkipDeleteConfirmation,
  saveSkipDeleteConfirmation,
} from "$lib/services/storage";
import { showToast } from "$lib/components/toast.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";

export interface DeleteActionsDeps {
  getFilePath: () => string;
  getFileList: () => string[];
  getCurrentIndex: () => number;
  loadFile: (path: string) => Promise<void>;
  closeFile: () => void | Promise<void>;
}

export interface MultiDeleteActionsDeps {
  refreshView: () => void;
}

function createDeleteStore() {
  const skipConfirmations = loadSkipDeleteConfirmation();
  let deleteConfirm = $state(false);
  let deletePermanently = $state(false);
  let deleteNoAsk = $state(skipConfirmations);
  let multiDeleteConfirm = $state(false);
  let multiDeletePermanently = $state(false);
  let multiDeleteNoAsk = $state(skipConfirmations);
  let multiDeletePaths = $state<string[]>([]);

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
    get multiDeleteConfirm() {
      return multiDeleteConfirm;
    },
    set multiDeleteConfirm(v: boolean) {
      multiDeleteConfirm = v;
    },
    get multiDeletePermanently() {
      return multiDeletePermanently;
    },
    set multiDeletePermanently(v: boolean) {
      multiDeletePermanently = v;
    },
    get multiDeleteNoAsk() {
      return multiDeleteNoAsk;
    },
    set multiDeleteNoAsk(v: boolean) {
      multiDeleteNoAsk = v;
    },
    get multiDeletePaths() {
      return multiDeletePaths;
    },
    set multiDeletePaths(v: string[]) {
      multiDeletePaths = v;
    },
  };
}

export const deleteStore = createDeleteStore();

export async function performMultiDelete(deps: MultiDeleteActionsDeps) {
  const paths = [...deleteStore.multiDeletePaths];
  if (paths.length === 0) return;
  deleteStore.multiDeleteConfirm = false;
  if (deleteStore.multiDeleteNoAsk) saveSkipDeleteConfirmation();
  const deleteFn = deleteStore.multiDeletePermanently
    ? invokeDeleteFile
    : invokeTrashFile;
  const results = await Promise.allSettled(paths.map((path) => deleteFn(path)));
  let successCount = 0;
  let failCount = 0;
  for (const result of results) {
    if (result.status === "fulfilled") successCount++;
    else failCount++;
  }
  if (successCount > 0) {
    showToast({
      message: locale.tp("shell.files.deleted", successCount),
      color: "red",
    });
    deps.refreshView();
  }
  if (failCount > 0) {
    showToast({
      message: locale.tp("shell.files.deleteFailedCount", failCount),
      color: "red",
    });
  }
  deleteStore.multiDeletePaths = [];
}

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
      showToast({
        message: deleteStore.deletePermanently
          ? locale.t("shell.files.deletedPermanently")
          : locale.t("shell.files.movedToTrash"),
        color: "red",
      });
    } catch {
      showToast({
        message: locale.t("shell.files.deleteFailed"),
        color: "red",
      });
      if (pathToDelete) await deps.loadFile(pathToDelete);
      return;
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
