// ============================================================
// BROWSER — Presets + Components browsing UI
// ============================================================
//
// Manual reference: "Overview of the Browser" + "Presets in the
// Browser" + "Using the Browser" / "Using Filters".
//
// Progressive disclosure: Search → Favorites → Filters narrows
// down the Results list.  Each element contributes additional
// filter criteria that combine with AND semantics.
//
// Presets-side elements covered here:
//   1. Search field      — substring match on preset name
//   2. Favorites         — per-preset color tags assigned via the
//                          context menu on a result; color swatches
//                          in the top bar filter by favorite color
//   3. Filters           — expandable category panels with tag pills
//   4. Results list      — sortable by name / color / random
//   5. Info pane         — shows the filter tags + properties of
//                          the selected preset (toggled from the
//                          browser footer)

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
  activeColors: new Set(), // Set<string> of active Favorite color filters
  activeTags: new Set(),   // Set<string> of tag labels
  openCategories: new Set(['Characters']),
  userContent: false,
  selectedPreset: '1993 Hot Solo Rig',
  selectedComponentId: null,
  // Per-preset favorite color override (Map<presetName, color>).
  // Presets without an override fall back to their built-in `color`.
  favorites: new Map(),
  // Results-list sort option.
  sort: 'name-asc',        // 'name-asc' | 'name-desc' | 'color' | 'random'
  sortRandomSeed: 0,       // bumped each time Random is re-clicked
  // Info pane open/closed.
  infoOpen: false,
  // Components mode: active Category Filter tags (flat pill bar).
  compCategoryFilter: new Set(),
  // "Show Component presets" toggle — when true, clicking a tile
  // selects it and lists its dedicated presets below the grid.
  showCompPresets: false,
};

// Flat list of Component categories per the Guitar Rig 7 manual.
export const COMPONENT_CATEGORIES = [
  'Amplifiers', 'Cabinets', 'Delay & Echo', 'Distortion',
  'Dynamics', 'EQ', 'Filters', 'Legacy', 'Modifier',
  'Modulation', 'Pitch', 'Reverb', 'Special FX', 'Tools',
];

// Returns the effective favorite color for a preset: an explicit
// override from the favorites map if present, otherwise the preset's
// built-in library color tag.
function favoriteColor(p) {
  return state.favorites.get(p.name) || p.color;
}

// ------------------------------------------------------------
// MATCHING
// ------------------------------------------------------------

function presetMatchesFilters(p, opts = {}) {
  if (state.userContent) return false; // no user presets in the demo library
  if (state.search) {
    if (!p.name.toLowerCase().includes(state.search.toLowerCase())) return false;
  }
  if (state.activeColors.size && !state.activeColors.has(favoriteColor(p))) return false;
  const tagsOverride = opts.tags || state.activeTags;
  if (tagsOverride.size) {
    const all = [...(p.c || []), ...(p.g || []), ...(p.a || [])];
    for (const tag of tagsOverride) {
      if (!all.includes(tag)) return false;
    }
  }
  return true;
}

// Count presets that would match if `tag` were toggled ON alongside the
// current search + color + other-tag filters. When the tag is already
// active, the count is the current number of matches.
function tagMatchCount(tag) {
  const simulated = new Set(state.activeTags);
  simulated.add(tag);
  return LIBRARY_PRESETS.filter(p => presetMatchesFilters(p, { tags: simulated })).length;
}

function clearAllFilters() {
  state.activeColors.clear();
  state.activeTags.clear();
  renderColorFilters();
  renderActiveFilters();
  renderCategoryFilters();
  renderResults();
}

function hasAnyFilter() {
  return state.activeColors.size > 0 || state.activeTags.size > 0;
}

