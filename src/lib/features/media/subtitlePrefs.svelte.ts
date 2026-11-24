import {
  loadSubtitleCustomColors,
  loadSubtitleStyle,
  saveSubtitleCustomColors,
  saveSubtitleStyle,
} from "$lib/services/storage";
import type {
  SubtitleBackground,
  SubtitleOutline,
  SubtitlePreset,
  SubtitleSize,
  SubtitleStyleSettings,
} from "$lib/shared/types";

type Preset = Exclude<SubtitlePreset, "custom">;

const PRESET_VALUES: Record<
  Preset,
  Pick<
    SubtitleStyleSettings,
    "useFileStyles" | "fontFamily" | "textColor" | "outline" | "background"
  >
> = {
  fileStyles: {
    useFileStyles: true,
    fontFamily: "",
    textColor: "#ffffff",
    outline: "thin",
    background: "soft",
  },
  default: {
    useFileStyles: false,
    fontFamily: "",
    textColor: "#ffffff",
    outline: "thin",
    background: "soft",
  },
  highContrast: {
    useFileStyles: false,
    fontFamily: "",
    textColor: "#ffffff",
    outline: "thick",
    background: "solid",
  },
  yellow: {
    useFileStyles: false,
    fontFamily: "",
    textColor: "#ffe44d",
    outline: "thick",
    background: "solid",
  },
};

function createSubtitlePrefs() {
  let style = $state<SubtitleStyleSettings>(loadSubtitleStyle());
  let customColors = $state<string[]>(loadSubtitleCustomColors());

  function update(next: SubtitleStyleSettings) {
    style = next;
    saveSubtitleStyle(next);
  }

  function setPreset(preset: Preset) {
    update({
      ...style,
      ...PRESET_VALUES[preset],
      preset,
    });
  }

  function setUseFileStyles(enabled: boolean) {
    update({
      ...style,
      useFileStyles: enabled,
      preset: enabled ? "fileStyles" : "custom",
    });
  }

  function setSize(size: SubtitleSize) {
    update({ ...style, size });
  }

  function setFontFamily(fontFamily: string) {
    update({ ...style, preset: "custom", useFileStyles: false, fontFamily });
  }

  function setTextColor(textColor: string) {
    update({ ...style, preset: "custom", useFileStyles: false, textColor });
  }

  function setOutline(outline: SubtitleOutline) {
    update({ ...style, preset: "custom", useFileStyles: false, outline });
  }

  function setBackground(background: SubtitleBackground) {
    update({ ...style, preset: "custom", useFileStyles: false, background });
  }

  function setCustomColor(index: number, color: string) {
    if (index < 0 || index >= customColors.length) return;
    const next = [...customColors];
    next[index] = color;
    customColors = next;
    saveSubtitleCustomColors(next);
    if (color) {
      update({
        ...style,
        preset: "custom",
        useFileStyles: false,
        textColor: color,
      });
    }
  }

  function enableCustom() {
    update({ ...style, preset: "custom", useFileStyles: false });
  }

  return {
    get settings() {
      return style;
    },
    get customColors() {
      return customColors;
    },
    setPreset,
    setUseFileStyles,
    setSize,
    setFontFamily,
    setTextColor,
    setOutline,
    setBackground,
    setCustomColor,
    enableCustom,
  };
}

export const subtitlePrefs = createSubtitlePrefs();
