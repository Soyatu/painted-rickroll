// ============================================================
// The painted worlds. Each set is built once in world space and projected by the GPU.
// Every stroke gets a paint-in and a lift-off delay from the set's ORDER functions;
// at draw time they are measured against that set's own clocks.
// ============================================================
let ORDER = { in: null, out: null };
function wst(pts, w, col, o, floor, normal) {
  const idx = G.buf.count;
  const c = vlerp(pts[0], pts[pts.length - 1], 0.5);
  const hs = hash(idx * 7.13 + 3.1);
  const rin = ORDER.in ? ORDER.in(c, hs) : NO_IN;
  const rout = ORDER.out ? ORDER.out(c, hs) : NO_OUT;
  strokeWorld(pts, w, col, o || {}, floor ? V(0, 1, 0) : (normal || V(0, 0, 1)), [rin, rout]);
}
function wdab(p, w, len, col, o) {
  wst([V(p.x - len / 2, p.y, p.z), V(p.x + len / 2, p.y, p.z)], w, col, o);
}
const sweepX = (x0, x1, dur, jit) => (c, hs) => dur * clamp((c.x - x0) / (x1 - x0), 0, 1) + (jit === undefined ? 0.08 : jit) * hs;
// a swirl: strokes go in order of angle and distance from a centre, spiralling outward
const spiralOrder = (cx, cy, R, dur) => (c, hs) => {
  const y = c.y > 0.5 ? c.y : -(c.z - WALL_Z) * 0.35;
  const dx = c.x - cx, dy = y - cy;
  const r = Math.hypot(dx, dy), th = (Math.atan2(dy, dx) + Math.PI) / TAU;
  return dur * clamp(0.6 * r / R + 0.4 * th, 0, 1) + 0.06 * hs;
};

