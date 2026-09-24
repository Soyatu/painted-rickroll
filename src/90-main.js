// ============================================================
// Frame orchestration
// ============================================================
const bufBGd = new StrokeBuf(), bufSH = new StrokeBuf(), bufFG = new StrokeBuf(), bufGal = new StrokeBuf();
let setsBuilt = false;
const STATS = { frames: 0, lastMs: 0, strokes: 0, verts: 0 };
const LINEN = [0.8, 0.74, 0.63], DARKGROUND = [0.05, 0.038, 0.058];

function pool2(cam, Lp, J, worldR, floorX) {
  const c = shadowPoint(Lp, J.chest).p;
  const q = project(cam, c);
  const r = worldR * q.s;
  const f = project(cam, V(floorX, 0, 40));
  return [[q.x, CH - q.y, r * 1.2, r], [f.x, CH - f.y, 250 * f.s, 70 * f.s]];
}
const NOPOOL = [-1e5, -1e5, 1, 1];

// flashes on the big cuts: [beat, colour, strength, decay per beat]
const FLASHES = [[16, [1.0, 0.85, 0.5], 0.45, 5], [40, [1, 1, 1], 0.55, 6], [44, [1, 1, 1], 0.3, 7], [48, [1, 1, 1], 0.3, 7],
                 [52, [1, 1, 1], 0.3, 7], [55, [1, 1, 1], 0.6, 5], [72, [1, 0.95, 0.8], 0.3, 4], [100, [1, 0.95, 0.8], 0.35, 3]];
function flashAt(b) {
  let best = [0, 0, 0, 0];
  for (const [b0, c, k, d] of FLASHES) {
    if (b < b0 || b > b0 + 2) continue;
    const a = k * Math.exp(-(b - b0) * d);
    if (a > best[3]) best = [c[0], c[1], c[2], a];
  }
  return best;
}

// the title card, before anyone has clicked
function renderTitle(sec) {
  glResize();
  if (!setsBuilt) { buildSets(); setsBuilt = true; }
  G.buf = bufFG; bufFG.reset(); G.mode = 'paint'; G.layer = 'title'; G.mid = 0;
  G.rev = (idx, x) => [0.2 + 1.1 * clamp(x / CW, 0, 1) + 0.12 * hash(idx * 3.1), NO_OUT];
  G.boil = Math.floor(sec * 8); G.jit = 0.4;
  drawTitle(sec);
  glClearTarget(T_BG); glClearTarget(T_SH);
  glDrawStrokes(bufFG, T_FG, { tIn: sec, tOut: -1e4 });
  glComposite(baseComposite({ ground: LINEN, relief: 1.8, vig: 0.45, time: sec, grain: (Math.floor(sec * 12) % 61) * 1.37 }));
}
function baseComposite(o) {
  return Object.assign({
    amb: [1, 1, 1], wCol: [0, 0, 0], cCol: [0, 0, 0], ground: DARKGROUND,
    wPool: NOPOOL, wPool2: NOPOOL, cPool: NOPOOL, cPool2: NOPOOL,
    grain: 0, relief: 2.1, floorY: -1, time: 0, refl: 0, waterY: -1,
    pop: 0, grid: 1, popSeed: 0, gal: 0, frame: [0, 0, 1, 1],
    galAmb: [0.5, 0.45, 0.42], galWarm: [0, 0, 0], galPool: NOPOOL,
    flash: [0, 0, 0, 0], fade: 0, vig: 0.9
  }, o);
}

