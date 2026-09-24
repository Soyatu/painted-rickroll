// ============================================================
// Cameras and projection. A camera may carry a 2D "view" (scale + offset in device px)
// applied after projection: that is how the pop-art panel and the gallery frame shrink
// the whole painting without re-framing it.
// ============================================================
const WALL_Z = -150;
const CAM_DIST = 560;
const IDENT_VIEW = { s: 1, ox: 0, oy: 0 };

function makeCam(pos, target, fovY, roll, view) {
  const f = vnorm(vsub(target, pos));
  const r = vnorm(vcross(f, V(0, 1, 0)));
  const u = vcross(r, f);
  const c = Math.cos(roll), s = Math.sin(roll);
  return {
    pos, f, r: vadd(vmul(r, c), vmul(u, s)), u: vsub(vmul(u, c), vmul(r, s)),
    focal: (CH / 2) / Math.tan(fovY / 2), cx: CW / 2, cy: CH / 2, view: view || IDENT_VIEW
  };
}
const withView = (cam, view) => Object.assign({}, cam, { view });
function project(cam, p) {
  const dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
  const x = dx * cam.r.x + dy * cam.r.y + dz * cam.r.z;
  const y = dx * cam.u.x + dy * cam.u.y + dz * cam.u.z;
  const z = Math.max(1, dx * cam.f.x + dy * cam.f.y + dz * cam.f.z);
  const s = cam.focal / z;
  const v = cam.view;
  return { x: (cam.cx + x * s) * v.s + v.ox, y: (cam.cy - y * s) * v.s + v.oy, s: s * v.s };
}
// shadow of p cast by a point light onto the floor (y=0) or the back wall
function shadowPoint(Lp, p) {
  const d = vsub(p, Lp);
  let tb = Infinity;
  if (d.z < -1e-4) { const t = (WALL_Z + 0.5 - Lp.z) / d.z; if (t > 1) tb = t; }
  if (d.y < -1e-4) { const t = (0.3 - Lp.y) / d.y; if (t > 1 && t < tb) tb = t; }
  if (!isFinite(tb)) tb = 1;
  return { p: vmad(Lp, d, tb), t: tb };
}
function projectShadow(cam, Lp, p, lean) {
  const sp = shadowPoint(Lp, p);
  if (lean && sp.p.y > 0.5) sp.p.x += lean * sp.p.y;   // pivot about the floor line
  const q = project(cam, sp.p);
  q.s *= sp.t;
  return q;
}
// GPU view-projection matrix for the static world strokes, including the 2D view
function camVP(cam) {
  const sx = 2 * cam.focal / CW, sy = 2 * cam.focal / CH;
  const r = cam.r, u = cam.u, f = cam.f, p = cam.pos;
  const tr = -vdot(r, p), tu = -vdot(u, p), tf = -vdot(f, p);
  const M = new Float32Array([
    sx * r.x, sy * u.x, 0.5 * f.x, f.x,
    sx * r.y, sy * u.y, 0.5 * f.y, f.y,
    sx * r.z, sy * u.z, 0.5 * f.z, f.z,
    sx * tr, sy * tu, 0.5 * tf, tf
  ]);
  const v = cam.view;
  if (v.s !== 1 || v.ox || v.oy) {
    const ax = v.s - 1 + 2 * v.ox / CW, ay = 1 - v.s - 2 * v.oy / CH;
    for (let c = 0; c < 4; c++) {
      M[c * 4] = v.s * M[c * 4] + ax * M[c * 4 + 3];
      M[c * 4 + 1] = v.s * M[c * 4 + 1] + ay * M[c * 4 + 3];
    }
  }
  return M;
}
// where a camera ray through p meets the plane z = zPlane (for putting things "behind" p)
function rayToPlaneZ(cam, p, zPlane) {
  const d = vsub(p, cam.pos);
  const t = (zPlane - cam.pos.z) / (d.z || -1e-6);
  return vmad(cam.pos, d, t);
}
