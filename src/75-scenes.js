// ============================================================
// The running order of the worlds, and everything decided per scene:
// which sets are on the canvas (with their paint clocks), camera, lights, composite.
// Beats:  0 river nocturne | 16 drop: railway arch | 40 pop-art prints |
//        56 theatre | 71.6 swirl into the starry night | 101 gallery pull-back |
//       112 the painting repaints itself as the nocturne | 120 = loop
// ============================================================
const B = { drop: 16, pop: 40, thea: 56, swirl: 71.55, star: 72, gal: 101, repaint: 112, end: 120 };
const SET = {};
function buildSets() {
  const mk = (fn, ord) => { const b = new StrokeBuf(true); G.buf = b; G.layer = 'bg'; ORDER = ord; fn(); b.dirty = true; return b; };
  SET.noct = mk(buildNocturne, { in: sweepX(-380, 380, 1.25, 0.1), out: sweepX(-300, 300, 0.55, 0.08) });
  SET.arch = mk(buildArch, { in: null, out: null });
  SET.pop = mk(buildPopGround, { in: null, out: null });
  SET.theaB = mk(buildTheatreBack, { in: null, out: spiralOrder(40, 110, 560, 0.75) });
  SET.theaF = mk(buildTheatreFront, { in: null, out: spiralOrder(40, 110, 560, 0.45) });
  SET.star = mk(buildStarry, { in: null, out: sweepX(-420, 420, 0.55, 0.08) });
  ORDER = { in: null, out: null };
}

function sceneName(b) {
  if (b < B.drop) return 'noct';
  if (b < B.pop) return 'arch';
  if (b < B.thea) return 'pop';
  if (b < B.star) return 'thea';
  return 'star';
}

// static sets to draw into the background, bottom first, with their clocks
function setDrawList(t) {
  const b = t / BEAT, L = [];
  if (b < B.drop + 1.5) {
    if (b > B.drop - 0.5) L.push({ buf: SET.arch });
    L.push({ buf: SET.noct, tIn: t + 1.7, tOut: t - (B.drop * BEAT - 0.06) });
  } else if (b < B.pop) L.push({ buf: SET.arch });
  else if (b < B.thea) L.push({ buf: SET.pop, flat: true });
  else if (b < B.star + 1.6) {
    if (b > B.swirl - 0.3) L.push({ buf: SET.star });
    L.push({ buf: SET.theaB, tOut: t - B.swirl * BEAT });
  } else {
    const tRe = B.repaint * BEAT;
    L.push({ buf: SET.star, tOut: t - (tRe - 0.15) });
    if (b > B.repaint - 0.2) L.push({ buf: SET.noct, tIn: t - tRe, tOut: -1e4, noctCam: true });
  }
  return L;
}

// ---------------------------------------------------------------- camera
// [beat, visible height at the dancer (cm), look-at height, camera height offset, look-at x offset]
const CAM_KEYS = [
  [-8, 300, 52, 14, 0], [0, 300, 52, 14, 0], [8, 292, 54, 14, 0], [10.6, 250, 44, 12, 0], [11.8, 150, 24, 8, 0], [14.0, 138, 22, 8, 0], [14.6, 250, 70, 12, 0], [15.1, 292, 132, 12, 0],
  [16, 244, 104, 12, 0], [18, 250, 101, 12, 0], [30.6, 262, 100, 12, 0], [32, 206, 121, 12, 0],
  [37.4, 206, 121, 12, 0], [38.5, 270, 100, 12, 0], [39.999, 270, 100, 12, 0],
  [40, 226, 104, 12, 0], [55.999, 226, 104, 12, 0],
  [56, 340, 126, 12, 58], [63.4, 330, 124, 12, 58], [65.8, 356, 132, 12, 62], [68.2, 352, 130, 12, 60],
  [70.2, 304, 118, 12, 40], [71.2, 296, 118, 12, 26], [73.2, 286, 120, -30, 0],
  [79.5, 276, 118, -30, 0], [80.5, 290, 130, -40, 0], [83.5, 290, 130, -40, 0], [84.5, 306, 126, -30, 0],
  [87.5, 306, 126, -30, 0], [88.5, 272, 118, -30, 0], [91.2, 272, 118, -30, 0], [92.2, 212, 130, -18, 0],
  [95.4, 212, 130, -18, 0], [96.4, 246, 114, -24, 0], [100, 252, 116, -24, 0], [113.49, 252, 116, -24, 0],
  [113.5, 300, 52, 14, 0], [120, 300, 52, 14, 0]
];
function cameraAt(t, J) {
  const b = t / BEAT;
  let i = 0;
  while (i + 1 < CAM_KEYS.length && b >= CAM_KEYS[i + 1][0]) i++;
  const k0 = CAM_KEYS[i], k1 = CAM_KEYS[Math.min(i + 1, CAM_KEYS.length - 1)];
  const u = k1[0] > k0[0] ? easeInOut(clamp((b - k0[0]) / (k1[0] - k0[0]), 0, 1)) : 0;
  let viewH = lerp(k0[1], k1[1], u), ty = lerp(k0[2], k1[2], u);
  const yOff = lerp(k0[3], k1[3], u), xOff = lerp(k0[4], k1[4], u);
  if (!REDUCED && b > B.drop) viewH *= 1 - 0.028 * Math.pow(dip(b), 2);
  const asp = CW / CH;
  if (asp < 1.1) { const need = 180 / asp; if (need > viewH) { ty += (need - viewH) * 0.12; viewH = need; } }
  let tx = (b > B.drop ? J.pelvis.x * 0.3 : 0) + xOff;
  // the record scratch knocks the whole picture sideways, like a needle skipping
  if (b > 12 && b < 12.9 && !REDUCED) { const k = (b - 12) * BEAT; tx += 7 * Math.sin(k * 75) * Math.exp(-k * 9); ty += 2.5 * Math.sin(k * 53) * Math.exp(-k * 9); }
  const roll = REDUCED || b < B.drop ? 0 : 0.017 * Math.sin(Math.PI * (b - 0.5));
  const fov = 2 * Math.atan((viewH / 2) / CAM_DIST);
  return makeCam(V(tx * 0.7, ty + yOff, CAM_DIST), V(tx, ty, 0), fov, roll);
}

