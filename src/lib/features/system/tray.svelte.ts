import {
  invokeGetSystemConfig,
  invokeSetCloseToTray,
  invokeSetShowTrayIcon,
  invokeUpdateTrayMenu,
} from "$lib/features/system/api";
import { locale } from "$lib/features/i18n/locale.svelte";

function createTrayPrefs() {
  let showTrayIcon = $state(true);
  let closeToTray = $state(false);
  let loaded = $state(false);

  async function load() {
    try {
      const config = await invokeGetSystemConfig();
      showTrayIcon = config.showTrayIcon;
      closeToTray = config.closeToTray;
    } catch (e) {
      console.error("Failed to load tray settings:", e);
    } finally {
      loaded = true;
    }
    await syncMenuLabels();
  }

  async function setShowTrayIcon(enabled: boolean) {
    await invokeSetShowTrayIcon(enabled);
    showTrayIcon = enabled;
    if (!enabled) closeToTray = false;
  }

  async function setCloseToTray(enabled: boolean) {
    await invokeSetCloseToTray(enabled);
    closeToTray = enabled;
  }

  async function syncMenuLabels() {
    const t = locale.t;
    try {
      await invokeUpdateTrayMenu({
        show: t("shell.tray.show"),
        hide: t("shell.tray.hide"),
        playPause: t("shell.tray.playPause"),
        next: t("shell.tray.next"),
        previous: t("shell.tray.previous"),
        quit: t("shell.tray.quit"),
      });
    } catch (e) {
      console.error("Failed to update tray menu labels:", e);
    }
  }

  return {
    get showTrayIcon() {
      return showTrayIcon;
    },
    get closeToTray() {
      return closeToTray;
    },
    get loaded() {
      return loaded;
    },
    load,
    setShowTrayIcon,
    setCloseToTray,
    syncMenuLabels,
  };
}

export const trayPrefs = createTrayPrefs();
