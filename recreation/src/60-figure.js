// ============================================================================
// The dancer, painted stroke by stroke from the posed skeleton. Limbs and the
// body are painted as tubes whose strokes wrap the side facing the camera, so
// the figure holds together from any angle (the spin, the look back).
// ============================================================================
const MAT = {
  coat:   { s: [0.3, 0.2, 0.2], m: [0.62, 0.44, 0.28], l: [0.9, 0.72, 0.48], rim: [0.44, 0.34, 0.76], d: [0.22, 0.14, 0.12] },
  lining: { s: [0.13, 0.08, 0.10], m: [0.33, 0.21, 0.17], l: [0.55, 0.37, 0.25], rim: [0.30, 0.26, 0.50] },
  knit:   { s: [0.03, 0.03, 0.05], m: [0.08, 0.075, 0.10], l: [0.21, 0.16, 0.16], rim: [0.22, 0.21, 0.44] },
  trous:  { s: [0.035, 0.03, 0.05], m: [0.09, 0.08, 0.105], l: [0.23, 0.18, 0.18], rim: [0.25, 0.24, 0.48] },
  skin:   { s: [0.50, 0.28, 0.27], m: [0.84, 0.55, 0.43], l: [0.97, 0.73, 0.58], rim: [0.76, 0.56, 0.64] },
  hair:   { s: [0.30, 0.11, 0.07], m: [0.66, 0.28, 0.11], l: [0.98, 0.63, 0.31], rim: [0.62, 0.34, 0.48] },
  chrome: { s: [0.10, 0.10, 0.13], m: [0.40, 0.41, 0.46], l: [0.88, 0.88, 0.92], rim: [0.50, 0.48, 0.82] },
  shoe:   { s: [0.03, 0.02, 0.03], m: [0.10, 0.07, 0.065], l: [0.32, 0.23, 0.21], rim: [0.25, 0.24, 0.46] },
  handle: { s: [0.02, 0.02, 0.03], m: [0.07, 0.07, 0.08], l: [0.24, 0.22, 0.24], rim: [0.20, 0.20, 0.40] }
};
// material slots for the pop-art prints
const SLOT = { bg: 0, coat: 1, skin: 2, hair: 3, black: 4, mic: 5, detail: 6 };

// colour a surface of material `mat` with normal n under the scene's figure lights
function shade(mat, n, j) {
  const K = G.key, R = G.rim;
  const lk = clamp(sstep(-0.3, 1.05, vdot(n, K.dir)) * K.int, 0, 1.3);
  let c = mix3(mat.s, mat.m, sstep(0, 0.45, lk));
  c = mix3(c, mat.l, sstep(0.5, 1.2, lk));
  c = tint3(c, mix3([1, 1, 1], K.col, sat(lk)));
  const lr = sstep(0.1, 0.9, vdot(n, R.dir)) * R.int;
  c = mix3(c, tint3(mat.rim || mat.m, R.col), clamp(lr * 0.4 * (1 - 0.7 * sstep(0.35, 1.0, lk)), 0, 1));
  c = tint3(c, G.amb);
  if (j) c = mul3(c, 1 + j);
  return c;
}
const toCam = p => vnorm(vsub(G.cam.pos, p));
const camDepth = p => vdot(vsub(p, G.cam.pos), G.cam.f);

// ---------------------------------------------------------------- tubes
// axis: V[], rad: radii (cm). Strokes run along the tube at angles spread over the
// half that faces the camera, painted from the silhouette in toward the middle.
function paintTube(axis, rad, mat, o) {
  o = o || {};
  const n = axis.length;
  const K = o.k || 5;
  const N0 = [], S = [];
  for (let i = 0; i < n; i++) {
    const a = axis[Math.max(0, i - 1)], b = axis[Math.min(n - 1, i + 1)];
    const d = vnorm(vsub(b, a));
    const tc = vperp(d, toCam(axis[i]));
    N0.push(tc); S.push(vnorm(vcross(d, tc)));
  }
  if (o.under !== false) {
    st(axis, rad.map(r => r * 2.04), shade(mat, N0[n >> 1], -0.14),
      { dry: 0.05, h: 0.25, w0: sdef(o, 'w0U', 0.95), tip: sdef(o, 'tipU', 0.9), tS: 0.05, tE: 0.1, sq: o.sq || 0 });
  }
  const span = Math.PI * 0.9;
  const phis = [];
  for (let k = 0; k < K; k++) phis.push(((k + 0.5) / K - 0.5) * span);
  phis.sort((p, q) => Math.abs(q) - Math.abs(p));
  const dphi = span / K;
  for (const phi of phis) {
    const c = Math.cos(phi), s = Math.sin(phi);
    const pts = [], ws = [], cols = [];
    for (let i = 0; i < n; i++) {
      const nn = vadd(vmul(N0[i], c), vmul(S[i], s));
      pts.push(vmad(axis[i], nn, rad[i] * 0.8));
      ws.push(rad[i] * dphi * (0.6 + 0.6 * c) * 1.45);
      cols.push(shade(mat, nn, (hash(phi * 7.3 + i + (o.seed || 0)) - 0.5) * 0.1));
    }
    st(pts, ws, cols, { dry: sdef(o, 'dry', 0.25), h: sdef(o, 'h', 0.42), tip: sdef(o, 'tip', 0.8), w0: 0.8 });
  }
}
// thin stroke along the silhouette edge of a tube facing `dirToLight`
function tubeRim(axis, rad, dirToLight, col, w, a) {
  const pts = axis.map((p, i) => {
    const d = vnorm(vsub(axis[Math.min(axis.length - 1, i + 1)], axis[Math.max(0, i - 1)]));
    const tc = vperp(d, toCam(p));
    const sd = vnorm(vcross(d, tc));
    const sgn = vdot(sd, dirToLight) > 0 ? 1 : -1;
    return vmad(vmad(p, sd, sgn * rad[i] * 0.9), tc, rad[i] * 0.3);
  });
  st(pts, w, col, { a: a || 0.6, dry: 0.5, noShadow: true, exact: true, noId: true });
}

// ---------------------------------------------------------------- legs & shoes
function drawLeg(J, s) {
  const sg = s === 'L' ? -1 : 1;
  const hip = J['hip' + s], kn = J['kn' + s], an = J['an' + s], ft = J['foot' + s];
  const top = vadd(hip, V(0, 6, 0));
  const hem = vadd(vlerp(an, ft.ball, 0.35), V(0, -0.5, 0));
  G.slot = SLOT.black;
  // shoe first, the trouser hem breaks over it
  const up = V(0, 1, 0);
  const shoe = shade(MAT.shoe, vnorm(vadd(up, vmul(ft.dir, 0.8))));
  st([vadd(an, V(0, -1.5, 0)), vadd(ft.ball, V(0, 2.6, 0)), vadd(ft.toe, V(0, 1.5, 0))], [8.6, 10, 9], shoe,
    { dry: 0.1, h: 0.45, gloss: 0.9, w0: 0.95, tip: 0.9, tE: 0.2 });
  st([vadd(ft.heel, V(0, 1.4, 0)), vadd(ft.ball, V(0, 0.5, 0)), vadd(ft.toe, V(0, 0.6, 0))], [8.4, 10, 8.6], MAT.shoe.s,
    { a: 0.9, dry: 0.15, h: 0.3, w0: 0.95, tip: 0.9 });
  dab(vadd(ft.toe, V(-sg * 1.2, 3.2, 0)), 1.4, 2.8, [0.46, 0.4, 0.44], { dry: 0.3, gloss: 1, a: 0.65, noShadow: true, noId: true });
  paintTube([top, hip, kn, an, hem], [9.2, 8.9, 7.3, 6.3, 6.6], MAT.trous, { k: 3, dry: 0.28, h: 0.32, tip: 0.95, sq: 0.5 });
  // creases at the knee and the break at the hem
  const kf = vmad(kn, toCam(kn), 6);
  st([vadd(kf, V(-3, 2.5, 0)), vadd(kf, V(0.4, -1, 0)), vadd(kf, V(3, 2, 0))], 1.2, MAT.trous.s, { a: 0.7, dry: 0.4, noShadow: true });
  st([vadd(hem, V(-5.5, 1.4, 0)), vadd(vmad(hem, toCam(hem), 3), V(0, 0.3, 0)), vadd(hem, V(5.5, 1.4, 0))], 1.6, MAT.trous.s, { a: 0.75, dry: 0.3, noShadow: true });
  tubeRim([hip, kn, an], [8.9, 7.3, 6.3], G.rim.dir, tint3(MAT.trous.rim, G.rim.col), 1.4, 0.55);
}

