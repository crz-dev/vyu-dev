// System preferences
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  clearLastFile as clearStoredLastFile,
  loadAlwaysOnTop,
  loadBatterySaverThumbnails,
  loadCheckUpdatesOnLaunch,
  loadConfirmCloseWhileEditing,
  loadExternalAppPaths,
  loadKeepAwake,
  loadLastFile,
  loadPauseOnFocusLoss,
  loadStartupView,
  saveAlwaysOnTop,
  saveBatterySaverThumbnails,
  saveCheckUpdatesOnLaunch,
  saveConfirmCloseWhileEditing,
  saveExternalAppPath,
  saveKeepAwake,
  saveLastFile,
  savePauseOnFocusLoss,
  saveStartupView,
  type ExternalAppKind,
  type ExternalAppPaths,
  type StartupView,
} from "$lib/services/storage";

function createSystemPrefs() {
  let startupView = $state<StartupView>(loadStartupView());
  let alwaysOnTop = $state(loadAlwaysOnTop());
  let keepAwake = $state(loadKeepAwake());
  let pauseOnFocusLoss = $state(loadPauseOnFocusLoss());
  let batterySaverThumbnails = $state(loadBatterySaverThumbnails());
  let checkUpdatesOnLaunch = $state(loadCheckUpdatesOnLaunch());
  let confirmCloseWhileEditing = $state(loadConfirmCloseWhileEditing());
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

  function setStartupView(view: StartupView) {
    startupView = view;
    saveStartupView(view);
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

  function setCheckUpdatesOnLaunch(enabled: boolean) {
    checkUpdatesOnLaunch = enabled;
    saveCheckUpdatesOnLaunch(enabled);
  }

  function setConfirmCloseWhileEditing(enabled: boolean) {
    confirmCloseWhileEditing = enabled;
    saveConfirmCloseWhileEditing(enabled);
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
    get startupView() {
      return startupView;
    },
    get reopenLastFile() {
      return startupView === "last-file";
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
    get checkUpdatesOnLaunch() {
      return checkUpdatesOnLaunch;
    },
    get confirmCloseWhileEditing() {
      return confirmCloseWhileEditing;
    },
    get lastFile() {
      return lastFile;
    },
    get externalApps() {
      return externalApps;
    },
    setStartupView,
    setAlwaysOnTop,
    setKeepAwake,
    setPauseOnFocusLoss,
    setBatterySaverThumbnails,
    setCheckUpdatesOnLaunch,
    setConfirmCloseWhileEditing,
    setLastFile,
    clearLastFile,
    setExternalApp,
    clearExternalApps,
  };
}

export const systemPrefs = createSystemPrefs();
