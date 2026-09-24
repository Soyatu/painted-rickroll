// ============================================================================
// Frame orchestration, the clock, the title card, input and debug hooks.
// ============================================================================
const FIXED_T = QS.has('t') ? parseFloat(QS.get('t')) : null;
const AUTOPLAY = QS.has('autoplay');
const APP = { mode: FIXED_T !== null ? 'still' : AUTOPLAY ? 'free' : 'title', freeStart: null, titleStart: performance.now(), startedAt: null, errors: 0, paused: false, pausedAt: 0 };

function renderFrame(tAbs, overlayTime) {
  const t0 = performance.now();
  glResize();
  const t = mod(tAbs, DUR), b = t / BEAT;
  simAdvance(tAbs);
  FRAME.t = t; FRAME.b = b; FRAME.stats = {};
  FRAME.J = solveRig(danceAt(b));
  G.rw = CW; G.rh = CH; G.rs = 1;
  const plan = framePlan(b, t);
  for (const [S, slot, o] of plan.scenes) {
    // the nocturne on the gallery wall is the opening of the next loop
    if (o && o.loop) renderScene(S, b - BEATS, t - DUR, slot, o);
    else renderScene(S, b, t, slot, o);
  }
  if (plan.pop) S_POP.render(b, t);
  // overlay strokes: the title card, the palette knife, curtains closing over the prints
  G.buf = bufOV; bufOV.reset(); G.mode = 'paint'; G.rw = CW; G.rh = CH; G.rs = 1; G.anim = null;
  G.boil = Math.floor(t * 12); G.jit = 0.6;
  if (plan.overlay) plan.overlay(b, t);
  const ot = overlayTime !== undefined ? overlayTime : t;
  if (overlayTime !== undefined) drawTitle(ot);
  glDrawStrokes(bufOV, T.OV, { time: ot });
  const F = Object.assign({ time: t, grain: (Math.floor(t * 12) % 61) * 1.37 }, plan.final || {});
  F.p4 = [plan.overlayShadow !== undefined ? plan.overlayShadow : 0.8, (plan.final && plan.final.pickB) || 0, 0, 0];
  F.mode = plan.mode;
  glFinal(F);
  FRAME.stats.ms = performance.now() - t0;
}

// ---------------------------------------------------------------- the title card
// Gold brush capitals painted onto the opening frame; they lift off when the piece starts.
function drawTitle(tt) {
  const started = APP.startedAt;
  if (started !== null && tt - started > 2) return;
  const s = Math.min(CW / 1280, CH / 720);
  const lines = [
    { str: 'NOCTURNE', cap: 64 * s, y: CH * 0.3, col: [1.0, 0.8, 0.4], w: 0.2, h: 0.8 },
    { str: 'IN BLUE AND GOLD', cap: 34 * s, y: CH * 0.3 + 58 * s, col: [0.96, 0.78, 0.42], w: 0.19, h: 0.6 },
    { str: 'A MOVING PAINTING IN THIRTY BARS', cap: 12 * s, y: CH * 0.3 + 96 * s, col: [0.78, 0.84, 0.86], w: 0.16, h: 0.3 },
    { str: 'CLICK TO BEGIN  ·  SOUND ON', cap: 13 * s, y: CH * 0.78, col: [0.95, 0.9, 0.75], w: 0.18, h: 0.3, hint: true }
  ];
  let idx = 0;
  for (const L of lines) {
    const lay = layoutText(L.str, 1.6, 0.06);
    const k = L.cap / 6, x0 = (CW - lay.width * k) / 2;
    for (const pl of lay.lines) {
      const ctrl = pl.map(([px, py]) => ({ x: x0 + px * k, y: L.y - py * k, w: Math.max(1.5, L.cap * L.w), c: L.col }));
      const fx = (ctrl[0].x - x0) / Math.max(1, lay.width * k);
      const tIn = (L.hint ? 2.2 : 0.35) + fx * (L.hint ? 0.6 : 1.5) + hash(idx * 1.7) * 0.12 + (L.cap < 20 * s ? 0.8 : 0);
      const tOut = started === null ? 1e4 : started + 0.05 + fx * 0.5 + hash(idx * 2.3) * 0.1;
      const blink = L.hint && started === null ? 0.65 + 0.35 * Math.sin(tt * 3) : 1;
      strokeScreen(ctrl, { anim: [tIn, tOut], dry: 0.35, h: L.h, gloss: 0.8, w0: 0.7, tip: 0.5, a: blink, seed: 900 + idx * 3.1, jit: 0.4, exact: true });
      idx++;
    }
  }
}

