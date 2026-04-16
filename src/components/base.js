// ============================================================
// COMPONENT BASE CLASS
// ============================================================
//
// Subclasses override:
//   _buildDSP(ctx)      — create internal DSP nodes
//   _connectDSP()       — wire inGain → ... → wetGain
//   _applyParam(k, v)   — respond to parameter changes
//   render()            — return the component's DOM element
//
// The engine calls _rebuildChain() to assemble the signal graph,
// skipping components where `bypassed === true` (they're truly
// removed from the live graph, freeing CPU).

export class Component {
  constructor(name, id) {
    this.name = name;
    this.id = id;
    this.bypassed = false;   // off = removed from the chain
    this.monoMode = false;   // true = downmix to mono before processing
    this.params = {};
    this.nodes = {};
    this.el = null;
    this.wetGain = null;
    this.dryGain = null;
    this.inGain = null;
    this.outGain = null;
    this.ctx = null;
    this._engineRef = null;  // set by engine when added
  }

  build(ctx) {
    this.ctx = ctx;
    this.inGain = ctx.createGain();
    this.outGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0;
    this.wetGain.gain.value = 1;

    // Mono downmix wrapper — inserted BEFORE the component's input when monoMode is on.
    // channelCount=1 + channelCountMode='explicit' forces downmix of stereo input.
    this._monoDownmix = ctx.createGain();
    this._monoDownmix.channelCount = 1;
    this._monoDownmix.channelCountMode = 'explicit';
    this._monoDownmix.channelInterpretation = 'speakers';

    this._buildDSP(ctx);

    // Internal safety routing: in → dry → out (silent) + DSP path → wet → out
    this.inGain.connect(this.dryGain);
    this.dryGain.connect(this.outGain);
    this.wetGain.connect(this.outGain);
    this._connectDSP();
  }

  _buildDSP(ctx) { /* override */ }
  _connectDSP() { /* override: connect inGain → ... → wetGain */ }

  getInput() { return this.inGain; }
  getOutput() { return this.outGain; }

  disconnect() {
    try { this.outGain.disconnect(); } catch(e){}
  }

  // On/Off — removes the component from the live graph entirely when off.
  setBypass(off) {
    this.bypassed = off;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.outGain.gain.setTargetAtTime(off ? 0 : 1, t, 0.005);
    // Defer rebuild briefly so the gain has time to ramp
    if (this._engineRef) {
      setTimeout(() => this._engineRef._rebuildChain(), 20);
    }
  }

  setMonoMode(mono) {
    this.monoMode = mono;
    if (this._engineRef) this._engineRef._rebuildChain();
  }

  setParam(key, value) {
    this.params[key] = value;
    this._applyParam(key, value);
  }

  _applyParam(key, value) { /* override */ }
}
