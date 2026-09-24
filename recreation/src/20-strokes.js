// ============================================================================
// Brush strokes -> ribbon geometry.
//  * screen strokes are built every frame in device pixels (the dancer, moving scenery)
//  * world strokes are built once on a plane and projected on the GPU (the sets)
// A stroke is a Catmull-Rom spline through control points, with a width profile
// (w0 at the start, tapering to tip at the end), two paint colours and a dryness.
// ============================================================================
class StrokeBuf {
  constructor(isStatic) {
    this.vcap = 1 << 14; this.icap = 1 << 15;
    this.ab = new ArrayBuffer(this.vcap * VSTRIDE * 4);
    this.f = new Float32Array(this.ab); this.u = new Uint32Array(this.ab);
    this.idx = new Uint32Array(this.icap);
    this.nv = 0; this.ni = 0; this.count = 0;
    this.static = !!isStatic; this.dirty = true;
    Object.assign(this, glMakeStrokeVAO());
  }
  reset() { this.nv = 0; this.ni = 0; this.count = 0; this.dirty = true; }
  ensure(nv, ni) {
    if (this.nv + nv > this.vcap) {
      const old = this.u;
      this.vcap = Math.max(this.vcap * 2, this.nv + nv + 1024);
      this.ab = new ArrayBuffer(this.vcap * VSTRIDE * 4);
      this.f = new Float32Array(this.ab); this.u = new Uint32Array(this.ab);
      this.u.set(old.subarray(0, this.nv * VSTRIDE));
    }
    if (this.ni + ni > this.icap) {
      const old = this.idx;
      this.icap = Math.max(this.icap * 2, this.ni + ni + 2048);
      this.idx = new Uint32Array(this.icap);
      this.idx.set(old.subarray(0, this.ni));
    }
  }
}

// Global paint state shared by all painting code.
const G = {
  buf: null, mode: 'paint', maskCol: [1, 0, 0], slot: 1,
  proj: null, cam: null, boil: 0, jit: 0.8, t: 0, b: 0,
  anim: null, flags: 0, unitWorld: 3.0,
  key: null, rim: null, amb: [1, 1, 1]
};
const FLAG_CLIP = 1, FLAG_STIR = 2;

function pack4(r, g, b, a) {
  return ((clamp(r, 0, 1) * 255 + 0.5) | 0) | (((clamp(g, 0, 1) * 255 + 0.5) | 0) << 8) |
    (((clamp(b, 0, 1) * 255 + 0.5) | 0) << 16) | (((clamp(a, 0, 1) * 255 + 0.5) | 0) << 24);
}

const EXT = 1.15;
let SP = {};
for (const k of ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 'l', 'q']) SP[k] = new Float32Array(4096);
const JX = new Float32Array(1024), JY = new Float32Array(1024);
function growSP(n) {
  if (n < SP.x.length) return;
  const m = n * 2;
  for (const k in SP) { const o = SP[k]; SP[k] = new Float32Array(m); SP[k].set(o); }
}
function sdef(o, k, d) { return o[k] !== undefined ? o[k] : d; }

