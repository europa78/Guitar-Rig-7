// ============================================================
// APP STATE — shared live bindings
// ============================================================
// Modules import these and get live views of the current state.
// `selected` is a let binding, so consumers always see the latest
// value via the module's live export.

import { AudioEngine } from './audio/engine.js';

export const engine = new AudioEngine();

export let selected = null;
export function setSelected(c) { selected = c; }
