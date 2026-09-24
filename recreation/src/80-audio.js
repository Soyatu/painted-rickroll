// ============================================================================
// The score: an original piece synthesised live in WebAudio (no samples).
// A piano nocturne in F, a record scratch, then 80s synth-pop in D minor,
// a theatre shuffle, a key change up to E minor for the starry night, a
// brass ta-da, and the piano again in the gallery. The picture reads the same
// event list: lights, stars and the camera follow the actual drum hits.
// ============================================================================
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = (() => {
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return s => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    return 12 * (parseInt(m[3], 10) + 1) + base[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
})();
const Ns = str => str.split(' ').map(NOTE);

// ---------------------------------------------------------------- the event list
const SCORE = { events: [], lead: [], hits: { kick: [], snare: [], hat: [], crash: [], snap: [], tom: [], piano: [] } };
const HIT_OF = { kick: 'kick', snare: 'snare', clap: 'snare', rim: 'snare', hat: 'hat', crash: 'crash', snap: 'snap', tom: 'tom' };
function ev(b, inst, a) {
  a = a || {};
  SCORE.events.push({ b, t: b * BEAT, inst, a });
  const k = HIT_OF[inst];
  if (k) SCORE.hits[k].push(b * BEAT);
  if (inst === 'piano' && a.mel) SCORE.hits.piano.push(b * BEAT);
  if (inst === 'lead' && b >= 32 && b < 40) SCORE.lead.push({ b, d: a.d });
}

(function buildScore() {
  // --- chords and their voicings
  const V = {
    Fmaj9: { arp: Ns('F2 C3 G3 A3 E4 A3 G3 C3') }, Dm9: { arp: Ns('D2 A2 E3 F3 C4 F3 E3 A2') },
    Bbmaj7: { arp: Ns('Bb1 F2 D3 A3') }, C7sus4: { arp: Ns('C2 G2 F3 Bb3') }, C7: { arp: Ns('C2 G2 E3 Bb3') }
  };
  const piano = (b, n, d, v, mel) => ev(b, 'piano', { m: n, d, v, mel });
  const nocturneBar = (bar, chords, mel, vel) => {
    const b0 = bar * 4;
    let k = 0;
    for (const [ch, beats] of chords) {
      const arp = V[ch].arp;
      for (let i = 0; i < beats * 2; i++) piano(b0 + k * 0.5, arp[i % arp.length], 1.6, (i === 0 ? 0.42 : 0.3) * vel);
      k += beats * 2;
    }
    for (const [bb, n, d, v] of mel) piano(b0 + bb, NOTE(n), d, (v || 0.5) * vel, true);
  };
  // bars 0-2: the nocturne
  nocturneBar(0, [['Fmaj9', 4]], [[1, 'C5', 1.5], [2.5, 'A4', 0.5], [3, 'G4', 1]], 1);
  nocturneBar(1, [['Dm9', 4]], [[0, 'F4', 1.5], [1.5, 'E4', 0.5], [2, 'D4', 1], [3, 'A4', 1]], 1);
  nocturneBar(2, [['Bbmaj7', 2], ['C7sus4', 2]], [[0, 'D5', 1], [1, 'C5', 0.5], [1.5, 'Bb4', 0.5], [2, 'C5', 2, 0.55]], 1);
  ev(8, 'pad', { ns: Ns('A3 C4 E4 G4'), d: 4, v: 0.1 }); ev(8, 'pad', { ns: Ns('D3 F3 A3'), d: 8, v: 0.06 });
  // bar 3: the scratch, bubbles in the silence, a drum fill
  ev(12, 'scratch', { v: 0.8 });
  for (const b of [12.6, 12.95, 13.3, 13.5]) ev(b, 'bloop', { v: 0.35 });
  ev(14, 'tom', { f: 190, v: 0.8 }); ev(14.5, 'tom', { f: 150, v: 0.85 }); ev(14.75, 'tom', { f: 150, v: 0.6 });
  ev(15, 'tom', { f: 115, v: 0.9 }); ev(15.25, 'tom', { f: 115, v: 0.7 });
  for (let i = 0; i < 6; i++) ev(15.5 + i * 0.0833, 'snare', { v: 0.4 + i * 0.09, roll: true });
  ev(14.5, 'swell', { d: 1.5, v: 0.5 });

  // --- the groove: drum patterns
  const four = (bar, o) => {
    o = o || {};
    const b0 = bar * 4;
    for (let i = 0; i < 4; i++) ev(b0 + i, 'kick', { v: 0.95 });
    if (o.kick2) ev(b0 + 2.5, 'kick', { v: 0.55 });
    for (const bb of [1, 3]) {
      if (!o.noSnare) ev(b0 + bb, 'snare', { v: 0.8 });
      if (o.clap) ev(b0 + bb, 'clap', { v: 0.65 });
      if (o.snap) ev(b0 + bb, 'snap', { v: 0.8, pan: bb === 1 ? -0.3 : 0.3 });
    }
    for (let i = 0; i < 16; i++) {
      const bb = b0 + i * 0.25;
      if (i % 4 === 2) ev(bb, 'hat', { v: 0.42, open: i === 14 });
      else if (o.hat16 || i % 2 === 0) ev(bb, 'hat', { v: i % 4 === 0 ? 0.22 : 0.14 });
    }
  };
  const bassBar = (bar, roots, pat, v) => {
    const b0 = bar * 4;
    roots.forEach(([bb, r, len]) => {
      for (let i = 0; i < len * 2; i++) {
        const st = b0 + bb + i * 0.5;
        const step = pat[(Math.round((bb + i * 0.5) * 2)) % pat.length];
        ev(st, 'bass', { m: r + step, d: 0.42, v: (v || 0.6) * (i % 2 ? 0.8 : 1) });
      }
    });
  };
  const OCT = [0, 12, 0, 12, 0, 12, 0, 12], OCT2 = [0, 12, 0, 12, 0, 12, 10, 12];
  const stabs = (bar, ns, times, d, v) => times.forEach(bb => ev(bar * 4 + bb, 'stab', { ns, d: d || 0.3, v: v || 0.3 }));
  const pad = (b, ns, d, v) => ev(b, 'pad', { ns, d, v: v || 0.16 });

  // bars 4-9 (D minor): the arch
  const G_CH = [Ns('A3 C4 D4 F4'), Ns('A3 Bb3 D4 F4'), Ns('G3 Bb3 D4 F4'), Ns('G3 A3 D4 E4'), Ns('A3 C4 D4 F4'), Ns('Bb3 D4 F4')];
  const G_RT = [NOTE('D2'), NOTE('Bb1'), NOTE('G1'), NOTE('A1'), NOTE('D2'), NOTE('Bb1')];
  ev(16, 'splash', { v: 0.9 }); ev(16, 'crash', { v: 0.8 });
  for (const b of [16.45, 16.95, 17.45]) ev(b, 'scrape', { v: 0.45 });
  for (let k = 0; k < 6; k++) {
    const bar = 4 + k;
    four(bar, { clap: bar !== 6, snap: bar === 6, noSnare: bar === 6, kick2: k % 2 === 1, hat16: bar >= 7 });
    if (bar === 7) {
      bassBar(bar, [[0, G_RT[k], 2], [2, G_RT[k], 2]], OCT2, 0.6);
      pad(bar * 4, Ns('G3 A3 D4 E4'), 2); pad(bar * 4 + 2, Ns('G3 A3 C#4 E4'), 2);
      // the arm rolls: a rolling sixteenth arpeggio
      const roll = Ns('A3 D4 E4 G4 A4 G4 E4 D4'), roll2 = Ns('A3 C#4 E4 G4 A4 G4 E4 C#4');
      for (let i = 0; i < 16; i++) ev(bar * 4 + i * 0.25, 'pluck', { m: (i < 8 ? roll : roll2)[i % 8] + 12, d: 0.22, v: 0.24 });
    } else if (bar === 9) {
      bassBar(bar, [[0, NOTE('Bb1'), 2], [2, NOTE('C2'), 2]], OCT, 0.6);
      pad(bar * 4, Ns('Bb3 D4 F4'), 2, 0.18); pad(bar * 4 + 2, Ns('C4 E4 G4'), 2, 0.2);
    } else {
      bassBar(bar, [[0, G_RT[k], 4]], k % 2 ? OCT2 : OCT, 0.6);
      pad(bar * 4, G_CH[k], 4);
    }
    if (bar !== 9) stabs(bar, bar === 7 ? Ns('G4 A4 D5 E5') : G_CH[k].map(n => n + 12), [0.5, 2.5], 0.25, 0.22);
  }
  // bar 8: he sings (an original tune on a vowel-like lead)
  const sing = [[32, 'A4', 0.5], [32.5, 'D5', 0.5], [33, 'F5', 0.75], [33.75, 'E5', 0.25], [34, 'D5', 0.5], [34.5, 'C5', 0.5], [35, 'D5', 1]];
  for (const [b, n, d] of sing) ev(b, 'lead', { m: NOTE(n), d, v: 0.34 });
  // bar 9: the skater's spin: a held high note, a riser, a snare build, the whip
  ev(36, 'lead', { m: NOTE('A5'), d: 1.8, v: 0.3, slide: true });
  for (const [b, n] of [[38, 'G5'], [38.25, 'F5'], [38.5, 'E5'], [38.75, 'D5'], [39, 'C5']]) ev(b, 'lead', { m: NOTE(n), d: 0.25, v: 0.26 });
  ev(36, 'riser', { d: 3.5, v: 0.35 });
  for (let i = 0; i < 12; i++) ev(37 + i * 0.25, 'snare', { v: 0.3 + i * 0.04, roll: true });
  ev(39.55, 'whoosh', { d: 0.9, v: 0.6, p0: -0.8, p1: 0.8 });

  // bars 10-13 (D minor): the pop-art prints, each crash doubling the grid
  const P_CH = [Ns('A3 C4 D4 F4'), Ns('A3 C4 F4'), Ns('G3 Bb3 D4 F4'), Ns('G3 A3 C#4 E4')];
  const P_RT = [NOTE('D2'), NOTE('C2'), NOTE('G1'), NOTE('A1')];
  const hook = [
    [[0, 'D5', 0.25], [0.5, 'F5', 0.25], [1, 'A5', 0.5], [1.5, 'G5', 0.25], [2, 'F5', 0.25], [2.5, 'E5', 0.5], [3, 'D5', 0.5], [3.5, 'E5', 0.25]],
    [[0, 'F5', 0.25], [0.5, 'A5', 0.25], [1, 'C6', 0.5], [1.5, 'A5', 0.25], [2, 'G5', 0.5], [3, 'E5', 0.5]],
    [[0, 'G5', 0.25], [0.5, 'Bb5', 0.25], [1, 'D6', 0.5], [1.5, 'C6', 0.25], [2, 'Bb5', 0.25], [2.5, 'A5', 0.5], [3, 'G5', 0.5]],
    [[0, 'A5', 0.75], [1, 'G5', 0.25], [1.5, 'F5', 0.25], [2, 'E5', 0.5]]
  ];
  for (let k = 0; k < 4; k++) {
    const bar = 10 + k, b0 = bar * 4;
    ev(b0, 'print', { v: 0.6 });
    if (k > 0) ev(b0, 'crash', { v: 0.75 });
    const stop = k === 3 ? 2.5 : 4;
    for (let i = 0; i < stop; i++) ev(b0 + i, 'kick', { v: 0.95 });
    for (const bb of [1, 3]) if (bb < stop) { ev(b0 + bb, 'snare', { v: 0.8 }); ev(b0 + bb, 'clap', { v: 0.6 }); }
    for (let i = 0; i < stop * 4; i++) if (i % 2 === 0 || i % 4 === 3) ev(b0 + i * 0.25, 'hat', { v: i % 4 === 2 ? 0.4 : 0.16, open: i === 14 });
    for (let i = 0; i < stop * 2; i++) ev(b0 + i * 0.5, 'bass', { m: P_RT[k] + (i % 2 ? 12 : 0), d: 0.3, v: 0.58 });
    for (const bb of [0, 0.75, 1.5, 2.5, 3.25]) if (bb < stop) ev(b0 + bb, 'stab', { ns: P_CH[k].map(n => n + 12), d: 0.18, v: 0.24 });
    pad(b0, P_CH[k], stop * 0.9, 0.12);
    for (const [bb, n, d] of hook[k]) if (bb < stop) ev(b0 + bb, 'pluck', { m: NOTE(n), d, v: 0.3, bright: true });
  }
  // the freeze, the wink, the curtains
  ev(55.0, 'bell', { m: 96, v: 0.35 });
  ev(55.55, 'whoosh', { d: 0.9, v: 0.45, p0: 0, p1: 0, low: true });

  // bars 14-17 (D minor): the theatre shuffle, a walking bass, rimshots, snaps
  ev(56.0, 'whoosh', { d: 1.2, v: 0.35, p0: 0, p1: 0, low: true });
  ev(57.0, 'clunk', { v: 0.8 });
  const walk = [Ns('D2 F2 A2 C#3'), Ns('D3 C3 A2 F2'), Ns('Bb1 D2 F2 A2'), Ns('A1 C#2 E2 G2')];
  const T_CH = [Ns('F3 A3 D4'), Ns('E3 A3 C4'), Ns('F3 A3 D4'), Ns('G3 C#4 E4')];
  for (let k = 0; k < 4; k++) {
    const bar = 14 + k, b0 = bar * 4;
    const from = bar === 14 ? 1 : 0;
    for (let i = from; i < 4; i++) ev(b0 + i, 'upright', { m: walk[k][i], d: 0.9, v: 0.7 });
    for (let i = from; i < 4; i++) {
      if (i % 2 === 0) ev(b0 + i, 'kick', { v: 0.7 });
      else ev(b0 + i, 'rim', { v: 0.55 });
      ev(b0 + i + 0.5, 'brush', { d: 0.4, v: 0.3 });
      ev(b0 + i + 0.66, 'hat', { v: 0.12 });
    }
    if (bar === 15) for (const bb of [0.5, 1.5, 2.5, 3.5]) ev(b0 + bb, 'snap', { v: 0.7, pan: 0.4 });
    if (bar !== 14 || true) for (const bb of [1.66, 3.66]) if (b0 + bb > 57) ev(b0 + bb, 'stab', { ns: T_CH[k], d: 0.2, v: 0.15, soft: true });
    pad(b0, T_CH[k].map(n => n - 12), 4, 0.07);
  }
  // cartwheels, the hat, the pat on the head, the build into the whirlpool
  for (const b of [64.15, 66.15]) { ev(b, 'whoosh', { d: 1.6, v: 0.5, p0: b < 65 ? -0.6 : 0.6, p1: b < 65 ? 0.6 : -0.6 }); ev(b + 1.2, 'tom', { f: 170, v: 0.5 }); ev(b + 1.45, 'tom', { f: 130, v: 0.55 }); }
  ev(70.0, 'bell', { m: 100, v: 0.3 });
  for (const b of [70.3, 70.55, 70.8, 71.05]) ev(b, 'block', { v: 0.5 });
  ev(70.6, 'swell', { d: 1.4, v: 0.55 });
  for (let i = 0; i < 16; i++) ev(71 + i * 0.0625, 'snare', { v: 0.25 + i * 0.035, roll: true });

  // bars 18-25 (E minor, a whole step up): the starry night
  const S_CH = [Ns('B3 D4 E4 G4'), Ns('B3 C4 E4 G4'), Ns('A3 C4 E4 G4'), Ns('A3 B3 E4 F#4'), Ns('B3 D4 E4 G4'), Ns('B3 C4 E4 G4'), Ns('A3 C4 E4 G4'), Ns('G#3 B3 E4')];
  const S_RT = [NOTE('E2'), NOTE('C2'), NOTE('A1'), NOTE('B1'), NOTE('E2'), NOTE('C2'), NOTE('A1'), NOTE('E2')];
  const melody = [
    [[0, 'B4', 1], [1, 'E5', 0.5], [1.5, 'F#5', 0.5], [2, 'G5', 1], [3, 'F#5', 0.5], [3.5, 'E5', 0.5]],
    [[0, 'E5', 1.5], [1.5, 'D5', 0.5], [2, 'C5', 1], [3, 'B4', 1]],
    [[0, 'A4', 0.5], [0.5, 'C5', 0.5], [1, 'E5', 1], [2, 'G5', 1], [3, 'A5', 1]],
    [[0, 'B5', 2], [2, 'A5', 0.5], [2.5, 'G5', 0.5], [3, 'F#5', 1]],
    [[0, 'B5', 1, 1], [1, 'G5', 0.5], [1.5, 'A5', 0.5], [2, 'B5', 1, 1], [3, 'A5', 0.5], [3.5, 'G5', 0.5]],
    [[0, 'G5', 1, 1], [1, 'E5', 0.5], [1.5, 'F#5', 0.5], [2, 'G5', 1, 1], [3, 'F#5', 0.5], [3.5, 'E5', 0.5]],
    [[0, 'E5', 0.5], [0.5, 'F#5', 0.5], [1, 'G5', 0.5], [1.5, 'A5', 0.5], [2, 'B5', 1], [3, 'D6', 1]],
    []
  ];
  ev(72, 'crash', { v: 0.9 });
  for (let k = 0; k < 8; k++) {
    const bar = 18 + k, b0 = bar * 4;
    if (bar === 25) break;
    four(bar, { clap: true, hat16: true, kick2: k % 2 === 1 });
    if (bar === 24) {
      bassBar(bar, [[0, NOTE('A1'), 2], [2, NOTE('D2'), 2]], OCT, 0.62);
      pad(b0, Ns('A3 C4 E4 G4'), 2, 0.18); pad(b0 + 2, Ns('A3 D4 F#4'), 2, 0.2);
      for (let i = 0; i < 8; i++) ev(b0 + 2 + i * 0.25, 'snare', { v: 0.3 + i * 0.06, roll: true });
      ev(b0 + 2, 'swell', { d: 2, v: 0.5 });
    } else if (bar === 21) {
      bassBar(bar, [[0, S_RT[k], 4]], OCT2, 0.62);
      pad(b0, S_CH[k], 2); pad(b0 + 2, Ns('A3 B3 D#4 F#4'), 2);
      ev(b0 + 3, 'tom', { f: 200, v: 0.6 }); ev(b0 + 3.25, 'tom', { f: 160, v: 0.65 }); ev(b0 + 3.5, 'tom', { f: 125, v: 0.7 }); ev(b0 + 3.75, 'tom', { f: 100, v: 0.75 });
    } else {
      bassBar(bar, [[0, S_RT[k], 4]], k % 2 ? OCT2 : OCT, 0.62);
      pad(b0, S_CH[k], 4);
    }
    if (bar === 22) ev(b0, 'crash', { v: 0.7 });
    // the sky flows: sixteenth arpeggios through a ping-pong delay
    const ch = bar === 24 ? Ns('A4 C5 E5 G5') : S_CH[k].map(n => n + 12);
    for (let i = 0; i < 16; i++) {
      const up = [0, 1, 2, 3, 2, 1, 2, 3];
      ev(b0 + i * 0.25, 'pluck', { m: ch[up[i % 8] % ch.length] + (i >= 8 ? 12 : 0), d: 0.2, v: 0.15, echo: true });
    }
    for (const [bb, n, d, sl] of melody[k]) ev(b0 + bb, 'lead', { m: NOTE(n), d, v: 0.32, slide: !!sl });
    stabs(bar, S_CH[k].map(n => n + 12), [1.5, 3.5], 0.2, 0.14);
  }
  // the lasso: a whoosh on every turn, swinging left to right
  for (let b = 88; b < 96; b++) ev(b + 0.5, 'whoosh', { d: 0.9, v: 0.22, p0: Math.sin(b) * 0.6, p1: -Math.sin(b) * 0.6 });
  // bar 25: ta-da
  ev(99, 'swell', { d: 1, v: 0.5 });
  ev(100, 'kick', { v: 1 }); ev(100, 'crash', { v: 1 }); ev(100, 'timp', { m: NOTE('E2'), v: 0.9 });
  ev(100, 'brass', { ns: Ns('E4 G#4 B4 E5'), d: 0.22, v: 0.5 });
  ev(100.5, 'brass', { ns: Ns('E4 G#4 B4 E5 G#5'), d: 3.2, v: 0.55, swell: true });
  ev(100.5, 'bass', { m: NOTE('E1'), d: 3, v: 0.55 });
  ev(100.5, 'pad', { ns: Ns('E3 B3 E4 G#4'), d: 3.4, v: 0.14 });

  // bars 26-29: the gallery, the nocturne again
  nocturneBar(26, [['Fmaj9', 4]], [[1, 'C5', 1.5], [2.5, 'A4', 0.5], [3, 'G4', 1]], 0.95);
  nocturneBar(27, [['Dm9', 4]], [[0, 'F4', 1.5], [1.5, 'E4', 0.5], [2, 'D4', 1], [3, 'A4', 1]], 0.95);
  nocturneBar(28, [['Bbmaj7', 4]], [[0, 'D5', 1], [1, 'C5', 0.5], [1.5, 'Bb4', 0.5], [2, 'A4', 2]], 0.95);
  nocturneBar(29, [['C7sus4', 2], ['C7', 2]], [[0, 'G4', 1.5], [1.5, 'F4', 0.5], [2, 'E4', 1], [3, 'G4', 1]], 0.95);
  ev(104, 'pad', { ns: Ns('F3 A3 C4 E4'), d: 8, v: 0.06 }); ev(112, 'pad', { ns: Ns('F3 Bb3 D4'), d: 8, v: 0.06 });
  ev(107.6, 'laugh', { v: 0.45 }); ev(109.4, 'laugh', { v: 0.32, k: 1 });

  SCORE.events.sort((a, b) => a.t - b.t);
  for (const k in SCORE.hits) SCORE.hits[k].sort((a, b) => a - b);
})();

// sum of the decaying envelopes of the last few hits of one kind at time t (s)
function hitEnv(kind, t, decay) {
  const H = SCORE.hits[kind];
  if (!H || !H.length) return 0;
  t = mod(t, DUR);
  let e = 0;
  // hits near the end of the loop still ring into its start
  const tail = H[H.length - 1] - DUR;
  if (t - tail < decay * 6) e += Math.exp(-(t - tail) / decay);
  if (t < H[0]) return e;
  let lo = 0, hi = H.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (H[m] <= t) lo = m; else hi = m - 1; }
  for (let i = lo; i >= 0 && i > lo - 4; i--) e += Math.exp(-(t - H[i]) / decay);
  return e;
}