// Write m samples (SP arrays) as a ribbon. World ribbons widen along tangent x planeN.
function emitRibbon(B, m, L, Wmax, seed, anim, unit, o, c2, world, planeN) {
  const w0 = sdef(o, 'w0', 0.62), tS = sdef(o, 'tS', 0.14), tE = sdef(o, 'tE', 0.34), tip = sdef(o, 'tip', 0.28);
  const dry = sdef(o, 'dry', 0.35), th = sdef(o, 'h', 0.35), kind = o.kind || 0;
  const recv = sdef(o, 'recv', 0), gloss = sdef(o, 'gloss', 0.25), sq = o.sq || 0;
  const pc2 = pack4(c2[0], c2[1], c2[2], dry);
  const pex = pack4(recv, gloss, kind / 255, sq);
  const flags = (o.flags !== undefined ? o.flags : G.flags) + (o.stir ? FLAG_STIR : 0);
  const alphaMul = o.a !== undefined ? o.a : 1;
  const idMode = G.mode === 'id';
  B.ensure(m * 2, (m - 1) * 6);
  const F = B.f, U = B.u;
  let vi = B.nv;
  const base = vi;
  let pnx = 0, pny = 1, pnz = 0;
  const dash = o.dash || 0, dspd = o.dspd || 0;
  for (let i = 0; i < m; i++) {
    const i0 = i === 0 ? 0 : i - 1, i1 = i === m - 1 ? m - 1 : i + 1;
    const tx = SP.x[i1] - SP.x[i0], ty = SP.y[i1] - SP.y[i0], tz = world ? SP.z[i1] - SP.z[i0] : 0;
    let nx, ny, nz;
    if (world) { nx = ty * planeN.z - tz * planeN.y; ny = tz * planeN.x - tx * planeN.z; nz = tx * planeN.y - ty * planeN.x; }
    else { nx = -ty; ny = tx; nz = 0; }
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-6) { nx = pnx; ny = pny; nz = pnz; } else { nx /= nl; ny /= nl; nz /= nl; }
    pnx = nx; pny = ny; pnz = nz;
    const s = SP.l[i] / L;
    const prof = (w0 + (1 - w0) * sstep(0, tS, s)) * (1 - (1 - tip) * sstep(1 - tE, 1, s));
    const hw = Math.max(world ? 0.15 : 0.6, SP.w[i] * prof) * 0.5 * EXT;
    const pc = pack4(SP.r[i], SP.g[i], SP.b[i], idMode ? 1 : SP.a[i] * alphaMul);
    for (let side = -1; side <= 1; side += 2) {
      const q = vi * VSTRIDE;
      F[q] = SP.x[i] + nx * hw * side; F[q + 1] = SP.y[i] + ny * hw * side;
      F[q + 2] = world ? SP.z[i] + nz * hw * side : SP.q[i];
      F[q + 3] = SP.l[i]; F[q + 4] = side * EXT;
      F[q + 5] = L; F[q + 6] = Wmax; F[q + 7] = seed; F[q + 8] = th;
      F[q + 9] = anim[0]; F[q + 10] = anim[1]; F[q + 11] = dash; F[q + 12] = dspd;
      F[q + 13] = unit; F[q + 14] = flags;
      U[q + 15] = pc; U[q + 16] = pc2; U[q + 17] = pex;
      vi++;
    }
  }
  const I = B.idx;
  let ii = B.ni;
  for (let i = 0; i < m - 1; i++) {
    const a = base + i * 2;
    I[ii++] = a; I[ii++] = a + 1; I[ii++] = a + 2;
    I[ii++] = a + 1; I[ii++] = a + 3; I[ii++] = a + 2;
  }
  B.nv = vi; B.ni = ii; B.dirty = true;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
const NO_ANIM = [-1, 1e4];

// ctrl: [{x, y, w, c:[r,g,b], a?, q?}] in device pixels (q: a world height carried for clipping)
function strokeScreen(ctrl, o) {
  const n = ctrl.length;
  if (n === 0) return;
  const B = G.buf;
  const idx = B.count++;
  if (n === 1) {
    const p = ctrl[0];
    const ang = o.ang !== undefined ? o.ang : hash(idx * 3.7) * Math.PI;
    const len = (o.len !== undefined ? o.len : p.w * 0.7) * 0.5;
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    ctrl = [{ x: p.x - dx, y: p.y - dy, w: p.w, c: p.c, a: p.a, q: p.q }, { x: p.x + dx, y: p.y + dy, w: p.w, c: p.c, a: p.a, q: p.q }];
  }
  strokeScreenN(ctrl, o, idx);
}

