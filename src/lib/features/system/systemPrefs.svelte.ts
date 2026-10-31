// System preferences
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  clearLastFile as clearStoredLastFile,
  loadAlwaysOnTop,
  loadBatterySaverThumbnails,
  loadExternalAppPaths,
  loadKeepAwake,
  loadLastFile,
  loadPauseOnFocusLoss,
  loadReopenLastFile,
  saveAlwaysOnTop,
  saveBatterySaverThumbnails,
  saveExternalAppPath,
  saveKeepAwake,
  saveLastFile,
  savePauseOnFocusLoss,
  saveReopenLastFile,
  type ExternalAppKind,
  type ExternalAppPaths,
} from "$lib/services/storage";

function createSystemPrefs() {
  let reopenLastFile = $state(loadReopenLastFile());
  let alwaysOnTop = $state(loadAlwaysOnTop());
  let keepAwake = $state(loadKeepAwake());
  let pauseOnFocusLoss = $state(loadPauseOnFocusLoss());
  let batterySaverThumbnails = $state(loadBatterySaverThumbnails());
  let lastFile = $state(loadLastFile());
  let externalApps = $state<ExternalAppPaths>(loadExternalAppPaths());

  async function applyAlwaysOnTop() {
    if (typeof window === "undefined") return;
    try {
      await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
    } catch (e) {
      console.error("Failed to apply always-on-top:", e);
    }
  }

  function setReopenLastFile(enabled: boolean) {
    reopenLastFile = enabled;
    saveReopenLastFile(enabled);
  }

  function setAlwaysOnTop(enabled: boolean) {
    alwaysOnTop = enabled;
    saveAlwaysOnTop(enabled);
    void applyAlwaysOnTop();
  }

  function setKeepAwake(enabled: boolean) {
    keepAwake = enabled;
    saveKeepAwake(enabled);
  }

  function setPauseOnFocusLoss(enabled: boolean) {
    pauseOnFocusLoss = enabled;
    savePauseOnFocusLoss(enabled);
  }

  function setBatterySaverThumbnails(enabled: boolean) {
    batterySaverThumbnails = enabled;
    saveBatterySaverThumbnails(enabled);
  }

  function setLastFile(path: string) {
    lastFile = path;
    saveLastFile(path);
  }

  function clearLastFile() {
    lastFile = "";
    clearStoredLastFile();
  }

  function setExternalApp(kind: ExternalAppKind, path: string) {
    externalApps = { ...externalApps, [kind]: path };
    saveExternalAppPath(kind, path);
  }

  function clearExternalApps() {
    externalApps = { vlc: "", spotify: "", paint: "" };
    saveExternalAppPath("vlc", "");
    saveExternalAppPath("spotify", "");
    saveExternalAppPath("paint", "");
  }

  if (typeof window !== "undefined") {
    void applyAlwaysOnTop();
  }

  return {
    get reopenLastFile() {
      return reopenLastFile;
    },
    get alwaysOnTop() {
      return alwaysOnTop;
    },
    get keepAwake() {
      return keepAwake;
    },
    get pauseOnFocusLoss() {
      return pauseOnFocusLoss;
    },
    get batterySaverThumbnails() {
      return batterySaverThumbnails;
    },
    get lastFile() {
      return lastFile;
    },
    get externalApps() {
      return externalApps;
    },
    setReopenLastFile,
    setAlwaysOnTop,
    setKeepAwake,
    setPauseOnFocusLoss,
    setBatterySaverThumbnails,
    setLastFile,
    clearLastFile,
    setExternalApp,
    clearExternalApps,
  };
}

export const systemPrefs = createSystemPrefs();
