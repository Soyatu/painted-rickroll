// ============================================================
// The soundtrack: an original score, synthesised live with WebAudio and locked to the picture.
// A piano nocturne (the bait), a record scratch, a drum fill, then an eighties drum-machine
// pop groove with octave bass, gated snare, stabs and a bell hook; a jazzy theatre break;
// a key change for the last chorus; a music box that leads back to the start.
// No samples, and nothing from the song the joke is about.
// ============================================================
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const AUDIO = { ctx: null, out: null, rev: null, gate: null, noise: null, master: null, t0: 0, running: false, idx: 0, loop: 0, muted: false };

function audioSetup() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  let ctx;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
  Object.assign(AUDIO, { ctx }, buildGraph(ctx));
  return true;
}
// the mixing desk: a bus into shelving EQ and a glue compressor; hall, gated and echo sends
function buildGraph(ctx) {
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -15; comp.knee.value = 12; comp.ratio.value = 3.2; comp.attack.value = 0.004; comp.release.value = 0.2;
  const bus = ctx.createGain(); bus.gain.value = 0.5;
  const lowS = ctx.createBiquadFilter(); lowS.type = 'lowshelf'; lowS.frequency.value = 90; lowS.gain.value = 0.5;
  const highS = ctx.createBiquadFilter(); highS.type = 'highshelf'; highS.frequency.value = 6500; highS.gain.value = 4.5;
  bus.connect(lowS); lowS.connect(highS); highS.connect(comp); comp.connect(master); master.connect(ctx.destination);
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 2.6, 3.4, false);
  const revG = ctx.createGain(); revG.gain.value = 0.32; rev.connect(revG); revG.connect(bus);
  const gate = ctx.createConvolver(); gate.buffer = impulse(ctx, 0.33, 0, true);
  const gateG = ctx.createGain(); gateG.gain.value = 0.42; gate.connect(gateG); gateG.connect(bus);
  // an eighties dotted-eighth echo for the leads, bouncing left and right
  const echo = ctx.createGain();
  const dl = ctx.createDelay(2), dr = ctx.createDelay(2); dl.delayTime.value = BEAT * 0.75; dr.delayTime.value = BEAT * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200;
  const pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7;
  const wet = ctx.createGain(); wet.gain.value = 0.26;
  echo.connect(tone); tone.connect(dl); dl.connect(pl); dl.connect(dr); dr.connect(pr); dr.connect(fb); fb.connect(dl);
  pl.connect(wet); pr.connect(wet); wet.connect(bus);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  const r = mulberry(99);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
  return { out: bus, rev, gate, noise: nb, master, echo, comp };
}
// Debug: render beats [b0, b1) of the score offline through the same desk and measure it.
async function audioMeasure(b0, b1, only) {
  const sr = 22050, t0 = b0 * BEAT, t1 = b1 * BEAT;
  const off = new OfflineAudioContext(2, Math.ceil(sr * (t1 - t0 + 2)), sr);
  const saved = Object.assign({}, AUDIO);
  Object.assign(AUDIO, { ctx: off }, buildGraph(off));
  let errs = 0;
  for (const e of SCORE) if (e.t >= t0 && e.t < t1 && (!only || only.includes(e.fn))) { try { e.fn(e.t - t0 + 0.01, ...e.a); } catch (x) { errs++; } }
  const buf = await off.startRendering();
  Object.assign(AUDIO, saved);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const spb = Math.round(BAR * sr), bars = [];
  let pk = 0;
  for (let k = 0; k * spb < L.length - sr; k++) {
    let s2 = 0, p = 0;
    for (let i = k * spb; i < (k + 1) * spb && i < L.length; i++) { s2 += L[i] * L[i] + R[i] * R[i]; p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); }
    pk = Math.max(pk, p);
    bars.push(+(10 * Math.log10(s2 / (2 * spb) + 1e-12)).toFixed(1));
  }
  return { errs, peakDb: +(20 * Math.log10(pk + 1e-12)).toFixed(2), barsRms: bars, buf };
}
function impulse(ctx, dur, decay, gated) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
  const r = mulberry(gated ? 7 : 11);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const e = gated ? (x < 0.88 ? 1 - 0.35 * x : (1 - x) * 5.4) : Math.pow(1 - x, decay);
      d[i] = (r() * 2 - 1) * e;
    }
  }
  return b;
}
const A_gain = v => { const g = AUDIO.ctx.createGain(); g.gain.value = v; return g; };
function send(node, dest, amt) { if (amt > 0) { const g = A_gain(amt); node.connect(g); g.connect(dest); } }
function osc(type, f, t, end) {
  const o = AUDIO.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(end); return o;
}
function noiseSrc(t, end) {
  const s = AUDIO.ctx.createBufferSource(); s.buffer = AUDIO.noise; s.loop = true;
  s.start(t, (t * 7.31) % 1.5); s.stop(end); return s;
}
function noiseHit(t, dur, type, freq, v, q, sRev, sGate, pan) {
  const ctx = AUDIO.ctx;
  const s = noiseSrc(t, t + dur + 0.03);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
  s.connect(f); f.connect(g);
  let out = g;
  if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  out.connect(AUDIO.out);
  send(out, AUDIO.rev, sRev || 0); send(out, AUDIO.gate, sGate || 0);
  return { s, f, g };
}

