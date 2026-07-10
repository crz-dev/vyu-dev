class BitCrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bits", defaultValue: 6, minValue: 1, maxValue: 16 },
      { name: "normfreq", defaultValue: 0.25, minValue: 0.01, maxValue: 1.0 },
    ];
  }

  constructor() {
    super();
    this._phaser = 0;
    this._last = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const bits = parameters.bits[0];
    const normfreq = parameters.normfreq[0];
    const step = Math.pow(0.5, bits - 1);

    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel] || input[0];
      const outputChannel = output[channel];
      for (let i = 0; i < outputChannel.length; i++) {
        this._phaser += normfreq;
        if (this._phaser >= 1.0) {
          this._phaser -= 1.0;
          this._last = step * Math.floor(inputChannel[i] / step + 0.5);
        }
        outputChannel[i] = this._last;
      }
    }
    return true;
  }
}

registerProcessor("bitcrusher-processor", BitCrusherProcessor);
