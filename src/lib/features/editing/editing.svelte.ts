// Editing state
import type { CropBounds } from "$lib/shared/types";
import {
  invokeBackupFile,
  invokeGetBackupPath,
  invokeRestoreBackup,
} from "$lib/features/media/api";
import {
  clearEditSession,
  loadEditAutoOpenExport,
  loadEditBackupDir,
  loadEditBackupMode,
  loadEditCompareEnabled,
  loadEditExportQuality,
  loadEditImageFormat,
  loadEditImageQuality,
  loadEditKeepDate,
  loadEditOutputDir,
  loadEditRememberSession,
  loadEditSession,
  loadEditVideoFormat,
  saveEditAutoOpenExport,
  saveEditBackupDir,
  saveEditBackupMode,
  saveEditCompareEnabled,
  saveEditExportQuality,
  saveEditImageFormat,
  saveEditImageQuality,
  saveEditKeepDate,
  saveEditOutputDir,
  saveEditRememberSession,
  saveEditSession,
  saveEditVideoFormat,
  type EditBackupMode,
  type EditExportQuality,
  type EditImageFormat,
  type EditImageQualityKey,
  type EditVideoFormat,
  type PersistedEditSnapshot,
} from "$lib/services/storage";

export interface EditSnapshot {
  rotation: number;
  flipped: boolean;
  flippedVertical: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  cropBounds: CropBounds;
  cropAspectRatio: number | null;
}

function defaultSnapshot(): EditSnapshot {
  return {
    rotation: 0,
    flipped: false,
    flippedVertical: false,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    cropBounds: { left: 0, top: 0, right: 0, bottom: 0 },
    cropAspectRatio: null,
  };
}

function snapEqual(a: EditSnapshot, b: EditSnapshot): boolean {
  return (
    a.rotation === b.rotation &&
    a.flipped === b.flipped &&
    a.flippedVertical === b.flippedVertical &&
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.saturation === b.saturation &&
    a.hue === b.hue &&
    a.cropAspectRatio === b.cropAspectRatio &&
    a.cropBounds.left === b.cropBounds.left &&
    a.cropBounds.top === b.cropBounds.top &&
    a.cropBounds.right === b.cropBounds.right &&
    a.cropBounds.bottom === b.cropBounds.bottom
  );
}

function cloneSnapshot(s: EditSnapshot): EditSnapshot {
  return {
    rotation: s.rotation,
    flipped: s.flipped,
    flippedVertical: s.flippedVertical,
    brightness: s.brightness,
    contrast: s.contrast,
    saturation: s.saturation,
    hue: s.hue,
    cropBounds: { ...s.cropBounds },
    cropAspectRatio: s.cropAspectRatio,
  };
}

