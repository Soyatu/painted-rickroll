// ============================================================================
// The starry night (after Van Gogh): a sky of brushstrokes laid along the
// streamlines of a flow field (an S-shaped double swirl, haloes round the stars
// and the moon), with dashes travelling down every streamline so the sky flows.
// A flame of cypress, a village with its spire, rolling hills, and the knoll
// he dances on. The mic lasso twists the field around itself.
// ============================================================================
const STAR = { skyZ: -1500, hillZ: -1350, villageZ: -1300 };
const STARS = [
  [-820, 740, 36], [-560, 800, 28], [-330, 720, 24], [-80, 790, 32], [150, 740, 22], [360, 800, 28],
  [-700, 480, 20], [700, 470, 24], [890, 690, 20], [-930, 560, 18], [520, 640, 18]
];
const MOON = { x: 790, y: 770, r: 64 };
const SWIRLS = [[-260, 560, 250, 1.25], [160, 500, 220, -1.05], [-700, 650, 150, 0.6], [560, 610, 150, -0.55]];

// the flow at a point of the sky plane (unit-ish vector)
function skyFlow(x, y) {
  let vx = 1, vy = 0.18 * Math.sin(x / 260 + y / 400) + 0.1 * Math.sin(y / 120);
  for (const [cx, cy, R, s] of SWIRLS) {
    const dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy, f = s * Math.exp(-r2 / (R * R)) * 2.4;
    vx += -dy / Math.max(40, Math.sqrt(r2)) * f;
    vy += dx / Math.max(40, Math.sqrt(r2)) * f;
  }
  for (const [cx, cy, r] of STARS.concat([[MOON.x, MOON.y, MOON.r]])) {
    const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy), R = r * 3.2;
    const f = Math.exp(-(d - r * 1.3) * (d - r * 1.3) / (R * R)) * 2.2;
    vx += -dy / Math.max(10, d) * f; vy += dx / Math.max(10, d) * f;
  }
  const l = Math.hypot(vx, vy) || 1;
  return [vx / l, vy / l];
}
function skyColour(x, y, rnd) {
  const blues = [[0.08, 0.16, 0.45], [0.13, 0.25, 0.6], [0.2, 0.36, 0.72], [0.32, 0.52, 0.8], [0.12, 0.2, 0.5]];
  let c = rnd.pick(blues);
  // lighter, greener near the swirls and the horizon; warm near stars and the moon
  let warm = 0;
  for (const [cx, cy, r] of STARS) warm = Math.max(warm, Math.exp(-Math.hypot(x - cx, y - cy) / (r * 2.2)));
  warm = Math.max(warm, Math.exp(-Math.hypot(x - MOON.x, y - MOON.y) / (MOON.r * 2.6)));
  let swirl = 0;
  for (const [cx, cy, R] of SWIRLS.slice(0, 2)) swirl = Math.max(swirl, Math.exp(-Math.pow(Math.hypot(x - cx, y - cy) - R * 0.55, 2) / (R * R * 0.08)));
  c = mix3(c, rnd.pick([[0.55, 0.72, 0.82], [0.72, 0.84, 0.86], [0.45, 0.6, 0.78]]), swirl * 0.7);
  c = mix3(c, [0.36, 0.5, 0.62], sat((300 - y) / 250) * 0.6);
  c = mix3(c, rnd.pick([[1, 0.9, 0.45], [0.95, 0.85, 0.6], [1, 0.95, 0.75]]), sat(warm * 1.4) * 0.85);
  return c;
}
function streamline(x, y, n, step, dir) {
  const pts = [[x, y]];
  for (let i = 0; i < n; i++) {
    const [vx, vy] = skyFlow(x, y);
    x += vx * step * dir; y += vy * step * dir;
    pts.push([x, y]);
  }
  return pts;
}