// ---------------------------------------------------------------- shared resources per audio context
function makeNoise(ctx, sec) {
  const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  const r = rng(4242);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  return buf;
}
function makeIR(ctx, sec, decay, gated) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec), buf = ctx.createBuffer(2, n, sr);
  const r = rng(gated ? 11 : 7);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env = gated ? (t < sec - 0.03 ? 1 : (sec - t) / 0.03) * (0.8 + 0.2 * Math.exp(-t / 0.05)) : Math.exp(-t / decay);
      if (!gated && t < 0.08) env *= 0.6 + 0.8 * (r() < 0.004 ? 1 : 0);
      const x = (r() * 2 - 1) * env;
      const k = gated ? 0.6 : 0.2 + 0.75 * Math.exp(-t / 0.6);
      lp += (x - lp) * k;
      d[i] = lp;
    }
  }
  return buf;
}
// a record scratch: the chord that was playing, dragged back and forth under the needle
function makeScratch(ctx) {
  const sr = ctx.sampleRate, sec = 0.9, n = Math.floor(sr * sec), buf = ctx.createBuffer(2, n, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const fs = Ns('C4 G4 Bb4 F5').map(mtof);
  const rate = t => t < 0.04 ? 1 : t < 0.11 ? -2.6 : t < 0.17 ? 3.2 : t < 0.24 ? -2.4 : t < 0.3 ? 2.8 : t < 0.36 ? -1.6 : Math.max(0, 1.1 - (t - 0.36) * 2.4);
  const r = rng(99);
  let p = 0.3, bp1 = 0, bp2 = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, rt = rate(t);
    p += rt / sr;
    let s = 0;
    for (let k = 0; k < fs.length; k++) for (let h = 1; h <= 3; h++) s += Math.sin(TAU * fs[k] * h * p) / (h * 1.6);
    s *= 0.12;
    // friction: noise that brightens with the speed of the hand
    const x = r() * 2 - 1;
    const f = 0.05 + 0.25 * Math.min(1, Math.abs(rt) / 3);
    bp1 += (x - bp1) * f; bp2 += (bp1 - bp2) * f;
    const hiss = (bp1 - bp2) * Math.min(1, Math.abs(rt)) * 1.4;
    const env = t < 0.005 ? t / 0.005 : 1 - sstep(0.5, 0.88, t);
    lp += (s - lp) * 0.6;
    const v = (lp * Math.min(1.2, Math.abs(rt) * 0.6 + 0.2) + hiss) * env;
    L[i] = v; R[i] = v * 0.92 + hiss * 0.1;
  }
  return buf;
}
// a body bursting out of a river: a slap, a rush of water, droplets
function makeSplash(ctx) {
  const sr = ctx.sampleRate, sec = 1.6, n = Math.floor(sr * sec), buf = ctx.createBuffer(2, n, sr);
  const r = rng(5);
  const drops = [];
  for (let i = 0; i < 46; i++) drops.push({ t: 0.05 + Math.pow(r(), 1.6) * 1.3, f0: 600 + r() * 900, f1: 1400 + r() * 1600, d: 0.012 + r() * 0.02, a: 0.08 + r() * 0.12, pan: r() });
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = t < 0.006 ? t / 0.006 : Math.exp(-t / 0.28) * 0.8 + Math.exp(-t / 0.05) * 0.4;
      const k = 0.05 + 0.5 * Math.exp(-t / 0.15);
      lp += ((r() * 2 - 1) - lp) * k; lp2 += (lp - lp2) * 0.5;
      let s = lp2 * env * 1.4;
      s += Math.sin(TAU * (90 * t - 55 * t * t)) * Math.exp(-t / 0.09) * 0.6;
      for (const q of drops) {
        const u = t - q.t;
        if (u < 0 || u > q.d) continue;
        const f = q.f0 + (q.f1 - q.f0) * (u / q.d);
        s += Math.sin(TAU * f * u) * q.a * Math.sin(Math.PI * u / q.d) * (c ? q.pan : 1 - q.pan) * 2;
      }
      d[i] = s;
    }
  }
  return buf;
}
// a short burst of laughter: glottal pulses through vowel formants, "ha ha ha ha"
function makeLaugh(ctx, k) {
  const sr = ctx.sampleRate, sec = 1.3, n = Math.floor(sr * sec), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const r = rng(31 + (k || 0));
  const F = [[780, 90], [1180, 110], [2450, 160]], G = [1, 0.5, 0.22];
  const res = F.map(([f, bw]) => ({ a1: 2 * Math.exp(-Math.PI * bw / sr) * Math.cos(TAU * f / sr), a2: -Math.exp(-2 * Math.PI * bw / sr), y1: 0, y2: 0 }));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const syl = Math.floor(t / 0.19), u = t - syl * 0.19;
    let src = 0;
    if (syl < 6) {
      const f0 = (250 - syl * 11) * (1 + 0.04 * Math.sin(t * 40)) * (1 - 0.1 * u / 0.19);
      phase += f0 / sr;
      if (phase >= 1) phase -= 1;
      const pulse = phase < 0.4 ? Math.sin(Math.PI * phase / 0.4) : 0;
      const voiced = u > 0.035 && u < 0.15 ? Math.sin(Math.PI * (u - 0.035) / 0.115) : 0;
      const breath = u < 0.05 ? (1 - u / 0.05) * 0.5 : 0;
      src = (pulse - 0.25) * voiced * (1 - syl * 0.12) + (r() * 2 - 1) * (breath + voiced * 0.08);
    }
    let y = 0;
    res.forEach((q, j) => { const v = src * 0.08 + q.a1 * q.y1 + q.a2 * q.y2; q.y2 = q.y1; q.y1 = v; y += v * G[j]; });
    d[i] = y * 0.6;
  }
  return buf;
}
function normalise(buf, peak) {
  let m = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= peak / m; }
  return buf;
}
function audioRes(ctx) {
  if (ctx.__res) return ctx.__res;
  const pw = (amps) => { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => { im[i + 1] = a; }); return ctx.createPeriodicWave(re, im); };
  const pianoAmps = [], pulseAmps = [];
  for (let h = 1; h <= 18; h++) {
    pianoAmps.push(Math.abs(Math.sin(h * Math.PI * 0.13)) / Math.pow(h, 1.15));
    pulseAmps.push(Math.sin(h * Math.PI * 0.25) / h);
  }
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
  ctx.__res = {
    noise: makeNoise(ctx, 2), hall: makeIR(ctx, 2.8, 0.62), gate: makeIR(ctx, 0.27, 0, true),
    scratch: normalise(makeScratch(ctx), 0.7), splash: normalise(makeSplash(ctx), 0.75),
    laugh: [normalise(makeLaugh(ctx, 0), 0.5), normalise(makeLaugh(ctx, 1), 0.5)],
    piano: pw(pianoAmps), pulse: pw(pulseAmps), curve
  };
  return ctx.__res;
}

