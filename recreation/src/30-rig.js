// ============================================================================
// Skeleton: pose parameters -> 3D joints (cm, floor at y = 0, facing +z).
// Sides are named by where they fall on screen when he faces us:
//   M = the microphone arm (his right, screen left), F = the free arm,
//   L = the screen-left leg, R = the screen-right leg.
// ============================================================================
const BODY = {
  hip: 98, waist: 14, chest: 24, neck: 13,
  shoulderX: 19, shoulderY: -2.5,
  upperArm: 29, foreArm: 26.5,
  hipX: 9.5, hipY: -4, thigh: 44, shin: 42
};

function pose0() {
  return {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0,
    spin: 0, croot: 0, rootY: 100,
    cyaw: 0, cpitch: 0.03, croll: 0,
    hyaw: 0, hpitch: 0, hroll: 0,
    shM: 0, shF: 0,
    mx: -21, my: -38, mz: 10, mPole: 0,
    fx: 21, fy: -38, fz: 10, fPole: 0,
    fOpen: 0.3, fPoint: 0, fSnap: 0, fPalm: 0, fHip: 0,
    micAim: 0, lasso: 0, lassoA: 0, lassoR: 34, lassoTilt: 0.35,
    lfx: -14, lfz: 2, lfy: 0, lheel: 0, lfyaw: -0.2,
    rfx: 14, rfz: 2, rfy: 0, rheel: 0, rfyaw: 0.2,
    lkx: -0.3, rkx: 0.3, feetRel: 0,
    squash: 0,
    mouth: 0, smile: 0.6, brow: 0, blink: 0, wink: 0, lookX: 0, lookY: 0, eyeWide: 0,
    hat: 0, hatLift: 0
  };
}
function poseLerp(a, b, t) {
  const r = {};
  for (const k in a) r[k] = a[k] + (b[k] - a[k]) * t;
  return r;
}
function poseScale(P, k) {  // exaggerate a pose about the rest pose (for the dancing shadows)
  const Z = pose0();
  return poseLerp(Z, P, k);
}

// two-bone IK: root A, target T, bone lengths l1, l2, pole direction
function ik2(A, Tg, l1, l2, pole) {
  const d = vsub(Tg, A);
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

function footPts(x, y0, z, lift, heel, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const y = y0 + lift;
  return {
    ankle: V(x - fx * 8, y + 8.5 + heel * 0.85, z - fz * 8 + heel * 0.2),
    heel: V(x - fx * 12, y + 3 + heel, z - fz * 12),
    ball: V(x + fx * 4, y + 1.5, z + fz * 4),
    toe: V(x + fx * 12, y + 2.3, z + fz * 12),
    dir: V(fx, 0, fz)
  };
}

function solveRig(P) {
  const J = {};
  const pel = V(P.x, BODY.hip + P.y, P.z);
  const Rp = rotYXZ(P.yaw, P.pitch, P.roll);
  const Rw = mmul(Rp, rotYXZ(P.cyaw * 0.5, P.cpitch * 0.5, P.croll * 0.5));
  const Rc = mmul(Rp, rotYXZ(P.cyaw, P.cpitch, P.croll));
  J.pelvis = pel; J.Rp = Rp; J.Rw = Rw; J.Rc = Rc;
  J.waist = xf(pel, Rp, 0, BODY.waist, 0);
  J.chest = xf(J.waist, Rw, 0, BODY.chest, 0);
  J.neck = xf(J.chest, Rc, 0, BODY.neck, -1);
  const Rn = mmul(Rc, rotYXZ(P.hyaw * 0.4, P.hpitch * 0.4 + 0.04, P.hroll * 0.4));
  const Rh = mmul(Rc, rotYXZ(P.hyaw, P.hpitch, P.hroll));
  J.Rh = Rh; J.Rn = Rn;
  J.neckTop = xf(J.neck, Rn, 0, 7, 1.2);
  J.head = xf(J.neckTop, Rh, 0, 10.5, 0.6);
  J.shM = xf(J.neck, Rc, -BODY.shoulderX, BODY.shoulderY + P.shM, -1);
  J.shF = xf(J.neck, Rc, BODY.shoulderX, BODY.shoulderY + P.shF, -1);
  const tM = xf(J.chest, Rc, P.mx, P.my, P.mz);
  const tF = xf(J.chest, Rc, P.fx, P.fy, P.fz);
  const poleM = mapply(Rc, vnorm(V(-0.85, -0.55, -0.35 + P.mPole)));
  const poleF = mapply(Rc, vnorm(V(0.85, -0.55, -0.35 + P.fPole)));
  let a = ik2(J.shM, tM, BODY.upperArm, BODY.foreArm, poleM); J.elM = a.E; J.wrM = a.T;
  a = ik2(J.shF, tF, BODY.upperArm, BODY.foreArm, poleF); J.elF = a.E; J.wrF = a.T;
  J.hipL = xf(pel, Rp, -BODY.hipX, BODY.hipY, 0);
  J.hipR = xf(pel, Rp, BODY.hipX, BODY.hipY, 0);
  // feet: planted on the floor in world space, or carried with the pelvis (jumps)
  const rel = P.feetRel;
  const fl = footPts(P.lfx + P.x * rel, (pel.y - BODY.hip) * rel, P.lfz + P.z * rel, P.lfy, P.lheel, P.lfyaw);
  const fr = footPts(P.rfx + P.x * rel, (pel.y - BODY.hip) * rel, P.rfz + P.z * rel, P.rfy, P.rheel, P.rfyaw);
  a = ik2(J.hipL, fl.ankle, BODY.thigh, BODY.shin, mapply(Rp, V(P.lkx, 0, 1))); J.knL = a.E; J.anL = a.T; J.footL = fl;
  a = ik2(J.hipR, fr.ankle, BODY.thigh, BODY.shin, mapply(Rp, V(P.rkx, 0, 1))); J.knR = a.E; J.anR = a.T; J.footR = fr;
  J.mouth = xf(J.head, Rh, 0, -6.4, 10);
  // whole-body turn (skater's spin) and roll (cartwheels) about a pivot above the pelvis
  if (P.spin || P.croot) {
    const piv = V(pel.x, P.rootY, pel.z);
    const Rr = rotYXZ(P.spin, 0, P.croot);
    const tp = p => vadd(piv, mapply(Rr, vsub(p, piv)));
    for (const k of ['pelvis', 'waist', 'chest', 'neck', 'neckTop', 'head', 'shM', 'shF', 'elM', 'elF', 'wrM', 'wrF',
      'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'mouth']) J[k] = tp(J[k]);
    for (const k of ['footL', 'footR']) {
      const f = J[k];
      J[k] = { ankle: tp(f.ankle), heel: tp(f.heel), ball: tp(f.ball), toe: tp(f.toe), dir: mapply(Rr, f.dir) };
    }
    for (const k of ['Rp', 'Rw', 'Rc', 'Rh', 'Rn']) J[k] = mmul(Rr, J[k]);
  }
  J.pose = P;
  return J;
}
// is point p on the camera side of the body's frontal plane?
const facing = (J, R, cam) => vdot(mapply(R, V(0, 0, 1)), vnorm(vsub(cam.pos, J.chest)));
