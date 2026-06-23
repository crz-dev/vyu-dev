// Font state
import { loadFont, saveFont } from "$lib/services/storage";

export type FontFamily = "geist" | "satoshi" | "system";

const FONT_MAP: Record<Exclude<FontFamily, "system">, string> = {
  geist: "'Geist', sans-serif",
  satoshi: "'Satoshi', sans-serif",
};

function createFont() {
  const saved = loadFont();
  let family = $state<FontFamily>(saved);

  function applyFont(f: FontFamily) {
    if (f === "system") {
      document.documentElement.style.removeProperty("--font-family");
    } else {
      document.documentElement.style.setProperty("--font-family", FONT_MAP[f]);
    }
  }

  if (typeof document !== "undefined") {
    applyFont(saved);
  }

  function setFont(f: FontFamily) {
    family = f;
    saveFont(f);
    applyFont(f);
  }

  return {
    get family() {
      return family;
    },
    setFont,
  };
}

export const font = createFont();
