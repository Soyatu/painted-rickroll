// ============================================================
// The dancer, painted stroke by stroke from the posed skeleton
// ============================================================
const MAT = {
  coat:   { s: [0.34, 0.23, 0.25], m: [0.72, 0.52, 0.31], l: [0.98, 0.79, 0.51], c: [0.64, 0.56, 0.78], d: [0.23, 0.14, 0.14], h: [1.0, 0.93, 0.72] },
  lining: { s: [0.13, 0.08, 0.10], m: [0.33, 0.21, 0.17], l: [0.58, 0.38, 0.25], c: [0.33, 0.28, 0.54] },
  blk:    { s: [0.03, 0.03, 0.05], m: [0.075, 0.07, 0.1], l: [0.2, 0.14, 0.13], c: [0.2, 0.19, 0.42] },
  skin:   { s: [0.5, 0.27, 0.27], m: [0.83, 0.53, 0.41], l: [0.96, 0.69, 0.53], c: [0.74, 0.55, 0.6] },
  hair:   { s: [0.31, 0.11, 0.07], m: [0.64, 0.27, 0.11], l: [0.97, 0.61, 0.29], c: [0.58, 0.32, 0.46] },
  chrome: { s: [0.1, 0.1, 0.13], m: [0.36, 0.37, 0.42], l: [0.74, 0.74, 0.78], c: [0.45, 0.42, 0.75] },
  shoe:   { s: [0.03, 0.02, 0.03], m: [0.09, 0.065, 0.06], l: [0.26, 0.19, 0.17], c: [0.22, 0.21, 0.42] }
};
// material ids for the pop-art prints
const ID = { coat: 1, lining: 2, blk: 3, skin: 4, hair: 5, mic: 6, ink: 7, lips: 8, white: 9 };

function shade(mat, n, jit) {
  const dw = vdot(n, G.wDir), dc = vdot(n, G.cDir);
  const lw = clamp(smoothstep(-0.45, 0.8, dw) * G.wI, 0, 1.25);
  const lc = smoothstep(0.0, 0.85, dc) * G.cI;
  if (G.pop) { const v = clamp(0.2 + 0.62 * smoothstep(0, 1.1, lw) + 0.18 * lc, 0, 1); return [v, v, v]; }
  let c = mixc(mat.s, mat.m, smoothstep(0.0, 0.5, lw));
  c = mixc(c, mat.l, smoothstep(0.5, 1.15, lw));
  c = mixc(c, mat.c, clamp(lc * 0.45 * (1 - 0.6 * smoothstep(0.4, 1.0, lw)), 0, 1));
  if (G.tint) c = [c[0] * G.tint[0], c[1] * G.tint[1], c[2] * G.tint[2]];
  if (jit) c = scalec(c, 1 + jit);
  return c;
}
const rowAt = (r, f) => {
  if (r.length === 3) return f < 0.5 ? vlerp(r[0], r[1], f * 2) : vlerp(r[1], r[2], (f - 0.5) * 2);
  const k = clamp(f, 0, 1) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(k));
  return vlerp(r[i], r[i + 1], k - i);
};
const gridAt = (rows, r, f) => {
  const i = Math.min(rows.length - 2, Math.floor(r));
  return vlerp(rowAt(rows[i], f), rowAt(rows[i + 1], f), r - i);
};
function screenAng(p, q) {
  const a = G.proj(p), b = G.proj(q);
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function perpToward(dir, toward) {
  let p = vcross(dir, V(0, 0, 1));
  if (vlen(p) < 1e-4) p = V(1, 0, 0);
  p = vnorm(p);
  return vdot(p, toward) < 0 ? vmul(p, -1) : p;
}

function coatGrid(J, off) {
  const Rc = J.Rc;
  const out = {};
  const g = i => off ? vadd(simGet(i), off) : simGet(i);
  for (const sg of [-1, 1]) {
    const cols = SIM.cols.slice(sg < 0 ? 0 : 3, sg < 0 ? 3 : 6);
    const sh = sg < 0 ? J.shM : J.shF;
    out[sg < 0 ? 'L' : 'R'] = [
      [xf(J.neck, Rc, sg * 6.5, 1, 5.5), xf(J.neck, Rc, sg * 14, 0.5, 3), xf(sh, Rc, sg * 7, 1.5, 0)],
      [xf(J.chest, Rc, sg * 8.5, 2, 12.5), xf(J.chest, Rc, sg * 15.5, 1, 10.5), xf(J.chest, Rc, sg * 22.5, 0, 1.5)],
      cols.map(c => g(c.a)),
      cols.map(c => g(c.m)),
      cols.map(c => g(c.h))
    ];
  }
  const back = SIM.cols.slice(6, 10);
  out.B = [back.map(c => g(c.a)), back.map(c => g(c.m)), back.map(c => g(c.h))];
  return out;
}

// ---------------------------------------------------------------- parts
function drawBackPanel(C) {
  G.mid = ID.lining;
  const rows = C.B;
  const fs = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
  for (let k = 0; k < fs.length; k++) {
    const f = fs[k];
    const pts = [rowAt(rows[0], f), rowAt(rows[1], f), rowAt(rows[2], f)];
    const n = vnorm(V((f - 0.5) * 1.2, -0.1, 1));
    st(pts, [10, 10.5, 11], shade(MAT.lining, n, (hash(k * 5.3) - 0.5) * 0.1), { dry: 0.35, h: 0.35, tip: 0.55 });
  }
  st(rows[2], 2.4, MAT.coat.d, { dry: 0.3, a: 0.9 });
}

function drawLegs(J) {
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? -1 : 1;
    const hip = J['hip' + s], kn = J['kn' + s], an = J['an' + s], ft = J['foot' + s];
    const top = vadd(hip, V(0, 7, 0));
    const hem = vadd(vlerp(an, ft.ball, 0.4), V(0, -0.6, 1.5));
    // shoe: instep down to a rounded toe, under the trouser hem
    G.mid = ID.mic;
    const shoe = shade(MAT.shoe, vnorm(V(sg * 0.2, 0.6, 0.8)));
    st([vadd(an, V(0, -1.5, 0.5)), vadd(ft.ball, V(0, 2.6, 0.5)), vadd(ft.toe, V(0, 1.7, 0))], [8.6, 10.2, 9.4], shoe, { dry: 0.1, h: 0.45, gloss: 0.9, w0: 0.95, tip: 0.9, tE: 0.2 });
    st([vadd(ft.heel, V(-sg * 1, 1.2, 0)), vadd(ft.ball, V(0, 0.4, 0)), vadd(ft.toe, V(0, 0.6, 0.6))], [8.8, 10.4, 9.2], MAT.shoe.s, { a: 0.9, dry: 0.15, h: 0.3, w0: 0.95, tip: 0.9 });
    dab(vadd(ft.toe, V(-1.6, 3.1, -0.6)), 1.5, 2.6, [0.44, 0.38, 0.4], { dry: 0.3, gloss: 1, a: 0.65, noShadow: true });
    // trouser leg down to the hem
    G.mid = ID.blk;
    st([top, hip, kn, an, hem], [17.5, 17, 13.5, 12, 12.6], shade(MAT.blk, vnorm(V(sg * 0.3, 0, 1))), { dry: 0.26, h: 0.32, tip: 0.95, tE: 0.12, sq: 0.6 });
    const lit = vnorm(V(-1, 0.2, 0.5)), cool = vnorm(V(1, 0.2, 0.5));
    st([vadd(kn, V(-4.8, 1, 2)), vadd(an, V(-4, 1, 2)), vadd(hem, V(-4.4, 1, 0))], 3.2, shade(MAT.blk, lit), { a: 0.85, dry: 0.5, h: 0.3 });
    st([vadd(kn, V(4.8, 1, 2)), vadd(an, V(4, 1, 2)), vadd(hem, V(4.4, 1, 0))], 2.4, shade(MAT.blk, cool), { a: 0.8, dry: 0.55, h: 0.3 });
    st([vadd(kn, V(-3, 3, 5)), vadd(kn, V(0.5, -1, 6)), vadd(kn, V(3, 2, 5))], 1.2, MAT.blk.s, { a: 0.7, dry: 0.4 });
    st([vadd(hem, V(-5.6, 1.4, -1)), vadd(hem, V(0, 0.4, 1.5)), vadd(hem, V(5.6, 1.4, -1))], 1.8, MAT.blk.s, { a: 0.75, dry: 0.3, noShadow: true });
  }
}

