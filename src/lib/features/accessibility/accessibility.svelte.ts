// Accessibility state — color blind filter
import { loadColorBlindMode, saveColorBlindMode } from "$lib/services/storage";

export type ColorBlindMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia";

function createAccessibility() {
  const saved = loadColorBlindMode();
  let colorBlindMode = $state<ColorBlindMode>(saved);

  function setColorBlindMode(mode: ColorBlindMode) {
    colorBlindMode = mode;
    saveColorBlindMode(mode);
  }

  return {
    get colorBlindMode() {
      return colorBlindMode;
    },
    setColorBlindMode,
  };
}

export const accessibility = createAccessibility();
