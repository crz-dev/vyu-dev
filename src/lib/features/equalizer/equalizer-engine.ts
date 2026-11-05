import { BAND_FREQUENCIES, BAND_Q } from "./bandConfig";

const NUM_BANDS = BAND_FREQUENCIES.length;

type StageMode = "mono" | "stereo" | "surround" | "eightD" | null;

export interface AccessibilityAudioOptions {
  volumeLimit: number;
  monoAudio: boolean;
  balance: number;
  normalizeVolume: boolean;
  limitPeaks: boolean;
  boostDialogue: boolean;
}

const DEFAULT_ACCESSIBILITY_AUDIO: AccessibilityAudioOptions = {
  volumeLimit: 1,
  monoAudio: false,
  balance: 0,
  normalizeVolume: false,
  limitPeaks: false,
  boostDialogue: false,
};

class EqualizerEngine {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private outputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private boostGain: GainNode | null = null;
  private boostSource: AudioNode | null = null;
  private boostEnabled = false;
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
  private a11yOptions: AccessibilityAudioOptions = {
    ...DEFAULT_ACCESSIBILITY_AUDIO,
  };
  private a11yNodes: AudioNode[] = [];
  private a11yStereoGain: GainNode | null = null;
  private a11yMonoGain: GainNode | null = null;
  private a11yPanner: StereoPannerNode | null = null;
  private a11yNormalize: DynamicsCompressorNode | null = null;
  private a11yLimiter: DynamicsCompressorNode | null = null;
  private a11yDialogue: BiquadFilterNode | null = null;
  private a11yOutputGain: GainNode | null = null;

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