function drawBelts(J) {
  G.mid = ID.coat;
  for (let s = 0; s < 2; s++) {
    const sg = s === 0 ? -1 : 1;
    const pts = SIM.belts[s].map(simGet);
    st(pts, [3.8, 3.6, 3.5, 3.4, 3.2], shade(MAT.coat, vnorm(V(sg * 0.5, 0, 0.9)), -0.25), { dry: 0.25, h: 0.45, tip: 0.9, w0: 0.9 });
    st(pts.slice(1), 0.9, MAT.coat.d, { a: 0.7, dry: 0.4, noShadow: true });
    const end = pts[pts.length - 1];
    dab(end, 3.2, 3.6, [0.28, 0.2, 0.12], { dry: 0.2, gloss: 0.8, ang: Math.PI / 2 });
  }
}

function drawTorso(J) {
  const Rc = J.Rc, Rw = J.Rw;
  const back = mv(Rc, V(0, 0.2, 1));
  G.mid = ID.coat;
  st([xf(J.neck, Rc, -8, 4, -1.5), xf(J.neck, Rc, 0, 6.5, -4.5), xf(J.neck, Rc, 8, 4, -1.5)], 3.6, shade(MAT.coat, back, -0.25), { dry: 0.3 });
  G.mid = ID.blk;
  for (const x of [-5.5, 0, 5.5]) {
    const pts = [xf(J.neck, Rc, x * 0.7, 2, 5.5), xf(J.chest, Rc, x, 0, 11.5), xf(J.waist, Rw, x * 1.05, 0, 10), xf(J.pelvis, J.Rp, x * 1.1, -6, 9)];
    st(pts, 8, shade(MAT.blk, mv(Rc, vnorm(V(x / 10, 0.15, 1)))), { dry: 0.32, h: 0.3 });
  }
  st([xf(J.chest, Rc, -3, 8, 11), xf(J.chest, Rc, -4.5, -6, 12)], 2, shade(MAT.blk, mv(Rc, vnorm(V(-0.6, 0.4, 0.8)))), { a: 0.7, dry: 0.55 });
  // neck skin, then the tall black turtleneck collar
  G.mid = ID.skin;
  st([xf(J.neckTop, J.Rh, 0, 2.5, 1.5), xf(J.neck, Rc, 0, 4, 3)], 9.4, shade(MAT.skin, mv(J.Rh, V(0, -0.5, 0.8))), { tip: 0.9, w0: 0.9, dry: 0.15 });
  G.mid = ID.blk;
  st([xf(J.neck, Rc, -6.2, 4.5, 1.5), xf(J.neck, Rc, 0, 3.8, 6.2), xf(J.neck, Rc, 6.2, 4.5, 1.5)], 6.4, shade(MAT.blk, mv(Rc, V(0, 0.3, 1))), { dry: 0.2, h: 0.35 });
  st([xf(J.neck, Rc, -5.5, 6.8, 2.2), xf(J.neck, Rc, 0, 6.3, 6.3), xf(J.neck, Rc, 5.5, 6.8, 2.2)], 1.4, MAT.blk.l, { a: 0.55, dry: 0.5, noShadow: true });
}

