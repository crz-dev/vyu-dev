// EQ state
import { eqEngine } from "./equalizer-engine";
import {
  loadEqSettings as dbLoadEqSettings,
  saveEqSettings as dbSaveEqSettings,
} from "$lib/services/database";
import { loadEqSettings, saveEqSettings } from "$lib/services/storage";
import { BAND_FREQUENCIES } from "./band-config";

export interface EqState {
  bands: number[];
  bypass: boolean;
  outputGain: number;
  activePreset: string;
}

export interface EqualizerStore {
  readonly bands: number[];
  readonly bypass: boolean;
  readonly outputGain: number;
  readonly activePreset: string;
  readonly currentFilePath: string;
  loadForFile: (filePath: string) => Promise<void>;
  saveForFile: (filePath?: string) => void;
  applyPreset: (name: string, values: number[]) => void;
  setBand: (index: number, value: number) => void;
  setBypass: (value: boolean) => void;
  setOutputGain: (value: number) => void;
  resetAll: () => void;
  resetToSaved: () => void;
}

function createEqualizerStore(): EqualizerStore {
  let bands = $state([...BAND_FREQUENCIES].map(() => 0));
  let bypass = $state(true);
  let outputGain = $state(0);
  let activePreset = $state("Flat");
  let currentFilePath = $state("");

  async function loadForFile(filePath: string) {
    if (!filePath) return;
    currentFilePath = filePath;
    const settings =
      (await dbLoadEqSettings(filePath).catch(() => null)) ??
      loadEqSettings(filePath);
    if (settings) {
      bands = [...settings.bands];
      bypass = settings.bypass;
      outputGain = settings.outputGain;
      activePreset = settings.activePreset;
      eqEngine.applyValues(settings.bands);
      eqEngine.setOutputGain(settings.outputGain);
      eqEngine.setBypass(settings.bypass);
    } else {
      resetAll();
    }
  }

  function saveForFile(filePath?: string) {
    const path = filePath || currentFilePath;
    if (!path) return;
    const settings = {
      bands: [...bands],
      bypass,
      outputGain,
      activePreset,
    };
    dbSaveEqSettings(path, settings);
    saveEqSettings(path, settings);
  }

  function applyPreset(name: string, values: number[]) {
    activePreset = name;
    bands = [...values];
    eqEngine.applyValues(values);
    if (name !== "Flat") {
      bypass = false;
      eqEngine.setBypass(false);
    }
    const gain = name === "Afterparty" ? -6 : 0;
    outputGain = gain;
    eqEngine.setOutputGain(gain);
    saveForFile();
  }

  function setBand(index: number, value: number) {
    const val = Math.round(value);
    const next = [...bands];
    next[index] = val;
    bands = next;
    eqEngine.setBand(index, val);
    if (val !== 0) {
      bypass = false;
      eqEngine.setBypass(false);
    }
    activePreset = "Custom";
    saveForFile();
  }

  function setBypass(value: boolean) {
    bypass = value;
    eqEngine.setBypass(value);
    saveForFile();
  }

  function setOutputGain(value: number) {
    const val = Math.round(value);
    outputGain = val;
    eqEngine.setOutputGain(val);
    saveForFile();
  }

  function resetAll() {
    bands = [...BAND_FREQUENCIES].map(() => 0);
    bypass = true;
    outputGain = 0;
    activePreset = "Flat";
    eqEngine.reset();
    saveForFile();
  }

  function resetToSaved() {
    if (currentFilePath) {
      loadForFile(currentFilePath);
    }
  }

  return {
    get bands() {
      return bands;
    },
    get bypass() {
      return bypass;
    },
    get outputGain() {
      return outputGain;
    },
    get activePreset() {
      return activePreset;
    },
    get currentFilePath() {
      return currentFilePath;
    },
    loadForFile,
    saveForFile,
    applyPreset,
    setBand,
    setBypass,
    setOutputGain,
    resetAll,
    resetToSaved,
  };
}

export const eqStore = createEqualizerStore();
