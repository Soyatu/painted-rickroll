// ============================================================================
// Scenes: each paints one world into a scene image (OUT slot). The running
// order below decides which scenes a frame needs and how the final pass joins them.
// ============================================================================
const STATIC = {};
function sceneStatic(S) {
  // the gallery's frames follow the screen's shape, so it is rebuilt when that changes
  const key = S.name + (S.name === 'gallery' ? ':' + (CW / CH).toFixed(3) : '');
  if (!STATIC[key]) {
    const B = new StrokeBuf(true), pb = G.buf, pm = G.mode;
    G.buf = B; G.mode = 'paint';
    S.build();
    G.buf = pb; G.mode = pm;
    STATIC[key] = B;
  }
  return STATIC[key];
}
const bufDyn = new StrokeBuf(), bufSH = new StrokeBuf(), bufFG = new StrokeBuf(), bufOV = new StrokeBuf();
const FRAME = { t: 0, b: 0, J: null, stats: {} };

// a copy of the pose a touch late and bigger: the shadows dance with more swagger than the man
function shadowRig(b, k) {
  return solveRig(poseScale(danceAt(b - 0.1), k || 1.3));
}

function renderScene(S, b, t, slot, opts) {
  opts = opts || {};
  const scale = opts.scale || 1;
  const RW = Math.max(16, Math.round(CW * scale)), RH = Math.max(16, Math.round(CH * scale));
  G.rw = RW; G.rh = RH; G.rs = scale;
  const J = FRAME.J;
  const cam = S.camera(b, t, J, opts);
  G.cam = cam;
  const L = S.lights(b, t, J, cam, opts);
  G.key = L.key; G.rim = L.rim; G.amb = L.amb;
  G.t = t; G.b = b; G.anim = null; G.flags = 0;
  const boilBG = Math.floor(t * (REDUCED ? 2 : 6)), boilFG = Math.floor(t * (REDUCED ? 4 : 12));
  // background: the static set, then the moving scenery
  G.mode = 'paint';
  const bs = sceneStatic(S);
  glDrawStrokes(bs, T.BG, { world: true, vp: camVP(cam), boil: boilBG, jit: L.bgJit !== undefined ? L.bgJit : 0.6, time: t, w: RW, h: RH, stir: L.stir });
  G.buf = bufDyn; bufDyn.reset(); G.boil = boilBG; G.jit = 0.5; G.proj = p => project(cam, p);
  if (S.dynamic) S.dynamic(b, t, J, cam, L, opts);
  glDrawStrokes(bufDyn, T.BG, { noClear: true, time: t, w: RW, h: RH });
  // shadow masks, one channel per light
  G.buf = bufSH; bufSH.reset(); G.mode = 'mask'; G.boil = boilFG;
  if (L.shadows && L.shadows.length && S.figure(b, opts)) {
    L.shadows.forEach((sh, i) => {
      G.maskCol = [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
      G.proj = sh.proj;
      drawSilhouette(sh.J, sh.opts);
    });
  }
  glDrawStrokes(bufSH, T.SH, { mode: 1, time: t, w: RW, h: RH, vw: Math.ceil(RW / 2), vh: Math.ceil(RH / 2) });
  // the dancer
  G.buf = bufFG; bufFG.reset(); G.mode = 'paint'; G.boil = boilFG; G.jit = REDUCED ? 0.35 : 0.7;
  const sq = J.pose.squash * (dip(b) - 0.25);
  const sx = 1 + sq * 0.7, sy = 1 - sq, bx = J.pelvis.x, bz = J.pelvis.z;
  G.proj = p => project(cam, V(bx + (p.x - bx) * sx, p.y * sy, bz + (p.z - bz) * sx));
  if (S.figure(b, opts)) {
    if (L.clip) G.flags = FLAG_CLIP;
    drawFigure(J, opts);
    G.flags = 0;
  }
  if (S.overFigure) S.overFigure(b, t, J, cam, L, opts);
  glDrawStrokes(bufFG, T.FG, { time: t, w: RW, h: RH, clip: L.clip });
  glSceneComposite(slot, L.comp, RW, RH);
  FRAME.stats.strokes = (FRAME.stats.strokes || 0) + bs.count + bufDyn.count + bufSH.count + bufFG.count;
  return { cam, RW, RH, scale };
}

// ---------------------------------------------------------------- the arch
const S_ARCH = {
  name: 'arch',
  build: buildArch,
  figure: () => true,
  camera(b, t, J) {
    const keys = [[16, 236, 104], [18, 250, 102], [23.5, 262, 100], [24.5, 206, 121], [27.5, 206, 121], [28.6, 250, 104],
      [31.5, 250, 104], [32.5, 178, 128], [35.5, 186, 126], [36.6, 280, 100], [39.3, 280, 100], [40, 250, 104]];
    let viewH = keyed(keys.map(k => [k[0], k[1]]), b), ty = keyed(keys.map(k => [k[0], k[2]]), b);
    if (!REDUCED) viewH *= 1 - 0.03 * hitEnv('kick', t, 0.12);
    const asp = G.rw / G.rh;
    if (asp < 1.1) { const need = 180 / asp; if (need > viewH) { ty += (need - viewH) * 0.12; viewH = need; } }
    const tx = J.pelvis.x * 0.3;
    const roll = REDUCED ? 0 : 0.017 * Math.sin(Math.PI * (b - 0.5));
    const dist = 560;
    const fov = 2 * Math.atan((viewH / 2) / dist);
    // the whip pan swings the camera away to the left
    const whip = easeIn(sat((b - 39.55) / 0.45), 2.2);
    const tgt = V(tx - whip * 380, ty, 0);
    return makeCam(V(tx * 0.7 - whip * 90, ty + 12, dist), tgt, fov, roll);
  },
  lights(b, t, J, cam) {
    const Ls = archLights(b, t);
    const key = { dir: vnorm(V(Ls.w.x - J.chest.x, 90, Ls.w.z - J.chest.z)), col: [1.03, 0.95, 0.84], int: Ls.wI * 0.95 };
    const rim = { dir: vnorm(V(Ls.c.x - J.chest.x, 50, Ls.c.z - J.chest.z)), col: [0.95, 0.92, 1.1], int: Ls.cI };
    const J2 = shadowRig(b, 1.2);
    const sOff = vsub(J2.pelvis, J.pelvis);
    const mOff = vsub(micFrame(J2, SIM.mic.d).tail, micFrame(J, SIM.mic.d).tail);
    const lean = (REDUCED ? 0.05 : 0.13) * side(b, 0.2, 0.3, 0.45, 1.8);
    const z0 = J2.pelvis.z, flat = p => V(p.x, p.y, z0 + (p.z - z0) * 0.4);
    const W = ARCH.wallZ;
    const shadows = [
      { J: J2, opts: { off: sOff, micOff: mOff }, proj: p => projectShadow(cam, Ls.w, flat(p), W, lean) },
      { J: J2, opts: { off: sOff, micOff: mOff }, proj: p => projectShadow(cam, Ls.c, flat(p), W, lean) }
    ];
    const pool = (Lp, R, fx) => {
      const c = shadowPoint(Lp, J.chest, W).p;
      return { wall: poolAt(cam, c, R * 1.2, R), floor: poolAt(cam, V(fx, 0, 40), 250, 70) };
    };
    const pw = pool(Ls.w, 170, Ls.w.x * 0.18), pc = pool(Ls.c, 160, Ls.c.x * 0.18);
    return {
      key, rim, amb: [1, 1, 1], shadows,
      comp: {
        amb: [0.3, 0.27, 0.42], time: t, relief: 2.1,
        lights: [
          { wall: pw.wall, floor: pw.floor, col: [1.32 * Ls.wI, 0.84 * Ls.wI, 0.5 * Ls.wI], sh: 1 },
          { wall: pc.wall, floor: pc.floor, col: [0.62 * Ls.cI, 0.45 * Ls.cI, 1.18 * Ls.cI], sh: 2 }
        ],
        refl: [1, cam.rh - project(cam, V(J.pelvis.x, 0, 2)).y, 0.3, 1]
      }
    };
  },
  dynamic(b, t, J, cam) { drawArchDynamic(J, t); }
};

// ---------------------------------------------------------------- the river nocturne
// camera keys: [beat, position, target, vertical fov (deg)]
const NOCT_CAM = [
  [0, V(-20, 95, 720), V(50, 215, -420), 31],
  [6.5, V(-10, 82, 650), V(40, 190, -420), 29],
  [10.4, V(0, 40, 330), V(0, 18, 0), 20],
  [11.7, V(0, 12, 150), V(0, 6, 0), 20],
  [14.0, V(0, 13, 162), V(0, 7, 0), 20],
  [15.9, V(0, 42, 380), V(0, 42, 0), 24]
];
function noctCam(b) {
  const K = NOCT_CAM;
  if (b <= K[0][0]) return makeCam(K[0][1], K[0][2], K[0][3] * Math.PI / 180, 0);
  for (let i = 0; i < K.length - 1; i++) {
    if (b < K[i + 1][0]) {
      const u = easeInOut((b - K[i][0]) / (K[i + 1][0] - K[i][0]));
      return makeCam(vlerp(K[i][1], K[i + 1][1], u), vlerp(K[i][2], K[i + 1][2], u), lerp(K[i][3], K[i + 1][3], u) * Math.PI / 180, 0);
    }
  }
  const k = K[K.length - 1];
  return makeCam(k[1], k[2], k[3] * Math.PI / 180, 0);
}
function blendCam(A, B, u) {
  const fov = lerp(A.fovY, B.fovY, u);
  return makeCam(vlerp(A.pos, B.pos, u), vlerp(A.target, B.target, u), fov, 0);
}
const S_NOCT = {
  name: 'noct',
  build: buildNoct,
  figure: b => b > 7 && b < 40,
  camera(b, t, J) {
    const c = noctCam(b);
    if (b < 15.9) return c;
    const a = S_ARCH.camera(Math.max(b, 16), t, J);
    return blendCam(c, a, easeInOut((b - 15.9) / 0.45));
  },
  lights(b, t, J, cam) {
    const flash = hitEnv('piano', t, 0.5) * 0.08;
    const waterY = cam.rh - project(cam, V(J.head.x, 0, J.head.z)).y;
    return {
      key: { dir: vnorm(V(-0.3, 0.6, 0.75)), col: [1.0, 0.9, 0.74], int: 1.0 + flash },
      rim: { dir: vnorm(V(0.7, 0.3, -0.3)), col: [0.72, 0.86, 1.05], int: 0.9 },
      amb: [0.84, 0.9, 1.0],
      clip: b < 17.5 ? [1, 0, 0.7, t] : null,
      bgJit: 0.8,
      comp: { amb: [1, 1, 1], time: t, relief: 1.8, refl: [1, waterY, 0.4, 1.4], ground: [0.06, 0.12, 0.15] }
    };
  },
  dynamic(b, t, J) {
    drawSparks(t);
    if (b >= 0 && b < 16.1) drawRiver(J, t, b);
    drawSplash(t, b);
  }
};

// ---------------------------------------------------------------- palette knife (nocturne -> arch)
const KNIFE = [[16.45, 16.95, 0.8], [16.95, 17.45, 0.5], [17.45, 17.95, 0.2]];   // [start, end, band centre (0 bottom .. 1 top)]
function knifeBands(b) {
  const out = [];
  let cur = null;
  for (const [b0, b1, yc] of KNIFE) {
    if (b < b0) continue;
    const u = easeInOut((b - b0) / (b1 - b0));
    const edge = lerp(-0.1, 1.12, u) * CW;
    out.push([yc * CH, 0.31 * CH, edge, 1]);
    if (b < b1) cur = { y: yc * CH, edge, h: 0.31 * CH, u };
  }
  return { bands: out, cur };
}
// the knife itself: a steel trowel blade pressed flat along the band, its cranked neck and handle
function drawKnife(k) {
  if (!k) return;
  const x = k.edge;
  const yTop = CH - (k.y + k.h * 0.92), yBot = CH - (k.y - k.h * 0.92);
  const L = yBot - yTop;
  const bw = Math.min(0.2 * CH, L * 0.3);
  const cx = x - bw * 0.48;
  const steel = [0.42, 0.45, 0.5], steelD = [0.25, 0.27, 0.31], steelL = [0.86, 0.88, 0.92];
  // a trowel blade, widest near the neck, tapering to a round tip; it trails the scraping edge
  const prof = [[0, 0.62], [0.2, 1.0], [0.55, 0.78], [0.85, 0.4], [1, 0.1]];
  const along = (f, dx, wk, c) => prof.map(([ff, w]) => ({ x: cx + dx(w) + (ff - 0.5) * bw * 0.25, y: yTop + ff * L, w: Math.max(2, w * bw * wk), c: c(ff) }));
  strokeScreen(along(0, () => 0, 1, f => mix3(steel, steelD, f * 0.5)), { dry: 0.04, h: 0.45, gloss: 1, w0: 1, tip: 1, tS: 0.02, tE: 0.02, kind: 2, sq: 0.3 });
  strokeScreen(along(0, w => -w * bw * 0.22, 0.16, () => steelL), { a: 0.75, dry: 0.3, h: 0.2, gloss: 1, exact: true });
  strokeScreen(along(0, w => w * bw * 0.4, 0.12, () => steelD), { a: 0.8, dry: 0.3, h: 0.3, exact: true });
  // paint heaped along the working edge, in the colours being scraped off
  strokeScreen(along(0, w => w * bw * 0.5 + 4 * DPR, 0.2, f => mix3([0.12, 0.24, 0.28], [0.3, 0.42, 0.44], f)), { a: 0.95, dry: 0.45, h: 0.9 });
  // cranked neck, brass ferrule, wooden handle, going up and out of the band
  const n0 = { x: cx, y: yTop + bw * 0.1 };
  strokeScreen([{ x: n0.x, y: n0.y, w: bw * 0.12, c: steelD }, { x: n0.x + bw * 0.1, y: n0.y - bw * 0.45, w: bw * 0.1, c: steel },
    { x: n0.x + bw * 0.55, y: n0.y - bw * 0.75, w: bw * 0.1, c: steel }], { dry: 0.1, h: 0.3, gloss: 1, w0: 1, tip: 1 });
  const f0 = { x: n0.x + bw * 0.55, y: n0.y - bw * 0.75 };
  strokeScreen([{ x: f0.x, y: f0.y, w: bw * 0.2, c: [0.62, 0.48, 0.24] }, { x: f0.x + bw * 0.25, y: f0.y - bw * 0.25, w: bw * 0.22, c: [0.74, 0.58, 0.3] }],
    { dry: 0.1, h: 0.4, gloss: 0.9, sq: 0.8 });
  const h0 = { x: f0.x + bw * 0.25, y: f0.y - bw * 0.25 };
  strokeScreen([{ x: h0.x, y: h0.y, w: bw * 0.3, c: [0.33, 0.18, 0.1] }, { x: h0.x + bw * 0.9, y: h0.y - bw * 0.9, w: bw * 0.36, c: [0.47, 0.27, 0.14] },
    { x: h0.x + bw * 1.6, y: h0.y - bw * 1.6, w: bw * 0.3, c: [0.38, 0.2, 0.11] }], { dry: 0.15, h: 0.5, gloss: 0.5, w0: 0.95, tip: 0.9 });
}

// ---------------------------------------------------------------- running order
const WHIP = [39.55, 40.0, 40.45];   // arch swings away, cut at full speed, the print lands
function framePlan(b, t) {
  if (b < 16.45) return { mode: 0, scenes: [[S_NOCT, 0]] };
  if (b < 17.95) {
    const k = knifeBands(b);
    return { mode: 1, scenes: [[S_NOCT, 0], [S_ARCH, 1]], final: { bands: k.bands }, overlay: () => drawKnife(k.cur), overlayShadow: 1 };
  }
  if (b < WHIP[0]) return { mode: 0, scenes: [[S_ARCH, 0]] };
  if (b < WHIP[2]) {
    // whip pan: motion blur peaks at the cut
    const u = (b - WHIP[0]) / (WHIP[2] - WHIP[0]);
    const blur = 0.5 * Math.pow(Math.sin(Math.PI * u), 1.5);
    if (b < WHIP[1]) return { mode: 2, scenes: [[S_ARCH, 0]], final: { w: [0, blur, 0, 0], pickB: 0 } };
    const v = (b - WHIP[1]) / (WHIP[2] - WHIP[1]);
    const off = -1.3 * Math.pow(1 - easeOut(v, 2.4), 1.2);
    return { mode: 2, scenes: [], pop: true, final: Object.assign(S_POP.final(b, t), { w: [0, blur, off, 1], pickB: 1 }) };
  }
  if (b < CURTAIN_IN) return { mode: 3, scenes: [], pop: true, final: S_POP.final(b, t) };
  if (b < 56) {
    // the curtains sweep in over the frozen prints
    const u = easeInOut((b - CURTAIN_IN) / (56 - CURTAIN_IN));
    return { mode: 3, scenes: [], pop: true, final: S_POP.final(b, t), overlay: () => drawCurtains(u - 1, t, 0), overlayShadow: 0.6 };
  }
  if (b < WHIRL[0]) return { mode: 0, scenes: [[S_THEA, 0]] };
  if (b < WHIRL[1]) {
    const u = (b - WHIRL[0]) / (WHIRL[1] - WHIRL[0]);
    return {
      mode: 4, scenes: [[S_THEA, 0], [S_STAR, 1]],
      final: { p0: [0.5, 0.56, 9 * easeIn(u, 2), -7 * (1 - easeOut(u, 2))], p1: [0.62, sstep(0.2, 0.85, u), 0, 0] }
    };
  }
  if (b < 104) return { mode: 0, scenes: [[S_STAR, 0]] };
  // the gallery: the two canvases are live scenes, rendered as big as they appear
  const cam = galleryCam(b);
  const [RA, RB] = galleryRects(cam);
  const vis = R => R[2] > 0 && R[0] < 1 && R[3] > 0 && R[1] < 1;
  const sc = R => clamp((R[3] - R[1]) * 1.15, 0.3, 1);
  const scenes = [[S_GALL, 2]];
  const F = { p0: [0, 0, 0, 0], p1: [0, 0, 0, 0], p2: [1, 1, 0, 0], sC: [1, 1] };
  if (vis(RA)) { const k = sc(RA); scenes.unshift([S_STAR, 0, { scale: k }]); F.p0 = RA; F.sA = [Math.round(CW * k) / CW, Math.round(CH * k) / CH]; }
  if (vis(RB)) {
    const k = sc(RB);
    scenes.unshift([S_NOCT, 1, { scale: k, loop: true }]); F.p1 = RB; F.sB = [Math.round(CW * k) / CW, Math.round(CH * k) / CH];
  }
  // the picture light fades out of the canvas as it comes to fill the screen
  F.p2 = [sat(1 - (RA[3] - RA[1] - 0.6) / 0.4), sat(1 - (RB[3] - RB[1] - 0.6) / 0.4), 0, 0];
  return { mode: 5, scenes, final: F };
}
const CURTAIN_IN = 55.55;
const WHIRL = [70.6, 73.0];