function drawFrontPanels(J, C) {
  G.mid = ID.coat;
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? -1 : 1;
    const rows = C[side];
    const wr = r => Math.max(5, Math.abs(rowAt(r, 0).x - rowAt(r, 1).x) + 1.5);
    const nMid = mv(J.Rc, vnorm(V(sg * 0.5, 0.1, 1)));
    // flat underpainting so no ground shows through the panel
    const base = shade(MAT.coat, nMid, -0.12);
    st([rowAt(rows[0], 0.5), rowAt(rows[1], 0.5), gridAt(rows, 2.3, 0.5)], [wr(rows[0]), wr(rows[1]), wr(rows[2])], base, { dry: 0.05, h: 0.25, w0: 0.95, tip: 0.95, tS: 0.05, tE: 0.08 });
    const wr3 = r => Math.max(5, vlen(vsub(rowAt(r, 0), rowAt(r, 1))) * 0.85);
    st([gridAt(rows, 1.8, 0.5), rowAt(rows[3], 0.5), rowAt(rows[4], 0.5)], [wr(rows[2]), wr3(rows[3]), wr3(rows[4])], base, { dry: 0.05, h: 0.25, w0: 0.95, tip: 0.95, tS: 0.05, tE: 0.08 });
    const fs = [0.08, 0.3, 0.52, 0.74, 0.93];
    for (let k = 0; k < fs.length; k++) {
      const f = fs[k];
      const n = mv(J.Rc, vnorm(V(sg * f * 1.15, 0.15, 1.0 - 0.5 * f)));
      st([rowAt(rows[0], f), rowAt(rows[1], f), gridAt(rows, 2.25, f)], [8, 9, 9.5],
        shade(MAT.coat, n, (hash(k * 3.1 + sg) - 0.5) * 0.08), { dry: 0.14, h: 0.45 });
    }
    const fl = [0.04, 0.2, 0.36, 0.52, 0.68, 0.84, 0.97];
    const w3 = Math.max(9, wr3(rows[3]) / 4.2), w4 = Math.max(9.5, wr3(rows[4]) / 4.2);
    for (let k = 0; k < fl.length; k++) {
      const f = fl[k];
      const a = rowAt(rows[3], Math.max(0, f - 0.12)), b = rowAt(rows[3], Math.min(1, f + 0.12));
      const vt = vsub(rowAt(rows[4], f), rowAt(rows[2], f));
      let n = vnorm(vcross(vsub(b, a), vt));
      if (sg > 0) n = vmul(n, -1);
      const c0 = shade(MAT.coat, n, (hash(k * 7.7 + sg * 3) - 0.5) * 0.1);
      const c1 = shade(MAT.coat, vnorm(vadd(n, V(0, -0.35, 0))), -0.08);
      st([gridAt(rows, 1.85, f), rowAt(rows[3], f), rowAt(rows[4], f)], [9.5, w3, w4], [c0, c0, c1], { dry: 0.15, h: 0.45, tip: 0.75 });
    }
    // strokes that follow the form: diagonals running down from the shoulder with the lapel,
    // and a few cross-contour strokes round the swing of the skirt
    for (let k = 0; k < 3; k++) {
      const f0 = 0.55 + k * 0.17, f1 = 0.12 + k * 0.14;
      const n = mv(J.Rc, vnorm(V(sg * (0.35 + 0.25 * k), 0.25, 0.9)));
      st([gridAt(rows, 0.35, f0), gridAt(rows, 1.1, lerp(f0, f1, 0.55)), gridAt(rows, 1.9, f1)], [5.5, 6.5, 5], shade(MAT.coat, n, 0.04 - 0.05 * k), { a: 0.7, dry: 0.3, h: 0.5, tip: 0.4, noShadow: true });
    }
    for (const r of [2.6, 3.25]) {
      const n = mv(J.Rc, vnorm(V(sg * 0.4, -0.3, 0.9)));
      st([gridAt(rows, r, 0.05), gridAt(rows, r + 0.06, 0.45), gridAt(rows, r - 0.02, 0.9)], 3.2, shade(MAT.coat, n, -0.06), { a: 0.45, dry: 0.45, h: 0.4, noShadow: true });
    }
    // belt band across the waist
    const bY = V(0, 1.5, 0.6);
    st([vadd(rowAt(rows[2], 0), bY), vadd(rowAt(rows[2], 0.5), bY), vadd(rowAt(rows[2], 1), bY)], 4.6, shade(MAT.coat, nMid, -0.18), { dry: 0.15, h: 0.5, w0: 0.9, tip: 0.9, noShadow: true });
    st([vadd(rowAt(rows[2], 0), V(0, -0.8, 1)), vadd(rowAt(rows[2], 0.5), V(0, -0.8, 1)), vadd(rowAt(rows[2], 1), V(0, -0.8, 0.6))], 0.8, MAT.coat.d, { a: 0.7, dry: 0.3, noShadow: true });
    // folds swinging with the skirt
    for (const f of [0.2, 0.63]) {
      st([gridAt(rows, 2.25, f), gridAt(rows, 3, f + 0.03 * sg), gridAt(rows, 3.95, f - 0.02)], [0.8, 2.2, 1.5], MAT.coat.d, { a: 0.75, dry: 0.5, w0: 0.3, tip: 0.5, noShadow: true });
      st([gridAt(rows, 2.35, f + 0.07), gridAt(rows, 3.1, f + 0.1), gridAt(rows, 3.9, f + 0.08)], [0.6, 1.4, 1.0], shade(MAT.coat, V(-0.7, 0.4, 0.6)), { a: 0.6, dry: 0.55, w0: 0.3, tip: 0.5, noShadow: true });
    }
    // outer contour: shadowed side, lit side
    const ctr = [rowAt(rows[0], 1), rowAt(rows[1], 1), rowAt(rows[2], 1), rowAt(rows[3], 1), rowAt(rows[4], 1)];
    st(ctr.slice(1), [2.6, 3, 3, 2.4], sg > 0 ? shade(MAT.coat, V(0.8, 0, -0.2), -0.25) : shade(MAT.coat, V(-0.9, 0.3, 0.3), 0.06), { a: 0.85, dry: 0.45, noShadow: true });
    st(ctr.slice(1).map(p => vadd(p, V(sg * 1.4, 0, 0))), 1.1, rimCol(sg), { a: 0.55, dry: 0.55, noShadow: true, exact: true });
    // front opening edge and hem
    st([rowAt(rows[1], 0), rowAt(rows[2], 0), rowAt(rows[3], 0), rowAt(rows[4], 0)], [1.6, 2, 2, 1.8], shade(MAT.coat, V(-0.5, 0.6, 0.7), 0.1), { a: 0.9, dry: 0.3, noShadow: true });
    st(rows[4], 2.8, MAT.coat.d, { dry: 0.3, a: 0.95 });
    // slanted pocket welt and two buttons
    st([gridAt(rows, 2.25, 0.42), gridAt(rows, 2.55, 0.8)], 1.3, MAT.coat.d, { a: 0.85, dry: 0.3, noShadow: true });
    for (const r of [1.3, 1.7]) {
      dab(gridAt(rows, r, 0.3), 1.9, 1.9, [0.17, 0.11, 0.09], { dry: 0.1, gloss: 0.7, noShadow: true });
    }
  }
  // rim light catching the shoulder line (warm key on the left, cool on the right)
  for (const sg of [-1, 1]) {
    const sh = sg < 0 ? J.shM : J.shF;
    st([xf(J.neck, J.Rc, sg * 9, 3.2, 0), xf(sh, J.Rc, sg * 3, 3.6, -0.5), xf(sh, J.Rc, sg * 7.2, 0.5, -1)], 1.2, rimCol(sg), { a: 0.75, dry: 0.45, noShadow: true, exact: true });
  }
  // epaulettes / padded shoulders
  for (const sg of [-1, 1]) {
    const sh = sg < 0 ? J.shM : J.shF;
    st([xf(J.neck, J.Rc, sg * 8, 1.5, 1), xf(sh, J.Rc, sg * 3.5, 2.5, 0.5)], 3.2, shade(MAT.coat, mv(J.Rc, V(sg * 0.3, 1, 0.5)), 0.05), { dry: 0.3, h: 0.5, noShadow: true });
  }
}
// rim-light colours follow the scene's two lights
function rimCol(sg) {
  if (G.pop) return [0.95, 0.95, 0.95];
  return sg < 0 ? (G.rimW || [1.0, 0.86, 0.6]) : (G.rimC || [0.7, 0.6, 1.0]);
}

function drawLapels(J) {
  G.mid = ID.coat;
  const Rc = J.Rc;
  for (const sg of [-1, 1]) {
    const top = xf(J.neck, Rc, sg * 5.8, 4, 5);
    const notchIn = xf(J.chest, Rc, sg * 11.5, 9.5, 11.6);
    const notch = xf(J.chest, Rc, sg * 15.8, 6, 11.4);
    const brk = xf(J.chest, Rc, sg * 8.2, -21, 12.8);
    const n = mv(Rc, vnorm(V(sg * 0.55, 0.35, 1)));
    st([xf(J.neck, Rc, sg * 3.5, 6.2, -3), xf(J.neck, Rc, sg * 8.5, 4.2, 2.2), notchIn], [2.8, 3.6, 3], shade(MAT.coat, mv(Rc, vnorm(V(sg * 0.6, 0.6, 0.6)))), { dry: 0.25, h: 0.5 });
    st([top, vlerp(top, notch, 0.55), notch, vlerp(notch, brk, 0.45), brk], [3.2, 5, 5.2, 4.2, 1.4], shade(MAT.coat, n, 0.02), { dry: 0.22, h: 0.55, tip: 0.5 });
    st([top, vadd(vlerp(top, brk, 0.5), mv(Rc, V(sg * 1.2, 0, 0.6))), brk], 1.5, shade(MAT.coat, V(-0.4, 0.7, 0.6), 0.12), { a: 0.9, dry: 0.3, noShadow: true });
    st([vadd(notch, mv(Rc, V(sg * 1.3, -1.2, -0.5))), vadd(vlerp(notch, brk, 0.5), mv(Rc, V(sg * 1.8, 0, -0.5))), vadd(brk, mv(Rc, V(sg * 1.5, -2, 0)))], 1.8, MAT.coat.d, { a: 0.7, dry: 0.45, noShadow: true });
    dab(vlerp(notch, notchIn, 0.5), 1.2, 1.8, MAT.coat.d, { a: 0.9, noShadow: true });
  }
}