// ---------------------------------------------------------------- instruments
const I = {};
I.kick = (t, v = 1) => {
  const ctx = AUDIO.ctx;
  const o = osc('sine', 160, t, t + 0.45);
  o.frequency.setValueAtTime(165, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.05 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  o.connect(g); g.connect(AUDIO.out);
  noiseHit(t, 0.012, 'highpass', 2600, 0.22 * v);
};
I.snare = (t, v = 1) => {
  noiseHit(t, 0.19, 'bandpass', 1900, 0.8 * v, 0.7, 0.08, 1.0);
  noiseHit(t, 0.07, 'highpass', 4800, 0.4 * v, 0.7, 0.04, 0.35);
  const o = osc('triangle', 200, t, t + 0.15);
  o.frequency.setValueAtTime(205, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.gate, 0.5);
};
I.clap = (t, v = 1) => {
  for (let k = 0; k < 3; k++) noiseHit(t + k * 0.011, 0.012, 'bandpass', 1500, 1.8 * v, 1.2);
  noiseHit(t + 0.033, 0.17, 'bandpass', 1400, 1.5 * v, 1.0, 0.35);
};
I.snap = (t, v = 1) => noiseHit(t, 0.03, 'bandpass', 2700, 0.8 * v, 3, 0.25);
I.hat = (t, v = 1, open) => noiseHit(t, open ? 0.3 : 0.05, 'highpass', 7200, (open ? 0.75 : 0.66) * v, 0.8, 0.04, 0, 0.25);
I.crash = (t, v = 1) => noiseHit(t, 1.9, 'highpass', 4200, 0.42 * v, 0.5, 0.3);
I.tom = (t, n, v = 1) => {
  const f = mtof(n);
  const o = osc('sine', f, t, t + 0.42);
  o.frequency.setValueAtTime(f * 1.7, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.gate, 0.4);
};
I.timp = (t, n, v = 1) => {
  const f = mtof(n);
  const o = osc('sine', f, t, t + 1.6);
  o.frequency.setValueAtTime(f * 1.15, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.2);
  const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.3);
  noiseHit(t, 0.08, 'lowpass', 500, 0.3 * v);
};
// the eighties octave bass
I.bass = (t, n, dur, v = 1) => {
  const ctx = AUDIO.ctx, f = mtof(n), end = t + dur + 0.08;
  const o1 = osc('sawtooth', f, t, end), o2 = osc('square', f, t, end); o2.detune.value = -8;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
  lp.frequency.setValueAtTime(300 + 2100 * v, t); lp.frequency.exponentialRampToValueAtTime(230, t + 0.13);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.34 * v, t + 0.004);
  g.gain.setTargetAtTime(0.2 * v, t + 0.005, 0.05); g.gain.setTargetAtTime(0, t + dur, 0.015);
  const m = A_gain(0.5);
  o1.connect(lp); o2.connect(m); m.connect(lp); lp.connect(g); g.connect(AUDIO.out);
};
// a plucked upright for the theatre's walking line
I.upright = (t, n, v = 1) => {
  const ctx = AUDIO.ctx, f = mtof(n), end = t + 0.7;
  const o1 = osc('triangle', f, t, end), o2 = osc('sine', f * 2, t, end);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
  const m = A_gain(0.25);
  o1.connect(lp); o2.connect(m); m.connect(lp); lp.connect(g); g.connect(AUDIO.out);
  noiseHit(t, 0.02, 'lowpass', 900, 0.1 * v);
};
I.stab = (t, notes, dur, v = 1, bright = 1) => {
  const ctx = AUDIO.ctx, end = t + dur + 0.25;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5;
  lp.frequency.setValueAtTime(1500 + 4500 * bright, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur + 0.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18 * v, t + 0.006);
  g.gain.setTargetAtTime(0.105 * v, t + 0.01, dur * 0.4); g.gain.setTargetAtTime(0, t + dur, 0.03);
  lp.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.22);
  for (const n of notes) for (const dt of [-7, 7]) { const o = osc('sawtooth', mtof(n), t, end); o.detune.value = dt; o.connect(lp); }
};
I.pad = (t, notes, dur, v = 1) => {
  const ctx = AUDIO.ctx, end = t + dur + 0.8;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.3); g.gain.setTargetAtTime(0, t + dur, 0.2);
  lp.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.5);
  for (const n of notes) for (const dt of [0, 11]) { const o = osc('sawtooth', mtof(n), t, end); o.detune.value = dt; o.connect(lp); }
};
// FM: a DX-style electric piano / bell
I.bell = (t, n, dur, v = 1, ratio = 1, index = 3) => {
  const ctx = AUDIO.ctx, f = mtof(n), len = Math.max(0.5, dur * 2.5), end = t + len + 0.05;
  const c = osc('sine', f, t, end), m = osc('sine', f * ratio, t, end);
  const mg = ctx.createGain(); mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.6);
  m.connect(mg); mg.connect(c.frequency);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.36 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  c.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.3); send(g, AUDIO.echo, 0.5);
};
I.brass = (t, n, dur, v = 1) => {
  const ctx = AUDIO.ctx, f = mtof(n), end = t + dur + 0.2;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.2;
  lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(4200, t + 0.06); lp.frequency.setTargetAtTime(2400, t + 0.07, 0.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.21 * v, t + 0.022); g.gain.setTargetAtTime(0.17 * v, t + 0.03, 0.1); g.gain.setTargetAtTime(0, t + dur, 0.03);
  lp.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.2); send(g, AUDIO.echo, 0.3);
  for (const dt of [-6, 6]) { const o = osc('sawtooth', f, t, end); o.detune.value = dt; o.connect(lp); }
  const sub = osc('square', f / 2, t, end), sg = A_gain(0.25); sub.connect(sg); sg.connect(lp);
};
// a wordless, formant-filtered "voice" for when he sings
I.voice = (t, n, dur, v = 1, vowel = 'a') => {
  const ctx = AUDIO.ctx, f = mtof(n), end = t + dur + 0.25;
  const o = osc('sawtooth', f, t, end), o2 = osc('sawtooth', f, t, end); o2.detune.value = 9;
  const lfo = osc('sine', 5.4, t, end), lg = ctx.createGain();
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(16, t + Math.min(0.3, dur));
  lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
  for (const oo of [o, o2]) { oo.frequency.setValueAtTime(f * 0.96, t); oo.frequency.exponentialRampToValueAtTime(f, t + 0.06); }
  const mix = A_gain(0.6); o.connect(mix); o2.connect(mix);
  // a baritone's vowels
  const F = { a: [[730, 1], [1090, 0.5], [2440, 0.2]], o: [[570, 1], [840, 0.45], [2410, 0.12]], e: [[530, 1], [1840, 0.4], [2480, 0.18]] }[vowel];
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * v, t + 0.045); g.gain.setTargetAtTime(0, t + dur, 0.05);
  for (const [ff, gg] of F) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = ff / 110;
    const gn = A_gain(gg * 2.6); mix.connect(bp); bp.connect(gn); gn.connect(g);
  }
  g.connect(AUDIO.out); send(g, AUDIO.rev, 0.35); send(g, AUDIO.echo, 0.35);
};
I.piano = (t, n, dur, v = 1) => {
  const ctx = AUDIO.ctx, f = mtof(n);
  const g = ctx.createGain(); g.gain.value = 0.065 * v;
  g.connect(AUDIO.out); send(g, AUDIO.rev, 0.55);
  const amps = [1, 0.5, 0.28, 0.15, 0.08, 0.04];
  const damp = t + dur + 0.25;
  for (let k = 1; k <= 6; k++) {
    const T = 2.6 / Math.pow(k, 0.75) * (n < 55 ? 1.3 : 1);
    const end = Math.min(t + T + 0.1, damp + 0.35);
    const o = osc('sine', f * k * (1 + 0.0004 * k * k), t, end);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(amps[k - 1], t + 0.004);
    pg.gain.exponentialRampToValueAtTime(0.0008, t + T);
    pg.gain.setTargetAtTime(0, damp, 0.08);
    o.connect(pg); pg.connect(g);
  }
  noiseHit(t, 0.02, 'lowpass', 1800, 0.02 * v);
};
I.mbox = (t, n, v = 1) => {
  const ctx = AUDIO.ctx, f = mtof(n);
  const g = ctx.createGain(); g.gain.value = 0.17 * v; g.connect(AUDIO.out); send(g, AUDIO.rev, 0.6); send(g, AUDIO.echo, 0.25);
  for (const [k, a, T] of [[1, 1, 1.4], [2.01, 0.3, 0.5], [5.4, 0.12, 0.12]]) {
    const o = osc('sine', f * k, t, t + T + 0.05), pg = ctx.createGain();
    pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(a, t + 0.002); pg.gain.exponentialRampToValueAtTime(0.001, t + T);
    o.connect(pg); pg.connect(g);
  }
};
I.pluck = (t, n, v = 1, pan = 0) => {
  const ctx = AUDIO.ctx, f = mtof(n), end = t + 0.25;
  const o = osc('square', f, t, end);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.15);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.075 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  o.connect(lp); lp.connect(g); g.connect(p); p.connect(AUDIO.out); send(p, AUDIO.rev, 0.3);
};
I.goofy = (t, n, dur, v = 1) => {
  const ctx = AUDIO.ctx, end = t + dur + 0.1;
  const o = osc('square', mtof(n), t, end);
  const lfo = osc('sine', 9, t, end), lg = A_gain(45); lfo.connect(lg); lg.connect(o.detune);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.01); g.gain.setTargetAtTime(0, t + dur, 0.02);
  o.connect(lp); lp.connect(g); g.connect(AUDIO.out);
};
// ---------------------------------------------------------------- sound effects
I.scratch = t => {
  const ctx = AUDIO.ctx, end = t + 0.5;
  const s = noiseSrc(t, end);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
  const fr = [[0, 500], [0.08, 2700], [0.16, 600], [0.27, 2300], [0.42, 280]];
  for (const [dt, f] of fr) bp.frequency.linearRampToValueAtTime(f, t + dt);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.01); g.gain.setValueAtTime(0.7, t + 0.36); g.gain.linearRampToValueAtTime(0, t + 0.46);
  s.connect(bp); bp.connect(g); g.connect(AUDIO.out);
  const o = osc('sawtooth', 150, t, end);
  for (const [dt, f] of fr) o.frequency.linearRampToValueAtTime(f * 0.3, t + dt);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.12, t + 0.01); g2.gain.setValueAtTime(0.12, t + 0.36); g2.gain.linearRampToValueAtTime(0, t + 0.46);
  o.connect(lp); lp.connect(g2); g2.connect(AUDIO.out);
};
I.bloop = (t, f0 = 500, v = 1) => {
  const o = osc('sine', f0, t, t + 0.12);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + 0.07);
  const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.4);
};
I.blip = (t, n) => {
  const o = osc('square', mtof(n), t, t + 0.07);
  const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(g); g.connect(AUDIO.out);
};
I.ding = (t, n = 96, v = 1) => I.bell(t, n, 0.5, 0.8 * v, 3.5, 2.2);
I.whoosh = (t, dur = 0.5, v = 1, pan = 0) => {
  const ctx = AUDIO.ctx, end = t + dur + 0.05;
  const s = noiseSrc(t, end);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55); bp.frequency.exponentialRampToValueAtTime(500, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.42 * v, t + dur * 0.55); g.gain.linearRampToValueAtTime(0, t + dur);
  const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-pan, t); p.pan.linearRampToValueAtTime(pan, t + dur);
  s.connect(bp); bp.connect(g); g.connect(p); p.connect(AUDIO.out); send(p, AUDIO.rev, 0.2);
};
I.riser = (t, dur, v = 1) => {
  const ctx = AUDIO.ctx, end = t + dur + 0.05;
  const s = noiseSrc(t, end);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(300, t); hp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28 * v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
  s.connect(hp); hp.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.3);
  const o = osc('sawtooth', 110, t, end); o.frequency.exponentialRampToValueAtTime(880, t + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.05 * v, t + dur); g2.gain.linearRampToValueAtTime(0, t + dur + 0.03);
  o.connect(lp); lp.connect(g2); g2.connect(AUDIO.out);
};
I.splash = (t, v = 1) => {
  noiseHit(t, 0.75, 'lowpass', 2800, 0.6 * v, 0.7, 0.3);
  const n = noiseHit(t + 0.02, 0.4, 'bandpass', 1200, 0.4 * v, 0.9, 0.2);
  n.f.frequency.exponentialRampToValueAtTime(400, t + 0.4);
};
I.clunk = t => {
  const o = osc('sine', 80, t, t + 0.4);
  o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.2);
  const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.7);
  noiseHit(t, 0.03, 'highpass', 1500, 0.5, 0.7, 0.5);
};
I.shutter = t => { noiseHit(t, 0.018, 'highpass', 3000, 0.45); noiseHit(t + 0.055, 0.024, 'highpass', 2400, 0.35); };
I.swish = (t, dur = 1.2, v = 1) => {
  const ctx = AUDIO.ctx, s = noiseSrc(t, t + dur + 0.05);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.4); lp.frequency.linearRampToValueAtTime(300, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * v, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(lp); lp.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.2);
};
I.brush = (t, v = 1) => {
  const n = noiseHit(t, 0.35, 'bandpass', 3000, 0.25 * v, 0.8, 0.2);
  n.f.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
};
I.slide = (t, n0, n1, dur, v = 1) => {
  const ctx = AUDIO.ctx, end = t + dur + 0.1;
  const o = osc('sine', mtof(n0), t, end); o.frequency.exponentialRampToValueAtTime(mtof(n1), t + dur);
  const lfo = osc('sine', 6, t, end), lg = A_gain(25); lfo.connect(lg); lg.connect(o.detune);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.03); g.gain.setTargetAtTime(0, t + dur, 0.03);
  o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.25);
};
I.cricket = t => {
  for (let k = 0; k < 3; k++) {
    const t1 = t + k * 0.075;
    const o = osc('sine', 4300, t1, t1 + 0.06);
    const am = osc('square', 42, t1, t1 + 0.06), ag = A_gain(0.5);
    const g = AUDIO.ctx.createGain(); g.gain.setValueAtTime(0, t1); g.gain.linearRampToValueAtTime(0.05, t1 + 0.01); g.gain.linearRampToValueAtTime(0, t1 + 0.055);
    am.connect(ag); ag.connect(g.gain);
    o.connect(g); g.connect(AUDIO.out); send(g, AUDIO.rev, 0.4);
  }
};
I.applause = (t, dur, v = 1) => {
  const r = mulberry(Math.floor(t * 1000));
  const n = Math.floor(dur * 9);
  for (let i = 0; i < n; i++) {
    const tt = t + r() * dur;
    const fade = 1 - (tt - t) / dur;
    noiseHit(tt, 0.05, 'bandpass', 900 + r() * 1400, 0.22 * v * fade, 1.2, 0.3, 0, (r() - 0.5) * 1.2);
  }
};