// ---------------------------------------------------------------- the clock
function pieceTime() {
  if (FIXED_T !== null) return FIXED_T;
  const a = audioClock();
  if (a !== null) return Math.max(0, a);
  if (APP.freeStart !== null) return (performance.now() - APP.freeStart) / 1000;
  return 0;
}
function titleTime() { return (performance.now() - APP.titleStart) / 1000; }
function start(withSound) {
  if (APP.mode === 'still') return;
  const from = APP.mode === 'free' ? pieceTime() : 0;
  if (APP.mode === 'title') APP.startedAt = titleTime();
  APP.mode = 'playing';
  if (withSound) audioBegin(from);
  if (!AU.running) APP.freeStart = performance.now() - from * 1000;
}
function tick() {
  if (APP.paused) return;
  try {
    // on the title card the opening frame holds still while the river shimmers under the lettering
    if (APP.mode === 'title') renderFrame(0, titleTime());
    else renderFrame(pieceTime(), APP.startedAt !== null && titleTime() - APP.startedAt < 2 ? titleTime() : undefined);
  } catch (e) { if (APP.errors++ < 3) console.error(e); }
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- input
const wantsStart = () => APP.mode === 'title' || (APP.mode === 'free' && !AU.running);
cv.addEventListener('click', () => { if (wantsStart()) start(true); });
cv.addEventListener('dblclick', () => {
  const d = document;
  if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); }
  else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {});
});
window.addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') { if (wantsStart()) { start(true); e.preventDefault(); } }
  else if (e.key === 'm' || e.key === 'M') audioMute(!AU.muted);
});

// ---------------------------------------------------------------- debug hooks (no visible UI unless called)
const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type || 'image/png', q));
const postBlob = (name, blob) => fetch('/save/' + encodeURIComponent(name), { method: 'POST', body: blob });
function sheetCanvas(times, cols, cellW) {
  cols = cols || 4;
  const rows = Math.ceil(times.length / cols);
  const w = cellW || 480, h = Math.round(w * CH / CW), lab = 18;
  const c = document.createElement('canvas');
  c.width = cols * w; c.height = rows * (h + lab);
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  times.forEach((t, i) => {
    renderFrame(t);
    const x = (i % cols) * w, y = Math.floor(i / cols) * (h + lab);
    g.drawImage(cv, x, y, w, h);
    g.fillStyle = '#ddd'; g.font = '13px monospace';
    g.fillText('t ' + t.toFixed(2) + '  bar ' + (t / BAR).toFixed(2) + '  beat ' + (t / BEAT).toFixed(2), x + 6, y + h + 13);
  });
  return c;
}
window.__rick = {
  render: t => { renderFrame(t); return FRAME.stats; },
  pause: () => { if (!APP.paused) { APP.paused = true; APP.pausedAt = performance.now(); } },
  resume: () => { if (APP.paused) { APP.paused = false; if (APP.freeStart !== null) APP.freeStart += performance.now() - APP.pausedAt; requestAnimationFrame(tick); } },
  // a contact sheet of the given times; shown over the page, and saved if a capture server is listening
  sheet: async (times, name, cols, cellW) => {
    __rick.pause();
    const c = sheetCanvas(times, cols, cellW);
    const el = document.getElementById('sheet');
    el.querySelector('img').src = c.toDataURL('image/jpeg', 0.9);
    el.style.display = 'block';
    if (name) await postBlob(name, await canvasBlob(c, 'image/jpeg', 0.9));
    return FRAME.stats;
  },
  // a region (fractions of the frame) enlarged
  zoom: async (t, x0, y0, x1, y1, name, outW) => {
    __rick.pause();
    renderFrame(t);
    const sw = (x1 - x0) * CW, sh = (y1 - y0) * CH, w = outW || 1200, h = Math.round(w * sh / sw);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(cv, x0 * CW, y0 * CH, sw, sh, 0, 0, w, h);
    if (name) await postBlob(name, await canvasBlob(c, 'image/jpeg', 0.92));
    return FRAME.stats;
  },
  snap: async (t, name, q, ot) => {
    __rick.pause();
    renderFrame(t, ot);
    await postBlob(name, await canvasBlob(cv, name.endsWith('.png') ? 'image/png' : 'image/jpeg', q || 0.92));
    return FRAME.stats;
  },
  hide: () => { document.getElementById('sheet').style.display = 'none'; },
  // renders the score offline between two beats; reports loudness per bar, optionally saves a WAV
  audio: async (b0, b1, name) => {
    b0 = b0 === undefined ? 0 : b0; b1 = b1 === undefined ? BEATS : b1;
    const r = await audioRender(b0, b1);
    if (name) await postBlob(name, wavBlob(r.buf, 0, (b1 - b0) * BEAT));
    return r.bars;
  },
  // every frame of a stretch of the loop, posted as numbered JPEGs (for making a video file)
  frames: async (fps, from, to, prefix, q) => {
    __rick.pause();
    fps = fps || 30; from = from || 0; to = to === undefined ? DUR : to;
    const n = Math.round((to - from) * fps), i0 = Math.round(from * fps);
    for (let i = 0; i < n; i++) {
      renderFrame((i0 + i) / fps);
      await postBlob((prefix || 'f') + String(i0 + i).padStart(5, '0') + '.jpg', await canvasBlob(cv, 'image/jpeg', q || 0.93));
    }
    return n;
  },
  state: () => ({ mode: APP.mode, t: pieceTime(), audio: AU.running, muted: AU.muted, size: [CW, CH, DPR] })
};

if (APP.mode === 'still') renderFrame(FIXED_T);
else {
  if (APP.mode === 'free') APP.freeStart = performance.now();
  requestAnimationFrame(tick);
}