function drawArm(J, which) {
  const M = which === 'M';
  const sg = M ? -1 : 1;
  const sh = M ? J.shM : J.shF, el = M ? J.elM : J.elF, wr = M ? J.wrM : J.wrF;
  const up = vnorm(vsub(el, sh)), fo = vnorm(vsub(wr, el));
  const top = xf(sh, J.Rc, sg * 2.5, 2.5, 0);
  const cuff = vmad(wr, fo, -1.5);
  const pU = perpToward(up, G.wDir), pF = perpToward(fo, G.wDir), pE = vnorm(vadd(pU, pF));
  const nBase = vnorm(V(sg * 0.6, 0.15, 0.8));
  G.mid = ID.coat;
  st([top, el, cuff], [15.5, 14, 12.8], shade(MAT.coat, nBase), { dry: 0.22, h: 0.45, tip: 0.9, w0: 0.9 });
  const nl = vnorm(vadd(pE, V(0, 0.2, 0.9)));
  st([vmad(top, pU, 4.3), vmad(el, pE, 4.4), vmad(cuff, pF, 4)], [5.2, 5, 4.4], shade(MAT.coat, nl, 0.05), { a: 0.92, dry: 0.4, h: 0.5, noShadow: true });
  const ns = vnorm(vadd(vmul(pE, -1), V(0, -0.1, 0.5)));
  st([vmad(top, pU, -5), vmad(el, pE, -4.8), vmad(cuff, pF, -4.4)], [3.6, 4, 3.4], shade(MAT.coat, ns, -0.1), { a: 0.9, dry: 0.45, h: 0.45, noShadow: true });
  st([vmad(el, up, -4), vmad(vmad(el, pE, -1.5), V(0, 0, 1), 3), vmad(el, fo, 3.5)], [0.6, 1.6, 0.6], MAT.coat.d, { a: 0.7, dry: 0.4, noShadow: true });
  const rimSide = perpToward(vnorm(vadd(up, fo)), V(sg, 0, 0));
  st([vmad(top, rimSide, 6.6), vmad(el, rimSide, 6.4), vmad(cuff, rimSide, 5.6)], 1.1, rimCol(sg), { a: 0.6, dry: 0.5, noShadow: true, exact: true });
  const cf = vmad(wr, fo, -4.5);
  st([vmad(cf, pF, 6), vmad(vmad(cf, pF, 0), V(0, 0, 1), 2.5), vmad(cf, pF, -6)], 2.6, MAT.coat.d, { a: 0.9, dry: 0.25, noShadow: true });
  if (M) {
    G.mid = ID.mic;
    drawSmear(SIM.trails.mic, [0.86, 0.87, 0.95], 9);
    drawMic(J, 0);
    drawHand(J, 'M');
    drawMic(J, 1);
  } else {
    drawHand(J, 'F');
  }
}

function drawHand(J, which) {
  const M = which === 'M';
  const ps = J.pose;
  const el = M ? J.elM : J.elF, wr = M ? J.wrM : J.wrF;
  const fore = vnorm(vsub(wr, el));
  let dir = fore;
  if (!M) dir = vnorm(vadd(fore, V(0, 0.25, 0.2)));
  const lat = perpToward(dir, V(M ? -1 : 1, 0, 0));
  const knuck = vmad(wr, dir, 8.2);
  G.mid = ID.skin;
  const cS = shade(MAT.skin, vnorm(V(M ? -0.4 : 0.3, 0.3, 0.9)));
  const cL = shade(MAT.skin, vnorm(V(-0.6, 0.5, 0.7)), 0.04);
  const open = M ? 0 : ps.fOpen * (1 - ps.fPoint);
  st([vmad(wr, dir, 0.5), vmad(wr, dir, 4.8), knuck], [6.6, 8.2, 8.4 - open * 0.8], cS, { dry: 0.14, h: 0.45, w0: 0.9, tip: 0.85 });
  if (open > 0.05) {
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5);
      const base = vmad(knuck, lat, o * 1.9);
      const fd = vnorm(vadd(dir, vmul(lat, o * 0.16 * open)));
      const tip = vmad(vmad(base, fd, 1 + 6.2 * open), V(0, 0, 1), 0.6 * open);
      st([vmad(base, fd, -1), tip], [2.0, 1.6], i === 0 ? cL : cS, { dry: 0.15, h: 0.4, tip: 0.7, w0: 0.9 });
    }
  } else {
    st([vmad(knuck, lat, -3.8), vmad(vmad(knuck, V(0, 0, 1), 1.4), lat, 0), vmad(knuck, lat, 3.8)], 2.4, cL, { a: 0.85, dry: 0.3, noShadow: true });
  }
  if (!M && ps.fPoint > 0.05) {
    const base = vmad(knuck, lat, -2.2);
    st([vmad(base, dir, -1), vmad(base, dir, 1 + 7.5 * ps.fPoint)], [2.1, 1.7], cL, { dry: 0.12, h: 0.4, tip: 0.8, w0: 0.9 });
  }
  const th0 = vmad(vmad(wr, lat, -3.2), dir, 1.5);
  st([th0, vmad(vmad(th0, dir, 4.2), lat, -1.2 - open * 1.5)], [2.5, 2.0], cS, { dry: 0.15, h: 0.4, tip: 0.8, w0: 0.9 });
}

function drawLasso(mf) {
  if (mf.lasso < 0.02) return;
  const mid = vadd(vlerp(mf.grip, mf.bottom, 0.5), V(0, -3 * mf.lasso, 0));
  st([mf.grip, mid, mf.bottom], 1.7, [0.05, 0.05, 0.065], { c2: [0.32, 0.3, 0.38], dry: 0.1, h: 0.3, gloss: 0.8, w0: 1, tip: 1, tS: 0.01, tE: 0.01 });
}
function drawMic(J, stage) {
  G.mid = ID.mic;
  const mf = micFrame(J, SIM.mic.d);
  const hdl = { s: [0.02, 0.02, 0.03], m: [0.07, 0.07, 0.08], l: [0.2, 0.18, 0.2], c: [0.18, 0.18, 0.36] };
  if (stage === 0) {
    drawLasso(mf);
    const topH = vmad(mf.head, mf.d, -4.4);
    st([mf.bottom, topH], [3.8, 5.2], shade(hdl, V(0, 0, 1)), { dry: 0.08, h: 0.35, gloss: 1, w0: 0.95, tip: 1 });
    const p = perpToward(mf.d, G.wDir);
    st([vmad(vmad(mf.bottom, p, 0.9), V(0, 0, 1), 1), vmad(vmad(topH, p, 1.3), V(0, 0, 1), 1)], 0.7, [0.55, 0.52, 0.56], { a: 0.75, dry: 0.3, noShadow: true });
  } else {
    const ang = screenAng(mf.bottom, mf.head);
    dab(vmad(mf.head, mf.d, -3.8), 6, 2, MAT.chrome.s, { ang: ang + Math.PI / 2, dry: 0.1, gloss: 1 });
    dab(mf.head, 8.4, 7.6, shade(MAT.chrome, V(0, 0.2, 1)), { ang, dry: 0.08, h: 0.6, gloss: 1 });
    const p = perpToward(mf.d, G.wDir);
    for (const k of [-2, 0, 2]) {
      st([vmad(vmad(mf.head, mf.d, k), p, 3.7), vmad(vmad(vmad(mf.head, mf.d, k), p, 0), V(0, 0, 1), 3.9), vmad(vmad(mf.head, mf.d, k), p, -3.7)], 0.55, MAT.chrome.s, { a: 0.55, dry: 0.4, noShadow: true });
    }
    dab(vmad(vmad(mf.head, p, 2), mf.d, 1.6), 2.2, 2.2, MAT.chrome.l, { dry: 0.1, gloss: 1, noShadow: true });
  }
}