function strokeScreenN(ctrl, o, idx) {
  const n = ctrl.length;
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, wmax = 0;
  for (let i = 0; i < n; i++) {
    const p = ctrl[i];
    if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
    if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
    if (p.w > wmax) wmax = p.w;
  }
  const pad = wmax + 4;
  if (maxx < -pad || minx > G.rw + pad || maxy < -pad || miny > G.rh + pad) return;
  const anim = o.anim || (G.anim ? G.anim(idx, (minx + maxx) * 0.5, (miny + maxy) * 0.5) : NO_ANIM);
  const jit = (o.jit !== undefined ? o.jit : G.jit) * DPR * G.rs;
  const seedBase = o.seed !== undefined ? o.seed : idx * 1.618;
  const boil = o.still ? 0 : G.boil;
  for (let i = 0; i < n; i++) {
    const k = seedBase * 7.31 + i * 1.97 + boil * 3.17;
    JX[i] = jit ? (hash(k) - 0.5) * 2 * jit : 0;
    JY[i] = jit ? (hash(k + 11.3) - 0.5) * 2 * jit : 0;
  }
  let m = 0;
  const step = 5 * DPR * G.rs;
  growSP(n * 44 + 8);
  for (let i = 0; i < n - 1; i++) {
    const i0 = i > 0 ? i - 1 : 0, i3 = i + 2 < n ? i + 2 : n - 1;
    const p0 = ctrl[i0], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i3];
    const x0 = p0.x + JX[i0], y0 = p0.y + JY[i0], x1 = p1.x + JX[i], y1 = p1.y + JY[i];
    const x2 = p2.x + JX[i + 1], y2 = p2.y + JY[i + 1], x3 = p3.x + JX[i3], y3 = p3.y + JY[i3];
    const segs = Math.max(1, Math.min(40, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step)));
    const c1 = p1.c, c2 = p2.c, a1 = p1.a !== undefined ? p1.a : 1, a2 = p2.a !== undefined ? p2.a : 1;
    const q1 = p1.q || 0, q2 = p2.q || 0;
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      SP.x[m] = catmull(x0, x1, x2, x3, t);
      SP.y[m] = catmull(y0, y1, y2, y3, t);
      SP.w[m] = p1.w + (p2.w - p1.w) * t;
      SP.r[m] = c1[0] + (c2[0] - c1[0]) * t; SP.g[m] = c1[1] + (c2[1] - c1[1]) * t; SP.b[m] = c1[2] + (c2[2] - c1[2]) * t;
      SP.a[m] = a1 + (a2 - a1) * t;
      SP.q[m] = q1 + (q2 - q1) * t;
      m++;
    }
  }
  {
    const p = ctrl[n - 1];
    SP.x[m] = p.x + JX[n - 1]; SP.y[m] = p.y + JY[n - 1]; SP.w[m] = p.w;
    SP.r[m] = p.c[0]; SP.g[m] = p.c[1]; SP.b[m] = p.c[2]; SP.a[m] = p.a !== undefined ? p.a : 1; SP.q[m] = p.q || 0;
    m++;
  }
  SP.l[0] = 0;
  for (let i = 1; i < m; i++) SP.l[i] = SP.l[i - 1] + Math.hypot(SP.x[i] - SP.x[i - 1], SP.y[i] - SP.y[i - 1]);
  let L = SP.l[m - 1];
  if (L < 0.5) { SP.x[m - 1] += 0.5; L = 0.5; SP.l[m - 1] = 0.5; }
  let c2 = o.c2;
  if (!c2 || G.mode !== 'paint') { const c = ctrl[0].c; c2 = G.mode !== 'paint' ? c : [c[0] * 1.1 + 0.03, c[1] * 1.03 + 0.01, c[2] * 0.9]; }
  const seed = (seedBase + boil * 0.3719) % 97.0;
  if (!o.exact && G.mode === 'paint') {
    const kv = 1 + (hash(seedBase * 5.77) - 0.5) * 0.12, kh = (hash(seedBase * 9.13) - 0.5) * 0.05;
    for (let i = 0; i < m; i++) { SP.r[i] = SP.r[i] * kv + kh; SP.g[i] *= kv; SP.b[i] = SP.b[i] * kv - kh; }
  }
  emitRibbon(G.buf, m, L, wmax, seed, anim, 1 / (DPR * G.rs), o, c2, false, null);
}

