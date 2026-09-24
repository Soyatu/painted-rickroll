// ============================================================================
// The river nocturne (after Whistler): a tall timber pier and the underside of
// the bridge deck, a far bank of lamps, a barge, gold sparks falling through
// blue-green mist. The quiff rises out of the water like a moon.
// ============================================================================
const NOCT = { pierX: 130, pierZ: -420, deckY: 420, bankZ: -2800, skyZ: -3200 };
const N_SKY = [[0.07, 0.14, 0.19], [0.1, 0.2, 0.24], [0.14, 0.25, 0.28], [0.2, 0.31, 0.33], [0.23, 0.34, 0.35]];
const N_WATER = [[0.08, 0.17, 0.2], [0.11, 0.21, 0.24], [0.13, 0.24, 0.26], [0.17, 0.28, 0.3], [0.09, 0.15, 0.19]];
const GOLD = [1.0, 0.78, 0.36];
const BANK_LIGHTS = (() => {
  const r = rng(77), L = [];
  for (let i = 0; i < 34; i++) L.push({ x: -2300 + r() * 4200, y: 18 + r() * 110 * r(), s: 0.6 + r() * 0.8 });
  return L;
})();

function buildNoct() {
  const rnd = rng(1871);
  const SZ = NOCT.skyZ;
  // sky: broad horizontal washes, darker above, a misty band at the horizon
  for (let y = -40; y < 3200; y += 55) {
    const k = sat(y / 2400);
    let x = -4200 + rnd() * 300;
    while (x < 4200) {
      const len = 500 + rnd() * 900;
      const c = mix3(N_SKY[4], N_SKY[0], Math.pow(k, 0.6));
      wst([V(x, y + rnd() * 20, SZ), V(x + len / 2, y + (rnd() - 0.5) * 30, SZ), V(x + len, y + rnd() * 20, SZ)], 90 + rnd() * 50,
        mix3(c, rnd.pick(N_SKY), 0.25), { recv: 0, dry: 0.35, h: 0.15, unit: 0.45, w0: 0.8, tip: 0.5 });
      x += len * (0.7 + rnd() * 0.2);
    }
  }
  // a smoky drift of mist over the far bank
  for (let i = 0; i < 26; i++) {
    const x = -3000 + rnd() * 6000, y = 40 + rnd() * 380;
    wst([V(x, y, SZ + 100), V(x + 600 + rnd() * 700, y + (rnd() - 0.5) * 60, SZ + 100)], 120 + rnd() * 140, mix3(N_SKY[3], [0.3, 0.4, 0.42], rnd() * 0.5),
      { recv: 0, kind: 1, a: 0.25 + rnd() * 0.2, unit: 0.45 });
  }
  // the far bank: a low dark shore of warehouses, a church tower, chimneys
  const BZ = NOCT.bankZ;
  for (let x = -3200; x < 3200;) {
    const bw = 120 + rnd() * 160, h = 50 + rnd() * 130 + (Math.abs(x + 700) < 200 ? 90 : 0);
    const c = mix3([0.06, 0.11, 0.14], [0.1, 0.17, 0.2], rnd());
    wst([V(x + bw / 2, -5, BZ), V(x + bw / 2, h, BZ)], bw, c, { recv: 0, dry: 0.25, h: 0.15, sq: 0.97, w0: 1, tip: 1, unit: 0.5 });
    if (rnd() < 0.55) {
      // a pitched roof
      const rh = 30 + rnd() * 40;
      wst([V(x + 6, h - 2, BZ), V(x + bw / 2, h + rh, BZ)], 16, c, { recv: 0, sq: 0.9, unit: 0.5 });
      wst([V(x + bw - 6, h - 2, BZ), V(x + bw / 2, h + rh, BZ)], 16, c, { recv: 0, sq: 0.9, unit: 0.5 });
      wst([V(x + 20, h + rh * 0.3, BZ), V(x + bw - 20, h + rh * 0.3, BZ)], rh * 0.55, c, { recv: 0, sq: 0.9, unit: 0.5 });
    }
    x += bw * (0.8 + rnd() * 0.5);
  }
  wst([V(-720, 60, BZ + 5), V(-720, 330, BZ + 5), V(-720, 460, BZ + 5)], [70, 62, 40], [0.07, 0.12, 0.15], { recv: 0, dry: 0.2, sq: 0.8, unit: 0.5 });
  wst([V(-720, 460, BZ + 6), V(-720, 560, BZ + 6)], [34, 4], [0.07, 0.12, 0.15], { recv: 0, dry: 0.2, unit: 0.5 });
  for (const cx of [-1500, 400, 1300, 2100]) wst([V(cx, 80, BZ + 5), V(cx + 4, 330 + rnd() * 120, BZ + 5)], 26, [0.07, 0.12, 0.15], { recv: 0, sq: 0.8, unit: 0.5 });
  for (const L of BANK_LIGHTS) {
    wdab(V(L.x, L.y, BZ + 10), 60 * L.s, 60 * L.s, [0.55, 0.42, 0.2], { recv: 0, kind: 1, a: 0.35, unit: 0.5 });
    wdab(V(L.x, L.y, BZ + 11), 14 * L.s, 14 * L.s, GOLD, { recv: 0, a: 0.95, unit: 0.5 });
  }
  // water: long horizontal strokes, lighter where the sky lies on it
  for (let z = 520; z > BZ; z -= 14 + (520 - z) * 0.03) {
    let x = -3000 + rnd() * 200;
    const k = sat((520 - z) / 3000);
    while (x < 3000) {
      const len = 160 + rnd() * 380 + k * 600;
      const c = mix3(rnd.pick(N_WATER), N_SKY[3], k * 0.5);
      wst([V(x, 0, z), V(x + len / 2, 0, z + (rnd() - 0.5) * 4), V(x + len, 0, z)], 12 + k * 60, c,
        { recv: 0, dry: 0.4, h: 0.18, gloss: 0.8, unit: unitAt(z) * 1.2 }, true);
      x += len * (0.75 + rnd() * 0.2);
    }
  }
  // shimmer: dashes travelling along long strokes on the water
  for (let i = 0; i < 90; i++) {
    const z = 400 - Math.pow(rnd(), 1.6) * 2800, x = -2500 + rnd() * 5000;
    wst([V(x, 0.3, z), V(x + 900, 0.3, z + (rnd() - 0.5) * 6)], 4 + (400 - z) * 0.012, mix3(N_WATER[3], [0.4, 0.52, 0.52], rnd()),
      { recv: 0, a: 0.55, dry: 0.5, dash: 70 + rnd() * 90, dspd: 12 + rnd() * 16, unit: unitAt(z) }, true);
  }
  // gold reflections of the lamps, broken into dashes that wobble toward us
  for (const L of BANK_LIGHTS) {
    for (let k = 0; k < 5; k++) {
      const z0 = BZ + 40 + k * 60;
      wst([V(L.x + (rnd() - 0.5) * 20, 0.4, z0), V(L.x + (rnd() - 0.5) * 20, 0.4, z0 + 320)], 10 * L.s, mix3(GOLD, [0.6, 0.5, 0.3], 0.3),
        { recv: 0, a: 0.6, dry: 0.5, dash: 60, dspd: 40 + rnd() * 30, unit: 0.6 }, true);
    }
  }
  // the pier: a trestle of three tall timbers, braced, capped by a wide beam whose struts
  // flare out to carry the deck (the T that dominates the picture)
  const PX = NOCT.pierX, PZ = NOCT.pierZ, DY = NOCT.deckY;
  const pierC = [0.045, 0.07, 0.09], pierL = [0.1, 0.15, 0.17], U = { recv: 0, dry: 0.22, h: 0.35, sq: 0.8, unit: 1.3 };
  for (const dx of [-30, 0, 30]) wst([V(PX + dx, -40, PZ), V(PX + dx * 0.9, 200, PZ), V(PX + dx * 0.8, DY - 30, PZ)], [26, 24, 23], pierC, U);
  wst([V(PX - 42, -10, PZ + 2), V(PX - 36, DY - 40, PZ + 2)], 3.5, pierL, { recv: 0, a: 0.55, dry: 0.5, unit: 1.3 });
  for (const y of [60, 170, 280]) {
    wst([V(PX - 32, y, PZ + 1), V(PX + 32, y + 70, PZ + 1)], 7, pierC, { recv: 0, dry: 0.3, unit: 1.3 });
    wst([V(PX + 32, y, PZ + 1), V(PX - 32, y + 70, PZ + 1)], 7, pierC, { recv: 0, dry: 0.3, unit: 1.3 });
  }
  wst([V(PX - 70, DY - 40, PZ + 2), V(PX + 70, DY - 38, PZ + 2)], 24, pierC, U);
  for (const sg of [-1, 1]) {
    wst([V(PX + sg * 24, DY - 150, PZ + 1), V(PX + sg * 120, DY - 80, PZ + 1), V(PX + sg * 250, DY - 18, PZ + 1)], [14, 12, 10], pierC, { recv: 0, dry: 0.3, unit: 1.3 });
    wst([V(PX + sg * 24, DY - 90, PZ + 1), V(PX + sg * 170, DY - 22, PZ + 1)], 9, pierC, { recv: 0, dry: 0.3, unit: 1.3 });
  }
  // the deck: a heavy dark span right across the top, gently arched, with its railing
  for (let x = -2000; x < 2300; x += 170) {
    const y = DY + 20 - Math.pow((x - 150) / 2300, 2) * 80;
    wst([V(x, y, PZ - 5), V(x + 190, y + 2, PZ - 5)], 64, mix3(pierC, [0.07, 0.11, 0.13], rnd() * 0.6), { recv: 0, dry: 0.3, h: 0.3, sq: 0.97, w0: 1, tip: 1, unit: 1.2 });
  }
  for (let x = -2000; x < 2300; x += 240) {
    const y = DY - 12 - Math.pow((x - 150) / 2300, 2) * 80;
    wst([V(x, y, PZ - 4), V(x + 250, y + 2, PZ - 4)], 3, pierL, { recv: 0, a: 0.5, dry: 0.5, unit: 1.2 });
  }
  for (let x = -2000; x < 2300; x += 28) {
    const y = DY + 52 - Math.pow((x - 150) / 2300, 2) * 80;
    wst([V(x, y, PZ - 6), V(x + 1, y + 24, PZ - 6)], 3.2, [0.05, 0.08, 0.1], { recv: 0, dry: 0.3, unit: 1.2 });
  }
  for (let x = -2000; x < 2300; x += 300) {
    const y = DY + 76 - Math.pow((x - 150) / 2300, 2) * 80;
    wst([V(x, y, PZ - 6), V(x + 310, y + 1, PZ - 6)], 4, [0.05, 0.08, 0.1], { recv: 0, unit: 1.2 });
  }
  // a few figures on the bridge, and a lantern
  for (const fx of [-420, -370, 610]) {
    const y = DY + 52 - Math.pow((fx - 150) / 2300, 2) * 80;
    wst([V(fx, y, PZ - 7), V(fx, y + 40, PZ - 7)], [10, 7], [0.05, 0.07, 0.09], { recv: 0, unit: 1.2 });
    wdab(V(fx, y + 46, PZ - 7), 8, 7, [0.05, 0.07, 0.09], { recv: 0, unit: 1.2 });
  }
  wdab(V(-150, DY + 104, PZ - 8), 60, 60, [0.6, 0.45, 0.2], { recv: 0, kind: 1, a: 0.4, unit: 1.2 });
  wdab(V(-150, DY + 104, PZ - 8), 10, 12, GOLD, { recv: 0, unit: 1.2 });
  // the pier's reflection
  for (let k = 0; k < 9; k++) {
    wst([V(PX + (rnd() - 0.5) * 16, 0.5, PZ + 10 + k * 22), V(PX + (rnd() - 0.5) * 24, 0.5, PZ + 30 + k * 22)], 36 - k * 2, [0.04, 0.08, 0.1],
      { recv: 0, a: 0.7, dry: 0.4, unit: 1.5 }, true);
  }
  // the barge and its boatman, low on the water
  const bx = -300, bz = -180;
  wst([V(bx - 110, 12, bz), V(bx, 5, bz), V(bx + 110, 14, bz)], [18, 24, 12], [0.04, 0.06, 0.08], { recv: 0, dry: 0.2, unit: 2 });
  wst([V(bx + 40, 22, bz + 1), V(bx + 42, 70, bz + 1)], [10, 7], [0.04, 0.06, 0.08], { recv: 0, unit: 2 });
  wdab(V(bx + 42, 76, bz + 1), 8, 7, [0.04, 0.06, 0.08], { recv: 0, unit: 2 });
  wst([V(bx + 30, 60, bz + 2), V(bx + 70, 0, bz + 2)], 1.6, [0.05, 0.07, 0.09], { recv: 0, unit: 2 });
  wst([V(bx - 120, 0.5, bz + 6), V(bx + 120, 0.5, bz + 10)], 10, [0.05, 0.1, 0.12], { recv: 0, a: 0.6, unit: 2 }, true);
}