// ---------------------------------------------------------------- the score
const SCORE = [];
const VOICE = [];     // [start, end] of every sung note, so his mouth can follow the tune
const ev = (beat, fn, ...a) => SCORE.push({ t: beat * BEAT, fn, a });
const CHD = {
  Bb: { r: 34, s: [58, 62, 65, 70], arp: [70, 74, 77, 82] },
  Gm: { r: 31, s: [55, 58, 62, 67], arp: [67, 70, 74, 79] },
  Eb: { r: 39, s: [55, 58, 63, 67], arp: [67, 70, 75, 79] },
  F: { r: 29, s: [57, 60, 65, 69], arp: [69, 72, 77, 81] },
  Am: { r: 33, s: [57, 60, 64, 69], arp: [69, 72, 76, 81] },
  C: { r: 36, s: [55, 60, 64, 67], arp: [67, 72, 76, 79] },
  G: { r: 31, s: [55, 59, 62, 67], arp: [67, 71, 74, 79] }
};
const STAB_A = [[0, 0.45, 1], [1.5, 0.22, 0.8], [2.5, 0.22, 0.8], [3.5, 0.2, 0.7]];
// the bell hook, four bars (over I - vi - IV - V)
const HOOK = [
  [[0, 77, 0.5], [0.5, 74, 0.25], [0.75, 77, 0.5], [1.5, 79, 0.5], [2, 77, 0.5], [2.5, 74, 0.5], [3, 72, 0.25], [3.25, 74, 0.75]],
  [[0, 70, 0.5], [0.5, 74, 0.25], [0.75, 79, 0.5], [1.5, 77, 0.5], [2, 74, 0.5], [2.5, 70, 0.5], [3, 72, 0.5], [3.5, 74, 0.5]],
  [[0, 75, 0.5], [0.5, 79, 0.25], [0.75, 82, 0.5], [1.5, 79, 0.5], [2, 77, 0.5], [2.5, 75, 0.5], [3, 74, 0.5], [3.5, 72, 0.5]],
  [[0, 72, 0.5], [0.5, 77, 0.25], [0.75, 81, 0.5], [1.5, 84, 1.0], [2.5, 81, 0.5], [3, 77, 0.5], [3.5, 75, 0.5]]
];
// the chorus tune on synth brass (over vi - IV - I - V)
const CHORUS = [
  [[0, 74, 0.75], [0.75, 74, 0.25], [1, 70, 0.5], [1.5, 72, 0.5], [2, 74, 1], [3, 79, 1]],
  [[0, 79, 0.75], [0.75, 77, 0.25], [1, 75, 0.5], [1.5, 74, 0.5], [2, 75, 1], [3, 70, 1]],
  [[0, 74, 0.75], [0.75, 74, 0.25], [1, 77, 0.5], [1.5, 79, 0.5], [2, 82, 1], [3, 81, 0.5], [3.5, 79, 0.5]],
  [[0, 81, 0.75], [0.75, 79, 0.25], [1, 77, 1], [2, 77, 0.5], [2.5, 81, 0.5]]
];
function drums(bar, o) {
  const b0 = bar * 4;
  for (let q = 0; q < 4; q++) {
    ev(b0 + q, I.kick, o.light ? 0.75 : 1);
    if (q % 2 === 1 && !o.noSnare) { ev(b0 + q, I.snare, 0.95); if (o.clap) ev(b0 + q, I.clap, 0.75); }
    ev(b0 + q + 0.5, I.hat, 0.9, q === 3 && !!o.open);
    if (!o.light) { ev(b0 + q + 0.25, I.hat, 0.3); ev(b0 + q + 0.75, I.hat, 0.42); }
  }
}
function octBass(bar, ch, from, to, tr) {
  for (let i = (from || 0) * 4; i < (to === undefined ? 16 : to * 4); i++) {
    ev(bar * 4 + i * 0.25, I.bass, ch.r + (tr || 0) + (i % 2 ? 12 : 0), BEAT * 0.22, i % 4 === 0 ? 1 : 0.72);
  }
}
function stabs(bar, ch, pat, tr, v) { for (const [bt, d, vv] of pat || STAB_A) ev(bar * 4 + bt, I.stab, ch.s.map(n => n + (tr || 0)), d * BEAT, vv * (v || 1)); }
function tune(bar, notes, inst, tr, v, extra) { for (const [bt, n, d] of notes) ev(bar * 4 + bt, inst, n + (tr || 0), d * BEAT, v || 1, ...(extra || [])); }
function sung(beat, n, len, vowel, v) {
  ev(beat, I.voice, n, len * BEAT, v || 1, vowel);
  VOICE.push([beat * BEAT, (beat + len) * BEAT]);
}
function arpeggio(bar, ch, tr, v) {
  for (let i = 0; i < 16; i++) ev(bar * 4 + i * 0.25, I.pluck, ch.arp[i % 4] + (tr || 0) + (i % 8 >= 4 ? 12 : 0), (v || 1) * (i % 4 === 0 ? 1 : 0.7), i % 2 ? 0.45 : -0.45);
}

