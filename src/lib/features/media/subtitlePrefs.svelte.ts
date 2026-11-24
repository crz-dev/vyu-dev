import { loadSubtitleStyle, saveSubtitleStyle } from "$lib/services/storage";
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

  function enableCustom() {
    update({ ...style, preset: "custom", useFileStyles: false });
  }

  return {
    get settings() {
      return style;
    },
    setPreset,
    setSize,
    setFontFamily,
    setTextColor,
    setOutline,
    setBackground,
    enableCustom,
  };
}

export const subtitlePrefs = createSubtitlePrefs();