// ---------------------------------------------------------------- 1. the bait: a Whistler nocturne
// Blue-green river at night, a timber bridge across the top, gold lights on the far shore,
// a rocket falling in sparks, a moon, a lone boatman.
const MOON_N = V(235, 150, WALL_Z + 0.5);
const NOCT_PIERS = [-480, -140, 140, 480];
const NOCT_BZ = -80;
const NOCT_DECK = 182;
function buildNocturne() {
  const rnd = mulberry(1871);
  const W = WALL_Z;
  const skyAt = y => mixc([0.17, 0.27, 0.31], [0.04, 0.08, 0.14], smoothstep(50, 330, y));
  // underpainting, so no bare ground shows between the thin washes
  for (let y = 20; y < 470; y += 22) {
    for (let x = -820; x < 820; x += 300) wst([V(x, y, W - 0.3), V(x + 170, y + (rnd() - 0.5) * 6, W - 0.3), V(x + 340, y, W - 0.3)], 46, scalec(skyAt(y), 0.92), { recv: 1, dry: 0.05, h: 0.06 });
  }
  for (let y = -170; y < 50; y += 20) {
    for (let x = -820; x < 820; x += 300) wst([V(x, y, W - 0.3), V(x + 170, y, W - 0.3), V(x + 340, y, W - 0.3)], 40, mixc([0.07, 0.12, 0.15], [0.14, 0.22, 0.25], smoothstep(-170, 50, y)), { recv: 1, dry: 0.05, h: 0.06 });
  }
  for (let z = W; z < 340; z += 26) {
    for (let x = -840; x < 840; x += 300) wst([V(x, -0.2, z), V(x + 170, -0.2, z), V(x + 340, -0.2, z)], 40, [0.08, 0.13, 0.16], { recv: 1, dry: 0.05, h: 0.05, gloss: 0.6 }, true);
  }
  // sky: long thin washes, darker toward the top
  for (let y = 56; y < 470; y += 9) {
    const base = skyAt(y);
    let x = -800 + rnd() * 60;
    while (x < 800) {
      const len = 160 + rnd() * 260;
      const c = scalec(base, 0.88 + rnd() * 0.22);
      const yy = y + (rnd() - 0.5) * 6;
      wst([V(x, yy, W), V(x + len * 0.5, yy + (rnd() - 0.5) * 5, W), V(x + len, yy + (rnd() - 0.5) * 6, W)], 14 + rnd() * 6, c, { recv: 1, dry: 0.4, h: 0.12, w0: 0.7, tip: 0.3 });
      x += len * (0.7 + rnd() * 0.2);
    }
  }
  // the far reach of the river, painted on the backdrop
  for (let y = -170; y < 42; y += 7) {
    const k = smoothstep(-170, 42, y);
    const base = mixc([0.07, 0.13, 0.18], [0.15, 0.24, 0.29], k);
    let x = -800 + rnd() * 50;
    while (x < 800) {
      const len = 120 + rnd() * 200;
      wst([V(x, y, W + 0.1), V(x + len * 0.5, y + (rnd() - 0.5) * 2, W + 0.1), V(x + len, y, W + 0.1)], 9, scalec(base, 0.88 + rnd() * 0.22), { recv: 1, dry: 0.35, h: 0.12, gloss: 0.4 });
      x += len * (0.75 + rnd() * 0.2);
    }
  }
  // mist over the far bank
  for (let i = 0; i < 7; i++) {
    const y = 40 + rnd() * 40;
    wst([V(-820, y, W + 0.2), V(0, y + (rnd() - 0.5) * 10, W + 0.2), V(820, y, W + 0.2)], 26 + rnd() * 20, [0.25, 0.33, 0.33], { kind: 1, a: 0.22, recv: 1 });
  }
  // the far shore: a low dark bank, roofs, a few chimneys and a church tower, softened by haze
  wst([V(-820, 42, W + 0.6), V(0, 44, W + 0.6), V(820, 42, W + 0.6)], 10, [0.06, 0.09, 0.1], { recv: 1, dry: 0.3, h: 0.2 });
  for (let x = -800; x < 800; x += 20 + rnd() * 26) {
    const h = 48 + rnd() * 14, bw = 18 + rnd() * 16;
    const c = mixc([0.05, 0.08, 0.095], [0.1, 0.15, 0.17], rnd() * 0.6);
    wst([V(x, 40, W + 0.7), V(x, h, W + 0.7)], bw, c, { recv: 1, dry: 0.2, h: 0.18, sq: 1, w0: 1, tip: 1, tS: 0.01, tE: 0.01 });
    if (rnd() < 0.3) wst([V(x + bw * 0.25, h, W + 0.75), V(x + bw * 0.25, h + 10 + rnd() * 10, W + 0.75)], 3.2, c, { recv: 1, sq: 1, w0: 1, tip: 1 });
  }
  wst([V(-420, 40, W + 0.75), V(-421, 98, W + 0.75)], 14, [0.055, 0.085, 0.1], { recv: 1, sq: 0.9, w0: 1, tip: 1 });
  wst([V(-421, 98, W + 0.76), V(-421, 122, W + 0.76)], 5, [0.055, 0.085, 0.1], { recv: 1, w0: 1, tip: 0.2 });
  wst([V(-820, 58, W + 0.78), V(0, 60, W + 0.78), V(820, 58, W + 0.78)], 22, [0.2, 0.29, 0.33], { kind: 1, a: 0.3, recv: 1 });
  for (const [x, h] of [[-250, 118], [330, 104], [520, 124]]) {
    wst([V(x, 40, W + 0.8), V(x, h, W + 0.8)], [8, 6], [0.05, 0.08, 0.1], { recv: 1, sq: 1, w0: 1, tip: 1 });
    wst([V(x, h + 2, W + 0.82), V(x + 30, h + 14, W + 0.82), V(x + 90, h + 20, W + 0.82), V(x + 170, h + 22, W + 0.82)], [7, 12, 18, 24], [0.2, 0.26, 0.29], { kind: 1, a: 0.35, recv: 1 });
  }
  // lights along the far bank, each with a broken reflection
  for (let i = 0; i < 40; i++) {
    const x = -660 + rnd() * 1320, y = 42 + rnd() * 18;
    const c = rnd() < 0.7 ? [0.95, 0.7, 0.3] : [0.98, 0.88, 0.58];
    wdab(V(x, y, W + 0.9), 3.2, 3.6, c, { recv: 1, dry: 0.1, h: 0.5 });
    if (rnd() < 0.5) wdab(V(x, y, W + 0.85), 12, 12, scalec(c, 0.45), { kind: 1, a: 0.3, recv: 1 });
    for (let k = 0; k < 4; k++) {
      const yy = 34 - k * 10 - rnd() * 4;
      wst([V(x + (rnd() - 0.5) * 2, yy, W + 0.8), V(x + (rnd() - 0.5) * 2, yy - 5 - rnd() * 3, W + 0.8)], 2.4 - k * 0.35, scalec(c, 0.8 - k * 0.13), { recv: 1, dry: 0.4, a: 0.8 });
    }
  }
  // the moon: halo, disc and a wisp of cloud across it
  wdab(vadd(MOON_N, V(0, 0, -0.2)), 150, 140, [0.24, 0.32, 0.31], { kind: 1, a: 0.4, recv: 1 });
  wdab(vadd(MOON_N, V(0, 0, -0.1)), 64, 60, [0.45, 0.48, 0.4], { kind: 1, a: 0.4, recv: 1 });
  for (let dy = -13; dy <= 13; dy += 3.2) {
    const hw = Math.sqrt(Math.max(0, 15 * 15 - dy * dy));
    wst([V(MOON_N.x - hw, MOON_N.y + dy, MOON_N.z), V(MOON_N.x + hw, MOON_N.y + dy + 0.5, MOON_N.z)], 4.4, mixc([0.97, 0.88, 0.6], [0.88, 0.74, 0.42], (dy + 13) / 26), { recv: 1, dry: 0.1, h: 0.55, w0: 0.9, tip: 0.9 });
  }
  wst([V(MOON_N.x - 60, MOON_N.y - 6, MOON_N.z + 0.2), V(MOON_N.x, MOON_N.y - 3, MOON_N.z + 0.2), V(MOON_N.x + 70, MOON_N.y - 9, MOON_N.z + 0.2)], 4, [0.16, 0.22, 0.24], { recv: 1, a: 0.75, dry: 0.5 });
  // a rocket bursting and falling in gold sparks (after Whistler)
  for (const [cx, cy, sc] of [[-270, 210, 1.15], [-150, 168, 0.8], [-370, 150, 0.65]]) {
    wdab(V(cx, cy, W + 0.95), 46 * sc, 46 * sc, [0.55, 0.45, 0.26], { kind: 1, a: 0.3, recv: 1 });
    wdab(V(cx, cy, W + 0.96), 6 * sc, 6 * sc, [1.0, 0.9, 0.6], { recv: 1, dry: 0.1, h: 0.5 });
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, sp = (36 + rnd() * 48) * sc;
      for (let k = 1; k < 8; k++) {
        const tt = k / 7;
        const x = cx + Math.cos(a) * sp * tt, y = cy + Math.sin(a) * sp * tt * 0.65 - 80 * sc * tt * tt;
        if (y < 66) continue;
        wdab(V(x, y, W + 1), 3.2 * (1 - tt * 0.55), 3.8, [0.98, 0.76 + rnd() * 0.18, 0.38], { recv: 1, a: 1 - tt * 0.4, dry: 0.15, h: 0.45 });
      }
    }
  }
  // the bridge: a heavy timber deck across the top of the picture, on piers of clustered piles
  const BZ = NOCT_BZ, dark = [0.03, 0.055, 0.065], D = NOCT_DECK;
  const deckY = x => D + 6 * Math.cos(x / 820 * Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    wst([V(-840, deckY(-840) + k * 7, BZ), V(-420, deckY(-420) + k * 7, BZ), V(0, deckY(0) + k * 7, BZ), V(420, deckY(420) + k * 7, BZ), V(840, deckY(840) + k * 7, BZ)], 9, scalec(dark, 0.85 + 0.3 * rnd()), { recv: 1, dry: 0.25, h: 0.3 });
  }
  wst([V(-840, deckY(-840) + 1, BZ + 0.2), V(0, deckY(0) + 1, BZ + 0.2), V(840, deckY(840) + 1, BZ + 0.2)], 1.6, [0.12, 0.17, 0.18], { recv: 1, a: 0.6, dry: 0.5 });
  wst([V(-840, deckY(-840) + 44, BZ), V(0, deckY(0) + 46, BZ), V(840, deckY(840) + 44, BZ)], 2.2, dark, { recv: 1, dry: 0.3 });
  for (let x = -830; x < 840; x += 13) wst([V(x, deckY(x) + 24, BZ), V(x, deckY(x) + 45, BZ)], 1.5, dark, { recv: 1, dry: 0.4, a: 0.9 });
  for (const px of NOCT_PIERS) {
    // a cluster of heavy timber piles, a cap beam and a couple of walings
    for (let j = -2; j <= 2; j++) {
      const x0 = px + j * 9 + (rnd() - 0.5) * 2;
      wst([V(x0, -16, BZ), V(x0 + (rnd() - 0.5) * 2, D * 0.5, BZ), V(x0 + j * 0.8, D + 2, BZ)], 7.5, scalec(dark, 0.8 + 0.4 * rnd()), { recv: 1, dry: 0.15, h: 0.35, sq: 0.6 });
    }
    wst([V(px - 32, D - 2, BZ + 0.2), V(px + 32, D - 2, BZ + 0.2)], 10, dark, { recv: 1, dry: 0.2, h: 0.4 });
    for (const y of [48, 112]) wst([V(px - 26, y, BZ + 0.3), V(px + 26, y + 2, BZ + 0.3)], 4, dark, { recv: 1, dry: 0.3 });
    wst([V(px + 21, 8, BZ + 0.4), V(px + 20, D * 0.6, BZ + 0.4), V(px + 19, D - 4, BZ + 0.4)], 1.3, [0.13, 0.18, 0.19], { recv: 1, a: 0.6, dry: 0.5 });
    // a lamp on the parapet
    wst([V(px, deckY(px) + 44, BZ + 0.4), V(px, deckY(px) + 58, BZ + 0.4)], 1.6, dark, { recv: 1 });
    wdab(V(px, deckY(px) + 61, BZ + 0.5), 4.6, 4.6, [0.99, 0.82, 0.42], { recv: 1, dry: 0.1, h: 0.5 });
    wdab(V(px, deckY(px) + 61, BZ + 0.45), 22, 22, [0.6, 0.48, 0.25], { kind: 1, a: 0.35, recv: 1 });
  }
  // a few people crossing the bridge
  for (let i = 0; i < 7; i++) {
    const x = -560 + rnd() * 1120;
    if (Math.abs(x) < 60) continue;
    const y = deckY(x) + 28;
    wst([V(x, y, BZ + 0.6), V(x + (rnd() - 0.5) * 2, y + 13, BZ + 0.6)], 4, dark, { recv: 1, sq: 0.6 });
    wdab(V(x, y + 16, BZ + 0.6), 3.4, 3.4, dark, { recv: 1 });
  }
  // the near water: long horizontal strokes on the river plane
  for (let z = W; z < 340; z += 6.5) {
    let x = -840 + rnd() * 60;
    const k = clamp((z - W) / 480, 0, 1);
    const base = mixc([0.11, 0.19, 0.24], [0.06, 0.11, 0.17], k);
    while (x < 840) {
      const len = 90 + rnd() * 170;
      const c = scalec(base, 0.85 + rnd() * 0.3);
      wst([V(x, 0, z), V(x + len / 2, 0, z + (rnd() - 0.5) * 3), V(x + len, 0, z)], 8.5, c, { recv: 1, gloss: 0.8, dry: 0.35, h: 0.15 }, true);
      x += len * (0.75 + rnd() * 0.2);
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = -600 + rnd() * 1200, z = W + rnd() * 440;
    wst([V(x, 0.05, z), V(x + 20 + rnd() * 50, 0.05, z + (rnd() - 0.5) * 2)], 1.8, [0.22, 0.32, 0.33], { recv: 1, a: 0.55, dry: 0.5, gloss: 0.8 }, true);
  }
  // the piers' reflections: dark wobbling columns under each pier
  const persp = (x0, z0, z) => x0 * (CAM_DIST - z) / (CAM_DIST - z0);
  for (const px of NOCT_PIERS) {
    for (let z = BZ; z < 40; z += 10) {
      const x = persp(px, BZ, z) + (rnd() - 0.5) * 6;
      wst([V(x - 20, 0.1, z), V(x + 20, 0.1, z + 2)], 6, [0.04, 0.07, 0.08], { recv: 1, a: 0.75, dry: 0.4, gloss: 0.6 }, true);
    }
  }
  // a column of broken moonlight on the water
  for (let z = W + 4; z < 170; z += 9) {
    const x = persp(MOON_N.x, W, z) + (rnd() - 0.5) * 8;
    const hw = 6 + rnd() * 10;
    wst([V(x - hw, 0.12, z), V(x + hw, 0.12, z + 1)], 2.6, [0.8, 0.72, 0.48], { recv: 1, a: 0.7 * (1 - (z - W) / 360), dry: 0.4, gloss: 0.8 }, true);
  }
  // a lone boatman, standing in his barge
  const BZ2 = 95, bx = -170;
  wst([V(bx - 55, 7, BZ2), V(bx, 0, BZ2), V(bx + 48, 9, BZ2)], 7, [0.03, 0.05, 0.06], { recv: 1, dry: 0.2 });
  wst([V(bx - 8, 8, BZ2 + 0.2), V(bx - 9, 40, BZ2 + 0.2)], 6.5, [0.03, 0.05, 0.06], { recv: 1, sq: 0.6 });
  wdab(V(bx - 9, 45, BZ2 + 0.2), 5, 5, [0.03, 0.05, 0.06], { recv: 1 });
  wst([V(bx - 34, -10, BZ2 + 0.3), V(bx + 10, 64, BZ2 + 0.3)], 1.4, [0.03, 0.05, 0.06], { recv: 1 });
  wst([V(bx - 55, 0.1, BZ2), V(bx + 50, 0.1, BZ2 + 2)], 5, [0.04, 0.07, 0.08], { recv: 1, a: 0.6 }, true);
}