function buildScore() {
  // ---- bars 0-2: the nocturne (the bait). A slow E-flat piano, a music box doubling the tune.
  const arps = [[39, 46, 55, 58, 62, 58, 55, 46], [36, 43, 51, 55, 58, 55, 51, 43], [44, 51, 55, 60, 63, 60, 55, 51]];
  for (let bar = 0; bar < 3; bar++) for (let i = 0; i < 8; i++) ev(bar * 4 + i * 0.5, I.piano, arps[bar][i], BEAT * 1.2, i === 0 ? 0.8 : 0.55);
  const mel = [[0, 79, 1.5], [1.5, 80, 0.5], [2, 79, 1], [3, 75, 1], [4, 77, 1.5], [5.5, 75, 0.5], [6, 74, 0.5], [6.5, 75, 0.5], [7, 72, 1], [8, 75, 2], [10, 74, 0.5], [10.5, 72, 0.5], [11, 70, 1]];
  for (const [bt, n, d] of mel) { ev(bt, I.piano, n, d * BEAT, 1.0); ev(bt, I.mbox, n + 12, 0.35); }
  // something stirs: bubbles, and plips as the quiff breaks the surface
  for (let i = 0; i < 9; i++) ev(6.4 + i * 0.27 + hash(i) * 0.2, I.bloop, 380 + hash(i * 3.3) * 520, 0.8);
  for (const bt of [8.4, 9.3, 10.2, 11.1]) ev(bt, I.bloop, 260, 0.6);
  // ...the record scratches to a halt. Eyes dart left, right. Eyebrows up.
  ev(12, I.scratch);
  ev(11.85, I.blip, 84); ev(12.65, I.blip, 88);
  ev(13.3, I.ding, 96, 0.8);
  // the drum fill, and he comes flying out of the river
  for (let i = 0; i < 6; i++) ev(14 + i * 0.25, I.snare, 0.35 + i * 0.1);
  [50, 47, 43, 40].forEach((n, i) => ev(15 + i * 0.25, I.tom, n, 0.9));
  ev(14.45, I.splash, 1); ev(14.45, I.whoosh, 0.45, 0.7);
  ev(16, I.splash, 0.5);

  // ---- bars 4-9: under the railway arch, B-flat. Octave bass, gated snare, stabs, bell hook.
  const verse = ['Bb', 'Gm', 'Eb', 'F', 'Bb', 'Gm'];
  ev(16, I.crash, 1);
  for (let k = 0; k < 6; k++) {
    const bar = 4 + k, ch = CHD[verse[k]];
    if (k < 4) drums(bar, { open: true, clap: k >= 2 });
    else drums(bar, { light: true });
    if (k < 5) octBass(bar, ch); else { octBass(bar, ch, 0, 2); octBass(bar, CHD.F, 2, 4); }
    if (k < 4) { stabs(bar, ch); tune(bar, HOOK[k], I.bell, 0, 1, [1, 3]); }
    else ev(bar * 4, I.pad, ch.s, BEAT * 4, 1);
    if (k === 2) for (let q = 0; q < 4; q++) ev(bar * 4 + q, I.snap, 0.9);
  }
  // he sings (wordlessly) into the mic
  const verseTune = [[32.5, 74, 0.5, 'a'], [33, 77, 1, 'o'], [34, 79, 0.5, 'a'], [34.5, 77, 0.5, 'e'], [35, 74, 0.75, 'o'], [35.75, 72, 0.25, 'a'], [36, 74, 1, 'o'], [37, 70, 0.5, 'a'], [37.5, 72, 0.5, 'e']];
  for (const [bt, n, d, vw] of verseTune) sung(bt, n - 12, d, vw);
  ev(38, I.riser, BEAT * 2, 0.9); ev(38.35, I.whoosh, 0.6, 0.8, 0.6);
  for (let i = 0; i < 8; i++) ev(38 + i * 0.25, I.snare, 0.3 + i * 0.09);

  // ---- bars 10-13: the pop-art chorus. Every new grid of prints lands on a crash.
  const chorus = ['Gm', 'Eb', 'Bb', 'F'];
  for (let k = 0; k < 4; k++) {
    const bar = 10 + k, ch = CHD[chorus[k]];
    ev(bar * 4, I.crash, k === 0 ? 1 : 0.7);
    if (k < 3) { drums(bar, { clap: true, open: true }); octBass(bar, ch); stabs(bar, ch); ev(bar * 4, I.pad, ch.s, BEAT * 4, 1); }
    else { // the last bar stops dead on beat 3: freeze-frame
      for (let q = 0; q < 3; q++) { ev(bar * 4 + q, I.kick, 1); if (q === 1) { ev(bar * 4 + q, I.snare, 1); ev(bar * 4 + q, I.clap, 0.8); } ev(bar * 4 + q + 0.5, I.hat, 0.8); }
      octBass(bar, ch, 0, 3); stabs(bar, ch, [[0, 0.45, 1], [1.5, 0.22, 0.8], [2.5, 0.22, 0.8]]); ev(bar * 4, I.pad, ch.s, BEAT * 3, 1);
    }
    tune(bar, CHORUS[k], I.brass, 0, 1);
    tune(bar, CHORUS[k], I.bell, 12, 0.35, [2, 2]);
  }
  ev(55, I.shutter); ev(55.5, I.ding, 100, 0.9);

  // ---- bars 14-17: the theatre. Curtain, spotlight, a walking bass... and a shadow with ideas.
  ev(56, I.swish, 1.2, 1); ev(56.25, I.clunk);
  const walk = [36, 39, 43, 40, 41, 45, 48];
  for (let i = 0; i < 7; i++) {
    const bt = 56 + i;
    ev(bt, I.upright, walk[i], 1);
    if (i % 2 === 1) ev(bt, I.snap, 1);
    ev(bt + 0.66, I.hat, 0.5);
    if (i % 2 === 0) ev(bt, I.kick, 0.55);
  }
  ev(56, I.pad, [60, 63, 67, 70], BEAT * 4, 0.9);
  ev(60, I.pad, [57, 60, 63, 65], BEAT * 3, 0.9);
  // the shadow flosses to its own silly tune
  // the playground taunt, one note per swing of the floss
  const flossT = [72, 69, 74, 72, 69, 72, 69, 74, 72, 69];
  flossT.forEach((n, i) => ev(60 + i * 0.5, I.goofy, n, BEAT * (i % 4 === 3 ? 0.45 : 0.4), 1));
  ev(62.4, I.slide, 67, 84, 0.35, 1);
  // he stares. The band stops. Crickets.
  ev(63.2, I.cricket); ev(63.65, I.cricket);
  // his move: da-da-da-DAH... TAH!
  [[64, 65, 0.25], [64.25, 70, 0.25], [64.5, 74, 0.25], [64.75, 77, 0.6]].forEach(([bt, n, d]) => { ev(bt, I.brass, n, d * BEAT, 1.1); ev(bt, I.snare, 0.6); });
  ev(64, I.kick, 1); ev(64.75, I.kick, 1); ev(65.5, I.brass, 82, BEAT * 0.5, 1.1); ev(65.5, I.crash, 0.6); ev(65.5, I.kick, 1);
  ev(64, I.upright, 34, 1); ev(64.75, I.upright, 41, 1); ev(65.5, I.upright, 46, 1);
  // the shadow answers: an octave down, twice as big, with a cartwheel
  [[66, 53, 0.25], [66.25, 58, 0.25], [66.5, 62, 0.25], [66.75, 65, 0.6]].forEach(([bt, n, d]) => { ev(bt, I.brass, n, d * BEAT, 1.2); ev(bt, I.tom, n - 12, 0.8); });
  for (let i = 0; i < 8; i++) ev(66.3 + i * 0.14, I.timp, 38, 0.35 + i * 0.05);
  ev(66.35, I.whoosh, 0.7, 1, 0.8);
  ev(67.55, I.crash, 1); ev(67.55, I.kick, 1); ev(67.55, I.stab, [58, 62, 65, 70, 74], BEAT * 0.5, 1.1);
  // friends again
  const walk2 = [43, 46, 50, 48];
  for (let i = 0; i < 4; i++) {
    const bt = 68 + i;
    ev(bt, I.upright, i < 2 ? walk2[i] : [43, 47][i - 2], 1);
    ev(bt, I.kick, 0.8); if (i % 2 === 1) { ev(bt, I.snare, 0.8); ev(bt, I.snap, 0.8); }
    ev(bt + 0.5, I.hat, 0.7);
  }
  ev(68, I.stab, [55, 58, 62, 65], BEAT * 0.4, 0.8); ev(69.5, I.stab, [55, 58, 62, 65], BEAT * 0.3, 0.7);
  // the hat tip, then up we go: key change
  ev(70.55, I.ding, 91, 0.8); ev(70.8, I.ding, 96, 0.8);
  ev(70, I.pad, [53, 59, 62, 67], BEAT * 2, 1);
  ev(70, I.riser, BEAT * 1.9, 1);
  ev(71.5, I.whoosh, 0.9, 0.9, -0.7);
  for (let i = 0; i < 8; i++) ev(70 + i * 0.25, I.snare, 0.25 + i * 0.08);

  // ---- bars 18-24: the starry night, up a whole tone to C. Everything, plus a sparkling arpeggio.
  const fin = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C'];
  ev(72, I.crash, 1);
  for (let k = 0; k < 7; k++) {
    const bar = 18 + k, ch = CHD[fin[k]];
    const tr = fin[k] === 'F' ? 0 : 0;
    const quiet = k === 5;
    drums(bar, { clap: !quiet, open: true, light: quiet });
    if (k < 6) octBass(bar, ch, 0, 4, tr);
    else { octBass(bar, CHD.C, 0, 2); octBass(bar, CHD.G, 2, 4); }
    if (k < 6) stabs(bar, ch, STAB_A, 0, quiet ? 0.6 : 1);
    else { stabs(bar, CHD.C, [[0, 0.45, 1], [1.5, 0.22, 0.8]]); stabs(bar, CHD.G, [[2, 0.3, 0.9], [3.5, 0.2, 0.8]]); }
    if (k < 6) ev(bar * 4, I.pad, ch.s, BEAT * 4, 1);
    else { ev(bar * 4, I.pad, CHD.C.s, BEAT * 2, 1); ev(bar * 4 + 2, I.pad, CHD.G.s, BEAT * 2, 1); }
    if (k < 6) arpeggio(bar, ch, 0, 0.9);
    else for (let i = 0; i < 16; i++) { const c2 = i < 8 ? CHD.C : CHD.G; ev(bar * 4 + i * 0.25, I.pluck, c2.arp[i % 4] + (i % 8 >= 4 ? 12 : 0), 0.9 * (i % 4 === 0 ? 1 : 0.7), i % 2 ? 0.45 : -0.45); }
    if (k < 4) { tune(bar, CHORUS[k], I.brass, 2, 1); tune(bar, CHORUS[k], I.bell, 14, 0.35, [2, 2]); }
    if (k === 4) { tune(bar, CHORUS[0], I.brass, 2, 0.9); }
  }
  // disco points: each one pings a star
  for (const bt of [80, 82]) ev(bt + 0.1, I.ding, 100, 0.7);
  // the lasso: whooshes swinging round the stereo field
  for (let i = 0; i < 3; i++) ev(84.45 + i, I.whoosh, BEAT * 0.95, 0.8, i % 2 ? -0.8 : 0.8);
  // he sings once more, over F
  const lastTune = [[92.5, 72, 0.5, 'a'], [93, 77, 1, 'o'], [94, 79, 0.5, 'a'], [94.5, 77, 0.5, 'e'], [95, 76, 0.75, 'o'], [95.75, 74, 0.25, 'a']];
  for (const [bt, n, d, vw] of lastTune) sung(bt, n - 12, d, vw);
  // the last phrase, a shooting star and a wink
  [[96, 76, 0.75], [96.75, 74, 0.25], [97, 72, 0.5], [97.5, 74, 0.5], [98, 76, 1], [99, 79, 0.5], [99.5, 83, 0.5]].forEach(([bt, n, d]) => ev(bt, I.brass, n, d * BEAT, 1.05));
  [96.95, 97.05, 97.15, 97.25, 97.35].forEach((bt, i) => ev(bt, I.bell, 100 - i * 3, 0.2, 0.6, 3.5, 1.5));
  ev(98.1, I.ding, 103, 0.7);
  for (let i = 0; i < 4; i++) ev(99 + i * 0.25, I.tom, [52, 48, 45, 40][i], 0.9);
  // ---- bar 25: TA-DA
  ev(100, I.crash, 1.1); ev(100, I.kick, 1.1); ev(100, I.timp, 36, 1);
  ev(100, I.stab, [48, 60, 64, 67, 72, 76], BEAT * 2.5, 1.2);
  ev(100, I.pad, [60, 64, 67, 72], BEAT * 7, 1.2);
  ev(100, I.brass, 84, BEAT * 3, 1.1); ev(100, I.brass, 79, BEAT * 3, 0.8);
  ev(100, I.bass, 36, BEAT * 3, 1); ev(100, I.bell, 96, BEAT * 2, 0.6, 1, 3);
  // ---- bars 26-29: the gallery. Polite applause for the bow; brushes deface the label;
  // a rimshot for the wink; a music box and the nocturne's piano lead home to the top.
  ev(104.2, I.applause, 2.4, 0.9);
  ev(106.6, I.brush, 1.1);
  [107.1, 107.45, 107.8, 108.15, 108.5].forEach((bt, i) => ev(bt, I.brush, 0.9 - i * 0.08));
  ev(109.3, I.tom, 50, 0.9); ev(109.55, I.tom, 45, 1); ev(109.62, I.kick, 0.9); ev(109.8, I.crash, 0.55); ev(109.8, I.hat, 1, true);
  [[110, 79], [110.5, 82], [111, 84], [111.5, 82]].forEach(([bt, n]) => ev(bt, I.mbox, n, 0.8));
  ev(112, I.brush, 1.1); ev(112.4, I.brush, 0.9); ev(112.8, I.brush, 0.7);
  const codaBox = [[112, 84], [113, 82], [114, 79], [115, 77], [116, 80], [117, 79], [118, 77], [119, 74]];
  for (const [bt, n] of codaBox) ev(bt, I.mbox, n, 0.9);
  const codaArp = [[112, [44, 51, 60, 51]], [114, [43, 50, 58, 50]], [116, [41, 48, 56, 48]], [118, [46, 53, 62, 56]]];
  for (const [b0, ns] of codaArp) ns.forEach((n, i) => ev(b0 + i * 0.5, I.piano, n, BEAT * 1.2, 0.5));
  [[112, 72], [114, 70], [116, 68], [118, 65]].forEach(([bt, n]) => ev(bt + 1, I.piano, n, BEAT * 1.4, 0.45));

  SCORE.sort((a, b) => a.t - b.t);
}
buildScore();

