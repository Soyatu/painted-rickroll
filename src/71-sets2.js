// ---------------------------------------------------------------- 3. pop-art prints: a brushed ground
// Neutral greys only: the composite turns them into each print's flat ink colour.
function buildPopGround() {
  const rnd = mulberry(1962);
  const W = WALL_Z;
  for (let y = -300; y < 700; y += 26) {
    let x = -900 + rnd() * 80;
    while (x < 900) {
      const len = 180 + rnd() * 260;
      const g = 0.35 + rnd() * 0.3;
      const tilt = (rnd() - 0.5) * 30;
      wst([V(x, y, W), V(x + len * 0.5, y + tilt * 0.5 + (rnd() - 0.5) * 8, W), V(x + len, y + tilt, W)], 44 + rnd() * 20, [g, g, g], { dry: 0.55, h: 0.3 });
      x += len * (0.65 + rnd() * 0.25);
    }
  }
}

// ---------------------------------------------------------------- 4. the theatre
// A cream cyclorama that catches his shadow, stage boards, red velvet legs; the proscenium
// drapes and valance hang in front of him (a separate buffer drawn over the dancer).
const RED = [[0.3, 0.02, 0.05], [0.44, 0.04, 0.07], [0.58, 0.07, 0.1], [0.72, 0.12, 0.13]];
const THEA_CX = 58;          // the proscenium is centred on the theatre camera, not on him
function buildTheatreBack() {
  const rnd = mulberry(4242);
  const W = WALL_Z, X = THEA_CX;
  // underpainting, then the cyclorama cloth in broad vertical strokes with soft folds
  for (let x = -820; x < 820; x += 34) wst([V(x, -40, W - 0.4), V(x, 280, W - 0.4), V(x, 620, W - 0.4)], 56, [0.62, 0.53, 0.4], { recv: 1, dry: 0.04, h: 0.08 });
  for (let x = -780; x < 780; x += 14) {
    const fold = 0.5 + 0.5 * Math.sin(x / 38 + Math.sin(x / 97) * 1.5);
    const base = mixc([0.66, 0.56, 0.41], [0.84, 0.75, 0.57], fold);
    let y = -30;
    while (y < 620) {
      const len = 120 + rnd() * 180;
      wst([V(x + (rnd() - 0.5) * 4, y, W), V(x + (rnd() - 0.5) * 6, y + len / 2, W), V(x + (rnd() - 0.5) * 4, y + len, W)], 20, scalec(base, 0.93 + rnd() * 0.12), { recv: 1, dry: 0.22, h: 0.2 });
      y += len * 0.78;
    }
  }
  // velvet legs framing the cyclorama
  for (const sg of [-1, 1]) {
    for (let i = 0; i < 26; i++) {
      const x = X + sg * (370 + i * 15);
      const c = RED[(i * 3 + (sg > 0 ? 1 : 0)) % 4];
      wst([V(x, -10, W + 1), V(x + (rnd() - 0.5) * 6, 250, W + 1), V(x, 620, W + 1)], 17, c, { recv: 1, dry: 0.25, h: 0.4 });
    }
    wst([V(X + sg * 366, -10, W + 1.2), V(X + sg * 364, 300, W + 1.2), V(X + sg * 366, 620, W + 1.2)], 5, RED[3], { recv: 1, dry: 0.4 });
  }
  // polished stage boards running toward us: long planks, seams, butt joints
  for (let z = WALL_Z; z < 300; z += 60) wst([V(-820, -0.3, z), V(0, -0.3, z), V(820, -0.3, z + 30)], 70, [0.3, 0.18, 0.1], { recv: 1, dry: 0.04, h: 0.05, gloss: 0.6 }, true);
  for (let x = -800; x < 800; x += 16) {
    const c = [0.38 + rnd() * 0.1, 0.23 + rnd() * 0.06, 0.12 + rnd() * 0.04];
    wst([V(x, 0, WALL_Z), V(x + (rnd() - 0.5) * 2, 0, 80), V(x + (rnd() - 0.5) * 2, 0, 300)], 14.5, scalec(c, 0.92 + rnd() * 0.16), { recv: 1, gloss: 0.7, dry: 0.18, h: 0.25, sq: 1, w0: 1, tip: 1 });
    wst([V(x + 3 - 4 * rnd(), 0.03, WALL_Z), V(x + 3, 0.03, 300)], 2.2, scalec(c, 1.35), { recv: 1, a: 0.35, dry: 0.6, gloss: 0.9 }, true);
    wst([V(x + 8, 0.05, WALL_Z), V(x + 8, 0.05, 300)], 1.1, [0.08, 0.045, 0.025], { recv: 0.8, a: 0.85 }, true);
    for (let z = WALL_Z + rnd() * 120; z < 290; z += 110 + rnd() * 90) wst([V(x - 7, 0.06, z), V(x + 7, 0.06, z)], 1.0, [0.1, 0.06, 0.03], { recv: 0.8, a: 0.7 }, true);
  }
  // a skirting of black at the foot of the cyclorama, and a spike mark where he stands
  wst([V(-780, 3, W + 1.5), V(780, 3, W + 1.5)], 7, [0.06, 0.04, 0.04], { recv: 0.5 });
  wst([V(-9, 0.1, -6), V(9, 0.1, 10)], 2.2, [0.85, 0.8, 0.6], { recv: 1, a: 0.8 }, true);
  wst([V(9, 0.1, -6), V(-9, 0.1, 10)], 2.2, [0.85, 0.8, 0.6], { recv: 1, a: 0.8 }, true);
}
const THEA_FZ = 190;
function buildTheatreFront() {
  const rnd = mulberry(777);
  const Z = THEA_FZ, X = THEA_CX;
  for (const sg of [-1, 1]) {
    // gathered side drapes, pulled back by a tie at about waist height
    for (let i = 0; i < 18; i++) {
      const f = i / 17;
      const xTop = X + sg * (150 + f * 300), xTie = X + sg * (176 + f * 200), xBot = X + sg * (158 + f * 280);
      const c = mixc(RED[0], RED[2], 0.5 + 0.5 * Math.sin(i * 1.9 + (sg > 0 ? 1 : 0)));
      wst([V(xTop, 440, Z), V(lerp(xTop, xTie, 0.75), 190, Z), V(xTie, 100, Z), V(xBot, 30, Z), V(xBot + sg * 12, -60, Z)], 23, c, { recv: 0.7, dry: 0.25, h: 0.45, gloss: 0.3 });
    }
    for (let i = 0; i < 9; i++) {
      const f = (i + 0.5) / 9;
      const xTop = X + sg * (160 + f * 290), xTie = X + sg * (182 + f * 195), xBot = X + sg * (165 + f * 270);
      wst([V(xTop, 430, Z + 0.5), V(lerp(xTop, xTie, 0.75), 190, Z + 0.5), V(xTie, 102, Z + 0.5), V(xBot, 34, Z + 0.5)], 3.5, RED[3], { recv: 0.7, a: 0.7, dry: 0.5, h: 0.5 });
    }
    wst([V(X + sg * 150, 440, Z + 0.6), V(X + sg * 160, 200, Z + 0.6), V(X + sg * 176, 102, Z + 0.6), V(X + sg * 158, 30, Z + 0.6), V(X + sg * 170, -60, Z + 0.6)], 3, [0.85, 0.3, 0.25], { recv: 0.7, a: 0.8, dry: 0.4 });
    wst([V(X + sg * 168, 104, Z + 1), V(X + sg * 230, 94, Z + 1), V(X + sg * 300, 100, Z + 1)], 3, [0.75, 0.55, 0.2], { recv: 0.7, dry: 0.2, h: 0.5 });
    wst([V(X + sg * 172, 98, Z + 1.2), V(X + sg * 172, 70, Z + 1.2)], 7, [0.85, 0.65, 0.25], { recv: 0.7, dry: 0.3, h: 0.6, tip: 0.2, w0: 0.7 });
    wdab(V(X + sg * 172, 102, Z + 1.3), 6, 6, [0.95, 0.78, 0.35], { recv: 0.7, h: 0.6 });
  }
  // the valance: a row of swags with a gold fringe
  for (let k = -4; k <= 4; k++) {
    const cx = X + k * 120;
    for (let j = 0; j < 5; j++) {
      const c = RED[(j + 4 + k) % 4];
      const dip = 232 + j * 9;
      wst([V(cx - 72, 330, Z + 2), V(cx - 40, dip + 18, Z + 2), V(cx, dip, Z + 2), V(cx + 40, dip + 18, Z + 2), V(cx + 72, 330, Z + 2)], 14, c, { recv: 0.7, dry: 0.25, h: 0.45 });
    }
    for (let x = cx - 60; x <= cx + 60; x += 6) {
      const u = (x - cx) / 72, y = 232 + 26 * u * u - 4;
      wst([V(x, y, Z + 3), V(x + (rnd() - 0.5), y - 8, Z + 3)], 2.2, [0.85, 0.66, 0.27], { recv: 0.7, dry: 0.4, h: 0.5 });
    }
    wdab(V(cx + 60, 318, Z + 3), 10, 10, [0.8, 0.6, 0.22], { recv: 0.7, h: 0.6 });
  }
  wst([V(-800, 336, Z + 3.5), V(900, 336, Z + 3.5)], 16, [0.65, 0.48, 0.18], { recv: 0.7, dry: 0.3, h: 0.6 });
}