function drawCable(micOff) {
  if (G.cableA <= 0.01) return;
  G.mid = ID.mic;
  const pts = SIM.cable.map((i, k) => micOff ? vmad(simGet(i), micOff, Math.max(0, 1 - k / 14)) : simGet(i));
  st(pts, 1.9, [0.05, 0.05, 0.065], { c2: [0.32, 0.3, 0.38], dry: 0.12, h: 0.3, gloss: 0.8, w0: 1, tip: 1, tS: 0.01, tE: 0.01, a: G.cableA });
}

function drawSmear(trail, col, w) {
  if (G.mode === 'mask' || !trail || trail.length < 12) return;
  const n = trail.length;
  const speed = vlen(vsub(trail[n - 1], trail[n - 9])) / (8 * SIM.dt);
  const a = smoothstep(330, 600, speed) * 0.5;
  if (a < 0.03) return;
  const pts = [];
  for (let i = 0; i < n; i += 4) pts.push(trail[i]);
  if ((n - 1) % 4) pts.push(trail[n - 1]);
  st(pts, pts.map((_, i) => w * (0.12 + 0.88 * i / (pts.length - 1))), col, { a, dry: 0.7, w0: 0.3, tS: 0.3, tip: 0.85, tE: 0.05, h: 0.15, exact: true });
}