// Beat-accurate hit lists for the picture: lights, stars and camera answer the drums.
const HITS = { kick: [], snare: [], hat: [], crash: [], clap: [], pluck: [], snap: [] };
for (const e of SCORE) {
  const k = e.fn === I.kick ? 'kick' : e.fn === I.snare ? 'snare' : e.fn === I.hat ? 'hat' : e.fn === I.crash ? 'crash' : e.fn === I.clap ? 'clap' : e.fn === I.pluck ? 'pluck' : e.fn === I.snap ? 'snap' : null;
  const v = k === 'pluck' ? e.a[1] : e.a[0];     // (a pluck's first argument is its note)
  if (k) HITS[k].push([e.t, typeof v === 'number' ? v : 1]);
}
// every hit of a kind in the last `span` seconds: [[age, strength, index], ...]
function recentHits(kind, t, span) {
  const L = HITS[kind], out = [];
  let lo = 0, hi = L.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m][0] <= t + 1e-4) { k = m; lo = m + 1; } else hi = m - 1; }
  for (let i = k; i >= 0 && t - L[i][0] < span; i--) out.push([t - L[i][0], L[i][1], i]);
  return out;
}
// strength of the most recent hit of a kind, decaying with time constant `decay` (s)
function hitPulse(kind, t, decay) {
  const L = HITS[kind];
  let lo = 0, hi = L.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m][0] <= t + 1e-4) { k = m; lo = m + 1; } else hi = m - 1; }
  if (k < 0) return 0;
  return L[k][1] * Math.exp(-(t - L[k][0]) / decay);
}

