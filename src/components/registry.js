// ============================================================
// COMPONENT REGISTRY + SERIALIZATION + UNDO/REDO
// ============================================================
//
// The registry is populated by main.js at boot via registerComponent(),
// not by importing component classes from here.  That inversion breaks
// what would otherwise be a wiring → registry → component → wiring cycle.

import { engine, setSelected } from '../app-state.js';
import { toast } from '../ui/toast.js';
import { renderRack, updateSignalFlow } from '../ui/rack.js';

export const COMPONENT_REGISTRY = {};

export function registerComponent(id, cls, name) {
  COMPONENT_REGISTRY[id] = { cls: () => cls, name };
}

export function serializeComponent(c) {
  return {
    id: c.id,
    params: JSON.parse(JSON.stringify(c.params)),
    bypassed: c.bypassed,
  };
}

export function deserializeComponent(data) {
  const reg = COMPONENT_REGISTRY[data.id];
  if (!reg) return null;
  const c = new (reg.cls())();
  c._pendingParams = data.params;
  c._pendingBypass = data.bypassed;
  return c;
}

export function serializeRack() {
  return {
    rack: engine.components.map(serializeComponent),
    globalFx: engine.globalFxComponents.map(serializeComponent),
  };
}

// Restore the rack from a snapshot.
export function restoreRack(snapshot) {
  const rackData = Array.isArray(snapshot) ? snapshot : (snapshot.rack || []);
  const gfxData = Array.isArray(snapshot) ? [] : (snapshot.globalFx || []);

  engine.components.forEach(c => { try { c.getOutput().disconnect(); } catch (e) {} });
  engine.globalFxComponents.forEach(c => { try { c.getOutput().disconnect(); } catch (e) {} });
  engine.components = [];
  engine.globalFxComponents = [];

  const restore = (data, arr) => {
    const c = deserializeComponent(data);
    if (c) {
      c._engineRef = engine;
      c.build(engine.ctx);
      if (c._pendingParams) Object.entries(c._pendingParams).forEach(([k, v]) => c.setParam(k, v));
      if (c._pendingBypass) c.bypassed = true;
      arr.push(c);
    }
  };
  rackData.forEach(d => restore(d, engine.components));
  gfxData.forEach(d => restore(d, engine.globalFxComponents));
  engine._rebuildChain();
  setSelected(null);
  renderRack();
  updateSignalFlow();
}

// ---- Undo / Redo ------------------------------------------------
export const history = { stack: [], pointer: -1 };

export function pushHistory() {
  history.stack = history.stack.slice(0, history.pointer + 1);
  history.stack.push(JSON.stringify(serializeRack()));
  if (history.stack.length > 50) history.stack.shift();
  history.pointer = history.stack.length - 1;
}

export function undo() {
  if (history.pointer <= 0) { toast('Nothing to undo'); return; }
  history.pointer--;
  restoreRack(JSON.parse(history.stack[history.pointer]));
  toast('Undo');
}

export function redo() {
  if (history.pointer >= history.stack.length - 1) { toast('Nothing to redo'); return; }
  history.pointer++;
  restoreRack(JSON.parse(history.stack[history.pointer]));
  toast('Redo');
}