// Sort a filtered preset list according to state.sort.  The random
// mode uses a seeded shuffle so re-renders are stable until the user
// clicks Random again.
function sortPresets(list) {
  const out = list.slice();
  switch (state.sort) {
    case 'name-desc':
      out.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'color': {
      const order = COLORS.reduce((m, c, i) => (m[c] = i, m), {});
      out.sort((a, b) => {
        const ai = order[favoriteColor(a)] ?? 99;
        const bi = order[favoriteColor(b)] ?? 99;
        return ai - bi || a.name.localeCompare(b.name);
      });
      break;
    }
    case 'random': {
      // Seeded shuffle (Mulberry32) so the order is stable per seed
      let t = state.sortRandomSeed || 1;
      const rand = () => {
        t = (t + 0x6D2B79F5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = r + Math.imul(r ^ (r >>> 7), 61 | r) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      break;
    }
    case 'name-asc':
    default:
      out.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

function filteredPresets() {
  return sortPresets(LIBRARY_PRESETS.filter(presetMatchesFilters));
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
      renderActiveFilters();
      renderCategoryFilters();
      renderResults();
    });
    el.appendChild(d);
  });
}

function renderActiveFilters() {
  const el = document.getElementById('browserActiveFilters');
  if (!el) return;
  if (!hasAnyFilter()) { el.innerHTML = ''; el.classList.remove('open'); return; }
  el.classList.add('open');
  el.innerHTML = '';

  const chips = document.createElement('div');
  chips.className = 'active-filters-chips';

  state.activeColors.forEach(c => {
    const chip = document.createElement('button');
    chip.className = 'active-filter-chip color';
    chip.title = 'Remove color filter';
    chip.innerHTML = `<span class="active-filter-chip-swatch" style="background:${c}"></span><span class="active-filter-chip-x">✕</span>`;
    chip.addEventListener('click', () => {
      state.activeColors.delete(c);
      renderColorFilters();
      renderActiveFilters();
      renderResults();
    });
    chips.appendChild(chip);
  });
  state.activeTags.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = 'active-filter-chip';
    chip.title = 'Remove tag filter';
    chip.innerHTML = `<span>${tag}</span><span class="active-filter-chip-x">✕</span>`;
    chip.addEventListener('click', () => {
      state.activeTags.delete(tag);
      renderActiveFilters();
      renderCategoryFilters();
      renderResults();
    });
    chips.appendChild(chip);
  });
  el.appendChild(chips);

  const reset = document.createElement('button');
  reset.className = 'browser-filters-reset';
  reset.textContent = 'Reset all';
  reset.title = 'Clear all active filters';
  reset.addEventListener('click', clearAllFilters);
  el.appendChild(reset);
}

