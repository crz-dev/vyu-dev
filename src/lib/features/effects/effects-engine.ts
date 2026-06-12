import { generateReverbIR } from "./reverb-ir";

class EffectsEngine {
  private ctx: AudioContext | null = null;

  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;
  private reverbMerge: GainNode | null = null;

  private chorusDelay: DelayNode | null = null;
  private chorusLFO: OscillatorNode | null = null;
  private chorusLFOGain: GainNode | null = null;
  private chorusWetGain: GainNode | null = null;
  private chorusDryGain: GainNode | null = null;
  private chorusMerge: GainNode | null = null;

  private distortionShaper: WaveShaperNode | null = null;

  private tailNode: AudioNode | null = null;
  private setupDone = false;

  private audioEl: HTMLMediaElement | null = null;

  setAudioElement(el: HTMLMediaElement | null): void {
    this.audioEl = el;
  }

  /**
   * Builds the effects chain and returns the last node.
   * Call once per media element connection. Idempotent after first setup.
   * Chain: source → reverb(dry+wet) → chorus(dry+wet) → distortion → tail
   */
  setup(ctx: AudioContext, sourceNode: MediaElementAudioSourceNode): AudioNode {
    if (this.setupDone && this.tailNode && this.ctx === ctx) {
      return this.tailNode;
    }

    this.teardown();
    this.ctx = ctx;

    // --- Reverb ---
    const ir = generateReverbIR(ctx, 1.8, 50);
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = ir;
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = 0;
    this.reverbDryGain = ctx.createGain();
    this.reverbDryGain.gain.value = 1;
    this.reverbMerge = ctx.createGain();
    this.reverbMerge.gain.value = 1;

    sourceNode.connect(this.reverbDryGain);
    this.reverbDryGain.connect(this.reverbMerge);
    sourceNode.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.reverbMerge);

    // --- Chorus ---
    this.chorusDelay = ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = 0.02;
    this.chorusLFO = ctx.createOscillator();
    this.chorusLFO.type = "sine";
    this.chorusLFO.frequency.value = 0.3;
    this.chorusLFOGain = ctx.createGain();
    this.chorusLFOGain.gain.value = 0;
    this.chorusWetGain = ctx.createGain();
    this.chorusWetGain.gain.value = 0;
    this.chorusDryGain = ctx.createGain();
    this.chorusDryGain.gain.value = 1;
    this.chorusMerge = ctx.createGain();
    this.chorusMerge.gain.value = 1;

    this.chorusLFO.connect(this.chorusLFOGain);
    this.chorusLFOGain.connect(this.chorusDelay.delayTime);
    this.chorusLFO.start();

    this.reverbMerge.connect(this.chorusDryGain);
    this.chorusDryGain.connect(this.chorusMerge);
    this.reverbMerge.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusWetGain);
    this.chorusWetGain.connect(this.chorusMerge);

    // --- Distortion ---
    this.distortionShaper = ctx.createWaveShaper();
    this.distortionShaper.curve = makeDistortionCurve(0);
    this.distortionShaper.oversample = "none";

    this.chorusMerge.connect(this.distortionShaper);

    this.tailNode = this.distortionShaper;
    this.setupDone = true;

    return this.tailNode;
  }

  setPitch(semitones: number): void {
    if (!this.audioEl) return;
    this.audioEl.playbackRate = Math.pow(2, semitones / 12);
  }

  setReverb(mixPercent: number): void {
    if (this.reverbWetGain) {
      this.reverbWetGain.gain.value = clamp01(mixPercent / 100);
    }
  }

  setChorus(depthPercent: number): void {
    const depth = depthPercent / 100;
    if (this.chorusWetGain) {
      this.chorusWetGain.gain.value = clamp01(depth);
    }
    if (this.chorusLFOGain) {
      this.chorusLFOGain.gain.value = depth * 0.007;
    }
  }

  setDistortion(amountPercent: number): void {
    if (!this.distortionShaper) return;
    this.distortionShaper.curve = makeDistortionCurve(amountPercent);
  }

  teardown(): void {
    if (this.chorusLFO) {
      try { this.chorusLFO.stop(); } catch { /* already stopped */ }
      this.chorusLFO = null;
    }
    this.disconnectNode(this.chorusDelay);
    this.disconnectNode(this.chorusLFOGain);
    this.disconnectNode(this.chorusWetGain);
    this.disconnectNode(this.chorusDryGain);
    this.disconnectNode(this.chorusMerge);
    this.disconnectNode(this.reverbConvolver);
    this.disconnectNode(this.reverbWetGain);
    this.disconnectNode(this.reverbDryGain);
    this.disconnectNode(this.reverbMerge);
    this.disconnectNode(this.distortionShaper);

    this.setupDone = false;
    this.tailNode = null;
    this.ctx = null;
  }

  destroy(): void {
    this.teardown();
    this.audioEl = null;
  }

  private disconnectNode(node: AudioNode | null): void {
    if (!node) return;
    try { node.disconnect(); } catch { /* already disconnected */ }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function makeDistortionCurve(amountPercent: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  // Tanh soft-clipping: smooth saturation with odd harmonics.
  // drive=1 (near-linear) at 0%, drive=10 (heavy saturation) at 100%.
  const drive = 1 + 9 * (amountPercent / 100);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * drive);
  }
  return curve;
}

export const effectsEngine = new EffectsEngine();
