// ============================================================
// DSP UTILITIES
// ============================================================

export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

export function makeDriveCurve(amount) {
  const k = amount * 0.5;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k / 100) * x) / (1 + (k / 100) * Math.abs(x));
  }
  return curve;
}

// Synthesized cabinet impulse response
// Exponential decay + a few resonant modes for characteristic color
export function makeCabIR(ctx, duration) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 120);
      const noise = (Math.random() * 2 - 1);
      const mode1 = Math.sin(2 * Math.PI * 90 * t) * 0.3;
      const mode2 = Math.sin(2 * Math.PI * 250 * t) * 0.2;
      d[i] = (noise * 0.6 + mode1 + mode2) * env;
    }
  }
  return buf;
}

// Pitch detection via autocorrelation
// Returns frequency in Hz, or -1 if no pitch detected
export function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;
  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;
  const c = new Array(newSize).fill(0);
  for (let i = 0; i < newSize; i++)
    for (let j = 0; j < newSize - i; j++) c[i] += trimmed[j] * trimmed[j + i];
  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < newSize; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  let T0 = maxpos;
  if (T0 <= 0) return -1;
  const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function freqToNote(f) {
  const midi = 69 + 12 * Math.log2(f / 440);
  const rounded = Math.round(midi);
  const cents = (midi - rounded) * 100;
  const name = NOTE_NAMES[(rounded + 1200) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { note: name + octave, cents };
}