// the nocturne's own framing (used while it repaints itself inside the gallery frame)
function nocturneCam(view) {
  let viewH = 300, ty = 52;
  const asp = CW / CH;
  if (asp < 1.1) { const need = 180 / asp; if (need > viewH) { ty += (need - viewH) * 0.12; viewH = need; } }
  return makeCam(V(0, ty + 14, CAM_DIST), V(0, ty, 0), 2 * Math.atan((viewH / 2) / CAM_DIST), 0, view);
}

// ---------------------------------------------------------------- lights, per scene
function archLights(b) {
  const amp = 70 + 35 * smoothstep(23, 25, b);
  const sw = Math.sin(Math.PI * (b - 0.5));
  const dp = dip(b);
  const bar = (((Math.round(b) % 4) + 4) % 4 === 0) ? 1 : 0;
  const sn = hitPulse('snare', b * BEAT, 0.14);
  return {
    w: V(-320 + amp * sw, 96 - 22 * dp, 320), c: V(320 + amp * sw, 104 - 22 * dp, 320),
    wI: 1 + (0.16 + 0.22 * bar) * dp + 0.22 * sn, cI: 1 + (0.12 + 0.18 * bar) * dp + 0.3 * sn
  };
}
const THEA_SPOT = V(-430, 150, 460);
function spotOn(b) {
  const on = smoothstep(56.15, 56.35, b);
  const t = b * BEAT;
  return on * (1 - 0.35 * bump(b, 56.45, 0.04)) * (1 + 0.06 * dip(b) + 0.12 * hitPulse('snare', t, 0.12) + 0.1 * hitPulse('crash', t, 0.3));
}

function lightsFor(name, b) {
  switch (name) {
    case 'noct': return { w: V(-420, 260, 200), c: V(300, 430, -150), wI: 0.7, cI: 1.0 };
    case 'arch': return archLights(b);
    case 'pop': return { w: V(-300, 260, 460), c: V(360, 120, 300), wI: 1.1, cI: 0.6 };
    case 'thea': return { w: THEA_SPOT, c: V(420, 140, 200), wI: 0.25 + 1.0 * spotOn(b), cI: 0.45 };
    default: return { w: V(-460, 60, 150), c: V(380, 480, -300), wI: 0.85 + 0.12 * dip(b), cI: 1.0 };
  }
}
const LOOK = {
  noct: { tint: [0.74, 0.86, 1.08], rimW: [0.95, 0.8, 0.5], rimC: [0.62, 0.78, 0.95] },
  arch: { tint: null, rimW: [1.0, 0.86, 0.6], rimC: [0.7, 0.6, 1.0] },
  pop: { tint: null, rimW: [1, 1, 1], rimC: [1, 1, 1] },
  thea: { tint: [1.06, 1.0, 0.9], rimW: [1.0, 0.9, 0.7], rimC: [0.5, 0.45, 0.8] },
  star: { tint: [0.84, 0.92, 1.12], rimW: [1.0, 0.78, 0.4], rimC: [0.92, 0.95, 0.66] }
};