function createEditingStore() {
  let filePath = $state("");
  let snapshot = $state<EditSnapshot>(defaultSnapshot());
  let undoStack = $state<EditSnapshot[]>([]);
  let isApplied = $state(false);
  let backupMode = $state<EditBackupMode>(loadEditBackupMode());
  let hasBackup = $state(false);
  let backupCheckGen = 0;
  let isExporting = $state(false);
  let isApplying = $state(false);
  let cropMode = $state(false);
  let _cropShouldCenter = $state(false);
  let exportQuality = $state<EditExportQuality>(loadEditExportQuality());
  let imageOutputDir = $state(loadEditOutputDir("image"));
  let videoOutputDir = $state(loadEditOutputDir("video"));
  let imageFormat = $state<EditImageFormat>(loadEditImageFormat());
  let videoFormat = $state<EditVideoFormat>(loadEditVideoFormat());
  let imageQuality = $state<Record<EditImageQualityKey, number>>({
    original: loadEditImageQuality("original"),
    jpg: loadEditImageQuality("jpg"),
    webp: loadEditImageQuality("webp"),
  });
  let keepImageOriginalDate = $state(loadEditKeepDate("image"));
  let keepVideoOriginalDate = $state(loadEditKeepDate("video"));
  let autoOpenImageExport = $state(loadEditAutoOpenExport("image"));
  let autoOpenVideoExport = $state(loadEditAutoOpenExport("video"));
  let compareEnabled = $state(loadEditCompareEnabled());
  let backupDir = $state(loadEditBackupDir());
  const initialRememberEdits = loadEditRememberSession();
  let rememberEdits = $state(initialRememberEdits);
  let compareOriginal = $state(false);
  const SESSION_EDITS_MAX = 100;
  const sessionEdits = new Map<string, EditSnapshot>();
  const sessionEditsOrder: string[] = [];

  if (initialRememberEdits) {
    const saved = loadEditSession();
    for (const [path, savedSnapshot] of Object.entries(saved)) {
      sessionEdits.set(path, cloneSnapshot(savedSnapshot));
      sessionEditsOrder.push(path);
    }
  }

  function persistSession() {
    if (!rememberEdits) return;
    const session: Record<string, PersistedEditSnapshot> = {};
    for (const [path, savedSnapshot] of sessionEdits) {
      session[path] = cloneSnapshot(savedSnapshot);
    }
    saveEditSession(session);
  }

  function saveCurrentToSession() {
    if (!filePath) return;
    const index = sessionEditsOrder.indexOf(filePath);
    if (index !== -1) sessionEditsOrder.splice(index, 1);
    if (getHasEdits()) {
      sessionEdits.set(filePath, cloneSnapshot(snapshot));
      sessionEditsOrder.push(filePath);
      if (sessionEditsOrder.length > SESSION_EDITS_MAX) {
        const oldest = sessionEditsOrder.shift();
        if (oldest !== undefined) sessionEdits.delete(oldest);
      }
    } else {
      sessionEdits.delete(filePath);
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      saveCurrentToSession();
      persistSession();
    });
  }

  function pushUndo() {
    undoStack = [...undoStack, cloneSnapshot(snapshot)];
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    snapshot = { ...prev, cropBounds: { ...prev.cropBounds } };
    _cropShouldCenter = false;
  }

  function getCanUndo() {
    return undoStack.length > 0;
  }

  function getHasEdits() {
    return !snapEqual(snapshot, defaultSnapshot());
  }

  function startCropMode() {
    compareOriginal = false;
    cropMode = true;
  }

  function exitCropMode() {
    cropMode = false;
  }

  function setCropAspectRatio(ratio: number | null) {
    snapshot.cropAspectRatio = ratio;
    _cropShouldCenter = true;
  }

  function setCropBounds(bounds: Partial<CropBounds>) {
    if (bounds.left !== undefined) snapshot.cropBounds.left = bounds.left;
    if (bounds.top !== undefined) snapshot.cropBounds.top = bounds.top;
    if (bounds.right !== undefined) snapshot.cropBounds.right = bounds.right;
    if (bounds.bottom !== undefined) snapshot.cropBounds.bottom = bounds.bottom;
    snapshot.cropBounds.left = Math.max(
      0,
      Math.min(1 - snapshot.cropBounds.right - 0.01, snapshot.cropBounds.left),
    );
    snapshot.cropBounds.top = Math.max(
      0,
      Math.min(1 - snapshot.cropBounds.bottom - 0.01, snapshot.cropBounds.top),
    );
    snapshot.cropBounds.right = Math.max(
      0,
      Math.min(1 - snapshot.cropBounds.left - 0.01, snapshot.cropBounds.right),
    );
    snapshot.cropBounds.bottom = Math.max(
      0,
      Math.min(1 - snapshot.cropBounds.top - 0.01, snapshot.cropBounds.bottom),
    );
  }

  function resetCrop() {
    snapshot.cropBounds = { left: 0, top: 0, right: 0, bottom: 0 };
  }

  function getCropBounds(): CropBounds | null {
    const b = snapshot.cropBounds;
    if (b.left === 0 && b.top === 0 && b.right === 0 && b.bottom === 0)
      return null;
    return { ...b };
  }

  function rotate(angle: number = 90) {
    snapshot.rotation = (((snapshot.rotation + angle) % 360) + 360) % 360;
  }

  function setRotation(angle: number) {
    snapshot.rotation = ((angle % 360) + 360) % 360;
  }

  function flip() {
    snapshot.flipped = !snapshot.flipped;
  }

  function flipVertical() {
    snapshot.flippedVertical = !snapshot.flippedVertical;
  }

  function setBrightness(v: number) {
    snapshot.brightness = v;
  }

  function setContrast(v: number) {
    snapshot.contrast = v;
  }

  function setSaturation(v: number) {
    snapshot.saturation = v;
  }

  function setHue(v: number) {
    snapshot.hue = v;
  }

  async function backupOriginal(path: string, enabled: boolean) {
    if (!enabled || !path) return;
    try {
      await invokeBackupFile(path, backupDir || undefined);
      hasBackup = true;
    } catch (e) {
      console.error("backup_file failed (non-fatal):", e);
    }
  }

  async function restoreOriginal(): Promise<boolean> {
    if (!filePath) return false;
    try {
      const restored = await invokeRestoreBackup(
        filePath,
        backupDir || undefined,
      );
      hasBackup = restored;
      return restored;
    } catch (e) {
      console.error("restore_backup failed:", e);
      return false;
    }
  }

  function clearEdits() {
    snapshot = defaultSnapshot();
    undoStack = [];
    cropMode = false;
    _cropShouldCenter = false;
    compareOriginal = false;
    if (filePath) sessionEdits.delete(filePath);
    persistSession();
  }

  async function reset(): Promise<boolean> {
    const restored = await restoreOriginal();
    isApplied = false;
    clearEdits();
    return restored;
  }

  async function checkBackup(path: string) {
    const gen = ++backupCheckGen;
    try {
      const backup = await invokeGetBackupPath(path, backupDir || undefined);
      if (gen === backupCheckGen && filePath === path) {
        hasBackup = !!backup;
      }
    } catch {
      if (gen === backupCheckGen && filePath === path) hasBackup = false;
    }
  }

  function switchFile(newPath: string) {
    saveCurrentToSession();
    persistSession();
    filePath = newPath;
    const saved = sessionEdits.get(newPath);
    if (saved) {
      snapshot = cloneSnapshot(saved);
    } else {
      snapshot = defaultSnapshot();
    }
    undoStack = [];
    cropMode = false;
    _cropShouldCenter = false;
    compareOriginal = false;
    isApplied = false;
    hasBackup = false;
    void checkBackup(newPath);
  }

  function cleanup() {
    saveCurrentToSession();
    persistSession();
    undoStack = [];
    snapshot = defaultSnapshot();
    cropMode = false;
    _cropShouldCenter = false;
    compareOriginal = false;
    isApplied = false;
    filePath = "";
    hasBackup = false;
    backupCheckGen++;
    isExporting = false;
    isApplying = false;
  }

  function setBackupMode(mode: EditBackupMode) {
    backupMode = mode;
    saveEditBackupMode(mode);
  }

  function setExportQuality(quality: EditExportQuality) {
    exportQuality = quality;
    saveEditExportQuality(quality);
  }

  function setImageOutputDir(dir: string) {
    imageOutputDir = dir;
    saveEditOutputDir("image", dir);
  }

  function setVideoOutputDir(dir: string) {
    videoOutputDir = dir;
    saveEditOutputDir("video", dir);
  }

  function setBackupDir(dir: string) {
    backupDir = dir;
    saveEditBackupDir(dir);
    if (filePath) void checkBackup(filePath);
  }

  function imageQualityMaxFor(format: EditImageFormat): number {
    return format === "jpg" ? 95 : 100;
  }

  function imageQualityFor(format: EditImageFormat): number {
    if (format === "png") return 100;
    return imageQuality[format];
  }

  function setImageFormat(format: EditImageFormat) {
    imageFormat = format;
    saveEditImageFormat(format);
    if (format === "png") return;
    const max = imageQualityMaxFor(format);
    if (imageQuality[format] > max) {
      imageQuality[format] = max;
      saveEditImageQuality(format, max);
    }
  }

  function setVideoFormat(format: EditVideoFormat) {
    videoFormat = format;
    saveEditVideoFormat(format);
  }

  function setImageQuality(quality: number) {
    if (imageFormat === "png") return;
    const value = Math.min(
      imageQualityMaxFor(imageFormat),
      Math.max(60, Math.round(quality)),
    );
    imageQuality[imageFormat] = value;
    saveEditImageQuality(imageFormat, value);
  }

  function setKeepImageOriginalDate(enabled: boolean) {
    keepImageOriginalDate = enabled;
    saveEditKeepDate("image", enabled);
  }

  function setKeepVideoOriginalDate(enabled: boolean) {
    keepVideoOriginalDate = enabled;
    saveEditKeepDate("video", enabled);
  }

  function setAutoOpenImageExport(enabled: boolean) {
    autoOpenImageExport = enabled;
    saveEditAutoOpenExport("image", enabled);
  }

  function setAutoOpenVideoExport(enabled: boolean) {
    autoOpenVideoExport = enabled;
    saveEditAutoOpenExport("video", enabled);
  }

  function setCompareEnabled(enabled: boolean) {
    compareEnabled = enabled;
    if (!enabled) compareOriginal = false;
    saveEditCompareEnabled(enabled);
  }

  function setRememberEdits(enabled: boolean) {
    rememberEdits = enabled;
    saveEditRememberSession(enabled);
    if (enabled) {
      saveCurrentToSession();
      persistSession();
    } else {
      sessionEdits.clear();
      sessionEditsOrder.length = 0;
      clearEditSession();
    }
  }

  function setCompareOriginal(value: boolean) {
    compareOriginal = compareEnabled && value;
  }

  function clearBackupState() {
    backupCheckGen++;
    hasBackup = false;
  }

  function setFilePath(path: string) {
    filePath = path;
  }

  return {
    get snapshot() {
      return snapshot;
    },
    get isApplied() {
      return isApplied;
    },
    set isApplied(v: boolean) {
      isApplied = v;
    },
    get backupMode() {
      return backupMode;
    },
    get backupDir() {
      return backupDir;
    },
    get exportQuality() {
      return exportQuality;
    },
    get imageOutputDir() {
      return imageOutputDir;
    },
    get videoOutputDir() {
      return videoOutputDir;
    },
    get imageFormat() {
      return imageFormat;
    },
    get videoFormat() {
      return videoFormat;
    },
    get imageQuality() {
      return imageQualityFor(imageFormat);
    },
    get imageQualityMax() {
      return imageQualityMaxFor(imageFormat);
    },
    imageQualityFor,
    get keepImageOriginalDate() {
      return keepImageOriginalDate;
    },
    get keepVideoOriginalDate() {
      return keepVideoOriginalDate;
    },
    get autoOpenImageExport() {
      return autoOpenImageExport;
    },
    get autoOpenVideoExport() {
      return autoOpenVideoExport;
    },
    get compareEnabled() {
      return compareEnabled;
    },
    get rememberEdits() {
      return rememberEdits;
    },
    get compareOriginal() {
      return compareOriginal;
    },
    get previewSnapshot() {
      return compareOriginal ? defaultSnapshot() : snapshot;
    },
    get previewCropBounds() {
      return compareOriginal ? null : getCropBounds();
    },
    get hasBackup() {
      return hasBackup;
    },
    setBackupMode,
    setBackupDir,
    setExportQuality,
    setImageOutputDir,
    setVideoOutputDir,
    setImageFormat,
    setVideoFormat,
    setImageQuality,
    setKeepImageOriginalDate,
    setKeepVideoOriginalDate,
    setAutoOpenImageExport,
    setAutoOpenVideoExport,
    setCompareEnabled,
    setRememberEdits,
    setCompareOriginal,
    clearBackupState,
    get isExporting() {
      return isExporting;
    },
    get isApplying() {
      return isApplying;
    },
    set isApplying(v: boolean) {
      isApplying = v;
    },
    set isExporting(v: boolean) {
      isExporting = v;
    },
    get cropMode() {
      return cropMode;
    },
    get cropShouldCenter() {
      return _cropShouldCenter;
    },
    set cropShouldCenter(v: boolean) {
      _cropShouldCenter = v;
    },
    get filePath() {
      return filePath;
    },
    pushUndo,
    undo,
    getCanUndo,
    getHasEdits,
    startCropMode,
    exitCropMode,
    switchFile,
    setCropAspectRatio,
    setCropBounds,
    resetCrop,
    getCropBounds,
    rotate,
    setRotation,
    flip,
    flipVertical,
    setBrightness,
    setContrast,
    setSaturation,
    setHue,
    backupOriginal,
    clearEdits,
    reset,
    cleanup,
    setFilePath,
  };
}

export const editing = createEditingStore();