// his mouth, following whatever he is singing
function voiceMouth(t) {
  for (const [a, e] of VOICE) {
    if (t >= a - 0.03 && t <= e + 0.08) {
      const k = smoothstep(a - 0.03, a + 0.04, t) * (1 - smoothstep(e - 0.02, e + 0.08, t));
      const syl = 0.62 + 0.38 * Math.abs(Math.sin(Math.PI * (t - a) / (BEAT * 0.5)));
      return 0.18 + 0.72 * k * syl;
    }
  }
  return 0.12;
}

// ---------------------------------------------------------------- transport
// Piece time t is ctxTime - t0. Events are scheduled a quarter of a second ahead.
function audioStart(pieceNow) {
  if (!AUDIO.ctx && !audioSetup()) return false;
  const ctx = AUDIO.ctx;
  if (ctx.state === 'suspended') ctx.resume();
  audioAnchor(pieceNow);
  AUDIO.running = true;
  // the title lifts off and the canvas is painted: a brush sweep and a soft chord
  const now = ctx.currentTime;
  I.brush(now + 0.08, 1.2);
  [63, 67, 70, 74].forEach((n, i) => I.mbox(AUDIO.t0 - 1.5 + i * 0.12, n + 12, 0.7));
  audioPump();
  return true;
}
// line the score up so that piece time `pieceNow` is heard now; skip anything already past
function audioAnchor(pieceNow) {
  const ctx = AUDIO.ctx;
  AUDIO.t0 = ctx.currentTime - pieceNow;
  const tp = pieceNow < 0 ? pieceNow : modT(pieceNow);
  AUDIO.loop = pieceNow < 0 ? 0 : Math.floor(pieceNow / DUR);
  let i = 0;
  while (i < SCORE.length && SCORE[i].t < tp - 1e-6) i++;
  if (i >= SCORE.length) { i = 0; AUDIO.loop++; }
  AUDIO.idx = i;
}
function audioPump() {
  if (!AUDIO.running) return;
  const ctx = AUDIO.ctx, now = ctx.currentTime, horizon = now + 0.25;
  for (let guard = 0; guard < 4000; guard++) {
    const e = SCORE[AUDIO.idx];
    const when = AUDIO.t0 + AUDIO.loop * DUR + e.t;
    if (when > horizon) break;
    if (when > now - 0.03) { try { e.fn(Math.max(when, now), ...e.a); } catch (err) { /* keep the band playing */ } }
    AUDIO.idx++;
    if (AUDIO.idx >= SCORE.length) { AUDIO.idx = 0; AUDIO.loop++; }
  }
}
function audioPieceTime() {
  const ctx = AUDIO.ctx;
  let ct = ctx.currentTime;
  if (ctx.getOutputTimestamp) {
    const ts = ctx.getOutputTimestamp();
    if (ts && ts.contextTime > 0) ct = ts.contextTime + Math.max(0, (performance.now() - ts.performanceTime) / 1000);
  }
  return ct - AUDIO.t0;
}
function audioMute(m) {
  if (!AUDIO.ctx) return;
  AUDIO.muted = m;
  AUDIO.master.gain.setTargetAtTime(m ? 0 : 0.8, AUDIO.ctx.currentTime, 0.05);
}
setInterval(audioPump, 50);
