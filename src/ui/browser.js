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

export const COLOR_NAMES = {
  '#ff4444': 'Orange',
  '#ff8800': 'Warm Yellow',
  '#ffdd00': 'Lime',
  '#88dd22': 'Mint',
  '#22ddaa': 'Cyan',
  '#2288dd': 'Plum',
  '#6644ff': 'Purple',
  '#cc44ff': 'Fuchsia',
};

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
  sort: 'curated',         // 'curated' | 'abc' | 'zyx' | 'color' | 'random'
  sortOpen: false,          // sort dropdown expanded
  sortRandomSeed: 0,       // bumped each time Random is re-clicked
  // Info pane open/closed.
  infoOpen: false,
  // Components mode: active Category Filter tags (flat pill bar).
  compCategoryFilter: new Set(),
  // "Show Component presets" toggle — when true, clicking a tile
  // selects it and lists its dedicated presets below the grid.
  showCompPresets: false,
  // User presets saved via the toolbar.
  userPresets: [],
  // Multi-select for user presets (Shift+click).
  selectedPresets: new Set(),
  // Custom user-defined filter tags, merged with FILTER_CATEGORIES.
  customTags: {},  // { categoryName: [tagName, ...] }
  // Dirty flag — set when the rack is modified after loading a preset.
  dirty: false,
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

function allPresetTags(p) {
  const base = [...(p.c || []), ...(p.g || []), ...(p.a || [])];
  if (p.filterTags) {
    for (const tags of Object.values(p.filterTags)) base.push(...tags);
  }
  return base;
}

