// ============================================================
// GUITAR RIG — WEB EDITION — entry point
// ============================================================
//
// Responsibilities:
//   1. Register built-in components with the registry
//   2. Boot the audio engine + initial rack
//   3. Wire all header / menu / dialog / sidebar / keyboard controls
//   4. Run the frame loop (meters, CPU estimate, tuner, GR meter)

// styles.css is loaded via the <link> tag in index.html

import { engine, selected } from './app-state.js';
import { toast } from './ui/toast.js';
import { renderRack, updateSignalFlow, selectComponent, removeComponent } from './ui/rack.js';
import { updateInfoPane } from './ui/info-pane.js';
import { initBrowser, prevPreset, nextPreset, shufflePreset,
         savePreset, openSaveNewPresetDialog, markDirty,
         importUserPreset, isUserPresetLoaded,
         addComponentById, COMPONENT_CATEGORIES } from './ui/browser.js';

import {
  registerComponent,
  serializeRack,
  serializeComponent,
  deserializeComponent,
  restoreRack,
  pushHistory,
  history,
  undo,
  redo,
} from './components/registry.js';

import { FastComp } from './components/fast-comp.js';
import { BassPro } from './components/bass-pro.js';
import { ControlRoomPro } from './components/control-room-pro.js';
import { StereoTune } from './components/stereo-tune.js';

// Register built-in components.  The metadata drives the Browser's
// Components mode: `category` → flat Category Filter pill bar,
// `tileStyle` → branded Component Tile look, `presets` → dedicated
// preset list when "Show Component presets" is toggled on.
registerComponent('fastcomp', FastComp, 'FAST COMP', {
  category: 'Dynamics',
  tileStyle: { bg: '#0c0c0e', color: '#ffb020', font: '"Arial Black","Impact",sans-serif', letter: '2px' },
  presets: ['Default', 'Fast Attack', 'Vocal Glue', 'Drum Smash', 'Parallel Bus'],
});
registerComponent('basspro', BassPro, 'BASS PRO', {
  category: 'Amplifiers',
  tileStyle: { bg: '#3a0a0a', color: '#f8e6c4', font: 'Georgia,serif', italic: true },
  presets: ['Default', 'Warm Tube', 'Slap Funk', 'Overdrive'],
});
registerComponent('controlroom', ControlRoomPro, 'CONTROL ROOM PRO', {
  category: 'Cabinets',
  tileStyle: { bg: '#2a1a0e', color: '#e8d8b0', font: 'Georgia,serif', italic: true },
  presets: ['Default', '4x12 Stack', '2x12 Combo', '1x12 Open Back'],
});
registerComponent('stereotune', StereoTune, 'STEREO TUNE', {
  category: 'Tools',
  tileStyle: { bg: '#e8e8ea', color: '#0a0a0c', font: '"Arial Black","Impact",sans-serif', letter: '1.5px' },
  presets: ['Default', 'Chromatic', 'Strobe'],
});

// ---- Clipboard (cut/copy/paste) ----
let componentClipboard = null;

// ---- Helper: small header level knob (-20..+20 dB) ----
function wireLevelKnob(id, onChange, startDb = 0) {
  const knob = document.getElementById(id);
  if (!knob) return;
  const ind = knob.querySelector('.level-knob-ind');
  const min = -20, max = 20;
  let val = startDb;
  const update = () => {
    const range = max - min;
    const norm = (val - min) / range;
    const angle = -135 + norm * 270;
    ind.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    onChange(val);
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
      val = Math.max(min, Math.min(max, startVal + (dy / 100) * (max - min)));
      update();
    };
    const up = () => {
      knob.removeEventListener('pointermove', move);
      knob.removeEventListener('pointerup', up);
    };
    knob.addEventListener('pointermove', move);
    knob.addEventListener('pointerup', up);
  });
  knob.addEventListener('dblclick', () => { val = 0; update(); });
}