// ---------------------------------------------------------------- the mixing desk
function buildDesk(ctx, dest) {
  const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const D = { ctx };
  D.master = g(0.85);
  D.comp = ctx.createDynamicsCompressor();
  D.comp.threshold.value = -16; D.comp.knee.value = 8; D.comp.ratio.value = 3.2; D.comp.attack.value = 0.004; D.comp.release.value = 0.22;
  // a fast, hard limiter after the glue compressor keeps the peaks under full scale
  D.limit = ctx.createDynamicsCompressor();
  D.limit.threshold.value = -4; D.limit.knee.value = 0; D.limit.ratio.value = 20; D.limit.attack.value = 0.001; D.limit.release.value = 0.08;
  D.comp.connect(D.limit); D.limit.connect(D.master); D.master.connect(dest);
  D.drums = g(0.85); D.drums.connect(D.comp);
  D.music = g(0.8); D.music.connect(D.comp);
  const R = audioRes(ctx);
  D.hall = ctx.createConvolver(); D.hall.buffer = R.hall;
  D.hallRet = g(0.32); D.hall.connect(D.hallRet); D.hallRet.connect(D.comp);
  D.verb = g(1); D.verb.connect(D.hall);
  D.gate = ctx.createConvolver(); D.gate.buffer = R.gate;
  D.gateRet = g(0.3); D.gate.connect(D.gateRet); D.gateRet.connect(D.comp);
  D.gated = g(1); D.gated.connect(D.gate);
  // ping-pong delay, a dotted eighth
  D.echo = g(1);
  const dl = ctx.createDelay(1), dr = ctx.createDelay(1), fb = g(0.36), tone = ctx.createBiquadFilter();
  dl.delayTime.value = BEAT * 0.75; dr.delayTime.value = BEAT * 0.75;
  tone.type = 'lowpass'; tone.frequency.value = 3200;
  const mL = ctx.createChannelMerger(2), ret = g(0.3);
  D.echo.connect(dl); dl.connect(tone); tone.connect(dr); dr.connect(fb); fb.connect(dl);
  dl.connect(mL, 0, 0); dr.connect(mL, 0, 1); mL.connect(ret); ret.connect(D.comp);
  D.R = R;
  return D;
}

