// ============================================================
// Secondary motion: coat skirt, belt ends, mic cable, quiff and mic follow-through.
// Fixed 120 Hz verlet, deterministic from a pre-roll, so any frame can be reproduced.
// ============================================================
const SIM = {
  dt: 1 / 120, t: 0, ready: false, n: 0,
  x: new Float64Array(160), y: new Float64Array(160), z: new Float64Array(160),
  ox: new Float64Array(160), oy: new Float64Array(160), oz: new Float64Array(160), w: new Float64Array(160),
  cons: [], cols: [], belts: [[], []], cable: [],
  hair: null, mic: null, trails: {}
};
const COAT_COLS = [
  { x: -8.5, z: 13.5, panel: 0 }, { x: -16, z: 11, panel: 0 }, { x: -22.5, z: 2, panel: 0 },
  { x: 8.5, z: 13.5, panel: 1 }, { x: 16, z: 11, panel: 1 }, { x: 22.5, z: 2, panel: 1 },
  { x: -20.5, z: -9, panel: 2 }, { x: -7, z: -13.5, panel: 2 }, { x: 7, z: -13.5, panel: 2 }, { x: 20.5, z: -9, panel: 2 }
];
const SKIRT_Y = 12;
const CABLE_N = 44, CABLE_SEG = 8.2;
const CABLE_END = V(-265, 0.8, 45);
const BELT_N = 4, BELT_SEG = 5.8;
const TRAIL_N = 30;

// piece time for the choreography: the intro runs at negative times, then everything loops
const pieceT = T => (T < 0 ? T : modT(T));

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

function micFrame(J, lagDir) {
  const fore = vnorm(vsub(J.wrM, J.elM));
  const grip = vmad(J.wrM, fore, 6.5);
  const up = vnorm(mv(J.Rc, V(0.12, 1, 0.3)));
  let d = vnorm(vadd(vmul(fore, 0.5), up));
  const ps = J.pose;
  if (ps.micAim > 0.001) d = vnorm(vlerp(d, vnorm(vsub(J.mouth, grip)), ps.micAim));
  if (lagDir) d = lagDir;
  let head = vmad(grip, d, 12), bottom = vmad(grip, d, -11);
  const tw = ps.twirl || 0;
  if (tw > 0.001) {
    // released on its cable: orbit around the fist in a plane facing the camera
    const e = smoothstep(0, 1, tw);
    const u1 = V(-1, 0, 0), u2 = vnorm(V(0, 1, 0.3));
    const radial = vadd(vmul(u1, Math.cos(ps.twA)), vmul(u2, Math.sin(ps.twA)));
    const ob = vmad(grip, radial, 36), oh = vmad(ob, radial, 23);
    bottom = vlerp(bottom, ob, e); head = vlerp(head, oh, e);
    d = vnorm(vsub(head, bottom));
    return { grip, d, head, bottom, fore, lasso: e };
  }
  return { grip, d, head, bottom, fore, lasso: 0 };
}

function coatRest(J, c) {
  const Ry = rotYXZ(J.pose.pyaw, 0, 0);
  const a = xf(J.pelvis, J.Rp, c.x, SKIRT_Y, c.z);
  return {
    a,
    m: vadd(a, mv(Ry, V(c.x * 0.1, -33, c.z * 0.08))),
    h: vadd(a, mv(Ry, V(c.x * 0.3, -66.5, c.z * 0.24)))
  };
}

