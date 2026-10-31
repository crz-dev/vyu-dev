// Debug preferences
import { loadDebugOverlay, saveDebugOverlay } from "$lib/services/storage";

function createDebugPrefs() {
  let overlayOpen = $state(loadDebugOverlay());

  function setOverlayOpen(enabled: boolean) {
    overlayOpen = enabled;
    saveDebugOverlay(enabled);
  }

  return {
    get overlayOpen() {
      return overlayOpen;
    },
    setOverlayOpen,
  };
}

export const debugPrefs = createDebugPrefs();
