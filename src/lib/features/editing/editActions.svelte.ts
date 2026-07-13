// Edit actions
import { save } from "@tauri-apps/plugin-dialog";
import { getFileExt } from "$lib/services/files";
import { editing } from "$lib/features/editing/editing.svelte";
import { markup } from "$lib/features/markup/markup.svelte";
import {
  exportEditedImage,
  invokeExportEditedMedia,
} from "$lib/features/media/api";
  import { menuStore } from "$lib/features/menus/menuVisibility.svelte";
import {
  showToast,
  updateToast,
  dismissToast,
} from "$lib/components/toast.svelte";
import {
  loadSkipApplyConfirm,
  saveSkipApplyConfirm,
} from "$lib/services/storage";

export type PendingEditAction = "apply" | "export" | null;
export type ExportFormatOverride = "png" | null;

function createEditDialogStore() {
  let editApplyConfirm = $state(false);
  let editTransparencyConfirm = $state(false);
  let pendingEditAction = $state<PendingEditAction>(null);
  let exportFormatOverride = $state<ExportFormatOverride>(null);

  return {
    get editApplyConfirm() {
      return editApplyConfirm;
    },
    set editApplyConfirm(v: boolean) {
      editApplyConfirm = v;
    },
    get editTransparencyConfirm() {
      return editTransparencyConfirm;
    },
    set editTransparencyConfirm(v: boolean) {
      editTransparencyConfirm = v;
    },
    get pendingEditAction() {
      return pendingEditAction;
    },
    set pendingEditAction(v: PendingEditAction) {
      pendingEditAction = v;
    },
    get exportFormatOverride() {
      return exportFormatOverride;
    },
    set exportFormatOverride(v: ExportFormatOverride) {
      exportFormatOverride = v;
    },
    closeAll() {
      editApplyConfirm = false;
      editTransparencyConfirm = false;
      pendingEditAction = null;
      exportFormatOverride = null;
    },
  };
}

export const editDialogStore = createEditDialogStore();

export interface EditActionsDeps {
  getFilePath: () => string;
  getFileName: () => string;
  getIsVideo: () => boolean;
  getVideoEl: () => HTMLVideoElement | null;
  loadFile: (path: string) => Promise<void>;
  handleMarkupApply?: () => Promise<void>;
  handleMarkupExport?: () => Promise<void>;
  handleClearMarkup?: () => void;
}

const WARNING_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #eab308"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const APPLY_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4ade80"><path d="M20 6L9 17l-5-5"/></svg>';
const RESET_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
const CONFIRM_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

