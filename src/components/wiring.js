// ============================================================
// COMPONENT UI WIRING — knobs, bypass, mono/stereo, drag/drop
// ============================================================
//
// knobHTML      — returns the HTML for a single knob group
// wireComponent — attaches all interaction handlers to a rendered
//                 component: knobs, bypass, mono toggle, close,
//                 drag-reorder, click-to-select, hover-info.

import { engine, selected, isInSelection } from '../app-state.js';
import { updateInfoPane, COMPONENT_INFO } from '../ui/info-pane.js';
import { toast } from '../ui/toast.js';
import { selectComponent, removeComponent, renderRack, updateSignalFlow } from '../ui/rack.js';
import { pushHistory, COMPONENT_REGISTRY } from './registry.js';

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
  const settingsBtn = el.querySelectorAll('.comp-btn')[1];
  const closeBtn = el.querySelectorAll('.comp-btn')[2];
  closeBtn.addEventListener('click', () => {
    pushHistory();
    removeComponent(comp);
  });

  // ---- Collapse/Expand ----------------------------------------
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'comp-btn comp-collapse';
  collapseBtn.title = 'Collapse/Expand';
  collapseBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6 L8 10 L12 6"/></svg>`;
  bypassBtn.insertAdjacentElement('afterend', collapseBtn);
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = el.classList.toggle('comp-collapsed');
    collapseBtn.classList.toggle('active', isCollapsed);
  });

  // ---- Expert Panel toggle ------------------------------------
  settingsBtn.className = 'comp-btn comp-expert-btn';
  settingsBtn.title = 'Show Expert Panel';
  settingsBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="10" height="10" rx="1"/><line x1="6" y1="6" x2="10" y2="6"/><line x1="6" y1="8.5" x2="10" y2="8.5"/><line x1="6" y1="11" x2="8" y2="11"/></svg>`;
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = el.classList.toggle('expert-open');
    settingsBtn.classList.toggle('active', isOpen);
    toast(`${comp.name}: Expert Panel ${isOpen ? 'shown' : 'hidden'}`);
  });
  if (!el.querySelector('.comp-expert-panel')) {
    const expertPanel = document.createElement('div');
    expertPanel.className = 'comp-expert-panel';
    expertPanel.innerHTML = '<em>Expert controls — available in future update</em>';
    const body = el.querySelector('.comp-body');
    if (body) body.insertAdjacentElement('afterend', expertPanel);
  }

  // ---- Component Preset Selector ----------------------------
  const presetEl = el.querySelector('.comp-preset');
  if (presetEl) {
    const reg = COMPONENT_REGISTRY[comp.id];
    const presets = reg ? reg.presets : [];
    if (!comp._currentPresetIdx) comp._currentPresetIdx = 0;

    const updatePresetLabel = () => {
      const name = presets[comp._currentPresetIdx] || 'INIT';
      presetEl.innerHTML = `<span class="comp-preset-nav" data-dir="prev">‹</span>` +
        `<span class="comp-preset-nav" data-dir="next">›</span>` +
        `<span class="comp-preset-label">${name}</span>` +
        `<span class="comp-preset-arrow">⌄</span>`;
    };
    updatePresetLabel();

    const loadPresetIdx = (idx) => {
      comp._currentPresetIdx = idx;
      updatePresetLabel();
      toast(`${comp.name}: ${presets[idx] || 'INIT'}`);
    };

    presetEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const dir = e.target.dataset?.dir;
      if (dir === 'prev') {
        loadPresetIdx(comp._currentPresetIdx > 0 ? comp._currentPresetIdx - 1 : presets.length - 1);
        return;
      }
      if (dir === 'next') {
        loadPresetIdx(comp._currentPresetIdx < presets.length - 1 ? comp._currentPresetIdx + 1 : 0);
        return;
      }
      // Toggle dropdown
      let dropdown = el.querySelector('.comp-preset-dropdown');
      if (dropdown) { dropdown.remove(); return; }
      dropdown = document.createElement('div');
      dropdown.className = 'comp-preset-dropdown';

      const saveAs = document.createElement('button');
      saveAs.className = 'comp-preset-dropdown-item save-as';
      saveAs.textContent = 'Save As';
      saveAs.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dropdown.remove();
        toast(`${comp.name}: Save As — not available in web edition`);
      });
      dropdown.appendChild(saveAs);

      presets.forEach((p, i) => {
        const item = document.createElement('button');
        item.className = 'comp-preset-dropdown-item' + (i === comp._currentPresetIdx ? ' active' : '');
        item.textContent = p;
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          dropdown.remove();
          loadPresetIdx(i);
        });
        dropdown.appendChild(item);
      });
      presetEl.appendChild(dropdown);

      const closeDrop = (ev) => {
        if (!presetEl.contains(ev.target)) { dropdown.remove(); document.removeEventListener('click', closeDrop); }
      };
      setTimeout(() => document.addEventListener('click', closeDrop));
    });
  }

  // ---- Drag to reorder / delete ------------------------------
  header.addEventListener('dragstart', (e) => {
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-rack-component', comp.id);
    e.dataTransfer.setData('text/plain', comp.id);
  });
  header.addEventListener('dragend', (e) => {
    el.classList.remove('dragging');
    if (e.dataTransfer.dropEffect === 'none') {
      pushHistory();
      removeComponent(comp);
      toast(`Removed: ${comp.name}`);
    }
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.remove('drop-above', 'drop-below', 'drop-replace');
    if (e.dataTransfer.types.includes('application/x-rack-component')) {
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      el.classList.add(e.clientY < midY ? 'drop-above' : 'drop-below');
    } else {
      el.classList.add('drop-replace');
    }
  });
  el.addEventListener('dragleave', () => {
    el.classList.remove('drop-above', 'drop-below', 'drop-replace');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-above', 'drop-below', 'drop-replace');
    if (e.dataTransfer.types.includes('application/x-rack-component')) {
      const draggedId = e.dataTransfer.getData('application/x-rack-component');
      const fromIdx = engine.components.findIndex(c => c.id === draggedId);
      const toIdx = engine.components.findIndex(c => c.id === comp.id);
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        pushHistory();
        engine.moveComponent(fromIdx, toIdx);
        renderRack();
        updateSignalFlow();
      }
    } else {
      const compId = e.dataTransfer.getData('text/plain');
      const reg = COMPONENT_REGISTRY[compId];
      if (reg) {
        pushHistory();
        const Cls = reg.cls();
        const inst = new Cls();
        const idx = engine.components.indexOf(comp);
        if (idx !== -1) {
          inst._engineRef = engine;
          inst.build(engine.ctx);
          engine.components.splice(idx, 1, inst);
          engine._rebuildChain();
          renderRack();
          updateSignalFlow();
          selectComponent(inst);
          toast(`Replaced with: ${reg.name}`);
        }
      }
    }
  });

  // ---- Click to select + hover info -------------------------
  el.addEventListener('click', (e) => {
    if (!e.target.classList.contains('comp-btn')) {
      selectComponent(comp, e.shiftKey);
    }
  });
  el.addEventListener('mouseenter', () => {
    updateInfoPane({ component: comp });
  });
}
