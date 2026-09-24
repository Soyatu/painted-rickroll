// ============================================================
// Lettering and the gallery: the title card that bait-and-switches, and the museum wall
// the whole painting turns out to be hanging on.
// ============================================================
const SERIF = 'italic 400 % Georgia, "Times New Roman", serif';
const ROMAN = '400 % Georgia, "Times New Roman", serif';
const SCRIPT = '400 % "Snell Roundhand", "Brush Script MT", "Segoe Script", "Apple Chancery", cursive';

// The title card on bare linen. sec: seconds since the page opened (paints the letters in).
function drawTitle(sec) {
  const cx = CW / 2, cy = CH / 2;
  const sz = Math.min(CW * 0.064, CH * 0.105);
  const ink = [0.12, 0.19, 0.31], gold = [0.52, 0.37, 0.13];
  // a small gold crescent moon above the words
  const mx = cx, my = cy - sz * 2.05, mr = sz * 0.34;
  for (let i = 0; i < 6; i++) {
    const r = mr * (1 - i * 0.07), a0 = -2.2 + i * 0.04, a1 = 1.9 - i * 0.02;
    const pts = [];
    for (let k = 0; k <= 6; k++) { const a = lerp(a0, a1, k / 6); pts.push({ x: mx + Math.cos(a) * r, y: my + Math.sin(a) * r, w: sz * 0.09, c: mixc([0.62, 0.46, 0.18], [0.85, 0.66, 0.28], i / 5) }); }
    strokeScreen(pts, { dry: 0.3, h: 0.5, jit: 0.3 });
  }
  paintText('Nocturne in Blue and Gold', SERIF, cx, cy - sz * 0.75, sz, ink, { dry: 0.2, h: 0.5, jit: 0.25, rows: 24 });
  // a gold hairline between the title and the line beneath it
  strokeScreen([{ x: cx - sz * 2.6, y: cy - sz * 0.02, w: sz * 0.035, c: gold }, { x: cx + sz * 2.6, y: cy + sz * 0.01, w: sz * 0.035, c: gold }], { dry: 0.35, h: 0.4, w0: 0.2, tip: 0.2, tS: 0.4, tE: 0.4, jit: 0.2 });
  paintText('a quiet study in oils  \u00b7  one minute', SERIF, cx, cy + sz * 0.42, sz * 0.46, gold, { dry: 0.1, h: 0.4, jit: 0.15, rows: 16, wk: 1.9 });
  const pulse = 0.5 + 0.5 * Math.sin(sec * 2.4);
  paintText('click anywhere to begin \u2014 with sound', ROMAN, cx, cy + sz * 1.62, sz * 0.33, [0.2, 0.2, 0.26], { dry: 0.1, h: 0.3, jit: 0.15, rows: 16, wk: 1.9, a: 0.45 + 0.55 * pulse });
  // a butterfly monogram, the way Whistler signed his nocturnes
  const bx = CW - sz * 1.4, by = CH - sz * 1.2, bs = sz * 0.36;
  const bc = [0.3, 0.26, 0.24];
  for (const sg of [-1, 1]) {
    strokeScreen([{ x: bx, y: by, w: bs * 0.12, c: bc }, { x: bx + sg * bs * 0.55, y: by - bs * 0.55, w: bs * 0.2, c: bc }, { x: bx + sg * bs * 0.8, y: by - bs * 0.15, w: bs * 0.14, c: bc }, { x: bx + sg * bs * 0.2, y: by + bs * 0.05, w: bs * 0.08, c: bc }], { dry: 0.3, h: 0.4, jit: 0.2 });
    strokeScreen([{ x: bx, y: by + bs * 0.05, w: bs * 0.08, c: bc }, { x: bx + sg * bs * 0.4, y: by + bs * 0.35, w: bs * 0.12, c: bc }, { x: bx + sg * bs * 0.15, y: by + bs * 0.45, w: bs * 0.06, c: bc }], { dry: 0.3, h: 0.4, jit: 0.2 });
  }
  strokeScreen([{ x: bx, y: by - bs * 0.2, w: bs * 0.07, c: bc }, { x: bx, y: by + bs * 0.35, w: bs * 0.05, c: bc }, { x: bx + bs * 0.3, y: by + bs * 0.9, w: bs * 0.03, c: bc }], { dry: 0.3, h: 0.4, jit: 0.2, tip: 0.1 });
}