// ---------------------------------------------------------------- voices
// each takes the desk, a start time (context seconds) and its event's arguments
function env(D, t, a, peak, dec, sus, rel, dur) {
  const n = D.ctx.createGain(), p = n.gain;
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  if (sus !== undefined) {
    p.setTargetAtTime(Math.max(peak * sus, 0.0001), t + a, dec / 3);
    const off = t + Math.max(a + 0.01, dur);
    p.setTargetAtTime(0.0001, off, rel / 4);
  } else {
    p.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  return n;
}
function osc(D, type, f, t, stop, wave) {
  const o = D.ctx.createOscillator();
  if (wave) o.setPeriodicWave(wave); else o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t); o.stop(stop);
  return o;
}
function noiseSrc(D, t, stop, off) {
  const s = D.ctx.createBufferSource();
  s.buffer = D.R.noise; s.loop = true;
  s.start(t, off !== undefined ? off : (t * 7.13) % 1.5); s.stop(stop);
  return s;
}
function filt(D, type, f, q) { const n = D.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q !== undefined) n.Q.value = q; return n; }
function pan(D, p) { const n = D.ctx.createStereoPanner(); n.pan.value = clamp(p, -1, 1); return n; }
function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
const send = (node, dest, amt) => { if (!amt) return; const g = dest.context.createGain(); g.gain.value = amt; node.connect(g); g.connect(dest); };

