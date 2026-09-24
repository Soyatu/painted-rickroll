// ============================================================================
// Secondary motion: the coat skirt, the belt ends, the microphone cable, the
// quiff and the mic's follow-through. Fixed 120 Hz Verlet, re-run from a short
// pre-roll whenever time jumps, so any frame can be reproduced exactly.
// ============================================================================
const SIM = {
  dt: 1 / 120, t: -1e9, ready: false, n: 0,
  x: new Float64Array(256), y: new Float64Array(256), z: new Float64Array(256),
  ox: new Float64Array(256), oy: new Float64Array(256), oz: new Float64Array(256), w: new Float64Array(256),
  cons: [], cols: [], belts: [[], []], cable: [],
  hair: null, mic: null, trails: { mic: [], free: [], hand: [] }, lastPel: null
};
// skirt columns: angle round the waist (pelvis frame, +90 deg = centre front), 14 of them,
// leaving the front opening between the first and the last
const SKIRT_N = 14, SKIRT_Y = 13, SKIRT_OPEN = 0.12;
const SKIRT_RX = 21, SKIRT_RZ = 14.5;
const skirtAngle = k => Math.PI / 2 + SKIRT_OPEN + k * (TAU - 2 * SKIRT_OPEN) / (SKIRT_N - 1);
const CABLE_N = 46, CABLE_SEG = 8.2;
const CABLE_END = V(-290, 0.8, 50);
const BELT_N = 4, BELT_SEG = 6;
const TRAIL_N = 30;

function simP(p, pinned) {
  const i = SIM.n++;
  SIM.x[i] = SIM.ox[i] = p.x; SIM.y[i] = SIM.oy[i] = p.y; SIM.z[i] = SIM.oz[i] = p.z;
  SIM.w[i] = pinned ? 0 : 1;
  return i;
}
function simPin(i, p) { SIM.x[i] = SIM.ox[i] = p.x; SIM.y[i] = SIM.oy[i] = p.y; SIM.z[i] = SIM.oz[i] = p.z; }
function simC(i, j, k, rest) {
  const r = rest !== undefined ? rest : Math.hypot(SIM.x[j] - SIM.x[i], SIM.y[j] - SIM.y[i], SIM.z[j] - SIM.z[i]);
  SIM.cons.push([i, j, r, k]);
}
const simGet = i => V(SIM.x[i], SIM.y[i], SIM.z[i]);

// the microphone: grip in the fist, direction, head and tail of the handle
function micFrame(J, lagDir) {
  const P = J.pose;
  const fore = vnorm(vsub(J.wrM, J.elM));
  const grip = vmad(J.wrM, fore, 6.5);
  const up = vnorm(mapply(J.Rc, V(0.12, 1, 0.3)));
  let d = vnorm(vadd(vmul(fore, 0.5), up));
  if (P.micAim > 0.001) d = vnorm(vlerp(d, vnorm(vsub(J.mouth, grip)), P.micAim));
  if (lagDir) d = lagDir;
  let head = vmad(grip, d, 12), tail = vmad(grip, d, -11);
  const la = P.lasso || 0;
  if (la > 0.001) {
    // let out on its cable and whirled round above the fist, in a plane tipped toward us
    const e = sstep(0, 1, la);
    const tilt = P.lassoTilt;
    const u1 = V(1, 0, 0), u2 = vnorm(V(0, Math.sin(tilt), Math.cos(tilt)));
    const radial = vadd(vmul(u1, Math.cos(P.lassoA)), vmul(u2, Math.sin(P.lassoA)));
    const hub = vadd(grip, V(0, 10, 0));
    const ob = vmad(hub, radial, P.lassoR), oh = vmad(ob, radial, 22);
    tail = vlerp(tail, ob, e); head = vlerp(head, oh, e);
    d = vnorm(vsub(head, tail));
    return { grip, d, head, tail, fore, lasso: e, hub };
  }
  return { grip, d, head, tail, fore, lasso: 0, hub: grip };
}

function skirtRest(J, k) {
  const th = skirtAngle(k);
  const c = Math.cos(th), s = Math.sin(th);
  const Ry = rotYXZ(J.pose.yaw + (J.pose.spin || 0), 0, 0);
  const a = xf(J.pelvis, J.Rp, c * SKIRT_RX, SKIRT_Y, s * SKIRT_RZ);
  return {
    a,
    m: vadd(a, mapply(Ry, V(c * SKIRT_RX * 0.1, -33, s * SKIRT_RZ * 0.1))),
    h: vadd(a, mapply(Ry, V(c * SKIRT_RX * 0.26, -66, s * SKIRT_RZ * 0.24)))
  };
}
const beltAnchor = (J, s) => xf(J.pelvis, J.Rp, 6 + s * 2.5, SKIRT_Y + 1.5, SKIRT_RZ + 1.5);