function renderFrame(tp) {
  const t0ms = performance.now();
  glResize();
  if (!setsBuilt) { buildSets(); setsBuilt = true; }
  const t = pieceT(tp), b = t / BEAT;
  simAdvance(tp);
  G.t = t; G.b = b;
  const P = danceAt(t);
  const J = solveRig(P);
  const name = sceneName(b);
  const look = LOOK[name];
  const cam = cameraAt(t, J);
  const gv = galleryView(b);
  const galOn = gv.s < 0.9995;
  const camV = withView(cam, { s: gv.s, ox: gv.ox, oy: gv.oy });
  const pop = name === 'pop';
  const grid = pop ? popGrid(b) : 1;
  // each new grid of prints lands like a stamp: a quick 7% overshoot back to size
  const stamp = pop ? 1 + 0.07 * Math.exp(-Math.max(0, b - Math.floor((b - B.pop) / 4) * 4 - B.pop) * 9) : 1;
  const camFG = pop ? withView(cam, { s: stamp / grid, ox: -(stamp - 1) * CW / grid / 2, oy: -(stamp - 1) * CH / grid / 2 }) : camV;
  const Ls = lightsFor(name, b);
  G.cam = camV;
  G.wDir = vnorm(V(Ls.w.x - J.chest.x, name === 'arch' ? 90 : Math.max(40, Ls.w.y - J.chest.y), Ls.w.z - J.chest.z));
  G.cDir = vnorm(V(Ls.c.x - J.chest.x, name === 'arch' ? 50 : Math.max(30, Ls.c.y - J.chest.y), Ls.c.z - J.chest.z));
  G.wI = Ls.wI; G.cI = Ls.cI; G.tint = look.tint; G.rimW = look.rimW; G.rimC = look.rimC;
  // squash on the beat, stretch on the rebound (about the feet)
  const sqz = J.pose.squash * (dip(b) - 0.25);
  const sx = 1 + sqz * 0.7, sy = 1 - sqz, bx = J.pelvis.x, bz = J.pelvis.z, gy = J.ground;
  const squash = p => V(bx + (p.x - bx) * sx, gy + (p.y - gy) * sy, bz + (p.z - bz) * sx);
  const camProj = p => project(camV, p);
  const figProj = p => project(camFG, squash(p));
  const frameX0 = gv.ox, frameW = CW * gv.s;
  const tRe = B.repaint * BEAT;
  const liftAtEnd = b > B.repaint - 0.5;
  const endRev = off => (idx, x) => [NO_IN, tRe + off + 0.5 * clamp((x - frameX0) / frameW, 0, 1) + 0.06 * hash(idx * 7.13 + 100)];

  // ---- background: moving scenery on top of the static sets
  G.mode = 'paint'; G.layer = 'bg'; G.mid = 0; G.pop = false;
  G.buf = bufBGd; bufBGd.reset(); G.proj = camProj; G.boil = Math.floor(t * 6); G.jit = 0.5;
  G.rev = liftAtEnd ? endRev(-0.15) : null;
  if (b < B.drop + 1.5) {
    // the river's moving parts paint in with the nocturne and are scraped away with it
    const tD = B.drop * BEAT - 0.06;
    const saved = G.rev;
    G.rev = (idx, x) => { const u = clamp(x / CW, 0, 1); return [t < 0 ? -1.7 + 1.25 * u + 0.1 * hash(idx) : NO_IN, tD + 0.5 * u + 0.08 * hash(idx * 1.3)]; };
    drawNoctDynamic(t, b);
    G.rev = saved;
  }
  if (b >= B.repaint - 0.2) {
    // ...and when the painting repaints itself as the nocturne, they paint back in with it
    const saved = G.proj, savedRev = G.rev, nc = nocturneCam({ s: gv.s, ox: gv.ox, oy: gv.oy });
    G.proj = p => project(nc, p);
    G.rev = (idx, x) => [tRe + 1.25 * clamp((x - frameX0) / frameW, 0, 1) + 0.1 * hash(idx), NO_OUT];
    drawNoctDynamic(t, b);
    G.proj = saved; G.rev = savedRev;
  }
  if (b > B.drop - 0.2 && b < B.drop + 1.6) {
    const saved = G.rev; G.rev = null;
    drawScrapeRidge(t, b, project(camV, V(-300, 60, WALL_Z)).x, project(camV, V(300, 60, WALL_Z)).x);
    G.rev = saved;
  }
  if (name === 'arch') drawArchDynamic(t, J);
  if (name === 'thea') drawTheatreDynamic(t, b, J);
  if (name === 'star') {
    if (b < B.star + 1.6) {
      const c0 = project(camV, V(40, 110, WALL_Z));
      const R = Math.hypot(CW, CH) * 0.6;
      G.rev = (idx, x, y) => [B.swirl * BEAT + 0.95 * clamp(0.6 * Math.hypot(x - c0.x, y - c0.y) / R + 0.4 * (Math.atan2(c0.y - y, x - c0.x) + Math.PI) / TAU, 0, 1), NO_OUT];
    }
    drawStarryDynamic(t, b, J, camV);
  }
  if (b > B.swirl - 0.5 && b < B.swirl + 1.5) {
    const c = project(camV, J.chest);
    const saved = G.rev; G.rev = null;
    drawSwirlVortex(t, b, c.x, c.y);
    G.rev = saved;
  }
  // ---- shadow masks
  G.buf = bufSH; bufSH.reset(); G.mode = 'mask'; G.layer = 'sh'; G.rev = null;
  G.boil = Math.floor(t * (REDUCED ? 4 : 12));
  if (name === 'arch' || name === 'thea') {
    const copy = lerpPose(basePose(), danceAt(pieceT(t - 0.1 * BEAT)), name === 'arch' ? 1.4 : 1.2);
    const P2 = name === 'thea' ? shadowPoseAt(t, copy) : copy;
    const J2 = solveRig(P2);
    const sOff = vsub(J2.pelvis, J.pelvis);
    const mOff = vsub(micFrame(J2, SIM.mic.d).bottom, micFrame(J, SIM.mic.d).bottom);
    const z0 = J2.pelvis.z, pc = J2.pelvis;
    const ca = Math.cos(P2.flip || 0), sa = Math.sin(P2.flip || 0);
    // depth is flattened so the shadow reads as a front-on pose (a shadow-puppet cheat); a cartwheel turns it in the wall plane
    const flat = p => {
      let q = squash(V(p.x, p.y, z0 + (p.z - z0) * 0.4));
      if (P2.flip) { const dx = q.x - pc.x, dy = q.y - pc.y; q = V(pc.x + dx * ca - dy * sa, pc.y + dx * sa + dy * ca, q.z); }
      return q;
    };
    if (name === 'arch') {
      const lean = (REDUCED ? 0.05 : 0.13) * sideHit(b, 0.2, 0.3, 0.45, 1.8);
      G.maskCol = [1, 0, 0]; G.proj = p => projectShadow(camV, Ls.w, flat(p), lean); drawSilhouette(J2, sOff, mOff);
      G.maskCol = [0, 1, 0]; G.proj = p => projectShadow(camV, Ls.c, flat(p), lean); drawSilhouette(J2, sOff, mOff);
    } else if (spotOn(b) > 0.05) {
      G.maskCol = [1, 0, 0]; G.proj = p => projectShadow(camV, Ls.w, flat(p), 0); drawSilhouette(J2, sOff, mOff);
    }
  }
  // ---- the dancer
  G.buf = bufFG; bufFG.reset(); G.mode = 'paint'; G.layer = 'fg'; G.proj = figProj; G.pop = pop;
  G.boil = Math.floor(t * (REDUCED ? 4 : 12)); G.jit = REDUCED ? 0.35 : 0.7;
  G.cableA = b < B.drop ? 0 : smoothstep(B.drop, B.drop + 1.2, b);
  G.rev = liftAtEnd ? endRev(-0.05) : null;
  if (J.ground > -205) drawFigure(J);
  drawWinkGlint(J, smoothstep(0.75, 1, J.pose.wink));
  if (!pop) drawSpinSwoosh(J, b);
  drawSnapMarks(J, t, b);
  G.pop = false; G.proj = camProj; G.mid = 0;
  if (b > 14.3 && b < 17.8) drawSplash(t, b);
  if (name === 'thea') drawCurtain(b);
  if (name === 'arch') drawWhipSmear(b);
  // the title lifting off as the nocturne paints itself in (first play only)
  if (t < 0) {
    G.layer = 'title'; G.rev = (idx, x) => [NO_IN, -INTRO + 0.04 + 0.5 * clamp(x / CW, 0, 1) + 0.08 * hash(idx * 3.1)];
    G.boil = Math.floor(tp * 8); G.jit = 0.4;
    drawTitle(tp + 10);
  }
  // ---- the gallery wall
  if (galOn) { G.buf = bufGal; bufGal.reset(); G.layer = 'gal'; G.mode = 'paint'; drawGallery(t, b, gv); }

  // ---- GPU passes
  const draws = setDrawList(t);
  const vpScene = camVP(camV), vpFlat = camVP(cam);
  const boilBG = Math.floor(t * (REDUCED ? 2 : 6));
  let first = true;
  for (const d of draws) {
    const vp = d.flat ? vpFlat : d.noctCam ? camVP(nocturneCam({ s: gv.s, ox: gv.ox, oy: gv.oy })) : vpScene;
    glDrawStrokes(d.buf, T_BG, { world: true, vp, boil: boilBG, jit: 0.6, tIn: d.tIn !== undefined ? d.tIn : 1e4, tOut: d.tOut !== undefined ? d.tOut : -1e4, noClear: !first });
    first = false;
  }
  if (first) glClearTarget(T_BG);
  glDrawStrokes(bufBGd, T_BG, { noClear: true, tIn: t, tOut: t });
  glDrawStrokes(bufSH, T_SH, { mask: true, tIn: t, tOut: t });
  glDrawStrokes(bufFG, T_FG, { tIn: t, tOut: t });
  if (name === 'thea' || (b >= B.star && b < B.star + 1.6)) {
    glDrawStrokes(SET.theaF, T_FG, { world: true, vp: vpScene, boil: boilBG, jit: 0.6, noClear: true, tIn: 1e4, tOut: t - (B.swirl - 0.3) * BEAT });
  }
  if (galOn) glDrawStrokes(bufGal, T_GAL, { tIn: t, tOut: t });

  // ---- composite
  const U = baseComposite({ time: t, grain: (Math.floor(t * 12) % 61) * 1.37, flash: flashAt(b) });
  // a breath of exposure on every backbeat while the band is playing
  if (!REDUCED && b > B.drop && b < 100.5) {
    const sn = Math.max(hitPulse('snare', t, 0.09), hitPulse('clap', t, 0.09));
    const k = (pop ? 0.05 : 0.035) * sn;
    if (k > U.flash[3]) U.flash = [1, 0.97, 0.92, k];
  }
  if (t < 0) U.ground = mixc(LINEN, DARKGROUND, smoothstep(-1.2, 0, t));
  // bare linen shows while the painting inside the frame is scraped and repainted
  if (b > B.repaint - 0.4) U.ground = mixc(DARKGROUND, LINEN, smoothstep(B.repaint - 0.3, B.repaint + 0.3, b) * (1 - smoothstep(B.repaint + 1.8, B.repaint + 2.8, b)));
  if (b < B.drop + 1.5) {
    const k = smoothstep(B.drop + 0.85, B.drop + 1.3, b);    // lights up once the knife has passed
    U.amb = mixc([1, 1, 1], [0.2, 0.19, 0.33], k);
    U.refl = 0.45; U.relief = lerp(1.5, 2.1, k); U.vig = 1.0;
    U.floorY = CH - project(camV, V(b > B.drop ? J.pelvis.x : 0, 0, 2)).y;
    if (b < B.drop + 0.6) U.waterY = CH - project(camV, V(0, 0, 0)).y;
    if (b > B.drop) {
      const pw = pool2(camV, Ls.w, J, 170, Ls.w.x * 0.18), pc = pool2(camV, Ls.c, J, 160, Ls.c.x * 0.18);
      U.wCol = scalec([1.32 * Ls.wI, 0.84 * Ls.wI, 0.5 * Ls.wI], k); U.cCol = scalec([0.62 * Ls.cI, 0.45 * Ls.cI, 1.18 * Ls.cI], k);
      U.wPool = pw[0]; U.wPool2 = pw[1]; U.cPool = pc[0]; U.cPool2 = pc[1];
    }
  } else if (name === 'arch') {
    const pw = pool2(camV, Ls.w, J, 170, Ls.w.x * 0.18), pc = pool2(camV, Ls.c, J, 160, Ls.c.x * 0.18);
    Object.assign(U, {
      amb: [0.2, 0.19, 0.33], wCol: [1.32 * Ls.wI, 0.84 * Ls.wI, 0.5 * Ls.wI], cCol: [0.62 * Ls.cI, 0.45 * Ls.cI, 1.18 * Ls.cI],
      wPool: pw[0], wPool2: pw[1], cPool: pc[0], cPool2: pc[1], refl: 0.3,
      floorY: CH - project(camV, V(J.pelvis.x, 0, 2)).y
    });
  } else if (pop) {
    Object.assign(U, { pop: 1, grid, popSeed: popSeed(b), relief: 1.1, vig: 0.3, ground: [0.96, 0.94, 0.9] });
  } else if (name === 'thea') {
    const on = spotOn(b);
    const sc = shadowPoint(Ls.w, J.chest).p;
    const mid = project(camV, V(lerp(J.chest.x, sc.x, 0.45), lerp(J.chest.y, sc.y, 0.5) - 10, lerp(J.chest.z, sc.z, 0.6)));
    const r = 250 * mid.s * (0.3 + 0.7 * easeOutBack(seg(b, 56.2, 56.85), 1.6));   // the follow-spot irises open
    const f = project(camV, V(J.pelvis.x + 20, 0, 20));
    Object.assign(U, {
      amb: [0.13, 0.11, 0.17], wCol: scalec([1.55, 1.3, 0.95], on), cCol: [0.18, 0.16, 0.34],
      wPool: [mid.x, CH - mid.y, r * 1.25, r], wPool2: [f.x, CH - f.y, 200 * f.s, 70 * f.s],
      cPool: [f.x, CH - f.y, 320 * f.s, 120 * f.s], cPool2: NOPOOL, refl: 0.14, relief: 2.0,
      floorY: CH - project(camV, V(J.pelvis.x, 0, 2)).y
    });
  } else {
    Object.assign(U, { relief: 2.5, refl: 0, vig: 0.85 });
  }
  if (galOn) {
    const x0 = gv.ox, x1 = gv.ox + CW * gv.s, yT = gv.oy, yB = gv.oy + CH * gv.s;
    const lamp = { x: CW / 2, y: gv.cy - CH * gv.s * 0.62 };
    Object.assign(U, {
      gal: 1, frame: [x0, CH - yB, x1, CH - yT],
      galAmb: [0.6, 0.53, 0.5], galWarm: [0.7, 0.55, 0.36],
      galPool: [lamp.x, CH - lamp.y, CW * gv.s * 0.8, CH * gv.s * 1.05]
    });
    U.vig = lerp(U.vig, 0.7, 1 - gv.s);
  }
  glComposite(U);
  STATS.frames++;
  STATS.lastMs = performance.now() - t0ms;
  STATS.strokes = bufBGd.count + bufSH.count + bufFG.count + bufGal.count + draws.reduce((s, d) => s + d.buf.count, 0);
  STATS.verts = bufBGd.nv + bufSH.nv + bufFG.nv + bufGal.nv + draws.reduce((s, d) => s + d.buf.nv, 0);
}