// ---------------------------------------------------------------- 5. the starry night
// A sky of thick swirling strokes that follow a flow field, a crescent moon, ringed stars,
// hills and a sleeping village, and the black flame of a cypress (after Van Gogh, 1889).
const SKY_Z = -400, CYP_Z = -220;
const VORT = [
  { x: -40, y: 272, r: 125, s: 1.55 },
  { x: 105, y: 300, r: 78, s: -1.15 },
  { x: -300, y: 335, r: 72, s: 0.95 }
];
const MOON_S = V(300, 302, SKY_Z + 2);
const STARS = [[-330, 245, 1.0], [-185, 350, 0.85], [-108, 168, 0.7], [30, 368, 0.8], [196, 206, 0.78], [150, 385, 0.62], [-262, 142, 0.6],
               [388, 196, 0.72], [-440, 370, 0.82], [440, 110, 0.6], [-20, 122, 0.52], [480, 330, 0.7]];
const SKYC = {
  horizon: [0.37, 0.53, 0.66], mid: [0.2, 0.33, 0.63], top: [0.12, 0.19, 0.47], deep: [0.07, 0.11, 0.31],
  cer: [0.42, 0.6, 0.82], pale: [0.72, 0.83, 0.86], white: [0.9, 0.92, 0.84], teal: [0.25, 0.46, 0.5], gold: [0.98, 0.86, 0.45]
};
let VORT_X = null;   // an extra, transient vortex (the mic lasso stirs the sky)
function skyFlow(x, y) {
  let vx = 1, vy = 0.3 * Math.sin(x / 150 + 0.8) + 0.1 * Math.sin(x / 57 - y / 43);
  const add = v => {
    const dx = x - v.x, dy = y - v.y, d2 = dx * dx + dy * dy, R2 = v.r * v.r;
    const f = v.s * Math.exp(-d2 / R2) * 1.15 / Math.sqrt(d2 / R2 + 0.08);
    const d = Math.sqrt(d2) + 1e-3;
    vx += -dy / d * f; vy += dx / d * f;
  };
  for (const v of VORT) add(v);
  if (VORT_X && VORT_X.s) add(VORT_X);
  const l = Math.hypot(vx, vy) || 1;
  return [vx / l, vy / l, l];
}
// 0..1: inside the bright bands that ring each whirlpool, and the long wave across the sky
function swirlBand(x, y) {
  let s = 0;
  for (const v of VORT) {
    const d = Math.hypot(x - v.x, y - v.y);
    s = Math.max(s, Math.exp(-Math.pow((d - 0.6 * v.r) / (0.2 * v.r), 2)));
  }
  const wave = 208 + 34 * Math.sin(x / 140 + 1.2);
  s = Math.max(s, 0.8 * Math.exp(-Math.pow((y - wave) / 16, 2)) * smoothstep(-420, -200, x) * (1 - smoothstep(260, 460, x)));
  return s;
}
function glowAt(x, y) {
  let g = Math.exp(-(Math.pow(x - MOON_S.x, 2) + Math.pow(y - MOON_S.y, 2)) / (70 * 70));
  for (const [sx, sy, k] of STARS) g = Math.max(g, 0.8 * Math.exp(-(Math.pow(x - sx, 2) + Math.pow(y - sy, 2)) / Math.pow(30 * k, 2)));
  return g;
}
function skyColor(x, y, r1, r2) {
  const h = smoothstep(-20, 420, y);
  let c = h < 0.5 ? mixc(SKYC.horizon, SKYC.mid, h * 2) : mixc(SKYC.mid, SKYC.top, (h - 0.5) * 2);
  if (r1 < 0.13) c = mixc(c, SKYC.deep, 0.6);
  else if (r1 < 0.3) c = mixc(c, SKYC.cer, 0.55);
  else if (r1 < 0.37) c = mixc(c, SKYC.teal, 0.55);
  c = mixc(c, r2 < 0.55 ? SKYC.pale : SKYC.white, swirlBand(x, y) * (0.45 + 0.5 * r2));
  c = mixc(c, SKYC.gold, glowAt(x, y) * 0.55);
  return c;
}
function buildStarry() {
  const rnd = mulberry(1889);
  const Z = SKY_Z;
  // underpainting
  for (let y = -200; y < 560; y += 26) {
    for (let x = -660; x < 660; x += 260) wst([V(x, y, Z - 0.5), V(x + 150, y, Z - 0.5), V(x + 300, y, Z - 0.5)], 50, scalec(skyColor(x, y, 0.5, 0.5), 0.85), { dry: 0.05, h: 0.1 });
  }
  // the sky, stroke by stroke along the flow
  for (let gy = -170; gy < 560; gy += 15) {
    for (let gx = -600; gx < 600; gx += 15) {
      let x = gx + (rnd() - 0.5) * 13, y = gy + (rnd() - 0.5) * 13;
      const r1 = rnd(), r2 = rnd();
      const c0 = skyColor(x, y, r1, r2);
      const pts = [];
      for (let k = 0; k < 5; k++) {
        pts.push(V(x, y, Z));
        const f = skyFlow(x, y);
        x += f[0] * 8; y += f[1] * 8;
      }
      wst(pts, 8 + rnd() * 3.5, c0, { dry: 0.28, h: 0.6, w0: 0.7, tip: 0.35, c2: mixc(c0, [1, 1, 1], 0.12) });
    }
  }
  // halos: concentric rings of dashes round the moon and stars
  const ring = (cx, cy, r, n, col, w, rot) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i + rnd() * 0.4) / n * TAU + (rot || 0), a1 = a0 + TAU / n * 0.72;
      const pts = [];
      for (let k = 0; k <= 3; k++) { const a = lerp(a0, a1, k / 3); pts.push(V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Z + 1)); }
      wst(pts, w, col, { dry: 0.22, h: 0.65, tip: 0.4 });
    }
  };
  for (const [sx, sy, k] of STARS) {
    ring(sx, sy, 34 * k, 13, [0.46, 0.6, 0.78], 6.5, 0.3);
    ring(sx, sy, 25 * k, 11, [0.93, 0.9, 0.7], 6, 0);
    ring(sx, sy, 16 * k, 8, [0.99, 0.88, 0.45], 5.5, 0.5);
    wdab(V(sx, sy, Z + 1.5), 11 * k, 11 * k, [1.0, 0.97, 0.8], { h: 0.8, dry: 0.1 });
  }
  ring(MOON_S.x, MOON_S.y, 76, 20, [0.62, 0.7, 0.62], 8, 0.2);
  ring(MOON_S.x, MOON_S.y, 60, 17, [0.98, 0.84, 0.42], 8, 0);
  ring(MOON_S.x, MOON_S.y, 46, 14, [1.0, 0.92, 0.58], 7, 0.4);
  wdab(V(MOON_S.x, MOON_S.y, Z + 1.6), 62, 62, [1.0, 0.86, 0.45], { kind: 1, a: 0.45 });
  for (let i = 0; i < 10; i++) {
    const a0 = -1.95 + i * 0.05, r = 30 - i * 1.3;
    const pts = [];
    for (let k = 0; k <= 6; k++) { const a = a0 + k / 6 * (Math.PI + 0.95 - i * 0.07); pts.push(V(MOON_S.x + Math.cos(a) * r, MOON_S.y + Math.sin(a) * r * 1.05, Z + 2)); }
    wst(pts, 6, mixc([1.0, 0.84, 0.28], [0.99, 0.6, 0.1], i / 9), { dry: 0.12, h: 0.8 });
  }
  // hills: three ridges, far to near
  const ridges = [
    { y: x => 72 + 20 * Math.sin(x / 120 + 1) + 10 * Math.sin(x / 47), c: [[0.24, 0.36, 0.56], [0.33, 0.46, 0.62]] },
    { y: x => 44 + 16 * Math.sin(x / 95 + 2.5) + 7 * Math.sin(x / 33), c: [[0.14, 0.24, 0.42], [0.2, 0.34, 0.46]] },
    { y: x => 14 + 12 * Math.sin(x / 140 + 0.3), c: [[0.08, 0.16, 0.28], [0.14, 0.26, 0.3]] }
  ];
  for (const R of ridges) {
    for (let y0 = -300; y0 < 110; y0 += 8) {
      let x = -640 + rnd() * 40;
      while (x < 640) {
        const len = 44 + rnd() * 60;
        const pts = [];
        let ok = true;
        for (let k = 0; k <= 3; k++) {
          const xx = x + len * k / 3;
          const top = R.y(xx);
          const yy = Math.min(y0 + (top - 70) * 0.35, top - 5);
          if (y0 > top - 4) ok = false;
          pts.push(V(xx, yy, Z + 3));
        }
        if (ok) wst(pts, 9.5, mixc(R.c[0], R.c[1], rnd()), { dry: 0.3, h: 0.5 });
        x += len * 0.8;
      }
    }
    for (let x = -640; x < 640; x += 28) wst([V(x, R.y(x) - 2, Z + 3.2), V(x + 30, R.y(x + 30) - 2, Z + 3.2)], 4, mixc(R.c[1], [0.55, 0.66, 0.72], 0.45), { dry: 0.35, h: 0.45 });
  }
  // the village asleep in the valley, windows lit, one church spire
  for (let i = 0; i < 36; i++) {
    const x = -330 + i * 19 + (rnd() - 0.5) * 8, base = 4 + (rnd() - 0.5) * 8;
    const h = 12 + rnd() * 10, w = 14 + rnd() * 6;
    const c = [[0.16, 0.22, 0.4], [0.2, 0.3, 0.38], [0.14, 0.26, 0.3], [0.3, 0.3, 0.36]][(rnd() * 4) | 0];
    wst([V(x, base, Z + 4), V(x, base + h, Z + 4)], w, c, { dry: 0.2, h: 0.45, sq: 0.8, w0: 1, tip: 1 });
    wst([V(x - w * 0.6, base + h, Z + 4.2), V(x, base + h + 7, Z + 4.2), V(x + w * 0.6, base + h, Z + 4.2)], 3.5, [0.08, 0.1, 0.2], { dry: 0.2 });
    const nw = rnd() < 0.8 ? 1 + (rnd() < 0.4 ? 1 : 0) : 0;
    for (let k = 0; k < nw; k++) wdab(V(x + (k - 0.5 * (nw - 1)) * w * 0.4, base + h * 0.45, Z + 4.4), 3.6, 3.4, rnd() < 0.5 ? [1.0, 0.86, 0.32] : [1.0, 0.68, 0.18], { h: 0.7, dry: 0.1 });
  }
  wst([V(60, 2, Z + 4.6), V(60, 36, Z + 4.6)], 18, [0.14, 0.2, 0.36], { sq: 0.8, w0: 1, tip: 1 });
  wst([V(60, 36, Z + 4.7), V(60, 122, Z + 4.7)], [11, 1], [0.1, 0.14, 0.3], { tip: 0.1, w0: 1 });
  wdab(V(60, 20, Z + 4.8), 3.6, 4.2, [1.0, 0.82, 0.3], { h: 0.7 });
  // the cypress: a dark flame of rising, twisting licks, lit olive on the moon side
  const cx = -238, base = -170, top = 470;
  const widthAt = y => { const u = clamp((y - base) / (top - base), 0, 1); return 72 * Math.pow(1 - u, 0.8) * (1 + 0.18 * Math.sin(u * 15 + 1)); };
  const licks = [];
  for (let i = 0; i < 110; i++) licks.push({ u0: Math.pow(rnd(), 0.75) * 0.88, side: rnd() * 2 - 1, len: 60 + rnd() * 150, ph: rnd() * 6, w: 7 + rnd() * 5, r: rnd() });
  licks.sort((p, q) => Math.abs(q.side) - Math.abs(p.side));   // the outer licks first, the core on top
  for (const L of licks) {
    const y0 = lerp(base, top, L.u0), len = L.len * (1 - L.u0 * 0.45);
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, y = Math.min(y0 + len * f, top + 10);
      const w = widthAt(y);
      pts.push(V(cx + L.side * w * (1 - 0.25 * f) + Math.sin(f * 4 + L.ph) * 9 * f + L.side * 16 * f * f, y, CYP_Z));
    }
    const lit = smoothstep(0.25, 0.9, L.side), shadow = smoothstep(-0.2, -0.85, L.side);
    let c = [[0.02, 0.045, 0.03], [0.04, 0.08, 0.05], [0.055, 0.1, 0.06], [0.03, 0.06, 0.04]][(L.r * 4) | 0];
    c = mixc(c, L.r < 0.5 ? [0.22, 0.26, 0.1] : [0.3, 0.23, 0.08], lit * (0.4 + 0.45 * L.r));
    c = mixc(c, [0.04, 0.07, 0.18], shadow * 0.65);
    wst(pts, L.w, c, { dry: 0.22, h: 0.8, tip: 0.12, w0: 0.75 });
  }
  // the meadow on his hilltop
  for (let z = WALL_Z; z < 320; z += 6.5) {
    let x = -760 + rnd() * 30;
    const k = clamp((z - WALL_Z) / 460, 0, 1);
    while (x < 760) {
      const len = 22 + rnd() * 26;
      const c = [[0.26, 0.38, 0.22], [0.46, 0.46, 0.2], [0.22, 0.32, 0.42], [0.54, 0.44, 0.22], [0.16, 0.28, 0.2], [0.34, 0.44, 0.34]][(rnd() * 6) | 0];
      const cc = mixc(scalec(c, 0.6), c, k);
      const zc = z + 5 * Math.sin(x / 40 + z / 30);
      wst([V(x, 0, zc), V(x + len * 0.5, 0, zc + 3 * Math.sin(x / 23)), V(x + len, 0, zc + (rnd() - 0.5) * 5)], 7, cc, { dry: 0.3, h: 0.55 }, true);
      x += len * (0.7 + rnd() * 0.2);
    }
  }
}