function simReset(t0) {
  SIM.n = 0; SIM.cons = []; SIM.cols = []; SIM.belts = [[], []]; SIM.cable = [];
  const J = solveRig(danceAt(pieceT(t0)));
  for (const c of COAT_COLS) {
    const r = coatRest(J, c);
    const col = { x: c.x, z: c.z, panel: c.panel, a: simP(r.a, true), m: simP(r.m, false), h: simP(r.h, false) };
    SIM.cols.push(col);
    simC(col.a, col.m, 1); simC(col.m, col.h, 1);
  }
  const link = (i, j, k) => { simC(SIM.cols[i].m, SIM.cols[j].m, k); simC(SIM.cols[i].h, SIM.cols[j].h, k); };
  link(0, 1, 0.6); link(1, 2, 0.6); link(3, 4, 0.6); link(4, 5, 0.6);
  link(6, 7, 0.6); link(7, 8, 0.6); link(8, 9, 0.6); link(2, 6, 0.35); link(5, 9, 0.35);
  // belt ends hanging from the side loops
  for (let s = 0; s < 2; s++) {
    const sg = s === 0 ? -1 : 1;
    const a = xf(J.pelvis, J.Rp, sg * 21, 11, -4);
    const chain = [simP(a, true)];
    for (let k = 1; k <= BELT_N; k++) { chain.push(simP(V(a.x + sg * 0.5 * k, a.y - BELT_SEG * k, a.z + 1), false)); simC(chain[k - 1], chain[k], 1, BELT_SEG); }
    SIM.belts[s] = chain;
  }
  // microphone cable from the handle to a pin on the floor, off stage left
  const mf = micFrame(J);
  const c0 = simP(mf.bottom, true);
  SIM.cable.push(c0);
  for (let k = 1; k < CABLE_N; k++) {
    const t = k / (CABLE_N - 1);
    const p = vlerp(mf.bottom, CABLE_END, t);
    p.y = Math.max(0.8, lerp(mf.bottom.y, 0, Math.min(1, t * 3)));
    const i = simP(p, k === CABLE_N - 1);
    simC(SIM.cable[k - 1], i, 1, CABLE_SEG);
    SIM.cable.push(i);
  }
  const hairT = xf(J.head, J.Rh, 0, 16, 3);
  SIM.hair = { p: hairT, v: V(0, 0, 0), off: V(0, 0, 0) };
  SIM.mic = { p: mf.head, v: V(0, 0, 0), d: mf.d };
  SIM.trails = { mic: [], free: [], hand: [] };
  SIM.t = t0; SIM.ready = true;
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
  const J = solveRig(danceAt(pieceT(T)));
  const dt = SIM.dt, X = SIM.x, Y = SIM.y, Z = SIM.z, OX = SIM.ox, OY = SIM.oy, OZ = SIM.oz, W = SIM.w;
  const floor = Math.min(0.8, J.ground + 0.8);
  // pinned anchors
  const rests = [];
  for (const c of SIM.cols) { const r = coatRest(J, c); rests.push(r); simPin(c.a, r.a); }
  for (let s = 0; s < 2; s++) simPin(SIM.belts[s][0], xf(J.pelvis, J.Rp, (s === 0 ? -1 : 1) * 21, 11, -4));
  // mic follow-through spring
  const mf0 = micFrame(J);
  const mic = SIM.mic;
  const tgt = mf0.head;
  const km = 1500, cm = 2 * 0.32 * Math.sqrt(km);
  if (mf0.lasso > 0.001) {
    mic.p = vmad(mf0.grip, vnorm(vsub(tgt, mf0.grip)), 12); mic.v = V(0, 0, 0); mic.d = mf0.d;
  } else {
    mic.v = vadd(mic.v, vmul(vsub(vmul(vsub(tgt, mic.p), km), vmul(mic.v, cm)), dt));
    mic.p = vmad(mic.p, mic.v, dt);
    const md = vsub(mic.p, mf0.grip);
    mic.d = vlen(md) > 1e-3 ? vnorm(md) : mf0.d;
  }
  const mf = micFrame(J, mic.d);
  simPin(SIM.cable[0], mf.lasso > 0.001 ? mf.grip : mf.bottom);
  // quiff spring (exaggerated bounce)
  const hair = SIM.hair;
  const ht = xf(J.head, J.Rh, 0, 16, 3);
  const kh = 650, ch = 2 * 0.2 * Math.sqrt(kh);
  hair.v = vadd(hair.v, vmul(vsub(vmul(vsub(ht, hair.p), kh), vmul(hair.v, ch)), dt));
  hair.p = vmad(hair.p, hair.v, dt);
  hair.off = vsub(hair.p, ht);
  // verlet integrate
  const g = -980 * dt * dt;
  for (let i = 0; i < SIM.n; i++) {
    if (!W[i]) continue;
    const damp = 0.988;
    const vx = (X[i] - OX[i]) * damp, vy = (Y[i] - OY[i]) * damp, vz = (Z[i] - OZ[i]) * damp;
    OX[i] = X[i]; OY[i] = Y[i]; OZ[i] = Z[i];
    X[i] += vx; Y[i] += vy + g; Z[i] += vz;
  }
  // coat keeps its flare
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
    for (let i = 0; i < SIM.n; i++) if (W[i] && Y[i] < floor) {
      Y[i] = floor;
      X[i] = lerp(X[i], OX[i], 0.35); Z[i] = lerp(Z[i], OZ[i], 0.35);
    }
  }
  // trails for smear strokes
  const tr = SIM.trails;
  tr.mic.push(mf.head); if (tr.mic.length > TRAIL_N) tr.mic.shift();
  const fore = vnorm(vsub(J.wrF, J.elF));
  tr.free.push(vmad(J.wrF, fore, 7)); if (tr.free.length > TRAIL_N) tr.free.shift();
  tr.hand.push(mf.grip); if (tr.hand.length > TRAIL_N) tr.hand.shift();
}

function simAdvance(tAbs) {
  if (!SIM.ready || tAbs < SIM.t - 1e-6 || tAbs - SIM.t > 2.5) simReset(tAbs - 2.0);
  let steps = 0;
  while (SIM.t + SIM.dt <= tAbs + 1e-9 && steps < 800) { simStep(SIM.t + SIM.dt); SIM.t += SIM.dt; steps++; }
}
