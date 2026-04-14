// ============================================================
// STEREO TUNE — chromatic tuner (autocorrelation) + width (stub)
// ============================================================

import { Component } from './base.js';
import { knobHTML, wireComponent } from './wiring.js';
import { autoCorrelate, freqToNote } from '../audio/dsp-utils.js';

export class StereoTune extends Component {
  constructor() {
    super('STEREO TUNE', 'stereotune');
    this.params = { spread: 0, shift: 0, mix: 100 };
    this._note = '—';
    this._cents = 0;
    this._freq = 0;
  }

  _buildDSP(ctx) {
    this.nodes.splitter = ctx.createChannelSplitter(2);
    this.nodes.merger = ctx.createChannelMerger(2);
    this.nodes.lGain = ctx.createGain();
    this.nodes.rGain = ctx.createGain();
    this.nodes.mono = ctx.createGain();
    this.nodes.analyser = ctx.createAnalyser();
    this.nodes.analyser.fftSize = 4096;
    this._buf = new Float32Array(this.nodes.analyser.fftSize);
  }

  _connectDSP() {
    // Tap for pitch analysis + direct passthrough (width is a future enhancement)
    this.inGain.connect(this.nodes.analyser);
    this.inGain.connect(this.wetGain);
  }

  _applyParam(_key, _value) { /* future: spread/shift/mix */ }

  updateTuner() {
    if (!this.nodes.analyser) return;
    this.nodes.analyser.getFloatTimeDomainData(this._buf);
    const sr = this.ctx.sampleRate;
    const f = autoCorrelate(this._buf, sr);
    if (f > 0) {
      this._freq = f;
      const { note, cents } = freqToNote(f);
      this._note = note;
      this._cents = cents;
    } else {
      this._note = '—';
      this._cents = 0;
    }
    if (this._noteEl) this._noteEl.textContent = this._note;
    if (this._centsEl) {
      this._centsEl.textContent = (this._cents > 0 ? '+' : '') + this._cents.toFixed(0) + ' cents';
    }
    this._drawTunerMeter();
  }

  _drawTunerMeter() {
    if (!this._meterCanvas) return;
    const c = this._meterCanvas;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== c.clientWidth * dpr) {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    }
    const ctx2d = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx2d.clearRect(0, 0, w, h);

    // Center line
    ctx2d.fillStyle = '#3a3a40';
    ctx2d.fillRect(w / 2 - 1, 0, 2, h);

    // Ticks
    for (let i = -5; i <= 5; i++) {
      const x = w / 2 + (i / 5) * (w / 2 - 10);
      ctx2d.fillStyle = i === 0 ? '#ffb020' : '#2a2a30';
      ctx2d.fillRect(x - 1, h * 0.2, 2, h * 0.6);
    }

    // Needle
    if (this._freq > 0) {
      const pos = Math.max(-50, Math.min(50, this._cents));
      const x = w / 2 + (pos / 50) * (w / 2 - 10);
      const inTune = Math.abs(this._cents) < 5;
      ctx2d.fillStyle = inTune ? '#44dd66' : '#ffb020';
      ctx2d.shadowColor = ctx2d.fillStyle;
      ctx2d.shadowBlur = 8;
      ctx2d.fillRect(x - 2, 4, 4, h - 8);
      ctx2d.shadowBlur = 0;
    }
  }

  render() {
    const el = document.createElement('div');
    el.className = 'comp';
    el.dataset.id = this.id;
    el.innerHTML = `
      <div class="comp-header" draggable="true">
        <div class="comp-name">⊞ STEREO TUNE</div>
        <div class="comp-preset">▸ DEFAULT</div>
        <div class="comp-spacer"></div>
        <button class="comp-btn bypass active">●</button>
        <button class="comp-btn">⚙</button>
        <button class="comp-btn">✕</button>
      </div>
      <div class="comp-body">
        <div class="tuner">
          <div class="tuner-display">
            <div class="tuner-note">—</div>
            <div class="tuner-cents">0 cents</div>
          </div>
          <div class="tuner-meter"><canvas></canvas></div>
        </div>
      </div>
    `;
    this.el = el;
    wireComponent(this, el);
    this._noteEl = el.querySelector('.tuner-note');
    this._centsEl = el.querySelector('.tuner-cents');
    this._meterCanvas = el.querySelector('.tuner-meter canvas');
    return el;
  }
}