const VOICES = {
  kick(D, t, a) {
    const o = osc(D, 'sine', 150, t, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.085); o.frequency.exponentialRampToValueAtTime(40, t + 0.45);
    const sh = D.ctx.createWaveShaper(); sh.curve = D.R.curve;
    chain(o, sh, env(D, t, 0.003, a.v * 0.95, 0.42), D.drums);
    const n = noiseSrc(D, t, t + 0.02);
    chain(n, filt(D, 'highpass', 2600), env(D, t, 0.001, a.v * 0.22, 0.012), D.drums);
  },
  snare(D, t, a) {
    const v = a.v * (a.roll ? 0.7 : 1);
    const o = osc(D, 'triangle', 188, t, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.1);
    chain(o, env(D, t, 0.002, v * 0.5, 0.11), D.drums);
    const o2 = osc(D, 'sine', 330, t, t + 0.1);
    chain(o2, env(D, t, 0.002, v * 0.25, 0.06), D.drums);
    const n = noiseSrc(D, t, t + 0.3);
    const out = chain(n, filt(D, 'bandpass', 2100, 0.7), filt(D, 'highpass', 800), env(D, t, 0.001, v * 0.75, a.roll ? 0.1 : 0.2));
    out.connect(D.drums);
    if (!a.roll) send(out, D.gated, 0.7);
  },
  clap(D, t, a) {
    const n = noiseSrc(D, t, t + 0.3);
    const g = D.ctx.createGain(), p = g.gain;
    p.setValueAtTime(0, t);
    for (const dt of [0, 0.011, 0.022, 0.034]) { p.setValueAtTime(a.v * 0.8, t + dt); p.setTargetAtTime(0.02, t + dt + 0.001, 0.004); }
    p.setValueAtTime(a.v * 0.6, t + 0.036); p.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const out = chain(n, filt(D, 'bandpass', 1350, 1.4), g);
    out.connect(D.drums); send(out, D.gated, 0.6);
  },
  hat(D, t, a) {
    const dur = a.open ? 0.32 : 0.045;
    const n = noiseSrc(D, t, t + dur + 0.05);
    const out = chain(n, filt(D, 'highpass', 7200), filt(D, 'peaking', 10500, 1.5), env(D, t, 0.001, a.v * 0.5, dur), pan(D, 0.18));
    out.connect(D.drums);
    for (const f of [540 * 1.9, 800 * 1.9]) chain(osc(D, 'square', f, t, t + dur + 0.02), filt(D, 'highpass', 7000), env(D, t, 0.001, a.v * 0.05, dur), D.drums);
  },
  crash(D, t, a) {
    const n = noiseSrc(D, t, t + 2.4);
    const out = chain(n, filt(D, 'highpass', 4200), env(D, t, 0.002, a.v * 0.42, 2.1));
    out.connect(D.drums); send(out, D.verb, 0.35);
    for (const f of [205, 304, 370, 523, 540, 800]) chain(osc(D, 'square', f * 2.3, t, t + 1.6), filt(D, 'highpass', 5000), env(D, t, 0.002, a.v * 0.02, 1.4), D.drums);
  },
  tom(D, t, a) {
    const o = osc(D, 'sine', a.f, t, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(a.f * 0.62, t + 0.3);
    const out = chain(o, env(D, t, 0.003, a.v * 0.8, 0.38));
    out.connect(D.drums); send(out, D.gated, 0.3);
    chain(noiseSrc(D, t, t + 0.05), filt(D, 'bandpass', 1200, 1), env(D, t, 0.001, a.v * 0.2, 0.03), D.drums);
  },
  snap(D, t, a) {
    const out = chain(noiseSrc(D, t, t + 0.08), filt(D, 'bandpass', 2600, 3.5), env(D, t, 0.001, a.v * 1.1, 0.045), pan(D, a.pan || 0));
    out.connect(D.drums); send(out, D.verb, 0.25);
    chain(osc(D, 'sine', 1900, t, t + 0.02), env(D, t, 0.001, a.v * 0.2, 0.012), D.drums);
  },
  rim(D, t, a) {
    chain(osc(D, 'square', 1650, t, t + 0.04), filt(D, 'bandpass', 1800, 4), env(D, t, 0.001, a.v * 0.5, 0.03), D.drums);
    chain(osc(D, 'triangle', 820, t, t + 0.04), env(D, t, 0.001, a.v * 0.35, 0.03), D.drums);
  },
  brush(D, t, a) {
    const g = D.ctx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(a.v * 0.3, t + a.d * BEAT * 0.4); p.linearRampToValueAtTime(0.0001, t + a.d * BEAT);
    chain(noiseSrc(D, t, t + a.d * BEAT + 0.05), filt(D, 'bandpass', 3800, 0.8), g, D.drums);
  },
  block(D, t, a) {
    chain(osc(D, 'sine', 1250, t, t + 0.08), env(D, t, 0.001, a.v * 0.5, 0.06), D.music);
    chain(osc(D, 'triangle', 2500, t, t + 0.05), env(D, t, 0.001, a.v * 0.15, 0.03), D.music);
  },
  bass(D, t, a) {
    const f = mtof(a.m), d = a.d * BEAT;
    const lp = filt(D, 'lowpass', 300, 7);
    lp.frequency.setValueAtTime(280 + 2300 * a.v, t); lp.frequency.setTargetAtTime(330, t + 0.005, 0.06);
    const e = env(D, t, 0.003, a.v * 0.5, 0.15, 0.72, 0.06, d);
    chain(osc(D, 'sawtooth', f, t, t + d + 0.3), lp);
    chain(osc(D, 'square', f * 1.004, t, t + d + 0.3), lp);
    chain(lp, e, D.music);
    chain(osc(D, 'sine', f / 2, t, t + d + 0.3), env(D, t, 0.003, a.v * 0.3, 0.15, 0.8, 0.06, d), D.music);
  },
  upright(D, t, a) {
    const f = mtof(a.m), d = a.d * BEAT;
    const out = chain(osc(D, 'triangle', f, t, t + d + 0.5), filt(D, 'lowpass', 900), env(D, t, 0.006, a.v * 0.7, 0.7, 0.2, 0.15, d));
    out.connect(D.music);
    chain(osc(D, 'sine', f * 2, t, t + 0.2), env(D, t, 0.002, a.v * 0.12, 0.12), D.music);
    chain(noiseSrc(D, t, t + 0.03), filt(D, 'bandpass', 600, 2), env(D, t, 0.001, a.v * 0.1, 0.02), D.music);
  },
  piano(D, t, a) {
    const f = mtof(a.m), d = a.d * BEAT, v = a.v;
    const T60 = lerp(5.2, 1.6, sat((a.m - 36) / 52));
    const stop = t + Math.min(d + 1.2, T60) + 0.1;
    const lp = filt(D, 'lowpass', Math.min(16000, f * (8 + 10 * v)), 0.5);
    lp.frequency.setTargetAtTime(Math.min(12000, f * 2.6), t + 0.01, 0.5);
    chain(osc(D, 'sine', f, t, stop, D.R.piano), lp);
    chain(osc(D, 'sine', f * 1.0009, t, stop, D.R.piano), lp);
    const e = D.ctx.createGain(), p = e.gain;
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(v * 0.34, t + 0.004);
    p.setTargetAtTime(v * 0.12, t + 0.004, 0.18);
    p.setTargetAtTime(0.0001, t + 0.35, T60 / 6.9);
    p.cancelScheduledValues(t + d); p.setTargetAtTime(0.0001, t + d, 0.12);
    const pn = pan(D, (a.m - 62) / 40);
    chain(lp, e, pn, D.music);
    send(pn, D.verb, 0.55);
    chain(noiseSrc(D, t, t + 0.03), filt(D, 'bandpass', Math.min(8000, f * 5), 1.2), env(D, t, 0.001, v * 0.05, 0.02), D.music);
  },
  pad(D, t, a) {
    const d = a.d * BEAT;
    const lp = filt(D, 'lowpass', 1100, 0.7);
    const e = env(D, t, 0.4, a.v, 0.5, 0.85, 1.1, d);
    for (const m of a.ns) for (const dc of [-9, 0, 9]) chain(osc(D, 'sawtooth', mtof(m) * Math.pow(2, dc / 1200), t, t + d + 1.6), lp);
    const out = chain(lp, e);
    out.connect(D.music); send(out, D.verb, 0.4);
  },
  stab(D, t, a) {
    const d = a.d * BEAT;
    const lp = filt(D, 'lowpass', 400, a.soft ? 0.5 : 2.5);
    lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(a.soft ? 1500 : 3800, t + 0.015); lp.frequency.setTargetAtTime(a.soft ? 800 : 1400, t + 0.02, 0.07);
    const e = env(D, t, 0.006, a.v * 0.5, 0.12, 0.6, 0.08, d);
    for (const m of a.ns) {
      chain(osc(D, 'sawtooth', mtof(m), t, t + d + 0.3), lp);
      chain(osc(D, 'sawtooth', mtof(m) * 1.006, t, t + d + 0.3), lp);
    }
    const out = chain(lp, e);
    out.connect(D.music); send(out, D.verb, 0.18);
  },
  brass(D, t, a) {
    const d = a.d * BEAT;
    const lp = filt(D, 'lowpass', 500, 1.5);
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(4200, t + 0.05); lp.frequency.setTargetAtTime(2200, t + 0.08, 0.2);
    const e = D.ctx.createGain(), p = e.gain;
    p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(a.v * 0.36, t + 0.02);
    if (a.swell) { p.setTargetAtTime(a.v * 0.22, t + 0.03, 0.2); p.linearRampToValueAtTime(a.v * 0.42, t + d * 0.7); }
    p.setTargetAtTime(0.0001, t + d, 0.12);
    for (const m of a.ns) {
      const f = mtof(m);
      for (const dc of [-6, 5]) {
        const o = osc(D, 'sawtooth', f * Math.pow(2, dc / 1200), t, t + d + 0.8);
        if (a.swell) { const lfo = osc(D, 'sine', 5.5, t, t + d + 0.8), lg = D.ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.6); chain(lfo, lg); lg.connect(o.frequency); }
        chain(o, lp);
      }
    }
    const out = chain(lp, e);
    out.connect(D.music); send(out, D.verb, 0.3);
  },
  lead(D, t, a) {
    const f = mtof(a.m), d = a.d * BEAT;
    const o = osc(D, 'sawtooth', a.slide ? f / 2 : f * 0.985, t, t + d + 0.4);
    o.frequency.setTargetAtTime(f, t, a.slide ? 0.05 : 0.012);
    const o2 = osc(D, 'sine', f, t, t + d + 0.4, D.R.pulse);
    o2.frequency.setValueAtTime(a.slide ? f / 2 : f * 0.985, t); o2.frequency.setTargetAtTime(f * 1.003, t, a.slide ? 0.05 : 0.012);
    // vibrato that blooms on long notes
    const lfo = osc(D, 'sine', 5.6, t, t + d + 0.4), lg = D.ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.5, d));
    chain(lfo, lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const src = D.ctx.createGain(); src.gain.value = 1;
    o.connect(src); const g2 = D.ctx.createGain(); g2.gain.value = 0.5; chain(o2, g2, src);
    // an open 'ah' through three formants
    const e = env(D, t, 0.03, a.v * 0.5, 0.2, 0.85, 0.12, d);
    for (const [ff, q, gg] of [[730, 6, 1], [1150, 8, 0.5], [2600, 10, 0.3]]) {
      const bp = filt(D, 'bandpass', ff * (1 + (a.m - 72) * 0.004), q), gn = D.ctx.createGain(); gn.gain.value = gg * 2.2;
      chain(src, bp, gn, e);
    }
    const lp = filt(D, 'lowpass', 1800); const gd = D.ctx.createGain(); gd.gain.value = 0.25;
    chain(src, lp, gd, e);
    e.connect(D.music); send(e, D.echo, 0.35); send(e, D.verb, 0.3);
  },
  pluck(D, t, a) {
    const f = mtof(a.m), d = a.d * BEAT;
    const lp = filt(D, 'lowpass', 900, 3);
    lp.frequency.setValueAtTime(a.bright ? 7000 : 5000, t); lp.frequency.setTargetAtTime(a.bright ? 1400 : 900, t, 0.05);
    chain(osc(D, 'sine', f, t, t + d + 0.4, D.R.pulse), lp);
    const e = env(D, t, 0.002, a.v * 0.5, 0.3);
    const out = chain(lp, e, pan(D, a.echo ? Math.sin(a.m * 1.7) * 0.5 : 0));
    out.connect(D.music);
    send(out, D.echo, a.echo ? 0.55 : 0.2); send(out, D.verb, 0.2);
  },
  bell(D, t, a) {
    const f = mtof(a.m);
    const car = osc(D, 'sine', f, t, t + 2), mod = osc(D, 'sine', f * 3.5, t, t + 2), mg = D.ctx.createGain();
    mg.gain.setValueAtTime(f * 5, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.2);
    chain(mod, mg); mg.connect(car.frequency);
    const out = chain(car, env(D, t, 0.002, a.v * 0.4, 1.6));
    out.connect(D.music); send(out, D.verb, 0.5);
  },
  timp(D, t, a) {
    const f = mtof(a.m);
    const o = osc(D, 'sine', f * 1.05, t, t + 2); o.frequency.exponentialRampToValueAtTime(f, t + 0.2);
    chain(o, env(D, t, 0.004, a.v * 0.7, 1.5), D.music);
    chain(noiseSrc(D, t, t + 0.3), filt(D, 'lowpass', 400), env(D, t, 0.002, a.v * 0.4, 0.25), D.music);
  },
  riser(D, t, a) {
    const d = a.d * BEAT;
    const bp = filt(D, 'bandpass', 400, 3); bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + d);
    const g = D.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a.v * 0.5, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.05);
    chain(noiseSrc(D, t, t + d + 0.1), bp, g, D.music);
    const o = osc(D, 'sawtooth', 220, t, t + d + 0.1); o.frequency.exponentialRampToValueAtTime(880, t + d);
    const g2 = D.ctx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(a.v * 0.06, t + d); g2.gain.linearRampToValueAtTime(0.0001, t + d + 0.05);
    chain(o, filt(D, 'lowpass', 2000), g2, D.music);
  },
  swell(D, t, a) {
    const d = a.d * BEAT;
    const g = D.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a.v * 0.35, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.02);
    const out = chain(noiseSrc(D, t, t + d + 0.05), filt(D, 'highpass', 4500), g);
    out.connect(D.drums); send(out, D.verb, 0.3);
  },
  whoosh(D, t, a) {
    const d = a.d * BEAT;
    const bp = filt(D, 'bandpass', 300, a.low ? 1.2 : 2);
    bp.frequency.setValueAtTime(a.low ? 200 : 300, t); bp.frequency.exponentialRampToValueAtTime(a.low ? 900 : 2800, t + d * 0.5); bp.frequency.exponentialRampToValueAtTime(a.low ? 250 : 500, t + d);
    const g = D.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a.v * 0.6, t + d * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const pn = D.ctx.createStereoPanner(); pn.pan.setValueAtTime(a.p0 || 0, t); pn.pan.linearRampToValueAtTime(a.p1 || 0, t + d);
    chain(noiseSrc(D, t, t + d + 0.05), bp, g, pn, D.music);
  },
  scrape(D, t, a) {
    const d = 0.26;
    const bp = filt(D, 'bandpass', 900, 1.5); bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1600, t + d);
    const am = osc(D, 'square', 38, t, t + d + 0.05), ag = D.ctx.createGain(); ag.gain.value = 0.5;
    const g = D.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a.v * 0.5, t + 0.03); g.gain.linearRampToValueAtTime(0.0001, t + d);
    chain(am, ag); ag.connect(g.gain);
    chain(noiseSrc(D, t, t + d + 0.05), bp, g, pan(D, -0.4 + (t % 1) * 0.8), D.music);
  },
  print(D, t, a) {
    chain(noiseSrc(D, t, t + 0.12), filt(D, 'lowpass', 900), env(D, t, 0.001, a.v * 0.7, 0.08), D.drums);
    chain(noiseSrc(D, t + 0.045, t + 0.12), filt(D, 'bandpass', 3000, 2), env(D, t + 0.045, 0.001, a.v * 0.3, 0.03), D.drums);
  },
  clunk(D, t, a) {
    const o = osc(D, 'sine', 70, t, t + 0.4); o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    chain(o, env(D, t, 0.002, a.v * 0.8, 0.25), D.drums);
    chain(noiseSrc(D, t, t + 0.05), filt(D, 'bandpass', 2500, 2), env(D, t, 0.001, a.v * 0.5, 0.03), D.drums);
    // the lamp's hum
    const h = osc(D, 'sawtooth', 100, t, t + 3), g = D.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a.v * 0.02, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    chain(h, filt(D, 'lowpass', 400), g, D.music);
  },
  bloop(D, t, a) {
    const o = osc(D, 'sine', 300, t, t + 0.12); o.frequency.exponentialRampToValueAtTime(900, t + 0.06);
    const out = chain(o, env(D, t, 0.003, a.v * 0.4, 0.07));
    out.connect(D.music); send(out, D.verb, 0.4);
  },
  buffer(D, t, a, buf, dest, verbAmt) {
    const s = D.ctx.createBufferSource(); s.buffer = buf;
    const g = D.ctx.createGain(); g.gain.value = a.v;
    s.connect(g); g.connect(dest); if (verbAmt) send(g, D.verb, verbAmt);
    s.start(t);
  },
  scratch(D, t, a) { VOICES.buffer(D, t, a, D.R.scratch, D.music, 0.15); },
  splash(D, t, a) { VOICES.buffer(D, t, a, D.R.splash, D.music, 0.3); },
  laugh(D, t, a) { VOICES.buffer(D, t, a, D.R.laugh[a.k || 0], D.music, 0.35); }
};
function playEvent(D, e, when) {
  const f = VOICES[e.inst];
  if (f) f(D, when, e.a);
}

