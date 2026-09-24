// ============================================================
// Brush strokes -> ribbon geometry
//  * screen strokes: built every frame in device pixels (the dancer, shadows, moving scenery)
//  * world strokes: built once on the wall / floor planes and projected on the GPU
// ============================================================
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
      const oldU = this.u;
      this.vcap = Math.max(this.vcap * 2, this.nv + nv + 1024);
      this.ab = new ArrayBuffer(this.vcap * VSTRIDE * 4);
      this.f = new Float32Array(this.ab); this.u = new Uint32Array(this.ab);
      this.u.set(oldU.subarray(0, this.nv * VSTRIDE));
    }
    if (this.ni + ni > this.icap) {
      const old = this.idx;
      this.icap = Math.max(this.icap * 2, this.ni + ni + 2048);
      this.idx = new Uint32Array(this.icap);
      this.idx.set(old.subarray(0, this.ni));
    }
  }
}

// Global render state shared by all painting code
const G = {
  t: 0, b: 0, buf: null, mode: 'paint', layer: 'fg', proj: null,
  maskCol: [1, 0, 0], boil: 0,
  wDir: V(0, 0, 1), cDir: V(0, 0, 1), wI: 1, cI: 1, tint: null,
  cam: null, jit: 0.9,
  rev: null,
  mid: 0,        // material id of the part being painted (read by the pop-art prints)
  pop: false     // pop-art pass: paint light values only, the print inks come later
};
const UNIT_WORLD = 3.0;   // css px per cm used for brush texture scale on world strokes

function pack4(r, g, b, a) {
  return ((clamp(r, 0, 1) * 255 + 0.5) | 0) | (((clamp(g, 0, 1) * 255 + 0.5) | 0) << 8) |
         (((clamp(b, 0, 1) * 255 + 0.5) | 0) << 16) | (((clamp(a, 0, 1) * 255 + 0.5) | 0) << 24);
}

const EXT = 1.15;
let SP = { x: new Float32Array(4096), y: new Float32Array(4096), z: new Float32Array(4096), w: new Float32Array(4096),
           r: new Float32Array(4096), g: new Float32Array(4096), b: new Float32Array(4096),
           a: new Float32Array(4096), l: new Float32Array(4096) };
const JX = new Float32Array(512), JY = new Float32Array(512);
function growSP(n) {
  if (n < SP.x.length) return;
  const m = n * 2;
  for (const k in SP) { const o = SP[k]; SP[k] = new Float32Array(m); SP[k].set(o); }
}
function strokeDefaults(o) {
  return {
    w0: o.w0 !== undefined ? o.w0 : 0.62, tS: o.tS !== undefined ? o.tS : 0.14,
    tE: o.tE !== undefined ? o.tE : 0.34, tip: o.tip !== undefined ? o.tip : 0.28,
    dry: o.dry !== undefined ? o.dry : 0.35, h: o.h !== undefined ? o.h : 0.35,
    kind: o.kind || 0, recv: o.recv || 0, gloss: o.gloss !== undefined ? o.gloss : 0.25, sq: o.sq || 0
  };
}