// World-space stroke lying on a plane (planeN = its normal). pts: V[], widths in cm.
function strokeWorld(pts, w, col, o, planeN) {
  o = o || {};
  const B = G.buf;
  const idx = B.count++;
  const n = pts.length;
  let m = 0;
  growSP(n * 44 + 8);
  const cols = Array.isArray(col[0]) ? col : null;
  let wmax = 0;
  for (let i = 0; i < n; i++) { const wi = typeof w === 'number' ? w : w[i]; if (wi > wmax) wmax = wi; }
  const step = Math.max(4, wmax * 0.45);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2 < n ? i + 2 : n - 1];
    const segs = Math.max(1, Math.min(32, Math.ceil(vdist(p2, p1) / step)));
    const w1 = typeof w === 'number' ? w : w[i], w2 = typeof w === 'number' ? w : w[i + 1];
    const c1 = cols ? cols[i] : col, c2 = cols ? cols[i + 1] : col;
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      SP.x[m] = catmull(p0.x, p1.x, p2.x, p3.x, t);
      SP.y[m] = catmull(p0.y, p1.y, p2.y, p3.y, t);
      SP.z[m] = catmull(p0.z, p1.z, p2.z, p3.z, t);
      SP.w[m] = w1 + (w2 - w1) * t;
      SP.r[m] = c1[0] + (c2[0] - c1[0]) * t; SP.g[m] = c1[1] + (c2[1] - c1[1]) * t; SP.b[m] = c1[2] + (c2[2] - c1[2]) * t;
      SP.a[m] = 1;
      m++;
    }
  }
  const pl = pts[n - 1], cl = cols ? cols[n - 1] : col;
  SP.x[m] = pl.x; SP.y[m] = pl.y; SP.z[m] = pl.z; SP.w[m] = typeof w === 'number' ? w : w[n - 1];
  SP.r[m] = cl[0]; SP.g[m] = cl[1]; SP.b[m] = cl[2]; SP.a[m] = 1;
  m++;
  SP.l[0] = 0;
  for (let i = 1; i < m; i++) SP.l[i] = SP.l[i - 1] + Math.hypot(SP.x[i] - SP.x[i - 1], SP.y[i] - SP.y[i - 1], SP.z[i] - SP.z[i - 1]);
  const L = Math.max(SP.l[m - 1], 0.3);
  let c2 = o.c2;
  if (!c2) { const c = cols ? cols[0] : col; c2 = [c[0] * 1.1 + 0.03, c[1] * 1.03 + 0.01, c[2] * 0.9]; }
  const seed = o.seed !== undefined ? o.seed % 97 : (idx * 1.618) % 97.0;
  if (!o.exact) {
    const kv = 1 + (hash(idx * 5.77 + 0.3) - 0.5) * 0.1, kh = (hash(idx * 9.13 + 0.7) - 0.5) * 0.04;
    for (let i = 0; i < m; i++) { SP.r[i] = SP.r[i] * kv + kh; SP.g[i] *= kv; SP.b[i] = SP.b[i] * kv - kh; }
  }
  emitRibbon(B, m, L, wmax, seed, o.anim || NO_ANIM, (o.unit || G.unitWorld), o, c2, true, planeN);
}