// ---------------------------------------------------------------- live playback
const AU = { ctx: null, desk: null, start: 0, cursor: 0, timer: 0, muted: false, running: false };
function audioBegin(from) {
  if (AU.running) return;
  from = from || 0;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  AU.ctx = new AC({ latencyHint: 'interactive' });
  AU.desk = buildDesk(AU.ctx, AU.ctx.destination);
  AU.desk.master.gain.value = AU.muted ? 0 : 0.85;
  AU.start = AU.ctx.currentTime + 0.15 - from;
  AU.cursor = from;
  AU.running = true;
  const tick = () => {
    const now = AU.ctx.currentTime - AU.start;
    const until = now + 0.3;
    // schedule every event whose time (on the looping timeline) falls in [cursor, until)
    while (AU.cursor < until) {
      const loop = Math.floor(AU.cursor / DUR), within = AU.cursor - loop * DUR;
      const end = Math.min(until, (loop + 1) * DUR) - loop * DUR;
      for (const e of SCORE.events) if (e.t >= within && e.t < end) playEvent(AU.desk, e, AU.start + loop * DUR + e.t);
      AU.cursor = loop * DUR + end;
    }
  };
  tick();
  AU.timer = setInterval(tick, 50);
  if (AU.ctx.state === 'suspended') AU.ctx.resume();
}
// the playback position of what is coming out of the speakers now (s)
function audioClock() {
  if (!AU.running) return null;
  const c = AU.ctx;
  if (c.getOutputTimestamp) {
    const ts = c.getOutputTimestamp();
    if (ts.contextTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000 - AU.start;
  }
  return c.currentTime - (c.outputLatency || c.baseLatency || 0) - AU.start;
}
function audioMute(m) {
  AU.muted = m;
  if (AU.desk) AU.desk.master.gain.setTargetAtTime(m ? 0 : 0.85, AU.ctx.currentTime, 0.03);
}

// ---------------------------------------------------------------- offline render (debug, export)
// Rendered four bars at a time (each chunk with a pre-roll so reverb and long notes ring
// through the joins), since scheduling the whole score into one graph is very slow.
// Events from the end of the loop ring into its start, so the render loops cleanly.
async function audioRender(b0, b1, sr) {
  const rate = sr || 48000, t0 = b0 * BEAT, t1 = b1 * BEAT;
  const total = Math.ceil((t1 - t0) * rate);
  const out = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: rate });
  const CHUNK = 4 * BAR, PRE = 5;
  for (let c0 = t0; c0 < t1 - 1e-6; c0 += CHUNK) {
    const c1 = Math.min(t1, c0 + CHUNK), s0 = c0 - PRE;
    const ctx = new OfflineAudioContext(2, Math.ceil((c1 - s0) * rate) + 128, rate);
    const D = buildDesk(ctx, ctx.destination);
    for (const e of SCORE.events) for (const tt of [e.t, e.t - DUR, e.t + DUR]) if (tt >= s0 && tt < c1) playEvent(D, e, tt - s0);
    const buf = await ctx.startRendering();
    const src = Math.round(PRE * rate), n = Math.min(Math.round((c1 - c0) * rate), total - Math.round((c0 - t0) * rate)), dst = Math.round((c0 - t0) * rate);
    for (let ch = 0; ch < 2; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(src, src + n), dst);
  }
  // loudness per bar
  const L = out.getChannelData(0), R = out.getChannelData(1);
  const bars = [];
  for (let b = b0; b < b1; b += 4) {
    const i0 = Math.floor((b - b0) * BEAT * rate), i1 = Math.min(L.length, Math.floor((b + 4 - b0) * BEAT * rate));
    let s = 0, pk = 0;
    for (let i = i0; i < i1; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); s += (L[i] * L[i] + R[i] * R[i]) / 2; if (v > pk) pk = v; }
    const rms = Math.sqrt(s / Math.max(1, i1 - i0));
    bars.push([b / 4, +(20 * Math.log10(rms + 1e-9)).toFixed(1), +(20 * Math.log10(pk + 1e-9)).toFixed(1)]);
  }
  return { buf: out, bars };
}
function wavBlob(buf, from, dur) {
  const sr = buf.sampleRate, n = Math.min(buf.length - Math.floor(from * sr), Math.floor(dur * sr));
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1), i0 = Math.floor(from * sr);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, clamp(L[i0 + i], -1, 1) * 32767, true);
    out.setInt16(46 + i * 4, clamp(R[i0 + i], -1, 1) * 32767, true);
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}