function renderCategoryFilters() {
  const el = document.getElementById('browserCategories');
  el.innerHTML = '';
  Object.entries(FILTER_CATEGORIES).forEach(([cat, tags]) => {
    const open = state.openCategories.has(cat);
    const wrap = document.createElement('div');
    wrap.className = 'browser-cat-wrap' + (open ? ' open' : '');

    const activeInCat = tags.filter(t => state.activeTags.has(t)).length;
    const head = document.createElement('div');
    head.className = 'browser-cat';
    const badge = activeInCat ? `<span class="browser-cat-count-badge">${activeInCat}</span>` : '';
    head.innerHTML = `<span>${cat}${badge}</span><span class="browser-cat-chev">⌄</span>`;
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
        const n = tagMatchCount(tag);
        const isActive = state.activeTags.has(tag);
        const b = document.createElement('button');
        b.className = 'browser-tag-pill'
          + (isActive ? ' active' : '')
          + (!isActive && n === 0 ? ' empty' : '');
        b.innerHTML = `${tag} <span class="browser-tag-pill-count">${n}</span>`;
        b.title = isActive
          ? `Active filter — click to remove`
          : (n === 0 ? 'No matches with current filters' : `${n} preset${n === 1 ? '' : 's'} match`);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.activeTags.has(tag)) state.activeTags.delete(tag);
          else state.activeTags.add(tag);
          renderActiveFilters();
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

  // ---- Sort bar ----
  const sortBar = document.createElement('div');
  sortBar.className = 'browser-sort-bar';
  const sortOptions = [
    { id: 'name-asc',  label: 'Name ↑' },
    { id: 'name-desc', label: 'Name ↓' },
    { id: 'color',     label: 'Color'  },
    { id: 'random',    label: 'Random' },
  ];
  sortOptions.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'browser-sort-btn' + (state.sort === opt.id ? ' active' : '');
    b.textContent = opt.label;
    b.title = 'Sort by ' + opt.label;
    b.addEventListener('click', () => {
      if (opt.id === 'random') state.sortRandomSeed = Math.floor(Math.random() * 1e9);
      state.sort = opt.id;
      renderPresetResults();
    });
    sortBar.appendChild(b);
  });
  listEl.appendChild(sortBar);

  // ---- Results ----
  const presets = filteredPresets();
  presets.forEach(p => {
    const d = document.createElement('div');
    d.className = 'preset-item' + (p.name === state.selectedPreset ? ' active' : '');
    const favCol = favoriteColor(p);
    const favClass = state.favorites.has(p.name) ? ' preset-color-fav' : '';
    d.innerHTML = `
      <span class="preset-color${favClass}" style="background:${favCol}"></span>
      <span class="preset-name">${p.name}</span>
    `;
    d.addEventListener('click', () => {
      state.selectedPreset = p.name;
      renderPresetResults();
      renderInfoPane();
      const nameEl = document.getElementById('presetName');
      if (nameEl) nameEl.textContent = p.name;
    });
    // Right-click → Favorites context menu
    d.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openFavoritesMenu(e.clientX, e.clientY, p);
    });
    listEl.appendChild(d);
  });
  updateResultsCount(presets.length, 'Presets');
  renderInfoPane();
}

// ------------------------------------------------------------
// FAVORITES CONTEXT MENU
// ------------------------------------------------------------

let _favMenuEl = null;
function closeFavoritesMenu() {
  if (_favMenuEl) _favMenuEl.remove();
  _favMenuEl = null;
  document.removeEventListener('click', closeFavoritesMenu);
  document.removeEventListener('contextmenu', closeFavoritesMenu);
  document.removeEventListener('keydown', _favKeyHandler);
}
function _favKeyHandler(e) { if (e.key === 'Escape') closeFavoritesMenu(); }

function openFavoritesMenu(x, y, preset) {
  closeFavoritesMenu();
  const menu = document.createElement('div');
  menu.className = 'fav-menu';
  menu.innerHTML = '<div class="fav-menu-title">Assign Favorite</div>';

  const swatches = document.createElement('div');
  swatches.className = 'fav-menu-swatches';
  COLORS.forEach(c => {
    const s = document.createElement('button');
    s.className = 'fav-menu-swatch';
    if (favoriteColor(preset) === c) s.classList.add('active');
    s.style.background = c;
    s.title = 'Set favorite color';
    s.addEventListener('click', (ev) => {
      ev.stopPropagation();
      state.favorites.set(preset.name, c);
      closeFavoritesMenu();
      renderPresetResults();
    });
    swatches.appendChild(s);
  });
  menu.appendChild(swatches);

  const clear = document.createElement('button');
  clear.className = 'fav-menu-clear';
  clear.textContent = state.favorites.has(preset.name) ? 'Clear favorite' : 'No favorite set';
  clear.disabled = !state.favorites.has(preset.name);
  clear.addEventListener('click', (ev) => {
    ev.stopPropagation();
    state.favorites.delete(preset.name);
    closeFavoritesMenu();
    renderPresetResults();
  });
  menu.appendChild(clear);

  // Clamp to viewport
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 8);
  const py = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = px + 'px';
  menu.style.top  = py + 'px';

  _favMenuEl = menu;
  // Dismiss on any outside interaction (next tick to avoid the current event)
  setTimeout(() => {
    document.addEventListener('click', closeFavoritesMenu);
    document.addEventListener('contextmenu', closeFavoritesMenu);
    document.addEventListener('keydown', _favKeyHandler);
  });
  menu.addEventListener('click', (ev) => ev.stopPropagation());
  menu.addEventListener('contextmenu', (ev) => ev.stopPropagation());
}