// ---------------------------------------------------------------- the gallery wall
// Everything is laid out in units of the frame's height on screen, around the frame centre.
const GAL = { strike: 106.6, script: 107.1, laugh: 108.3 };
function drawGallery(t, b, gv) {
  const S = CH * gv.s, cx = CW / 2, cy = gv.cy, A = CW / CH;
  const P = (u, v, w, c, a) => ({ x: cx + u * S, y: cy + v * S, w: w * S, c, a });
  const fw = 0.085, hx = A / 2, hy = 0.5;
  const rnd = mulberry(4040);
  G.boil = Math.floor(t * 6); G.jit = 0.3; G.mid = 0;
  G.rev = null;
  const uMax = A * 0.5 / gv.s + 0.2, vMin = -0.5 / gv.s - 0.15, vMax = 0.5 / gv.s + 0.25;
  const dado = hy + fw + 0.36;
  const inner = hx + fw * 0.4;
  // the wall: deep oxblood, laid in with broad, slightly diagonal strokes around the picture
  for (let v = vMin; v < dado; v += 0.042) {
    let u = -uMax - rnd() * 0.1;
    while (u < uMax) {
      const len = 0.24 + rnd() * 0.34;
      const c = mixc([0.44, 0.1, 0.1], [0.5, 0.13, 0.12], rnd());
      const segs = Math.abs(v) < hy + fw * 0.4 ? [[u, Math.min(u + len, -inner)], [Math.max(u, inner), u + len]] : [[u, u + len]];
      for (const [a0, a1] of segs) {
        if (a1 - a0 < 0.03) continue;
        const dv = (rnd() - 0.5) * 0.03;
        strokeScreen([P(a0, v - dv * 0.5, 0.066, c), P((a0 + a1) / 2, v, 0.066, c), P(a1, v + dv * 0.5, 0.066, c)], { dry: 0.3, h: 0.22 });
      }
      u += len * (0.72 + rnd() * 0.2);
    }
  }
  // a quiet damask, one shade darker, repeated across the wall
  const dk = [0.3, 0.05, 0.06], lt = [0.62, 0.2, 0.15];
  for (let gy = vMin + 0.05, row = 0; gy < dado - 0.06; gy += 0.21, row++) {
    for (let gx = -uMax + (row % 2) * 0.1; gx < uMax; gx += 0.2) {
      if (Math.abs(gy) < hy + fw + 0.06 && Math.abs(gx) < hx + fw + 0.06) continue;
      const u = gx, v = gy;
      // a fleur-de-lis: a tall central petal, two petals curling out and down, a band, a foot
      strokeScreen([P(u, v + 0.012, 0.016, dk), P(u, v - 0.02, 0.013, dk), P(u, v - 0.05, 0.002, dk)], { dry: 0.15, h: 0.3, jit: 0.08, w0: 1, tip: 0.1 });
      for (const sx of [-1, 1]) {
        strokeScreen([P(u + sx * 0.006, v + 0.004, 0.008, dk), P(u + sx * 0.024, v - 0.018, 0.009, dk), P(u + sx * 0.038, v - 0.006, 0.007, dk), P(u + sx * 0.032, v + 0.012, 0.003, dk)], { dry: 0.2, h: 0.3, jit: 0.08, tip: 0.2 });
      }
      strokeScreen([P(u - 0.02, v + 0.014, 0.006, dk), P(u + 0.02, v + 0.014, 0.006, dk)], { dry: 0.2, h: 0.3, jit: 0.08, sq: 0.6 });
      strokeScreen([P(u, v + 0.018, 0.009, dk), P(u, v + 0.04, 0.002, dk)], { dry: 0.2, h: 0.3, jit: 0.08, w0: 1, tip: 0.1 });
      strokeScreen([P(u - 0.003, v - 0.035, 0.0035, lt), P(u - 0.003, v - 0.008, 0.0035, lt)], { dry: 0.3, a: 0.55, jit: 0.08 });
    }
  }
  // dado rail and the darker panelling below it
  strokeScreen([P(-uMax, dado, 0.026, [0.62, 0.48, 0.25]), P(uMax, dado, 0.026, [0.62, 0.48, 0.25])], { dry: 0.3, h: 0.6, sq: 1, w0: 1, tip: 1 });
  strokeScreen([P(-uMax, dado + 0.018, 0.01, [0.16, 0.05, 0.05]), P(uMax, dado + 0.018, 0.01, [0.16, 0.05, 0.05])], { dry: 0.4, sq: 1, w0: 1, tip: 1 });
  for (let v = dado + 0.03; v < vMax; v += 0.04) {
    strokeScreen([P(-uMax, v, 0.05, [0.23, 0.055, 0.065]), P(0, v + 0.004, 0.05, [0.27, 0.065, 0.07]), P(uMax, v, 0.05, [0.23, 0.055, 0.065])], { dry: 0.35, h: 0.25 });
  }
  for (let u = -uMax + 0.1; u < uMax; u += 0.42) {
    strokeScreen([P(u, dado + 0.08, 0.008, [0.5, 0.36, 0.2]), P(u + 0.34, dado + 0.08, 0.008, [0.5, 0.36, 0.2])], { dry: 0.4, a: 0.6 });
  }
  // the gilded frame: moulding strokes graded from a pale slip and dark lip to a bright bead and a bronze edge
  const band = [[0.0, 0.012, [0.83, 0.77, 0.6]], [0.013, 0.012, [0.24, 0.15, 0.06]], [0.024, 0.018, [0.72, 0.55, 0.22]],
                [0.04, 0.009, [0.98, 0.86, 0.5]], [0.05, 0.02, [0.66, 0.49, 0.18]], [0.068, 0.012, [0.45, 0.31, 0.11]], [0.079, 0.01, [0.26, 0.17, 0.07]]];
  for (const [d, w, c] of band) {
    const x = hx + d + w / 2, y = hy + d + w / 2;
    const lit = mixc(c, [1, 0.93, 0.7], 0.14), dim = scalec(c, 0.78);
    const o = { dry: 0.2, h: 0.7, gloss: 0.8, sq: 0.9, w0: 1, tip: 1 };
    strokeScreen([P(-x, -y, w, lit), P(0, -y, w, lit), P(x, -y, w, lit)], o);
    strokeScreen([P(-x, y, w, dim), P(0, y, w, dim), P(x, y, w, dim)], o);
    strokeScreen([P(-x, -y, w, lit), P(-x, 0, w, c), P(-x, y, w, dim)], o);
    strokeScreen([P(x, -y, w, c), P(x, 0, w, dim), P(x, y, w, dim)], o);
  }
  // carved ornament: gold leaves along the moulding and a cartouche at each corner
  for (let i = 0; i < 40; i++) {
    const f = (i + 0.5) / 40, d = 0.058;
    const pts = [[-hx - d + f * (2 * hx + 2 * d), -hy - d], [-hx - d + f * (2 * hx + 2 * d), hy + d], [-hx - d, -hy - d + f * (2 * hy + 2 * d)], [hx + d, -hy - d + f * (2 * hy + 2 * d)]];
    for (const [u, v] of pts) strokeScreen([P(u, v, 0.012, [0.95, 0.8, 0.42])], { len: 0.02 * S, ang: (i % 2 ? 0.7 : -0.7), dry: 0.2, h: 0.8, gloss: 0.9 });
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const u = sx * (hx + 0.045), v = sy * (hy + 0.045);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU;
      strokeScreen([P(u + Math.cos(a) * 0.022, v + Math.sin(a) * 0.022, 0.018, [0.92, 0.76, 0.36])], { len: 0.032 * S, ang: a, dry: 0.2, h: 0.8, gloss: 0.9 });
    }
    strokeScreen([P(u, v, 0.03, [1.0, 0.9, 0.55])], { len: 0.03 * S, ang: 0.5, dry: 0.1, h: 0.9, gloss: 1 });
  }
  // a brass picture light, and the warm glow it throws down the canvas
  const lv = -hy - fw - 0.07;
  strokeScreen([P(0, lv + 0.035, 0.16, [1.0, 0.85, 0.55])], { kind: 1, len: 0.75 * S, ang: 0, a: 0.25 });
  strokeScreen([P(-0.27, lv, 0.028, [0.72, 0.58, 0.3]), P(0.27, lv, 0.028, [0.72, 0.58, 0.3])], { dry: 0.2, h: 0.7, gloss: 1, sq: 0.8 });
  strokeScreen([P(-0.26, lv + 0.012, 0.008, [1, 0.96, 0.75]), P(0.26, lv + 0.012, 0.008, [1, 0.96, 0.75])], { dry: 0.2, a: 0.95 });
  for (const sx of [-1, 1]) strokeScreen([P(sx * 0.12, lv, 0.01, [0.55, 0.43, 0.2]), P(sx * 0.1, -hy - fw + 0.005, 0.01, [0.55, 0.43, 0.2])], { dry: 0.3 });
  // the museum label: cream card, black letters... which someone is about to deface
  const lk = Math.min(1, A * 1.05 / 0.92);
  const cV = hy + fw + 0.155 * lk, cW = 0.92 * lk, cH = 0.2 * lk;
  strokeScreen([P(-cW / 2 + 0.014, cV + 0.014, cH, [0.1, 0.02, 0.02]), P(cW / 2 + 0.014, cV + 0.014, cH, [0.1, 0.02, 0.02])], { sq: 1, w0: 1, tip: 1, dry: 0.05, a: 0.55, kind: 1 });
  for (let k = 0; k < 7; k++) {
    const v = cV - cH / 2 + (k + 0.5) * cH / 7;
    strokeScreen([P(-cW / 2, v, cH / 7 * 1.35, [0.95, 0.92, 0.84]), P(cW / 2, v, cH / 7 * 1.35, [0.97, 0.94, 0.87])], { sq: 1, w0: 1, tip: 1, dry: 0.06, h: 0.12 });
  }
  const s1 = 0.064 * S * lk;
  const tw = paintText('Nocturne in Blue and Gold', SERIF, cx, cy + (cV - 0.045 * lk) * S, s1, [0.06, 0.05, 0.08], { dry: 0.02, h: 0.4, jit: 0.06, rows: 18, wk: 2.1, w0: 1, tip: 1 });
  paintText('oil and code on canvas  \u00b7  2026', ROMAN, cx, cy + (cV + 0.025 * lk) * S, s1 * 0.46, [0.25, 0.23, 0.25], { dry: 0.02, h: 0.3, jit: 0.06, rows: 12, wk: 2.0, w0: 1, tip: 1 });
  const red = [0.88, 0.1, 0.08];
  const y1 = cy + (cV - 0.045 * lk) * S;
  strokeScreen([{ x: cx - tw.w * 0.56, y: y1 + s1 * 0.14, w: s1 * 0.22, c: red }, { x: cx, y: y1 - s1 * 0.02, w: s1 * 0.25, c: red }, { x: cx + tw.w * 0.56, y: y1 - s1 * 0.18, w: s1 * 0.2, c: red }],
    { dry: 0.3, h: 0.75, rev: [GAL.strike * BEAT, NO_OUT] });
  const t2 = GAL.script * BEAT;
  const sx0 = cx - tw.w * 0.62, sw = tw.w * 1.24;
  paintText('(you\u2019ve been Rickrolled)', SCRIPT, cx + 0.02 * S * lk, cy + (cV + 0.072 * lk) * S, s1 * 1.5, red, {
    dry: 0.03, h: 0.8, jit: 0.08, rows: 20, wk: 2.1,
    revFn: x => [t2 + 1.2 * clamp((x - sx0) / sw, 0, 1), NO_OUT]
  });
  if (A > 0.9) drawVisitor(t, b, P, A, gv);
}

