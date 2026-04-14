// ============================================================
// AUDIO ENGINE — Web Audio API graph + routing
// ============================================================
//
// Signal path:
//   input -> splitter -> merger (L/ST/R routing)
//         -> inputLevel -> gate (AudioWorklet) -> RACK CHAIN
//         -> globalFxStart -> GLOBAL FX CHAIN -> output
//         -> outputLevel -> [dry | limiter] -> masterMute
//         -> outPeakAnalyser -> destination
//
// Components with `bypassed === true` are removed from the live
// graph entirely (CPU freed).  Components with `monoMode === true`
// are downmixed to mono before entering the DSP path.

import { dbToGain } from './dsp-utils.js';
import gateWorkletUrl from './gate-processor.js?url';

let gateWorkletLoaded = false;
async function loadGateWorklet(ctx) {
  if (gateWorkletLoaded) return;
  await ctx.audioWorklet.addModule(gateWorkletUrl);
  gateWorkletLoaded = true;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.input = null;
    this.inputLevel = null;
    this.inputSplitter = null;
    this.inputMerger = null;
    this.inputRoute = 'ST';
    this.inPeakAnalyser = null;
    this.outPeakAnalyser = null;
    this.output = null;
    this.outputLevel = null;
    this.components = [];            // main rack chain
    this.globalFxComponents = [];    // global FX chain (after the main rack)
    this.sidechainInput = null;      // external sidechain bus (scaffolded)
    this.globalFxStart = null;       // junction between rack and global FX
    this.sourceNode = null;
    this.sourceType = 'none';
    this.fileBuffer = null;
    this.fileSource = null;
    this.micStream = null;
    this.cpuLoad = 0;
    this._gateRMS = 0;
    this._powerOn = true;
    this._mutedOut = false;
    this.limiterEnabled = false;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    try {
      await loadGateWorklet(this.ctx);
    } catch (e) {
      console.warn('Gate worklet failed to load:', e);
    }

    // Input routing: raw input -> splitter -> merger -> level -> gate -> chain
    this.input = this.ctx.createGain();
    this.inputSplitter = this.ctx.createChannelSplitter(2);
    this.inputMerger = this.ctx.createChannelMerger(2);
    this.inputLevel = this.ctx.createGain();
    this.inputLevel.gain.value = 1;

    // Noise gate (AudioWorklet)
    if (gateWorkletLoaded) {
      this.gateNode = new AudioWorkletNode(this.ctx, 'gate-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.gateNode.parameters.get('enabled').value = 0;
      this.gateNode.parameters.get('threshold').value = -60;
      this.gateNode.port.onmessage = (e) => {
        if (e.data && typeof e.data.rms === 'number') this._gateRMS = e.data.rms;
      };
    } else {
      // Fallback: passthrough gain if worklet failed
      this.gateNode = this.ctx.createGain();
    }

    // Peak meter analysers
    this.inPeakAnalyser = this.ctx.createAnalyser();
    this.inPeakAnalyser.fftSize = 1024;
    this.inPeakAnalyser.smoothingTimeConstant = 0;

    this.output = this.ctx.createGain();
    this.outputLevel = this.ctx.createGain();
    this.outputLevel.gain.value = 0.8;

    // Global FX junction
    this.globalFxStart = this.ctx.createGain();

    // External sidechain bus (for future components to tap)
    this.sidechainInput = this.ctx.createGain();
    this.sidechainInput.gain.value = 0;

    // Limiter — DynamicsCompressor used as a brickwall-ish output limiter
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;
    this.limiterBypass = this.ctx.createGain();
    this.limiterBypass.gain.value = 1;
    this.limiterWet = this.ctx.createGain();
    this.limiterWet.gain.value = 0;

    // Master mute
    this.masterMute = this.ctx.createGain();
    this.masterMute.gain.value = 1;

    this.outPeakAnalyser = this.ctx.createAnalyser();
    this.outPeakAnalyser.fftSize = 1024;
    this.outPeakAnalyser.smoothingTimeConstant = 0;

    this._wireInputRoute();
    this.inputLevel.connect(this.inPeakAnalyser);
    this.inputLevel.connect(this.gateNode);

    // Output path
    this.output.connect(this.outputLevel);
    this.outputLevel.connect(this.limiterBypass);
    this.outputLevel.connect(this.limiter);
    this.limiter.connect(this.limiterWet);
    this.limiterBypass.connect(this.masterMute);
    this.limiterWet.connect(this.masterMute);
    this.masterMute.connect(this.outPeakAnalyser);
    this.outPeakAnalyser.connect(this.ctx.destination);

    this._rebuildChain();
  }

  setGateEnabled(enabled) {
    if (!this.gateNode || !this.gateNode.parameters) return;
    this.gateNode.parameters.get('enabled').setValueAtTime(enabled ? 1 : 0, this.ctx.currentTime);
  }
  setGateThreshold(db) {
    if (!this.gateNode || !this.gateNode.parameters) return;
    this.gateNode.parameters.get('threshold').setValueAtTime(db, this.ctx.currentTime);
  }
  setLimiterEnabled(enabled) {
    if (!this.ctx) return;
    this.limiterEnabled = enabled;
    const t = this.ctx.currentTime;
    this.limiterBypass.gain.setTargetAtTime(enabled ? 0 : 1, t, 0.01);
    this.limiterWet.gain.setTargetAtTime(enabled ? 1 : 0, t, 0.01);
  }
  _updateMasterGain() {
    if (!this.ctx) return;
    const target = (this._powerOn && !this._mutedOut) ? 1 : 0;
    this.masterMute.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }
  setEnginePower(on) {
    if (!this.ctx) return;
    this._powerOn = on;
    this._updateMasterGain();
    if (on) this.resume();
    else setTimeout(() => { if (!this._powerOn) this.ctx.suspend(); }, 100);
  }
  setOutputMuted(muted) {
    this._mutedOut = muted;
    this._updateMasterGain();
  }
  _wireInputRoute() {
    try { this.input.disconnect(); } catch (e) {}
    try { this.inputSplitter.disconnect(); } catch (e) {}
    try { this.inputMerger.disconnect(); } catch (e) {}
    this.input.connect(this.inputSplitter);
    if (this.inputRoute === 'L') {
      this.inputSplitter.connect(this.inputMerger, 0, 0);
      this.inputSplitter.connect(this.inputMerger, 0, 1);
    } else if (this.inputRoute === 'R') {
      this.inputSplitter.connect(this.inputMerger, 1, 0);
      this.inputSplitter.connect(this.inputMerger, 1, 1);
    } else {
      this.inputSplitter.connect(this.inputMerger, 0, 0);
      this.inputSplitter.connect(this.inputMerger, 1, 1);
    }
    this.inputMerger.connect(this.inputLevel);
  }
  setInputRoute(route) {
    this.inputRoute = route;
    if (this.ctx) {
      this._wireInputRoute();
      this._rebuildChain();
    }
  }
  setInputLevelDb(db) {
    if (!this.ctx) return;
    this.inputLevel.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, 0.01);
  }
  setOutputLevelDb(db) {
    if (!this.ctx) return;
    this.outputLevel.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, 0.01);
  }
  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }
  addComponent(comp) {
    this.components.push(comp);
    comp._engineRef = this;
    comp.build(this.ctx);
    this._rebuildChain();
  }
  addGlobalFxComponent(comp) {
    this.globalFxComponents.push(comp);
    comp._engineRef = this;
    comp.build(this.ctx);
    this._rebuildChain();
  }
  moveComponent(fromIdx, toIdx) {
    const [c] = this.components.splice(fromIdx, 1);
    this.components.splice(toIdx, 0, c);
    this._rebuildChain();
  }
  _rebuildChain() {
    if (!this.ctx) return;
    // Disconnect everything touching the chain
    try { this.gateNode.disconnect(); } catch (e) {}
    try { this.globalFxStart.disconnect(); } catch (e) {}
    this.components.forEach(c => {
      try { c.getOutput().disconnect(); } catch (e) {}
      if (c._monoDownmix) try { c._monoDownmix.disconnect(); } catch (e) {}
    });
    this.globalFxComponents.forEach(c => {
      try { c.getOutput().disconnect(); } catch (e) {}
      if (c._monoDownmix) try { c._monoDownmix.disconnect(); } catch (e) {}
    });

    // === RACK CHAIN: gateNode -> (enabled comps) -> globalFxStart
    let prev = this.gateNode;
    for (const c of this.components) {
      if (c.bypassed) continue;
      const nodeIn = c.getInput();
      const nodeOut = c.getOutput();
      if (!nodeIn || !nodeOut) continue;
      try {
        if (c.monoMode && c._monoDownmix) {
          prev.connect(c._monoDownmix);
          c._monoDownmix.connect(nodeIn);
        } else {
          prev.connect(nodeIn);
        }
      } catch (e) {}
      prev = nodeOut;
    }
    try { prev.connect(this.globalFxStart); } catch (e) {}

    // === GLOBAL FX CHAIN: globalFxStart -> (enabled gfx) -> output
    let prev2 = this.globalFxStart;
    for (const c of this.globalFxComponents) {
      if (c.bypassed) continue;
      const nodeIn = c.getInput();
      const nodeOut = c.getOutput();
      if (!nodeIn || !nodeOut) continue;
      try {
        if (c.monoMode && c._monoDownmix) {
          prev2.connect(c._monoDownmix);
          c._monoDownmix.connect(nodeIn);
        } else {
          prev2.connect(nodeIn);
        }
      } catch (e) {}
      prev2 = nodeOut;
    }
    try { prev2.connect(this.output); } catch (e) {}
  }

  async setSource(type) {
    await this.init();
    await this.resume();
    if (this.sourceNode) { try { this.sourceNode.disconnect(); } catch (e) {} this.sourceNode = null; }
    if (this.fileSource) { try { this.fileSource.stop(); } catch (e) {} this.fileSource = null; }
    if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; }
    this.sourceType = type;
    if (type === 'mic') {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        this.sourceNode = this.ctx.createMediaStreamSource(this.micStream);
        this.sourceNode.connect(this.input);
      } catch (e) {
        console.warn('Mic access denied:', e);
      }
    } else if (type === 'file' && this.fileBuffer) {
      this.playFile();
    }
  }
  async loadFile(file) {
    await this.init();
    const arr = await file.arrayBuffer();
    this.fileBuffer = await this.ctx.decodeAudioData(arr);
  }
  playFile() {
    if (!this.fileBuffer) return;
    if (this.fileSource) { try { this.fileSource.stop(); } catch (e) {} }
    this.fileSource = this.ctx.createBufferSource();
    this.fileSource.buffer = this.fileBuffer;
    this.fileSource.loop = true;
    this.fileSource.connect(this.input);
    this.fileSource.start();
    this.sourceNode = this.fileSource;
    this.sourceType = 'file';
  }
  stopFile() {
    if (this.fileSource) { try { this.fileSource.stop(); } catch (e) {} this.fileSource = null; }
  }
}
