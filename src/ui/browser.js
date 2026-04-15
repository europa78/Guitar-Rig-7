// ============================================================
// BROWSER — Presets + Components browsing UI
// ============================================================
//
// Manual reference: "Overview of the Browser"
//   1. Content selector  (Presets / Components)
//   2. User Content      (filters to user-created content only)
//   3. Browser interface (adapts to the selected content type)
//
// In Presets mode the browser shows:
//   Search → Color tags → Expandable category filters with tag
//   pills → Curated header → Results list → Results count.
//
// In Components mode the browser shows a grid of component tiles
// (one per registered component). Clicking a tile adds the
// component to the end of the rack.

import { engine } from '../app-state.js';
import { COMPONENT_REGISTRY } from '../components/registry.js';
import { renderRack, updateSignalFlow, selectComponent } from './rack.js';
import { toast } from './toast.js';

// ------------------------------------------------------------
// DATA
// ------------------------------------------------------------

export const COLORS = [
  '#ff4444', '#ff8800', '#ffdd00', '#88dd22',
  '#22ddaa', '#2288dd', '#6644ff', '#cc44ff',
];

// Filter categories and their available tags, modelled after the
// category filter section in the Guitar Rig 7 browser.
export const FILTER_CATEGORIES = {
  'Input Sources': ['Bass', 'Guitar', 'Drums', 'Vocals', 'Synth', 'Keys'],
  'FX Types':      ['Compression', 'Delay', 'Distortion', 'EQ', 'Filter', 'Modulation', 'Pitch', 'Reverb', 'Dynamics'],
  'Characters':    ['Clean', 'Colored', 'Complex', 'Creative', 'Dissonant', 'Distorted', 'Evolving', 'Mash-Up', 'Mixing', 'Modulated', 'Pitched', 'Re-Sample', 'Rhythmic', 'Spacious', 'Special FX'],
  'Amplifiers':    ['Marshall', 'Fender', 'Vox', 'Mesa', 'Hiwatt', 'Ampeg'],
  'Genres':        ['Blues', 'Country', 'Funk', 'Jazz', 'Metal', 'Pop', 'Rock', 'R&B'],
  'Bass Amps':     ['Big Tweed', 'Bass Pro', 'Bass V', 'Ampeg SVT'],
  'Effects':       ['Chorus', 'Flanger', 'Phaser', 'Tremolo', 'Wah'],
  'GR Mix':        ['Master', 'Bus', 'Parallel'],
  'Guitar Amps':   ['Jump', 'Lead 800', 'Citrus', 'Twang', 'Plexi'],
  'Songs':         ['Riffs', 'Solos', 'Rhythm'],
  'Styles':        ['Vintage', 'Modern', 'Lo-Fi', 'Hi-Fi'],
};

