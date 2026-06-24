// Audio effects engine — reverb, chorus, distortion
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

class EffectsEngine {
  private ctx: AudioContext | null = null;
  private initialized = false;

  private inputGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  private convolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  private chorusDelay: DelayNode | null = null;
  private chorusLFO: OscillatorNode | null = null;
  private chorusLFOGain: GainNode | null = null;
  private chorusWetGain: GainNode | null = null;
  private chorusDryGain: GainNode | null = null;

  private waveshaper: WaveShaperNode | null = null;
  private distMakeupGain: GainNode | null = null;
  private distWetGain: GainNode | null = null;
  private distDryGain: GainNode | null = null;

  private orphanedNodes: AudioNode[] = [];
  private pendingCleanup: ReturnType<typeof setTimeout> | null = null;

  private lastReverb = 0;
  private lastChorus = 0;
  private lastDistortion = 0;

  init(ctx: AudioContext): void {
    if (this.initialized) {
      this.disconnect();
    }

    this.ctx = ctx;

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0;

    this.buildReverb(ctx);
    this.buildChorus(ctx);
    this.buildDistortion(ctx);

    this.inputGain.connect(this.reverbDryGain!);
    this.inputGain.connect(this.convolver!);
    this.convolver!.connect(this.reverbWetGain!);

    this.reverbDryGain!.connect(this.chorusDryGain!);
    this.reverbWetGain!.connect(this.chorusDryGain!);
    this.reverbDryGain!.connect(this.chorusDelay!);
    this.reverbWetGain!.connect(this.chorusDelay!);
    this.chorusDelay!.connect(this.chorusWetGain!);

    this.chorusDryGain!.connect(this.distDryGain!);
    this.chorusWetGain!.connect(this.distDryGain!);
    this.chorusDryGain!.connect(this.waveshaper!);
    this.chorusWetGain!.connect(this.waveshaper!);
    this.waveshaper!.connect(this.distMakeupGain!);
    this.distMakeupGain!.connect(this.distWetGain!);

    this.distDryGain!.connect(this.outputGain!);
    this.distWetGain!.connect(this.outputGain!);

    this.setReverb(this.lastReverb);
    this.setChorus(this.lastChorus);
    this.setDistortion(this.lastDistortion);

    this.outputGain.gain.setValueAtTime(0, ctx.currentTime);
    this.outputGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.03);