function simReset(T) {
  SIM.n = 0; SIM.cons = []; SIM.cols = []; SIM.belts = [[], []]; SIM.cable = [];
  const J = solveRig(danceAt(beatAt(T)));
  for (let k = 0; k < SKIRT_N; k++) {
    const r = skirtRest(J, k);
    const col = { k, a: simP(r.a, true), m: simP(r.m, false), h: simP(r.h, false) };
    SIM.cols.push(col);
    simC(col.a, col.m, 1); simC(col.m, col.h, 1);
  }
  for (let k = 0; k < SKIRT_N - 1; k++) {
    simC(SIM.cols[k].m, SIM.cols[k + 1].m, 0.5);
    simC(SIM.cols[k].h, SIM.cols[k + 1].h, 0.5);
  }
  for (let s = 0; s < 2; s++) {
    const a = beltAnchor(J, s);
    const chain = [simP(a, true)];
    for (let k = 1; k <= BELT_N; k++) {
      chain.push(simP(V(a.x + (s - 0.5) * k, a.y - BELT_SEG * k, a.z + 1), false));
      simC(chain[k - 1], chain[k], 1, BELT_SEG * (s ? 1 : 0.8));
    }
    SIM.belts[s] = chain;
  }
  const mf = micFrame(J);
  const c0 = simP(mf.tail, true);
  SIM.cable.push(c0);
  for (let k = 1; k < CABLE_N; k++) {
    const t = k / (CABLE_N - 1);
    const p = vlerp(mf.tail, CABLE_END, t);
    p.y = Math.max(0.8, lerp(mf.tail.y, 0, Math.min(1, t * 3)));
    const i = simP(p, k === CABLE_N - 1);
    simC(SIM.cable[k - 1], i, 1, CABLE_SEG);
    SIM.cable.push(i);
  }
  SIM.hair = { p: xf(J.head, J.Rh, 0, 16, 3), v: V(0, 0, 0), off: V(0, 0, 0) };
  SIM.mic = { p: mf.head, v: V(0, 0, 0), d: mf.d };
  SIM.trails = { mic: [], free: [], hand: [] };
  SIM.lastPel = J.pelvis;
  SIM.t = T; SIM.ready = true;
}

function pushOut(i, A, B, r) {
  const X = SIM.x, Y = SIM.y, Z = SIM.z;
  const abx = B.x - A.x, aby = B.y - A.y, abz = B.z - A.z;
  const apx = X[i] - A.x, apy = Y[i] - A.y, apz = Z[i] - A.z;
  const ab2 = abx * abx + aby * aby + abz * abz || 1e-6;
  const t = clamp((apx * abx + apy * aby + apz * abz) / ab2, 0, 1);
  const dx = X[i] - (A.x + abx * t), dy = Y[i] - (A.y + aby * t), dz = Z[i] - (A.z + abz * t);
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < r && d > 1e-6) { const k = (r - d) / d; X[i] += dx * k; Y[i] += dy * k; Z[i] += dz * k; }
}

