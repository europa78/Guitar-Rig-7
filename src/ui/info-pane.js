// ============================================================
// INFO PANE — component + control descriptions
// ============================================================
//
// Keyed by component id and `<componentId>.<paramKey>` for controls.
// When hovering a knob, wireComponent passes `control: 'fastcomp.input'`
// and the pane shows the control's explanation.  When hovering or
// selecting a component, the pane shows the component summary.

export const COMPONENT_INFO = {
  fastcomp: {
    name: 'Fast Comp',
    desc: 'A fast, character-rich compressor ideal for drums, bass, and aggressive transient control. Uses a soft-knee dynamics compressor with adjustable input drive and make-up gain.',
  },
  basspro: {
    name: 'Bass Pro',
    desc: 'A dedicated bass preamp and tone shaper with noise gate, three-band EQ, sweepable mid frequency, tube-style drive, and master output. Modelled after classic bass rig preamps.',
  },
  controlroom: {
    name: 'Control Room Pro',
    desc: 'A cabinet and room simulator that applies convolution-based cab coloration and air. Features high-pass / low-pass shaping, three-band EQ, and a mix between dry cabinet and room reflections.',
  },
  stereotune: {
    name: 'Stereo Tune',
    desc: 'A chromatic tuner with real-time pitch detection (autocorrelation). Displays the nearest note and cents deviation. Turns green when within ±5 cents of pitch.',
  },
};

export const CONTROL_INFO = {
  // Fast Comp
  'fastcomp.input':  { name: 'Input',    text: 'Adjusts the amount of gain added to the signal before the compressor. Use this control to drive the compressor harder and to compensate for the gain reduction applied by the compressor, increasing the overall loudness of the signal.' },
  'fastcomp.attack': { name: 'Attack',   text: 'Sets how quickly the compressor responds to transients. Shorter attack times catch fast peaks but can soften transients; longer attack times let transients through before compression kicks in.' },
  'fastcomp.ratio':  { name: 'Ratio',    text: 'Sets the compression ratio. A ratio of 4:1 means that for every 4 dB the signal exceeds the threshold, only 1 dB will pass through.' },
  'fastcomp.makeup': { name: 'Makeup',   text: 'Adjusts the output gain after compression to compensate for gain reduction and match the uncompressed level.' },
  // Bass Pro
  'basspro.gate':    { name: 'Gate',     text: 'Adjusts the noise gate threshold. Lower values let more of the signal through; higher values suppress quiet noise between notes.' },
  'basspro.bass':    { name: 'Bass',     text: 'Low-shelf filter at 100 Hz. Boost or cut the fundamental frequencies of the bass signal.' },
  'basspro.mid':     { name: 'Mid',      text: 'Peaking filter whose center frequency is set by the Mid Freq control. Shapes the midrange character of the tone.' },
  'basspro.midFreq': { name: 'Mid Freq', text: 'Sets the center frequency of the Mid band, from 200 Hz (warmth) to 5 kHz (bite).' },
  'basspro.treble':  { name: 'Treble',   text: 'High-shelf filter at 3.2 kHz. Boost for presence and string articulation, cut to tame harshness.' },
  'basspro.drive':   { name: 'Drive',    text: 'Adds harmonic saturation via a waveshaper. Low values add warmth, high values produce aggressive tube-style distortion.' },
  'basspro.master':  { name: 'Master',   text: 'Output gain of the Bass Pro stage.' },
  // Control Room Pro
  'controlroom.bass':   { name: 'Bass',   text: 'Low-shelf boost/cut for cabinet low end.' },
  'controlroom.treble': { name: 'Treble', text: 'Peaking filter around 2.5 kHz for cabinet presence.' },
  'controlroom.air':    { name: 'Air',    text: 'High-shelf filter at 8 kHz. Adds open top-end character.' },
  'controlroom.volume': { name: 'Volume', text: 'Final volume of the cabinet simulator stage.' },
};

export const DEFAULT_INFO = {
  title: 'Guitar Rig',
  body: 'Select a Component to see details. Hover over any control to see what it does.',
};

export function updateInfoPane(opts = {}) {
  const titleEl = document.getElementById('sfInfoTitle');
  const bodyEl = document.getElementById('sfInfoBody');
  if (!titleEl || !bodyEl) return;

  if (opts.control) {
    const ctrl = CONTROL_INFO[opts.control];
    if (ctrl) {
      titleEl.textContent = opts.componentName || '';
      bodyEl.innerHTML = `
        <div class="sf-info-control">${ctrl.name.toUpperCase()}</div>
        <div>${ctrl.text}</div>`;
      return;
    }
  }
  if (opts.component) {
    const info = COMPONENT_INFO[opts.component.id];
    if (info) {
      titleEl.textContent = info.name;
      bodyEl.textContent = info.desc;
      return;
    }
  }
  titleEl.textContent = DEFAULT_INFO.title;
  bodyEl.textContent = DEFAULT_INFO.body;
}
