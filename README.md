# Guitar Rig Web

A browser-based recreation of Native Instruments Guitar Rig, built with the Web Audio API, AudioWorklet, and vanilla JavaScript. Designed as a faithful implementation of the Guitar Rig 7 manual.

## Status

Early development. The core architecture (AudioEngine, Component base class, rack/signal-flow/browser shell) is in place, with four working components:

- **Fast Comp** — Dynamics compressor with live GR meter
- **Bass Pro** — Gate + 3-band EQ + sweepable mid + drive + master
- **Control Room Pro** — Cabinet simulator (convolution IR + tone stack)
- **Stereo Tune** — Chromatic tuner with autocorrelation pitch detection

### Features implemented

- Four-panel shell: Header, Browser, Rack, Signal Flow sidebar
- Full header from manual (all 14 numbered controls): Main menu, Browser/Sidebar toggles, View size (75%–200% in 9 steps), L/Stereo/R input selector, Input Level with peak meter + clip, Gate on/off + Learn + Threshold, Output Level with peak meter + clip, Limiter, CPU meter, Engine on/off, NI logo
- Cascading main menu (File / Edit / Help) with working Preferences and About dialogs
- Preset save/load as `.grp.json`
- Undo/redo history (50 steps) with full component serialization
- Cut/copy/paste/delete components, keyboard shortcuts (Ctrl+Z/X/C/V, Del, etc.)
- Click-and-drag component reordering
- Click-and-drag rack resizing handle
- Hover-to-describe info pane — every knob shows its manual description
- Clickable info pane title (stub for manual links), expand/collapse
- Two-section signal path: **Rack** → **Global FX**
- Component On/Off that truly removes nodes from the graph (CPU freed), not just crossfades
- Per-component Mono/Stereo processing toggle for CPU reduction
- Sidechain input scaffolding
- Master mute in signal flow panel
- AudioWorklet-based noise gate running on the audio thread with RMS reporting back to the UI for Learn

## Running locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

For a production build:

```bash
npm run build
npm run preview
```

## Architecture

```
src/
├── main.js                  # Entry point, boots the app
├── engine/
│   ├── audio-engine.js      # AudioEngine class: routing, input/output, gate, limiter
│   ├── component-base.js    # Component base class — bypass/mono/param handling
│   ├── component-registry.js# Maps component IDs to classes for serialization
│   ├── dsp-utils.js         # Helpers: dB↔gain, drive curves, cab IR, pitch detection
│   └── info-db.js           # Manual-aligned control and component descriptions
├── components/
│   ├── fast-comp.js
│   ├── bass-pro.js
│   ├── control-room-pro.js
│   └── stereo-tune.js
├── workers/
│   └── gate-processor.js    # AudioWorkletProcessor for the noise gate
├── ui/
│   ├── app.js               # Main app wiring: menus, dialogs, events
│   ├── header.js            # Header controls (14 items)
│   ├── rack.js              # Rack rendering, drag-and-drop, selection
│   ├── sidebar.js           # Signal Flow + Info pane
│   ├── browser.js           # Left-side Browser panel
│   ├── knob.js              # Reusable knob interaction
│   └── menu.js              # Cascading menu and dialog helpers
├── util/
│   ├── history.js           # Undo/redo stack
│   └── toast.js             # Toast notifications
├── styles.css               # All styles
└── index.html               # HTML shell
```

## Signal path

```
mic / file → input → splitter → merger (L/ST/R) → inputLevel → inPeakAnalyser
                                                        │
                                                        ▼
                                                   gateNode (AudioWorklet)
                                                        │
                                                        ▼
                                          [ rack components, enabled only ]
                                                        │
                                                        ▼
                                                  globalFxStart
                                                        │
                                                        ▼
                                          [ global FX components, enabled only ]
                                                        │
                                                        ▼
                                                     output
                                                        │
                                                        ▼
                                                  outputLevel
                                                        │
                                              ┌─────────┴─────────┐
                                              ▼                   ▼
                                         limiterBypass         limiter
                                              │                   │
                                              └────────┬──────────┘
                                                       ▼
                                                   masterMute
                                                       │
                                                       ▼
                                                outPeakAnalyser
                                                       │
                                                       ▼
                                                  destination
```

When a component is toggled Off, it is skipped in the chain rebuild entirely, freeing its DSP nodes from the live graph. When mono mode is enabled on a component, a `ChannelCount=1` downmix gain node is inserted before its input.

## Adding a new component

1. Create `src/components/my-comp.js` extending `Component`
2. Implement `_buildDSP(ctx)`, `_connectDSP()`, `_applyParam(key, value)`, and `render()`
3. Register it in `src/engine/component-registry.js`
4. Add its description and control info to `src/engine/info-db.js`

That's it — the registry handles serialization, undo/redo, and cut/paste automatically.

## Roadmap

Following the Guitar Rig 7 manual page by page. Next up: Sidebar detail pages, Browser detail (Components tab, Favorites, Filters, Search), Tools components (Split M/S, Split Mix, Crossover, Container), preset file format compatibility, amp heads, modulation, delay, reverb, distortion, filter, pitch components.

## License

Open source. No affiliation with Native Instruments.
