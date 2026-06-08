import { invoke } from "@tauri-apps/api/core";

export type CropBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

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
  let originalBackupPath = $state<string | null>(null);
  let isApplied = $state(false);
  let isExporting = $state(false);
  let isApplying = $state(false);
  let cropMode = $state(false);
  let _cropShouldCenter = $state(false);
  const SESSION_EDITS_MAX = 100;
  const sessionEdits = new Map<string, EditSnapshot>();
  const sessionEditsOrder: string[] = [];

  function saveCurrentToSession() {
    if (filePath && getHasEdits()) {
      sessionEdits.set(filePath, cloneSnapshot(snapshot));
      sessionEditsOrder.push(filePath);
      if (sessionEditsOrder.length > SESSION_EDITS_MAX) {
        const oldest = sessionEditsOrder.shift();
        if (oldest !== undefined) sessionEdits.delete(oldest);
      }
    }
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

  async function backupOriginal(path: string) {
    if (originalBackupPath) return;
    try {
      const backupPath: string = await invoke("backup_file", { source: path });
      originalBackupPath = backupPath;
    } catch (e) {
      console.error("backup_file failed (non-fatal):", e);
    }
  }

  async function restoreOriginal() {
    if (!originalBackupPath) return;
    try {
      await invoke("copy_file", {
        source: originalBackupPath,
        destination: filePath,
      });
    } catch (e) {
      console.error("restoreOriginal failed (non-fatal):", e);
    }
  }

  async function reset() {
    if (isApplied) {
      await restoreOriginal();
      isApplied = false;
    }
    snapshot = defaultSnapshot();
    undoStack = [];
    cropMode = false;
    _cropShouldCenter = false;
  }

  function switchFile(newPath: string) {
    saveCurrentToSession();
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
    isApplied = false;
    originalBackupPath = null;
  }

  function cleanup() {
    saveCurrentToSession();
    undoStack = [];
    snapshot = defaultSnapshot();
    cropMode = false;
    _cropShouldCenter = false;
    isApplied = false;
    filePath = "";
    originalBackupPath = null;
    isExporting = false;
    isApplying = false;
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
    reset,
    cleanup,
    setFilePath,
  };
}

export const editing = createEditingStore();