// fireworks: every piano note throws up a little burst of gold that drifts down and fades
function drawSparks(t) {
  const notes = SCORE.hits.piano;
  for (let j = 0; j < notes.length * 2; j++) {
    // notes from the end of the previous loop keep falling into the start of this one
    const i = j % notes.length;
    const tau = t - (j < notes.length ? notes[i] : notes[i] - DUR);
    if (tau < 0 || tau > 3.2) continue;
    const r = rng(1000 + i * 7);
    const cx = 60 + r() * 800, cy = 480 + r() * 260, z = -1000;
    const n = 8 + ((r() * 6) | 0);
    for (let k = 0; k < n; k++) {
      const a = r() * TAU, sp = 40 + r() * 90;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * 0.7 + 20;
      const at = q => V(cx + vx * q, cy + vy * q - 38 * q * q, z);
      const fade = (1 - sstep(1.2, 3.2, tau)) * sstep(0, 0.06, tau);
      const col = mix3(GOLD, [1, 0.95, 0.8], r());
      if (fade < 0.02) continue;
      st([at(Math.max(0, tau - 0.22)), at(Math.max(0, tau - 0.1)), at(tau)], [2, 6, 9], col, { a: fade * 0.95, dry: 0.3, tip: 0.5, w0: 0.3, h: 0.1, exact: true });
      if (k % 2 === 0) dab(at(tau), 46, 46, [0.62, 0.46, 0.2], { kind: 1, a: 0.3 * fade, still: true });
    }
    if (tau < 0.5) dab(V(cx, cy, z), 160, 160, [0.7, 0.5, 0.22], { kind: 1, a: 0.35 * (1 - tau / 0.5), still: true });
  }
}

