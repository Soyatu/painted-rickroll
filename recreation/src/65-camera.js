// ============================================================================
// Cameras: a pinhole looking from pos at target, projecting to the render size.
// ============================================================================
function makeCam(pos, target, fovY, roll, rw, rh) {
  const f = vnorm(vsub(target, pos));
  let r = vcross(f, V(0, 1, 0));
  if (vlen(r) < 1e-6) r = V(1, 0, 0);
  r = vnorm(r);
  const u = vcross(r, f);
  const c = Math.cos(roll || 0), s = Math.sin(roll || 0);
  rw = rw || G.rw; rh = rh || G.rh;
  return {
    pos, target, f, r: vadd(vmul(r, c), vmul(u, s)), u: vsub(vmul(u, c), vmul(r, s)),
    focal: (rh / 2) / Math.tan(fovY / 2), cx: rw / 2, cy: rh / 2, rw, rh, fovY
  };
}
// a camera framing `viewH` cm of height at the target from distance `dist`
function frameCam(target, viewH, dist, opts) {
  opts = opts || {};
  const fov = 2 * Math.atan((viewH / 2) / dist);
  const dir = opts.dir || V(0, 0, 1);
  const pos = vadd(target, vmul(vnorm(dir), dist));
  if (opts.lift) pos.y += opts.lift;
  if (opts.dx) pos.x += opts.dx;
  return makeCam(pos, target, fov, opts.roll || 0, opts.rw, opts.rh);
}
function project(cam, p) {
  const dx = p.x - cam.pos.x, dy = p.y - cam.pos.y, dz = p.z - cam.pos.z;
  const x = dx * cam.r.x + dy * cam.r.y + dz * cam.r.z;
  const y = dx * cam.u.x + dy * cam.u.y + dz * cam.u.z;
  const z = Math.max(1, dx * cam.f.x + dy * cam.f.y + dz * cam.f.z);
  const s = cam.focal / z;
  return { x: cam.cx + x * s, y: cam.cy - y * s, s, z, wy: p.y };
}
// world -> clip, column-major, for the GPU-projected world strokes
function camVP(cam) {
  const sx = 2 * cam.focal / cam.rw, sy = 2 * cam.focal / cam.rh;
  const r = cam.r, u = cam.u, f = cam.f, p = cam.pos;
  const tr = -vdot(r, p), tu = -vdot(u, p), tf = -vdot(f, p);
  return new Float32Array([
    sx * r.x, sy * u.x, 0.5 * f.x, f.x,
    sx * r.y, sy * u.y, 0.5 * f.y, f.y,
    sx * r.z, sy * u.z, 0.5 * f.z, f.z,
    sx * tr, sy * tu, 0.5 * tf, tf
  ]);
}
// shadow of p cast by a point light onto the floor (y = 0) or a back wall (z = wallZ)
function shadowPoint(Lp, p, wallZ) {
  const d = vsub(p, Lp);
  let tb = Infinity;
  if (d.z < -1e-4) { const t = (wallZ + 0.5 - Lp.z) / d.z; if (t > 1) tb = t; }
  if (d.y < -1e-4) { const t = (0.3 - Lp.y) / d.y; if (t > 1 && t < tb) tb = t; }
  if (!isFinite(tb)) tb = 1;
  return { p: vmad(Lp, d, tb), t: tb };
}
function projectShadow(cam, Lp, p, wallZ, lean) {
  const sp = shadowPoint(Lp, p, wallZ);
  if (lean && sp.p.y > 0.5) sp.p.x += lean * sp.p.y;
  const q = project(cam, sp.p);
  q.s *= sp.t;
  return q;
}
// GL-pixel ellipse (y up) of a light pool around world point c with radius r cm
function poolAt(cam, c, rx, ry) {
  const q = project(cam, c);
  return [q.x, cam.rh - q.y, rx * q.s, (ry || rx) * q.s];
}