// Write m sampled points (SP arrays, x/y[/z]) as a ribbon.
function emitRibbon(B, m, L, Wmax, seed, rev, unit, o, c2, world, planeN) {
  const d = strokeDefaults(o);
  const pc2 = pack4(c2[0], c2[1], c2[2], d.dry);
  const pex = pack4(d.recv, d.gloss, d.kind / 255, d.sq);
  const alphaMul = o.a !== undefined ? o.a : 1;
  B.ensure(m * 2, (m - 1) * 6);
  const F = B.f, U = B.u;
  let vi = B.nv;
  const base = vi;
  let pnx = 0, pny = 1, pnz = 0;
  for (let i = 0; i < m; i++) {
    const i0 = i === 0 ? 0 : i - 1, i1 = i === m - 1 ? m - 1 : i + 1;
    let tx = SP.x[i1] - SP.x[i0], ty = SP.y[i1] - SP.y[i0], tz = world ? SP.z[i1] - SP.z[i0] : 0;
    let nx, ny, nz;
    if (world) { // side = tangent x plane normal
      nx = ty * planeN.z - tz * planeN.y; ny = tz * planeN.x - tx * planeN.z; nz = tx * planeN.y - ty * planeN.x;
    } else { nx = -ty; ny = tx; nz = 0; }
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-6) { nx = pnx; ny = pny; nz = pnz; } else { nx /= nl; ny /= nl; nz /= nl; }
    pnx = nx; pny = ny; pnz = nz;
    const s = SP.l[i] / L;
    const prof = (d.w0 + (1 - d.w0) * smoothstep(0, d.tS, s)) * (1 - (1 - d.tip) * smoothstep(1 - d.tE, 1, s));
    const hw = Math.max(world ? 0.2 : 0.7, SP.w[i] * prof) * 0.5 * EXT;
    const pc = pack4(SP.r[i], SP.g[i], SP.b[i], SP.a[i] * alphaMul);
    for (let side = -1; side <= 1; side += 2) {
      const q = vi * VSTRIDE;
      F[q] = SP.x[i] + nx * hw * side; F[q + 1] = SP.y[i] + ny * hw * side; F[q + 2] = world ? SP.z[i] + nz * hw * side : 0;
      F[q + 3] = SP.l[i]; F[q + 4] = side * EXT;
      F[q + 5] = L; F[q + 6] = Wmax; F[q + 7] = seed; F[q + 8] = d.h;
      F[q + 9] = rev[0]; F[q + 10] = rev[1]; F[q + 11] = unit;
      U[q + 12] = pc; U[q + 13] = pc2; U[q + 14] = pex;
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

// ctrl: [{x, y, w, c:[r,g,b], a?}] in device pixels.
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
    ctrl = [{ x: p.x - dx, y: p.y - dy, w: p.w, c: p.c, a: p.a }, { x: p.x + dx, y: p.y + dy, w: p.w, c: p.c, a: p.a }];
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
  if (maxx < -pad || minx > CW + pad || maxy < -pad || miny > CH + pad) return;
  if (!(maxx - minx < 1e5 && maxy - miny < 1e5)) return;   // degenerate projection
  const rev = o.rev || (G.rev ? G.rev(idx, (minx + maxx) * 0.5, (miny + maxy) * 0.5) : [NO_IN, NO_OUT]);

  const jit = (o.jit !== undefined ? o.jit : G.jit) * DPR;
  const seedBase = o.seed !== undefined ? o.seed : idx * 1.618;
  const boil = o.still ? 0 : G.boil;
  for (let i = 0; i < n; i++) {
    const k = seedBase * 7.31 + i * 1.97 + boil * 3.17;
    JX[i] = jit ? (hash(k) - 0.5) * 2 * jit : 0;
    JY[i] = jit ? (hash(k + 11.3) - 0.5) * 2 * jit : 0;
  }
  let m = 0;
  const step = 5 * DPR;
  growSP(n * 44 + 8);
  for (let i = 0; i < n - 1; i++) {
    const i0 = i > 0 ? i - 1 : 0, i3 = i + 2 < n ? i + 2 : n - 1;
    const p0 = ctrl[i0], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i3];
    const x0 = p0.x + JX[i0], y0 = p0.y + JY[i0], x1 = p1.x + JX[i], y1 = p1.y + JY[i];
    const x2 = p2.x + JX[i + 1], y2 = p2.y + JY[i + 1], x3 = p3.x + JX[i3], y3 = p3.y + JY[i3];
    const segs = Math.max(1, Math.min(40, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step)));
    const c1 = p1.c, c2 = p2.c, a1 = p1.a !== undefined ? p1.a : 1, a2 = p2.a !== undefined ? p2.a : 1;
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      SP.x[m] = catmull(x0, x1, x2, x3, t);
      SP.y[m] = catmull(y0, y1, y2, y3, t);
      SP.w[m] = p1.w + (p2.w - p1.w) * t;
      SP.r[m] = c1[0] + (c2[0] - c1[0]) * t; SP.g[m] = c1[1] + (c2[1] - c1[1]) * t; SP.b[m] = c1[2] + (c2[2] - c1[2]) * t;
      SP.a[m] = a1 + (a2 - a1) * t;
      m++;
    }
  }
  {
    const p = ctrl[n - 1];
    SP.x[m] = p.x + JX[n - 1]; SP.y[m] = p.y + JY[n - 1]; SP.w[m] = p.w;
    SP.r[m] = p.c[0]; SP.g[m] = p.c[1]; SP.b[m] = p.c[2]; SP.a[m] = p.a !== undefined ? p.a : 1;
    m++;
  }
  SP.l[0] = 0;
  for (let i = 1; i < m; i++) SP.l[i] = SP.l[i - 1] + Math.hypot(SP.x[i] - SP.x[i - 1], SP.y[i] - SP.y[i - 1]);
  let L = SP.l[m - 1];
  if (L < 0.5) { SP.x[m - 1] += 0.5; L = 0.5; SP.l[m - 1] = 0.5; }
  let c2 = o.c2;
  if (!c2) { const c = ctrl[0].c; c2 = [c[0] * 1.1 + 0.03, c[1] * 1.03 + 0.01, c[2] * 0.9]; }
  const seed = (seedBase + boil * 0.3719) % 97.0;
  if (!o.exact && G.mode !== 'mask') {
    const kv = 1 + (hash(seedBase * 5.77) - 0.5) * 0.12, kh = (hash(seedBase * 9.13) - 0.5) * 0.05;
    for (let i = 0; i < m; i++) { SP.r[i] = SP.r[i] * kv + kh; SP.g[i] *= kv; SP.b[i] = SP.b[i] * kv - kh; }
  }
  emitRibbon(G.buf, m, L, wmax, seed, rev, 1 / DPR, o, c2, false, null);
}