// the water around his head: the moon-glow of the quiff, rings, bubbles, the churn
function drawRiver(J, t, b) {
  const hx = J.head.x, hz = J.head.z;
  const top = J.head.y + 17;
  G.proj = p => project(G.cam, p);
  const moon = sat((top + 1) / 8) * (1 - sstep(15.6, 16.2, b));
  if (moon > 0.01) {
    dab(V(hx, Math.max(4, top - 6), hz - 2), 90, 90, [0.55, 0.38, 0.18], { kind: 1, a: 0.3 * moon, still: true });
    // a path of glitter on the water between him and us, stopping short of the camera
    const reach = Math.max(40, (G.cam.pos.z - hz) * 0.7);
    for (let k = 0; k < 14; k++) {
      const f = (k + 1) / 14, z = hz + 8 + reach * f * f;
      const w = 4 + 16 * (1 - f) * hash(k * 3.3 + Math.floor(t * 6));
      const sh = Math.sin(t * 3.1 + k * 1.9) * (2 + 8 * f);
      st([V(hx - w / 2 + sh, 0.4, z), V(hx + w / 2 + sh, 0.4, z)], 0.6 + 1.4 * f, [1.0, 0.74, 0.38],
        { a: 0.55 * moon * (1 - 0.5 * f) * sstep(170, 320, G.cam.pos.z - hz), dry: 0.4, h: 0.05, exact: true });
    }
  }
  if (top < -2 || b > 16.05) return;
  const neckR = 9;
  for (let k = 0; k < 4; k++) {
    const ph = fract(t * 0.45 + k / 4);
    const r = neckR + ph * 60;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU; pts.push(V(hx + Math.cos(a) * r, 0.5, hz + Math.sin(a) * r * 0.9)); }
    st(pts, 1.4 + ph * 2, [0.34, 0.47, 0.5], { a: 0.5 * (1 - ph), dry: 0.5, h: 0.1 });
  }
  const pts = [];
  for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU; pts.push(V(hx + Math.cos(a) * (neckR + 1), 0.8, hz + Math.sin(a) * (neckR + 1) * 0.8)); }
  st(pts, 2.2, [0.55, 0.66, 0.68], { a: 0.55, dry: 0.5, h: 0.2 });
  const bub = pulse(12.2, 12.5, 13.8, 14.2, b), churn = pulse(13.9, 14.3, 15.9, 16.05, b);
  for (let i = 0; i < 14; i++) {
    const r = rng(500 + i);
    const ph = fract(t * (0.8 + r() * 0.6) + r());
    const a = r() * TAU, rr = 14 + r() * 30;
    const amt = Math.max(bub * (i < 6 ? 1 : 0), churn);
    if (amt < 0.02) continue;
    dab(V(hx + Math.cos(a) * rr, 1 + ph * 3 * churn, hz + Math.sin(a) * rr * 0.7), 2.5 + churn * 3, 2.5 + churn * 5, [0.62, 0.72, 0.74],
      { a: 0.7 * amt * (1 - ph), dry: 0.4 });
  }
}
// the burst: a crown of water thrown up around him, and droplets on ballistic arcs
function drawSplash(t, b) {
  const tau = (b - 16) * BEAT;
  if (tau < 0 || tau > 1.4) return;
  G.proj = p => project(G.cam, p);
  const crown = sstep(0, 0.08, tau) * (1 - sstep(0.3, 0.8, tau));
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU + 0.2;
    const r0 = 22 + tau * 80, h = 60 * Math.sin(Math.min(1, tau / 0.5) * Math.PI) * (0.5 + 0.5 * hash(i * 1.7));
    const out = V(Math.cos(a), 0, Math.sin(a) * 0.6);
    st([vmad(V(0, 0, 0), out, r0), vadd(vmad(V(0, 0, 0), out, r0 + 8), V(0, h * 0.6, 0)), vadd(vmad(V(0, 0, 0), out, r0 + 20), V(0, h, 0))],
      [7, 4, 1.5], [0.55, 0.68, 0.72], { a: 0.45 * crown, dry: 0.6, tip: 0.2, h: 0.2, c2: [0.85, 0.92, 0.94] });
  }
  for (let i = 0; i < 46; i++) {
    const r = rng(900 + i);
    const a = r() * TAU, sp = 120 + r() * 260, vy = 250 + r() * 380;
    const at = q => V(Math.cos(a) * sp * q, Math.max(0, vy * q - 490 * q * q), Math.sin(a) * sp * q * 0.6);
    if (vy * tau - 490 * tau * tau < 0) continue;
    st([at(Math.max(0, tau - 0.04)), at(tau)], 2.4 + r() * 2.4, mix3([0.6, 0.72, 0.76], [0.9, 0.95, 0.95], r()),
      { a: 0.85 * (1 - sstep(0.8, 1.4, tau)), dry: 0.3, tip: 0.4, h: 0.3, exact: true });
  }
  const foam = 1 - sstep(0.3, 1.4, tau);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, r = 20 + tau * 90;
    dab(V(Math.cos(a) * r, 0.6, Math.sin(a) * r * 0.6), 14, 26, [0.55, 0.66, 0.7], { a: 0.6 * foam, ang: a + Math.PI / 2 });
  }
}
