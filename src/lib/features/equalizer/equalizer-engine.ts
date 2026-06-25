// EQ engine
import { BAND_FREQUENCIES, BAND_Q } from "./band-config";

const NUM_BANDS = BAND_FREQUENCIES.length;

type StageMode = "mono" | "stereo" | "surround" | "eightD" | null;

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

  private stageMode: StageMode = null;
  private stageNodes: AudioNode[] = [];
  private stagePanner: PannerNode | null = null;
  private stageGainNode: GainNode | null = null;
  private stageAnimFrame: number | null = null;
  private effectsOutput: AudioNode | null = null;

  private pendingCleanup: ReturnType<typeof setTimeout> | null = null;
  private orphanedNodes: AudioNode[] = [];

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getConnectedElement(): HTMLMediaElement | null {
    return this.connectedElement;
  }

  setEffectsOutput(node: AudioNode): void {
    this.effectsOutput = node;
    this.teardownStage();
    this.applyStage();
  }

  clearEffectsOutput(): void {
    this.effectsOutput = null;
    this.teardownStage();
    this.applyStage();
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

  private sourceElement: HTMLMediaElement | null = null;

  connectMediaElement(el: HTMLMediaElement): boolean {
    if (this.connectedElement === el && this.source) {
      this.ensureContext();
      return true;
    }

    // Tear down the old graph so connectMediaElement() performs a full rebuild.
    if (this.connectedElement) {
      this.disconnect();
    }

    try {
      const ctx = this.ensureContext();
      el.preservesPitch = true;

      // Reuse existing source node if same element (createMediaElementSource is once-per-element)
      if (this.sourceElement === el && this.source) {
        // Source node still bound to element — just rebuild the filter chain
      } else {
        this.source = ctx.createMediaElementSource(el);
        this.sourceElement = el;
      }

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
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;

      // Source → filters → outputGain → analyser → destination
      this.source.connect(this.filters[0]);
      for (let i = 1; i < this.filters.length; i++) {
        this.filters[i - 1].connect(this.filters[i]);
      }
      this.filters[this.filters.length - 1].connect(this.outputGain);
      this.outputGain.connect(this.analyser);
      this.applyStage();

      this.connectedElement = el;
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  disconnect(): void {
    this.cancelPendingCleanup();

    // Ramp gain to zero before disconnect to avoid DC pop/crackle
    if (this.outputGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.outputGain.gain.cancelScheduledValues(now);
      this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
      this.outputGain.gain.linearRampToValueAtTime(0, now + 0.03);
    }
    this.connectedElement = null;

    // Snapshot nodes for deferred cleanup; null fields so new graph builds immediately
    if (this.stageAnimFrame !== null) {
      cancelAnimationFrame(this.stageAnimFrame);
      this.stageAnimFrame = null;
    }
    this.stageGainNode = null;
    this.stagePanner = null;
    this.effectsOutput = null;

    // Keep source node alive — createMediaElementSource is once-per-element,
    // so we reuse it when reconnecting the same element.
    const oldSource = this.source;

    this.orphanedNodes = [
      ...this.filters,
      ...(this.outputGain ? [this.outputGain] : []),
      ...(this.analyser ? [this.analyser] : []),
      ...this.stageNodes,
    ];
    this.filters = [];
    this.outputGain = null;
    this.analyser = null;
    this.stageNodes = [];
    this.stageMode = null;

    // Allow the 30ms gain ramp to complete before tearing down the filter chain.
    this.pendingCleanup = setTimeout(() => {
      this.pendingCleanup = null;
      // Disconnect source from old filters, but keep the source node itself alive
      if (oldSource) {
        try {
          oldSource.disconnect();
        } catch {
          /* disconnected */
        }
      }
      this.cleanupOrphaned();
    }, 50);
  }

  private cancelPendingCleanup(): void {
    if (this.pendingCleanup !== null) {
      clearTimeout(this.pendingCleanup);
      this.pendingCleanup = null;
      // Ramp interrupted — clean up orphans immediately
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

  private cleanup(): void {
    this.teardownStage();
    this.stageMode = null;
    for (const f of this.filters) {
      try {
        f.disconnect();
      } catch {
        /* disconnected */
      }
    }
    this.filters = [];
    if (this.outputGain) {
      try {
        this.outputGain.disconnect();
      } catch {
        /* disconnected */
      }
      this.outputGain = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        /* disconnected */
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
      this.outputGain.gain.value = active
        ? 1
        : this.dbToLinear(this.outputGainDb);
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

  getStageMode(): StageMode {
    return this.stageMode;
  }

  setStage(mode: StageMode): void {
    if (mode === this.stageMode) return;
    this.stageMode = mode;
    this.teardownStage();
    this.applyStage();
  }

  private teardownStage(): void {
    if (this.stageAnimFrame !== null) {
      cancelAnimationFrame(this.stageAnimFrame);
      this.stageAnimFrame = null;
    }
    this.stageGainNode = null;
    this.stagePanner = null;
    for (const node of this.stageNodes) {
      try {
        node.disconnect();
      } catch {
        /* disconnected */
      }
    }
    this.stageNodes = [];
  }

  private applyStage(): void {
    if (!this.analyser || !this.ctx) return;

    // Disconnect analyser from destination to avoid double playback.
    // When effects are active, source = effectsOutput; without this,
    // both analyser→destination and effects→destination play simultaneously.
    try {
      this.analyser.disconnect(this.ctx.destination);
    } catch {
      /* not connected */
    }

    const source = this.effectsOutput ?? this.analyser;
    const mode = this.stageMode;
    if (!mode || mode === "stereo") {
      source.connect(this.ctx.destination);
      return;
    }

    if (mode === "mono") {
      const splitter = this.ctx.createChannelSplitter(2);
      const merger = this.ctx.createChannelMerger(2);
      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      gainL.gain.value = 0.5;
      gainR.gain.value = 0.5;

      source.connect(splitter);
      splitter.connect(gainL, 0);
      splitter.connect(gainR, 1);
      gainL.connect(merger, 0, 0);
      gainL.connect(merger, 0, 1);
      gainR.connect(merger, 0, 0);
      gainR.connect(merger, 0, 1);
      merger.connect(this.ctx.destination);

      this.stageNodes = [splitter, merger, gainL, gainR];
      return;
    }

    if (mode === "surround") {
      const splitter = this.ctx.createChannelSplitter(2);
      const merger = this.ctx.createChannelMerger(2);

      // Direct path L→L, R→R
      source.connect(splitter);
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 1);

      // Crossfeed L→R
      const delayLR = this.ctx.createDelay(0.002);
      delayLR.delayTime.value = 0.0004;
      const lpLR = this.ctx.createBiquadFilter();
      lpLR.type = "lowpass";
      lpLR.frequency.value = 3000;
      const gainLR = this.ctx.createGain();
      gainLR.gain.value = 0.3;

      splitter.connect(delayLR, 0);
      delayLR.connect(lpLR);
      lpLR.connect(gainLR);
      gainLR.connect(merger, 0, 1);

      // Crossfeed R→L
      const delayRL = this.ctx.createDelay(0.002);
      delayRL.delayTime.value = 0.0004;
      const lpRL = this.ctx.createBiquadFilter();
      lpRL.type = "lowpass";
      lpRL.frequency.value = 3000;
      const gainRL = this.ctx.createGain();
      gainRL.gain.value = 0.3;

      splitter.connect(delayRL, 1);
      delayRL.connect(lpRL);
      lpRL.connect(gainRL);
      gainRL.connect(merger, 0, 0);

      merger.connect(this.ctx.destination);

      this.stageNodes = [
        splitter,
        merger,
        delayLR,
        lpLR,
        gainLR,
        delayRL,
        lpRL,
        gainRL,
      ];
      return;
    }

    if (mode === "eightD") {
      const panner = this.ctx.createStereoPanner();

      source.connect(panner);
      panner.connect(this.ctx.destination);

      this.stagePanner = panner as unknown as PannerNode;
      this.stageNodes = [panner];
      this.startOrbitalAnimation();
      return;
    }
  }

  private startOrbitalAnimation(): void {
    const animate = () => {
      if (!this.stagePanner || !this.ctx) return;
      const speed = (2 * Math.PI) / 12;
      const angle = this.ctx.currentTime * speed;
      (this.stagePanner as unknown as StereoPannerNode).pan.value =
        Math.sin(angle);
      this.stageAnimFrame = requestAnimationFrame(animate);
    };
    this.stageAnimFrame = requestAnimationFrame(animate);
  }

  destroy(): void {
    this.cancelPendingCleanup();

    if (this.stageAnimFrame !== null) {
      cancelAnimationFrame(this.stageAnimFrame);
      this.stageAnimFrame = null;
    }
    this.stageGainNode = null;
    this.stagePanner = null;
    this.effectsOutput = null;

    // Ramp output gain to zero before tearing down to avoid pop/crackle
    if (this.outputGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.outputGain.gain.cancelScheduledValues(now);
      this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
      this.outputGain.gain.linearRampToValueAtTime(0, now + 0.03);
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* disconnected */
      }
      this.source = null;
    }
    this.sourceElement = null;
    this.connectedElement = null;

    // Snapshot nodes for deferred cleanup (same pattern as disconnect)
    this.orphanedNodes = [
      ...this.filters,
      ...(this.outputGain ? [this.outputGain] : []),
      ...(this.analyser ? [this.analyser] : []),
      ...this.stageNodes,
    ];
    this.filters = [];
    this.outputGain = null;
    this.analyser = null;
    this.stageNodes = [];
    this.stageMode = null;

    // Defer cleanup and context close so the audio thread can process the ramp
    const ctx = this.ctx;
    this.pendingCleanup = setTimeout(() => {
      this.pendingCleanup = null;
      this.cleanupOrphaned();
      if (ctx) {
        ctx.close();
      }
    }, 50);
    this.ctx = null;
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }
}

export const eqEngine = new EqualizerEngine();