// ---- Menu action handler ----
async function handleMenuAction(action) {
  switch (action) {
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'cut':
      if (!selected) { toast('No component selected'); return; }
      componentClipboard = serializeComponent(selected);
      pushHistory();
      removeComponent(selected);
      toast('Cut: ' + componentClipboard.id);
      break;
    case 'copy':
      if (!selected) { toast('No component selected'); return; }
      componentClipboard = serializeComponent(selected);
      toast('Copied: ' + componentClipboard.id);
      break;
    case 'paste': {
      if (!componentClipboard) { toast('Clipboard empty'); return; }
      pushHistory();
      const c = deserializeComponent(componentClipboard);
      if (c) {
        c._engineRef = engine;
        c.build(engine.ctx);
        if (c._pendingParams) Object.entries(c._pendingParams).forEach(([k, v]) => c.setParam(k, v));
        const insertIdx = selected ? engine.components.indexOf(selected) + 1 : engine.components.length;
        engine.components.splice(insertIdx, 0, c);
        engine._rebuildChain();
        renderRack();
        updateSignalFlow();
        selectComponent(c);
        toast('Pasted: ' + c.id);
      }
      break;
    }
    case 'delete':
      if (!selected) { toast('No component selected'); return; }
      pushHistory();
      removeComponent(selected);
      toast('Deleted');
      break;
    case 'select-all':
      toast('Select All — single-selection model (select last)');
      if (engine.components.length) selectComponent(engine.components[engine.components.length - 1]);
      break;
    case 'clear-rack':
      if (confirm('Clear all components from the rack and Global FX?')) {
        pushHistory();
        while (engine.components.length) removeComponent(engine.components[0]);
        while (engine.globalFxComponents.length) removeComponent(engine.globalFxComponents[0]);
        toast('Rack cleared');
      }
      break;
    case 'new-preset':
      pushHistory();
      while (engine.components.length) removeComponent(engine.components[0]);
      while (engine.globalFxComponents.length) removeComponent(engine.globalFxComponents[0]);
      document.getElementById('presetName').textContent = 'Untitled';
      toast('New preset');
      break;
    case 'open-preset': {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.grp,.json';
      inp.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const data = JSON.parse(text);
          pushHistory();
          restoreRack(data.components || []);
          const pName = data.name || file.name.replace(/\.[^.]+$/, '');
          importUserPreset(pName);
          toast('Imported: ' + pName);
        } catch (err) { toast('Invalid preset file'); }
      });
      inp.click();
      break;
    }
    case 'save-preset':
      savePreset();
      break;
    case 'save-preset-as':
      openSaveNewPresetDialog();
      break;
    case 'export-preset': {
      const data = {
        name: document.getElementById('presetName').textContent.replace(/ \*$/, ''),
        version: 1,
        components: serializeRack(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (data.name || 'preset') + '.grp.json';
      a.click();
      URL.revokeObjectURL(url);
      toast('Preset exported');
      break;
    }
    case 'import-preset':
      await handleMenuAction('open-preset');
      break;
    case 'preferences':
      updatePrefsDialog();
      document.getElementById('prefsDialog').classList.add('open');
      break;
    case 'native-access':
    case 'manual':
    case 'kb':
    case 'product':
      toast('External link — not available in web edition');
      break;
    case 'about':
      document.getElementById('aboutDialog').classList.add('open');
      break;
  }
}

function updatePrefsDialog() {
  if (!engine.ctx) return;
  document.getElementById('prefCtxState').textContent = engine.ctx.state;
  document.getElementById('prefSampleRate').textContent = engine.ctx.sampleRate + ' Hz';
  document.getElementById('prefBaseLat').textContent =
    (engine.ctx.baseLatency ? (engine.ctx.baseLatency * 1000).toFixed(2) + ' ms' : 'unknown');
  document.getElementById('prefOutLat').textContent =
    (engine.ctx.outputLatency ? (engine.ctx.outputLatency * 1000).toFixed(2) + ' ms' : 'unknown');
  const sel = document.getElementById('prefScSource');
  if (sel) sel.value = engine.sidechainSource || 'none';
}