// World-space stroke on a plane (planeN = plane normal). pts: V[], widths in cm.
function strokeWorld(pts, w, col, o, planeN, rev) {
  const B = G.buf;
  const idx = B.count++;
  const n = pts.length;
  let m = 0;
  growSP(n * 44 + 8);
  const cols = Array.isArray(col[0]) ? col : null;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2 < n ? i + 2 : n - 1];
    const segs = Math.max(1, Math.min(24, Math.ceil(vlen(vsub(p2, p1)) / 6)));
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
  let L = Math.max(SP.l[m - 1], 0.3);
  let wmax = 0;
  for (let i = 0; i < m; i++) if (SP.w[i] > wmax) wmax = SP.w[i];
  let c2 = o.c2;
  if (!c2) { const c = cols ? cols[0] : col; c2 = [c[0] * 1.1 + 0.03, c[1] * 1.03 + 0.01, c[2] * 0.9]; }
  const seed = (idx * 1.618) % 97.0;
  emitRibbon(B, m, L, wmax, seed, rev, UNIT_WORLD, o, c2, true, planeN);
}

// ---------- 3D stroke for the dancer and moving scenery: points in world space, widths in cm,
// projected by G.proj. col: [r,g,b] or one colour per point.  w: number or one per point.
function fgOpts(o) {
  if (G.layer === 'fg' && o.recv === undefined) { o = Object.assign({}, o); o.recv = G.mid / 10; }
  return o;
}
function st(pts, w, col, o) {
  o = o || {};
  const n = pts.length;
  if (G.mode === 'mask') {
    if (o.noShadow) { G.buf.count++; return; }
    const ctrl = [];
    for (let i = 0; i < n; i++) {
      const wi = (typeof w === 'number' ? w : w[i]) * 1.05;
      const q = G.proj(pts[i]);
      ctrl.push({ x: q.x, y: q.y, w: Math.max(1, wi * q.s), c: G.maskCol });
      if (i < n - 1) {
        const w2 = (typeof w === 'number' ? w : w[i + 1]) * 1.05;
        const qm = G.proj(vlerp(pts[i], pts[i + 1], 0.5));
        ctrl.push({ x: qm.x, y: qm.y, w: Math.max(1, (wi + w2) * 0.5 * qm.s), c: G.maskCol });
      }
    }
    return strokeScreen(ctrl, { dry: 0.12, w0: 1, tip: 0.85, tS: 0.05, tE: 0.12, kind: 0, jit: 1.2, seed: o.seed, sq: o.sq || 0 });
  }
  const ctrl = new Array(n);
  const perPointCol = Array.isArray(col[0]);
  for (let i = 0; i < n; i++) {
    const q = G.proj(pts[i]);
    ctrl[i] = { x: q.x, y: q.y, w: Math.max(0.8, (typeof w === 'number' ? w : w[i]) * q.s), c: perPointCol ? col[i] : col };
  }
  return strokeScreen(ctrl, fgOpts(o));
}
// a dab: one point, width w (cm), length len (cm), screen angle ang (radians) or auto
function dab(p, w, len, col, o) {
  o = o || {};
  if (G.mode === 'mask') {
    if (o.noShadow) { G.buf.count++; return; }
    const q = G.proj(p);
    return strokeScreen([{ x: q.x, y: q.y, w: Math.max(1, w * q.s * 1.05), c: G.maskCol }], { len: len * q.s, ang: o.ang, dry: 0.15, w0: 0.9, tip: 0.7, kind: 0, jit: 1 });
  }
  const q = G.proj(p);
  const oo = fgOpts(Object.assign({}, o, { len: len * q.s }));
  return strokeScreen([{ x: q.x, y: q.y, w: Math.max(0.8, w * q.s), c: col }], oo);
}

