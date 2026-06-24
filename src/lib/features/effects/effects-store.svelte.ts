// Effects state — reverb, chorus, distortion (ephemeral, not persisted)
import { fxEngine } from "./effects-engine";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

export interface EffectsStore {
  readonly reverb: number;
  readonly chorus: number;
  readonly distortion: number;
  readonly currentFilePath: string;
  loadForFile: (filePath: string) => void;
  setReverb: (value: number) => void;
  setChorus: (value: number) => void;
  setDistortion: (value: number) => void;
  resetAll: () => void;
}

function ensureEngine(): void {
  if (fxEngine.isInitialized()) return;
  const ctx = eqEngine.getContext();
  if (!ctx) return;
  const analyser = eqEngine.getAnalyser();
  if (!analyser) return;
  fxEngine.init(ctx);
  analyser.connect(fxEngine.getInputNode()!);
  eqEngine.setEffectsOutput(fxEngine.getOutputNode()!);
}

function createEffectsStore(): EffectsStore {
  let reverb = $state(0);
  let chorus = $state(0);
  let distortion = $state(0);
  let currentFilePath = $state("");

  function loadForFile(filePath: string) {
    if (!filePath) return;
    currentFilePath = filePath;
    reverb = 0;
    chorus = 0;
    distortion = 0;
  }

  function setReverb(value: number) {
    reverb = value;
    if (value || chorus || distortion) {
      ensureEngine();
      fxEngine.setReverb(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setReverb(0);
    }
  }

  function setChorus(value: number) {
    chorus = value;
    if (reverb || value || distortion) {
      ensureEngine();
      fxEngine.setChorus(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setChorus(0);
    }
  }

  function setDistortion(value: number) {
    distortion = value;
    if (reverb || chorus || value) {
      ensureEngine();
      fxEngine.setDistortion(value);
    } else if (fxEngine.isInitialized()) {
      fxEngine.setDistortion(0);
    }
  }

  function resetAll() {
    reverb = 0;
    chorus = 0;
    distortion = 0;
    if (fxEngine.isInitialized()) {
      fxEngine.setReverb(0);
      fxEngine.setChorus(0);
      fxEngine.setDistortion(0);
    }
  }

  return {
    get reverb() {
      return reverb;
    },
    get chorus() {
      return chorus;
    },
    get distortion() {
      return distortion;
    },
    get currentFilePath() {
      return currentFilePath;
    },
    loadForFile,
    setReverb,
    setChorus,
    setDistortion,
    resetAll,
  };
}

export const effectsStore = createEffectsStore();