// ---------------------------------------------------------------- the coat skirt (simulated)
function skirtSegs(off) {
  const g = i => off ? vadd(simGet(i), off) : simGet(i);
  const segs = [];
  for (let k = 0; k < SKIRT_N - 1; k++) {
    const c0 = SIM.cols[k], c1 = SIM.cols[k + 1];
    segs.push({ k, a0: g(c0.a), a1: g(c1.a), m0: g(c0.m), m1: g(c1.m), h0: g(c0.h), h1: g(c1.h) });
  }
  return segs;
}
function drawSkirtSeg(sg) {
  const A = vlerp(sg.a0, sg.a1, 0.5), M = vlerp(sg.m0, sg.m1, 0.5), H = vlerp(sg.h0, sg.h1, 0.5);
  const across = vsub(sg.m1, sg.m0), down = vsub(H, A);
  const n = vnorm(vcross(across, down));
  const vis = vdot(n, toCam(M));
  const inside = vis < 0;
  const mat = inside ? MAT.lining : MAT.coat;
  const nn = inside ? vneg(n) : n;
  G.slot = SLOT.coat;
  const wa = vdist(sg.a0, sg.a1), wm = vdist(sg.m0, sg.m1), wh = vdist(sg.h0, sg.h1);
  const c0 = shade(mat, vnorm(vadd(nn, V(0, 0.25, 0))), (hash(sg.k * 3.7) - 0.5) * 0.05);
  const c1 = shade(mat, nn, (hash(sg.k * 5.1) - 0.5) * 0.05);
  const c2 = shade(mat, vnorm(vadd(nn, V(0, -0.3, 0))), -0.05);
  st([A, M, H], [wa * 1.45 + 2.5, wm * 1.45 + 2.5, wh * 1.45 + 2.5], [c0, c1, c2], { dry: 0.12, h: 0.36, tip: 0.85, w0: 0.9, tE: 0.1 });
  // a few soft folds, and the hem
  if ((sg.k === 3 || sg.k === 9) && !inside) {
    st([vlerp(sg.a0, sg.a1, 0.6), vlerp(sg.m0, sg.m1, 0.4), vlerp(sg.h0, sg.h1, 0.5)], [0.8, 2.2, 1.6], shade(MAT.coat, vneg(nn), -0.1),
      { a: 0.4, dry: 0.5, w0: 0.3, tip: 0.5, noShadow: true });
  }
  st([sg.h0, sg.h1], 2.4, inside ? MAT.lining.s : MAT.coat.d, { dry: 0.3, a: 0.9, sq: 0.5 });
  // the front edges of the coat catch the light
  if (sg.k === 0) st([sg.a0, sg.m0, sg.h0], 1.8, shade(MAT.coat, V(-0.3, 0.5, 0.8), 0.12), { a: 0.85, dry: 0.3, noShadow: true });
  if (sg.k === SKIRT_N - 2) st([sg.a1, sg.m1, sg.h1], 1.8, shade(MAT.coat, V(0.3, 0.5, 0.8), 0.05), { a: 0.85, dry: 0.3, noShadow: true });
}

// ---------------------------------------------------------------- torso (coat above the belt)
function torsoRings(J) {
  return [
    { c: xf(J.pelvis, J.Rp, 0, SKIRT_Y + 1, 0.3), R: J.Rp, rx: 19, rz: 14 },
    { c: xf(J.waist, J.Rw, 0, 5, 0.5), R: J.Rw, rx: 18, rz: 12.6 },
    { c: xf(J.chest, J.Rc, 0, 2, 0.8), R: J.Rc, rx: 19.6, rz: 13 },
    { c: xf(J.neck, J.Rc, 0, -5, -0.6), R: J.Rc, rx: 20.4, rz: 11 }
  ];
}
const ringPt = (rg, th, k) => xf(rg.c, rg.R, Math.cos(th) * rg.rx * (k || 1), 0, Math.sin(th) * rg.rz * (k || 1));
const ringN = (rg, th) => vnorm(mapply(rg.R, V(Math.cos(th) / rg.rx, 0.08, Math.sin(th) / rg.rz)));

function drawTorso(J) {
  const rings = torsoRings(J);
  const fwd = facing(J, J.Rc, G.cam);
  G.slot = SLOT.coat;
  // underpaint: the silhouette of each ring, joined top to bottom
  const centres = [], widths = [];
  for (const rg of rings) {
    let lo = 1e9, hi = -1e9, plo = null, phi = null;
    for (let i = 0; i < 24; i++) {
      const p = ringPt(rg, i / 24 * TAU);
      const q = G.proj(p);
      if (q.x < lo) { lo = q.x; plo = p; }
      if (q.x > hi) { hi = q.x; phi = p; }
    }
    centres.push(vlerp(plo, phi, 0.5));
    widths.push(vdist(plo, phi) * 1.02);
  }
  st(centres, widths, shade(MAT.coat, toCam(J.chest), -0.18), { dry: 0.04, h: 0.25, w0: 0.97, tip: 0.97, tS: 0.03, tE: 0.05, sq: 0.6 });
  // wrapping strokes, silhouette first
  const K = 16, list = [];
  for (let k = 0; k < K; k++) {
    const th = (k + 0.5) / K * TAU;
    const n = ringN(rings[2], th);
    const vis = vdot(n, toCam(rings[2].c));
    if (vis > -0.1) list.push({ th, vis });
  }
  list.sort((a, b) => a.vis - b.vis);
  for (const { th, vis } of list) {
    const pts = rings.map(rg => ringPt(rg, th, 0.86));
    const cols = rings.map((rg, i) => shade(MAT.coat, ringN(rg, th), (hash(th * 5.1 + i) - 0.5) * 0.05 + (i === 3 ? 0.03 : 0)));
    const w = 2 * Math.PI * 16 / K * (0.5 + 0.7 * sat(vis)) * 1.6;
    st(pts, [w * 0.95, w, w * 1.05, w], cols, { dry: 0.12, h: 0.36, w0: 0.85, tip: 0.8 });
  }
  if (fwd > -0.15) drawCoatFront(J, rings, sat((fwd + 0.15) / 0.4));
  if (fwd < 0.15) drawCoatBack(J, rings, sat((0.15 - fwd) / 0.4));
  drawBelt(J, rings);
  // epaulettes and the rim light along the shoulder line
  for (const sg of [-1, 1]) {
    const sh = sg < 0 ? J.shM : J.shF;
    st([xf(J.neck, J.Rc, sg * 7, 1.5, 0.5), xf(sh, J.Rc, sg * 3, 2.8, 0)], 3.2,
      shade(MAT.coat, mapply(J.Rc, vnorm(V(sg * 0.3, 1, 0.4))), 0.05), { dry: 0.3, h: 0.55, noShadow: true });
    dab(xf(sh, J.Rc, -sg * 1.5, 2.6, 1.2), 1.4, 1.4, [0.2, 0.12, 0.1], { dry: 0.1, gloss: 0.7, noShadow: true });
  }
}