function buildStarry() {
  const rnd = rng(1889);
  const SZ = STAR.skyZ;
  const U = 0.9;
  // underpainting: broad blue washes so nothing shows between the streaks
  for (let y = 120; y < 1300; y += 70) wst([V(-1500, y, SZ - 2), V(0, y + 10, SZ - 2), V(1500, y, SZ - 2)], 110, mix3([0.1, 0.18, 0.46], [0.24, 0.38, 0.6], sat((500 - y) / 400)),
    { recv: 0, dry: 0.1, h: 0.1, unit: U, sq: 0.6 });
  // the sky: two layers of streamline strokes, the upper one flowing
  for (let layer = 0; layer < 2; layer++) {
    const gap = layer === 0 ? 34 : 46;
    for (let gy = 150; gy < 1050; gy += gap) for (let gx = -1300; gx < 1300; gx += gap) {
      const x = gx + (rnd() - 0.5) * gap, y = gy + (rnd() - 0.5) * gap;
      const back = streamline(x, y, 3 + ((rnd() * 3) | 0), 16, -1).reverse();
      const fwd = streamline(x, y, 4 + ((rnd() * 5) | 0), 16, 1);
      const pts = back.concat(fwd.slice(1)).map(([px, py]) => V(px, py, SZ + layer * 0.5));
      const c = skyColour(x, y, rnd);
      const o = { recv: 0, dry: 0.3 + rnd() * 0.2, h: 0.5, unit: U, w0: 0.5, tip: 0.35, stir: true };
      if (layer === 1) { o.dash = 60 + rnd() * 50; o.dspd = 45 + rnd() * 30; }
      wst(pts, (layer === 0 ? 17 : 13) + rnd() * 5, c, o);
    }
  }
  // stars: concentric rings of short strokes round a hot core
  for (const [sx, sy, r] of STARS) {
    wdab(V(sx, sy, SZ + 2), r * 5, r * 5, [0.5, 0.55, 0.45], { recv: 0, kind: 1, a: 0.35, unit: U });
    for (let ring = 3; ring >= 1; ring--) {
      const rr = r * (0.45 + ring * 0.42), n = 10 + ring * 5;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU + rnd() * 0.2, a1 = a0 + TAU / n * 0.85;
        const pts = [a0, (a0 + a1) / 2, a1].map(a => V(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, SZ + 3));
        wst(pts, r * 0.34, ring === 1 ? [1, 0.96, 0.7] : ring === 2 ? [0.98, 0.86, 0.36] : [0.78, 0.84, 0.62], { recv: 0, dry: 0.35, h: 0.6, unit: U, stir: true });
      }
    }
    wdab(V(sx, sy, SZ + 4), r * 0.7, r * 0.7, [1, 1, 0.9], { recv: 0, unit: U, stir: true });
  }
  // the crescent moon in its halo
  for (let ring = 4; ring >= 1; ring--) {
    const rr = MOON.r * (0.9 + ring * 0.38), n = 16 + ring * 4;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = a0 + TAU / n * 0.85;
      wst([a0, (a0 + a1) / 2, a1].map(a => V(MOON.x + Math.cos(a) * rr, MOON.y + Math.sin(a) * rr, SZ + 3)), MOON.r * 0.3,
        ring % 2 ? [1, 0.84, 0.3] : [0.95, 0.66, 0.2], { recv: 0, dry: 0.3, h: 0.6, unit: U });
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = -1.1 + i * 0.3;
    wst([V(MOON.x + Math.cos(a) * MOON.r * 0.3, MOON.y + Math.sin(a) * MOON.r * 0.9, SZ + 4), V(MOON.x + Math.cos(a) * MOON.r, MOON.y + Math.sin(a) * MOON.r, SZ + 4)],
      MOON.r * 0.3, [1, 0.93, 0.55], { recv: 0, dry: 0.2, h: 0.7, unit: U });
  }
  // hills behind the village: long wavy strokes of blue and green
  for (let y = 0; y < 300; y += 16) {
    let x = -1600;
    while (x < 1600) {
      const len = 200 + rnd() * 240;
      const hy = (xx) => y * 0.9 + 60 * Math.sin(xx / 300 + y / 90) * sat(1 - y / 320);
      wst([V(x, hy(x), STAR.hillZ), V(x + len / 2, hy(x + len / 2) + 6, STAR.hillZ), V(x + len, hy(x + len), STAR.hillZ)], 20,
        mix3(rnd.pick([[0.12, 0.22, 0.42], [0.16, 0.3, 0.46], [0.2, 0.34, 0.4], [0.1, 0.18, 0.32]]), [0.25, 0.4, 0.5], sat(y / 300) * 0.3),
        { recv: 0, dry: 0.35, h: 0.5, unit: U });
      x += len * 0.8;
    }
  }
  // the village: little blocks and roofs, lit windows, and the church spire
  const VZ = STAR.villageZ;
  for (let x = -900; x < 900; x += 60 + rnd() * 50) {
    const h = 30 + rnd() * 40, w = 40 + rnd() * 30, y0 = 40 + Math.sin(x / 200) * 20;
    const c = mix3([0.1, 0.14, 0.3], [0.18, 0.24, 0.42], rnd());
    wst([V(x, y0, VZ), V(x, y0 + h, VZ)], w, c, { recv: 0, sq: 0.95, w0: 1, tip: 1, unit: U });
    wst([V(x - w / 2, y0 + h, VZ + 0.5), V(x, y0 + h + 22, VZ + 0.5), V(x + w / 2, y0 + h, VZ + 0.5)], 7, [0.24, 0.26, 0.36], { recv: 0, unit: U });
    if (rnd() < 0.7) wdab(V(x + (rnd() - 0.5) * w * 0.5, y0 + h * 0.5, VZ + 1), 8, 9, [1, 0.85, 0.35], { recv: 0, unit: U });
  }
  wst([V(-80, 60, VZ + 2), V(-80, 150, VZ + 2)], 42, [0.1, 0.13, 0.28], { recv: 0, sq: 0.95, w0: 1, tip: 1, unit: U });
  wst([V(-80, 150, VZ + 2), V(-80, 330, VZ + 2)], [30, 2], [0.1, 0.13, 0.28], { recv: 0, unit: U });
  // the cypress, a dark flame rising out of the foreground on the left
  const CX = -250, CZ = -250;
  for (let i = 0; i < 26; i++) {
    const f = i / 26;
    const x = CX + (rnd() - 0.5) * 70 * (1 - f * 0.7);
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const u = k / 5, y = -10 + u * (560 + rnd() * 160) * (0.5 + f * 0.5);
      pts.push(V(x + Math.sin(u * 5 + i) * 18 * (1 - u), y, CZ + i * 0.2));
    }
    wst(pts, 26 - f * 12, mix3([0.05, 0.1, 0.07], [0.12, 0.22, 0.12], rnd() * (1 - f * 0.5)), { recv: 0, dry: 0.3, h: 0.7, tip: 0.1, unit: 1.6 });
  }
  for (let i = 0; i < 14; i++) {
    const y = 60 + rnd() * 520, x = CX + (rnd() - 0.5) * 60;
    wst([V(x - 14, y, CZ + 6), V(x, y + 40, CZ + 6), V(x + 10, y + 70, CZ + 6)], 7, [0.2, 0.34, 0.18], { recv: 0, a: 0.7, dry: 0.4, h: 0.6, unit: 1.6 });
  }
  // the knoll: swirling strokes of green and ochre grass
  for (let z = -300; z < 260; z += 11) {
    let x = -900 + rnd() * 40;
    while (x < 900) {
      const len = 50 + rnd() * 70;
      const c = rnd.pick([[0.2, 0.3, 0.16], [0.32, 0.4, 0.18], [0.46, 0.44, 0.2], [0.16, 0.26, 0.2], [0.55, 0.5, 0.24]]);
      const cy = (xx, zz) => 8 * Math.sin(xx / 70 + zz / 40);
      wst([V(x, 0, z), V(x + len / 2, 0, z + cy(x, z)), V(x + len, 0, z + cy(x + len, z) * 0.5)], 11, mix3(c, [0.1, 0.16, 0.3], sat((-z - 100) / 300) * 0.5),
        { recv: 1, dry: 0.35, h: 0.55 }, true);
      x += len * 0.75;
    }
  }
}

