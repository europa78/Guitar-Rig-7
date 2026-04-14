// ============================================================
// FAST COMP — dynamics compressor with drive + makeup
// ============================================================

import { Component } from './base.js';
import { knobHTML, wireComponent } from './wiring.js';
import { dbToGain } from '../audio/dsp-utils.js';

export class FastComp extends Component {
  constructor() {
    super('FAST COMP', 'fastcomp');
    this.params = { input: 0, attack: 20, ratio: 4, makeup: 0 };
  }

  _buildDSP(ctx) {
    this.nodes.inLevel = ctx.createGain();
    this.nodes.inLevel.gain.value = 1;
    this.nodes.comp = ctx.createDynamicsCompressor();
    this.nodes.comp.threshold.value = -24;
    this.nodes.comp.knee.value = 6;
    this.nodes.comp.ratio.value = 4;
    this.nodes.comp.attack.value = 0.02;
    this.nodes.comp.release.value = 0.25;
    this.nodes.makeup = ctx.createGain();
    this.nodes.makeup.gain.value = 1;
  }

  _connectDSP() {
    this.inGain
      .connect(this.nodes.inLevel)
      .connect(this.nodes.comp)
      .connect(this.nodes.makeup)
      .connect(this.wetGain);
  }

  _applyParam(key, value) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (key === 'input') {
      this.nodes.inLevel.gain.setTargetAtTime(dbToGain(value), t, 0.01);
      // Threshold tracks input a little for musical feel
      this.nodes.comp.threshold.setTargetAtTime(-24 - value * 0.5, t, 0.01);
    }
    if (key === 'attack') this.nodes.comp.attack.setTargetAtTime(value / 1000, t, 0.01);
    if (key === 'ratio')  this.nodes.comp.ratio.setTargetAtTime(value, t, 0.01);
    if (key === 'makeup') this.nodes.makeup.gain.setTargetAtTime(dbToGain(value), t, 0.01);
  }

  render() {
    const el = document.createElement('div');
    el.className = 'comp';
    el.dataset.id = this.id;
    el.innerHTML = `
      <div class="comp-header" draggable="true">
        <div class="comp-name">⊞ FAST COMP</div>
        <div class="comp-preset">▸ INIT</div>
        <div class="comp-spacer"></div>
        <button class="comp-btn bypass active" title="Bypass">●</button>
        <button class="comp-btn" title="Settings">⚙</button>
        <button class="comp-btn" title="Close">✕</button>
      </div>
      <div class="comp-body">
        ${knobHTML('input','INPUT','-12',12,-12,0)}
        ${knobHTML('attack','ATTACK','20',100,0.1,20)}
        ${knobHTML('ratio','RATIO','4:1',20,1,4)}
        <div class="gr-meter">
          <div class="gr-label">GAIN REDUCTION</div>
          <canvas></canvas>
        </div>
        ${knobHTML('makeup','MAKEUP','0',24,-12,0)}
      </div>
    `;
    this.el = el;
    wireComponent(this, el);
    this._meterCanvas = el.querySelector('.gr-meter canvas');
    return el;
  }

  drawMeter() {
    if (!this._meterCanvas || !this.nodes.comp) return;
    const c = this._meterCanvas;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== c.clientWidth * dpr) {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    }
    const ctx2d = c.getContext('2d');
    ctx2d.clearRect(0, 0, c.width, c.height);
    const reduction = this.nodes.comp.reduction; // negative dB
    const w = c.width, h = c.height;
    const segs = 20;
    const segW = (w - 10) / segs;
    const active = Math.min(segs, Math.floor(-reduction * 1.5));
    for (let i = 0; i < segs; i++) {
      ctx2d.fillStyle = i < active
        ? (i > 12 ? '#ff4444' : i > 7 ? '#ffaa22' : '#ffb020')
        : '#1a1a1e';
      ctx2d.fillRect(5 + i * segW, h * 0.35, segW - 2, h * 0.4);
    }
  }
}