function drawHead(J) {
  const H = J.head, R = J.Rh, ps = J.pose;
  const hp = (x, y, z) => xf(H, R, x, y, z);
  const hn = (x, y, z) => mv(R, vnorm(V(x, y, z)));
  const skin = (x, y, z, j) => shade(MAT.skin, hn(x, y, z), j);
  G.mid = ID.skin;
  // block in the head in a darker skin tone first, so no gaps open between the planes
  st([hp(0, 8.5, 4.5), hp(0, 1, 5.5), hp(0, -7, 5.5), hp(0, -10, 5)], [13.4, 14.6, 13, 8], skin(0.2, -0.1, 0.5, -0.18), { dry: 0.05, h: 0.3, w0: 0.9, tip: 0.8 });
  for (const sg of [-1, 1]) {
    st([hp(sg * 6.6, 5, 1.5), hp(sg * 7.0, 0, 1.2), hp(sg * 6.4, -5, 1.8)], [3.2, 3.6, 3], skin(sg, 0, 0.2, -0.12), { dry: 0.15, h: 0.35 });
    st([hp(sg * 7.2, 2.4, -0.4), hp(sg * 7.7, -0.3, -0.3), hp(sg * 7.0, -3.4, 0.2)], [2.0, 2.5, 1.8], skin(sg, 0, 0.35, -0.05), { dry: 0.2, h: 0.4 });
  }
  st([hp(0, 8.6, 7.6), hp(0, 3, 9.6), hp(0, -3, 9.8), hp(0, -8, 8.8), hp(0.1, -11.1, 7.2)], [12.2, 13.9, 13.2, 10.2, 5.4],
    [skin(0, 0.5, 1), skin(0, 0.1, 1), skin(0, -0.1, 1), skin(0, -0.4, 1, -0.04), skin(0, -0.8, 0.6, -0.08)], { dry: 0.08, h: 0.35, w0: 0.9, tip: 0.8, c2: G.pop ? undefined : [0.86, 0.5, 0.42] });
  st([hp(-3.7, 7.6, 8.2), hp(-4.7, 2, 8.6), hp(-4.4, -3.5, 8.4), hp(-3.1, -8, 7.8)], [4.4, 5, 4.6, 3.3],
    [skin(-0.7, 0.4, 0.7, 0.05), skin(-0.8, 0, 0.6, 0.05), skin(-0.8, -0.2, 0.6, 0.03), skin(-0.6, -0.5, 0.6)], { dry: 0.2, h: 0.4 });
  st([hp(5.6, 6.2, 6.4), hp(6.2, 1, 6.6), hp(5.7, -4.5, 6.0), hp(3.8, -8.8, 6.2)], [2.8, 3.2, 3.0, 2.3],
    [skin(0.9, 0.2, 0.3, -0.1), skin(1, 0, 0.3, -0.12), skin(0.9, -0.2, 0.3, -0.12), skin(0.6, -0.6, 0.4, -0.1)], { a: 0.7, dry: 0.3, h: 0.4 });
  st([hp(-3, 6.3, 9.2), hp(1.5, 6.7, 9.4)], 2.2, skin(-0.3, 0.6, 0.8, 0.08), { a: 0.7, dry: 0.4, noShadow: true });
  for (const sg of [-1, 1]) {
    if (!G.pop) dab(hp(sg * 4.3, -2.8, 8.5), 3.2, 3, [0.9, 0.46, 0.42], { kind: 1, a: 0.3, noShadow: true });
    dab(hp(sg * 3.1, 1.3, 9.0), 3.2, 3.8, G.pop ? [0.45, 0.45, 0.45] : mixc(MAT.skin.s, MAT.skin.m, 0.45), { kind: 1, a: 0.45, ang: 0, noShadow: true });
  }
  // brows
  G.mid = ID.ink;
  const br = ps.brow * 0.8;
  for (const sg of [-1, 1]) st([hp(sg * 1.3, 3.3 + br * 0.6, 9.8), hp(sg * 3.4, 3.95 + br, 9.6), hp(sg * 5.6, 3.3 + br * 0.5, 8.6)], [1.1, 1.3, 0.9], [0.4, 0.18, 0.11], { dry: 0.25, noShadow: true });
  // eyes (free-side eye can wink)
  for (const sg of [-1, 1]) {
    const shut = clamp(ps.blink + (sg > 0 ? ps.wink : 0), 0, 1);
    G.mid = ID.ink;
    if (shut > 0.6) {
      st([hp(sg * 1.9, 1.3, 9.4), hp(sg * 3.1, 0.8, 9.5), hp(sg * 4.4, 1.2, 9.0)], 0.6, [0.2, 0.1, 0.1], { dry: 0.2, noShadow: true });
    } else {
      st([hp(sg * 1.9, 1.2, 9.4), hp(sg * 3.1, 1.6 - shut + ps.brow * 0.25, 9.45), hp(sg * 4.4, 1.15, 9.0)], 0.9, [0.15, 0.08, 0.08], { dry: 0.1, w0: 0.8, tip: 0.6, noShadow: true });
      dab(hp(sg * 3.0, 0.85, 9.45), 1.2 * (1 - shut) + 0.2 + ps.brow * 0.25, 1.1, [0.19, 0.12, 0.12], { ang: 0, noShadow: true });
      G.mid = ID.white;
      dab(hp(sg * 3.0 - 0.4, 1.2, 9.6), 0.4, 0.4, [0.95, 0.9, 0.88], { a: 0.75 * (1 - shut), noShadow: true });
    }
  }
  // nose
  G.mid = ID.skin;
  st([hp(0.9, 2.2, 10.2), hp(1.3, -1.5, 11.0), hp(1.0, -3.3, 11.1)], [1.0, 1.25, 1.1], G.pop ? [0.3, 0.3, 0.3] : mixc(MAT.skin.s, MAT.skin.m, 0.35), { a: 0.75, dry: 0.3, noShadow: true });
  dab(hp(-0.3, -2.6, 11.7), 1.6, 1.4, skin(-0.4, 0, 1, 0.08), { a: 0.8, noShadow: true });
  dab(hp(0.2, -4.1, 10.9), 1.0, 2.4, G.pop ? [0.3, 0.3, 0.3] : [0.55, 0.3, 0.3], { a: 0.75, ang: 0, noShadow: true });
  // mouth
  const mo = ps.mouth, sm = ps.smile, mO = ps.mO || 0;
  if (mO > 0.25) {
    // a round "oh!" of surprise
    G.mid = ID.ink;
    dab(hp(0, -7.2, 9.8), 1.4 + 2.0 * mO, 1.8 + 2.4 * mO, [0.2, 0.06, 0.08], { ang: Math.PI / 2, dry: 0.05, noShadow: true });
    G.mid = ID.lips;
    st([hp(-1.2 - mO, -6.6, 9.4), hp(0, -5.6 + 0.2 * mO, 10.0), hp(1.2 + mO, -6.6, 9.4)], 0.8, [0.72, 0.36, 0.34], { dry: 0.2, noShadow: true });
    st([hp(-1.1 - mO, -7.6, 9.4), hp(0, -8.9 - 0.9 * mO, 9.8), hp(1.1 + mO, -7.6, 9.4)], 1.0, [0.8, 0.44, 0.4], { dry: 0.2, noShadow: true });
  } else if (mo > 0.15) {
    G.mid = ID.ink;
    dab(hp(0, -6.9 - mo * 0.5, 9.7), 1.0 + mo * 2.0, 3.0, [0.2, 0.06, 0.08], { ang: 0, dry: 0.05, noShadow: true });
    G.mid = ID.lips;
    st([hp(-2.5, -5.9, 9.1), hp(0, -5.8, 10.0), hp(2.5, -5.9, 9.1)], 0.8, [0.7, 0.34, 0.32], { dry: 0.2, noShadow: true });
    st([hp(-2.0, -7.5 - mo * 1.0, 9.2), hp(0, -8.0 - mo * 1.1, 9.7), hp(2.0, -7.5 - mo * 1.0, 9.2)], 1.0, [0.8, 0.44, 0.4], { dry: 0.2, noShadow: true });
  } else if (sm > 0.8) {
    // the grin: teeth between the lips, corners pulled up
    const k = (sm - 0.8) / 0.2;
    G.mid = ID.ink;
    st([hp(-3.0, -5.7 + sm * 0.5, 8.9), hp(0, -6.35, 10.0), hp(3.0, -5.7 + sm * 0.5, 8.9)], 0.75, [0.42, 0.14, 0.15], { dry: 0.15, noShadow: true });
    G.mid = ID.white;
    st([hp(-2.3, -6.1 + sm * 0.25, 9.3), hp(0, -6.75, 10.0), hp(2.3, -6.1 + sm * 0.25, 9.3)], 0.55 + 0.35 * k, [0.94, 0.9, 0.84], { dry: 0.2, noShadow: true, exact: true });
    G.mid = ID.ink;
    st([hp(-2.1, -6.6 + sm * 0.2, 9.3), hp(0, -7.25, 9.9), hp(2.1, -6.6 + sm * 0.2, 9.3)], 0.5, [0.35, 0.1, 0.12], { dry: 0.2, a: 0.8, noShadow: true });
    G.mid = ID.lips;
    st([hp(-1.6, -7.7, 9.5), hp(1.6, -7.7, 9.5)], 1.0, [0.82, 0.48, 0.44], { a: 0.7, dry: 0.3, noShadow: true });
  } else {
    G.mid = ID.ink;
    st([hp(-2.8, -6.0 + sm * 0.7, 9.0), hp(0, -6.5, 10.0), hp(2.8, -6.0 + sm * 0.7, 9.0)], 0.8, [0.45, 0.15, 0.16], { dry: 0.15, noShadow: true });
    G.mid = ID.lips;
    st([hp(-1.5, -7.3, 9.5), hp(1.5, -7.3, 9.5)], 1.1, [0.82, 0.48, 0.44], { a: 0.75, dry: 0.3, noShadow: true });
  }
  G.mid = ID.skin;
  dab(hp(-0.5, -9.6, 8.3), 2, 2.4, skin(-0.3, -0.5, 0.9, 0.06), { a: 0.5, noShadow: true });
  drawHair(J);
}