// Sample preset library with metadata used by the filter.
// `c` = character tags, `g` = genre tags, `a` = amp tags, `color` = color tag
export const LIBRARY_PRESETS = [
  { name: '1993 Hot Solo Rig',   color: '#ff4444', c: ['Distorted','Creative'], g: ['Rock','Metal'], a: ['Marshall'] },
  { name: '2 in the Streets',    color: '#ff8800', c: ['Rhythmic','Modulated'], g: ['Funk'],         a: ['Fender'] },
  { name: '3d Mangler',          color: '#cc44ff', c: ['Special FX','Evolving'], g: ['Rock'],        a: ['Mesa'] },
  { name: '4th Chill',           color: '#22ddaa', c: ['Clean','Spacious'],     g: ['Jazz','R&B'],   a: ['Fender'] },
  { name: "70's Octave Solo",    color: '#ffdd00', c: ['Pitched','Modulated'],  g: ['Rock','Blues'], a: ['Marshall'] },
  { name: '800 Clean',           color: '#88dd22', c: ['Clean','Colored'],      g: ['Rock','Pop'],   a: ['Marshall'] },
  { name: '80s Solo',            color: '#6644ff', c: ['Distorted','Modulated'],g: ['Rock'],         a: ['Marshall'] },
  { name: 'Articulator A',       color: '#2288dd', c: ['Clean','Complex'],      g: ['Jazz'],         a: ['Fender'] },
  { name: 'Auto Rhythm',         color: '#ff8800', c: ['Rhythmic','Modulated'], g: ['Funk','Pop'],   a: ['Vox'] },
  { name: 'Autofilter Bass',     color: '#22ddaa', c: ['Modulated','Rhythmic'], g: ['Funk'],         a: ['Ampeg'] },
  { name: '8Bar Autobreak',      color: '#cc44ff', c: ['Rhythmic','Special FX'],g: ['Pop'],          a: ['Vox'] },
  { name: 'Big Tweed Bass',      color: '#ff4444', c: ['Colored','Clean'],      g: ['Rock','Blues'], a: ['Fender'] },
  { name: 'Vocal Support Pop',   color: '#88dd22', c: ['Clean','Spacious'],     g: ['Pop'],          a: [] },
  { name: 'Voice Polish',        color: '#22ddaa', c: ['Clean','Colored'],      g: ['Pop','R&B'],    a: [] },
  { name: 'Wah-Gling Machine',   color: '#ffdd00', c: ['Modulated','Rhythmic'], g: ['Funk','Rock'],  a: ['Vox'] },
  { name: 'Warm Ensemble',       color: '#ff8800', c: ['Colored','Spacious'],   g: ['Jazz'],         a: ['Fender'] },
  { name: 'Warm Tweed',          color: '#ff8800', c: ['Colored','Clean'],      g: ['Blues','Rock'], a: ['Fender'] },
  { name: 'Warm Twin Echos',     color: '#6644ff', c: ['Spacious','Modulated'], g: ['Rock','Blues'], a: ['Fender'] },
  { name: 'Warm Vocals',         color: '#22ddaa', c: ['Clean','Spacious'],     g: ['Pop'],          a: [] },
  { name: 'Washington',          color: '#2288dd', c: ['Rhythmic','Distorted'], g: ['Rock'],         a: ['Marshall'] },
  { name: 'Water',               color: '#2288dd', c: ['Spacious','Evolving'],  g: ['Jazz','R&B'],   a: [] },
  { name: 'Wet Alley',           color: '#6644ff', c: ['Spacious','Modulated'], g: ['Pop','Rock'],   a: ['Fender'] },
  { name: 'Whisper Hall',        color: '#cc44ff', c: ['Spacious','Clean'],     g: ['Jazz'],         a: [] },
  { name: 'White Clean',         color: '#88dd22', c: ['Clean'],                g: ['Pop','Country'],a: ['Fender'] },
  { name: 'Wide Open Tom',       color: '#ff4444', c: ['Complex','Rhythmic'],   g: ['Rock'],         a: ['Marshall'] },
  { name: 'Wide Stereo Bass',    color: '#2288dd', c: ['Complex','Spacious'],   g: ['Funk','Rock'],  a: ['Ampeg'] },
  { name: 'Wet Saxofine',        color: '#ffdd00', c: ['Pitched','Modulated'],  g: ['Jazz'],         a: [] },
];

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------

const state = {
  mode: 'presets',         // 'presets' | 'components'
  search: '',
  activeColors: new Set(), // Set<string> of hex color codes
  activeTags: new Set(),   // Set<string> of tag labels
  openCategories: new Set(['Characters']), // which category panels are expanded
  userContent: false,
  selectedPreset: '1993 Hot Solo Rig',
  selectedComponentId: null,
};

// ------------------------------------------------------------
// MATCHING
// ------------------------------------------------------------

function presetMatchesFilters(p) {
  if (state.userContent) return false; // no user presets in the demo library
  if (state.search) {
    if (!p.name.toLowerCase().includes(state.search.toLowerCase())) return false;
  }
  if (state.activeColors.size && !state.activeColors.has(p.color)) return false;
  if (state.activeTags.size) {
    const all = [...(p.c || []), ...(p.g || []), ...(p.a || [])];
    for (const tag of state.activeTags) {
      if (!all.includes(tag)) return false;
    }
  }
  return true;
}

function filteredPresets() {
  return LIBRARY_PRESETS.filter(presetMatchesFilters);
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------

function renderColorFilters() {
  const el = document.getElementById('colorFilters');
  el.innerHTML = '';
  COLORS.forEach(c => {
    const d = document.createElement('div');
    d.className = 'color-tag' + (state.activeColors.has(c) ? ' active' : '');
    d.style.background = c;
    d.title = 'Filter by color tag';
    d.addEventListener('click', () => {
      if (state.activeColors.has(c)) state.activeColors.delete(c);
      else state.activeColors.add(c);
      renderColorFilters();
      renderResults();
    });
    el.appendChild(d);
  });
}

function renderCategoryFilters() {
  const el = document.getElementById('browserCategories');
  el.innerHTML = '';
  Object.entries(FILTER_CATEGORIES).forEach(([cat, tags]) => {
    const open = state.openCategories.has(cat);
    const wrap = document.createElement('div');
    wrap.className = 'browser-cat-wrap' + (open ? ' open' : '');

    const head = document.createElement('div');
    head.className = 'browser-cat';
    head.innerHTML = `<span>${cat}</span><span class="browser-cat-chev">⌄</span>`;
    head.addEventListener('click', () => {
      if (state.openCategories.has(cat)) state.openCategories.delete(cat);
      else state.openCategories.add(cat);
      renderCategoryFilters();
    });
    wrap.appendChild(head);

    if (open) {
      const pills = document.createElement('div');
      pills.className = 'browser-cat-pills';
      tags.forEach(tag => {
        const b = document.createElement('button');
        b.className = 'browser-tag-pill' + (state.activeTags.has(tag) ? ' active' : '');
        b.textContent = tag;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.activeTags.has(tag)) state.activeTags.delete(tag);
          else state.activeTags.add(tag);
          renderCategoryFilters();
          renderResults();
        });
        pills.appendChild(b);
      });
      wrap.appendChild(pills);
    }
    el.appendChild(wrap);
  });
}