function drawCoatFront(J, rings, a) {
  const Rc = J.Rc;
  // the black turtleneck in the V between the lapels
  G.slot = SLOT.black;
  st([xf(J.neck, Rc, 0, 3.5, 4), xf(J.chest, Rc, 0, 8, 12.4), xf(J.chest, Rc, 0, -4, 13.6)], [11, 9, 2.5],
    shade(MAT.knit, mapply(Rc, V(0, 0.2, 1))), { dry: 0.15, h: 0.3, a, w0: 1, tip: 0.2 });
  st([xf(J.neck, Rc, -1.5, 2, 5.5), xf(J.chest, Rc, -1.2, 5, 13)], 1.6, MAT.knit.l, { a: 0.5 * a, dry: 0.5, noShadow: true });
  G.slot = SLOT.coat;
  for (const sg of [-1, 1]) {
    const top = xf(J.neck, Rc, sg * 6.2, 3.5, 4.5);
    const notch = xf(J.chest, Rc, sg * 16, 7, 11.2);
    const notchIn = xf(J.chest, Rc, sg * 11.5, 10.5, 11.8);
    const brk = xf(J.chest, Rc, sg * 3, -8, 13.8);
    const n = mapply(Rc, vnorm(V(sg * 0.5, 0.35, 1)));
    // collar leaf, lapel, the roll line that catches the light, and its cast shadow
    st([xf(J.neck, Rc, sg * 3.5, 6.5, -3), xf(J.neck, Rc, sg * 8.5, 4.4, 2), notchIn], [3, 3.8, 3.2],
      shade(MAT.coat, mapply(Rc, vnorm(V(sg * 0.6, 0.6, 0.6)))), { dry: 0.25, h: 0.5, a });
    st([top, vlerp(top, notch, 0.55), notch, vlerp(notch, brk, 0.45), brk], [3.4, 5.4, 5.8, 4.6, 1.6],
      shade(MAT.coat, n, 0.03), { dry: 0.22, h: 0.55, tip: 0.5, a });
    st([top, vadd(vlerp(top, brk, 0.5), mapply(Rc, V(sg * 1.2, 0, 0.7))), brk], 1.5,
      shade(MAT.coat, V(-0.4, 0.7, 0.6), 0.14), { a: 0.9 * a, dry: 0.3, noShadow: true });
    st([vadd(notch, mapply(Rc, V(sg * 1.4, -1.3, -0.4))), vadd(vlerp(notch, brk, 0.5), mapply(Rc, V(sg * 1.9, 0, -0.4))),
      vadd(brk, mapply(Rc, V(sg * 1.5, -2, 0)))], 1.8, MAT.coat.d, { a: 0.7 * a, dry: 0.45, noShadow: true });
    dab(vlerp(notch, notchIn, 0.5), 1.2, 1.8, MAT.coat.d, { a: 0.9 * a, noShadow: true });
  }
  // storm flap over his right breast
  st([xf(J.neck, Rc, -12, -1, 7), xf(J.chest, Rc, -15, 4, 12.2), xf(J.chest, Rc, -12, -2, 13)], [4, 7, 5],
    shade(MAT.coat, mapply(Rc, vnorm(V(-0.4, 0.3, 1))), 0.04), { a: 0.85 * a, dry: 0.3, h: 0.5 });
  st([xf(J.chest, Rc, -19, 2, 10), xf(J.chest, Rc, -11, -3, 13.4)], 1.2, MAT.coat.d, { a: 0.7 * a, dry: 0.4, noShadow: true });
  // double-breasted buttons
  G.slot = SLOT.detail;
  for (const x of [-7.5, 7.5]) for (const y of [-3, -13]) {
    dab(xf(J.chest, Rc, x, y, 13.8), 2.1, 2.1, [0.18, 0.11, 0.09], { a, dry: 0.1, gloss: 0.8, noShadow: true });
    dab(xf(J.chest, Rc, x - 0.4, y + 0.4, 14.2), 0.7, 0.7, [0.55, 0.42, 0.34], { a: 0.8 * a, noShadow: true, noId: true });
  }
  G.slot = SLOT.coat;
  // rim light down the silhouette: warm on the key side, cool on the other
  for (const sg of [-1, 1]) {
    const pts = rings.slice(1).map(rg => ringPt(rg, sg < 0 ? Math.PI * 0.97 : 0.03, 0.98));
    const warm = vdot(mapply(J.Rc, V(sg, 0, 0)), G.key.dir) > vdot(mapply(J.Rc, V(sg, 0, 0)), G.rim.dir);
    st(pts, 1.2, warm ? mix3(G.key.col, [1, 0.86, 0.6], 0.5) : tint3([0.68, 0.6, 1.0], G.rim.col), { a: 0.55 * a, dry: 0.5, noShadow: true, exact: true, noId: true });
  }
}

function drawCoatBack(J, rings, a) {
  const Rc = J.Rc;
  // the back yoke (storm shield) across the shoulder blades, and the centre seam
  const pts = [];
  for (const th of [-0.2, -0.9, -1.5708, -2.24, -2.94]) pts.push(ringPt(rings[3], th, 1.02));
  st(pts.map(p => vadd(p, V(0, -4, 0))), 6, shade(MAT.coat, mapply(Rc, V(0, 0.4, -1)), 0.04), { a, dry: 0.3, h: 0.5 });
  st(pts.map(p => vadd(p, V(0, -8, 0))), 1.2, MAT.coat.d, { a: 0.7 * a, dry: 0.4, noShadow: true });
  st([ringPt(rings[3], -1.5708, 1.02), ringPt(rings[2], -1.5708, 1.02), ringPt(rings[1], -1.5708, 1.02)], 1.1, MAT.coat.d, { a: 0.6 * a, dry: 0.4, noShadow: true });
  // collar from behind
  st([xf(J.neck, Rc, -7, 5, -2), xf(J.neck, Rc, 0, 6.5, -6), xf(J.neck, Rc, 7, 5, -2)], 4.5, shade(MAT.coat, mapply(Rc, V(0, 0.6, -0.8)), 0.06), { a, dry: 0.25, h: 0.5 });
}

function drawBelt(J, rings) {
  const rg = rings[0];
  const list = [];
  for (let i = 0; i <= 20; i++) {
    const th = i / 20 * TAU;
    list.push({ p: ringPt(rg, th, 1.03), vis: vdot(ringN(rg, th), toCam(rg.c)) });
  }
  // the belt band where it faces us, drawn in runs
  let run = [];
  const flush = () => {
    if (run.length > 1) st(run, 4.8, shade(MAT.coat, toCam(rg.c), -0.16), { dry: 0.15, h: 0.5, w0: 0.9, tip: 0.9, noShadow: true });
    run = [];
  };
  for (const e of list) { if (e.vis > 0.05) run.push(e.p); else flush(); }
  flush();
  // knot and loose ends (simulated) at the front
  if (facing(J, J.Rp, G.cam) > 0) {
    const kn = xf(J.pelvis, J.Rp, 6, SKIRT_Y + 1.5, SKIRT_RZ + 2);
    dab(kn, 5.4, 5, shade(MAT.coat, toCam(kn), -0.05), { dry: 0.2, h: 0.6, noShadow: true });
    dab(vadd(kn, V(-0.8, 0.8, 1)), 1.6, 2, MAT.coat.d, { a: 0.8, noShadow: true });
  }
  for (let s = 0; s < 2; s++) {
    const pts = SIM.belts[s].map(simGet);
    const n = toCam(pts[1]);
    st(pts, [4, 3.8, 3.6, 3.5, 3.3], shade(MAT.coat, n, -0.2), { dry: 0.25, h: 0.45, tip: 0.9, w0: 0.9 });
    st(pts.slice(1), 0.8, MAT.coat.d, { a: 0.6, dry: 0.4, noShadow: true });
  }
}

