// ============================================================
// COMPONENT UI WIRING — knobs, bypass, mono/stereo, drag/drop
// ============================================================
//
// knobHTML      — returns the HTML for a single knob group
// wireComponent — attaches all interaction handlers to a rendered
//                 component: knobs, bypass, mono toggle, close,
//                 drag-reorder, click-to-select, hover-info.

import { engine, selected } from '../app-state.js';
import { updateInfoPane, COMPONENT_INFO } from '../ui/info-pane.js';
import { toast } from '../ui/toast.js';
import { selectComponent, removeComponent, renderRack, updateSignalFlow } from '../ui/rack.js';
import { pushHistory } from './registry.js';

export function knobHTML(key, label, displayValue, max, min, val) {
  return `
    <div class="knob-group" data-param="${key}" data-min="${min}" data-max="${max}">
      <div class="knob" data-value="${val}">
        <div class="knob-indicator"></div>
      </div>
      <div class="knob-label">${label}</div>
      <div class="knob-value">${displayValue}</div>
    </div>
  `;
}

export function wireComponent(comp, el) {
  // ---- Knobs -------------------------------------------------
  el.querySelectorAll('.knob-group').forEach(g => {
    const key = g.dataset.param;
    const min = parseFloat(g.dataset.min);
    const max = parseFloat(g.dataset.max);
    const knob = g.querySelector('.knob');
    const indicator = g.querySelector('.knob-indicator');
    const valueEl = g.querySelector('.knob-value');
    let val = parseFloat(knob.dataset.value);

    const update = () => {
      const range = max - min;
      const norm = (val - min) / range;
      const angle = -135 + norm * 270;
      indicator.style.transform = `translateX(-50%) rotate(${angle}deg)`;
      valueEl.textContent = Math.abs(val) < 10 ? val.toFixed(1) : val.toFixed(0);
      comp.setParam(key, val);
    };
    update();

    let startY = 0, startVal = 0;
    knob.addEventListener('pointerdown', e => {
      e.preventDefault();
      startY = e.clientY;
      startVal = val;
      knob.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dy = startY - ev.clientY;
        const range = max - min;
        val = Math.max(min, Math.min(max, startVal + (dy / 150) * range));
        update();
      };
      const up = () => {
        knob.removeEventListener('pointermove', move);
        knob.removeEventListener('pointerup', up);
      };
      knob.addEventListener('pointermove', move);
      knob.addEventListener('pointerup', up);
    });

    knob.addEventListener('dblclick', () => {
      val = (min + max) / 2;
      if (min < 0 && max > 0) val = 0;
      update();
    });

    // Hover → show control description in info pane
    g.addEventListener('mouseenter', () => {
      updateInfoPane({
        control: comp.id + '.' + key,
        componentName: (COMPONENT_INFO[comp.id] || {}).name || comp.name,
      });
    });
    g.addEventListener('mouseleave', () => {
      if (selected) updateInfoPane({ component: selected });
      else updateInfoPane();
    });
  });

  // ---- Bypass / On-Off --------------------------------------
  const bypassBtn = el.querySelector('.comp-btn.bypass');
  bypassBtn.classList.add('onoff');
  bypassBtn.classList.remove('bypass');
  bypassBtn.title = 'Component On/Off — click to remove from signal chain';
  bypassBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 4 A5 5 0 1 0 11 4"/><line x1="8" y1="2.5" x2="8" y2="8"/></svg>`;
  bypassBtn.addEventListener('click', () => {
    const newOff = !comp.bypassed;
    comp.setBypass(newOff);
    bypassBtn.classList.toggle('off', newOff);
    el.classList.toggle('off', newOff);
    updateSignalFlow();
  });

  // ---- Mono / Stereo toggle (injected into header) ----------
  const header = el.querySelector('.comp-header');
  const msToggle = document.createElement('div');
  msToggle.className = 'comp-ms';
  msToggle.title = 'Mono/Stereo processing';
  msToggle.innerHTML = `
    <button data-ms="stereo" class="active">ST</button>
    <button data-ms="mono">M</button>
  `;
  const firstBtn = header.querySelector('.comp-btn');
  header.insertBefore(msToggle, firstBtn);
  msToggle.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      msToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      comp.setMonoMode(btn.dataset.ms === 'mono');
      toast(`${comp.name}: ${btn.dataset.ms === 'mono' ? 'Mono (CPU saved)' : 'Stereo'} processing`);
    });
  });

  // ---- Close button -----------------------------------------
  const closeBtn = el.querySelectorAll('.comp-btn')[2];
  closeBtn.addEventListener('click', () => {
    pushHistory();
    removeComponent(comp);
  });

  // ---- Drag to reorder --------------------------------------
  header.addEventListener('dragstart', (e) => {
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', comp.id);
  });
  header.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const draggedId = e.dataTransfer.getData('text/plain');
    const fromIdx = engine.components.findIndex(c => c.id === draggedId);
    const toIdx = engine.components.findIndex(c => c.id === comp.id);
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      pushHistory();
      engine.moveComponent(fromIdx, toIdx);
      renderRack();
      updateSignalFlow();
    }
  });

  // ---- Click to select + hover info -------------------------
  el.addEventListener('click', (e) => {
    if (!e.target.classList.contains('comp-btn')) {
      selectComponent(comp);
    }
  });
  el.addEventListener('mouseenter', () => {
    updateInfoPane({ component: comp });
  });
}
