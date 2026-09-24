// ============================================================================
// The gallery: the camera pulls back out of the starry night to find it framed
// on a wall, reads the (defaced) wall label, finds a visitor in fits of
// laughter, then glides along to the next painting (the nocturne) and pushes
// into it until it fills the frame, which is where the piece began.
// The paintings are the live scene images, set into their frames by the final pass.
// ============================================================================
const GAL = { H: 150, y: 160, gap: 270 };
const galW = () => GAL.H * (CW / CH);                 // canvases share the screen's aspect
const galX2 = () => galW() + GAL.gap;                  // centre of the second painting
const galLabelX = () => galW() / 2 + 44;
const LABEL = { w: 38, h: 27, y: 122 };
const fillDist = 300;                                  // at this distance a canvas fills the frame
const fillFov = () => 2 * Math.atan((GAL.H / 2) / fillDist);

function buildGallery() {
  const rnd = rng(2026);
  const W = galW(), X2 = galX2();
  // the wall: warm grey, laid in broad soft strokes
  for (let y = -20; y < 460; y += 26) {
    let x = -900 + rnd() * 60;
    while (x < X2 + 900) {
      const len = 90 + rnd() * 120, tilt = (rnd() - 0.5) * 50;
      wst([V(x, y + rnd() * 10, 0), V(x + len / 2, y + tilt * 0.5 + (rnd() - 0.5) * 8, 0), V(x + len, y + tilt + rnd() * 10, 0)], 40,
        mix3([0.64, 0.6, 0.54], [0.69, 0.65, 0.58], rnd()), { recv: 1, dry: 0.25, h: 0.12, w0: 0.6, tip: 0.4 });
      x += len * 0.62;
    }
  }
  // skirting board and the parquet floor
  wst([V(-900, 6, 1), V(X2 + 900, 6, 1)], 12, [0.3, 0.26, 0.22], { recv: 1, dry: 0.2, h: 0.3, sq: 0.8 });
  for (let z = 4; z < 900; z += 14) {
    let x = -1000 + (Math.floor(z / 14) % 2) * 35;
    while (x < X2 + 1000) {
      const len = 70;
      wst([V(x, 0, z), V(x + len, 0, z)], 13, mix3([0.36, 0.23, 0.13], [0.5, 0.33, 0.18], rnd()), { recv: 1, gloss: 0.5, dry: 0.3, h: 0.25, sq: 0.8 }, true);
      x += len;
    }
  }
  // the frames: gilded, a dark inner lip, highlights, corner ornaments
  for (const cx of [0, X2]) {
    const x0 = cx - W / 2, x1 = cx + W / 2, y0 = GAL.y - GAL.H / 2, y1 = GAL.y + GAL.H / 2;
    const ring = (d, w, col, o) => {
      const a = V(x0 - d, y0 - d, 0.8), b = V(x1 + d, y0 - d, 0.8), c = V(x1 + d, y1 + d, 0.8), e = V(x0 - d, y1 + d, 0.8);
      for (const [p, q] of [[a, b], [b, c], [c, e], [e, a]]) wst([p, vlerp(p, q, 0.5), q], w, col, Object.assign({ recv: 1, sq: 0.9, w0: 1, tip: 1 }, o));
    };
    ring(8, 16, [0.55, 0.4, 0.16], { dry: 0.2, h: 0.7, gloss: 0.8 });
    ring(3, 5, [0.24, 0.16, 0.08], { dry: 0.2, h: 0.4 });
    ring(12, 3, [0.95, 0.8, 0.45], { a: 0.8, dry: 0.4, h: 0.6, gloss: 1 });
    ring(15.5, 3, [0.35, 0.25, 0.1], { a: 0.8, dry: 0.4, h: 0.5 });
    for (const [px, py] of [[x0 - 8, y0 - 8], [x1 + 8, y0 - 8], [x1 + 8, y1 + 8], [x0 - 8, y1 + 8]]) {
      wdab(V(px, py, 1.2), 16, 16, [0.72, 0.56, 0.24], { recv: 1, h: 0.9, gloss: 1 });
      wdab(V(px - 2, py + 2, 1.3), 5, 5, [1, 0.9, 0.6], { recv: 1, h: 0.5, gloss: 1 });
    }
    // the picture light's brass arm and hood above the frame
    wst([V(cx, y1 + 24, 1.5), V(cx, y1 + 42, 1.5)], 3, [0.5, 0.4, 0.2], { recv: 1, gloss: 0.8 });
    wst([V(cx - 34, y1 + 46, 2), V(cx + 34, y1 + 46, 2)], 7, [0.62, 0.5, 0.24], { recv: 1, gloss: 0.9, sq: 0.8, h: 0.5 });
  }
  // the wall label, printed, and then defaced
  const LX = galLabelX();
  const lx0 = LX, ly1 = LABEL.y + LABEL.h / 2;
  for (let i = 0; i < 4; i++) wst([V(lx0, LABEL.y - LABEL.h / 2 + 3.5 + i * 6.6, 0.9), V(lx0 + LABEL.w, LABEL.y - LABEL.h / 2 + 3.5 + i * 6.6, 0.9)], 7.4,
    [0.94, 0.92, 0.87], { recv: 1, dry: 0.05, h: 0.1, sq: 0.9, w0: 1, tip: 1, unit: 6 });
  const text = (str, x, y, cap, col, o) => {
    const L = layoutText(str, 1.3, (o && o.slant) || 0);
    const k = cap / 6;
    for (const line of L.lines) wst(line.map(([px, py]) => V(x + px * k, y + py * k, 1.0)), cap * (cap < 3 ? 0.2 : 0.16), col,
      Object.assign({ recv: 1, dry: 0.05, h: 0.15, w0: 1, tip: 1, tS: 0.02, tE: 0.02, unit: 8, exact: true }, o));
    return L.width * k;
  };
  text('NOCTURNE IN', lx0 + 3, ly1 - 6.5, 2.6, [0.1, 0.1, 0.12]);
  text('BLUE AND GOLD', lx0 + 3, ly1 - 10.3, 2.6, [0.1, 0.1, 0.12]);
  text('OIL ON CANVAS, 64 SECONDS', lx0 + 3, ly1 - 14.4, 1.6, [0.2, 0.2, 0.24]);
  const qw = text('A QUIET STUDY', lx0 + 3, ly1 - 18.8, 1.8, [0.2, 0.2, 0.24]);
  text('OF THE RIVER AT NIGHT.', lx0 + 3, ly1 - 22.0, 1.8, [0.2, 0.2, 0.24]);
  // someone has been at it with a red marker: QUIET struck out, and a verdict
  wst([V(lx0 + 2.4, ly1 - 17.8, 1.2), V(lx0 + 3.4 + qw * 0.5, ly1 - 18.1, 1.2)], 0.75, [0.8, 0.08, 0.1], { recv: 1, dry: 0.3, unit: 8 });
  text('RICKROLLED!', lx0 - 1, ly1 - 27.5, 4.6, [0.82, 0.07, 0.1], { slant: 0.18, dry: 0.4, h: 0.3 });
  wst([V(lx0 - 3, ly1 - 25, 1.2), V(lx0 - 10, ly1 - 21, 1.2), V(lx0 - 16, ly1 - 12, 1.2)], 0.9, [0.82, 0.07, 0.1], { recv: 1, dry: 0.4, unit: 8 });
  wst([V(lx0 - 16, ly1 - 12, 1.2), V(lx0 - 13, ly1 - 15, 1.2)], 0.9, [0.82, 0.07, 0.1], { recv: 1, unit: 8 });
  wst([V(lx0 - 16, ly1 - 12, 1.2), V(lx0 - 19.5, ly1 - 14.5, 1.2)], 0.9, [0.82, 0.07, 0.1], { recv: 1, unit: 8 });
  // a bench in front of the first painting
  const BZ = 190;
  wst([V(-70, 44, BZ), V(90, 44, BZ)], 14, [0.2, 0.13, 0.09], { recv: 1, gloss: 0.6, h: 0.5, sq: 0.8, w0: 1, tip: 1 });
  wst([V(-70, 50, BZ + 1), V(90, 50, BZ + 1)], 3, [0.4, 0.28, 0.18], { recv: 1, a: 0.7 });
  for (const x of [-62, 82]) wst([V(x, 40, BZ), V(x, 0, BZ)], 6, [0.14, 0.09, 0.07], { recv: 1, sq: 0.8 });
}