function presetMatchesFilters(p, opts = {}) {
  if (state.userContent && !p.isUser) return false;
  if (!state.userContent && p.isUser) return false;
  if (state.search) {
    if (!p.name.toLowerCase().includes(state.search.toLowerCase())) return false;
  }
  if (state.activeColors.size && !state.activeColors.has(favoriteColor(p))) return false;
  const tagsOverride = opts.tags || state.activeTags;
  if (tagsOverride.size) {
    const all = allPresetTags(p);
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
  return allPresets().filter(p => presetMatchesFilters(p, { tags: simulated })).length;
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
const SORT_OPTIONS = [
  { id: 'curated', label: 'Curated' },
  { id: 'abc',     label: 'Abc'     },
  { id: 'zyx',     label: 'Zyx'     },
  { id: 'color',   label: 'Color'   },
  { id: 'random',  label: 'Random'  },
];

function sortLabel() {
  return (SORT_OPTIONS.find(o => o.id === state.sort) || SORT_OPTIONS[0]).label;
}

function sortPresets(list) {
  const out = list.slice();
  switch (state.sort) {
    case 'abc':
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'zyx':
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
    case 'curated':
    default:
      break;
  }
  return out;
}

function allPresets() {
  return [...LIBRARY_PRESETS, ...state.userPresets];
}

function filteredPresets() {
  return sortPresets(allPresets().filter(presetMatchesFilters));
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
      mergedCategoryTags(cat).forEach(tag => {
        const n = tagMatchCount(tag);
        const isActive = state.activeTags.has(tag);
        const isCustom = (state.customTags[cat] || []).includes(tag);
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
        if (isCustom) {
          b.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.customTags[cat] = state.customTags[cat].filter(t => t !== tag);
            state.activeTags.delete(tag);
            state.userPresets.forEach(up => {
              if (up.filterTags && up.filterTags[cat]) {
                up.filterTags[cat] = up.filterTags[cat].filter(t => t !== tag);
              }
            });
            renderActiveFilters();
            renderCategoryFilters();
            renderResults();
            renderInfoPane();
            toast('Deleted tag: ' + tag);
          });
        }
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

  // ---- Sort bar (dropdown) ----
  const sortBar = document.createElement('div');
  sortBar.className = 'browser-sort-bar';
  const sortHead = document.createElement('button');
  sortHead.className = 'browser-sort-head';
  sortHead.innerHTML = `<span class="browser-sort-label">${sortLabel()}</span>` +
    `<svg class="browser-sort-icon" viewBox="0 0 16 16" fill="currentColor">` +
    `<rect x="2" y="3" width="12" height="1.5"/><rect x="2" y="7.25" width="12" height="1.5"/>` +
    `<rect x="2" y="11.5" width="12" height="1.5"/></svg>`;
  sortHead.addEventListener('click', () => {
    state.sortOpen = !state.sortOpen;
    renderPresetResults();
  });
  sortBar.appendChild(sortHead);

  if (state.sortOpen) {
    const dropdown = document.createElement('div');
    dropdown.className = 'browser-sort-dropdown';
    SORT_OPTIONS.forEach(opt => {
      const row = document.createElement('button');
      row.className = 'browser-sort-option' + (state.sort === opt.id ? ' active' : '');
      row.textContent = opt.label;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (opt.id === 'random') state.sortRandomSeed = Math.floor(Math.random() * 1e9);
        state.sort = opt.id;
        state.sortOpen = false;
        renderPresetResults();
      });
      dropdown.appendChild(row);
    });
    sortBar.appendChild(dropdown);
  }
  listEl.appendChild(sortBar);

  // ---- Results ----
  const presets = filteredPresets();
  presets.forEach(p => {
    const d = document.createElement('div');
    const isSelected = state.selectedPresets.has(p.name);
    d.className = 'preset-item'
      + (p.name === state.selectedPreset ? ' active' : '')
      + (isSelected ? ' multi-selected' : '');
    const favCol = favoriteColor(p);
    const favClass = state.favorites.has(p.name) ? ' preset-color-fav' : '';
    const userBadge = p.isUser ? '<span class="preset-user-badge">USER</span>' : '';
    d.innerHTML = `
      <span class="preset-color${favClass}" style="background:${favCol}"></span>
      <span class="preset-name">${p.name}</span>
      ${userBadge}
    `;
    d.addEventListener('click', (e) => {
      if (e.shiftKey && p.isUser) {
        if (state.selectedPresets.has(p.name)) state.selectedPresets.delete(p.name);
        else state.selectedPresets.add(p.name);
      } else {
        state.selectedPresets.clear();
      }
      state.selectedPreset = p.name;
      renderPresetResults();
      renderInfoPane();
      updatePresetDisplay();
    });
    d.addEventListener('dblclick', () => {
      loadPreset(p.name);
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

  // Named color items (matching the manual's color list)
  COLORS.forEach(c => {
    const item = document.createElement('button');
    item.className = 'fav-menu-color-item' + (favoriteColor(preset) === c ? ' active' : '');
    item.innerHTML = `<span class="fav-menu-color-dot" style="background:${c}"></span><span>${COLOR_NAMES[c] || c}</span>`;
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      state.favorites.set(preset.name, c);
      closeFavoritesMenu();
      renderPresetResults();
    });
    menu.appendChild(item);
  });

  // Separator + management items for user presets
  if (preset.isUser) {
    const sep = document.createElement('div');
    sep.className = 'fav-menu-sep';
    menu.appendChild(sep);

    const delItem = document.createElement('button');
    delItem.className = 'fav-menu-action-item';
    const count = state.selectedPresets.size > 1 ? state.selectedPresets.size : 1;
    delItem.textContent = 'Delete Preset';
    delItem.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeFavoritesMenu();
      openDeletePresetDialog(count);
    });
    menu.appendChild(delItem);

    const showItem = document.createElement('button');
    showItem.className = 'fav-menu-action-item';
    showItem.textContent = 'Show in Finder';
    showItem.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeFavoritesMenu();
      toast('Not available in web edition');
    });
    menu.appendChild(showItem);
  }

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
// DELETE PRESET
// ------------------------------------------------------------

function openDeletePresetDialog(count) {
  const dlg = document.getElementById('deletePresetDialog');
  if (!dlg) return;
  const msg = dlg.querySelector('#deletePresetMsg');
  if (msg) msg.textContent = `The ${count} selected item${count > 1 ? 's' : ''} will be removed from the library and deleted from disk.`;
  dlg.classList.add('open');
}

export function confirmDeletePreset() {
  const targets = state.selectedPresets.size > 0
    ? [...state.selectedPresets]
    : [state.selectedPreset];
  targets.forEach(name => {
    const idx = state.userPresets.findIndex(p => p.name === name);
    if (idx >= 0) state.userPresets.splice(idx, 1);
    state.favorites.delete(name);
  });
  if (targets.includes(state.selectedPreset)) {
    state.selectedPreset = LIBRARY_PRESETS[0]?.name || '';
  }
  state.selectedPresets.clear();
  const dlg = document.getElementById('deletePresetDialog');
  if (dlg) dlg.classList.remove('open');
  updatePresetDisplay();
  renderResults();
  renderInfoPane();
  toast(`Deleted ${targets.length} preset${targets.length > 1 ? 's' : ''}`);
}

