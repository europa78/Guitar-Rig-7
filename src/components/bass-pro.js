// ============================================================
// BASS PRO — gate + 3-band EQ + drive + master
// ============================================================

import { Component } from './base.js';
import { knobHTML, wireComponent } from './wiring.js';
import { dbToGain, makeDriveCurve } from '../audio/dsp-utils.js';

export class BassPro extends Component {
  constructor() {
    super('BASS PRO', 'basspro');
    this.params = { gate: 0, bass: 0, mid: 0, midFreq: 800, treble: 0, drive: 0, master: 0 };
  }

  _buildDSP(ctx) {
    this.nodes.gate = ctx.createGain();
    this.nodes.bass = ctx.createBiquadFilter();
    this.nodes.bass.type = 'lowshelf';
    this.nodes.bass.frequency.value = 100;
    this.nodes.mid = ctx.createBiquadFilter();
    this.nodes.mid.type = 'peaking';
    this.nodes.mid.frequency.value = 800;
    this.nodes.mid.Q.value = 1;
    this.nodes.treble = ctx.createBiquadFilter();
    this.nodes.treble.type = 'highshelf';
    this.nodes.treble.frequency.value = 3200;
    this.nodes.drive = ctx.createWaveShaper();
    this.nodes.drive.curve = makeDriveCurve(0);
    this.nodes.drive.oversample = '4x';
    this.nodes.master = ctx.createGain();
  }

  _connectDSP() {
    this.inGain
      .connect(this.nodes.gate)
      .connect(this.nodes.bass)
      .connect(this.nodes.mid)
      .connect(this.nodes.treble)
      .connect(this.nodes.drive)
      .connect(this.nodes.master)
      .connect(this.wetGain);
  }

  _applyParam(key, value) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (key === 'gate')    this.nodes.gate.gain.setTargetAtTime(dbToGain(value), t, 0.01);
    if (key === 'bass')    this.nodes.bass.gain.setTargetAtTime(value, t, 0.01);
    if (key === 'mid')     this.nodes.mid.gain.setTargetAtTime(value, t, 0.01);
    if (key === 'midFreq') this.nodes.mid.frequency.setTargetAtTime(value, t, 0.01);
    if (key === 'treble')  this.nodes.treble.gain.setTargetAtTime(value, t, 0.01);
    if (key === 'drive')   this.nodes.drive.curve = makeDriveCurve(value);
    if (key === 'master')  this.nodes.master.gain.setTargetAtTime(dbToGain(value), t, 0.01);
  }

  render() {
    const el = document.createElement('div');
    el.className = 'comp';
    el.dataset.id = this.id;
    el.innerHTML = `
      <div class="comp-header" draggable="true">
        <div class="comp-name">⊞ BASS PRO</div>
        <div class="comp-preset">▸ DEFAULT</div>
        <div class="comp-spacer"></div>
        <button class="comp-btn bypass active">●</button>
        <button class="comp-btn">⚙</button>
        <button class="comp-btn">✕</button>
      </div>
      <div class="comp-body">
        ${knobHTML('gate','GATE','0',24,-24,0)}
        ${knobHTML('bass','BASS','0',18,-18,0)}
        ${knobHTML('mid','MID','0',18,-18,0)}
        ${knobHTML('midFreq','MID FREQ','800',5000,200,800)}
        ${knobHTML('treble','TREBLE','0',18,-18,0)}
        ${knobHTML('drive','DRIVE','0',100,0,0)}
        ${knobHTML('master','MASTER','0',12,-24,0)}
      </div>
    `;
    this.el = el;
    wireComponent(this, el);
    return el;
  }
}
