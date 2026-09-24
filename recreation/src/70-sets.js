// ============================================================================
// Sets I: the brick railway arch, and the river nocturne (after Whistler).
// Each set paints its static strokes once in world space; per-frame scenery is
// painted into a dynamic layer.
// ============================================================================
// texture scale for world strokes at depth z: roughly css px per cm from the usual camera
const unitAt = z => 3.2 * 560 / Math.max(200, 560 - z);

// world stroke on a vertical plane (z = const) or the floor, with texture scale for its depth
function wst(pts, w, col, o, floor) {
  o = o || {};
  if (!o.unit) o.unit = unitAt(pts[0].z);
  strokeWorld(pts, w, col, o, floor ? V(0, 1, 0) : V(0, 0, 1));
}
const wdab = (p, w, len, col, o) => wst([V(p.x - len / 2, p.y, p.z), V(p.x + len / 2, p.y, p.z)], w, col, o);

// ---------------------------------------------------------------- the railway arch
const ARCH = {
  wallZ: -150, R: 104, spring: 128,
  inside(x, y, pad) {
    const r = this.R - (pad || 0);
    if (Math.abs(x) > r) return false;
    return y < this.spring + Math.sqrt(Math.max(0, r * r - x * x));
  }
};
const BRICKS = [[0.52, 0.27, 0.18], [0.45, 0.22, 0.17], [0.58, 0.34, 0.22], [0.39, 0.2, 0.17], [0.55, 0.39, 0.27], [0.34, 0.19, 0.18], [0.62, 0.31, 0.19], [0.47, 0.3, 0.26]];