// ---------------------------------------------------------------- arms and hands
function drawArm(J, which) {
  const M = which === 'M';
  const sg = M ? -1 : 1;
  const sh = M ? J.shM : J.shF, el = M ? J.elM : J.elF, wr = M ? J.wrM : J.wrF;
  const fo = vnorm(vsub(wr, el));
  const top = xf(sh, J.Rc, sg * 1.5, 3, 0);
  const cuff = vmad(wr, fo, -1.2);
  G.slot = SLOT.coat;
  paintTube([top, el, cuff], [7.5, 6.6, 5.9], MAT.coat, { k: 5, dry: 0.24, h: 0.45, tip: 0.9, seed: sg });
  // elbow crease and cuff strap
  const ef = vmad(el, toCam(el), 5);
  st([vmad(ef, vnorm(vsub(sh, el)), 3.5), ef, vmad(ef, fo, 3.5)], [0.6, 1.6, 0.6], MAT.coat.d, { a: 0.65, dry: 0.4, noShadow: true });
  const cf = vmad(wr, fo, -4.5);
  const pF = vperp(fo, toCam(cf));
  const lat = vnorm(vcross(fo, pF));
  st([vmad(cf, lat, 6.5), vmad(cf, pF, 3), vmad(cf, lat, -6.5)], 2.6, MAT.coat.d, { a: 0.85, dry: 0.25, noShadow: true });
  tubeRim([top, el, cuff], [7.5, 6.6, 5.9], G.key.dir, mix3(G.key.col, [1, 0.86, 0.6], 0.5), 1.1, 0.5);
  tubeRim([top, el, cuff], [7.5, 6.6, 5.9], G.rim.dir, tint3([0.68, 0.6, 1.0], G.rim.col), 1.0, 0.45);
  if (M) drawFist(J);
  else drawFreeHand(J);
}

function handCols(n) {
  return [shade(MAT.skin, n), shade(MAT.skin, vnorm(vadd(n, V(-0.5, 0.5, 0.3))), 0.05)];
}
function drawFist(J) {
  const mf = micFrame(J, SIM.mic.d);
  G.slot = SLOT.skin;
  const n = vperp(mf.d, toCam(mf.grip));
  const [cS, cL] = handCols(n);
  const fore = mf.fore;
  // the fist wraps the handle; knuckles along the handle, thumb over the top
  const g0 = vmad(mf.grip, mf.d, -3.2), g1 = vmad(mf.grip, mf.d, 3.6);
  st([vmad(J.wrM, fore, 0.5), vmad(vlerp(g0, g1, 0.5), fore, -1.5)], [6.4, 7.8], cS, { dry: 0.12, h: 0.45, w0: 0.9, tip: 0.9 });
  st([g0, vlerp(g0, g1, 0.5), g1], [7.2, 7.8, 6.8], cS, { dry: 0.12, h: 0.45, w0: 0.9, tip: 0.85 });
  const kn = vmad(vlerp(g0, g1, 0.5), n, 2.6);
  st([vmad(kn, mf.d, -3.3), kn, vmad(kn, mf.d, 3.3)], 1.9, cL, { a: 0.85, dry: 0.3, noShadow: true });
  for (let i = 0; i < 3; i++) st([vmad(vmad(kn, mf.d, -2.4 + i * 2.4), n, 0.3), vmad(vmad(kn, mf.d, -2.2 + i * 2.4), fore, 2.2)], 0.5, MAT.skin.s, { a: 0.55, dry: 0.4, noShadow: true, noId: true });
  st([vmad(vmad(mf.grip, mf.d, 3), fore, -2.5), vmad(vmad(g1, fore, 1.2), n, 1.2)], [2.4, 1.9], cL, { dry: 0.15, h: 0.4, tip: 0.8 });
}

function drawFreeHand(J) {
  const P = J.pose;
  const el = J.elF, wr = J.wrF;
  const fore = vnorm(vsub(wr, el));
  G.slot = SLOT.skin;
  const chestUp = mapply(J.Rc, V(0, 1, 0)), chestFwd = mapply(J.Rc, V(0, 0, 1));
  // fingers carry on from the forearm with a little wrist cock; the thumb points
  // forward for a relaxed hand and up for an offered, palm-up one
  const dir = vnorm(vadd(fore, vmul(chestUp, 0.25 * (1 - P.fHip))));
  const thumbHint = vnorm(vlerp(chestFwd, chestUp, P.fPalm));
  const lat = vperp(dir, thumbHint);
  const back = vnorm(vcross(dir, lat));
  const n = vdot(back, toCam(wr)) > 0 ? back : vneg(back);
  const [cS, cL] = handCols(n);
  const knuck = vmad(wr, dir, 8);
  const open = sat(P.fOpen * (1 - P.fPoint) * (1 - P.fSnap) * (1 - P.fHip));
  st([vmad(wr, dir, 0.4), vmad(wr, dir, 4.6), knuck], [6.4, 8, 8.2 - open], cS, { dry: 0.12, h: 0.45, w0: 0.9, tip: 0.85 });
  if (open > 0.05) {
    for (let i = 0; i < 4; i++) {
      const o = i - 1.5;
      const base = vmad(knuck, lat, -o * 1.9);
      const fd = vnorm(vadd(dir, vmul(lat, -o * 0.17 * open)));
      const len = (i === 0 || i === 3 ? 5.6 : 6.6) * (0.35 + 0.65 * open);
      st([vmad(base, fd, -1), vmad(base, fd, len)], [2.1, 1.6], i === 0 ? cL : cS, { dry: 0.15, h: 0.4, tip: 0.7, w0: 0.9 });
    }
  } else {
    // knuckles of a loose fist
    st([vmad(knuck, lat, -3.6), vmad(vmad(knuck, n, 1.3), lat, 0), vmad(knuck, lat, 3.6)], 2.5, cL, { a: 0.85, dry: 0.3, noShadow: true });
  }
  if (P.fPoint > 0.05) {
    const base = vmad(knuck, lat, 2.2);
    st([vmad(base, dir, -1), vmad(base, dir, 1 + 7.5 * P.fPoint)], [2.1, 1.7], cL, { dry: 0.12, h: 0.4, tip: 0.8, w0: 0.9 });
  }
  // thumb; a snap presses it to the middle finger and then flicks
  const th0 = vmad(vmad(wr, lat, 3.2), dir, 1.5);
  const snap = P.fSnap;
  const thTip = snap > 0.05 ? vmad(vmad(knuck, lat, 0.6), dir, 3.2 * snap) : vmad(vmad(th0, dir, 4.2), lat, 1.4 + open * 1.6);
  st([th0, thTip], [2.5, 2.0], cS, { dry: 0.15, h: 0.4, tip: 0.8, w0: 0.9 });
  if (snap > 0.05) {
    const mid = vmad(vmad(knuck, lat, -0.4), dir, 2.6 * snap);
    st([vmad(knuck, lat, -0.4), mid], [2.0, 1.7], cS, { dry: 0.15, h: 0.4, tip: 0.8 });
  }
}