// ------------------------------------------------------------
// INFO PANE
// ------------------------------------------------------------

function mergedCategoryTags(cat) {
  const base = FILTER_CATEGORIES[cat] || [];
  const custom = state.customTags[cat] || [];
  return [...base, ...custom.filter(t => !base.includes(t))];
}

function renderInfoPane() {
  const pane = document.getElementById('browserInfoPane');
  if (!pane) return;
  pane.classList.toggle('open', state.infoOpen);
  if (!state.infoOpen) return;

  const p = allPresets().find(x => x.name === state.selectedPreset);
  const body = pane.querySelector('.browser-info-body');
  if (!body) return;
  if (!p) {
    body.innerHTML = '<div class="browser-info-empty">Select a preset to see its tags.</div>';
    return;
  }

  if (p.isUser) {
    renderUserInfoPane(body, p);
  } else {
    renderLibraryInfoPane(body, p);
  }
}

function renderLibraryInfoPane(body, p) {
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

function renderUserInfoPane(body, p) {
  body.innerHTML = '';

  // Editable name row
  const nameRow = document.createElement('div');
  nameRow.className = 'info-header info-header-editable';
  const favCol = favoriteColor(p);
  nameRow.innerHTML = `<span class="preset-color" style="background:${favCol}"></span>`;
  const nameSpan = document.createElement('strong');
  nameSpan.className = 'info-editable-name';
  nameSpan.textContent = p.name;
  nameSpan.title = 'Double-click to rename';
  const penBtn = document.createElement('button');
  penBtn.className = 'info-pen-btn';
  penBtn.innerHTML = '✎';
  penBtn.title = 'Rename preset';
  const startRename = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'info-rename-input';
    input.value = p.name;
    nameSpan.replaceWith(input);
    penBtn.style.display = 'none';
    input.focus();
    input.select();
    const finish = () => {
      const newName = input.value.trim();
      if (newName && newName !== p.name) {
        const old = p.name;
        p.name = newName;
        if (state.selectedPreset === old) state.selectedPreset = newName;
        if (state.favorites.has(old)) {
          state.favorites.set(newName, state.favorites.get(old));
          state.favorites.delete(old);
        }
        p.modified = new Date().toISOString().slice(0, 19).replace('T', ' ');
        updatePresetDisplay();
        renderResults();
      }
      renderInfoPane();
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  };
  nameSpan.addEventListener('dblclick', startRename);
  penBtn.addEventListener('click', startRename);
  nameRow.appendChild(nameSpan);
  nameRow.appendChild(penBtn);
  body.appendChild(nameRow);

  // Filter tag categories
  Object.keys(FILTER_CATEGORIES).forEach(cat => {
    const section = document.createElement('div');
    section.className = 'info-tag-section';
    const label = document.createElement('div');
    label.className = 'info-tag-section-label';
    label.textContent = cat.toUpperCase();
    section.appendChild(label);

    const pills = document.createElement('div');
    pills.className = 'info-pills info-pills-editable';
    const assigned = (p.filterTags && p.filterTags[cat]) || [];
    mergedCategoryTags(cat).forEach(tag => {
      const pill = document.createElement('button');
      pill.className = 'info-tag-pill' + (assigned.includes(tag) ? ' active' : '');
      pill.textContent = tag;
      pill.addEventListener('click', () => {
        if (!p.filterTags) p.filterTags = {};
        if (!p.filterTags[cat]) p.filterTags[cat] = [];
        const idx = p.filterTags[cat].indexOf(tag);
        if (idx >= 0) p.filterTags[cat].splice(idx, 1);
        else p.filterTags[cat].push(tag);
        p.modified = new Date().toISOString().slice(0, 19).replace('T', ' ');
        renderInfoPane();
        renderCategoryFilters();
      });
      pills.appendChild(pill);
    });

    // + button for custom tags
    const addBtn = document.createElement('button');
    addBtn.className = 'info-tag-add-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add a custom filter tag';
    addBtn.addEventListener('click', () => {
      addBtn.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'info-tag-add-input';
      input.placeholder = 'Tag name';
      pills.appendChild(input);
      input.focus();
      const finish = () => {
        const tagName = input.value.trim();
        if (tagName) {
          if (!state.customTags[cat]) state.customTags[cat] = [];
          if (!state.customTags[cat].includes(tagName) && !FILTER_CATEGORIES[cat].includes(tagName)) {
            state.customTags[cat].push(tagName);
          }
          if (!p.filterTags) p.filterTags = {};
          if (!p.filterTags[cat]) p.filterTags[cat] = [];
          if (!p.filterTags[cat].includes(tagName)) p.filterTags[cat].push(tagName);
          p.modified = new Date().toISOString().slice(0, 19).replace('T', ' ');
          renderCategoryFilters();
        }
        renderInfoPane();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    });
    pills.appendChild(addBtn);
    section.appendChild(pills);
    body.appendChild(section);
  });

  // Metadata fields
  const metaFields = [
    { key: 'vendor',  label: 'Vendor' },
    { key: 'author',  label: 'Author' },
    { key: 'comment', label: 'Comment' },
  ];
  metaFields.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'info-row info-meta-row';
    const lbl = document.createElement('div');
    lbl.className = 'info-label';
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'info-meta-input';
    input.value = p[key] || '';
    input.placeholder = `Enter ${label.toLowerCase()}...`;
    input.addEventListener('change', () => {
      p[key] = input.value.trim();
      p.modified = new Date().toISOString().slice(0, 19).replace('T', ' ');
    });
    row.appendChild(lbl);
    row.appendChild(input);
    body.appendChild(row);
  });

  // Read-only metadata
  const modRow = document.createElement('div');
  modRow.className = 'info-row';
  modRow.innerHTML = `<div class="info-label">Modified</div><div class="info-pills">${p.modified || '—'}</div>`;
  body.appendChild(modRow);
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
        renderComponentResults();
      } else {
        addComponentById(id);
        renderComponentResults();
        toast('Added: ' + reg.name);
      }
    });
    // Drag-and-drop to rack
    tile.draggable = true;
    tile.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'copy';
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
// PRESET LOADING + NAVIGATION
// ------------------------------------------------------------