export function createEditActions(deps: EditActionsDeps) {
  let applyNoAsk = $state(loadSkipApplyConfirm());
  let unsavedToastId = $state<number | null>(null);
  let unsavedToastDismissed = $state(false);
  let resetConfirming = $state(false);
  let resetConfirmTimeout: ReturnType<typeof setTimeout> | null = $state(null);

  function getToastActions() {
    if (resetConfirming) {
      return [
        {
          icon: CONFIRM_ICON,
          tooltip: "Confirm?",
          variant: "red" as const,
          onClick: executeReset,
        },
        {
          icon: APPLY_ICON,
          tooltip: "Apply",
          variant: "green" as const,
          onClick: () => handleApplyEdits(),
        },
      ];
    }
    return [
      {
        icon: RESET_ICON,
        tooltip: "Reset",
        variant: "red" as const,
        onClick: startResetConfirm,
      },
      {
        icon: APPLY_ICON,
        tooltip: "Apply",
        variant: "green" as const,
        onClick: () => handleApplyEdits(),
      },
    ];
  }

  function showUnsavedToast() {
    if (unsavedToastId !== null) {
      updateToast(unsavedToastId, {
        message: "File has unsaved changes",
        color: "grey",
        actions: getToastActions(),
      });
      return;
    }
    unsavedToastId = showToast({
      message: "File has unsaved changes",
      color: "grey",
      duration: 0,
      icon: WARNING_ICON,
      prepend: true,
      actions: getToastActions(),
    });
  }

  function syncToastActions() {
    if (unsavedToastId !== null) {
      updateToast(unsavedToastId, { actions: getToastActions() });
    }
  }

  function startResetConfirm() {
    if (resetConfirmTimeout) clearTimeout(resetConfirmTimeout);
    resetConfirming = true;
    syncToastActions();
    resetConfirmTimeout = setTimeout(() => {
      resetConfirming = false;
      syncToastActions();
      resetConfirmTimeout = null;
    }, 5000);
  }

  function executeReset() {
    if (resetConfirmTimeout) clearTimeout(resetConfirmTimeout);
    resetConfirmTimeout = null;
    resetConfirming = false;
    handleReset();
  }

  function hideUnsavedToast() {
    if (unsavedToastId !== null) {
      dismissToast(unsavedToastId);
      unsavedToastId = null;
    }
  }

  function isActionInFlight(): boolean {
    return (
      editDialogStore.editApplyConfirm ||
      editDialogStore.editTransparencyConfirm ||
      editing.isApplying ||
      editing.isExporting
    );
  }

  let prevShouldShow = false;

  $effect(() => {
    const editMenuOpen = menuStore.editMenuVisible;
    const markupMenuOpen = menuStore.markupMenuVisible;
    const snap = editing.snapshot;
    const hasEdits =
      snap.rotation !== 0 ||
      snap.flipped ||
      snap.flippedVertical ||
      snap.brightness !== 1 ||
      snap.contrast !== 1 ||
      snap.saturation !== 1 ||
      snap.hue !== 0 ||
      snap.cropBounds.left !== 0 ||
      snap.cropBounds.top !== 0 ||
      snap.cropBounds.right !== 0 ||
      snap.cropBounds.bottom !== 0 ||
      snap.cropAspectRatio !== null;
    const applied = editing.isApplied;
    const hasUnappliedEdits = hasEdits && !applied;
    const hasUnappliedMarkup = markup.hasUnapplied;
    const shouldShow =
      !unsavedToastDismissed &&
      !isActionInFlight() &&
      ((hasUnappliedEdits && !editMenuOpen) ||
        (hasUnappliedMarkup && !markupMenuOpen));

    if (shouldShow && !prevShouldShow) {
      showUnsavedToast();
    } else if (!shouldShow && prevShouldShow) {
      hideUnsavedToast();
    }
    prevShouldShow = shouldShow;
  });

  function handleUpdateApplyNoAsk(v: boolean) {
    applyNoAsk = v;
  }

  function needsTransparencyDialog(): boolean {
    if (deps.getIsVideo()) return false;
    const ext = getFileExt(deps.getFilePath());
    return (
      ["jpg", "jpeg"].includes(ext) && editing.snapshot.rotation % 90 !== 0
    );
  }

  async function performApply() {
    try {
      editing.isApplying = true;
      await editing.backupOriginal(deps.getFilePath());

      const s = editing.snapshot;
      const filePath = deps.getFilePath();
      const isVideo = deps.getIsVideo();
      const videoEl = deps.getVideoEl();

      if (isVideo) {
        if (!videoEl || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
          throw new Error("Video not ready for export");
        }
        await invokeExportEditedMedia(
          filePath,
          filePath,
          s,
          videoEl.videoWidth,
          videoEl.videoHeight,
        );
      } else if (editDialogStore.exportFormatOverride === "png") {
        const pngPath = filePath.replace(/\.\w+$/, ".png");
        await exportEditedImage(filePath, s, pngPath);
        await deps.loadFile(pngPath);
      } else {
        await exportEditedImage(filePath, s, filePath);
      }

      editing.isApplying = false;
      editing.isApplied = true;
      editing.clearEdits();
      const exportOverride = editDialogStore.exportFormatOverride;
      editDialogStore.exportFormatOverride = null;
      if (!exportOverride) {
        await deps.loadFile(filePath);
      }
      showToast({ message: "Edits applied", color: "green" });
    } catch (err) {
      editing.isApplying = false;
      editDialogStore.exportFormatOverride = null;
      const message =
        err instanceof Error ? err.message : "Failed to apply edits";
      showToast({ message, color: "red" });
    }
  }

  async function performExport() {
    try {
      const filePath = deps.getFilePath();
      const fileName = deps.getFileName();
      const ext = getFileExt(filePath);
      const isVideo = deps.getIsVideo();
      const videoEl = deps.getVideoEl();
      const overrideExt =
        editDialogStore.exportFormatOverride === "png" ? "png" : ext;
      const defaultName =
        fileName.replace(/\.[^.]+$/, "") + "_edited." + overrideExt;

      const outputPath = await save({
        defaultPath: defaultName,
        filters: isVideo
          ? [{ name: "Video", extensions: [ext] }]
          : [{ name: "Image", extensions: [overrideExt] }],
      });

      if (!outputPath) return;

      editDialogStore.exportFormatOverride = null;

      editing.isExporting = true;
      const toastId = showToast({
        message: "Exporting...",
        color: "yellow",
        duration: 0,
      });

      const s = editing.snapshot;
      if (isVideo) {
        if (!videoEl || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) {
          throw new Error("Video not ready for export");
        }
        await invokeExportEditedMedia(
          filePath,
          outputPath,
          s,
          videoEl.videoWidth,
          videoEl.videoHeight,
        );
      } else {
        await exportEditedImage(filePath, s, outputPath);
      }

      editing.isExporting = false;
      unsavedToastDismissed = true;
      hideUnsavedToast();
      updateToast(toastId, {
        message: "Exported!",
        color: "green",
        duration: 5000,
        actions: [
          {
            label: "Open file",
            icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            onClick: () => deps.loadFile(outputPath),
          },
        ],
      });
    } catch (err) {
      editing.isExporting = false;
      const message =
        err instanceof Error ? err.message : "Failed to export file";
      showToast({ message, color: "red" });
    }
  }

  async function handleApplyEdits() {
    const hasEdits = editing.getHasEdits() || editing.getCropBounds() !== null;
    if (!hasEdits && !markup.hasUnapplied) return;
    if (hasEdits) {
      menuStore.editMenuVisible = false;
      editing.exitCropMode();

      if (needsTransparencyDialog()) {
        editDialogStore.pendingEditAction = "apply";
        editDialogStore.editTransparencyConfirm = true;
        return;
      }

      if (applyNoAsk) {
        await performApply();
      } else {
        editDialogStore.editApplyConfirm = true;
        return;
      }
    }
    if (markup.hasUnapplied && deps.handleMarkupApply) {
      menuStore.markupMenuVisible = false;
      if (applyNoAsk) {
        await deps.handleMarkupApply();
      } else {
        editDialogStore.editApplyConfirm = true;
        return;
      }
    }
    hideUnsavedToast();
  }

  async function handleExportEdits() {
    if (!editing.getHasEdits() && !editing.getCropBounds()) {
      showToast({ message: "No edits to export", color: "yellow" });
      return;
    }

    if (needsTransparencyDialog()) {
      editDialogStore.pendingEditAction = "export";
      editDialogStore.editTransparencyConfirm = true;
      return;
    }

    await performExport();
  }

  async function handleTransparencyChoice(choice: "png" | "keep") {
    editDialogStore.editTransparencyConfirm = false;
    const action = editDialogStore.pendingEditAction;
    editDialogStore.pendingEditAction = null;

    if (choice === "png") {
      editDialogStore.exportFormatOverride = "png";
    } else {
      editDialogStore.exportFormatOverride = null;
    }

    if (action === "apply") {
      editDialogStore.editApplyConfirm = true;
    } else if (action === "export") {
      await performExport();
      editDialogStore.exportFormatOverride = null;
    }
  }

  async function handleApplyConfirm() {
    editDialogStore.editApplyConfirm = false;
    if (applyNoAsk) saveSkipApplyConfirm();
    if (markup.hasUnapplied && deps.handleMarkupApply) {
      await deps.handleMarkupApply();
    }
    const hasImageEdits =
      editing.getHasEdits() || editing.getCropBounds() !== null;
    if (hasImageEdits) {
      await performApply();
    }
  }

  async function handleApplyExportInstead() {
    editDialogStore.editApplyConfirm = false;
    editDialogStore.exportFormatOverride = null;
    if (markup.hasUnapplied && deps.handleMarkupExport) {
      await deps.handleMarkupExport();
    }
    const hasImageEdits =
      editing.getHasEdits() || editing.getCropBounds() !== null;
    if (hasImageEdits) {
      await performExport();
    }
  }

  function closeEditApplyConfirm() {
    editDialogStore.editApplyConfirm = false;
    editDialogStore.exportFormatOverride = null;
  }

  function closeEditTransparencyConfirm() {
    editDialogStore.editTransparencyConfirm = false;
    editDialogStore.pendingEditAction = null;
    editDialogStore.exportFormatOverride = null;
  }

  function handleUndo() {
    if (!editing.getCanUndo()) {
      showToast({ message: "Nothing to undo", color: "yellow" });
      return;
    }
    editing.undo();
    showToast({ message: "Edit undone", color: "blue" });
  }

  async function handleReset() {
    await editing.reset();
    if (markup.hasUnapplied && deps.handleClearMarkup) {
      deps.handleClearMarkup();
    }
    showToast({ message: "Edits reset", color: "red" });
  }

  return {
    performApply,
    performExport,
    handleApplyEdits,
    handleExportEdits,
    handleTransparencyChoice,
    handleApplyConfirm,
    handleApplyExportInstead,
    closeEditApplyConfirm,
    closeEditTransparencyConfirm,
    handleUndo,
    handleReset,
    get applyNoAsk() {
      return applyNoAsk;
    },
    handleUpdateApplyNoAsk,
  };
}