// ---------------------------------------------------------------- microphone and cable
function drawMic(J) {
  const mf = micFrame(J, SIM.mic.d);
  G.slot = SLOT.mic;
  if (mf.lasso > 0.02) {
    const mid = vadd(vlerp(mf.grip, mf.tail, 0.5), V(0, -4 * mf.lasso, 0));
    st([mf.grip, mid, mf.tail], 1.7, [0.05, 0.05, 0.065], { c2: [0.32, 0.3, 0.38], dry: 0.1, h: 0.3, gloss: 0.8, w0: 1, tip: 1, tS: 0.01, tE: 0.01 });
  }
  const topH = vmad(mf.head, mf.d, -4.2);
  st([mf.tail, topH], [3.6, 5.0], shade(MAT.handle, toCam(mf.grip)), { dry: 0.08, h: 0.35, gloss: 1, w0: 0.95, tip: 1 });
  const p = vperp(mf.d, G.key.dir);
  st([vmad(mf.tail, p, 0.9), vmad(topH, p, 1.3)], 0.7, [0.55, 0.52, 0.56], { a: 0.7, dry: 0.3, noShadow: true, noId: true });
  const ang = screenAng(mf.tail, mf.head);
  dab(vmad(mf.head, mf.d, -3.8), 6, 2, MAT.chrome.s, { ang: ang + Math.PI / 2, dry: 0.1, gloss: 1 });
  dab(mf.head, 8.4, 7.6, shade(MAT.chrome, toCam(mf.head)), { ang, dry: 0.08, h: 0.6, gloss: 1 });
  const pp = vperp(mf.d, toCam(mf.head)), side = vnorm(vcross(mf.d, pp));
  for (const k of [-2, 0, 2]) {
    st([vmad(vmad(mf.head, mf.d, k), side, 3.6), vmad(vmad(mf.head, mf.d, k), pp, 3.9), vmad(vmad(mf.head, mf.d, k), side, -3.6)], 0.55,
      MAT.chrome.s, { a: 0.5, dry: 0.4, noShadow: true, noId: true });
  }
  dab(vmad(vmad(mf.head, side, vdot(side, G.key.dir) > 0 ? 1.8 : -1.8), mf.d, 1.6), 2.2, 2.2, MAT.chrome.l, { dry: 0.1, gloss: 1, noShadow: true, noId: true });
}
function cablePts(off, micOff) {
  return SIM.cable.map((i, k) => {
    let p = simGet(i);
    if (off) p = vadd(p, off);
    if (micOff) p = vmad(p, micOff, Math.max(0, 1 - k / 14));
    return p;
  });
}
function drawCable(pts) {
  G.slot = SLOT.mic;
  st(pts, 1.9, [0.05, 0.05, 0.065], { c2: [0.3, 0.29, 0.36], dry: 0.12, h: 0.3, gloss: 0.8, w0: 1, tip: 1, tS: 0.01, tE: 0.01 });
}

// motion smear behind a fast-moving hand or mic
function drawSmear(trail, col, w) {
  if (G.mode !== 'paint' || !trail || trail.length < 12) return;
  const n = trail.length;
  const speed = vdist(trail[n - 1], trail[n - 9]) / (8 * SIM.dt);
  const a = sstep(330, 600, speed) * 0.5;
  if (a < 0.03) return;
  const pts = [];
  for (let i = 0; i < n; i += 4) pts.push(trail[i]);
  if ((n - 1) % 4) pts.push(trail[n - 1]);
  st(pts, pts.map((_, i) => w * (0.12 + 0.88 * i / (pts.length - 1))), col, { a, dry: 0.7, w0: 0.3, tS: 0.3, tip: 0.85, tE: 0.05, h: 0.15, exact: true });
}

// ---------------------------------------------------------------- head, face and the quiff
function drawNeck(J) {
  G.slot = SLOT.skin;
  paintTube([xf(J.neck, J.Rc, 0, 2, 1), J.neckTop, xf(J.head, J.Rh, 0, -7, 0.5)], [5.2, 5, 4.8], MAT.skin, { k: 3, dry: 0.15, h: 0.35 });
  // the rolled turtleneck collar
  G.slot = SLOT.black;
  const c = xf(J.neck, J.Rc, 0, 4.5, 0.5);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const th = i / 12 * TAU;
    const p = xf(c, J.Rc, Math.cos(th) * 7.4, 0, Math.sin(th) * 7);
    if (vdot(vsub(p, c), toCam(c)) > -1.5) pts.push(p);
  }
  if (pts.length > 1) st(pts, 6.2, shade(MAT.knit, mapply(J.Rc, V(0, 0.3, 1))), { dry: 0.2, h: 0.35, w0: 0.95, tip: 0.95 });
  st([xf(c, J.Rc, -6, 2.4, 3.8), xf(c, J.Rc, 0, 2.2, 7.4), xf(c, J.Rc, 6, 2.4, 3.8)], 1.3, MAT.knit.l, { a: 0.5, dry: 0.5, noShadow: true });
}

function drawHead(J) {
  const H = J.head, R = J.Rh, P = J.pose;
  const hp = (x, y, z) => xf(H, R, x, y, z);
  const hn = (x, y, z) => mapply(R, vnorm(V(x, y, z)));
  const skin = (x, y, z, j) => shade(MAT.skin, hn(x, y, z), j);
  const fwd = vdot(mapply(R, V(0, 0, 1)), toCam(H));
  const fa = sat((fwd - 0.05) / 0.35);
  if (fwd < 0) { drawHairBack(J, true); }
  G.slot = SLOT.skin;
  // block in the skull and jaw in a darker skin so no gaps open between planes
  st([hp(0, 8.5, 1), hp(0, 1, 2), hp(0, -7, 3.5), hp(0, -10.4, 5)], [13.6, 14.8, 13, 7.6], skin(0.2, -0.1, 0.5, -0.2),
    { dry: 0.05, h: 0.3, w0: 0.9, tip: 0.8 });
  for (const sg of [-1, 1]) {
    if (vdot(hn(sg, 0, 0), toCam(H)) < -0.3) continue;
    st([hp(sg * 6.7, 5, 0.5), hp(sg * 7.2, 0, 0.3), hp(sg * 6.5, -5, 1)], [3.2, 3.6, 3], skin(sg, 0, 0.2, -0.12), { dry: 0.15, h: 0.35 });
    st([hp(sg * 7.4, 2.4, -0.8), hp(sg * 7.9, -0.3, -0.6), hp(sg * 7.2, -3.4, -0.2)], [2.0, 2.5, 1.8], skin(sg, 0, 0.3, -0.03), { dry: 0.2, h: 0.4 });
  }
  if (fwd >= 0) drawHairBack(J, false);
  if (fa > 0.01) drawFace(J, hp, hn, skin, fa);
  else {
    // seen from behind: the nape
    st([hp(-4.5, -6, -5.5), hp(0, -7.5, -6.5), hp(4.5, -6, -5.5)], 4, skin(0, -0.2, -1, -0.1), { dry: 0.2 });
  }
  drawQuiff(J, fwd);
}

