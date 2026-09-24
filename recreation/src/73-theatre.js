// ============================================================================
// The theatre: a plank stage, a grey-blue cyclorama for the shadow to play on,
// footlights, red velvet curtains and a valance with a gold fringe. A follow
// spot from the front throws his shadow, large, onto the backdrop; the shadow
// soon has ideas of its own.
// ============================================================================
const THEA = { backZ: -260, frontZ: 200, spot: V(-250, 135, 430) };
const VELVET = { s: [0.2, 0.015, 0.04], m: [0.52, 0.04, 0.08], l: [0.86, 0.16, 0.14] };

function buildTheatre() {
  const rnd = rng(1954);
  const BZ = THEA.backZ;
  // floor: planks running toward us, square-ended, their far ends tucked under the cloth
  for (let x = -760; x < 760; x += 18) {
    const c = mix3([0.34, 0.2, 0.11], [0.5, 0.31, 0.16], rnd());
    let z = BZ - 10;
    while (z < THEA.frontZ) {
      const len = 120 + rnd() * 160;
      wst([V(x, 0, z), V(x + (rnd() - 0.5) * 2, 0, Math.min(THEA.frontZ, z + len))], 19, c, { recv: 1, gloss: 0.55, dry: 0.3, h: 0.3, sq: 0.95, w0: 1, tip: 1 }, true);
      z += len * 0.97;
    }
    wst([V(x + 9, 0.1, BZ), V(x + 9, 0.1, THEA.frontZ)], 1.0, [0.2, 0.11, 0.06], { recv: 1, a: 0.45, dry: 0.5, sq: 0.9 }, true);
  }
  // the cyclorama: soft vertical folds of grey-blue cloth
  for (let x = -760; x < 760; x += 26) {
    const c = mix3([0.3, 0.33, 0.42], [0.42, 0.45, 0.55], rnd());
    wst([V(x + rnd() * 6, -5, BZ), V(x + (rnd() - 0.5) * 8, 260, BZ), V(x + rnd() * 6, 620, BZ)], 34, c, { recv: 1, dry: 0.3, h: 0.2 });
  }
  for (let x = -760; x < 760; x += 52) wst([V(x, -5, BZ + 0.5), V(x + 3, 620, BZ + 0.5)], 3, [0.18, 0.2, 0.27], { recv: 1, a: 0.4, dry: 0.5 });
  // the front edge of the stage and its footlights
  wst([V(-760, -2, THEA.frontZ), V(760, -2, THEA.frontZ)], 14, [0.12, 0.06, 0.04], { recv: 0.6, dry: 0.3, sq: 0.8 });
  for (let x = -600; x <= 600; x += 60) {
    wdab(V(x, 6, THEA.frontZ - 4), 26, 18, [0.5, 0.36, 0.18], { recv: 0, kind: 1, a: 0.5 });
    wdab(V(x, 5, THEA.frontZ - 3), 7, 5, [1.0, 0.86, 0.55], { recv: 0 });
  }
  // dust hanging in the light high up
  for (let i = 0; i < 20; i++) wdab(V(-500 + rnd() * 1000, 200 + rnd() * 300, BZ + 40), 40 + rnd() * 60, 80 + rnd() * 80, [0.4, 0.42, 0.5], { recv: 0.5, kind: 1, a: 0.08 });
}