// ------------------------------------------------------------
// INFO PANE
// ------------------------------------------------------------

function renderInfoPane() {
  const pane = document.getElementById('browserInfoPane');
  if (!pane) return;
  pane.classList.toggle('open', state.infoOpen);
  if (!state.infoOpen) return;

  const p = LIBRARY_PRESETS.find(x => x.name === state.selectedPreset);
  const body = pane.querySelector('.browser-info-body');
  if (!body) return;
  if (!p) {
    body.innerHTML = '<div class="browser-info-empty">Select a preset to see its tags.</div>';
    return;
  }
  const tagRow = (label, tags) => {
    if (!tags || !tags.length) return '';
    const pills = tags.map(t => `<span class="info-tag-pill">${t}</span>`).join('');
    return `<div class="info-row"><div class="info-label">${label}</div><div class="info-pills">${pills}</div></div>`;
  };
  const favCol = favoriteColor(p);
  body.innerHTML = `
    <div class="info-header">
      <span class="preset-color" style="background:${favCol}"></span>
      <strong>${p.name}</strong>
    </div>
    ${tagRow('Characters', p.c)}
    ${tagRow('Genres',     p.g)}
    ${tagRow('Amplifiers', p.a)}
    <div class="info-row">
      <div class="info-label">Favorite</div>
      <div class="info-pills">${state.favorites.has(p.name) ? 'User override' : 'Library default'}</div>
    </div>
  `;
}

function componentMatchesFilters(id, reg) {
  if (state.search) {
    if (!reg.name.toLowerCase().includes(state.search.toLowerCase())) return false;
  }
  if (state.compCategoryFilter.size) {
    if (!state.compCategoryFilter.has(reg.category)) return false;
  }
  return true;
}

// Turn a tileStyle object into inline CSS for a Component tile.
function tileInlineStyle(ts) {
  if (!ts) return '';
  const parts = [];
  if (ts.bg)     parts.push(`background:${ts.bg}`);
  if (ts.color)  parts.push(`color:${ts.color}`);
  if (ts.font)   parts.push(`font-family:${ts.font}`);
  if (ts.letter) parts.push(`letter-spacing:${ts.letter}`);
  if (ts.italic) parts.push('font-style:italic');
  return parts.join(';');
}

function addComponentById(id) {
  const reg = COMPONENT_REGISTRY[id];
  if (!reg) return;
  const Cls = reg.cls();
  const inst = new Cls();
  engine.addComponent(inst);
  renderRack();
  updateSignalFlow();
  selectComponent(inst);
}

