// Effects state — reverb, chorus, distortion, pitch (ephemeral, not persisted)
import { fxEngine } from "./effects-engine";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

export interface EffectsStore {
  readonly pitch: number;
  readonly reverb: number;
  readonly chorus: number;
  readonly distortion: number;
  readonly currentFilePath: string;
  loadForFile: (filePath: string) => void;
  setPitch: (value: number) => void;
  setReverb: (value: number) => void;
  setChorus: (value: number) => void;
  setDistortion: (value: number) => void;
  resetAll: () => void;
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
  let currentFilePath = $state("");

  function loadForFile(filePath: string) {
    if (!filePath) return;
    currentFilePath = filePath;
    pitch = 0;
    reverb = 0;
    chorus = 0;
    distortion = 0;
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

  function resetAll() {
    pitch = 0;
    reverb = 0;
    chorus = 0;
    distortion = 0;
    if (fxEngine.isInitialized()) {
      fxEngine.setPitch(0);
      fxEngine.setReverb(0);
      fxEngine.setChorus(0);
      fxEngine.setDistortion(0);
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
    get currentFilePath() {
      return currentFilePath;
    },
    loadForFile,
    setPitch,
    setReverb,
    setChorus,
    setDistortion,
    resetAll,
  };
}

export const effectsStore = createEffectsStore();
