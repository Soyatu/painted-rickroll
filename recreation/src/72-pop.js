// ============================================================================
// Pop-art prints: the dancer is painted once, and once more as flat material
// ids; the final pass silkscreens him into a grid of prints (1, 4, 9, 16), each
// its own colourway, with an off-register black key plate and a halftone.
// As the grid grows the framing tightens, until the last grid is all portraits.
// ============================================================================
const POP_PAL = [
  // bg, coat, skin, hair, blacks, mic, lips & eyes, highlight
  ['#f45c9c', '#35c4c9', '#ffc8a0', '#ffe03a', '#1b1f5e', '#d7dbe4', '#e0162e', '#fff6e0'],
  ['#ffd93b', '#f67f24', '#ff9fb4', '#1fc0c9', '#4a1a72', '#e6e6e6', '#d4142a', '#ffffff'],
  ['#27bfc5', '#e32a36', '#ffe16a', '#e8339a', '#0e0d14', '#f2f2f2', '#6a1b8a', '#fff9d9'],
  ['#ff8a26', '#8e5ad8', '#fff0cf', '#d61f1f', '#153a45', '#cfd6e0', '#1f7fd1', '#ffffff'],
  ['#b4e04a', '#f2479a', '#ffd6b0', '#ff7a1f', '#1c2a6b', '#ffffff', '#c3122d', '#fffbe8'],
  ['#8e5ad8', '#ffd33b', '#9be6e0', '#ff5a3c', '#10101a', '#e7e7ef', '#ff2d8a', '#ffffff'],
  ['#e8222f', '#22b2e8', '#ffe8c0', '#1b1b1b', '#3a1d6e', '#f0f0f0', '#ffd02a', '#ffffff'],
  ['#1fb6a8', '#ffb627', '#ffc0d0', '#7a2bd6', '#0f2230', '#ffffff', '#ef233c', '#fff4e0'],
  ['#ffe8d6', '#e8505b', '#ffd07a', '#2d7dd2', '#171717', '#cfcfcf', '#b3122e', '#ffffff'],
  ['#2d7dd2', '#f7ec59', '#ff9f9f', '#f15bb5', '#10162f', '#f5f5f5', '#fee440', '#ffffff'],
  ['#ff5d8f', '#9ef01a', '#ffe5b4', '#3a86ff', '#240046', '#e0e0e0', '#ffbe0b', '#ffffff'],
  ['#fb8500', '#219ebc', '#ffe6cc', '#ffb703', '#023047', '#e8eef2', '#d00000', '#ffffff'],
  ['#80ffdb', '#ff006e', '#ffd6e0', '#8338ec', '#1a1a2e', '#f8f9fa', '#ff0054', '#fffde8'],
  ['#ffbe0b', '#3a0ca3', '#ffc9b9', '#f72585', '#10002b', '#e9ecef', '#4cc9f0', '#ffffff'],
  ['#f72585', '#fee440', '#ffd9c7', '#00bbf9', '#2b2d42', '#edf2f4', '#ef233c', '#ffffff'],
  ['#06d6a0', '#ef476f', '#ffe3b3', '#ffd166', '#073b4c', '#f1faee', '#118ab2', '#ffffff']
].map(r => r.map(hex));

const popN = b => (b < 44 ? 1 : b < 48 ? 2 : b < 52 ? 3 : 4);
// framing per grid size: full figure, three-quarters, waist up, head and shoulders
const POP_FRAME = [[232, 102], [172, 118], [116, 137], [66, 162]];

const S_POP = {
  name: 'pop',
  render(b, t) {
    G.rw = CW; G.rh = CH; G.rs = 1;
    const N = popN(b), J = FRAME.J;
    const [vh, ty] = POP_FRAME[N - 1];
    const tx = N === 4 ? J.head.x : J.pelvis.x * 0.5;
    const tyy = N === 4 ? J.head.y - 4 : ty;
    const cam = makeCam(V(tx, tyy + 6, 560), V(tx, tyy, 0), 2 * Math.atan((vh / 2) / 560), 0);
    G.cam = cam;
    G.key = { dir: vnorm(V(-0.55, 0.6, 0.6)), col: [1, 1, 1], int: 1.15 };
    G.rim = { dir: vnorm(V(0.75, 0.25, 0.3)), col: [1, 1, 1], int: 0.5 };
    G.amb = [1, 1, 1];
    G.proj = p => project(cam, p);
    G.t = t; G.b = b; G.anim = null; G.flags = 0;
    G.buf = bufFG; bufFG.reset(); G.mode = 'paint'; G.boil = Math.floor(t * 12); G.jit = 0.6;
    drawFigure(J);
    glDrawStrokes(bufFG, T.FG, { time: t });
    G.buf = bufDyn; bufDyn.reset(); G.mode = 'id';
    drawFigure(J);
    glDrawStrokes(bufDyn, T.ID, { time: t, mode: 2 });
    G.mode = 'paint';
    FRAME.stats.strokes = (FRAME.stats.strokes || 0) + bufFG.count * 2;
  },
  // final-pass parameters for the grid at beat b
  final(b, t) {
    const N = popN(b);
    const since = b - [40, 44, 48, 52][N - 1];
    const bounce = N > 1 ? 1 + 0.07 * Math.exp(-since * 5) * Math.cos(since * 14) : 1;
    const side = Math.min(CW, CH) * 0.9 * bounce;
    const du = CH / CW;
    const cell = side / N;
    return {
      p0: [N, 0.012 * CH, side, side],
      p1: [0.5 - du / 2, 0, du, 1],
      p2: [cell / (6.5 * DPR), 1, 0, 0],
      p3: [[0, 1, 5, 11][N - 1], N > 1 ? Math.exp(-since * 6) * 0.9 : 0, 0, 0]
    };
  }
};
PAL_TEX = glMakePalette(POP_PAL);
