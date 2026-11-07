import { loadFont, saveFont } from "$lib/services/storage";

export type FontFamily = "geist" | "satoshi" | "system";

// CJK faces are fallbacks only: Latin glyphs still come from the chosen face.
// The actual fallback stack is locale-aware via --cjk-font (see variables.css).
const CJK_FALLBACK =
  'var(--cjk-font, "Yu Gothic UI", "Microsoft YaHei UI", "Malgun Gothic")';

const FONT_MAP: Record<Exclude<FontFamily, "system">, string> = {
  geist: `'Geist', ${CJK_FALLBACK}, sans-serif`,
  satoshi: `'Satoshi', ${CJK_FALLBACK}, sans-serif`,
};

const SYSTEM_FONT = `'Segoe UI Variable Text', 'Segoe UI', ${CJK_FALLBACK}, sans-serif`;

function createFont() {
  const saved = loadFont();
  let family = $state<FontFamily>(saved);

  function applyFont(f: FontFamily) {
    document.documentElement.style.setProperty(
      "--font-family",
      f === "system" ? SYSTEM_FONT : FONT_MAP[f],
    );
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
