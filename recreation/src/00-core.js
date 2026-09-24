"use strict";
// ============================================================================
// Timing. Everything in the piece is laid out in beats of one 112 BPM score:
// 30 bars of 4/4, about 64 s, looping.
// ============================================================================
const BPM = 112;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const BARS = 30;
const BEATS = BARS * 4;
const DUR = BARS * BAR;
const TAU = Math.PI * 2;
const QS = new URLSearchParams(location.search);
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---------------------------------------------------------------- scalar maths
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sat = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const remap = (x, a, b, c, d) => c + (d - c) * sat((x - a) / (b - a));
const fract = x => x - Math.floor(x);
const mod = (x, m) => ((x % m) + m) % m;
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// rises over [a,b], falls over [c,d]
const pulse = (a, b, c, d, x) => sstep(a, b, x) * (1 - sstep(c, d, x));
const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
const easeIn = (t, p) => Math.pow(sat(t), p || 3);
const easeOut = (t, p) => 1 - Math.pow(1 - sat(t), p || 3);
const easeInOut = t => { t = sat(t); return t * t * (3 - 2 * t); };
const easeInOut5 = t => { t = sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
function easeOutBack(t, s) {
  const c = s === undefined ? 1.70158 : s;
  t = sat(t) - 1;
  return t * t * ((c + 1) * t + c) + 1;
}
function easeInOutBack(t, s) {
  const c = (s === undefined ? 1.2 : s) * 1.525;
  t = sat(t) * 2;
  if (t < 1) return (t * t * ((c + 1) * t - c)) / 2;
  t -= 2;
  return (t * t * ((c + 1) * t + c) + 2) / 2;
}
function easeOutElastic(t, damp) {
  t = sat(t);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -(damp || 10) * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
}

// ---------------------------------------------------------------- hashing, noise, PRNG
const hash = n => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);
const hash2 = (a, b) => hash(a * 157.31 + b * 113.97);
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}
const fbm1 = x => noise1(x) * 0.6 + noise1(x * 2.13 + 3.3) * 0.28 + noise1(x * 4.37 + 7.1) * 0.12;
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a0, a1) => a0 + (a1 - a0) * f();
  f.pick = arr => arr[(f() * arr.length) | 0];
  f.sign = () => (f() < 0.5 ? -1 : 1);
  return f;
}

// ---------------------------------------------------------------- 3D vectors
// world units are centimetres; y is up, +z points toward the audience
const V = (x, y, z) => ({ x, y, z });
const vadd = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const vsub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const vmul = (a, s) => V(a.x * s, a.y * s, a.z * s);
const vmad = (a, b, s) => V(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const vcross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const vlen = a => Math.hypot(a.x, a.y, a.z);
const vdist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const vnorm = a => { const l = vlen(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
const vlerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const vneg = a => V(-a.x, -a.y, -a.z);
const vcopy = a => V(a.x, a.y, a.z);
// a unit vector perpendicular to d, preferring the side that faces `toward`
function vperp(d, toward) {
  let p = vsub(toward, vmul(d, vdot(toward, d)));
  if (vlen(p) < 1e-5) p = Math.abs(d.y) < 0.9 ? vcross(d, V(0, 1, 0)) : vcross(d, V(1, 0, 0));
  return vnorm(p);
}

// ---------------------------------------------------------------- 3x3 rotations (row-major)
// R = Ry(yaw) * Rx(pitch) * Rz(roll). yaw > 0 turns the front (+z) toward +x,
// pitch > 0 nods the top toward the audience, roll > 0 tilts the top toward -x.
function rotYXZ(yaw, pitch, roll) {
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cb = Math.cos(pitch), sb = Math.sin(pitch);
  const cc = Math.cos(roll), sc = Math.sin(roll);
  return [
    ca * cc + sa * sb * sc, -ca * sc + sa * sb * cc, sa * cb,
    cb * sc, cb * cc, -sb,
    -sa * cc + ca * sb * sc, sa * sc + ca * sb * cc, ca * cb
  ];
}
function mmul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
const mapply = (m, v) => V(m[0] * v.x + m[1] * v.y + m[2] * v.z, m[3] * v.x + m[4] * v.y + m[5] * v.z, m[6] * v.x + m[7] * v.y + m[8] * v.z);
const mapplyT = (m, v) => V(m[0] * v.x + m[3] * v.y + m[6] * v.z, m[1] * v.x + m[4] * v.y + m[7] * v.z, m[2] * v.x + m[5] * v.y + m[8] * v.z);
// origin + R * (x, y, z)
const xf = (o, R, x, y, z) => V(o.x + R[0] * x + R[1] * y + R[2] * z, o.y + R[3] * x + R[4] * y + R[5] * z, o.z + R[6] * x + R[7] * y + R[8] * z);
// rotation of angle a about unit axis k (Rodrigues)
function rotAxis(k, a) {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    t * k.x * k.x + c, t * k.x * k.y - s * k.z, t * k.x * k.z + s * k.y,
    t * k.x * k.y + s * k.z, t * k.y * k.y + c, t * k.y * k.z - s * k.x,
    t * k.x * k.z - s * k.y, t * k.y * k.z + s * k.x, t * k.z * k.z + c
  ];
}
const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// ---------------------------------------------------------------- colour
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const tint3 = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const lum3 = c => c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
function hex(s) {
  const n = parseInt(s.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
// small random value/hue shift so neighbouring strokes of one colour are never identical
function jitter3(c, seed, amt) {
  const k = 1 + (hash(seed * 5.77) - 0.5) * amt, h = (hash(seed * 9.13) - 0.5) * amt * 0.4;
  return [c[0] * k + h, c[1] * k, c[2] * k - h];
}

// ---------------------------------------------------------------- timeline helpers
const beatAt = t => t / BEAT;
const timeAt = b => b * BEAT;
// piecewise-linear keys [[b, v], ...] with easing between keys
function keyed(keys, b, ease) {
  if (b <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (b < k1[0]) {
      const u = (b - k0[0]) / (k1[0] - k0[0]);
      return lerp(k0[1], k1[1], (ease || easeInOut)(u));
    }
  }
  return keys[keys.length - 1][1];
}
