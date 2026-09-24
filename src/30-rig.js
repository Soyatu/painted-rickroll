// ============================================================
// Skeleton: pose parameters -> 3D joints (units: cm, floor at y = 0)
// "M" = the microphone arm (his right, screen left), "F" = free arm (his left, screen right)
// ============================================================
const RIG = {
  pelvisY: 98, waistLen: 14, chestLen: 24, neckLen: 14,
  shoulderX: 19, upperArm: 29, foreArm: 26.5,
  hipX: 9.5, hipY: -4, thigh: 44, shin: 42
};

function basePose() {
  return {
    px: 0, py: -2.5, pz: 0, pyaw: 0, ppitch: 0, proll: 0,
    ry: 0,                                   // lifts the whole body (feet included): river, jumps
    cyaw: 0, cpitch: 0.03, croll: 0,
    hyaw: 0, hpitch: 0, hroll: 0,
    shM: 0, shF: 0,
    mX: -20, mY: -30, mZ: 14, mPole: 0,
    fX: 20, fY: -30, fZ: 14, fPole: 0,
    fOpen: 0, fPoint: 0, micAim: 0,
    lfx: -15, lfz: 2, lfy: 0, lheel: 0, lfyaw: -0.22,
    rfx: 15, rfz: 2, rfy: 0, rheel: 0, rfyaw: 0.22,
    lkx: -0.3, rkx: 0.3, squash: 0, twirl: 0, twA: 0,
    mouth: 0, smile: 0.5, brow: 0, blink: 0, wink: 0, mO: 0,
    flip: 0, hat: 0, hatLift: 0              // shadow-only tricks
  };
}
function lerpPose(a, b, t) {
  const r = {};
  for (const k in a) r[k] = a[k] + (b[k] - a[k]) * t;
  return r;
}

function ik2(A, T, l1, l2, pole) {
  const d = vsub(T, A);
  let dist = vlen(d);
  const dir = dist > 1e-6 ? vmul(d, 1 / dist) : V(0, -1, 0);
  dist = clamp(dist, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.05);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let pp = vsub(pole, vmul(dir, vdot(pole, dir)));
  let pl = vlen(pp);
  if (pl < 1e-5) { pp = vsub(V(0, 0, 1), vmul(dir, dir.z)); pl = vlen(pp) || 1; }
  pp = vmul(pp, 1 / pl);
  const E = vadd(A, vadd(vmul(dir, cosA * l1), vmul(pp, sinA * l1)));
  return { E, T: vadd(A, vmul(dir, dist)) };
}

function footPts(x, z, lift, heel, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return {
    ankle: V(x - fx * 8, 8.5 + lift + heel * 0.85, z - fz * 8 + heel * 0.2),
    heel: V(x - fx * 12, 3 + lift + heel, z - fz * 12),
    ball: V(x + fx * 4, 1.5 + lift, z + fz * 4),
    toe: V(x + fx * 11, 2.5 + lift, z + fz * 11)
  };
}

function solveRig(ps) {
  const J = {};
  const pel = V(ps.px, RIG.pelvisY + ps.py + ps.ry, ps.pz);
  const Rp = rotYXZ(ps.pyaw, ps.ppitch, ps.proll);
  const Rw = mm(Rp, rotYXZ(ps.cyaw * 0.5, ps.cpitch * 0.5, ps.croll * 0.5));
  const Rc = mm(Rp, rotYXZ(ps.cyaw, ps.cpitch, ps.croll));
  J.pelvis = pel; J.Rp = Rp; J.Rw = Rw; J.Rc = Rc;
  J.waist = xf(pel, Rp, 0, RIG.waistLen, 0);
  J.chest = xf(J.waist, Rw, 0, RIG.chestLen, 0);
  J.neck = xf(J.chest, Rc, 0, RIG.neckLen, -1);
  const Rn = mm(Rc, rotYXZ(ps.hyaw * 0.4, ps.hpitch * 0.4 + 0.04, ps.hroll * 0.4));
  const Rh = mm(Rc, rotYXZ(ps.hyaw, ps.hpitch, ps.hroll));
  J.Rh = Rh;
  J.neckTop = xf(J.neck, Rn, 0, 7, 1.2);
  J.head = xf(J.neckTop, Rh, 0, 10.5, 0.5);
  J.shM = xf(J.neck, Rc, -RIG.shoulderX, -3 + ps.shM, -1);
  J.shF = xf(J.neck, Rc, RIG.shoulderX, -3 + ps.shF, -1);
  const tM = xf(J.chest, Rc, ps.mX, ps.mY, ps.mZ);
  const tF = xf(J.chest, Rc, ps.fX, ps.fY, ps.fZ);
  const poleM = mv(Rc, vnorm(V(-0.85, -0.55, -0.35 + ps.mPole)));
  const poleF = mv(Rc, vnorm(V(0.85, -0.55, -0.35 + ps.fPole)));
  let a = ik2(J.shM, tM, RIG.upperArm, RIG.foreArm, poleM); J.elM = a.E; J.wrM = a.T;
  a = ik2(J.shF, tF, RIG.upperArm, RIG.foreArm, poleF); J.elF = a.E; J.wrF = a.T;
  J.hipL = xf(pel, Rp, -RIG.hipX, RIG.hipY, 0);
  J.hipR = xf(pel, Rp, RIG.hipX, RIG.hipY, 0);
  const fl = footPts(ps.lfx, ps.lfz, ps.lfy + ps.ry, ps.lheel, ps.lfyaw);
  const fr = footPts(ps.rfx, ps.rfz, ps.rfy + ps.ry, ps.rheel, ps.rfyaw);
  // knees point where the body points (matters when he spins)
  const Ry = rotYXZ(ps.pyaw, 0, 0);
  a = ik2(J.hipL, fl.ankle, RIG.thigh, RIG.shin, mv(Ry, V(ps.lkx, 0, 1))); J.knL = a.E; J.anL = a.T; J.footL = fl;
  a = ik2(J.hipR, fr.ankle, RIG.thigh, RIG.shin, mv(Ry, V(ps.rkx, 0, 1))); J.knR = a.E; J.anR = a.T; J.footR = fr;
  // mouth point (for the microphone to aim at) in head space
  J.mouth = xf(J.head, Rh, 0, -6.4, 10);
  J.ground = ps.ry;
  J.pose = ps;
  return J;
}