function updatePresetDisplay() {
  const nameEl = document.getElementById('presetName');
  if (nameEl) {
    nameEl.textContent = state.dirty
      ? state.selectedPreset + ' *'
      : state.selectedPreset;
  }
}

export function loadPreset(name) {
  state.selectedPreset = name;
  state.dirty = false;
  updatePresetDisplay();
  renderPresetResults();
  renderInfoPane();
  toast('Loaded: ' + name);
}

export function prevPreset() {
  const list = filteredPresets();
  if (!list.length) return;
  const idx = list.findIndex(p => p.name === state.selectedPreset);
  const prev = idx > 0 ? idx - 1 : list.length - 1;
  loadPreset(list[prev].name);
}

export function nextPreset() {
  const list = filteredPresets();
  if (!list.length) return;
  const idx = list.findIndex(p => p.name === state.selectedPreset);
  const next = idx < list.length - 1 ? idx + 1 : 0;
  loadPreset(list[next].name);
}

export function shufflePreset() {
  const list = filteredPresets();
  if (list.length <= 1) return;
  let pick;
  do { pick = list[Math.floor(Math.random() * list.length)]; }
  while (pick.name === state.selectedPreset && list.length > 1);
  loadPreset(pick.name);
}

export function markDirty() {
  if (!state.dirty) {
    state.dirty = true;
    updatePresetDisplay();
  }
}

// ------------------------------------------------------------
// USER PRESETS
// ------------------------------------------------------------

export function openSaveNewPresetDialog() {
  const dlg = document.getElementById('savePresetDialog');
  if (!dlg) return;
  const input = dlg.querySelector('#savePresetNameInput');
  if (input) input.value = 'My User Preset';
  dlg.classList.add('open');
  if (input) input.focus();
}

