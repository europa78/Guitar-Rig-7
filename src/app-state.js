// ============================================================
// APP STATE — shared live bindings
// ============================================================
// Modules import these and get live views of the current state.
// `selected` is a let binding, so consumers always see the latest
// value via the module's live export.

import { AudioEngine } from './audio/engine.js';

export const engine = new AudioEngine();

export let selected = null;
export const selectedSet = new Set();

export function setSelected(c) { selected = c; }

export function selectSingle(c) {
  selectedSet.clear();
  if (c) selectedSet.add(c);
  selected = c;
}

export function toggleInSelection(c) {
  if (selectedSet.has(c)) {
    selectedSet.delete(c);
    if (selected === c) {
      selected = selectedSet.size ? [...selectedSet][selectedSet.size - 1] : null;
    }
  } else {
    selectedSet.add(c);
    selected = c;
  }
}

export function clearSelection() {
  selectedSet.clear();
  selected = null;
}

export function isInSelection(c) {
  return selectedSet.has(c);
}