// ---------------------------------------------------------------- 2D views: pop panels, gallery frame
function popGrid(b) {
  if (b < B.pop + 4) return 1;
  if (b < B.pop + 8) return 2;
  if (b < B.pop + 12) return 3;
  return 4;
}
function popSeed(b) {
  const g = popGrid(b);
  if (g < 4) return (g - 1) * 2;
  return Math.floor(Math.min(b, 54.9)) - 52 + 5;     // the last bar: every print changes ink on every beat
}
function galleryView(b) {
  let s = 1, cy = CH / 2;
  if (b >= B.gal && b < B.end) {
    const zo = easeInOutCubic(seg(b, B.gal, B.gal + 2.2));
    const zi = easeInOutCubic(seg(b, 115.3, 119.97));
    const sHold = 0.56 - 0.025 * seg(b, B.gal + 2.2, 115.3);
    s = lerp(1, sHold, zo);
    s = lerp(s, 1, zi);
    const off = lerp(0, -0.065, zo) * (1 - zi);
    cy = CH * (0.5 + off);
  }
  return { s, ox: CW / 2 - CW / 2 * s, oy: cy - CH / 2 * s, cy };
}

// ---------------------------------------------------------------- moving scenery
const perspX = (x0, z0, z) => x0 * (CAM_DIST - z) / (CAM_DIST - z0);
function ring3(cx, cz, r, y, col, w, a) {
  const pts = [];
  for (let k = 0; k <= 16; k++) { const th = k / 16 * TAU; pts.push(V(cx + Math.cos(th) * r, y, cz + Math.sin(th) * r * 0.9)); }
  st(pts, w, col, { a, dry: 0.45, still: true, w0: 1, tip: 1, tS: 0.01, tE: 0.01 });
}
function drawNoctDynamic(t, b) {
  // drifting glints on the water
  for (let i = 0; i < 46; i++) {
    const r1 = hash(i * 3.1), r2 = hash(i * 7.7), r3 = hash(i * 1.3);
    const z = WALL_Z + 10 + r1 * 360;
    const x = -520 + ((r2 * 1040 + t * (8 + 10 * r3)) % 1040 + 1040) % 1040;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + r3 * 2) + i);
    const len = 8 + r3 * 22;
    st([V(x, 0.2, z), V(x + len, 0.2, z)], 1.4 + r1, r3 < 0.25 ? [0.85, 0.7, 0.4] : [0.3, 0.42, 0.44], { a: 0.3 + 0.45 * tw, dry: 0.5, still: true });
  }
  // the moon's column shimmers
  for (let k = 0; k < 14; k++) {
    const z = WALL_Z + 10 + k * 22;
    const x = perspX(MOON_N.x, WALL_Z, z) + Math.sin(t * 2.3 + k * 1.7) * 7;
    const hw = 4 + 8 * (0.5 + 0.5 * Math.sin(t * 3.1 + k * 2.3));
    st([V(x - hw, 0.25, z), V(x + hw, 0.25, z)], 2.2, [0.9, 0.8, 0.52], { a: 0.6 * (1 - k / 16), dry: 0.4, still: true });
  }
  // sparks still drifting down from the rocket
  for (let i = 0; i < 18; i++) {
    const r1 = hash(i * 5.3 + 2), r2 = hash(i * 2.9 + 7);
    const cyc = 3 + r2 * 2, ph = ((t / cyc + r1) % 1 + 1) % 1;
    const x = -340 + r1 * 230 + Math.sin(ph * 3 + i) * 12, y = 215 - ph * 140;
    st([V(x, y, WALL_Z + 2), V(x + 0.5, y - 3.5, WALL_Z + 2)], 2.4 * (1 - ph * 0.6), [0.98, 0.8, 0.4], { a: 0.9 * Math.sin(Math.PI * ph), still: true });
  }
  // something stirs under the surface: bubbles, then rings spreading from where he rises
  if (b > 6.2 && b < 18.5) {
    for (let i = 0; i < 9; i++) {
      const bb = 6.4 + i * 0.27 + hash(i) * 0.2;
      const age = b - bb;
      if (age < 0 || age > 0.5) continue;
      const x = (hash(i * 3.3) - 0.5) * 30, z = (hash(i * 5.1) - 0.5) * 20;
      ring3(x, z, 1.5 + age * 9, 0.4, [0.55, 0.68, 0.7], 1.2, 0.8 * (1 - age * 2));
    }
    const births = [8.4, 9.3, 10.2, 11.1, 12.0, 12.9, 13.8, 14.5, 14.8, 16.0, 16.4];
    for (const bb of births) {
      const age = (b - bb) * BEAT;
      if (age < 0 || age > 2.2) continue;
      const big = bb >= 14.5 ? 1.8 : 1;
      ring3(0, 2, 24 + age * 70 * big, 0.5, [0.5, 0.64, 0.66], 1.6 * big, 0.75 * (1 - age / 2.2));
    }
  }
}
// The palette knife: when the nocturne is scraped away, a ridge of mixed paint rides the edge.
function drawScrapeRidge(t, b, x0, x1) {
  const tD = B.drop * BEAT - 0.06;
  const u = (t - tD - 0.19) / 0.55;     // where the strokes are half lifted
  if (u < -0.05 || u > 1.05) return;
  const x = lerp(x0, x1, clamp(u, 0, 1));
  const cols = [[0.1, 0.17, 0.22], [0.5, 0.27, 0.19], [0.86, 0.66, 0.32], [0.16, 0.24, 0.3], [0.38, 0.2, 0.17]];
  const fade = smoothstep(-0.05, 0.08, u) * (1 - smoothstep(0.92, 1.05, u));
  for (let i = 0; i < 16; i++) {
    const dx = (hash(i * 3.7) - 0.75) * 34 * DPR, w = (8 + 14 * hash(i * 1.9)) * DPR;
    const y0 = -20, y1 = CH + 20, wob = (hash(i * 5.3) - 0.5) * 16 * DPR;
    strokeScreen([{ x: x + dx, y: y0, w, c: cols[i % 5] }, { x: x + dx + wob, y: CH * 0.5, w: w * 1.2, c: cols[(i + 2) % 5] }, { x: x + dx, y: y1, w, c: cols[(i + 1) % 5] }],
      { dry: 0.4, h: 0.9, a: fade * (0.55 + 0.4 * hash(i)), jit: 0.6, rev: [NO_IN, NO_OUT] });
  }
}
// droplets flung up as he leaves the water and as he lands on it
function drawSplash(t, b) {
  if (b < 14.3 || b > 17.8) return;
  // a crown of water thrown up round him as he leaves the river
  const tc = (b - 14.45) * BEAT;
  if (tc > 0 && tc < 0.75) {
    const h = 70 * Math.sin(Math.PI * Math.min(1, tc / 0.62)), spread = 1 + tc * 1.6;
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * TAU + 0.3 * hash(i), r = (26 + 6 * hash(i * 3)) * spread;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.6;
      const hh = h * (0.6 + 0.6 * hash(i * 7.1));
      st([V(x, 0.5, z), V(x * 1.08, hh * 0.6, z * 1.08), V(x * 1.18, hh, z * 1.18)], [7, 4.5, 1.5], [0.7, 0.82, 0.88], { a: 0.75 * (1 - tc / 0.75), dry: 0.45, exact: true, still: true, tip: 0.2 });
    }
  }
  for (const [b0, n, spd, spread] of [[14.45, 46, 1, 1], [16.0, 26, 0.55, 1.4]]) {
    const tt = (b - b0) * BEAT;
    if (tt < 0 || tt > 1.1) continue;
    for (let i = 0; i < n; i++) {
      const a = hash(i * 3.7 + b0) * TAU;
      const r0 = 16 + hash(i * 5.1 + b0) * 22 * spread;
      const vy = (230 + hash(i * 1.9 + b0) * 280) * spd, vr = (40 + hash(i * 7.3 + b0) * 130) * spread;
      const x0 = Math.cos(a) * r0, z0 = Math.sin(a) * r0 * 0.6;
      const p = T => V(x0 + Math.cos(a) * vr * T, vy * T - 490 * T * T, z0 + Math.sin(a) * vr * 0.6 * T);
      const P1 = p(tt), P0 = p(Math.max(0, tt - 0.045));
      if (P1.y < -1) continue;
      st([P0, P1], 1.6 + hash(i) * 2.2, [0.72, 0.84, 0.9], { a: 0.9 * (1 - tt / 1.1), dry: 0.3, exact: true, still: true });
    }
  }
}
function drawContact(J, k) {
  const pl = J.pelvis;
  dab(V(pl.x, 0.3, 4), 9, 78, [0.02, 0.015, 0.03], { kind: 1, a: 0.55 * k, ang: 0, still: true });
  for (const s of ['L', 'R']) {
    const f = J['foot' + s];
    const lift = f.ball.y - 1.5;
    dab(V(f.ball.x, 0.3, f.ball.z - 3), 5, 26, [0.015, 0.01, 0.02], { kind: 1, a: 0.9 * (1 - clamp(lift / 12, 0, 0.8)) * k, ang: 0, still: true });
  }
}
function drawArchDynamic(t, J) {
  const W = WALL_Z;
  for (let i = 0; i < 4; i++) {
    const y = 14 + i * 4, w = 26 - i * 5;
    const sh = Math.sin(t * 5 + i * 1.7) * 3;
    st([V(-w / 2 + sh, y, W + 0.7), V(w / 2 + sh, y + 0.5, W + 0.7)], 1.2, i % 2 ? [0.45, 0.72, 0.7] : [0.3, 0.55, 0.57], { a: 0.35, dry: 0.5 });
  }
  drawContact(J, 1);
}
function drawTheatreDynamic(t, b, J) {
  // the follow-spot's beam, a soft haze from the balcony
  const on = spotOn(b);
  if (on > 0.05) {
    const L = THEA_SPOT, tgt = V(90, 95, -60);
    for (let k = 0; k < 3; k++) {
      const s0 = vlerp(L, tgt, 0.25 + k * 0.02), s1 = vlerp(L, tgt, 1.05);
      st([s0, vlerp(s0, s1, 0.5), s1], [60 + k * 30, 140 + k * 50, 230 + k * 60], [1.0, 0.9, 0.7], { kind: 1, a: on * (0.05 - k * 0.012), still: true });
    }
  }
  // dust drifting through the follow-spot
  if (on > 0.05) {
    for (let i = 0; i < 26; i++) {
      const r1 = hash(i * 9.1), r2 = hash(i * 4.7), r3 = hash(i * 2.2);
      const u = ((r1 + t * (0.02 + 0.03 * r3)) % 1 + 1) % 1;
      const p = vlerp(V(-300, 140, 300), V(40, 70, -60), u);
      const q = vadd(p, V(Math.sin(t * 0.7 + i) * 30 * r2, (r2 - 0.5) * 90, (r3 - 0.5) * 60));
      st([q, vadd(q, V(0.8, 0.5, 0))], 1.1, [1.0, 0.92, 0.72], { a: on * 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + i)), still: true, kind: 1 });
    }
  }
  drawContact(J, 0.8);
}
// the main curtain parts on the downbeat of the theatre
function drawCurtain(b) {
  const o = easeInOutCubic(seg(b, B.thea + 0.05, B.thea + 1.5));
  if (o >= 0.999) return;
  G.mid = 0;
  const Z = 185, N = 14, half = 440;
  for (const sg of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const x0 = (i + 0.5) / N * half;
      const x = sg * (8 + o * 330 + x0 * (1 - 0.5 * o));
      const lag = sg * 26 * Math.sin(Math.PI * o);
      const c = RED[(i + (sg > 0 ? 2 : 0)) % 4];
      st([V(x - lag * 0.3, 360, Z), V(x, 180, Z), V(x + lag, 0, Z), V(x + lag * 1.2, -40, Z)], half / N * 1.35, c, { dry: 0.3, h: 0.45, jit: 0.3 });
      st([V(x + 8 - lag * 0.3, 350, Z + 1), V(x + 8, 180, Z + 1), V(x + 8 + lag, 0, Z + 1)], 3.5, RED[3], { a: 0.6, dry: 0.5, jit: 0.3 });
    }
    st([V(sg * (8 + o * 330), -2, Z + 2), V(sg * (8 + o * 330 + half * (1 - 0.5 * o)), -2, Z + 2)], 6, [0.85, 0.66, 0.27], { dry: 0.4, h: 0.5 });
  }
}
// Van Gogh's sky, alive: long strokes along the flow carry a travelling glint of light, the
// whirlpools turn slowly, the stars twinkle on the hi-hats and swell on the kick.
const STREAMS = (() => {
  const r = mulberry(4711), out = [];
  for (let i = 0; i < 250; i++) out.push({ x: -580 + r() * 1160, y: 96 + r() * 440, r1: r(), r2: r(), r3: r() });
  return out;
})();
function drawStarryDynamic(t, b, J, cam) {
  const Z = SKY_Z + 3;
  // the mic lasso stirs the sky
  VORT_X = null;
  const tw = J.pose.twirl;
  if (tw > 0.01) {
    const mf = micFrame(J, SIM.mic.d);
    const p = rayToPlaneZ(cam, mf.grip, SKY_Z);
    VORT_X = { x: p.x, y: p.y, r: 150, s: 2.6 * tw };
  }
  const tS = t - B.swirl * BEAT;     // time since the sky arrived
  for (const S of STREAMS) {
    let x = S.x, y = S.y;
    for (const v of VORT) {
      const dx = x - v.x, dy = y - v.y, d2 = dx * dx + dy * dy;
      const w = Math.exp(-d2 / (v.r * v.r * 1.3));
      if (w > 0.03) { const a = v.s * 0.1 * tS * w, ca = Math.cos(a), sa = Math.sin(a); x = v.x + dx * ca - dy * sa; y = v.y + dx * sa + dy * ca; }
    }
    const base = mixc(skyColor(x, y, S.r1, S.r2), [0.86, 0.9, 0.95], 0.14);
    const n = 8, L = 8 + S.r2 * 5;
    const pts = [], cols = [];
    const ph = ((tS * (0.28 + 0.3 * S.r3) + S.r1 * 3.7) % 1.7) - 0.2;
    let low = false;
    for (let k = 0; k < n; k++) {
      if (y < 88) { low = true; break; }
      pts.push(V(x, y, Z));
      const u = k / (n - 1), g = Math.exp(-(u - ph) * (u - ph) / 0.018);
      cols.push(mixc(base, [0.82, 0.9, 0.97], g * 0.75));
      const f = skyFlow(x, y); x += f[0] * L; y += f[1] * L;
    }
    if (low && pts.length < 3) continue;
    st(pts, 5.2 + 2.6 * S.r3, cols, { dry: 0.3, h: 0.65, tip: 0.3, w0: 0.5, still: true, exact: true });
  }
  // a ring of bright paint whipped round the lasso
  if (VORT_X) {
    for (let i = 0; i < 10; i++) {
      const a0 = -t * 7 + i / 10 * TAU, R = 70 + 30 * hash(i);
      const pts = [0, 1, 2, 3].map(j => { const a = a0 + j * 0.16; return V(VORT_X.x + Math.cos(a) * R, VORT_X.y + Math.sin(a) * R, Z + 2); });
      st(pts, 6, i % 3 ? [0.9, 0.93, 0.95] : [1, 0.9, 0.5], { a: tw, dry: 0.3, h: 0.6, still: true, tip: 0.2 });
    }
  }
  // the stars: rings turn, twinkle on the hats, swell on the kick; pointing at one makes it flare
  const kick = hitPulse('kick', t, 0.12), hat = hitPulse('hat', t, 0.07);
  const pointing = b >= 80 && b < 84 && parity(Math.floor(b)) === 0 ? bump(b - Math.floor(b), 0.14, 0.13) : 0;
  const flareStar = [4, 3, 7, 1][Math.floor(b - 80) >> 0 & 3];
  for (let s = 0; s < STARS.length; s++) {
    const [sx, sy, k] = STARS[s];
    const fl = s === flareStar ? pointing : 0;
    const tw2 = hat * (0.5 + 0.5 * hash(s * 3.3 + Math.floor(t * 8)));
    const R = 22 * k * (1 + 0.12 * kick + 0.9 * fl);
    const rot = t * (0.4 + 0.25 * hash(s)) * (s % 2 ? 1 : -1);
    for (let i = 0; i < 9; i++) {
      const a0 = rot + i / 9 * TAU, a1 = a0 + 0.42;
      const pts = [0, 1, 2].map(j => { const a = lerp(a0, a1, j / 2); return V(sx + Math.cos(a) * R, sy + Math.sin(a) * R, Z + 1); });
      st(pts, (4 + 3 * fl) * k, mixc([0.98, 0.88, 0.5], [1, 1, 0.9], clamp(tw2 + fl, 0, 1)), { dry: 0.2, h: 0.7, still: true });
    }
    dab(V(sx, sy, Z + 1.5), 9 * k * (1 + 0.5 * tw2), 9 * k * (1 + 0.5 * tw2), [1, 0.98, 0.86], { h: 0.8, dry: 0.1, still: true });
    if (fl > 0.05) dab(V(sx, sy, Z + 1.6), 34 * k * fl, 34 * k * fl, [1.0, 0.95, 0.7], { kind: 1, a: 0.7 * fl, still: true });
  }
  const mr = 52 * (1 + 0.06 * kick);
  for (let i = 0; i < 16; i++) {
    const a0 = t * 0.22 + i / 16 * TAU, a1 = a0 + 0.28;
    const pts = [0, 1, 2].map(j => { const a = lerp(a0, a1, j / 2); return V(MOON_S.x + Math.cos(a) * mr, MOON_S.y + Math.sin(a) * mr, Z + 2); });
    st(pts, 6, [1.0, 0.88, 0.45], { dry: 0.2, h: 0.7, still: true });
  }
  // every note of the sparkling arpeggio lights a little star somewhere round him
  for (const [age, v, i] of recentHits('pluck', t, 0.42)) {
    const u = age / 0.42, a = hash(i * 1.37) * TAU, r = 55 + 70 * hash(i * 2.11);
    const p = V(J.chest.x + Math.cos(a) * r, J.chest.y + 20 + Math.sin(a) * r * 0.8, -40);
    const R = (8 + 7 * hash(i * 3.7)) * (1 - u * 0.6) * Math.min(1, v);
    const col = hash(i * 5.3) < 0.6 ? [1, 0.9, 0.55] : [0.9, 0.95, 1];
    st([vadd(p, V(-R, 0, 0)), vadd(p, V(R, 0, 0))], 2.4 * (1 - u), col, { a: 1 - u, still: true, exact: true, dry: 0.1, w0: 0.1, tip: 0.1, tS: 0.5, tE: 0.5 });
    st([vadd(p, V(0, -R, 0)), vadd(p, V(0, R, 0))], 2.4 * (1 - u), col, { a: 1 - u, still: true, exact: true, dry: 0.1, w0: 0.1, tip: 0.1, tS: 0.5, tE: 0.5 });
    dab(p, 12 * (1 - u), 12 * (1 - u), col, { kind: 1, a: 0.6 * (1 - u), still: true });
  }
  // a shooting star as he winks
  const ss = seg(b, 96.9, 98.3);
  if (ss > 0 && ss < 1) {
    const e = easeOutCubic(ss);
    const P0 = V(-470, 470, Z + 3), P1 = V(330, 300, Z + 3);
    const head = vlerp(P0, P1, e), tail = vlerp(P0, P1, Math.max(0, e - 0.32));
    st([tail, vlerp(tail, head, 0.6), head], [0.5, 3.5, 7], [1.0, 0.97, 0.82], { a: 0.95 * (1 - ss * 0.8), dry: 0.3, still: true, exact: true });
    dab(head, 14, 14, [1, 0.97, 0.8], { kind: 1, a: 0.85 * (1 - ss), still: true });
  }
  drawContact(J, 0.7);
}
// the theatre is swallowed by a whirlpool of brushstrokes, and the starry night pours out of it
function drawSwirlVortex(t, b, cx, cy) {
  const u = seg(b, B.swirl - 0.45, B.swirl + 1.4);
  if (u <= 0 || u >= 1) return;
  const grow = smoothstep(0, 0.3, u), fade = 1 - smoothstep(0.55, 1, u);
  const spin = 9 * (t - (B.swirl - 0.45) * BEAT) - 3 * u * u;
  const R = Math.hypot(CW, CH) * 0.62;
  const cols = [[0.2, 0.33, 0.63], [0.42, 0.6, 0.82], [0.72, 0.83, 0.86], [0.98, 0.86, 0.45], [0.12, 0.19, 0.47], [0.9, 0.92, 0.84]];
  for (let i = 0; i < 120; i++) {
    const r0 = R * (0.04 + 0.96 * Math.sqrt(hash(i * 1.7))) * (0.35 + 0.65 * grow);
    const a0 = i / 120 * TAU * 5 + spin * (0.6 + 0.4 * hash(i * 2.9)) * (1.2 - r0 / R);
    const len = (1.1 + 1.2 * hash(i * 4.1)) * fade;
    if (len < 0.05) continue;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const a = a0 + k / 5 * len, r = r0 * (1 - 0.12 * k / 5);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.82, w: (18 + 26 * hash(i * 3.3)) * DPR * (0.4 + 0.6 * grow) * (0.5 + r0 / R), c: cols[i % cols.length] });
    }
    strokeScreen(pts, { dry: 0.3, h: 0.6, tip: 0.25, still: true });
  }
}
// a whip-pan: long streaks of paint tear across the frame on the last beat of the spin, and
// the pop-art print slams in behind them
function drawWhipSmear(b) {
  const u = seg(b, B.pop - 0.42, B.pop);
  if (u <= 0 || u >= 1) return;
  const e = easeInCubic(u);
  const cols = [[0.55, 0.3, 0.2], [0.97, 0.35, 0.6], [1.0, 0.87, 0.18], [0.3, 0.22, 0.4], [0.72, 0.52, 0.31], [0.95, 0.9, 0.8]];
  for (let i = 0; i < 34; i++) {
    const y = (i + 0.5) / 34 * CH + (hash(i * 7.1) - 0.5) * CH / 34;
    const lead = e * 1.6 - hash(i * 3.3) * 0.6;
    if (lead <= 0) continue;
    const x1 = -0.1 * CW + lead * CW * 1.2, x0 = x1 - CW * (0.3 + 0.5 * hash(i * 1.9));
    const w = CH / 34 * (1.6 + hash(i * 5.7));
    strokeScreen([{ x: x0, y, w: w * 0.6, c: cols[i % 6] }, { x: (x0 + x1) / 2, y: y + (hash(i) - 0.5) * 6 * DPR, w, c: cols[(i + 3) % 6] }, { x: x1, y, w: w * 0.8, c: cols[(i + 1) % 6] }],
      { dry: 0.45, h: 0.6, still: true, tip: 0.4, w0: 0.2, rev: [NO_IN, NO_OUT], recv: 0 });
  }
}
// painted swooshes whipping round him while he spins
function drawSpinSwoosh(J, b) {
  let sp = 0;
  for (const s0 of [38, 72]) sp = Math.max(sp, Math.sin(Math.PI * seg(b, s0 + 0.4, s0 + 1.55)));
  if (sp < 0.05) return;
  const c = J.pelvis, yaw = J.pose.pyaw;
  const cols = [[1, 0.95, 0.85], [0.95, 0.8, 0.55], [0.9, 0.92, 1]];
  for (let k = 0; k < 3; k++) {
    const y = c.y - 35 + k * 42, r = 52 + 10 * k;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = yaw + Math.PI * 0.2 + i / 8 * 2.2 + k * 0.7; pts.push(V(c.x + Math.sin(a) * r, y + 4 * Math.sin(a * 2), c.z + Math.cos(a) * r * 0.5)); }
    st(pts, pts.map((_, i) => 1 + 5 * Math.sin(Math.PI * i / 8)), cols[k], { a: 0.55 * sp, dry: 0.6, exact: true, still: true, w0: 0.2, tip: 0.2 });
  }
}
// comic snap marks at his fingertips on every finger-snap
function drawSnapMarks(J, t, b) {
  if (b < 23.8 || b > 28.3) return;
  for (const [age] of recentHits('snap', t, 0.2)) {
    const u = age / 0.2;
    const fore = vnorm(vsub(J.wrF, J.elF));
    const tip = vmad(J.wrF, fore, 11);
    const q = G.proj(tip);
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.55 + 0.35;
      const r0 = (9 + 10 * u) * DPR, r1 = r0 + (8 - 5 * u) * DPR;
      strokeScreen([{ x: q.x + Math.cos(a) * r0, y: q.y + Math.sin(a) * r0, w: 2.2 * DPR, c: [1, 0.95, 0.8] }, { x: q.x + Math.cos(a) * r1, y: q.y + Math.sin(a) * r1, w: 1.4 * DPR, c: [1, 0.95, 0.8] }],
        { a: 1 - u, dry: 0.1, exact: true, still: true, tip: 0.3, rev: [NO_IN, NO_OUT] });
    }
  }
}
// a little star of light on a wink
function drawWinkGlint(J, amt) {
  if (amt < 0.05) return;
  const p = xf(J.head, J.Rh, 5.2, 3.2, 10.5);
  const q = G.proj(p);
  const r = 7 * DPR * amt;
  G.mid = ID.white;
  strokeScreen([{ x: q.x - r, y: q.y, w: 1.6 * DPR, c: [1, 0.97, 0.85] }, { x: q.x + r, y: q.y, w: 1.6 * DPR, c: [1, 0.97, 0.85] }], { dry: 0.1, exact: true, w0: 0.1, tip: 0.1, tS: 0.5, tE: 0.5, recv: ID.white / 10 });
  strokeScreen([{ x: q.x, y: q.y - r, w: 1.6 * DPR, c: [1, 0.97, 0.85] }, { x: q.x, y: q.y + r, w: 1.6 * DPR, c: [1, 0.97, 0.85] }], { dry: 0.1, exact: true, w0: 0.1, tip: 0.1, tS: 0.5, tE: 0.5, recv: ID.white / 10 });
}
