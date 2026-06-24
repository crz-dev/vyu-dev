// Audio effects engine — reverb, chorus, distortion, pitch
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

let workletRegistered = false;
let workletRegistration: Promise<void> | null = null;

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

  private pitchNode: AudioWorkletNode | null = null;

  private filterLowpass: BiquadFilterNode | null = null;
  private filterBandpass: BiquadFilterNode | null = null;
  private filterWaveshaper: WaveShaperNode | null = null;
  private filterDelay: DelayNode | null = null;
  private filterLFO: OscillatorNode | null = null;
  private filterLFOGain: GainNode | null = null;
  private activeFilter: string | null = null;

  private orphanedNodes: AudioNode[] = [];
  private pendingCleanup: ReturnType<typeof setTimeout> | null = null;

  private lastReverb = 0;
  private lastChorus = 0;
  private lastDistortion = 0;
  private lastPitch = 0;
  private lastFilter: string | null = null;

  private savedReverb = 0;
  private savedChorus = 0;
  private savedDistortion = 0;

  async init(ctx: AudioContext): Promise<void> {
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

    await this.ensureWorklet();
    if (workletRegistered) {
      const { SoundTouchNode } = await import("@soundtouchjs/audio-worklet");
      const stNode = new SoundTouchNode({ context: ctx });
      stNode.playbackRate.value = 1.0;
      stNode.pitchSemitones.value = this.lastPitch;
      this.pitchNode = stNode as unknown as AudioWorkletNode;
      console.log(
        "[fx] SoundTouchNode created, pitchSemitones =",
        this.lastPitch,
      );
    } else {
      console.warn("[fx] worklet not registered, pitch disabled");
    }

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

    if (this.pitchNode) {
      this.distDryGain!.connect(this.pitchNode);
      this.distWetGain!.connect(this.pitchNode);
      this.pitchNode.connect(this.outputGain!);
    } else {
      this.distDryGain!.connect(this.outputGain!);
      this.distWetGain!.connect(this.outputGain!);
    }

    this.setReverb(this.lastReverb);
    this.setChorus(this.lastChorus);
    this.setDistortion(this.lastDistortion);
    if (this.lastFilter) {
      this.setFilter(this.lastFilter);
    }

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
    this.chorusDelay.delayTime.value = 0.025;

    this.chorusLFO = ctx.createOscillator();
    this.chorusLFO.type = "sine";
    this.chorusLFO.frequency.value = 0.8;

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
    const length = ctx.sampleRate * 2.5;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      const offset = ch * 7;
      const erTimes = [0.013, 0.029, 0.047, 0.067];
      const erGains = [0.7, 0.5, 0.35, 0.2];
      for (let i = 0; i < length; i++) {
        const t = i / ctx.sampleRate;
        let val = 0;
        for (let j = 0; j < erTimes.length; j++) {
          const d = t - erTimes[j] - offset * 0.001;
          if (d >= 0 && d < 0.003) val += erGains[j] * (1 - d / 0.003);
        }
        val += (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.0);
        data[i] = val;
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

  private async ensureWorklet(): Promise<void> {
    if (workletRegistered) return;
    if (workletRegistration) {
      await workletRegistration;
      return;
    }
    if (!this.ctx) return;
    workletRegistration = this.ctx.audioWorklet
      .addModule("/soundtouch-processor.js")
      .then(() => {
        workletRegistered = true;
      })
      .catch((err) => {
        console.error("[fx] soundtouch worklet registration failed:", err);
        workletRegistration = null;
      });
    await workletRegistration;
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
    if (!this.chorusWetGain || !this.chorusDryGain || !this.chorusLFOGain)
      return;
    const wet = value / 100;
    const dry = 1 - wet;
    this.chorusWetGain.gain.value = wet;
    this.chorusDryGain.gain.value = dry;
    this.chorusLFOGain.gain.value = wet * 0.012;
  }

  setDistortion(value: number): void {
    this.lastDistortion = value;
    if (
      !this.distWetGain ||
      !this.distDryGain ||
      !this.waveshaper ||
      !this.distMakeupGain
    )
      return;
    const wet = value / 100;
    const dry = 1 - wet;
    this.waveshaper.curve = this.makeDistortionCurve(value);
    this.distMakeupGain.gain.value = Math.pow(1 - wet, 2.0) * 0.7 + 0.06;
    this.distWetGain.gain.value = wet;
    this.distDryGain.gain.value = dry;
  }

  setPitch(value: number): void {
    this.lastPitch = value;
    if (this.pitchNode) {
      this.pitchNode.parameters.get("pitchSemitones")!.value = value;
    }
  }

  setFilter(preset: string | null): void {
    this.lastFilter = preset;

    this.clearFilterNodes();

    if (this.pitchNode) {
      this.pitchNode.parameters.get("pitchSemitones")!.value = this.lastPitch;
      (
        this.pitchNode as unknown as { playbackRate: { value: number } }
      ).playbackRate.value = 1.0;
    }

    if (!preset) {
      this.reconnectDirectPath();
      this.reverbWetGain!.gain.value = this.savedReverb;
      this.reverbDryGain!.gain.value = 1 - this.savedReverb;
      this.chorusWetGain!.gain.value = this.savedChorus;
      this.chorusDryGain!.gain.value = 1 - this.savedChorus;
      this.chorusLFOGain!.gain.value = this.savedChorus * 0.012;
      this.distWetGain!.gain.value = this.savedDistortion;
      this.distDryGain!.gain.value = 1 - this.savedDistortion;
      return;
    }

    if (preset === "nightcore") {
      this.savedReverb = this.reverbWetGain!.gain.value;
      this.savedChorus = this.chorusWetGain!.gain.value;
      this.savedDistortion = this.distWetGain!.gain.value;

      if (this.pitchNode) {
        this.pitchNode.parameters.get("pitchSemitones")!.value = 4;
        (
          this.pitchNode as unknown as { playbackRate: { value: number } }
        ).playbackRate.value = 1.2;
      }

      this.reverbWetGain!.gain.value = 0.1;
      this.reverbDryGain!.gain.value = 0.9;
      this.chorusWetGain!.gain.value = 0.2;
      this.chorusDryGain!.gain.value = 0.8;
      this.chorusLFOGain!.gain.value = 0.2 * 0.012;

      this.activeFilter = "nightcore";
      return;
    }

    if (!this.ctx || !this.outputGain) return;
    this.insertFilterChain(preset);
  }

  getActiveFilter(): string | null {
    return this.activeFilter;
  }

  private clearFilterNodes(): void {
    if (this.filterLFO) {
      try {
        this.filterLFO.stop();
      } catch {
        /* stopped */
      }
    }

    const filterNodes = [
      this.filterLowpass,
      this.filterBandpass,
      this.filterWaveshaper,
      this.filterDelay,
      this.filterLFO,
      this.filterLFOGain,
    ].filter((n) => n !== null) as AudioNode[];

    for (const node of filterNodes) {
      try {
        node.disconnect();
      } catch {
        /* disconnected */
      }
    }

    this.filterLowpass = null;
    this.filterBandpass = null;
    this.filterWaveshaper = null;
    this.filterDelay = null;
    this.filterLFO = null;
    this.filterLFOGain = null;
    this.activeFilter = null;
  }

  private reconnectDirectPath(): void {
    if (!this.outputGain) return;
    const sources = this.getFilterSources();
    for (const source of sources) {
      try {
        source.connect(this.outputGain);
      } catch {
        /* already connected */
      }
    }
  }

  private getFilterSources(): AudioNode[] {
    if (this.pitchNode) {
      return [this.pitchNode];
    }
    const sources: AudioNode[] = [];
    if (this.distDryGain) sources.push(this.distDryGain);
    if (this.distWetGain) sources.push(this.distWetGain);
    return sources;
  }

  private disconnectSourcesFromOutput(): void {
    if (!this.outputGain) return;
    const sources = this.getFilterSources();
    for (const source of sources) {
      try {
        source.disconnect(this.outputGain);
      } catch {
        /* not connected */
      }
    }
  }

  private insertFilterChain(preset: string): void {
    const ctx = this.ctx!;
    const outputGain = this.outputGain!;

    this.disconnectSourcesFromOutput();
    const sources = this.getFilterSources();

    let lastNode: AudioNode;

    if (preset === "lofi") {
      this.savedReverb = this.reverbWetGain!.gain.value;
      this.savedChorus = this.chorusWetGain!.gain.value;
      this.savedDistortion = this.distWetGain!.gain.value;

      if (this.pitchNode) {
        (
          this.pitchNode as unknown as { playbackRate: { value: number } }
        ).playbackRate.value = 0.8;
      }

      this.reverbWetGain!.gain.value = 0.2;
      this.reverbDryGain!.gain.value = 0.8;
      this.distWetGain!.gain.value = 0.1;
      this.distDryGain!.gain.value = 0.9;

      this.filterLowpass = ctx.createBiquadFilter();
      this.filterLowpass.type = "lowpass";
      this.filterLowpass.frequency.value = 1800;

      this.filterBandpass = ctx.createBiquadFilter();
      this.filterBandpass.type = "peaking";
      this.filterBandpass.frequency.value = 200;
      this.filterBandpass.gain.value = 4;
      this.filterBandpass.Q.value = 0.8;

      this.filterWaveshaper = ctx.createWaveShaper();
      this.filterWaveshaper.curve = this.makeDistortionCurve(8);
      this.filterWaveshaper.oversample = "2x";

      this.filterDelay = ctx.createDelay(0.01);
      this.filterDelay.delayTime.value = 0.004;

      this.filterLFO = ctx.createOscillator();
      this.filterLFO.type = "sine";
      this.filterLFO.frequency.value = 0.3;

      this.filterLFOGain = ctx.createGain();
      this.filterLFOGain.gain.value = 0.0015;

      this.filterLFO.connect(this.filterLFOGain);
      this.filterLFOGain.connect(this.filterDelay.delayTime);
      this.filterLFO.start();

      for (const source of sources) {
        source.connect(this.filterLowpass);
      }
      this.filterLowpass.connect(this.filterBandpass);
      this.filterBandpass.connect(this.filterWaveshaper);
      this.filterWaveshaper.connect(this.filterDelay);
      lastNode = this.filterDelay;
    } else if (preset === "eightBit") {
      this.filterWaveshaper = ctx.createWaveShaper();
      this.filterWaveshaper.curve = this.makeDistortionCurve(100);
      this.filterWaveshaper.oversample = "none";

      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 800;
      this.filterLowpass = highpass;

      this.filterDelay = ctx.createDelay(0.03);
      this.filterDelay.delayTime.value = 0.02;

      for (const source of sources) {
        source.connect(this.filterWaveshaper);
      }
      this.filterWaveshaper.connect(highpass);
      highpass.connect(this.filterDelay);
      lastNode = this.filterDelay;
    } else if (preset === "radio") {
      this.filterBandpass = ctx.createBiquadFilter();
      this.filterBandpass.type = "bandpass";
      this.filterBandpass.frequency.value = 1800;
      this.filterBandpass.Q.value = 1.5;

      this.filterWaveshaper = ctx.createWaveShaper();
      this.filterWaveshaper.curve = this.makeDistortionCurve(20);
      this.filterWaveshaper.oversample = "2x";

      for (const source of sources) {
        source.connect(this.filterBandpass);
      }
      this.filterBandpass.connect(this.filterWaveshaper);
      lastNode = this.filterWaveshaper;
    } else {
      this.reconnectDirectPath();
      return;
    }

    lastNode.connect(outputGain);
    this.activeFilter = preset;
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

    if (this.filterLFO) {
      try {
        this.filterLFO.stop();
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
      this.pitchNode,
      this.filterLowpass,
      this.filterBandpass,
      this.filterWaveshaper,
      this.filterDelay,
      this.filterLFO,
      this.filterLFOGain,
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
    this.pitchNode = null;
    this.filterLowpass = null;
    this.filterBandpass = null;
    this.filterWaveshaper = null;
    this.filterDelay = null;
    this.filterLFO = null;
    this.filterLFOGain = null;
    this.activeFilter = null;
    this.initialized = false;

    this.pendingCleanup = setTimeout(() => {
      this.pendingCleanup = null;
      this.cleanupOrphaned();
    }, 50);
  }

  async reconnect(ctx: AudioContext): Promise<void> {
    this.disconnect();
    await this.init(ctx);
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

    if (this.filterLFO) {
      try {
        this.filterLFO.stop();
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
      this.pitchNode,
      this.filterLowpass,
      this.filterBandpass,
      this.filterWaveshaper,
      this.filterDelay,
      this.filterLFO,
      this.filterLFOGain,
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
    this.pitchNode = null;
    this.filterLowpass = null;
    this.filterBandpass = null;
    this.filterWaveshaper = null;
    this.filterDelay = null;
    this.filterLFO = null;
    this.filterLFOGain = null;
    this.activeFilter = null;
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
