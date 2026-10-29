// Edit actions
import { save } from "@tauri-apps/plugin-dialog";
import { exists, stat } from "@tauri-apps/plugin-fs";
import { getFileExt, joinPath } from "$lib/services/files";
import { editing } from "$lib/features/editing/editing.svelte";
import { markup } from "$lib/features/markup/markup.svelte";
import {
  exportEditedImage,
  invokeExportEditedMedia,
  invokeSetFileModifiedTime,
  onEditApplyProgress,
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

function errorText(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lastLine = raw
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();
  return lastLine ? lastLine.slice(0, 240) : fallback;
}

function createEditDialogStore() {
  let editApplyConfirm = $state(false);
  let editTransparencyConfirm = $state(false);
  let pendingEditAction = $state<PendingEditAction>(null);
  let exportFormatOverride = $state<ExportFormatOverride>(null);
  let applyKeepBackup = $state(true);

  return {
    get editApplyConfirm() {
      return editApplyConfirm;
    },
    get applyKeepBackup() {
      return applyKeepBackup;
    },
    set applyKeepBackup(v: boolean) {
      applyKeepBackup = v;
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
      applyKeepBackup = true;
    },
  };
}

export const editDialogStore = createEditDialogStore();

export interface EditActionsDeps {
  getFilePath: () => string;
  getFileName: () => string;
  getIsVideo: () => boolean;
  getVideoEl: () => HTMLVideoElement | null;
  loadFile: (path: string, refresh?: boolean) => Promise<void>;
  handleMarkupApply?: (keepBackup?: boolean) => Promise<void>;
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

  async function performApply(keepBackup?: boolean) {
    const isVideo = deps.getIsVideo();
    const shouldBackup = keepBackup ?? editing.backupMode === "always";
    let progressToastId: number | null = null;
    let unlisten: (() => void) | null = null;

    if (isVideo) {
      progressToastId = showToast({
        message: "Applying edits...",
        color: "grey",
        duration: 0,
        progress: 0,
      });
      try {
        const toastId = progressToastId;
        unlisten = await onEditApplyProgress((pct) => {
          updateToast(toastId, { progress: pct });
        });
      } catch {
        // progress is best-effort
      }
    }

    try {
      editing.isApplying = true;

      const s = editing.snapshot;
      const filePath = deps.getFilePath();
      const videoEl = deps.getVideoEl();
      const pngOverride =
        !isVideo && editDialogStore.exportFormatOverride === "png";
      const quality = editing.imageQuality / 100;
      const keepOriginalDate = isVideo
        ? editing.keepVideoOriginalDate
        : editing.keepImageOriginalDate;
      let originalMtime: number | null = null;
      if (keepOriginalDate && !pngOverride) {
        try {
          originalMtime = (await stat(filePath)).mtime?.getTime() ?? null;
        } catch {
          // timestamp preservation is best-effort
        }
      }
      if (!pngOverride && shouldBackup) {
        await editing.backupOriginal(filePath, true);
      }

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
          editing.exportQuality,
        );
      } else if (pngOverride) {
        const pngPath = filePath.replace(/\.\w+$/, ".png");
        await exportEditedImage(filePath, s, pngPath, quality);
        await deps.loadFile(pngPath);
      } else {
        await exportEditedImage(filePath, s, filePath, quality);
      }

      if (originalMtime !== null) {
        try {
          await invokeSetFileModifiedTime(filePath, originalMtime);
        } catch (e) {
          console.error("Failed to restore file timestamp:", e);
        }
      }

      editing.isApplying = false;
      editing.isApplied = true;
      editing.clearEdits();
      const exportOverride = editDialogStore.exportFormatOverride;
      editDialogStore.exportFormatOverride = null;
      if (!exportOverride) {
        await deps.loadFile(filePath, true);
      }

      if (progressToastId !== null) {
        updateToast(progressToastId, {
          message: "Edits applied",
          color: "green",
          duration: 3000,
          progress: 100,
        });
      } else {
        showToast({ message: "Edits applied", color: "green" });
      }
    } catch (err) {
      editing.isApplying = false;
      editDialogStore.exportFormatOverride = null;
      const message = errorText(err, "Failed to apply edits");
      if (progressToastId !== null) {
        updateToast(progressToastId, {
          message,
          color: "red",
          duration: 5000,
          progress: null,
        });
      } else {
        showToast({ message, color: "red" });
      }
    } finally {
      unlisten?.();
    }
  }

  async function performExport() {
    try {
      const filePath = deps.getFilePath();
      const fileName = deps.getFileName();
      const ext = getFileExt(filePath);
      const isVideo = deps.getIsVideo();
      const videoEl = deps.getVideoEl();
      const targetExt = isVideo
        ? editing.videoFormat === "original"
          ? ext
          : editing.videoFormat
        : editing.imageFormat === "original"
          ? ext
          : editing.imageFormat;
      const overrideExt =
        editDialogStore.exportFormatOverride === "png" ? "png" : targetExt;
      const defaultName =
        fileName.replace(/\.[^.]+$/, "") + "_edited." + overrideExt;
      const outputDir = isVideo
        ? editing.videoOutputDir
        : editing.imageOutputDir;
      let defaultPath = defaultName;
      if (outputDir) {
        try {
          if (await exists(outputDir)) {
            defaultPath = joinPath(outputDir, defaultName);
          }
        } catch {
          // fall back to the source folder
        }
      }

      const outputPath = await save({
        defaultPath,
        filters: isVideo
          ? [{ name: "Video", extensions: [overrideExt] }]
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
      const quality = editing.imageQuality / 100;
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
          editing.exportQuality,
        );
      } else {
        await exportEditedImage(filePath, s, outputPath, quality);
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
      const autoOpen = isVideo
        ? editing.autoOpenVideoExport
        : editing.autoOpenImageExport;
      if (autoOpen) {
        try {
          await deps.loadFile(outputPath);
        } catch (e) {
          console.error("Failed to auto-open export:", e);
        }
      }
    } catch (err) {
      editing.isExporting = false;
      showToast({
        message: errorText(err, "Failed to export file"),
        color: "red",
      });
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
        editDialogStore.applyKeepBackup = true;
        editDialogStore.editTransparencyConfirm = true;
        return;
      }

      if (applyNoAsk && editing.backupMode !== "ask") {
        await performApply();
      } else {
        editDialogStore.applyKeepBackup = true;
        editDialogStore.editApplyConfirm = true;
        return;
      }
    }
    if (markup.hasUnapplied && deps.handleMarkupApply) {
      menuStore.markupMenuVisible = false;
      if (applyNoAsk && editing.backupMode !== "ask") {
        await deps.handleMarkupApply();
      } else {
        editDialogStore.applyKeepBackup = true;
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
    const keepBackup =
      editing.backupMode === "ask"
        ? editDialogStore.applyKeepBackup
        : undefined;
    if (markup.hasUnapplied && deps.handleMarkupApply) {
      await deps.handleMarkupApply(keepBackup);
    }
    const hasImageEdits =
      editing.getHasEdits() || editing.getCropBounds() !== null;
    if (hasImageEdits) {
      await performApply(keepBackup);
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
    const path = deps.getFilePath();
    const wasApplied = editing.isApplied;
    const restored = await editing.reset();
    if (markup.hasUnapplied && deps.handleClearMarkup) {
      deps.handleClearMarkup();
    }
    if (restored) {
      if (path) await deps.loadFile(path, true);
      showToast({ message: "Original restored", color: "green" });
    } else if (wasApplied) {
      showToast({ message: "Edits cleared - no backup", color: "yellow" });
    } else {
      showToast({ message: "Edits reset", color: "red" });
    }
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