    this.initialized = true;
  }

  private buildReverb(ctx: AudioContext): void {
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.createReverbIR(ctx);

    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = 0;

    this.reverbDryGain = ctx.createGain();
    this.reverbDryGain.gain.value = 1;
  }

  private buildChorus(ctx: AudioContext): void {
    this.chorusDelay = ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = 0.03;

    this.chorusLFO = ctx.createOscillator();
    this.chorusLFO.type = "sine";
    this.chorusLFO.frequency.value = 0.5;

    this.chorusLFOGain = ctx.createGain();
    this.chorusLFOGain.gain.value = 0;

    this.chorusLFO.connect(this.chorusLFOGain);
    this.chorusLFOGain.connect(this.chorusDelay.delayTime);
    this.chorusLFO.start();

    this.chorusWetGain = ctx.createGain();
    this.chorusWetGain.gain.value = 0;

    this.chorusDryGain = ctx.createGain();
    this.chorusDryGain.gain.value = 1;
  }

  private buildDistortion(ctx: AudioContext): void {
    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.curve = this.makeDistortionCurve(0);
    this.waveshaper.oversample = "4x";

    this.distMakeupGain = ctx.createGain();
    this.distMakeupGain.gain.value = 1;

    this.distWetGain = ctx.createGain();
    this.distWetGain.gain.value = 0;

    this.distDryGain = ctx.createGain();
    this.distDryGain.gain.value = 1;
  }

  private createReverbIR(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    return buffer;
  }

  private makeDistortionCurve(drive: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    if (drive <= 0) {
      for (let i = 0; i < samples; i++) {
        curve[i] = (i / samples) * 2 - 1;
      }
      return curve;
    }
    const k = drive * drive * 0.03;
    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getInputNode(): GainNode | null {
    return this.inputGain;
  }

  getOutputNode(): GainNode | null {
    return this.outputGain;
  }

  setReverb(value: number): void {
    this.lastReverb = value;
    if (!this.reverbWetGain || !this.reverbDryGain) return;
    const wet = value / 100;
    const dry = 1 - wet;
    this.reverbWetGain.gain.value = wet;
    this.reverbDryGain.gain.value = dry;
  }

  setChorus(value: number): void {
    this.lastChorus = value;
    if (!this.chorusWetGain || !this.chorusDryGain || !this.chorusLFOGain) return;
    const wet = value / 100;
    const dry = 1 - wet;
    this.chorusWetGain.gain.value = wet;
    this.chorusDryGain.gain.value = dry;
    this.chorusLFOGain.gain.value = wet * 0.005;
  }

  setDistortion(value: number): void {
    this.lastDistortion = value;
    if (!this.distWetGain || !this.distDryGain || !this.waveshaper || !this.distMakeupGain) return;
    const wet = value / 100;
    const dry = 1 - wet;
    this.waveshaper.curve = this.makeDistortionCurve(value);
    this.distMakeupGain.gain.value = Math.pow(1 - wet, 2.5) * 0.7 + 0.02;
    this.distWetGain.gain.value = wet;
    this.distDryGain.gain.value = dry;
  }

  disconnect(): void {
    this.cancelPendingCleanup();

    if (this.outputGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.outputGain.gain.cancelScheduledValues(now);
      this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
      this.outputGain.gain.linearRampToValueAtTime(0, now + 0.03);
    }

    if (this.chorusLFO) {
      try {
        this.chorusLFO.stop();
      } catch {
        /* stopped */
      }
    }

    this.orphanedNodes = [
      this.inputGain,
      this.outputGain,
      this.convolver,
      this.reverbWetGain,
      this.reverbDryGain,
      this.chorusDelay,
      this.chorusLFO,
      this.chorusLFOGain,
      this.chorusWetGain,
      this.chorusDryGain,
      this.waveshaper,
      this.distMakeupGain,
      this.distWetGain,
      this.distDryGain,
    ].filter((n) => n !== null) as AudioNode[];

    this.inputGain = null;
    this.outputGain = null;
    this.convolver = null;
    this.reverbWetGain = null;
    this.reverbDryGain = null;
    this.chorusDelay = null;
    this.chorusLFO = null;
    this.chorusLFOGain = null;
    this.chorusWetGain = null;
    this.chorusDryGain = null;
    this.waveshaper = null;
    this.distMakeupGain = null;
    this.distWetGain = null;
    this.distDryGain = null;
    this.initialized = false;

    this.pendingCleanup = setTimeout(() => {
      this.pendingCleanup = null;
      this.cleanupOrphaned();
    }, 50);
  }

  reconnect(ctx: AudioContext): void {
    this.disconnect();
    this.init(ctx);
  }

  destroy(): void {
    this.cancelPendingCleanup();

    if (this.chorusLFO) {
      try {
        this.chorusLFO.stop();
      } catch {
        /* stopped */
      }
    }

    this.orphanedNodes = [
      this.inputGain,
      this.outputGain,
      this.convolver,
      this.reverbWetGain,
      this.reverbDryGain,
      this.chorusDelay,
      this.chorusLFO,
      this.chorusLFOGain,
      this.chorusWetGain,
      this.chorusDryGain,
      this.waveshaper,
      this.distMakeupGain,
      this.distWetGain,
      this.distDryGain,
    ].filter((n) => n !== null) as AudioNode[];

    this.inputGain = null;
    this.outputGain = null;
    this.convolver = null;
    this.reverbWetGain = null;
    this.reverbDryGain = null;
    this.chorusDelay = null;
    this.chorusLFO = null;
    this.chorusLFOGain = null;
    this.chorusWetGain = null;
    this.chorusDryGain = null;
    this.waveshaper = null;
    this.distMakeupGain = null;
    this.distWetGain = null;
    this.distDryGain = null;
    this.initialized = false;
    this.ctx = null;

    this.pendingCleanup = setTimeout(() => {
      this.pendingCleanup = null;
      this.cleanupOrphaned();
    }, 50);
  }

  private cancelPendingCleanup(): void {
    if (this.pendingCleanup !== null) {
      clearTimeout(this.pendingCleanup);
      this.pendingCleanup = null;
      this.cleanupOrphaned();
    }
  }

  private cleanupOrphaned(): void {
    for (const node of this.orphanedNodes) {
      try {
        node.disconnect();
      } catch {
        /* disconnected */
      }
    }
    this.orphanedNodes = [];
  }
}

export const fxEngine = new EffectsEngine();