function drawHair(J) {
  G.mid = ID.hair;
  const H = J.head, R = J.Rh;
  let off = mvT(R, SIM.hair.off);
  off = V(clamp(off.x * 1.6, -6, 6), clamp(off.y * 1.6, -6, 6), clamp(off.z * 1.6, -6, 6));
  const hp = (x, y, z, k) => xf(H, R, x + off.x * k, y + off.y * k, z + off.z * k);
  const hn = (x, y, z) => mv(R, vnorm(V(x, y, z)));
  const hair = (x, y, z, j) => shade(MAT.hair, hn(x, y, z), j);
  const crest = x => 15.8 - 0.085 * x * x;
  const dark = G.pop ? [0.35, 0.35, 0.35] : mixc(MAT.hair.s, MAT.hair.m, 0.55);
  st([hp(-7.2, 5.8, 5.8, 0), hp(-6.6, 10.8, 7.8, 0.4), hp(-3.8, 14.5, 8.4, 0.9), hp(0, 15.6, 8.6, 1), hp(3.8, 14.5, 8.4, 0.9), hp(6.6, 10.8, 7.8, 0.4), hp(7.2, 5.8, 5.8, 0)],
    7, dark, { dry: 0.22, h: 0.4, w0: 0.9, tip: 0.9 });
  st([hp(-5.8, 10.2, 9.4, 0.3), hp(0, 11.2, 10.4, 0.4), hp(5.8, 10.2, 9.4, 0.3)], 6.5, dark, { dry: 0.05, h: 0.4, w0: 0.9, tip: 0.9 });
  for (const sg of [-1, 1]) {
    st([hp(sg * 6.6, 8.6, 5.8, 0.2), hp(sg * 7.8, 6.4, -1.5, 0.1), hp(sg * 7.4, 3, -7, 0)], [4, 3.8, 2.8], hair(sg, 0.3, 0.2, -0.1), { dry: 0.3, h: 0.5 });
    st([hp(sg * 7.2, 4.5, 3, 0), hp(sg * 7.5, 1, 2.2, 0)], [1.8, 1.2], MAT.hair.s, { dry: 0.3, noShadow: true });
  }
  // the quiff: strands rise from the hairline and swirl over to one side as they roll over the crest
  const sw = -3.0;
  for (let i = 0; i < 9; i++) {
    const x0 = -6.2 + i * 1.55, q = x0 * x0;
    const r1 = hash(i * 7.3), r2 = hash(i * 3.1 + 1);
    const xe = clamp(x0 + sw * 0.85, -6.9, 6.9);
    const pk = crest(xe) + 0.4 * (r1 - 0.5);
    const pts = [hp(x0, 7.3 + r2 * 0.6, 8.7 - 0.07 * q, 0), hp(x0 + sw * 0.25, 11.2, 10.6 - 0.06 * q, 0.35),
                 hp(lerp(x0, xe, 0.7), pk - 1.1, 9.6 - 0.05 * q, 0.8), hp(xe, pk, 7.2 - 0.03 * q, 1)];
    const j = (r1 - 0.5) * 0.18;
    const cols = [hair(x0 * 0.06, -0.2, 1, j - 0.18), hair(x0 * 0.08, 0.1, 1, j - 0.05), hair(xe * 0.08, 0.6, 0.8, j + 0.05), hair(xe * 0.06, 1, 0.3, j + 0.08)];
    const w = 0.8 + r2 * 0.45;
    st(pts, [2.4 * w, 3.7 * w, 3.9 * w, 2.8 * w], cols, { dry: 0.3, h: 0.65, gloss: 0.45, tip: 0.5, c2: G.pop ? undefined : mixc(cols[2], [0.75, 0.3, 0.12], 0.4) });
  }
  const hl = G.pop ? [0.95, 0.95, 0.95] : MAT.hair.l, hm = G.pop ? [0.7, 0.7, 0.7] : MAT.hair.m;
  st([hp(-6, crest(-6) - 1.8, 6.6, 0.8), hp(-3.2, crest(-3.2) - 0.3, 8.2, 0.95), hp(0, crest(0), 8.4, 1), hp(3.2, crest(3.2) - 0.4, 7.8, 0.95), hp(5.8, crest(5.8) - 1.9, 6.2, 0.8)],
    [1.2, 1.9, 2.1, 1.7, 1.0], [hl, hl, mixc(hm, hl, 0.75), mixc(hm, hl, 0.5), hm], { a: 0.95, dry: 0.45, h: 0.6, gloss: 0.7, noShadow: true });
  for (let i = 0; i < 4; i++) {
    const x = -3.8 + i * 2.4, xe = clamp(x + sw * 0.85, -6.5, 6.5);
    st([hp(x, 10.5, 10.7, 0.3), hp(lerp(x, xe, 0.6), crest(xe) - 1.2, 9.6, 0.8), hp(xe, crest(xe) - 0.2, 6.6, 1)], 0.9,
      x < 0 ? hl : mixc(hm, hl, 0.45), { a: 0.8, dry: 0.5, h: 0.55, gloss: 0.6, noShadow: true });
  }
  for (const x of [-4.5, -1.2, 2.3, 5.2]) st([hp(x, 7.2, 9.0 - 0.06 * x * x, 0), hp(x - 0.6, 9.6, 10.0 - 0.06 * x * x, 0.2)], 0.9, G.pop ? [0.2, 0.2, 0.2] : MAT.hair.s, { a: 0.55, dry: 0.4, noShadow: true });
}

// ---------------------------------------------------------------- seen from behind (mid-spin)
function drawHeadBack(J) {
  const H = J.head, R = J.Rh;
  let off = mvT(R, SIM.hair.off);
  off = V(clamp(off.x * 1.6, -6, 6), clamp(off.y * 1.6, -6, 6), clamp(off.z * 1.6, -6, 6));
  const hp = (x, y, z, k) => xf(H, R, x + off.x * (k || 0), y + off.y * (k || 0), z + off.z * (k || 0));
  const hn = (x, y, z) => mv(R, vnorm(V(x, y, z)));
  G.mid = ID.skin;
  st([hp(0, -13, -2.5), hp(0, -6, -3.5)], 9.6, shade(MAT.skin, hn(0, -0.2, -1)), { dry: 0.15, w0: 0.9, tip: 0.9 });
  for (const sg of [-1, 1]) st([hp(sg * 6.8, 5, 0.5), hp(sg * 7.2, 0, 0.2), hp(sg * 6.6, -5, 0.8)], [3.2, 3.6, 3], shade(MAT.skin, hn(sg, 0, -0.3), -0.1), { dry: 0.15, h: 0.35 });
  G.mid = ID.hair;
  st([hp(0, -7.5, -4.5), hp(0, 0, -7.2), hp(0, 8, -6.2), hp(0, 13.5, -1, 0.6)], [11.5, 14.5, 14, 11], shade(MAT.hair, hn(0, 0.1, -1), -0.12), { dry: 0.15, h: 0.45, w0: 0.9, tip: 0.8 });
  st([hp(-6.5, 10.5, 5, 0.5), hp(0, 16, 4, 1), hp(6.5, 10.5, 5, 0.5)], 7, shade(MAT.hair, hn(0, 1, 0.2)), { dry: 0.2, h: 0.5 });
  for (let i = 0; i < 7; i++) {
    const x = -5.4 + i * 1.8, r = hash(i * 4.1);
    const cols = [shade(MAT.hair, hn(x * 0.1, -0.3, -1), -0.15), shade(MAT.hair, hn(x * 0.1, 0.3, -1)), shade(MAT.hair, hn(x * 0.1, 1, -0.3), 0.08)];
    st([hp(x * 0.8, -6.5, -5.2), hp(x * 1.05, 3, -7.4), hp(x * 0.95, 11 + r, -4.8, 0.6), hp(x * 0.7, 15.5, 0.5, 1)], [2.2, 3.2, 3.0, 2.0], [cols[0], cols[1], cols[2], cols[2]], { dry: 0.35, h: 0.6, gloss: 0.4, tip: 0.5 });
  }
}

