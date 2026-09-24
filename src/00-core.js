"use strict";
// ============================================================
// Timing: 30 bars of 4/4 at 112 BPM = 64.3 s.
// Piece time t runs 0..60 and loops. On the very first play it starts
// at -INTRO, while the title lifts off and the nocturne paints itself in.
// ============================================================
const TAU = Math.PI * 2;
const BPM = 112;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const NBARS = 30;
const NBEATS = NBARS * 4;
const DUR = NBARS * BAR;
const INTRO = 1.9;
// stroke paint-in / lift-off sentinels: 'always painted' and 'never lifted'
const NO_IN = -1e4, NO_OUT = 1e4;
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const seg = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const hash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const modT = t => ((t % DUR) + DUR) % DUR;

// easing
function easeInOutBack(t, s) {
  const c = (s === undefined ? 1.2 : s) * 1.525;
  t *= 2;
  if (t < 1) return (t * t * ((c + 1) * t - c)) / 2;
  t -= 2;
  return (t * t * ((c + 1) * t + c) + 2) / 2;
}
function easeOutBack(t, s) {
  const c = s === undefined ? 1.70158 : s;
  t -= 1;
  return t * t * ((c + 1) * t + c) + 1;
}
const easeInOut = t => t * t * (3 - 2 * t);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const bump = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));

// ---------- 3D vectors (y up, x = screen right, z = toward camera)
const V = (x, y, z) => ({ x, y, z });
const vadd = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const vsub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const vmul = (a, s) => V(a.x * s, a.y * s, a.z * s);
const vmad = (a, b, s) => V(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const vcross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const vlen = a => Math.hypot(a.x, a.y, a.z);
const vnorm = a => { const l = vlen(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
const vlerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

// ---------- 3x3 rotations, row-major. R = Ry(yaw) * Rx(pitch) * Rz(roll)
// yaw>0 turns the front (+z) toward +x, pitch>0 leans the top toward the camera (nod),
// roll>0 tilts the top toward screen-left.
function rotYXZ(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch),
        cz = Math.cos(roll), sz = Math.sin(roll);
  return [
    cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx
  ];
}
const mv = (m, v) => V(m[0] * v.x + m[1] * v.y + m[2] * v.z, m[3] * v.x + m[4] * v.y + m[5] * v.z, m[6] * v.x + m[7] * v.y + m[8] * v.z);
const mvT = (m, v) => V(m[0] * v.x + m[3] * v.y + m[6] * v.z, m[1] * v.x + m[4] * v.y + m[7] * v.z, m[2] * v.x + m[5] * v.y + m[8] * v.z);
function mm(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
// origin + R * (x,y,z)
const xf = (o, R, x, y, z) => V(o.x + R[0] * x + R[1] * y + R[2] * z, o.y + R[3] * x + R[4] * y + R[5] * z, o.z + R[6] * x + R[7] * y + R[8] * z);

// color helpers
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scalec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
