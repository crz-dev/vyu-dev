import { BAND_FREQUENCIES, BAND_Q } from "./band-config";

const NUM_BANDS = BAND_FREQUENCIES.length;

class EqualizerEngine {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private outputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private connectedElement: HTMLMediaElement | null = null;
  private bandValues: number[] = new Array(NUM_BANDS).fill(0);
  private outputGainDb = 0;
  private bypassed = true;

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getConnectedElement(): HTMLMediaElement | null {
    return this.connectedElement;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  connectMediaElement(el: HTMLMediaElement): boolean {
    if (this.connectedElement === el && this.source) {
      this.ensureContext();
      return true;
    }

    this.disconnect();

    try {
      const ctx = this.ensureContext();
      this.source = ctx.createMediaElementSource(el);

      this.filters = BAND_FREQUENCIES.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = freq;
        filter.Q.value = BAND_Q[i];
        filter.gain.value = this.bypassed ? 0 : this.bandValues[i];
        return filter;
      });

      this.outputGain = ctx.createGain();
      this.outputGain.gain.value = this.bypassed
        ? 1
        : this.dbToLinear(this.outputGainDb);

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Source → filters → outputGain → analyser → destination
      this.source.connect(this.filters[0]);
      for (let i = 1; i < this.filters.length; i++) {
        this.filters[i - 1].connect(this.filters[i]);
      }
      this.filters[this.filters.length - 1].connect(this.outputGain);
      this.outputGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      this.connectedElement = el;
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  disconnect(): void {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // already disconnected
      }
      this.source = null;
    }
    this.cleanup();
    this.connectedElement = null;
  }

  private cleanup(): void {
    for (const f of this.filters) {
      try {
        f.disconnect();
      } catch {
        // already disconnected
      }
    }
    this.filters = [];
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {
        // already disconnected
      }
      this.outputGain = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // already disconnected
      }
      this.analyser = null;
    }
  }

  setBand(index: number, gainDb: number): void {
    this.bandValues[index] = Math.round(gainDb);
    if (this.filters[index] && !this.bypassed) {
      this.filters[index].gain.value = this.bandValues[index];
    }
  }

  setBypass(active: boolean): void {
    this.bypassed = active;
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i]) {
        this.filters[i].gain.value = active ? 0 : this.bandValues[i];
      }
    }
    if (this.outputGain) {
      this.outputGain.gain.value = active ? 1 : this.dbToLinear(this.outputGainDb);
    }
  }

  isBypassed(): boolean {
    return this.bypassed;
  }

  setOutputGain(db: number): void {
    this.outputGainDb = Math.round(db);
    if (this.outputGain && !this.bypassed) {
      this.outputGain.gain.value = this.dbToLinear(this.outputGainDb);
    }
  }

  applyValues(values: number[]): void {
    for (let i = 0; i < NUM_BANDS; i++) {
      this.bandValues[i] = Math.round(values[i] ?? 0);
      if (this.filters[i] && !this.bypassed) {
        this.filters[i].gain.value = this.bandValues[i];
      }
    }
  }

  reset(): void {
    this.bandValues = new Array(NUM_BANDS).fill(0);
    this.outputGainDb = 0;
    this.bypassed = true;
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i]) {
        this.filters[i].gain.value = 0;
      }
    }
    if (this.outputGain) {
      this.outputGain.gain.value = 1;
    }
  }

  getBandValues(): number[] {
    return [...this.bandValues];
  }

  getOutputGainDb(): number {
    return this.outputGainDb;
  }

  destroy(): void {
    this.disconnect();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }
}

export const eqEngine = new EqualizerEngine();
