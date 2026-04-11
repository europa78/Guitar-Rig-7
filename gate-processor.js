// ============================================================
// GATE PROCESSOR — runs on the audio thread
// Per-sample envelope follower + smoothed gate coefficient.
// Reports RMS back to the main thread for the Threshold Learn feature.
// ============================================================

class GateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -60, minValue: -90, maxValue: 0, automationRate: 'k-rate' },
      { name: 'attack',    defaultValue: 0.002, minValue: 0.0001, maxValue: 0.1, automationRate: 'k-rate' },
      { name: 'release',   defaultValue: 0.1, minValue: 0.01, maxValue: 2, automationRate: 'k-rate' },
      { name: 'enabled',   defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    this.env = 0;
    this.gate = 1;
    this.rmsSum = 0;
    this.rmsCount = 0;
    this.reportInterval = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'reset') { this.env = 0; this.gate = 1; }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;

    const threshold = parameters.threshold[0];
    const threshLin = Math.pow(10, threshold / 20);
    const attack = parameters.attack[0];
    const release = parameters.release[0];
    const enabled = parameters.enabled[0] > 0.5;
    const sr = sampleRate;
    const atkCoef = Math.exp(-1 / Math.max(0.0001, attack * sr));
    const relCoef = Math.exp(-1 / Math.max(0.0001, release * sr));
    const envRelCoef = Math.exp(-1 / (0.05 * sr));
    const nCh = Math.min(input.length, output.length);
    const nSamp = input[0].length;

    for (let i = 0; i < nSamp; i++) {
      let s = 0;
      for (let ch = 0; ch < nCh; ch++) {
        const v = Math.abs(input[ch][i]);
        if (v > s) s = v;
        this.rmsSum += input[ch][i] * input[ch][i];
        this.rmsCount++;
      }
      this.env = s > this.env ? s : s * (1 - envRelCoef) + this.env * envRelCoef;
      const target = (!enabled || this.env > threshLin) ? 1 : 0;
      const coef = target > this.gate ? (1 - atkCoef) : (1 - relCoef);
      this.gate = this.gate + (target - this.gate) * coef;
      for (let ch = 0; ch < nCh; ch++) {
        output[ch][i] = input[ch][i] * this.gate;
      }
    }

    // Report RMS every ~50 ms for the Learn feature
    this.reportInterval += nSamp;
    if (this.reportInterval > sr * 0.05) {
      const rms = Math.sqrt(this.rmsSum / this.rmsCount);
      this.port.postMessage({ rms });
      this.rmsSum = 0;
      this.rmsCount = 0;
      this.reportInterval = 0;
    }
    return true;
  }
}

registerProcessor('gate-processor', GateProcessor);