// ---------------------------------------------------------------- 2. the railway arch (the original set)
const ARCH_R = 96, ARCH_SPRING = 138;
const BRICKS = [[0.5, 0.27, 0.19], [0.44, 0.22, 0.17], [0.56, 0.33, 0.22], [0.38, 0.2, 0.17], [0.53, 0.38, 0.27], [0.33, 0.19, 0.18], [0.6, 0.31, 0.2]];
function insideArch(x, y, pad) {
  const r = ARCH_R - (pad || 0);
  if (Math.abs(x) > r) return false;
  return y < ARCH_SPRING + Math.sqrt(Math.max(0, r * r - x * x));
}
function buildArch() {
  const rnd = mulberry(90210);
  const W = WALL_Z;
  // 0. dark underpainting of wall and floor, so gaps read as mortar and grime rather than holes
  for (let y = 0; y < 520; y += 40) {
    for (let x = -700; x < 700; x += 210) {
      if (insideArch(x + 105, y + 10, 30)) continue;
      wst([V(x, y + rnd() * 8, W - 0.2), V(x + 110, y + rnd() * 8, W - 0.2), V(x + 230, y + rnd() * 8, W - 0.2)], 52, [0.2 + rnd() * 0.05, 0.12, 0.1], { recv: 1, dry: 0.15, h: 0.12 });
    }
  }
  for (let z = WALL_Z; z < 300; z += 24) {
    for (let x = -760; x < 760; x += 260) wst([V(x, -0.1, z), V(x + 140, -0.1, z + (rnd() - 0.5) * 6), V(x + 290, -0.1, z)], 30, [0.15, 0.13, 0.17], { recv: 1, dry: 0.15, h: 0.1, gloss: 0.5 }, true);
  }
  // 1. broad wall strokes (mortar tone shows between later bricks)
  for (let y = -6; y < 510; y += 21) {
    let x = -660 + rnd() * 40;
    while (x < 660) {
      const len = 70 + rnd() * 110;
      const c = BRICKS[(rnd() * BRICKS.length) | 0], k = 0.62 + rnd() * 0.25;
      const y0 = y + rnd() * 4, y1 = y + (rnd() - 0.5) * 5, y2 = y + rnd() * 4;
      if (!insideArch(x + len / 2, y, 8)) wst([V(x, y0, W), V(x + len / 2, y1, W), V(x + len, y2, W)], 25, scalec(c, k), { recv: 1, dry: 0.5, h: 0.28, sq: 0.55 });
      x += len * (0.72 + rnd() * 0.2);
    }
  }
  // 2. brick dabs in courses
  for (let row = 0; row < 60; row++) {
    const y = 3 + row * 8.6;
    for (let x = -660 + (row % 2) * 11.5; x < 660; x += 23) {
      const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
      if (r1 > 0.46) continue;
      if (insideArch(x, y, -34)) continue;
      const c = BRICKS[(r2 * BRICKS.length) | 0];
      const k = 0.8 + r3 * 0.4;
      const hl = 7 + r4 * 3.5, dx = (r3 - 0.5) * 3;
      wst([V(x + dx - hl, y + (r4 - 0.5) * 1.2, W + 0.2), V(x + dx + hl, y + (r3 - 0.5) * 1.2, W + 0.2)], 5.4 + r2 * 1.8, scalec(c, k), { recv: 1, dry: 0.3, h: 0.55, w0: 0.95, tip: 0.9, sq: 0.75, a: 0.75 + 0.25 * r1 / 0.46 });
    }
  }
  // 3. grime
  for (let i = 0; i < 18; i++) {
    const x = -560 + rnd() * 1120, y0 = 330 + rnd() * 160, y1 = y0 - 90 - rnd() * 140;
    if (Math.abs(x) < ARCH_R + 40) continue;
    wst([V(x, y0, W + 0.3), V(x + (rnd() - 0.5) * 8, (y0 + y1) / 2, W + 0.3), V(x, y1, W + 0.3)], 10 + rnd() * 12, [0.12, 0.08, 0.09], { recv: 1, a: 0.28, dry: 0.7, w0: 0.9, tip: 0.2 });
  }
  // 4. the tunnel through the arch
  for (let x = -ARCH_R + 4; x <= ARCH_R - 4; x += 12) {
    const top = ARCH_SPRING + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - x * x)) - 2;
    const c = [0.045 + rnd() * 0.02, 0.05 + rnd() * 0.02, 0.09 + rnd() * 0.03];
    wst([V(x, -2, W + 0.4), V(x + (rnd() - 0.5) * 4, top * 0.5, W + 0.4), V(x, top, W + 0.4)], 17, c, { recv: 0.12, dry: 0.3, h: 0.25, w0: 0.9, tip: 0.8 });
  }
  wdab(V(0, 70, W + 0.5), 140, 120, [0.05, 0.1, 0.19], { kind: 1, a: 0.28 });
  for (let i = 0; i < 9; i++) {
    const x = -70 + rnd() * 140, y = 2 + rnd() * 14;
    wst([V(x, y, W + 0.5), V(x + 10 + rnd() * 16, y + (rnd() - 0.5), W + 0.5)], 1.4, [0.2, 0.3, 0.42], { a: 0.35, dry: 0.5 });
  }
  for (const sg of [-1, 1]) wst([V(sg * (ARCH_R - 12), 4, W + 0.5), V(sg * (ARCH_R - 13), 70, W + 0.5), V(sg * (ARCH_R - 16), ARCH_SPRING + 30, W + 0.5)], 3, [0.14, 0.18, 0.3], { a: 0.35, dry: 0.6 });
  // 5. arch reveal (soffit + jambs), then the voussoir rings
  for (const sg of [-1, 1]) wst([V(sg * (ARCH_R - 5), -2, W + 0.8), V(sg * (ARCH_R - 5), ARCH_SPRING * 0.6, W + 0.8), V(sg * (ARCH_R - 5), ARCH_SPRING, W + 0.8)], 10, [0.3, 0.17, 0.15], { recv: 0.8, dry: 0.4, h: 0.4 });
  {
    const pts = [];
    for (let a = 0; a <= Math.PI + 1e-6; a += Math.PI / 10) pts.push(V(Math.cos(a) * (ARCH_R - 5), ARCH_SPRING + Math.sin(a) * (ARCH_R - 5), W + 0.8));
    wst(pts, 10, [0.3, 0.17, 0.15], { recv: 0.8, dry: 0.4, h: 0.4 });
  }
  for (let ring = 0; ring < 2; ring++) {
    const r0 = ARCH_R + 1 + ring * 15, r1 = r0 + 13.5;
    const n = 30 + ring * 3;
    for (let i = 0; i <= n; i++) {
      const a = (i + ring * 0.5) / n * Math.PI;
      if (a > Math.PI) continue;
      const ca = Math.cos(a), sa = Math.sin(a);
      const c = scalec([0.62, 0.44, 0.3], 0.8 + rnd() * 0.35);
      wst([V(ca * r0, ARCH_SPRING + sa * r0, W + 1), V(ca * r1, ARCH_SPRING + sa * r1, W + 1)], 8.2, c, { recv: 1, dry: 0.3, h: 0.55, w0: 0.95, tip: 0.9, sq: 0.7 });
    }
  }
  // 6. floor: wet cobbles
  const F = [[0.3, 0.27, 0.31], [0.25, 0.23, 0.28], [0.35, 0.31, 0.33], [0.22, 0.2, 0.26]];
  for (let z = WALL_Z; z < 300; z += 9) {
    let x = -760 + rnd() * 60;
    while (x < 760) {
      const len = 80 + rnd() * 120;
      const c = F[(rnd() * F.length) | 0];
      wst([V(x, 0, z), V(x + len / 2, 0, z + (rnd() - 0.5) * 3), V(x + len, 0, z)], 12, c, { recv: 1, gloss: 0.7, dry: 0.4, h: 0.25 }, true);
      x += len * (0.8 + rnd() * 0.15);
    }
  }
  for (let z = WALL_Z + 20; z < 300; z += 34) wst([V(-760, 0.05, z), V(760, 0.05, z)], 1.6, [0.08, 0.07, 0.1], { recv: 0.6, a: 0.5, dry: 0.6 }, true);
  for (let x = -720; x <= 720; x += 55) wst([V(x, 0.05, WALL_Z), V(x * 1.02, 0.05, 300)], 1.4, [0.08, 0.07, 0.1], { recv: 0.6, a: 0.45, dry: 0.6 }, true);
  for (let i = 0; i < 22; i++) {
    const x = -300 + rnd() * 600, z = -120 + rnd() * 330;
    wst([V(x, 0.1, z), V(x + 25 + rnd() * 40, 0.1, z + (rnd() - 0.5) * 4)], 4, [0.62, 0.55, 0.6], { recv: 1, a: 0.5, gloss: 1, dry: 0.5 }, true);
  }
  wst([V(-760, 3, W + 2), V(0, 3, W + 2), V(760, 3, W + 2)], 7, [0.07, 0.05, 0.07], { recv: 0.3, dry: 0.35 });
}