// ============================================================
// Lettering: the browser rasterises the words, and each row of ink becomes one
// sign-painter's stroke. Runs are cached per string/font/size.
// ============================================================
const TEXT_CACHE = new Map();
function textRuns(str, font, size, rows) {
  const key = [str, font, size, rows].join('|');
  if (TEXT_CACHE.has(key)) return TEXT_CACHE.get(key);
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const f = font.replace('%', size + 'px');
  x.font = f;
  const w = Math.ceil(x.measureText(str).width + size * 0.5), h = Math.ceil(size * 1.45);
  c.width = w; c.height = h;
  x.font = f; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
  x.fillText(str, size * 0.25, size * 1.08);
  const d = x.getImageData(0, 0, w, h).data;
  const step = size / rows;
  const runs = [];
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (let y = step * 0.5; y < h; y += step) {
    const yy = Math.floor(y);
    let x0 = -1;
    for (let xx = 0; xx <= w; xx++) {
      const on = xx < w && d[(yy * w + xx) * 4 + 3] > 100;
      if (on && x0 < 0) x0 = xx;
      if (!on && x0 >= 0) {
        runs.push([x0, xx, yy]);
        minx = Math.min(minx, x0); maxx = Math.max(maxx, xx); miny = Math.min(miny, yy); maxy = Math.max(maxy, yy);
        x0 = -1;
      }
    }
  }
  const out = { runs, step, x0: minx, x1: maxx, y0: miny, y1: maxy };
  TEXT_CACHE.set(key, out);
  return out;
}
// Paint a line of text centred on (cx, cy) in device px. sizePx: font size in device px.
function paintText(str, font, cx, cy, sizePx, col, o) {
  o = o || {};
  const base = 120;
  const R = textRuns(str, font, base, o.rows || 22);
  const k = sizePx / base;
  const ox = cx - (R.x0 + R.x1) * 0.5 * k, oy = cy - (R.y0 + R.y1) * 0.5 * k;
  const w = R.step * k * (o.wk || 1.55);
  const cols = Array.isArray(col[0]) ? col : null;
  for (let i = 0; i < R.runs.length; i++) {
    const r = R.runs[i];
    const c = cols ? cols[i % cols.length] : col;
    const x0 = ox + r[0] * k, x1 = ox + r[1] * k, y = oy + r[2] * k;
    const len = x1 - x0;
    const tilt = (hash(i * 3.3 + 1) - 0.5) * w * 0.3;
    const oo = o.revFn ? Object.assign({}, o, { rev: o.revFn((x0 + x1) * 0.5) }) : o;
    if (len < w * 0.8) {
      strokeScreen([{ x: (x0 + x1) * 0.5, y, w: w * 0.95, c }], Object.assign({ len: Math.max(len, w * 0.4), ang: 0 }, oo));
    } else {
      strokeScreen([{ x: x0 + w * 0.25, y: y - tilt, w, c }, { x: x1 - w * 0.25, y: y + tilt, w, c }], oo);
    }
  }
  return { w: (R.x1 - R.x0) * k, h: (R.y1 - R.y0) * k };
}