  setVolumeBoost(enabled: boolean): void {
    this.boostEnabled = enabled;
    if (this.boostGain) {
      this.boostGain.gain.value = enabled ? 2 : 1;
    }
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
      try {
        this.source.connect(this.filters[0]);
      } catch (e) {
        // Source node may already be disconnected — rebuild with new source
        console.warn("[eq] source.connect failed, creating new source:", e);
        this.source = ctx.createMediaElementSource(el);
        this.sourceElement = el;
        this.source.connect(this.filters[0]);
      }
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
      try {
        const now = this.ctx.currentTime;
        this.outputGain.gain.cancelScheduledValues(now);
        this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
        this.outputGain.gain.linearRampToValueAtTime(0, now + 0.03);
      } catch {
        // AudioContext may be in a closed or error state — skip ramp
      }
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

    // Disconnect source from old filters immediately, but keep the source node alive.
    // createMediaElementSource is once-per-element — we must reuse it when reconnecting
    // the same element.
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* disconnected */
      }
    }

    this.orphanedNodes = [
      ...this.filters,
      ...(this.outputGain ? [this.outputGain] : []),
      ...(this.analyser ? [this.analyser] : []),
      ...(this.boostGain ? [this.boostGain] : []),
      ...this.stageNodes,
      ...this.a11yNodes,
    ];
    this.filters = [];
    this.outputGain = null;
    this.analyser = null;
    this.boostGain = null;
    this.boostSource = null;
    this.stageNodes = [];
    this.stageMode = null;
    this.a11yNodes = [];
    this.clearAccessibilityRefs();

    this.source = null;
    this.sourceElement = null;
    this.cleanupOrphaned();
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
    this.teardownAccessibilityChain();
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
    if (this.boostGain) {
      try {
        this.boostGain.disconnect();
      } catch {
        /* disconnected */
      }
      this.boostGain = null;
    }
    this.boostSource = null;
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

  setAccessibilityAudio(options: AccessibilityAudioOptions): void {
    this.a11yOptions = { ...options };
    if (this.a11yOutputGain) {
      this.applyAccessibilityParams();
      return;
    }
    this.applyStage();
  }

  private teardownAccessibilityChain(): void {
    for (const node of this.a11yNodes) {
      try {
        node.disconnect();
      } catch {
        /* disconnected */
      }
    }
    this.a11yNodes = [];
    this.clearAccessibilityRefs();
  }

  private clearAccessibilityRefs(): void {
    this.a11yStereoGain = null;
    this.a11yMonoGain = null;
    this.a11yPanner = null;
    this.a11yNormalize = null;
    this.a11yLimiter = null;
    this.a11yDialogue = null;
    this.a11yOutputGain = null;
  }

  private buildAccessibilityChain(input: AudioNode): AudioNode {
    this.teardownAccessibilityChain();
    if (!this.ctx) return input;

    const ctx = this.ctx;
    const stereoGain = ctx.createGain();
    const monoDownmix = ctx.createGain();
    const monoGain = ctx.createGain();
    const sum = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const normalize = ctx.createDynamicsCompressor();
    const limiter = ctx.createDynamicsCompressor();
    const dialogue = ctx.createBiquadFilter();
    const outputGain = ctx.createGain();

    monoDownmix.channelCount = 1;
    monoDownmix.channelCountMode = "explicit";
    monoDownmix.channelInterpretation = "speakers";

    stereoGain.gain.value = this.a11yOptions.monoAudio ? 0 : 1;
    monoGain.gain.value = this.a11yOptions.monoAudio ? 1 : 0;
    panner.pan.value = Math.min(1, Math.max(-1, this.a11yOptions.balance));
    dialogue.type = "peaking";
    dialogue.frequency.value = 2000;
    dialogue.Q.value = 1;
    dialogue.gain.value = this.a11yOptions.boostDialogue ? 4 : 0;
    outputGain.gain.value = Math.min(
      1,
      Math.max(0.2, this.a11yOptions.volumeLimit),
    );

    input.connect(stereoGain);
    stereoGain.connect(sum);

    input.connect(monoDownmix);
    monoDownmix.connect(monoGain);
    monoGain.connect(sum);

    sum.connect(panner);
    panner.connect(normalize);
    normalize.connect(dialogue);
    dialogue.connect(limiter);
    limiter.connect(outputGain);

    this.a11yNodes = [
      stereoGain,
      monoDownmix,
      monoGain,
      sum,
      panner,
      normalize,
      limiter,
      dialogue,
      outputGain,
    ];
    this.a11yStereoGain = stereoGain;
    this.a11yMonoGain = monoGain;
    this.a11yPanner = panner;
    this.a11yNormalize = normalize;
    this.a11yLimiter = limiter;
    this.a11yDialogue = dialogue;
    this.a11yOutputGain = outputGain;

    this.applyAccessibilityParams();
    return outputGain;
  }

  private applyAccessibilityParams(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const ramp = (param: AudioParam, value: number) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + 0.03);
    };

    if (this.a11yStereoGain) {
      ramp(this.a11yStereoGain.gain, this.a11yOptions.monoAudio ? 0 : 1);
    }
    if (this.a11yMonoGain) {
      ramp(this.a11yMonoGain.gain, this.a11yOptions.monoAudio ? 1 : 0);
    }
    if (this.a11yPanner) {
      const balance = Math.min(1, Math.max(-1, this.a11yOptions.balance));
      this.a11yPanner.pan.setTargetAtTime(balance, now, 0.02);
    }

    if (this.a11yNormalize) {
      const enabled = this.a11yOptions.normalizeVolume;
      this.a11yNormalize.threshold.value = enabled ? -24 : 0;
      this.a11yNormalize.knee.value = enabled ? 12 : 0;
      this.a11yNormalize.ratio.value = enabled ? 3 : 1;
      this.a11yNormalize.attack.value = enabled ? 0.01 : 0.003;
      this.a11yNormalize.release.value = 0.25;
    }

    if (this.a11yLimiter) {
      const enabled = this.a11yOptions.limitPeaks;
      this.a11yLimiter.threshold.value = enabled ? -6 : 0;
      this.a11yLimiter.knee.value = 0;
      this.a11yLimiter.ratio.value = enabled ? 20 : 1;
      this.a11yLimiter.attack.value = enabled ? 0.002 : 0.003;
      this.a11yLimiter.release.value = 0.1;
    }

    if (this.a11yDialogue) {
      this.a11yDialogue.type = "peaking";
      this.a11yDialogue.frequency.value = 2000;
      this.a11yDialogue.Q.value = 1;
      ramp(this.a11yDialogue.gain, this.a11yOptions.boostDialogue ? 4 : 0);
    }

    if (this.a11yOutputGain) {
      const limit = Math.min(1, Math.max(0.2, this.a11yOptions.volumeLimit));
      ramp(this.a11yOutputGain.gain, limit);
    }
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

  private ensureBoost(source: AudioNode): AudioNode {
    if (!this.ctx) return source;
    if (!this.boostGain) {
      this.boostGain = this.ctx.createGain();
      this.boostGain.gain.value = this.boostEnabled ? 2 : 1;
    }
    if (this.boostSource && this.boostSource !== source) {
      try {
        this.boostSource.disconnect(this.boostGain);
      } catch {
        /* disconnected */
      }
    }
    if (this.boostSource !== source) {
      try {
        source.connect(this.boostGain);
      } catch {
        /* already connected */
      }
      this.boostSource = source;
    }
    return this.boostGain;
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

    // Rebuild the boost output connections; the source → boost edge is kept.
    try {
      this.boostGain?.disconnect();
    } catch {
      /* not connected */
    }

    const source = this.effectsOutput ?? this.analyser;
    const boosted = this.ensureBoost(source);
    const output = this.buildAccessibilityChain(boosted);
    const mode = this.stageMode;
    if (!mode || mode === "stereo") {
      output.connect(this.ctx.destination);
      return;
    }

    if (mode === "mono") {
      const splitter = this.ctx.createChannelSplitter(2);
      const merger = this.ctx.createChannelMerger(2);
      const gainL = this.ctx.createGain();
      const gainR = this.ctx.createGain();
      gainL.gain.value = 0.5;
      gainR.gain.value = 0.5;

      output.connect(splitter);
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
      output.connect(splitter);
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

      output.connect(panner);
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
      try {
        const now = this.ctx.currentTime;
        this.outputGain.gain.cancelScheduledValues(now);
        this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
        this.outputGain.gain.linearRampToValueAtTime(0, now + 0.03);
      } catch {
        // AudioContext may be in a closed or error state — skip ramp
      }
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
      ...(this.boostGain ? [this.boostGain] : []),
      ...this.stageNodes,
      ...this.a11yNodes,
    ];
    this.filters = [];
    this.outputGain = null;
    this.analyser = null;
    this.boostGain = null;
    this.boostSource = null;
    this.stageNodes = [];
    this.stageMode = null;
    this.a11yNodes = [];
    this.clearAccessibilityRefs();

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
