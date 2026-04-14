// ============================================================
// CONTROL ROOM PRO — cab/room sim (HP + LP + IR-lite)
// ============================================================

import { Component } from './base.js';
import { knobHTML, wireComponent } from './wiring.js';
import { dbToGain, makeCabIR } from '../audio/dsp-utils.js';

export class ControlRoomPro extends Component {
  constructor() {
    super('CONTROL ROOM PRO', 'controlroom');
    this.params = { bass: 0, treble: 0, air: 0, volume: 0 };
  }

  _buildDSP(ctx) {
    this.nodes.hp = ctx.createBiquadFilter();
    this.nodes.hp.type = 'highpass';
    this.nodes.hp.frequency.value = 80;
    this.nodes.lp = ctx.createBiquadFilter();
    this.nodes.lp.type = 'lowpass';
    this.nodes.lp.frequency.value = 5500;
    this.nodes.lp.Q.value = 0.7;
    this.nodes.bass = ctx.createBiquadFilter();
    this.nodes.bass.type = 'lowshelf';
    this.nodes.bass.frequency.value = 150;
    this.nodes.treble = ctx.createBiquadFilter();
    this.nodes.treble.type = 'peaking';
    this.nodes.treble.frequency.value = 2500;
    this.nodes.treble.Q.value = 0.8;
    this.nodes.air = ctx.createBiquadFilter();
    this.nodes.air.type = 'highshelf';
    this.nodes.air.frequency.value = 8000;
    this.nodes.vol = ctx.createGain();
    // Synthetic impulse response for cab coloration
    this.nodes.conv = ctx.createConvolver();
    this.nodes.conv.buffer = makeCabIR(ctx, 0.03);
    this.nodes.dryCab = ctx.createGain();
    this.nodes.wetCab = ctx.createGain();
    this.nodes.dryCab.gain.value = 0.4;
    this.nodes.wetCab.gain.value = 0.6;
  }

  _connectDSP() {
    this.inGain
      .connect(this.nodes.hp)
      .connect(this.nodes.lp)
      .connect(this.nodes.bass)
      .connect(this.nodes.treble)
      .connect(this.nodes.air);
    this.nodes.air.connect(this.nodes.dryCab).connect(this.nodes.vol);
    this.nodes.air.connect(this.nodes.conv).connect(this.nodes.wetCab).connect(this.nodes.vol);
    this.nodes.vol.connect(this.wetGain);
  }

  _applyParam(key, value) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (key === 'bass')   this.nodes.bass.gain.setTargetAtTime(value, t, 0.01);
    if (key === 'treble') this.nodes.treble.gain.setTargetAtTime(value, t, 0.01);
    if (key === 'air')    this.nodes.air.gain.setTargetAtTime(value, t, 0.01);
    if (key === 'volume') this.nodes.vol.gain.setTargetAtTime(dbToGain(value), t, 0.01);
  }

  render() {
    const el = document.createElement('div');
    el.className = 'comp';
    el.dataset.id = this.id;
    el.innerHTML = `
      <div class="comp-header" draggable="true">
        <div class="comp-name">⊞ CONTROL ROOM PRO</div>
        <div class="comp-preset">▸ 8x10 BASS PRO</div>
        <div class="comp-spacer"></div>
        <button class="comp-btn bypass active">●</button>
        <button class="comp-btn">⚙</button>
        <button class="comp-btn">✕</button>
      </div>
      <div class="comp-body">
        <div class="cab-display">
          <div class="cab-icon"></div>
          <div class="cab-icon"></div>
          <div class="cab-icon"></div>
        </div>
        <div style="flex:1"></div>
        ${knobHTML('bass','BASS','0',12,-12,0)}
        ${knobHTML('treble','TREBLE','0',12,-12,0)}
        ${knobHTML('air','AIR','0',12,-12,0)}
        ${knobHTML('volume','VOLUME','0',12,-24,0)}
      </div>
    `;
    this.el = el;
    wireComponent(this, el);
    return el;
  }
}
