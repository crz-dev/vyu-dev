import { BAND_FREQUENCIES, BAND_Q } from "./band-config";
import { effectsEngine } from "../effects/effects-engine";

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

  private pendingCleanup: ReturnType<typeof setTimeout> | null = null;
  private orphanedNodes: AudioNode[] = [];

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

    // Tear down the old graph so effectsEngine.setup() performs a full
    // rebuild instead of short-circuiting on a stale cached chain.
    if (this.connectedElement) {
      this.disconnect();
    }

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

      // Source → effects → filters → outputGain → analyser → destination
      const effectsTail = effectsEngine.setup(ctx, this.source);
      effectsTail.connect(this.filters[0]);
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

    // Ramp output gain to zero before disconnecting to avoid DC pop/crackle.
    // The ramp is scheduled on the audio thread; cleanup is deferred so the
    // audio thread can process the ramp before nodes are torn down.
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
        // already disconnected
      }
      this.source = null;
    }
    this.connectedElement = null;

    // Tear down the effects chain so that the next connectMediaElement() call
    // performs a full rebuild (including source→effects wiring) instead of
    // short-circuiting on the cached graph whose input was just severed.
    effectsEngine.teardown();

    // Snapshot the current graph nodes for deferred cleanup.  The instance
    // fields are nulled so that a subsequent connectMediaElement() can build
    // a new graph immediately while the old graph's gain ramp finishes.
    if (this.stageAnimFrame !== null) {
      cancelAnimationFrame(this.stageAnimFrame);
      this.stageAnimFrame = null;
    }
    this.stageGainNode = null;
    this.stagePanner = null;

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

    // Allow the 30ms gain ramp to complete before tearing down the graph.
    this.pendingCleanup = setTimeout(() => {
      this.pendingCleanup = null;
      this.cleanupOrphaned();
    }, 50);
  }

  private cancelPendingCleanup(): void {
    if (this.pendingCleanup !== null) {
      clearTimeout(this.pendingCleanup);
      this.pendingCleanup = null;
      // The ramp was interrupted — clean up orphaned nodes immediately.
      this.cleanupOrphaned();
    }
  }

  private cleanupOrphaned(): void {
    for (const node of this.orphanedNodes) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.orphanedNodes = [];
  }

  private cleanup(): void {
    effectsEngine.teardown();
    this.teardownStage();
    this.stageMode = null;
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
        /* already disconnected */
      }
    }
    this.stageNodes = [];
  }

  private applyStage(): void {
    if (!this.analyser || !this.ctx) return;

    const mode = this.stageMode;
    if (!mode || mode === "stereo") {
      this.analyser.connect(this.ctx.destination);
      return;
    }

    if (mode === "mono") {
      const splitter = this.ctx.createChannelSplitter(2);
      const merger = this.ctx.createChannelMerger(2);
      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      gainL.gain.value = 0.5;
      gainR.gain.value = 0.5;

      this.analyser.connect(splitter);
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
      this.analyser.connect(splitter);
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
      const gain = this.ctx.createGain();
      gain.gain.value = 1;

      const panner = this.ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "linear";
      panner.rolloffFactor = 0;
      panner.positionY.value = 0;

      this.analyser.connect(gain);
      gain.connect(panner);
      panner.connect(this.ctx.destination);

      this.stageGainNode = gain;
      this.stagePanner = panner;
      this.stageNodes = [gain, panner];
      this.startOrbitalAnimation();
      return;
    }
  }

  private startOrbitalAnimation(): void {
    const animate = () => {
      if (!this.stagePanner || !this.stageGainNode || !this.ctx) return;
      const speed = (2 * Math.PI) / 14;
      const angle = this.ctx.currentTime * speed;
      const x = Math.cos(angle);
      this.stagePanner.positionX.value = x;
      this.stagePanner.positionZ.value = Math.sin(angle);
      this.stageGainNode.gain.value = 0.85 + Math.abs(x) * 0.3;
      this.stageAnimFrame = requestAnimationFrame(animate);
    };
    this.stageAnimFrame = requestAnimationFrame(animate);
  }

  destroy(): void {
    this.cancelPendingCleanup();
    effectsEngine.destroy();

    if (this.stageAnimFrame !== null) {
      cancelAnimationFrame(this.stageAnimFrame);
      this.stageAnimFrame = null;
    }
    this.stageGainNode = null;
    this.stagePanner = null;

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
        // already disconnected
      }
      this.source = null;
    }
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