function drawCoatBack(J, C) {
  const Rc = J.Rc, Rw = J.Rw;
  G.mid = ID.coat;
  const rows = C.B;
  const nb = (x, y) => mv(Rc, vnorm(V(x, y, -1)));
  // shoulders to waist, then the skirt, as one broad camel shell
  const fs = [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1.0];
  for (let k = 0; k < fs.length; k++) {
    const f = fs[k], x = lerp(-1, 1, f);
    const pts = [xf(J.neck, Rc, x * 17, -1.5, -5.5), xf(J.chest, Rc, x * 19, 2, -9.5), xf(J.waist, Rw, x * 17.5, 0, -11), rowAt(rows[0], f)];
    st(pts, [10.5, 11, 10.5, 10], shade(MAT.coat, nb(x * 0.8, 0.2), (hash(k * 2.3) - 0.5) * 0.08), { dry: 0.2, h: 0.45, w0: 0.9, tip: 0.9 });
  }
  for (let k = 0; k < fs.length; k++) {
    const f = fs[k], x = lerp(-1, 1, f);
    st([rowAt(rows[0], f), rowAt(rows[1], f), rowAt(rows[2], f)], [10.5, 11, 11.5], shade(MAT.coat, nb(x * 0.8, -0.1), (hash(k * 5.1) - 0.5) * 0.1), { dry: 0.22, h: 0.45, tip: 0.6 });
  }
  // yoke, back belt, centre vent, collar
  st([xf(J.neck, Rc, -15, -8, -8), xf(J.neck, Rc, 0, -10, -9.5), xf(J.neck, Rc, 15, -8, -8)], 1.2, MAT.coat.d, { a: 0.7, dry: 0.4, noShadow: true });
  const bY = V(0, 1.5, -0.6);
  st([vadd(rowAt(rows[0], 0), bY), vadd(rowAt(rows[0], 0.5), bY), vadd(rowAt(rows[0], 1), bY)], 4.6, shade(MAT.coat, nb(0, 0), -0.18), { dry: 0.15, h: 0.5, w0: 0.9, tip: 0.9, noShadow: true });
  st([rowAt(rows[1], 0.5), rowAt(rows[2], 0.5)], 1.4, MAT.coat.d, { a: 0.8, dry: 0.35, noShadow: true });
  st(rows[2], 2.6, MAT.coat.d, { dry: 0.3, a: 0.9 });
  st([xf(J.neck, Rc, -8, 5, -1), xf(J.neck, Rc, 0, 7, -5), xf(J.neck, Rc, 8, 5, -1)], 4.4, shade(MAT.coat, nb(0, 0.5), 0.05), { dry: 0.25, h: 0.5 });
  for (const sg of [-1, 1]) {
    const sh = sg < 0 ? J.shM : J.shF;
    st([xf(J.neck, Rc, sg * 9, 3.2, -2), xf(sh, Rc, sg * 3, 3.6, -1.5), xf(sh, Rc, sg * 7.2, 0.5, -1)], 1.2, rimCol(sg), { a: 0.7, dry: 0.45, noShadow: true, exact: true });
  }
}

// ---------------------------------------------------------------- whole figure
// how far in front of the chest (toward the camera) the forearm is
function armDepth(J, which) {
  const el = which === 'M' ? J.elM : J.elF, wr = which === 'M' ? J.wrM : J.wrF;
  const mid = vlerp(el, wr, 0.6);
  return mid.z - J.chest.z;
}

function drawFigure(J) {
  const facing = mv(J.Rc, V(0, 0, 1)).z;
  if (facing < -0.3) return drawFigureBack(J);
  const C = coatGrid(J);
  drawBackPanel(C);
  drawLegs(J);
  drawBelts(J);
  drawTorso(J);
  const mz = armDepth(J, 'M'), fz = armDepth(J, 'F');
  if (mz < -3) drawArm(J, 'M');
  if (fz < -3) drawArm(J, 'F');
  drawFrontPanels(J, C);
  drawLapels(J);
  if (mv(J.Rh, V(0, 0, 1)).z < -0.25) drawHeadBack(J); else drawHead(J);
  if (mz >= -3) drawArm(J, 'M');
  if (fz >= -3) drawArm(J, 'F');
  drawCable();
}

function drawFigureBack(J) {
  const C = coatGrid(J);
  const mz = armDepth(J, 'M'), fz = armDepth(J, 'F');
  if (mz < -3) drawArm(J, 'M');
  if (fz < -3) drawArm(J, 'F');
  drawFrontPanels(J, C);
  drawLegs(J);
  drawCoatBack(J, C);
  drawBelts(J);
  drawHeadBack(J);
  if (mz >= -3) drawArm(J, 'M');
  if (fz >= -3) drawArm(J, 'F');
  drawCable();
}

// Simplified silhouette for the shadow masks. J may be an exaggerated, slightly late copy of
// the pose (or the shadow's own routine); off / micOff move the simulated coat, belts and cable with it.
function drawSilhouette(J, off, micOff) {
  const C = coatGrid(J, off);
  const flat = { sq: 0.6 };
  for (const s of ['L', 'R']) {
    const hip = J['hip' + s], an = J['an' + s], ft = J['foot' + s];
    st([vadd(hip, V(0, 7, 0)), hip, J['kn' + s], an, vadd(vlerp(an, ft.ball, 0.4), V(0, -0.6, 1.5))], [18, 17, 14, 12.5, 12.5], null, flat);
    st([vadd(an, V(0, -1.5, 0.5)), vadd(ft.ball, V(0, 2, 0)), ft.toe], [9, 10.5, 9], null);
  }
  for (const f of [0.1, 0.5, 0.9]) st([rowAt(C.B[0], f), rowAt(C.B[1], f), rowAt(C.B[2], f)], 17, null, flat);
  for (const side of ['L', 'R']) {
    const rows = C[side];
    for (const f of [0.12, 0.5, 0.88]) st(rows.map(r => rowAt(r, f)), [11, 12, 12.5, 13.5, 14], null, flat);
  }
  st([J.chest, J.waist, J.pelvis], 30, null, flat);
  st([xf(J.shM, J.Rc, -3, 1, 0), J.neck, xf(J.shF, J.Rc, 3, 1, 0)], 15, null);
  st([J.chest, J.neck, J.neckTop, J.head], [18, 12, 11, 13], null);
  for (const M of [true, false]) {
    const sh = M ? J.shM : J.shF, el = M ? J.elM : J.elF, wr = M ? J.wrM : J.wrF;
    st([sh, el, wr], [15, 13.5, 12], null);
    const fo = vnorm(vsub(wr, el));
    dab(vmad(wr, fo, 5), 9, 9, null, { ang: screenAng(wr, vmad(wr, fo, 8)) });
  }
  const mf = micFrame(J, SIM.mic.d);
  st([mf.bottom, mf.head], [4, 5.4], null);
  dab(mf.head, 8.6, 7.6, null);
  if (mf.lasso > 0.02) st([mf.grip, mf.bottom], 1.8, null);
  const H = J.head, R = J.Rh;
  st([xf(H, R, 0, -11, 5), xf(H, R, 0, -2, 7), xf(H, R, 0, 8, 6), xf(H, R, -0.5, 15.5, 5)], [11, 15.5, 16, 13.5], null);
  for (let s = 0; s < 2; s++) st(SIM.belts[s].map(i => off ? vadd(simGet(i), off) : simGet(i)), 4, null);
  drawCable(micOff);
  // the shadow's top hat (the man himself has no hat)
  const ps = J.pose;
  if (ps.hat > 0.5) {
    const L = ps.hatLift || 0;
    let base = xf(H, R, 0, 12.5, 1);
    const hand = vmad(J.wrF, vnorm(vsub(J.wrF, J.elF)), 7);
    base = vlerp(base, vadd(hand, V(-2, 3, 0)), L);
    const tilt = 0.55 * L - 0.08;
    const up = V(-Math.sin(tilt), Math.cos(tilt), 0), side = V(Math.cos(tilt), Math.sin(tilt), 0);
    st([vmad(base, up, 1), vmad(base, up, 20)], [15, 14], null, { sq: 0.8 });
    st([vmad(base, side, -14), vmad(base, side, 14)], 3.6, null, { sq: 0.5 });
  }
}