// the mic's trail, flung round in bright strokes that stir the sky
function drawLassoSwirl(J, b, cam) {
  const on = J.pose.lasso;
  if (on < 0.05) return;
  const mf = micFrame(J, SIM.mic.d);
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = J.pose.lassoA - i * 0.22 - k * 0.12;
      const tilt = J.pose.lassoTilt;
      const r = J.pose.lassoR + 26 + k * 10;
      const radial = vadd(vmul(V(1, 0, 0), Math.cos(a)), vmul(vnorm(V(0, Math.sin(tilt), Math.cos(tilt))), Math.sin(a)));
      pts.push(vmad(mf.hub, radial, r));
    }
    st(pts, pts.map((_, i) => (7 - k * 1.5) * (1 - i / 11)), k === 0 ? [1, 0.93, 0.6] : [0.7, 0.85, 1.0],
      { a: on * (0.8 - k * 0.2), dry: 0.4, h: 0.4, tip: 0.1, exact: true });
  }
}

const S_STAR = {
  name: 'starry',
  build: buildStarry,
  figure: () => true,
  camera(b, t, J) {
    const kick = REDUCED ? 0 : hitEnv('kick', t, 0.12);
    const breathe = Math.sin((b - 72) / 16 * Math.PI) * 0.05;
    const viewH = 330 * (1 - breathe) * (1 - 0.025 * kick);
    const tx = J.pelvis.x * 0.3;
    // the ta-da: a push in, and hold
    const tada = easeOut((b - 100) / 1.2, 3) * 0.16;
    return makeCam(V(tx, 150, 640), V(tx, 215 - 70 * tada, -300), 2 * Math.atan((viewH * (1 - tada) / 2) / 640), 0);
  },
  lights(b, t, J, cam) {
    const hat = hitEnv('hat', t, 0.1), crash = hitEnv('crash', t, 0.6);
    // the lasso's hub, projected onto the sky plane, is where the sky gets stirred
    let stir = null;
    if (J.pose.lasso > 0.02) {
      const hub = micFrame(J, SIM.mic.d).hub;
      const d = vsub(hub, cam.pos);
      const k = (STAR.skyZ - cam.pos.z) / d.z;
      const hp = vmad(cam.pos, d, k);
      stir = [hp.x, hp.y, -2.6 * sstep(88, 92, b) * (1 - sstep(95.5, 97.5, b)), 420];
    }
    return {
      key: { dir: vnorm(V(0.55, 0.6, 0.5)), col: [1.0, 0.96, 0.82], int: 1.05 + 0.2 * crash },
      rim: { dir: vnorm(V(-0.6, 0.25, -0.4)), col: [1.1, 0.82, 0.5], int: 0.9 },
      amb: [0.86, 0.9, 1.04],
      stir, bgJit: 0.8,
      comp: { amb: [1, 1, 1], time: t, relief: 2.4, expo: 1 + 0.04 * hat + 0.12 * crash, ground: [0.08, 0.12, 0.3] }
    };
  },
  dynamic(b, t, J, cam) {
    // stars flare on the hi-hats and the crashes
    const hat = hitEnv('hat', t, 0.12), crash = hitEnv('crash', t, 0.5);
    for (let i = 0; i < STARS.length; i++) {
      const [sx, sy, r] = STARS[i];
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1);
      dab(V(sx, sy, STAR.skyZ + 5), r * (2.2 + 1.2 * hat * (i % 3 === 0 ? 1 : 0.4) + 3 * crash), r * 2.6, [1, 0.95, 0.7], { kind: 1, a: 0.18 + 0.12 * tw + 0.3 * crash, still: true });
    }
    drawLassoSwirl(J, b, cam);
    // his contact shadow on the grass
    dab(V(J.pelvis.x, 0.3, 4), 10, 80, [0.04, 0.06, 0.1], { kind: 1, a: 0.5, ang: 0, still: true });
  }
};