// Curtains, in screen space so the same drawing serves the scene and the overlay that
// closes over the pop prints. open: 0 closed .. 1 gathered to the sides.
function drawCurtains(open, t, lit) {
  const K = 11;
  const topY = CH * 0.11;
  for (const side of [-1, 1]) {
    for (let k = K - 1; k >= 0; k--) {
      const f = k / (K - 1);                                   // 0 outer edge .. 1 inner edge
      const delay = (1 - f) * 0.25;
      const o = easeInOut((open - delay) / (1 - delay * 0.6));
      const closedX = (side < 0 ? 0 : CW) - side * (f * 0.5 + 0.02) * CW;
      const openX = (side < 0 ? 0 : CW) - side * (0.015 + f * 0.13) * CW;
      // open < 0: still sliding in from beyond the edges of the frame
      const x = open < 0 ? closedX + side * -open * 0.56 * CW : lerp(closedX, openX, o);
      // gathered folds are tied back: pinched toward the wall at the cord, flaring below
      const tie = CH * 0.64, pinch = Math.max(0, o) * (0.025 + 0.035 * f) * CW;
      const sway = Math.sin(t * 1.3 + k * 0.9) * 3 * DPR * (1 - o * 0.5);
      const crest = k % 2 === 0;
      const c = crest ? VELVET.m : VELVET.s;
      const hi = lit * (crest ? 1 : 0.5);
      const col = mix3(c, VELVET.l, 0.25 * hi);
      const w = lerp(0.5 / K * CW * 1.45, 0.13 / K * CW * 1.9, o);
      const pts = [
        { x: x + sway, y: -20, w, c: col },
        { x: x + side * pinch * 0.4 + sway * 0.5, y: tie * 0.5, w: w * lerp(1, 0.8, o), c: col },
        { x: x + side * pinch, y: tie, w: w * lerp(1, 0.55, o), c: mix3(col, VELVET.s, 0.3) },
        { x: x - side * pinch * 0.1, y: CH * 0.85, w: w * lerp(1, 1.1, o), c: col },
        { x: x - side * pinch * 0.5 + sway, y: CH + 20, w: w * lerp(1, 1.3, o), c: mix3(col, [0.35, 0.05, 0.05], 0.3) }
      ];
      strokeScreen(pts, { dry: 0.15, h: 0.5, w0: 1, tip: 1, gloss: 0.35, seed: 400 + k * 3 + (side > 0 ? 50 : 0), jit: 0.6 });
      if (crest) strokeScreen(pts.map(p => ({ x: p.x - side * p.w * 0.12, y: p.y, w: p.w * 0.16, c: mix3(VELVET.l, [1, 0.5, 0.4], 0.2 * lit) })),
        { a: 0.45 + 0.3 * lit, dry: 0.5, h: 0.3, exact: true, seed: 700 + k });
    }
    // the tie-back cord
    const o = easeInOut(open);
    if (o > 0.3) {
      const x0 = (side < 0 ? 0 : CW) - side * 0.005 * CW, x1 = (side < 0 ? 0 : CW) - side * 0.098 * CW;
      strokeScreen([{ x: x0, y: CH * 0.62, w: 9 * DPR, c: [0.75, 0.56, 0.22] }, { x: x1, y: CH * 0.655, w: 8 * DPR, c: [0.9, 0.7, 0.3] }], { a: sat((o - 0.3) / 0.3), dry: 0.2, h: 0.6, gloss: 0.8 });
    }
  }
  drawValance(t, open < 0 ? -open : 0);
}
// the pelmet across the top: swags of velvet and a gold fringe
function drawValance(t, lift) {
  const n = 6, sw = CW / n, top = CH * 0.1;
  const dy = -(lift || 0) * top * 2.2;
  strokeScreen([{ x: -20, y: top * 0.4 + dy, w: top * 0.9, c: VELVET.s }, { x: CW + 20, y: top * 0.4 + dy, w: top * 0.9, c: VELVET.s }], { dry: 0.1, h: 0.4, w0: 1, tip: 1, seed: 11 });
  for (let i = 0; i < n; i++) {
    const x0 = i * sw, pts = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      pts.push({ x: x0 + u * sw, y: top * (0.7 + 0.55 * Math.sin(Math.PI * u)) + dy, w: top * 0.5, c: mix3(VELVET.m, VELVET.l, 0.25 * Math.sin(Math.PI * u)) });
    }
    strokeScreen(pts, { dry: 0.2, h: 0.5, w0: 1, tip: 1, seed: 30 + i });
    strokeScreen(pts.map(p => ({ x: p.x, y: p.y + top * 0.27, w: top * 0.12, c: [0.85, 0.65, 0.28] })), { dry: 0.6, h: 0.4, gloss: 0.8, seed: 60 + i });
  }
}