// ============================================================
// BOOT
// ============================================================
async function boot() {
  initBrowser();
  history.onDirty = markDirty;
  await engine.init();
  engine.addComponent(new FastComp());
  engine.addComponent(new BassPro());
  engine.addComponent(new ControlRoomPro());
  engine.addComponent(new StereoTune());
  renderRack();
  updateSignalFlow();
  selectComponent(engine.components[0]);

  // ========== HEADER CONTROLS ==========

  // (1) Main menu with cascading submenus
  const mainMenuBtn = document.getElementById('mainMenuBtn');
  const mainMenu = document.getElementById('mainMenu');
  const submenus = {
    fileSub: document.getElementById('fileSub'),
    editSub: document.getElementById('editSub'),
    helpSub: document.getElementById('helpSub'),
  };
  function closeAllMenus() {
    mainMenu.classList.remove('open');
    Object.values(submenus).forEach(s => s.classList.remove('open'));
    mainMenuBtn.classList.remove('active');
  }
  mainMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (mainMenu.classList.contains('open')) closeAllMenus();
    else { mainMenu.classList.add('open'); mainMenuBtn.classList.add('active'); }
  });
  mainMenu.querySelectorAll('.has-sub').forEach(item => {
    item.addEventListener('mouseenter', () => {
      Object.values(submenus).forEach(s => s.classList.remove('open'));
      const sub = submenus[item.dataset.sub];
      if (sub) {
        const rect = item.getBoundingClientRect();
        sub.style.left = rect.right + 'px';
        sub.style.top = rect.top + 'px';
        // Disable Save when no user preset is loaded
        if (item.dataset.sub === 'fileSub') {
          const saveItem = sub.querySelector('[data-action="save-preset"]');
          if (saveItem) saveItem.classList.toggle('disabled', !isUserPresetLoaded());
        }
        sub.classList.add('open');
      }
    });
  });
  Object.values(submenus).forEach(sub => {
    sub.addEventListener('mouseleave', (e) => {
      if (!mainMenu.contains(e.relatedTarget)) sub.classList.remove('open');
    });
  });
  document.addEventListener('click', (e) => {
    if (!mainMenu.contains(e.target)
        && !Object.values(submenus).some(s => s.contains(e.target))
        && e.target !== mainMenuBtn) {
      closeAllMenus();
    }
  });
  Object.values(submenus).forEach(sub => {
    sub.querySelectorAll('.main-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.classList.contains('disabled')) return;
        handleMenuAction(item.dataset.action);
        closeAllMenus();
      });
    });
  });

  // (2) Browser toggle
  const browserBtn = document.getElementById('browserToggleBtn');
  const mainEl = document.querySelector('.main');
  browserBtn.addEventListener('click', () => {
    browserBtn.classList.toggle('active');
    mainEl.classList.toggle('no-browser');
  });

  // (3) Sidebar toggle
  const sidebarBtn = document.getElementById('sidebarToggleBtn');
  sidebarBtn.addEventListener('click', () => {
    sidebarBtn.classList.toggle('active');
    mainEl.classList.toggle('no-sidebar');
  });

  // (4) View size / zoom
  const rackZoom = document.getElementById('rackZoom');
  const zoomPct = document.getElementById('zoomPct');
  const ZOOM_STEPS = [0.75, 0.90, 1.0, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00];
  let zoomIdx = 2;
  const applyZoom = () => {
    const z = ZOOM_STEPS[zoomIdx];
    rackZoom.style.transform = `scale(${z})`;
    rackZoom.style.width = `${100 / z}%`;
    zoomPct.textContent = Math.round(z * 100) + '%';
  };
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    zoomIdx = Math.min(ZOOM_STEPS.length - 1, zoomIdx + 1); applyZoom();
  });
  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    zoomIdx = Math.max(0, zoomIdx - 1); applyZoom();
  });

  // Rack-size drag handle
  const rackSizeHandle = document.getElementById('rackSizeHandle');
  const rackSizeTooltip = document.getElementById('rackSizeTooltip');
  let rackSize = 1.0;
  const MIN_RS = 0.6, MAX_RS = 1.4;
  const applyRackSize = () => {
    document.documentElement.style.setProperty('--rack-size', rackSize.toFixed(2));
    rackSizeTooltip.textContent = `Rack Size: ${Math.round(rackSize * 100)}%`;
  };
  rackSizeHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    rackSizeHandle.classList.add('dragging');
    rackSizeTooltip.classList.add('show');
    const startY = e.clientY;
    const startSize = rackSize;
    rackSizeHandle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dy = ev.clientY - startY;
      rackSize = Math.max(MIN_RS, Math.min(MAX_RS, startSize + dy / 200));
      applyRackSize();
    };
    const up = () => {
      rackSizeHandle.removeEventListener('pointermove', move);
      rackSizeHandle.removeEventListener('pointerup', up);
      rackSizeHandle.classList.remove('dragging');
      setTimeout(() => rackSizeTooltip.classList.remove('show'), 600);
    };
    rackSizeHandle.addEventListener('pointermove', move);
    rackSizeHandle.addEventListener('pointerup', up);
  });
  rackSizeHandle.addEventListener('dblclick', () => {
    rackSize = 1.0;
    applyRackSize();
    rackSizeTooltip.classList.add('show');
    setTimeout(() => rackSizeTooltip.classList.remove('show'), 800);
  });

  // (5) Input selector — shared between header + sidebar
  const setInputRoute = (route) => {
    engine.setInputRoute(route);
    document.querySelectorAll('.in-sel button').forEach(b => {
      b.classList.toggle('active', b.dataset.in === route);
    });
    const labels = { L: 'Left Input', ST: 'Stereo Input', R: 'Right Input' };
    document.getElementById('prefInConfig').textContent = labels[route];
    toast(labels[route]);
  };
  document.querySelectorAll('.in-sel button').forEach(btn => {
    btn.addEventListener('click', () => setInputRoute(btn.dataset.in));
  });

  // (6) Input Level knob
  wireLevelKnob('inLevelKnob', (db) => engine.setInputLevelDb(db));

  // (7) Gate on/off
  const gateOnBtn = document.getElementById('gateOnBtn');
  gateOnBtn.addEventListener('click', () => {
    const on = !gateOnBtn.classList.contains('active');
    gateOnBtn.classList.toggle('active', on);
    engine.setGateEnabled(on);
    toast('Gate ' + (on ? 'ON' : 'OFF'));
  });

  // (8) Threshold Learn
  const learnBtn = document.getElementById('learnBtn');
  let learning = false;
  learnBtn.addEventListener('click', async () => {
    if (learning) return;
    learning = true;
    learnBtn.classList.add('learning');
    learnBtn.textContent = 'LEARNING';
    toast('Analyzing background noise... play softly');
    let maxRms = 0;
    const start = performance.now();
    const sample = () => {
      if (performance.now() - start > 2000) {
        const db = maxRms > 0 ? 20 * Math.log10(maxRms) + 6 : -60;
        const clamped = Math.max(-90, Math.min(0, db));
        engine.setGateThreshold(clamped);
        updateGateThreshKnob(clamped);
        learnBtn.classList.remove('learning');
        learnBtn.textContent = 'LEARN';
        learning = false;
        toast(`Gate threshold set to ${clamped.toFixed(1)} dB`);
        return;
      }
      if (engine._gateRMS > maxRms) maxRms = engine._gateRMS;
      requestAnimationFrame(sample);
    };
    sample();
  });

  // (9) Gate Threshold knob (-90..0 dB)
  const gateThreshKnob = document.getElementById('gateThreshKnob');
  const gateThreshInd = gateThreshKnob.querySelector('.level-knob-ind');
  let gateThreshVal = -60;
  const updateGateThreshKnob = (val) => {
    gateThreshVal = val;
    const norm = (val - (-90)) / 90;
    const angle = -135 + norm * 270;
    gateThreshInd.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    engine.setGateThreshold(val);
  };
  updateGateThreshKnob(-60);
  let gtStartY = 0, gtStartVal = 0;
  gateThreshKnob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gtStartY = e.clientY;
    gtStartVal = gateThreshVal;
    gateThreshKnob.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dy = gtStartY - ev.clientY;
      const v = Math.max(-90, Math.min(0, gtStartVal + (dy / 150) * 90));
      updateGateThreshKnob(v);
    };
    const up = () => {
      gateThreshKnob.removeEventListener('pointermove', move);
      gateThreshKnob.removeEventListener('pointerup', up);
    };
    gateThreshKnob.addEventListener('pointermove', move);
    gateThreshKnob.addEventListener('pointerup', up);
  });
  gateThreshKnob.addEventListener('dblclick', () => updateGateThreshKnob(-60));

  // (10) Output Level knob
  wireLevelKnob('outLevelKnob', (db) => engine.setOutputLevelDb(db), -2);

  // (11) Limiter
  const limitBtn = document.getElementById('limitBtn');
  limitBtn.addEventListener('click', () => {
    const on = !limitBtn.classList.contains('active');
    limitBtn.classList.toggle('active', on);
    engine.setLimiterEnabled(on);
    toast('Limiter ' + (on ? 'ON (0 dBFS ceiling)' : 'OFF'));
  });

  // (13) Engine power
  const powerBtn = document.getElementById('powerBtn');
  powerBtn.addEventListener('click', async () => {
    const on = !powerBtn.classList.contains('active');
    powerBtn.classList.toggle('active', on);
    if (on) await engine.ctx.resume();
    engine.setEnginePower(on);
    toast('Audio engine ' + (on ? 'ON' : 'OFF'));
  });

  // (14) NI logo → About
  document.getElementById('niLogo').addEventListener('click', () => {
    document.getElementById('aboutDialog').classList.add('open');
  });

  // ========== SIDECHAIN CONTROLS (Preferences dialog) ==========
  const prefScSource = document.getElementById('prefScSource');
  const prefScLoadBtn = document.getElementById('prefScLoadBtn');
  const prefScFileInput = document.getElementById('prefScFileInput');
  const prefScFileName = document.getElementById('prefScFileName');
  prefScSource.addEventListener('change', (e) => {
    engine.setSidechainSource(e.target.value);
    const labels = {
      none: 'Sidechain bus: OFF',
      tap:  'Sidechain bus: tapping main input',
      file: engine.sidechainFileBuffer ? 'Sidechain bus: playing file' : 'Sidechain bus: load a file first',
    };
    toast(labels[e.target.value]);
  });
  prefScLoadBtn.addEventListener('click', () => prefScFileInput.click());
  prefScFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await engine.loadSidechainFile(file);
    prefScFileName.textContent = file.name;
    toast('Sidechain file loaded: ' + file.name);
  });

  // Dialog close buttons
  document.querySelectorAll('.dialog-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.dataset.close !== undefined) {
        overlay.classList.remove('open');
      }
    });
    overlay.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => overlay.classList.remove('open'));
    });
  });

  // ========== SOURCE CONTROLS ==========
  document.getElementById('inputSource').addEventListener('change', async (e) => {
    await engine.setSource(e.target.value);
  });
  document.getElementById('loadFileBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      await engine.loadFile(e.target.files[0]);
      document.getElementById('inputSource').value = 'file';
      engine.playFile();
      toast('Loaded: ' + e.target.files[0].name);
    }
  });
  document.getElementById('playBtn').addEventListener('click', async () => {
    await engine.resume();
    if (engine.sourceType === 'file') engine.playFile();
  });
  document.getElementById('stopBtn').addEventListener('click', () => engine.stopFile());

  // Preset toolbar
  document.getElementById('prevPreset').addEventListener('click', prevPreset);
  document.getElementById('nextPreset').addEventListener('click', nextPreset);
  document.getElementById('presetShuffleBtn').addEventListener('click', shufflePreset);
  document.getElementById('presetSaveBtn').addEventListener('click', savePreset);
  document.getElementById('presetSaveNewBtn').addEventListener('click', openSaveNewPresetDialog);

  // Show Rack Tools toggle
  const rackToolsBtn = document.getElementById('showRackToolsBtn');
  let rackToolsVisible = true;
  rackToolsBtn.addEventListener('click', () => {
    rackToolsVisible = !rackToolsVisible;
    rackToolsBtn.classList.toggle('active', rackToolsVisible);
    document.querySelectorAll('.section-label.global, #globalFxContainer').forEach(el => {
      el.style.display = rackToolsVisible ? '' : 'none';
    });
    toast(rackToolsVisible ? 'Rack Tools shown' : 'Rack Tools hidden');
  });
  rackToolsBtn.classList.add('active');

  // Clear Rack
  document.getElementById('clearRackBtn').addEventListener('click', () => {
    handleMenuAction('clear-rack');
  });

  // Collapse/Expand All
  const collapseBtn = document.getElementById('collapseAllBtn');
  let collapsed = false;
  collapseBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    collapseBtn.classList.toggle('active', collapsed);
    document.getElementById('compContainer').classList.toggle('collapsed', collapsed);
    document.getElementById('globalFxContainer').classList.toggle('collapsed', collapsed);
    toast(collapsed ? 'Components collapsed' : 'Components expanded');
  });

  // ========== RACK CONTEXT MENU ==========
  let _rackCtxEls = [];
  function closeRackCtx() {
    _rackCtxEls.forEach(el => el.remove());
    _rackCtxEls = [];
    document.removeEventListener('click', closeRackCtx);
    document.removeEventListener('contextmenu', closeRackCtx);
  }

  function openRackContextMenu(x, y) {
    closeRackCtx();
    const menu = document.createElement('div');
    menu.className = 'rack-ctx-menu';
    _rackCtxEls.push(menu);

    const mkItem = (label, opts = {}) => {
      const item = document.createElement('div');
      item.className = 'rack-ctx-item'
        + (opts.disabled ? ' disabled' : '')
        + (opts.hasSub ? ' has-sub' : '');
      item.innerHTML = label + (opts.kb ? ` <span class="kb">${opts.kb}</span>` : '');
      if (opts.action && !opts.disabled) {
        item.addEventListener('click', () => { closeRackCtx(); opts.action(); });
      }
      return item;
    };
    const mkSep = () => { const s = document.createElement('div'); s.className = 'rack-ctx-sep'; return s; };

    // Add Component ›
    const addItem = mkItem('Add Component', { hasSub: true });
    let addSub = null;
    addItem.addEventListener('mouseenter', () => {
      if (addSub) return;
      addSub = document.createElement('div');
      addSub.className = 'rack-ctx-submenu';
      _rackCtxEls.push(addSub);
      const cats = {};
      Object.entries(COMPONENT_REGISTRY).forEach(([id, reg]) => {
        if (!cats[reg.category]) cats[reg.category] = [];
        cats[reg.category].push({ id, name: reg.name });
      });
      COMPONENT_CATEGORIES.forEach(cat => {
        const comps = cats[cat] || [];
        const catItem = mkItem(cat, { hasSub: comps.length > 0, disabled: !comps.length });
        if (comps.length) {
          let catSub = null;
          catItem.addEventListener('mouseenter', () => {
            _rackCtxEls.forEach(el => { if (el.classList.contains('rack-ctx-catsub')) el.remove(); });
            _rackCtxEls = _rackCtxEls.filter(el => !el.classList.contains('rack-ctx-catsub'));
            catSub = document.createElement('div');
            catSub.className = 'rack-ctx-submenu rack-ctx-catsub';
            _rackCtxEls.push(catSub);
            comps.forEach(c => {
              catSub.appendChild(mkItem(c.name, {
                action: () => { addComponentById(c.id); toast('Added: ' + c.name); }
              }));
            });
            const r = catItem.getBoundingClientRect();
            document.body.appendChild(catSub);
            catSub.style.left = Math.min(r.right, window.innerWidth - 170) + 'px';
            catSub.style.top = Math.min(r.top, window.innerHeight - catSub.offsetHeight - 8) + 'px';
          });
        }
        addSub.appendChild(catItem);
      });
      const r = addItem.getBoundingClientRect();
      document.body.appendChild(addSub);
      addSub.style.left = Math.min(r.right, window.innerWidth - 170) + 'px';
      addSub.style.top = Math.min(r.top, window.innerHeight - addSub.offsetHeight - 8) + 'px';
    });
    menu.appendChild(addItem);
    menu.appendChild(mkSep());

    menu.appendChild(mkItem('Undo', { kb: 'Ctrl+Z', disabled: history.pointer <= 0, action: () => handleMenuAction('undo') }));
    menu.appendChild(mkSep());

    menu.appendChild(mkItem('Cut', { kb: 'Ctrl+X', disabled: !selected, action: () => handleMenuAction('cut') }));
    menu.appendChild(mkItem('Copy', { kb: 'Ctrl+C', disabled: !selected, action: () => handleMenuAction('copy') }));
    menu.appendChild(mkItem('Paste', { kb: 'Ctrl+V', disabled: !componentClipboard, action: () => handleMenuAction('paste') }));
    menu.appendChild(mkItem('Delete', { kb: 'Del', disabled: !selected, action: () => handleMenuAction('delete') }));
    menu.appendChild(mkSep());

    ['Clean up Automation List', 'Clear Global MIDI Controls',
     'Save Global MIDI Controls as Default', 'Load Default Global MIDI Controls',
     'MIDI Controls List'].forEach(label => {
      menu.appendChild(mkItem(label, { action: () => toast(label + ' — not available in web edition') }));
    });

    document.body.appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 8) + 'px';
    setTimeout(() => {
      document.addEventListener('click', closeRackCtx);
      document.addEventListener('contextmenu', closeRackCtx);
    });
  }

  document.getElementById('rack').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openRackContextMenu(e.clientX, e.clientY);
  });

  // Rack-level drag handler (accept rack-internal drops on empty area)
  const rackRoot = document.getElementById('rack');
  rackRoot.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('application/x-rack-component')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  });
  rackRoot.addEventListener('drop', (e) => {
    if (e.dataTransfer.types.includes('application/x-rack-component')) {
      e.preventDefault();
    }
  });

  // Master mute
  const sfMuteBtn = document.getElementById('sfMuteBtn');
  let muted = false;
  sfMuteBtn.addEventListener('click', () => {
    muted = !muted;
    sfMuteBtn.classList.toggle('muted', muted);
    engine.setOutputMuted(muted);
    toast(muted ? 'Master MUTED' : 'Master unmuted');
  });

  // Info pane title (clickable stub) + expand/collapse
  document.getElementById('sfInfoTitle').addEventListener('click', () => {
    toast('Opening manual section — not available in web edition');
  });
  const sfInfoToggle = document.getElementById('sfInfoToggle');
  const sfInfo = document.getElementById('sfInfo');
  sfInfoToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sfInfo.classList.toggle('collapsed');
  });

  // ========== METERS + FRAME LOOP ==========
  const inPeakBuf = new Float32Array(engine.inPeakAnalyser.fftSize);
  const outPeakBuf = new Float32Array(engine.outPeakAnalyser.fftSize);
  const inMeterCanvas = document.getElementById('inMeter');
  const outMeterCanvas = document.getElementById('outMeter');
  const inClip = document.getElementById('inClip');
  const outClip = document.getElementById('outClip');
  let inClipTimer = 0, outClipTimer = 0;
  let inPeakHold = 0, outPeakHold = 0;

  function drawPeakMeter(canvas, peak, held) {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvas.clientWidth * dpr) {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    }
    const c = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const barW = Math.min(w, peak * w);
    const grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#2d8a3e');
    grad.addColorStop(0.6, '#ffb020');
    grad.addColorStop(0.85, '#ff8800');
    grad.addColorStop(1, '#ff3322');
    c.fillStyle = grad;
    c.fillRect(0, 0, barW, h);
    if (held > 0.02) {
      c.fillStyle = '#fff';
      c.fillRect(held * w - 1, 0, 2, h);
    }
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 1; i < 20; i++) c.fillRect((w / 20) * i - 0.5, 0, 1, h);
  }

  let lastCpu = performance.now();
  function frame() {
    // Read the external sidechain bus peak once per frame and fan it out
    // to any component that opts in via updateSidechain(peak).
    const scPeak = engine.getSidechainPeak ? engine.getSidechainPeak() : 0;
    const fanOutSidechain = (c) => {
      if (c.updateSidechain) c.updateSidechain(scPeak);
    };
    engine.components.forEach(c => {
      if (c.drawMeter) c.drawMeter();
      if (c.updateTuner) c.updateTuner();
      fanOutSidechain(c);
    });
    engine.globalFxComponents.forEach(fanOutSidechain);

    engine.inPeakAnalyser.getFloatTimeDomainData(inPeakBuf);
    let inPeak = 0;
    for (let i = 0; i < inPeakBuf.length; i++) {
      const a = Math.abs(inPeakBuf[i]);
      if (a > inPeak) inPeak = a;
    }
    engine.outPeakAnalyser.getFloatTimeDomainData(outPeakBuf);
    let outPeak = 0;
    for (let i = 0; i < outPeakBuf.length; i++) {
      const a = Math.abs(outPeakBuf[i]);
      if (a > outPeak) outPeak = a;
    }
    inPeakHold = Math.max(inPeak, inPeakHold * 0.97);
    outPeakHold = Math.max(outPeak, outPeakHold * 0.97);
    drawPeakMeter(inMeterCanvas, inPeak, inPeakHold);
    drawPeakMeter(outMeterCanvas, outPeak, outPeakHold);
    if (inPeak > 0.98) { inClip.classList.add('clipping'); inClipTimer = 60; }
    else if (inClipTimer > 0) { inClipTimer--; if (inClipTimer === 0) inClip.classList.remove('clipping'); }
    if (outPeak > 0.98) { outClip.classList.add('clipping'); outClipTimer = 60; }
    else if (outClipTimer > 0) { outClipTimer--; if (outClipTimer === 0) outClip.classList.remove('clipping'); }

    const now = performance.now();
    const dt = now - lastCpu;
    lastCpu = now;
    engine.cpuLoad = engine.cpuLoad * 0.9 + (engine.components.length * 0.8 + dt * 0.1) * 0.1;
    document.getElementById('cpuVal').textContent = engine.cpuLoad.toFixed(1);
    // Live sidechain peak in Preferences dialog (only when open)
    const prefsDlg = document.getElementById('prefsDialog');
    if (prefsDlg && prefsDlg.classList.contains('open')) {
      const el = document.getElementById('prefScPeak');
      if (el) el.textContent = scPeak.toFixed(2);
    }
    requestAnimationFrame(frame);
  }
  frame();

  // Resume audio context on first interaction (browser autoplay policy)
  document.addEventListener('click', () => engine.resume(), { once: true });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleMenuAction('undo'); }
    else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleMenuAction('redo'); }
    else if (ctrl && e.key === 'x') { e.preventDefault(); handleMenuAction('cut'); }
    else if (ctrl && e.key === 'c') { e.preventDefault(); handleMenuAction('copy'); }
    else if (ctrl && e.key === 'v') { e.preventDefault(); handleMenuAction('paste'); }
    else if (ctrl && e.key === 'a') { e.preventDefault(); handleMenuAction('select-all'); }
    else if (ctrl && e.key === 'n') { e.preventDefault(); handleMenuAction('new-preset'); }
    else if (ctrl && e.key === 'o') { e.preventDefault(); handleMenuAction('open-preset'); }
    else if (ctrl && e.shiftKey && e.key === 'S') { e.preventDefault(); openSaveNewPresetDialog(); }
    else if (ctrl && e.key === 's') { e.preventDefault(); savePreset(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selected) { e.preventDefault(); handleMenuAction('delete'); }
    }
  });

  pushHistory();
  toast('Click Input → Microphone or load a file to begin');
}

boot();