function buildArch() {
  const rnd = rng(1987);
  const W = ARCH.wallZ;
  const R = { recv: 1 };
  // 0. dark underpainting of wall and floor, so gaps read as mortar and grime
  for (let y = 0; y < 520; y += 40) for (let x = -700; x < 700; x += 210) {
    if (ARCH.inside(x + 105, y + 10, 30)) continue;
    wst([V(x, y + rnd() * 8, W - 0.2), V(x + 110, y + rnd() * 8, W - 0.2), V(x + 230, y + rnd() * 8, W - 0.2)], 52, [0.19 + rnd() * 0.05, 0.12, 0.1], { recv: 1, dry: 0.15, h: 0.12 });
  }
  for (let z = W; z < 320; z += 24) for (let x = -780; x < 780; x += 260)
    wst([V(x, -0.1, z), V(x + 140, -0.1, z + (rnd() - 0.5) * 6), V(x + 290, -0.1, z)], 30, [0.14, 0.13, 0.17], { recv: 1, dry: 0.15, h: 0.1, gloss: 0.5 }, true);
  // 1. broad wall strokes; the mortar tone shows between the bricks laid over them
  for (let y = -6; y < 520; y += 21) {
    let x = -660 + rnd() * 40;
    while (x < 660) {
      const len = 70 + rnd() * 110;
      const c = rnd.pick(BRICKS), k = 0.6 + rnd() * 0.25;
      if (!ARCH.inside(x + len / 2, y, 8)) wst([V(x, y + rnd() * 4, W), V(x + len / 2, y + (rnd() - 0.5) * 5, W), V(x + len, y + rnd() * 4, W)], 25, mul3(c, k), { recv: 1, dry: 0.5, h: 0.28, sq: 0.55 });
      x += len * (0.72 + rnd() * 0.2);
    }
  }
  // 2. bricks laid in courses
  for (let row = 0; row < 60; row++) {
    const y = 3 + row * 8.6;
    for (let x = -660 + (row % 2) * 11.5; x < 660; x += 23) {
      const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
      if (r1 > 0.48) continue;
      if (ARCH.inside(x, y, -36)) continue;
      const c = BRICKS[(r2 * BRICKS.length) | 0], k = 0.8 + r3 * 0.4;
      const hl = 7 + r4 * 3.5, dx = (r3 - 0.5) * 3;
      wst([V(x + dx - hl, y + (r4 - 0.5) * 1.2, W + 0.2), V(x + dx + hl, y + (r3 - 0.5) * 1.2, W + 0.2)], 5.4 + r2 * 1.8, mul3(c, k),
        { recv: 1, dry: 0.3, h: 0.55, w0: 0.95, tip: 0.9, sq: 0.75, a: 0.75 + 0.25 * r1 / 0.48 });
    }
  }
  // 3. grime runs under the parapet, and a cast-iron drainpipe on the right
  for (let i = 0; i < 18; i++) {
    const x = -600 + rnd() * 1200, y0 = 380 + rnd() * 130, y1 = y0 - 90 - rnd() * 160;
    if (Math.abs(x) < ARCH.R + 44) continue;
    wst([V(x, y0, W + 0.3), V(x + (rnd() - 0.5) * 8, (y0 + y1) / 2, W + 0.3), V(x, y1, W + 0.3)], 10 + rnd() * 12, [0.11, 0.08, 0.09], { recv: 1, a: 0.28, dry: 0.7, w0: 0.9, tip: 0.2 });
  }
  const dpx = 236;
  wst([V(dpx, 520, W + 1.2), V(dpx, 260, W + 1.2), V(dpx + 1, 20, W + 1.2)], 9, [0.1, 0.1, 0.12], { recv: 1, dry: 0.15, h: 0.5, gloss: 0.6 });
  wst([V(dpx - 2.5, 520, W + 1.4), V(dpx - 2.5, 20, W + 1.4)], 1.6, [0.3, 0.3, 0.36], { recv: 1, a: 0.6, dry: 0.4 });
  for (let y = 60; y < 520; y += 92) wst([V(dpx - 7, y, W + 1.5), V(dpx + 7, y, W + 1.5)], 3, [0.08, 0.08, 0.1], { recv: 1, dry: 0.2, sq: 0.8 });
  wst([V(dpx + 1, 20, W + 1.2), V(dpx + 18, 6, W + 1.2)], 9, [0.1, 0.1, 0.12], { recv: 1, dry: 0.15 });
  // a torn poster remnant, left of the arch
  for (let i = 0; i < 7; i++) {
    const x = -250 + rnd() * 50, y = 150 + rnd() * 60;
    wst([V(x, y, W + 0.8), V(x + 18 + rnd() * 20, y + (rnd() - 0.5) * 6, W + 0.8)], 8 + rnd() * 6, i % 3 ? [0.62, 0.55, 0.42] : [0.7, 0.2, 0.18], { recv: 1, a: 0.5, dry: 0.6, h: 0.2 });
  }
  // 4. the tunnel through the arch, deep blue, with a lamp glowing far off at the end
  for (let x = -ARCH.R + 4; x <= ARCH.R - 4; x += 12) {
    const top = ARCH.spring + Math.sqrt(Math.max(0, ARCH.R * ARCH.R - x * x)) - 2;
    const c = [0.04 + rnd() * 0.02, 0.05 + rnd() * 0.02, 0.09 + rnd() * 0.03];
    wst([V(x, -2, W + 0.4), V(x + (rnd() - 0.5) * 4, top * 0.5, W + 0.4), V(x, top, W + 0.4)], 17, c, { recv: 0.12, dry: 0.3, h: 0.25, w0: 0.9, tip: 0.8 });
  }
  // receding rings of the tunnel vault
  for (let k = 1; k <= 4; k++) {
    const s = 1 - k * 0.16, pts = [];
    for (let a = 0; a <= Math.PI + 1e-6; a += Math.PI / 10) pts.push(V(Math.cos(a) * ARCH.R * s, (ARCH.spring - 30) * s + 30 * s + Math.sin(a) * ARCH.R * s * 0.95, W + 0.45));
    wst(pts, 3, [0.09, 0.09, 0.15], { recv: 0.2, a: 0.5, dry: 0.5 });
  }
  wdab(V(8, 64, W + 0.5), 60, 50, [0.35, 0.25, 0.14], { kind: 1, a: 0.35 });
  wdab(V(8, 66, W + 0.55), 7, 7, [1.0, 0.82, 0.5], { kind: 1, a: 0.9 });
  wdab(V(8, 66, W + 0.56), 2.5, 2.5, [1.0, 0.95, 0.8], { a: 0.95 });
  for (let i = 0; i < 10; i++) {
    const x = -70 + rnd() * 150, y = 2 + rnd() * 14;
    wst([V(x, y, W + 0.5), V(x + 10 + rnd() * 16, y + (rnd() - 0.5), W + 0.5)], 1.4, [0.25, 0.3, 0.4], { a: 0.35, dry: 0.5 });
  }
  for (const sg of [-1, 1]) wst([V(sg * (ARCH.R - 12), 4, W + 0.5), V(sg * (ARCH.R - 13), 70, W + 0.5), V(sg * (ARCH.R - 16), ARCH.spring + 30, W + 0.5)], 3, [0.14, 0.18, 0.3], { a: 0.35, dry: 0.6 });
  // 5. arch reveal, then two rings of voussoirs and a keystone
  for (const sg of [-1, 1]) wst([V(sg * (ARCH.R - 5), -2, W + 0.8), V(sg * (ARCH.R - 5), ARCH.spring * 0.6, W + 0.8), V(sg * (ARCH.R - 5), ARCH.spring, W + 0.8)], 10, [0.3, 0.17, 0.15], R);
  {
    const pts = [];
    for (let a = 0; a <= Math.PI + 1e-6; a += Math.PI / 12) pts.push(V(Math.cos(a) * (ARCH.R - 5), ARCH.spring + Math.sin(a) * (ARCH.R - 5), W + 0.8));
    wst(pts, 10, [0.3, 0.17, 0.15], { recv: 0.8, dry: 0.4, h: 0.4 });
  }
  for (let ring = 0; ring < 2; ring++) {
    const r0 = ARCH.R + 1 + ring * 15, r1 = r0 + 13.5, n = 32 + ring * 3;
    for (let i = 0; i <= n; i++) {
      const a = (i + ring * 0.5) / n * Math.PI;
      if (a > Math.PI) continue;
      const ca = Math.cos(a), sa = Math.sin(a);
      wst([V(ca * r0, ARCH.spring + sa * r0, W + 1), V(ca * r1, ARCH.spring + sa * r1, W + 1)], 8.2, mul3([0.62, 0.44, 0.3], 0.8 + rnd() * 0.35),
        { recv: 1, dry: 0.3, h: 0.55, w0: 0.95, tip: 0.9, sq: 0.7 });
    }
  }
  wst([V(0, ARCH.spring + ARCH.R - 1, W + 1.3), V(0, ARCH.spring + ARCH.R + 32, W + 1.3)], 15, [0.64, 0.52, 0.4], { recv: 1, dry: 0.25, h: 0.6, w0: 0.8, tip: 1.2, sq: 0.8 });
  // a stone string course and the parapet
  wst([V(-700, 452, W + 1.1), V(0, 454, W + 1.1), V(700, 452, W + 1.1)], 12, [0.5, 0.45, 0.4], { recv: 1, dry: 0.3, h: 0.45, sq: 0.6 });
  wst([V(-700, 446, W + 1.2), V(700, 446, W + 1.2)], 2, [0.15, 0.12, 0.12], { recv: 1, a: 0.7, dry: 0.4 });
  // 6. floor: wet cobbles, puddles
  const F = [[0.3, 0.27, 0.31], [0.25, 0.23, 0.28], [0.35, 0.31, 0.33], [0.22, 0.2, 0.26], [0.32, 0.26, 0.24]];
  for (let z = W; z < 320; z += 9) {
    let x = -760 + rnd() * 60;
    while (x < 760) {
      const len = 80 + rnd() * 120;
      wst([V(x, 0, z), V(x + len / 2, 0, z + (rnd() - 0.5) * 3), V(x + len, 0, z)], 12, rnd.pick(F), { recv: 1, gloss: 0.7, dry: 0.4, h: 0.25 }, true);
      x += len * (0.8 + rnd() * 0.15);
    }
  }
  for (let z = W + 20; z < 320; z += 34) wst([V(-760, 0.05, z), V(760, 0.05, z)], 1.6, [0.08, 0.07, 0.1], { recv: 0.6, a: 0.5, dry: 0.6 }, true);
  for (let x = -700; x <= 700; x += 55) wst([V(x, 0.05, W), V(x * 1.02, 0.05, 320)], 1.4, [0.08, 0.07, 0.1], { recv: 0.6, a: 0.45, dry: 0.6 }, true);
  for (const [px, pz, rx, rz] of [[-160, 60, 70, 18], [150, 150, 90, 22], [40, -60, 50, 12]]) {
    for (let i = 0; i < 6; i++) {
      const zz = pz + (i - 2.5) * rz / 3;
      const hw = rx * Math.sqrt(Math.max(0, 1 - Math.pow((zz - pz) / rz, 2)));
      wst([V(px - hw, 0.12, zz), V(px + hw, 0.12, zz)], rz / 2.5, [0.16, 0.17, 0.23], { recv: 1, gloss: 1, dry: 0.2, h: 0.05 }, true);
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = -320 + rnd() * 640, z = -120 + rnd() * 340;
    wst([V(x, 0.15, z), V(x + 25 + rnd() * 40, 0.15, z + (rnd() - 0.5) * 4)], 4, [0.62, 0.55, 0.6], { recv: 1, a: 0.5, gloss: 1, dry: 0.5 }, true);
  }
  wst([V(-760, 3, W + 2), V(0, 3, W + 2), V(760, 3, W + 2)], 7, [0.07, 0.05, 0.07], { recv: 0.3, dry: 0.35 });
}

// per-frame: ripples in the tunnel puddle, contact shadows, steam from a grate
function drawArchDynamic(J, t) {
  const W = ARCH.wallZ;
  G.proj = p => project(G.cam, p);
  for (let i = 0; i < 4; i++) {
    const y = 14 + i * 4, w = 26 - i * 5, sh = Math.sin(t * 5 + i * 1.7) * 3;
    st([V(-w / 2 + sh, y, W + 0.7), V(w / 2 + sh, y + 0.5, W + 0.7)], 1.2, i % 2 ? [0.45, 0.6, 0.72] : [0.3, 0.45, 0.6], { a: 0.35, dry: 0.5 });
  }
  const pl = J.pelvis;
  dab(V(pl.x, 0.3, 4), 9, 80, [0.02, 0.015, 0.03], { kind: 1, a: 0.55, ang: 0, still: true });
  for (const s of ['L', 'R']) {
    const f = J['foot' + s];
    const lift = f.ball.y - 1.5;
    dab(V(f.ball.x, 0.3, f.ball.z - 3), 5, 26, [0.015, 0.01, 0.02], { kind: 1, a: 0.9 * (1 - clamp(lift / 12, 0, 0.8)), ang: 0, still: true });
  }
  // steam curling up from a grate at the right
  for (let i = 0; i < 5; i++) {
    const ph = fract(t * 0.18 + i / 5);
    const x = 300 + Math.sin(t * 0.7 + i) * 12 + ph * 30, y = 10 + ph * 190;
    dab(V(x, y, -40), 30 + ph * 60, 60 + ph * 50, [0.45, 0.42, 0.5], { kind: 1, a: 0.12 * Math.sin(Math.PI * ph), ang: -1.2 + ph * 0.6, still: true });
  }
}

function archLights(b, t) {
  const big = pulse(39, 39.4, 40, 40.5, b);
  const amp = 70 + 50 * big;
  const sw = Math.sin(Math.PI * (b - 0.5));
  const dp = dip(b);
  const kick = hitEnv('kick', t, 0.18), snare = hitEnv('snare', t, 0.22);
  return {
    w: V(-300 + amp * sw, 110 - 22 * dp, 430),
    c: V(300 + amp * sw, 118 - 22 * dp, 430),
    wI: 1 + 0.25 * kick + 0.12 * snare, cI: 1 + 0.18 * kick + 0.25 * snare
  };
}