function theatreSpot(b) {
  // the follow spot clunks on just after the curtains part, and follows him
  const on = sstep(56.95, 57.02, b);
  return { on, flick: on * (1 - 0.25 * pulse(57.0, 57.02, 57.08, 57.15, b)) };
}

const S_THEA = {
  name: 'theatre',
  build: buildTheatre,
  figure: () => true,
  camera(b, t, J) {
    const push = easeInOut((b - 57) / 12) * 0.12;
    const tx = J.pelvis.x * 0.25;
    const viewH = 330 * (1 - push);
    let c = makeCam(V(tx, 145, 760), V(tx, 128 - 10 * push, -40), 2 * Math.atan((viewH / 2) / 800), 0);
    return c;
  },
  lights(b, t, J, cam) {
    const sp = theatreSpot(b);
    const Lp = V(THEA.spot.x + J.pelvis.x * 0.8, THEA.spot.y, THEA.spot.z);
    const SJ = solveRig(shadowPoseAt(b));
    const shadows = [{ J: SJ, opts: { rigid: true }, proj: p => projectShadow(cam, Lp, p, THEA.backZ, 0) }];
    const onBack = shadowPoint(Lp, J.chest, THEA.backZ).p;
    const kick = hitEnv('kick', t, 0.2);
    return {
      key: { dir: vnorm(vsub(Lp, J.chest)), col: [1.05, 1.0, 0.92], int: 0.25 + 1.0 * sp.flick },
      rim: { dir: vnorm(V(0.3, 0.8, -0.5)), col: [0.62, 0.72, 1.1], int: 0.9 },
      amb: [0.95, 0.95, 1.0],
      shadows,
      comp: {
        amb: [0.13, 0.13, 0.2], time: t, relief: 2.0,
        lights: [
          { wall: poolAt(cam, V(onBack.x, onBack.y + 10, THEA.backZ), 230, 210), floor: poolAt(cam, V(J.pelvis.x, 0, 10), 130, 60),
            col: mul3([1.25, 1.15, 0.95], sp.flick), sh: 1 },
          { wall: poolAt(cam, V(0, 30, THEA.frontZ - 60), 700, 70), floor: poolAt(cam, V(0, 0, THEA.frontZ - 30), 600, 60),
            col: mul3([0.55, 0.36, 0.16], 1 + 0.2 * kick), sh: 0 },
          { wall: poolAt(cam, V(0, 420, THEA.backZ), 600, 260), floor: [0, 0, 1, 1], col: [0.16, 0.2, 0.42], sh: 0 }
        ],
        refl: [1, cam.rh - project(cam, V(J.pelvis.x, 0, 2)).y, 0.18, 0.5]
      }
    };
  },
  dynamic(b, t, J, cam) {
    // the spot's beam in the dusty air, from the front
    const sp = theatreSpot(b);
    if (sp.on > 0.01) {
      const src = project(cam, V(THEA.spot.x * 0.9 + J.pelvis.x * 0.8, 150, 380)), dst = project(cam, V(J.pelvis.x, 110, 0));
      strokeScreen([{ x: src.x, y: src.y, w: 30 * DPR, c: [0.5, 0.5, 0.55] }, { x: dst.x, y: dst.y, w: 260 * DPR, c: [0.5, 0.5, 0.55] }],
        { kind: 1, a: 0.08 * sp.flick, still: true });
    }
  },
  overFigure(b, t) {
    G.proj = null;
    const open = easeInOut((b - 56.0) / 1.3);
    drawCurtains(open, t, theatreSpot(b).flick);
  }
};