function drawFace(J, hp, hn, skin, fa) {
  const P = J.pose;
  G.slot = SLOT.skin;
  // face mass, then light and shadow planes
  st([hp(0, 8.6, 7.6), hp(0, 3, 9.6), hp(0, -3, 9.8), hp(0, -8, 8.8), hp(0.1, -10.9, 7.2)], [12.2, 13.9, 13.2, 10.2, 5.6],
    [skin(0, 0.5, 1), skin(0, 0.1, 1), skin(0, -0.1, 1), skin(0, -0.4, 1, -0.04), skin(0, -0.8, 0.6, -0.08)],
    { dry: 0.08, h: 0.35, w0: 0.9, tip: 0.8, c2: [0.86, 0.5, 0.42], a: fa });
  st([hp(-3.7, 7.6, 8.2), hp(-4.7, 2, 8.6), hp(-4.4, -3.5, 8.4), hp(-3.1, -8, 7.8)], [4.4, 5, 4.6, 3.3],
    [skin(-0.7, 0.4, 0.7, 0.05), skin(-0.8, 0, 0.6, 0.05), skin(-0.8, -0.2, 0.6, 0.03), skin(-0.6, -0.5, 0.6)], { dry: 0.2, h: 0.4, a: fa });
  st([hp(5.6, 6.2, 6.4), hp(6.2, 1, 6.6), hp(5.7, -4.5, 6.0), hp(3.8, -8.8, 6.2)], [2.8, 3.2, 3.0, 2.3],
    [skin(0.9, 0.2, 0.3, -0.1), skin(1, 0, 0.3, -0.12), skin(0.9, -0.2, 0.3, -0.12), skin(0.6, -0.6, 0.4, -0.1)], { a: 0.7 * fa, dry: 0.3, h: 0.4 });
  st([hp(-3, 6.4, 9.2), hp(1.5, 6.8, 9.4)], 2.2, skin(-0.3, 0.6, 0.8, 0.08), { a: 0.7 * fa, dry: 0.4, noShadow: true });
  for (const sg of [-1, 1]) {
    dab(hp(sg * 4.4, -2.8, 8.4), 3.2, 3, [0.9, 0.46, 0.42], { kind: 1, a: 0.3 * fa, noShadow: true, noId: true });
    dab(hp(sg * 3.1, 1.6, 9.0), 3.4, 4, mix3(MAT.skin.s, MAT.skin.m, 0.45), { kind: 1, a: 0.45 * fa, ang: 0, noShadow: true, noId: true });
  }
  G.slot = SLOT.detail;
  // brows
  const br = P.brow * 0.9;
  for (const sg of [-1, 1]) st([hp(sg * 1.3, 3.4 + br * 0.6, 9.8), hp(sg * 3.4, 4.05 + br, 9.6), hp(sg * 5.6, 3.4 + br * 0.5, 8.6)],
    [1.1, 1.35, 0.9], [0.42, 0.18, 0.11], { dry: 0.25, noShadow: true, a: fa });
  // eyes: whites, iris following lookX, highlight; lids for the blink and the wink
  const wide = P.eyeWide || 0;
  for (const sg of [-1, 1]) {
    const shut = clamp(P.blink + (sg > 0 ? P.wink : 0), 0, 1);
    const ex = sg * 3.1, ey = 1.0;
    if (shut > 0.6) {
      st([hp(ex - 1.3, ey + 0.2, 9.4), hp(ex, ey - 0.35, 9.55), hp(ex + 1.3, ey + 0.15, 9.0)], 0.65, [0.22, 0.1, 0.1], { dry: 0.2, noShadow: true, a: fa });
      st([hp(ex - 1.1, ey + 0.8, 9.4), hp(ex + 1.2, ey + 0.7, 9.2)], 0.9, skin(0, 0.3, 1, -0.05), { a: 0.8 * fa, noShadow: true, noId: true });
    } else {
      const op = (1 - shut) * (1 + wide * 0.6);
      st([hp(ex - 1.35, ey, 9.35), hp(ex, ey + 0.15, 9.55), hp(ex + 1.35, ey - 0.05, 9.0)], 0.75 + 0.55 * op, [0.9, 0.86, 0.82],
        { dry: 0.1, w0: 0.7, tip: 0.6, noShadow: true, a: fa, exact: true });
      const ix = ex + P.lookX * 0.55, iy = ey + (P.lookY || 0) * 0.3;
      dab(hp(ix, iy, 9.6), 0.95 * (0.5 + 0.5 * op), 1.0, [0.2, 0.14, 0.13], { ang: 0, noShadow: true, a: fa });
      dab(hp(ix - 0.3, iy + 0.3, 9.75), 0.35, 0.35, [0.98, 0.95, 0.9], { a: 0.85 * op * fa, noShadow: true, noId: true, exact: true });
      st([hp(ex - 1.5, ey + 0.3 + wide * 0.3, 9.3), hp(ex, ey + 0.75 + op * 0.2 + wide * 0.35, 9.55), hp(ex + 1.5, ey + 0.2 + wide * 0.3, 9.0)],
        0.7, [0.16, 0.08, 0.08], { dry: 0.1, w0: 0.8, tip: 0.6, noShadow: true, a: fa });
    }
  }
  // nose
  G.slot = SLOT.skin;
  st([hp(0.9, 2.2, 10.2), hp(1.3, -1.5, 11.0), hp(1.0, -3.3, 11.1)], [1.0, 1.25, 1.1], mix3(MAT.skin.s, MAT.skin.m, 0.35), { a: 0.75 * fa, dry: 0.3, noShadow: true });
  dab(hp(-0.3, -2.6, 11.7), 1.6, 1.4, skin(-0.4, 0, 1, 0.08), { a: 0.8 * fa, noShadow: true });
  dab(hp(0.2, -4.1, 10.9), 1.0, 2.4, [0.55, 0.3, 0.3], { a: 0.75 * fa, ang: 0, noShadow: true });
  // mouth: open (singing), the grin, or a closed smile
  G.slot = SLOT.detail;
  const mo = P.mouth, sm = P.smile;
  if (mo > 0.15) {
    dab(hp(0, -6.9 - mo * 0.5, 9.7), 1.0 + mo * 2.0, 2.4 + mo * 0.8, [0.2, 0.06, 0.08], { ang: 0, dry: 0.05, noShadow: true, a: fa });
    st([hp(-2.4, -5.9, 9.1), hp(0, -5.8, 10.0), hp(2.4, -5.9, 9.1)], 0.8, [0.72, 0.34, 0.32], { dry: 0.2, noShadow: true, a: fa });
    st([hp(-2.0, -7.5 - mo * 1.0, 9.2), hp(0, -8.0 - mo * 1.1, 9.7), hp(2.0, -7.5 - mo * 1.0, 9.2)], 1.0, [0.8, 0.44, 0.4], { dry: 0.2, noShadow: true, a: fa });
  } else if (sm > 0.8) {
    const k = (sm - 0.8) / 0.2;
    st([hp(-3.0, -5.7 + sm * 0.5, 8.9), hp(0, -6.35, 10.0), hp(3.0, -5.7 + sm * 0.5, 8.9)], 0.75, [0.42, 0.14, 0.15], { dry: 0.15, noShadow: true, a: fa });
    st([hp(-2.3, -6.1 + sm * 0.25, 9.3), hp(0, -6.75, 10.0), hp(2.3, -6.1 + sm * 0.25, 9.3)], 0.55 + 0.35 * k, [0.95, 0.91, 0.85],
      { dry: 0.2, noShadow: true, exact: true, a: fa, noId: true });
    st([hp(-1.6, -7.7, 9.5), hp(1.6, -7.7, 9.5)], 1.0, [0.82, 0.48, 0.44], { a: 0.7 * fa, dry: 0.3, noShadow: true });
  } else {
    st([hp(-2.8, -6.0 + sm * 0.7, 9.0), hp(0, -6.5, 10.0), hp(2.8, -6.0 + sm * 0.7, 9.0)], 0.8, [0.45, 0.15, 0.16], { dry: 0.15, noShadow: true, a: fa });
    st([hp(-1.5, -7.3, 9.5), hp(1.5, -7.3, 9.5)], 1.1, [0.82, 0.48, 0.44], { a: 0.75 * fa, dry: 0.3, noShadow: true });
  }
  G.slot = SLOT.skin;
  dab(hp(-0.5, -9.6, 8.3), 2, 2.4, skin(-0.3, -0.5, 0.9, 0.06), { a: 0.5 * fa, noShadow: true });
}