function makeUserPreset(name) {
  return {
    name, color: '#88dd22', c: [], g: [], a: [], isUser: true,
    filterTags: {},  // { categoryName: [tagName, ...] }
    comment: '', author: '', vendor: '',
    modified: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

export function confirmSaveNewPreset() {
  const dlg = document.getElementById('savePresetDialog');
  const input = dlg ? dlg.querySelector('#savePresetNameInput') : null;
  const name = (input ? input.value : '').trim();
  if (!name) { toast('Enter a name'); return; }
  const existing = state.userPresets.findIndex(p => p.name === name);
  if (existing >= 0) {
    state.userPresets[existing].modified = new Date().toISOString().slice(0, 19).replace('T', ' ');
  } else {
    state.userPresets.push(makeUserPreset(name));
  }
  state.selectedPreset = name;
  state.dirty = false;
  if (dlg) dlg.classList.remove('open');
  updatePresetDisplay();
  renderResults();
  toast('Saved: ' + name);
}

export function importUserPreset(name) {
  if (!state.userPresets.find(p => p.name === name)) {
    state.userPresets.push(makeUserPreset(name));
  }
  state.selectedPreset = name;
  state.dirty = false;
  updatePresetDisplay();
  renderResults();
}

export function isUserPresetLoaded() {
  return state.userPresets.some(p => p.name === state.selectedPreset);
}

export function savePreset() {
  const cur = state.userPresets.find(p => p.name === state.selectedPreset);
  if (!cur) {
    openSaveNewPresetDialog();
    return;
  }
  state.dirty = false;
  updatePresetDisplay();
  toast('Saved: ' + cur.name);
}

// Keyboard nav for the Results list.
function handleResultsKeydown(e) {
  if (state.mode !== 'presets') return;
  const list = filteredPresets();
  if (!list.length) return;
  const idx = list.findIndex(p => p.name === state.selectedPreset);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = idx < list.length - 1 ? idx + 1 : 0;
    state.selectedPreset = list[next].name;
    updatePresetDisplay();
    renderPresetResults();
    scrollSelectedIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = idx > 0 ? idx - 1 : list.length - 1;
    state.selectedPreset = list[prev].name;
    updatePresetDisplay();
    renderPresetResults();
    scrollSelectedIntoView();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    loadPreset(state.selectedPreset);
  }
}

function scrollSelectedIntoView() {
  const listEl = document.getElementById('presetList');
  if (!listEl) return;
  const active = listEl.querySelector('.preset-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
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
  const infoClose = document.getElementById('browserInfoClose');
  if (infoClose) {
    infoClose.addEventListener('click', () => {
      state.infoOpen = false;
      if (infoBtn) infoBtn.classList.remove('active');
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

  // Save New Preset dialog
  const saveDlg = document.getElementById('savePresetDialog');
  if (saveDlg) {
    saveDlg.querySelector('#savePresetOk')?.addEventListener('click', confirmSaveNewPreset);
    saveDlg.querySelectorAll('[data-close]').forEach(b =>
      b.addEventListener('click', () => saveDlg.classList.remove('open')));
    const nameInput = saveDlg.querySelector('#savePresetNameInput');
    if (nameInput) nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirmSaveNewPreset(); }
    });
  }

  // Component drag-and-drop to rack
  const rackEl = document.getElementById('compContainer');
  if (rackEl) {
    rackEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      rackEl.classList.add('drag-over');
    });
    rackEl.addEventListener('dragleave', () => rackEl.classList.remove('drag-over'));
    rackEl.addEventListener('drop', (e) => {
      e.preventDefault();
      rackEl.classList.remove('drag-over');
      const compId = e.dataTransfer.getData('text/plain');
      if (compId && COMPONENT_REGISTRY[compId]) {
        addComponentById(compId);
        toast('Added: ' + COMPONENT_REGISTRY[compId].name);
      }
    });
  }

  // Delete Preset dialog
  const delDlg = document.getElementById('deletePresetDialog');
  if (delDlg) {
    delDlg.querySelector('#deletePresetOk')?.addEventListener('click', confirmDeletePreset);
    delDlg.querySelectorAll('[data-close]').forEach(b =>
      b.addEventListener('click', () => delDlg.classList.remove('open')));
  }

  // Keyboard navigation for the Results list
  document.addEventListener('keydown', handleResultsKeydown);

  renderModeTabs();
  renderColorFilters();
  renderActiveFilters();
  renderCategoryFilters();
  renderResults();
}