// a gallery-goer in a bowler hat, seen from behind; his shoulders shake when the joke lands,
// and he wanders off before we go back into the painting
function drawVisitor(t, b, P, A, gv) {
  const arrive = easeOutCubic(seg(b, 101.6, 103.6)), leave = easeInOutCubic(seg(b, 112.4, 115.0));
  if (arrive <= 0 || leave >= 1) return;
  const laugh = smoothstep(GAL.laugh, GAL.laugh + 0.3, b) * (1 - smoothstep(GAL.laugh + 3.4, GAL.laugh + 4.4, b));
  const shake = laugh * (0.006 * Math.sin(t * 40) + 0.004 * Math.sin(t * 17));
  const tilt = 0.06 * smoothstep(105.8, 106.6, b) * (1 - laugh) - 0.03 * laugh;
  const walk = leave > 0 ? Math.abs(Math.sin(t * 9)) * 0.012 : 0;
  const bx = A * 0.5 / gv.s - 0.36 + (1 - arrive) * 0.8 + leave * 0.9, bot = 0.5 / gv.s + 0.05 - walk;
  const coat = [0.09, 0.09, 0.12], coatL = [0.2, 0.19, 0.24], rim = [0.98, 0.74, 0.44];
  const skin = [0.62, 0.43, 0.34], skinD = [0.42, 0.27, 0.22], hair = [0.22, 0.14, 0.1], hat = [0.035, 0.033, 0.045];
  const sh = shake;
  // coat: a solid block of dark strokes with rounded shoulders, dropping out of the picture
  for (let k = 0; k < 6; k++) {
    const f = k / 5, v = lerp(bot - 0.15, bot + 0.06, f) + sh * (1 - f);
    const hw = lerp(0.19, 0.25, Math.sqrt(f));
    strokeScreen([P(bx - hw, v, 0.07, coat), P(bx + hw, v, 0.07, coat)], { dry: 0.04, h: 0.35, sq: 0.5 });
  }
  strokeScreen([P(bx - 0.235, bot - 0.07 + sh, 0.09, coat), P(bx - 0.15, bot - 0.165 + sh, 0.08, coat), P(bx, bot - 0.185 + sh, 0.08, coat), P(bx + 0.15, bot - 0.165 + sh, 0.08, coat), P(bx + 0.235, bot - 0.07 + sh, 0.09, coat)], { dry: 0.04, h: 0.4 });
  strokeScreen([P(bx + 0.004, bot - 0.17 + sh, 0.01, coatL), P(bx, bot + 0.06, 0.01, coatL)], { dry: 0.4, a: 0.6 });
  strokeScreen([P(bx - 0.205, bot - 0.15 + sh, 0.01, rim), P(bx - 0.13, bot - 0.212 + sh, 0.01, rim), P(bx - 0.05, bot - 0.228 + sh, 0.008, rim)], { dry: 0.3, a: 0.85 });
  strokeScreen([P(bx + 0.05, bot - 0.228 + sh, 0.008, rim), P(bx + 0.13, bot - 0.212 + sh, 0.01, rim), P(bx + 0.205, bot - 0.15 + sh, 0.01, rim)], { dry: 0.3, a: 0.5 });
  // turned-up collar, a neck that meets it, the back of the head
  const hx0 = bx + tilt * 0.5, hc = bot - 0.31 + sh * 1.2;
  strokeScreen([P(hx0, hc + 0.13, 0.075, skinD), P(hx0, hc + 0.05, 0.075, skin)], { dry: 0.08 });
  strokeScreen([P(bx - 0.065, bot - 0.19 + sh, 0.04, coatL), P(bx, bot - 0.205 + sh, 0.042, coatL), P(bx + 0.065, bot - 0.19 + sh, 0.04, coatL)], { dry: 0.15 });
  for (const sg of [-1, 1]) strokeScreen([P(hx0 + sg * 0.064, hc + 0.015, 0.024, skin), P(hx0 + sg * 0.066, hc + 0.045, 0.018, skinD)], { dry: 0.2 });
  strokeScreen([P(hx0, hc + 0.078, 0.12, hair), P(hx0, hc + 0.02, 0.135, hair), P(hx0, hc - 0.03, 0.12, hair)], { dry: 0.05, h: 0.4 });
  strokeScreen([P(hx0 - 0.03, hc + 0.05, 0.008, [0.42, 0.3, 0.22]), P(hx0 - 0.035, hc - 0.01, 0.008, [0.42, 0.3, 0.22])], { dry: 0.4, a: 0.6 });
  // the bowler: a domed crown on an upturned brim, a band, a glint of lamplight
  const hb = hc - 0.045;
  const dome = [[-0.078, 0], [-0.07, -0.05], [-0.035, -0.083], [0, -0.09], [0.035, -0.083], [0.07, -0.05], [0.078, 0]];
  strokeScreen(dome.map(([u, v]) => P(hx0 + u + tilt * 0.3, hb + v * 0.5, 0.06, hat)), { dry: 0.05, h: 0.5 });
  strokeScreen([P(hx0 - 0.06 + tilt * 0.3, hb - 0.02, 0.07, hat), P(hx0 + 0.06 + tilt * 0.3, hb - 0.02, 0.07, hat)], { dry: 0.05, h: 0.5 });
  strokeScreen([P(hx0 - 0.078 + tilt * 0.3, hb - 0.002, 0.012, [0.16, 0.15, 0.18]), P(hx0 + 0.078 + tilt * 0.3, hb - 0.002, 0.012, [0.16, 0.15, 0.18])], { dry: 0.2 });
  strokeScreen([P(hx0 - 0.125, hb + 0.002 + tilt * 0.3, 0.014, hat), P(hx0 - 0.09, hb + 0.012, 0.018, hat), P(hx0 + 0.09, hb + 0.012, 0.018, hat), P(hx0 + 0.125, hb + 0.002 - tilt * 0.3, 0.014, hat)], { dry: 0.05, h: 0.5 });
  strokeScreen([P(hx0 - 0.055 + tilt * 0.3, hb - 0.058, 0.01, rim), P(hx0 - 0.01 + tilt * 0.3, hb - 0.077, 0.009, rim), P(hx0 + 0.03 + tilt * 0.3, hb - 0.075, 0.007, rim)], { dry: 0.35, a: 0.9 });
}