// ============================================================
// Clock, input, hooks
// ============================================================
const QS = new URLSearchParams(location.search);
const FIXED_T = QS.has('t') ? parseFloat(QS.get('t')) : null;
let mode = QS.has('autoplay') ? 'play' : 'title';
const loadMs = performance.now();
let startMs = mode === 'play' ? loadMs + INTRO * 1000 : null;
let errors = 0, paused = false, pausedAt = 0;

function start() {
  if (mode !== 'title') { if (AUDIO.ctx && AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume(); return; }
  mode = 'play';
  cv.style.cursor = 'default';
  startMs = performance.now() + INTRO * 1000;
  try { audioStart(-INTRO); } catch (e) { console.warn('audio unavailable', e); AUDIO.running = false; }
}
cv.addEventListener('pointerdown', start);
// double-click for fullscreen: it is meant to be watched as a picture
cv.addEventListener('dblclick', () => {
  const d = document;
  if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
  else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {});
});
window.addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') audioMute(!AUDIO.muted);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); }
});

// Picture time follows the audio clock while the music is actually playing; otherwise the
// page clock. If the audio starts late (a suspended context), the score is re-anchored to the
// picture rather than the picture jumping back to meet it.
let audioWasRunning = false;
function nowPieceTime(now) {
  const tPerf = (now - startMs) / 1000;
  const running = AUDIO.running && AUDIO.ctx && AUDIO.ctx.state === 'running';
  if (running && !audioWasRunning && Math.abs(audioPieceTime() - tPerf) > 0.08) audioAnchor(tPerf);
  audioWasRunning = running;
  if (!running) return tPerf;
  const ta = audioPieceTime();
  startMs = now - ta * 1000;
  return ta;
}
function tick(now) {
  if (paused) return;
  try {
    if (mode === 'title') renderTitle((now - loadMs) / 1000);
    else { audioPump(); renderFrame(nowPieceTime(now)); }
  } catch (e) { if (errors++ < 3) console.error(e); }
  requestAnimationFrame(tick);
}
// test hooks (no visible UI): render a given piece time, read stats, pause/resume the clock
window.__rick = {
  render: t => { renderFrame(t); return STATS; },
  title: s => { renderTitle(s); return STATS; },
  stats: () => STATS,
  pause: () => { if (!paused) { paused = true; pausedAt = performance.now(); } },
  resume: () => { if (paused) { paused = false; if (startMs !== null) startMs += performance.now() - pausedAt; requestAnimationFrame(tick); } },
  score: () => SCORE.length,
  audio: async (b0, b1, only) => { const r = await audioMeasure(b0, b1, only); window.__mix = r.buf; delete r.buf; return r; },
  // debug contact sheet: render piece times into a grid over the page (no UI unless called)
  sheet: (times, cols, scale) => {
    cols = cols || 4; scale = scale || 0.25;
    const w = Math.round(CW * scale), h = Math.round(CH * scale), rows = Math.ceil(times.length / cols);
    let c = document.getElementById('__sheet');
    if (!c) { c = document.createElement('canvas'); c.id = '__sheet'; c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#111;z-index:9'; document.body.appendChild(c); }
    c.width = w * cols; c.height = h * rows;
    const x = c.getContext('2d');
    x.font = `${Math.round(h * 0.07)}px sans-serif`;
    times.forEach((t, i) => {
      renderFrame(t);
      x.drawImage(cv, (i % cols) * w, Math.floor(i / cols) * h, w, h);
      x.fillStyle = '#ff0'; x.fillText(`t=${t.toFixed(2)}  b=${(t / BEAT).toFixed(1)}`, (i % cols) * w + 6, Math.floor(i / cols) * h + h * 0.09);
    });
    return times.length;
  },
  unsheet: () => { const c = document.getElementById('__sheet'); if (c) c.remove(); },
  // debug: render piece time t and blow up a region (fractions of the canvas) over the page
  zoom: (t, fx0, fy0, fx1, fy1) => {
    renderFrame(t);
    let c = document.getElementById('__sheet');
    if (!c) { c = document.createElement('canvas'); c.id = '__sheet'; c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#111;z-index:9'; document.body.appendChild(c); }
    const sx = fx0 * CW, sy = fy0 * CH, sw = (fx1 - fx0) * CW, sh = (fy1 - fy0) * CH;
    c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return [c.width, c.height];
  }
};
if (FIXED_T !== null && isFinite(FIXED_T)) { mode = 'fixed'; renderFrame(FIXED_T); }
else requestAnimationFrame(tick);
