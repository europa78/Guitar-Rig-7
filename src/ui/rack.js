// ============================================================
// RACK + SIGNAL FLOW UI
// ============================================================
//
// renderRack        — rebuilds the rack DOM from engine state
// updateSignalFlow  — rebuilds the sidebar signal-flow list
// selectComponent   — marks a component as the active selection
// removeComponent   — removes a component from the engine + UI

import { engine, selected, setSelected, selectedSet, selectSingle, toggleInSelection, isInSelection } from '../app-state.js';
import { updateInfoPane } from './info-pane.js';

export function renderRack() {
  const container = document.getElementById('compContainer');
  container.innerHTML = '';
  if (engine.components.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'rack-drop-hint';
    hint.textContent = 'RACK IS EMPTY — ADD COMPONENTS FROM THE BROWSER';
    container.appendChild(hint);
  } else {
    engine.components.forEach(c => {
      const el = c.render();
      if (c.bypassed) el.classList.add('off');
      container.appendChild(el);
    });
  }

  const gfx = document.getElementById('globalFxContainer');
  gfx.innerHTML = '';
  if (engine.globalFxComponents.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'rack-drop-hint';
    hint.textContent = 'GLOBAL FX — APPLIED AFTER THE RACK';
    gfx.appendChild(hint);
  } else {
    engine.globalFxComponents.forEach(c => {
      const el = c.render();
      if (c.bypassed) el.classList.add('off');
      gfx.appendChild(el);
    });
  }
}

export function updateSignalFlow() {
  const el = document.getElementById('sfBlocks');
  el.innerHTML = '';
  const renderBlock = (c, last) => {
    const block = document.createElement('div');
    block.className = 'sf-block'
      + (c.bypassed ? ' bypassed' : '')
      + (isInSelection(c) ? ' selected' : '');
    block.textContent = c.name;
    block.addEventListener('click', () => selectComponent(c));
    el.appendChild(block);
    if (!last) {
      const arrow = document.createElement('div');
      arrow.className = 'sf-arrow';
      arrow.textContent = '▼';
      el.appendChild(arrow);
    }
  };

  engine.components.forEach((c, i) => {
    renderBlock(c, i === engine.components.length - 1 && engine.globalFxComponents.length === 0);
  });

  if (engine.globalFxComponents.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'sf-arrow';
    divider.textContent = '▼';
    el.appendChild(divider);
    const gfxLabel = document.createElement('div');
    gfxLabel.style.cssText = 'font-size:8px;letter-spacing:1px;color:#6aa3ff;padding:2px 0;font-weight:700;';
    gfxLabel.textContent = 'GLOBAL FX';
    el.appendChild(gfxLabel);
    const divider2 = document.createElement('div');
    divider2.className = 'sf-arrow';
    divider2.textContent = '▼';
    el.appendChild(divider2);
    engine.globalFxComponents.forEach((c, i) => {
      renderBlock(c, i === engine.globalFxComponents.length - 1);
    });
  }
}

export function selectComponent(comp, multi = false) {
  if (multi) {
    toggleInSelection(comp);
  } else {
    selectSingle(comp);
  }
  refreshSelectionUI();
  updateInfoPane({ component: selected });
}

export function refreshSelectionUI() {
  const selIds = new Set([...selectedSet].map(c => c.id));
  document.querySelectorAll('.comp').forEach(el => {
    el.classList.toggle('selected', selIds.has(el.dataset.id));
  });
  updateSignalFlow();
}

export function removeComponent(comp) {
  let idx = engine.components.indexOf(comp);
  let arr = engine.components;
  if (idx === -1) {
    idx = engine.globalFxComponents.indexOf(comp);
    arr = engine.globalFxComponents;
  }
  if (idx === -1) return;
  arr.splice(idx, 1);
  engine._rebuildChain();
  selectedSet.delete(comp);
  if (selected === comp) {
    setSelected(selectedSet.size ? [...selectedSet][selectedSet.size - 1] : null);
  }
  renderRack();
  updateSignalFlow();
}