// ---------------------------------------------------------------- strokes through 3D points
// Points are projected by G.proj (which returns {x, y, s: px per cm, wy: world height}).
// In 'mask' and 'id' modes every stroke is a flat silhouette in G.maskCol / the material slot.
function flatCol(o) {
  if (G.mode === 'mask') return G.maskCol;
  return [(o.slot !== undefined ? o.slot : G.slot) / 8, 0, 0];
}
function st(pts, w, col, o) {
  o = o || {};
  const n = pts.length;
  if (G.mode !== 'paint') {
    if (o.noShadow && G.mode === 'mask') { G.buf.count++; return; }
    if (o.noId && G.mode === 'id') { G.buf.count++; return; }
    const fc = flatCol(o);
    const ctrl = new Array(n);
    for (let i = 0; i < n; i++) {
      const q = G.proj(pts[i]);
      ctrl[i] = { x: q.x, y: q.y, w: Math.max(1, (typeof w === 'number' ? w : w[i]) * q.s * (G.mode === 'mask' ? 1.04 : 1)), c: fc, q: q.wy };
    }
    return strokeScreen(ctrl, { dry: 0.08, w0: sdef(o, 'w0', 0.9), tip: sdef(o, 'tip', 0.8), tS: 0.05, tE: 0.15, kind: 0, jit: 0.8, seed: o.seed, sq: o.sq || 0, a: 1, flags: o.flags });
  }
  const ctrl = new Array(n);
  const perPoint = Array.isArray(col[0]);
  for (let i = 0; i < n; i++) {
    const q = G.proj(pts[i]);
    ctrl[i] = { x: q.x, y: q.y, w: Math.max(0.7, (typeof w === 'number' ? w : w[i]) * q.s), c: perPoint ? col[i] : col, q: q.wy };
  }
  return strokeScreen(ctrl, o);
}
// a dab: one point, width w (cm), length len (cm), screen angle ang (radians) or random
function dab(p, w, len, col, o) {
  o = o || {};
  const q = G.proj(p);
  if (G.mode !== 'paint') {
    if (o.noShadow && G.mode === 'mask') { G.buf.count++; return; }
    if (o.noId && G.mode === 'id') { G.buf.count++; return; }
    return strokeScreen([{ x: q.x, y: q.y, w: Math.max(1, w * q.s), c: flatCol(o), q: q.wy }], { len: len * q.s, ang: o.ang, dry: 0.1, w0: 0.9, tip: 0.75, kind: 0, jit: 0.8, flags: o.flags });
  }
  const oo = Object.assign({}, o, { len: len * q.s });
  return strokeScreen([{ x: q.x, y: q.y, w: Math.max(0.7, w * q.s), c: col, q: q.wy }], oo);
}
function screenAng(p, q) {
  const a = G.proj(p), b = G.proj(q);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// ---------------------------------------------------------------- brush lettering
// A single-stroke capital alphabet on a 4 x 6 grid (baseline 0, cap height 6).
// Each glyph is a list of polylines [x0, y0, x1, y1, ...]; advance is the glyph width + 1.5.
const GLYPHS = {
  A: [[0, 0, 2, 6, 4, 0], [0.8, 2.2, 3.2, 2.2]],
  B: [[0, 0, 0, 6, 2.5, 6, 3.4, 5.4, 3.4, 3.8, 2.5, 3.2, 0, 3.2], [2.5, 3.2, 3.7, 2.4, 3.7, 0.8, 2.7, 0, 0, 0]],
  C: [[4, 4.9, 3.1, 5.85, 1.5, 5.9, 0.35, 4.8, 0, 3, 0.35, 1.2, 1.5, 0.05, 3.1, 0.1, 4, 1.1]],
  D: [[0, 0, 0, 6, 1.9, 6, 3.4, 5.1, 4, 3, 3.4, 0.9, 1.9, 0, 0, 0]],
  E: [[3.8, 6, 0, 6, 0, 0, 3.8, 0], [0, 3.1, 2.8, 3.1]],
  F: [[3.8, 6, 0, 6, 0, 0], [0, 3.1, 2.8, 3.1]],
  G: [[4, 4.9, 3.1, 5.85, 1.5, 5.9, 0.35, 4.8, 0, 3, 0.35, 1.2, 1.5, 0.05, 3.1, 0.1, 4, 1, 4, 2.7, 2.3, 2.7]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3.1, 4, 3.1]],
  I: [[1, 0, 1, 6]],
  J: [[3.2, 6, 3.2, 1.3, 2.5, 0.1, 1, 0.1, 0.1, 1.2]],
  K: [[0, 0, 0, 6], [3.9, 6, 0.1, 2.3], [1.3, 3.4, 4, 0]],
  L: [[0, 6, 0, 0, 3.5, 0]],
  M: [[0, 0, 0.2, 6, 2.5, 1.5, 4.8, 6, 5, 0]],
  N: [[0, 0, 0, 6, 4, 0, 4, 6]],
  O: [[2, 5.95, 0.6, 5.3, 0, 3, 0.6, 0.7, 2, 0.05, 3.4, 0.7, 4.05, 3, 3.4, 5.3, 2, 5.95, 1.6, 5.9]],
  P: [[0, 0, 0, 6, 2.6, 6, 3.7, 5.2, 3.7, 3.8, 2.6, 3, 0, 3]],
  Q: [[2, 5.95, 0.6, 5.3, 0, 3, 0.6, 0.7, 2, 0.05, 3.4, 0.7, 4.05, 3, 3.4, 5.3, 2, 5.95, 1.6, 5.9], [2.4, 1.5, 4.2, -0.4]],
  R: [[0, 0, 0, 6, 2.6, 6, 3.7, 5.2, 3.7, 3.8, 2.6, 3, 0, 3], [2.1, 3, 4, 0]],
  S: [[3.8, 5.1, 2.8, 5.95, 1.2, 5.95, 0.25, 5.1, 0.45, 3.8, 2, 3.1, 3.55, 2.35, 3.9, 1.05, 2.9, 0.05, 1.1, 0.05, 0, 0.95]],
  T: [[0, 6, 4, 6], [2, 6, 2, 0]],
  U: [[0, 6, 0, 1.6, 0.8, 0.25, 2, 0, 3.2, 0.25, 4, 1.6, 4, 6]],
  V: [[0, 6, 2, 0, 4, 6]],
  W: [[0, 6, 1.25, 0, 2.5, 4.3, 3.75, 0, 5, 6]],
  X: [[0, 6, 4, 0], [4, 6, 0, 0]],
  Y: [[0, 6, 2, 3, 4, 6], [2, 3, 2, 0]],
  Z: [[0.2, 6, 4, 6, 0, 0, 4, 0]],
  '0': [[2, 5.95, 0.6, 5.2, 0, 3, 0.6, 0.8, 2, 0.05, 3.4, 0.8, 4, 3, 3.4, 5.2, 2, 5.95, 1.6, 5.9]],
  '1': [[0.6, 4.8, 1.8, 6, 1.8, 0]],
  '2': [[0.2, 4.9, 1.2, 5.9, 2.8, 5.9, 3.8, 4.8, 3.6, 3.4, 0, 0, 4, 0]],
  '3': [[0.3, 5.3, 1.5, 6, 3, 5.9, 3.7, 4.8, 3.2, 3.5, 1.6, 3.2], [1.6, 3.2, 3.4, 2.8, 3.9, 1.4, 3, 0.1, 1.3, 0, 0.1, 0.8]],
  '4': [[3, 0, 3, 6, 0, 1.8, 4, 1.8]],
  '5': [[3.7, 6, 0.6, 6, 0.3, 3.4, 1.6, 3.8, 3, 3.6, 3.9, 2.4, 3.6, 0.7, 2.3, 0, 0.9, 0.1, 0, 0.9]],
  '6': [[3.5, 5.6, 2.3, 6, 1, 5.5, 0.2, 3.8, 0.1, 1.6, 0.9, 0.2, 2.3, 0, 3.5, 0.6, 3.9, 1.9, 3.3, 3.2, 1.9, 3.5, 0.5, 2.9]],
  '7': [[0, 6, 4, 6, 1.4, 0]],
  '8': [[2, 3.2, 3.3, 3.8, 3.6, 5, 2.8, 5.95, 1.2, 5.95, 0.4, 5, 0.7, 3.8, 2, 3.2, 3.5, 2.5, 3.9, 1.1, 2.9, 0.05, 1.1, 0.05, 0.1, 1.1, 0.5, 2.5, 2, 3.2]],
  '9': [[3.5, 3.1, 2.1, 2.5, 0.7, 2.8, 0.1, 4.2, 0.7, 5.6, 2, 6, 3.3, 5.5, 3.9, 4, 3.7, 1.8, 2.8, 0.3, 1.4, 0, 0.4, 0.5]],
  '.': [[0.4, 0.1, 0.5, 0.4]],
  ',': [[0.6, 0.5, 0.5, 0.1, 0.1, -0.9]],
  "'": [[0.5, 6, 0.4, 4.6]],
  '"': [[0.3, 6, 0.2, 4.6], [1.4, 6, 1.3, 4.6]],
  '-': [[0.2, 2.8, 2.6, 2.8]],
  ':': [[0.4, 0.1, 0.5, 0.4], [0.4, 3.3, 0.5, 3.6]],
  ';': [[0.4, 3.3, 0.5, 3.6], [0.6, 0.5, 0.5, 0.1, 0.1, -0.9]],
  '!': [[0.5, 6, 0.5, 1.8], [0.45, 0.1, 0.55, 0.4]],
  '?': [[0.1, 4.8, 1, 5.9, 2.6, 5.9, 3.5, 4.8, 3.2, 3.6, 1.8, 2.8, 1.8, 1.7], [1.75, 0.1, 1.85, 0.4]],
  '(': [[1.6, 6.6, 0.5, 4.8, 0.2, 3, 0.5, 1, 1.6, -0.7]],
  ')': [[0.2, 6.6, 1.3, 4.8, 1.6, 3, 1.3, 1, 0.2, -0.7]],
  '&': [[4, 0, 0.9, 4.1, 0.8, 5.4, 1.6, 6, 2.5, 5.6, 2.6, 4.6, 0.3, 2.5, 0.1, 1.1, 1, 0.1, 2.3, 0.1, 4, 2.4]],
  '/': [[0, -0.5, 3, 6.5]],
  '·': [[0.4, 2.9, 0.6, 3.1]],
  ' ': []
};
function glyphWidth(ch) {
  const g = GLYPHS[ch];
  if (!g) return 3;
  if (ch === ' ') return 2.4;
  let mx = 0;
  for (const s of g) for (let i = 0; i < s.length; i += 2) mx = Math.max(mx, s[i]);
  return mx;
}
function textWidth(str, track) {
  let w = 0;
  for (const ch of str) w += glyphWidth(ch) + (track !== undefined ? track : 1.5);
  return w - (track !== undefined ? track : 1.5);
}
// Lay out `str` as polylines in text units (cap height 6), split at sharp corners so
// every stroke is a smooth brush movement. Returns [[[x,y],...], ...].
function layoutText(str, track, slant) {
  const out = [];
  let x = 0;
  const tr = track !== undefined ? track : 1.5, sl = slant || 0;
  for (const ch of str.toUpperCase()) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (const s of g) {
      let cur = [];
      const n = s.length / 2;
      for (let i = 0; i < n; i++) {
        const px = x + s[i * 2] + s[i * 2 + 1] * sl, py = s[i * 2 + 1];
        cur.push([px, py]);
        if (i > 0 && i < n - 1) {
          const ax = s[i * 2] - s[i * 2 - 2], ay = s[i * 2 + 1] - s[i * 2 - 1];
          const bx = s[i * 2 + 2] - s[i * 2], by = s[i * 2 + 3] - s[i * 2 + 1];
          const c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) + 1e-9);
          if (c < 0.35) { out.push(cur); cur = [[px, py]]; }
        }
      }
      if (cur.length === 1) cur.push([cur[0][0] + 0.12, cur[0][1] + 0.12]);
      if (cur.length) out.push(cur);
    }
    x += glyphWidth(ch) + tr;
  }
  return { lines: out, width: x - tr };
}