// ---------------------------------------------------------------- the visitor
// A gallery-goer seen from behind: long green coat, red scarf, grey bun, a bag on
// the arm. From bar 27 they laugh: shoulders heave, head goes back, a hand on the belly.
function drawVisitor(b, t) {
  const laugh = pulse(107.4, 108.0, 114.5, 115.6, b);
  const heave = laugh * (0.5 + 0.5 * Math.sin(t * 29)) * (0.7 + 0.3 * Math.sin(t * 3.1)) * 1.6;
  const X = -62, Z = 150;
  const bend = laugh * (0.16 + 0.1 * Math.sin(t * 13)) * (b < 111 ? 1 : 0.6) + 0.05 * Math.sin(t * 2);
  const up = V(Math.sin(bend) * 0.3, 1, -Math.sin(bend));
  const P = (x, y, z) => V(X + x, y + heave * (y > 120 ? 2.2 : 0), Z + z);
  const coat = [0.16, 0.27, 0.2], coatL = [0.28, 0.42, 0.3], coatD = [0.08, 0.14, 0.11];
  G.proj = p => project(G.cam, p);
  // legs and shoes below the coat
  for (const sx of [-9, 9]) {
    st([P(sx, 48, -2), P(sx * 1.1, 20, -2), P(sx * 1.15, 4, -4)], [11, 9, 8], [0.12, 0.1, 0.1], { dry: 0.2 });
    st([P(sx * 1.15, 3, -6), P(sx * 1.2, 2, 6)], 8, [0.07, 0.05, 0.05], { gloss: 0.8 });
  }
  // the long coat from behind
  st([P(0, 150, 0), P(0, 100, 1), P(0, 44, 2)], [42, 44, 52], coat, { dry: 0.1, h: 0.3, w0: 1, tip: 0.95, sq: 0.4 });
  for (const sx of [-14, -4, 6, 15]) st([P(sx, 148, 1), P(sx * 1.05, 100, 2), P(sx * 1.2, 46, 3)], 9, mix3(coat, sx < 0 ? coatL : coatD, 0.5), { dry: 0.3, h: 0.4 });
  st([P(0, 108, 3), P(0, 46, 3)], 1.6, coatD, { a: 0.7, dry: 0.4 });
  st([P(-20, 104, 3), P(20, 104, 3)], 4, coatD, { dry: 0.2 });
  // arms: the left hangs with the bag, the right clutches the belly while laughing
  st([P(-21, 146, 0), P(-26, 115, 2), P(-26, 88, 4)], [12, 11, 10], coat, { dry: 0.2 });
  st([P(-28, 88, 3), P(-31, 64, 6), P(-24, 60, 8)], 3, [0.3, 0.18, 0.1], { dry: 0.3 });
  st([P(-34, 70, 6), P(-34, 46, 6)], [16, 18], [0.45, 0.16, 0.12], { dry: 0.2, h: 0.5, sq: 0.6 });
  const hand = vlerp(P(24, 90, 6), P(10, 108, 14), laugh);
  st([P(21, 146, 0), vlerp(P(26, 115, 2), P(28, 118, 8), laugh), hand], [12, 11, 10], coat, { dry: 0.2 });
  dab(hand, 7, 7, [0.86, 0.66, 0.54], { dry: 0.2 });
  // shoulders, scarf, head and bun, thrown back with each laugh
  st([P(-22, 148, 0), P(0, 153, -1), P(22, 148, 0)], 12, coatL, { dry: 0.3 });
  const neck = P(0, 158, 0);
  const head = vmad(neck, up, 13);
  st([P(-10, 154, 2), P(0, 158, 4), P(10, 154, 2)], 9, [0.72, 0.12, 0.12], { dry: 0.3, h: 0.5 });
  st([P(8, 154, 4), P(12, 136, 8)], [6, 5], [0.62, 0.1, 0.1], { dry: 0.3 });
  st([vmad(neck, up, 2), vmad(neck, up, 22)], [13, 15], [0.62, 0.62, 0.64], { dry: 0.2, h: 0.4, tip: 0.8 });
  for (let i = 0; i < 5; i++) st([vadd(vmad(neck, up, 8 + i * 3), V(-6, 0, 2)), vadd(vmad(neck, up, 10 + i * 3), V(6, 0, 2))], 1.5, [0.8, 0.8, 0.82], { a: 0.6, dry: 0.5 });
  dab(vadd(vmad(head, up, 9), V(0, 0, 1)), 10, 9, [0.7, 0.7, 0.72], { dry: 0.3, h: 0.5 });
  dab(vadd(head, V(-7, -2, 3)), 3.4, 4.4, [0.84, 0.62, 0.52], { dry: 0.2 });
  // HA! HA! painted in the air, rising off them and fading
  if (laugh > 0.1) for (let i = 0; i < 3; i++) {
    const ph = fract(t * 0.9 + i / 3);
    const cap = 5.5 + 2 * hash(i * 3.1 + Math.floor(t * 0.9 + i / 3));
    const lay = layoutText('HA!', 1.4, 0.12);
    const o = vadd(head, V(16 + ph * 22 + (i - 1) * 9, 8 + ph * 38, 6));
    for (const line of lay.lines) st(line.map(([px, py]) => vadd(o, V(px * cap / 6, py * cap / 6, 0))), cap * 0.17, [0.24, 0.22, 0.26],
      { a: laugh * sstep(0, 0.1, ph) * (1 - sstep(0.6, 1, ph)), dry: 0.2, w0: 1, tip: 1, exact: true });
  }
}