function hairOffset(J) {
  let off = mapplyT(J.Rh, SIM.hair ? SIM.hair.off : V(0, 0, 0));
  return V(clamp(off.x * 1.6, -6, 6), clamp(off.y * 1.6, -6, 6), clamp(off.z * 1.6, -6, 6));
}
// the cap of hair over the crown, sides and back (painted before the face when he faces us)
function drawHairBack(J, fromBehind) {
  const H = J.head, R = J.Rh;
  const hp = (x, y, z) => xf(H, R, x, y, z);
  const hair = (x, y, z, j) => shade(MAT.hair, mapply(R, vnorm(V(x, y, z))), j);
  G.slot = SLOT.hair;
  const dark = mix3(MAT.hair.s, MAT.hair.m, 0.5);
  st([hp(0, 11.5, 2), hp(0, 9, -5), hp(0, 2, -8.2), hp(0, -5.5, -7)], [13, 14.5, 13.5, 10], hair(0, 0.2, -1, -0.12),
    { dry: 0.15, h: 0.45, w0: 0.9, tip: 0.8 });
  for (const sg of [-1, 1]) {
    st([hp(sg * 6.6, 8.6, 4.8), hp(sg * 7.8, 6.4, -1.5), hp(sg * 7.2, 2.5, -6.5)], [4, 3.8, 3], hair(sg, 0.3, -0.2, -0.08), { dry: 0.3, h: 0.5 });
    st([hp(sg * 7.2, 4.5, 3), hp(sg * 7.5, 0.8, 2.2)], [1.8, 1.2], MAT.hair.s, { dry: 0.3, noShadow: true });
  }
  if (fromBehind) {
    for (let i = 0; i < 7; i++) {
      const x = -6 + i * 2;
      st([hp(x * 0.8, 13, -1), hp(x, 9.5, -6.5), hp(x * 0.85, 2, -8.4), hp(x * 0.7, -4.5, -7.2)], 2.6,
        [hair(x * 0.1, 1, -0.4, 0.05), hair(x * 0.1, 0.5, -1), hair(x * 0.1, 0, -1, -0.05), hair(x * 0.1, -0.4, -1, -0.12)], { dry: 0.35, h: 0.55, tip: 0.5 });
    }
  }
  st([hp(-5, 12.6, -2), hp(0, 13.2, -3), hp(5, 12.6, -2)], 5, dark, { a: 0.6, dry: 0.3, noShadow: true });
}
// the quiff: strands rise from the hairline, roll over a tall crest and sweep back
function drawQuiff(J, fwd) {
  const H = J.head, R = J.Rh;
  const off = hairOffset(J);
  const hp = (x, y, z, k) => xf(H, R, x + off.x * k, y + off.y * k, z + off.z * k);
  const hn = (x, y, z) => mapply(R, vnorm(V(x, y, z)));
  const hair = (x, y, z, j) => shade(MAT.hair, hn(x, y, z), j);
  const crest = x => 20.5 - 0.11 * x * x;
  G.slot = SLOT.hair;
  const dark = mix3(MAT.hair.s, MAT.hair.m, 0.55);
  // the mound seen from the front, its fill, and the mass sweeping back over the crown
  st([hp(-7.4, 6, 5.4, 0), hp(-7.0, 12, 7.4, 0.4), hp(-4.2, 18.4, 8.4, 0.9), hp(0, 20.2, 8.6, 1), hp(4.2, 18.4, 8.4, 0.9), hp(7.0, 12, 7.4, 0.4), hp(7.4, 6, 5.4, 0)],
    8, dark, { dry: 0.2, h: 0.4, w0: 0.9, tip: 0.9 });
  st([hp(-5.8, 11, 9.4, 0.3), hp(0, 13, 10.6, 0.4), hp(5.8, 11, 9.4, 0.3)], 7, dark, { dry: 0.05, h: 0.4, w0: 0.9, tip: 0.9 });
  st([hp(-4.6, 18, 3, 0.8), hp(0, 19.6, -1, 0.7), hp(4.6, 18, 3, 0.8)], 9, dark, { dry: 0.1, h: 0.4 });
  st([hp(-4.4, 15.5, -3.5, 0.5), hp(0, 14.5, -6.5, 0.4), hp(4.4, 15.5, -3.5, 0.5)], 8, dark, { dry: 0.1, h: 0.4 });
  const sw = -3.0;
  for (let i = 0; i < 10; i++) {
    const x0 = -6.4 + i * 1.42, q = x0 * x0;
    const r1 = hash(i * 7.3), r2 = hash(i * 3.1 + 1);
    const xe = clamp(x0 + sw * 0.8, -7, 7);
    const pk = crest(xe) + 0.5 * (r1 - 0.5);
    const pts = [hp(x0, 7.3 + r2 * 0.6, 8.6 - 0.07 * q, 0), hp(x0 + sw * 0.25, 12.8, 11.3 - 0.06 * q, 0.35),
      hp(lerp(x0, xe, 0.7), pk - 1.3, 10.5 - 0.05 * q, 0.8), hp(xe, pk, 7.4 - 0.03 * q, 1),
      hp(xe * 0.9, pk - 1.8, 0.8 - 0.02 * q, 0.9), hp(xe * 0.8, pk - 5.6, -5, 0.6)];
    const j = (r1 - 0.5) * 0.18;
    const cols = [hair(x0 * 0.06, -0.2, 1, j - 0.18), hair(x0 * 0.08, 0.1, 1, j - 0.05), hair(xe * 0.08, 0.6, 0.8, j + 0.05),
      hair(xe * 0.06, 1, 0.3, j + 0.08), hair(xe * 0.06, 1, -0.3, j), hair(xe * 0.06, 0.4, -1, j - 0.05)];
    const w = 0.8 + r2 * 0.45;
    const ws = [2.4 * w, 3.8 * w, 4.0 * w, 3.1 * w, 2.6 * w, 2.0 * w];
    const front = fwd >= -0.2;
    st(front ? pts : pts.slice().reverse(), front ? ws : ws.slice().reverse(), front ? cols : cols.slice().reverse(),
      { dry: 0.3, h: 0.65, gloss: 0.45, tip: 0.5, c2: mix3(cols[2], [0.75, 0.3, 0.12], 0.4) });
  }
  // light catching the roll of the crest, and a few loose highlight strands
  st([hp(-6, crest(-6) - 1.8, 6.8, 0.8), hp(-3.2, crest(-3.2) - 0.3, 8.4, 0.95), hp(0, crest(0), 8.6, 1), hp(3.2, crest(3.2) - 0.4, 8.0, 0.95), hp(5.8, crest(5.8) - 1.9, 6.4, 0.8)],
    [1.2, 1.9, 2.1, 1.7, 1.0], [MAT.hair.l, MAT.hair.l, mix3(MAT.hair.m, MAT.hair.l, 0.75), mix3(MAT.hair.m, MAT.hair.l, 0.5), MAT.hair.m],
    { a: 0.95, dry: 0.45, h: 0.6, gloss: 0.7, noShadow: true, noId: true });
  for (let i = 0; i < 4; i++) {
    const x = -3.8 + i * 2.4, xe = clamp(x + sw * 0.85, -6.5, 6.5);
    st([hp(x, 11.5, 11.2, 0.3), hp(lerp(x, xe, 0.6), crest(xe) - 1.4, 10.2, 0.8), hp(xe, crest(xe) - 0.2, 6.8, 1)], 0.9,
      x < 0 ? MAT.hair.l : mix3(MAT.hair.m, MAT.hair.l, 0.45), { a: 0.8, dry: 0.5, h: 0.55, gloss: 0.6, noShadow: true, noId: true });
  }
  for (const x of [-4.5, -1.2, 2.3, 5.2]) st([hp(x, 7.2, 8.9 - 0.06 * x * x, 0), hp(x - 0.6, 9.6, 9.9 - 0.06 * x * x, 0.2)], 0.9, MAT.hair.s,
    { a: 0.55, dry: 0.4, noShadow: true, noId: true });
}