function simStep(T) {
  const J = solveRig(danceAt(beatAt(T)));
  // a teleport (the loop point) would fling the cloth about: start again from rest
  if (SIM.lastPel && vdist(SIM.lastPel, J.pelvis) > 40) { simReset(T); return; }
  SIM.lastPel = J.pelvis;
  const dt = SIM.dt, X = SIM.x, Y = SIM.y, Z = SIM.z, OX = SIM.ox, OY = SIM.oy, OZ = SIM.oz, W = SIM.w;
  const rests = [];
  for (const c of SIM.cols) { const r = skirtRest(J, c.k); rests.push(r); simPin(c.a, r.a); }
  for (let s = 0; s < 2; s++) simPin(SIM.belts[s][0], beltAnchor(J, s));
  // the mic follows through on a spring
  const mf0 = micFrame(J);
  const mic = SIM.mic;
  const km = 1500, cm = 2 * 0.32 * Math.sqrt(km);
  if (mf0.lasso > 0.001) {
    mic.p = vmad(mf0.grip, vnorm(vsub(mf0.head, mf0.grip)), 12); mic.v = V(0, 0, 0); mic.d = mf0.d;
  } else {
    mic.v = vadd(mic.v, vmul(vsub(vmul(vsub(mf0.head, mic.p), km), vmul(mic.v, cm)), dt));
    mic.p = vmad(mic.p, mic.v, dt);
    const md = vsub(mic.p, mf0.grip);
    mic.d = vlen(md) > 1e-3 ? vnorm(md) : mf0.d;
  }
  const mf = micFrame(J, mic.d);
  simPin(SIM.cable[0], mf.lasso > 0.001 ? mf.grip : mf.tail);
  // the quiff bounces on its own (exaggerated) spring
  const hair = SIM.hair;
  const ht = xf(J.head, J.Rh, 0, 16, 3);
  const kh = 620, ch = 2 * 0.2 * Math.sqrt(kh);
  hair.v = vadd(hair.v, vmul(vsub(vmul(vsub(ht, hair.p), kh), vmul(hair.v, ch)), dt));
  hair.p = vmad(hair.p, hair.v, dt);
  hair.off = vsub(hair.p, ht);
  // integrate
  const g = -980 * dt * dt;
  for (let i = 0; i < SIM.n; i++) {
    if (!W[i]) continue;
    const damp = 0.988;
    const vx = (X[i] - OX[i]) * damp, vy = (Y[i] - OY[i]) * damp, vz = (Z[i] - OZ[i]) * damp;
    OX[i] = X[i]; OY[i] = Y[i]; OZ[i] = Z[i];
    X[i] += vx; Y[i] += vy + g; Z[i] += vz;
  }
  // the skirt keeps a little of its flare
  for (let k = 0; k < SIM.cols.length; k++) {
    const c = SIM.cols[k], r = rests[k];
    X[c.m] += (r.m.x - X[c.m]) * 0.03; Y[c.m] += (r.m.y - Y[c.m]) * 0.03; Z[c.m] += (r.m.z - Z[c.m]) * 0.03;
    X[c.h] += (r.h.x - X[c.h]) * 0.016; Y[c.h] += (r.h.y - Y[c.h]) * 0.016; Z[c.h] += (r.h.z - Z[c.h]) * 0.016;
  }
  const legs = [[J.hipL, J.knL, 10.5], [J.knL, J.anL, 8.5], [J.hipR, J.knR, 10.5], [J.knR, J.anR, 8.5], [J.hipL, J.hipR, 12]];
  for (let it = 0; it < 6; it++) {
    for (let q = 0; q < SIM.cons.length; q++) {
      const cc = SIM.cons[q], i = cc[0], j = cc[1];
      const wi = W[i], wj = W[j], ws = wi + wj;
      if (!ws) continue;
      const dx = X[j] - X[i], dy = Y[j] - Y[i], dz = Z[j] - Z[i];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const diff = (d - cc[2]) / d * cc[3] / ws;
      X[i] += dx * diff * wi; Y[i] += dy * diff * wi; Z[i] += dz * diff * wi;
      X[j] -= dx * diff * wj; Y[j] -= dy * diff * wj; Z[j] -= dz * diff * wj;
    }
    if (it % 2 === 1) {
      for (const c of SIM.cols) for (const L of legs) { pushOut(c.m, L[0], L[1], L[2]); pushOut(c.h, L[0], L[1], L[2]); }
      for (const b of SIM.belts) for (let k = 1; k < b.length; k++) for (const L of legs) pushOut(b[k], L[0], L[1], L[2] - 1);
    }
    const floor = J.pelvis.y < 60 ? -1e9 : 0.8;   // under the river there is no floor
    for (let i = 0; i < SIM.n; i++) if (W[i] && Y[i] < floor) {
      Y[i] = floor;
      X[i] = lerp(X[i], OX[i], 0.35); Z[i] = lerp(Z[i], OZ[i], 0.35);
    }
  }
  const tr = SIM.trails;
  tr.mic.push(mf.head); if (tr.mic.length > TRAIL_N) tr.mic.shift();
  const fore = vnorm(vsub(J.wrF, J.elF));
  tr.free.push(vmad(J.wrF, fore, 7)); if (tr.free.length > TRAIL_N) tr.free.shift();
  tr.hand.push(mf.grip); if (tr.hand.length > TRAIL_N) tr.hand.shift();
}

function simAdvance(T) {
  if (!SIM.ready || T < SIM.t - 1e-6 || T - SIM.t > 2.5) simReset(T - 2.0);
  let steps = 0;
  while (SIM.t + SIM.dt <= T + 1e-9 && steps < 900) { SIM.t += SIM.dt; simStep(SIM.t); steps++; }
}