// ---------------------------------------------------------------- the camera's walk
// keys: [beat, x, y, distance, fov (deg or 0 = fill)]; the camera always faces the wall
function galleryKeys() {
  const LX = galLabelX() + LABEL.w / 2, X2 = galX2();
  return [
    [104.0, 0, GAL.y, fillDist, 0],
    [106.9, 0, GAL.y - 8, 740, 38],
    [108.0, 40, GAL.y - 14, 690, 38],
    [109.5, LX - 6, LABEL.y - 2, 175, 30],
    [111.2, LX - 4, LABEL.y - 2, 150, 30],
    [112.6, -20, 142, 660, 38],
    [114.6, X2 * 0.8, GAL.y, 640, 36],
    [116.4, X2, GAL.y, 600, 34],
    [120.0, X2, GAL.y, fillDist, 0]
  ];
}
function galleryCam(b) {
  const K = galleryKeys();
  const fov = k => (k[4] ? k[4] * Math.PI / 180 : fillFov());
  let i = 0;
  while (i + 1 < K.length && b >= K[i + 1][0]) i++;
  const k0 = K[i], k1 = K[Math.min(i + 1, K.length - 1)];
  const u = k1[0] > k0[0] ? easeInOut5(sat((b - k0[0]) / (k1[0] - k0[0]))) : 0;
  const x = lerp(k0[1], k1[1], u), y = lerp(k0[2], k1[2], u), d = lerp(k0[3], k1[3], u);
  // blend the view angle so the canvas that fills the screen at either end fills it exactly
  const f = 2 * Math.atan(lerp(Math.tan(fov(k0) / 2), Math.tan(fov(k1) / 2), u));
  return makeCam(V(x, y, d), V(x, y, 0), f, 0);
}
// the two canvases' rectangles in uv (y up) for the final pass
function galleryRects(cam) {
  const W = galW(), out = [];
  for (const cx of [0, galX2()]) {
    const a = project(cam, V(cx - W / 2, GAL.y - GAL.H / 2, 0)), c = project(cam, V(cx + W / 2, GAL.y + GAL.H / 2, 0));
    out.push([a.x / cam.rw, 1 - a.y / cam.rh, c.x / cam.rw, 1 - c.y / cam.rh]);
  }
  return out;
}

const S_GALL = {
  name: 'gallery',
  build: buildGallery,
  figure: () => false,
  camera: b => galleryCam(b),
  lights(b, t, J, cam) {
    const W = galW();
    const pools = [0, galX2()].map(cx => ({
      wall: poolAt(cam, V(cx, GAL.y + GAL.H * 0.55, 0), W * 0.75, GAL.H * 0.55), floor: poolAt(cam, V(cx, 0, 120), W * 0.6, 60),
      col: [0.55, 0.46, 0.34], sh: 0
    }));
    return {
      key: { dir: vnorm(V(-0.3, 0.8, 0.5)), col: [1, 0.95, 0.88], int: 1 }, rim: { dir: V(0.5, 0.5, -0.5), col: [1, 1, 1], int: 0.5 }, amb: [1, 1, 1],
      comp: { amb: [0.72, 0.7, 0.68], time: t, relief: 2.2, lights: pools, ground: [0.3, 0.28, 0.25] }
    };
  },
  overFigure(b, t) { drawVisitor(b, t); }
};