function renderResults() {
  if (state.mode === 'presets') renderPresetResults();
  else renderComponentResults();
}

function renderPresetResults() {
  const listEl = document.getElementById('presetList');
  const curatedEl = document.getElementById('browserCurated');
  curatedEl.style.display = '';
  listEl.innerHTML = '';

  const presets = filteredPresets();
  presets.forEach(p => {
    const d = document.createElement('div');
    d.className = 'preset-item' + (p.name === state.selectedPreset ? ' active' : '');
    d.innerHTML = `
      <span class="preset-color" style="background:${p.color}"></span>
      <span class="preset-name">${p.name}</span>
    `;
    d.addEventListener('click', () => {
      state.selectedPreset = p.name;
      renderPresetResults();
      const nameEl = document.getElementById('presetName');
      if (nameEl) nameEl.textContent = p.name;
    });
    listEl.appendChild(d);
  });
  updateResultsCount(presets.length, 'Presets');
}

function renderComponentResults() {
  const listEl = document.getElementById('presetList');
  const curatedEl = document.getElementById('browserCurated');
  curatedEl.style.display = 'none';
  listEl.innerHTML = '';

  const entries = Object.entries(COMPONENT_REGISTRY);
  const filtered = entries.filter(([id, reg]) => {
    if (state.search) return reg.name.toLowerCase().includes(state.search.toLowerCase());
    return true;
  });

  // Tile grid
  const grid = document.createElement('div');
  grid.className = 'browser-comp-grid';
  filtered.forEach(([id, reg]) => {
    const tile = document.createElement('button');
    tile.className = 'browser-comp-tile' + (state.selectedComponentId === id ? ' active' : '');
    tile.innerHTML = `
      <div class="browser-comp-icon">⊞</div>
      <div class="browser-comp-name">${reg.name}</div>
    `;
    tile.title = 'Click to add to the rack';
    tile.addEventListener('click', () => {
      state.selectedComponentId = id;
      const Cls = reg.cls();
      const inst = new Cls();
      engine.addComponent(inst);
      renderRack();
      updateSignalFlow();
      selectComponent(inst);
      renderComponentResults();
      toast('Added: ' + reg.name);
    });
    grid.appendChild(tile);
  });
  listEl.appendChild(grid);
  updateResultsCount(filtered.length, 'Components');
}

function updateResultsCount(n, label) {
  const el = document.getElementById('resultsCount');
  if (el) el.textContent = `${n} ${label}`;
}

function renderModeTabs() {
  document.querySelectorAll('.browser-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === state.mode);
  });
  const userBtn = document.getElementById('browserUserBtn');
  if (userBtn) userBtn.classList.toggle('active', state.userContent);
  // Hide category filters in Components mode (tiles don't use them)
  const cats = document.getElementById('browserCategories');
  const colors = document.getElementById('colorFilters');
  if (cats)  cats.style.display  = state.mode === 'presets' ? '' : 'none';
  if (colors) colors.style.display = state.mode === 'presets' ? '' : 'none';
}

// ------------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------------

export function initBrowser() {
  // Tabs
  document.querySelectorAll('.browser-tab').forEach(t => {
    t.addEventListener('click', () => {
      state.mode = t.dataset.mode;
      renderModeTabs();
      renderResults();
    });
  });

  // User-content toggle
  const userBtn = document.getElementById('browserUserBtn');
  if (userBtn) {
    userBtn.addEventListener('click', () => {
      state.userContent = !state.userContent;
      renderModeTabs();
      renderResults();
    });
  }

  // Search
  const searchInput = document.querySelector('.browser-search input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value;
      renderResults();
    });
  }

  renderModeTabs();
  renderColorFilters();
  renderCategoryFilters();
  renderResults();
}