// ---------------------------------------------------------------- the whole figure
// Parts are depth-sorted: whatever is clearly behind the torso first, then the legs
// and skirt, the torso and head, then arms, cable and mic in front.
function drawFigure(J, opts) {
  opts = opts || {};
  const chestD = camDepth(J.chest);
  const items = [];
  for (const sg of skirtSegs()) {
    const c = vlerp(vlerp(sg.a0, sg.a1, 0.5), vlerp(sg.h0, sg.h1, 0.5), 0.45);
    items.push({ d: camDepth(c), kind: 'low', f: () => drawSkirtSeg(sg) });
  }
  for (const s of ['L', 'R']) items.push({ d: camDepth(vlerp(J['hip' + s], J['kn' + s], 0.8)), kind: 'low', f: () => drawLeg(J, s) });
  for (const w of ['M', 'F']) {
    const el = w === 'M' ? J.elM : J.elF, wr = w === 'M' ? J.wrM : J.wrF;
    items.push({ d: camDepth(vlerp(el, wr, 0.5)) - 3, kind: 'arm', f: () => { drawArm(J, w); if (w === 'M') drawMic(J); } });
  }
  if (!opts.noCable) {
    const cp = cablePts();
    for (let k = 0; k < cp.length - 1; k += 6) {
      const seg = cp.slice(k, Math.min(cp.length, k + 7));
      items.push({ d: camDepth(seg[seg.length >> 1]), kind: 'arm', f: () => drawCable(seg) });
    }
  }
  items.sort((a, b) => b.d - a.d);
  const behind = items.filter(i => i.d > chestD + 7);
  const rest = items.filter(i => i.d <= chestD + 7);
  const turned = facing(J, J.Rc, G.cam) < 0;
  for (const i of behind) i.f();
  for (const i of rest) if (i.kind === 'low') i.f();
  drawTorso(J);
  if (turned) { for (const i of rest) if (i.kind === 'arm') i.f(); drawNeck(J); drawHead(J); }
  else { drawNeck(J); drawHead(J); for (const i of rest) if (i.kind === 'arm') i.f(); }
  drawSmear(SIM.trails.mic, [0.86, 0.87, 0.95], 9);
  drawSmear(SIM.trails.free, shade(MAT.skin, toCam(J.wrF)), 8);
}

// ---------------------------------------------------------------- silhouette (shadow masks)
// A flat, simplified figure. `rigid` draws a stiff skirt from the pose instead of the
// simulated one (for the shadow that dances its own routine).
function drawSilhouette(J, opts) {
  opts = opts || {};
  const flat = { sq: 0.6 };
  for (const s of ['L', 'R']) {
    const hip = J['hip' + s], an = J['an' + s], ft = J['foot' + s];
    st([vadd(hip, V(0, 7, 0)), hip, J['kn' + s], an, vadd(vlerp(an, ft.ball, 0.4), V(0, -0.6, 1.5))], [18, 17, 14, 12.5, 12.5], null, flat);
    st([vadd(an, V(0, -1.5, 0.5)), vadd(ft.ball, V(0, 2, 0)), ft.toe], [9, 10.5, 9], null);
  }
  if (opts.rigid) {
    for (const x of [-16, 0, 16]) {
      st([xf(J.pelvis, J.Rp, x, SKIRT_Y, 0), xf(J.pelvis, J.Rp, x * 1.35, -20, 0), xf(J.pelvis, J.Rp, x * 1.6, -53, 0)], [16, 18, 20], null, flat);
    }
  } else {
    const off = opts.off;
    const segs = skirtSegs(off);
    for (let k = 0; k < segs.length; k += 2) {
      const sg = segs[k];
      st([vlerp(sg.a0, sg.a1, 0.5), vlerp(sg.m0, sg.m1, 0.5), vlerp(sg.h0, sg.h1, 0.5)], [vdist(sg.a0, sg.a1) * 2.4 + 4, vdist(sg.m0, sg.m1) * 2.4 + 4, vdist(sg.h0, sg.h1) * 2.4 + 4], null, flat);
    }
  }
  st([J.pelvis, J.waist, J.chest], 34, null, flat);
  st([xf(J.shM, J.Rc, -3, 1, 0), J.neck, xf(J.shF, J.Rc, 3, 1, 0)], 15, null);
  st([J.chest, J.neck, J.neckTop, J.head], [22, 13, 11, 13], null);
  for (const M of [true, false]) {
    const sh = M ? J.shM : J.shF, el = M ? J.elM : J.elF, wr = M ? J.wrM : J.wrF;
    st([sh, el, wr], [15, 13.5, 12], null);
    const fo = vnorm(vsub(wr, el));
    dab(vmad(wr, fo, 5), 9, 9, null, { ang: screenAng(wr, vmad(wr, fo, 8)) });
  }
  const H = J.head, R = J.Rh;
  st([xf(H, R, 0, -11, 5), xf(H, R, 0, -2, 7), xf(H, R, 0, 8, 6), xf(H, R, -0.5, 18.5, 5)], [11, 15.5, 16, 13.5], null);
  if (!opts.rigid) {
    const mf = micFrame(J, SIM.mic.d);
    st([mf.tail, mf.head], [4, 5.4], null);
    dab(mf.head, 8.6, 7.6, null);
    for (let s = 0; s < 2; s++) st(SIM.belts[s].map(i => opts.off ? vadd(simGet(i), opts.off) : simGet(i)), 4, null);
    st(cablePts(opts.off, opts.micOff), 1.8, null);
  } else {
    const fo = vnorm(vsub(J.wrM, J.elM));
    st([vmad(J.wrM, fo, -4), vmad(vmad(J.wrM, fo, 7), mapply(J.Rc, V(0, 1, 0.3)), 12)], [4, 5.4], null);
  }
  if (J.pose.hat > 0.5) drawTopHat(J);
}
// the shadow's top hat: on its head, or lifted in its free hand to tip it
function drawTopHat(J) {
  const P = J.pose;
  const onHead = { c: xf(J.head, J.Rh, 0, 12.5, 0), R: J.Rh };
  const fo = vnorm(vsub(J.wrF, J.elF));
  const inHand = { c: vmad(J.wrF, fo, 7), R: mmul(J.Rh, rotYXZ(0, 0.5, 0)) };
  const t = sstep(0.1, 0.5, P.hatLift);
  const c = vlerp(onHead.c, inHand.c, t);
  const R = t < 0.5 ? onHead.R : inHand.R;
  const up = mapply(R, V(0, 1, 0)), side = mapply(R, V(1, 0, 0));
  st([vmad(c, side, -17), vmad(c, side, 17)], 4, null, { sq: 0.9 });
  st([vmad(c, up, 1), vmad(c, up, 24)], [22, 20], null, { sq: 0.95, w0: 1, tip: 1 });
}