function renderComponentResults() {
  const listEl = document.getElementById('presetList');
  const curatedEl = document.getElementById('browserCurated');
  curatedEl.style.display = 'none';
  listEl.innerHTML = '';

  // ---- (2) Category Filter — flat pill bar ----
  const catBar = document.createElement('div');
  catBar.className = 'browser-comp-catbar';
  COMPONENT_CATEGORIES.forEach(cat => {
    const b = document.createElement('button');
    b.className = 'browser-tag-pill comp-cat-pill'
      + (state.compCategoryFilter.has(cat) ? ' active' : '');
    b.textContent = cat;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.compCategoryFilter.has(cat)) state.compCategoryFilter.delete(cat);
      else state.compCategoryFilter.add(cat);
      renderComponentResults();
    });
    catBar.appendChild(b);
  });
  listEl.appendChild(catBar);

  // ---- (3) Component Tiles — branded grid ----
  const filtered = Object.entries(COMPONENT_REGISTRY)
    .filter(([id, reg]) => componentMatchesFilters(id, reg));

  const grid = document.createElement('div');
  grid.className = 'browser-comp-grid';
  filtered.forEach(([id, reg]) => {
    const tile = document.createElement('button');
    tile.className = 'browser-comp-tile' + (state.selectedComponentId === id ? ' active' : '');
    const inline = tileInlineStyle(reg.tileStyle);
    if (inline) tile.setAttribute('style', inline);
    tile.innerHTML = `<div class="browser-comp-name">${reg.name}</div>`;
    tile.title = state.showCompPresets
      ? 'Click to view Component presets'
      : 'Click to add to the rack';
    tile.addEventListener('click', () => {
      state.selectedComponentId = id;
      if (state.showCompPresets) {
        // In Show Component presets mode, a click only selects;
        // the preset list below handles adding to the rack.
        renderComponentResults();
      } else {
        addComponentById(id);
        renderComponentResults();
        toast('Added: ' + reg.name);
      }
    });
    grid.appendChild(tile);
  });
  listEl.appendChild(grid);

  // ---- (4) Show Component presets — dedicated preset list ----
  if (state.showCompPresets) {
    const selId = state.selectedComponentId;
    const reg = selId ? COMPONENT_REGISTRY[selId] : null;
    const section = document.createElement('div');
    section.className = 'browser-comp-presets';
    if (!reg) {
      section.innerHTML = '<div class="browser-comp-presets-empty">Select a Component tile to see its presets.</div>';
    } else {
      const header = document.createElement('div');
      header.className = 'browser-comp-presets-header';
      header.innerHTML = `<span>${reg.name} PRESETS</span><span class="browser-comp-presets-count">${reg.presets.length}</span>`;
      section.appendChild(header);
      reg.presets.forEach(pname => {
        const row = document.createElement('div');
        row.className = 'browser-comp-preset-item';
        row.innerHTML = `<span class="preset-color" style="background:${reg.tileStyle && reg.tileStyle.color || '#6aa3ff'}"></span><span class="preset-name">${pname}</span>`;
        row.title = 'Click to add this Component with the selected preset';
        row.addEventListener('click', () => {
          addComponentById(selId);
          toast(`Added: ${reg.name} — ${pname}`);
        });
        section.appendChild(row);
      });
    }
    listEl.appendChild(section);
  }

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
  // Preset-side chrome is hidden in Components mode (tiles don't use it)
  const cats = document.getElementById('browserCategories');
  const colors = document.getElementById('colorFilters');
  if (cats)  cats.style.display  = state.mode === 'presets' ? '' : 'none';
  if (colors) colors.style.display = state.mode === 'presets' ? '' : 'none';
  // Mode-specific footer buttons: Info pane is Presets-only, Show
  // Component presets is Components-only.
  const infoBtn = document.getElementById('browserInfoBtn');
  const showBtn = document.getElementById('browserShowCompPresetsBtn');
  if (infoBtn) infoBtn.style.display = state.mode === 'presets' ? '' : 'none';
  if (showBtn) {
    showBtn.style.display = state.mode === 'components' ? '' : 'none';
    showBtn.classList.toggle('active', state.showCompPresets);
  }
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
      renderCategoryFilters();
      renderResults();
    });
  }

  // Info pane toggle
  const infoBtn = document.getElementById('browserInfoBtn');
  if (infoBtn) {
    infoBtn.addEventListener('click', () => {
      state.infoOpen = !state.infoOpen;
      infoBtn.classList.toggle('active', state.infoOpen);
      renderInfoPane();
    });
  }

  // Show Component presets toggle
  const showPresetsBtn = document.getElementById('browserShowCompPresetsBtn');
  if (showPresetsBtn) {
    showPresetsBtn.addEventListener('click', () => {
      state.showCompPresets = !state.showCompPresets;
      showPresetsBtn.classList.toggle('active', state.showCompPresets);
      renderModeTabs();
      renderResults();
    });
  }

  renderModeTabs();
  renderColorFilters();
  renderActiveFilters();
  renderCategoryFilters();
  renderResults();
}
