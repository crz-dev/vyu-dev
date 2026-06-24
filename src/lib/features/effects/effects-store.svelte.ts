// Effects state — reverb, chorus, distortion, pitch (ephemeral, not persisted)
import { fxEngine } from "./effects-engine";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

export type FilterPreset = "nightcore" | "lofi" | "eightBit" | "radio";

export interface EffectsStore {
  readonly pitch: number;
  readonly reverb: number;
  readonly chorus: number;
  readonly distortion: number;
  readonly activeFilter: FilterPreset | null;
  readonly currentFilePath: string;
  loadForFile: (filePath: string) => void;
  setPitch: (value: number) => void;
  setReverb: (value: number) => void;
  setChorus: (value: number) => void;
  setDistortion: (value: number) => void;
  setFilter: (preset: FilterPreset | null) => void;
  resetAll: () => void;
  setPlaybackSpeedFn: (fn: ((speed: number) => void) | null) => void;
}

let engineInitPending = false;

function ensureEngine(): void {
  if (fxEngine.isInitialized() || engineInitPending) return;
  const ctx = eqEngine.getContext();
  if (!ctx) return;
  const analyser = eqEngine.getAnalyser();
  if (!analyser) return;
  engineInitPending = true;
  fxEngine
    .init(ctx)
    .then(() => {
      analyser.connect(fxEngine.getInputNode()!);
      eqEngine.setEffectsOutput(fxEngine.getOutputNode()!);
    })
    .finally(() => {
      engineInitPending = false;
    });
}

function createEffectsStore(): EffectsStore {
  let pitch = $state(0);
  let reverb = $state(0);
  let chorus = $state(0);
  let distortion = $state(0);
  let activeFilter = $state<FilterPreset | null>(null);
  let currentFilePath = $state("");
  let playbackSpeedFn: ((speed: number) => void) | null = null;
  let savedPlaybackSpeed: number | null = null;

  function setPlaybackSpeedFn(fn: ((speed: number) => void) | null) {
    playbackSpeedFn = fn;
  }

  function loadForFile(filePath: string) {
    if (!filePath) return;
    currentFilePath = filePath;
    pitch = 0;
    reverb = 0;
    chorus = 0;
    distortion = 0;
    activeFilter = null;
    if (savedPlaybackSpeed !== null && playbackSpeedFn) {
      playbackSpeedFn(savedPlaybackSpeed);
      savedPlaybackSpeed = null;
    }
    if (fxEngine.isInitialized()) {
      fxEngine.setFilter(null);
    }
  }

  function setPitch(value: number) {
    pitch = value;
    if (value || reverb || chorus || distortion) {
      ensureEngine();
      fxEngine.setPitch(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setPitch(0);
    }
  }

  function setReverb(value: number) {
    reverb = value;
    if (value || chorus || distortion || pitch) {
      ensureEngine();
      fxEngine.setReverb(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setReverb(0);
    }
  }

  function setChorus(value: number) {
    chorus = value;
    if (reverb || value || distortion || pitch) {
      ensureEngine();
      fxEngine.setChorus(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setChorus(0);
    }
  }

  function setDistortion(value: number) {
    distortion = value;
    if (reverb || chorus || value || pitch) {
      ensureEngine();
      fxEngine.setDistortion(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setDistortion(0);
    }
  }

  function setFilter(preset: FilterPreset | null) {
    activeFilter = preset;
    ensureEngine();
    if (fxEngine.isInitialized()) {
      fxEngine.setFilter(preset);
    }
    if (preset === "lofi" || preset === "nightcore") {
      if (savedPlaybackSpeed === null && playbackSpeedFn) {
        savedPlaybackSpeed = 1.0;
      }
      playbackSpeedFn?.(preset === "lofi" ? 0.8 : 1.1);
    } else if (savedPlaybackSpeed !== null && playbackSpeedFn) {
      playbackSpeedFn(savedPlaybackSpeed);
      savedPlaybackSpeed = null;
    }
  }

  function resetAll() {
    pitch = 0;
    reverb = 0;
    chorus = 0;
    distortion = 0;
    activeFilter = null;
    if (savedPlaybackSpeed !== null && playbackSpeedFn) {
      playbackSpeedFn(savedPlaybackSpeed);
      savedPlaybackSpeed = null;
    }
    if (fxEngine.isInitialized()) {
      fxEngine.setPitch(0);
      fxEngine.setReverb(0);
      fxEngine.setChorus(0);
      fxEngine.setDistortion(0);
      fxEngine.setFilter(null);
    }
  }

  return {
    get pitch() {
      return pitch;
    },
    get reverb() {
      return reverb;
    },
    get chorus() {
      return chorus;
    },
    get distortion() {
      return distortion;
    },
    get activeFilter() {
      return activeFilter;
    },
    get currentFilePath() {
      return currentFilePath;
    },
    loadForFile,
    setPitch,
    setReverb,
    setChorus,
    setDistortion,
    setFilter,
    resetAll,
    setPlaybackSpeedFn,
  };
}

export const effectsStore = createEffectsStore();
