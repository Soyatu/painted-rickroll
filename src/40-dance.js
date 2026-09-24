// ============================================================
// Choreography: 112 beats at 112 BPM. b = beat index (t / BEAT).
// The signature move is the side-to-side two-step: weight shifts on every
// beat, knees dip on the beat, bent arms swing across the belly against the
// hips, and the free hand keeps opening and closing. Everything else is built on it.
// ============================================================
const parity = k => ((k % 2) + 2) % 2;

// -1..1, flips on every beat with anticipation + overshoot ("hits" the beat)
function sideHit(b, lag, w0, w1, over) {
  b -= lag || 0;
  const k = Math.floor(b + 0.5);
  const d = b - k;
  const sg = parity(k) === 0 ? 1 : -1;
  const a0 = w0 === undefined ? 0.32 : w0, a1 = w1 === undefined ? 0.3 : w1;
  if (d <= -a0) return -sg;
  if (d >= a1) return sg;
  return lerp(-sg, sg, easeInOutBack((d + a0) / (a0 + a1), over === undefined ? 1.1 : over));
}
// knee dip: 1 exactly on the beat
const dip = b => Math.pow(0.5 + 0.5 * Math.cos(TAU * b), 2.5);

function twoStep(b, amp, P) {
  const s = sideHit(b);
  const sa = sideHit(b, 0.07, 0.3, 0.34, 1.6);
  const dp = dip(b);
  P.px = s * 10 * amp;
  P.py = -3 - dp * 8 * amp;
  P.proll = s * 0.13 * amp;
  P.pyaw = s * 0.14 * amp;
  P.croll = -s * 0.15 * amp;
  P.cyaw = -sa * 0.26 * amp;
  P.cpitch = 0.04 + dp * 0.1 * amp;
  P.hroll = s * 0.1 * amp;
  P.hpitch = -0.03 + dp * 0.16 * amp;
  P.hyaw = -sa * 0.12 * amp;
  const a = -sa;
  P.mX = -12 + 16 * a * amp; P.mY = -22 + 8 * a * amp - dp * 4; P.mZ = 23 - 3 * Math.abs(a) * amp;
  P.fX = 12 + 16 * a * amp; P.fY = -22 - 8 * a * amp - dp * 4; P.fZ = 23 - 3 * Math.abs(a) * amp;
  P.fOpen = smoothstep(-0.25, 0.25, Math.sin(Math.PI * (b + 0.25)));
  P.lfx = -17; P.rfx = 17;
  P.lheel = Math.max(0, s) * 8 * amp;
  P.rheel = Math.max(0, -s) * 8 * amp;
  P.lkx = lerp(-0.3, 0.9, clamp(s * amp, 0, 1));
  P.rkx = lerp(0.3, -0.9, clamp(-s * amp, 0, 1));
  P.shM = Math.max(0, -s) * 2 * amp;
  P.shF = Math.max(0, s) * 2 * amp;
  P.smile = 0.9;
  P.mouth = 0.05 + 0.08 * dp;
  P.squash = 0.035 * amp;
  return P;
}

// ---------------------------------------------------------------- bars 0-3: the river
// Hidden under the water, then the quiff breaks the surface like a moonrise, the
// eyes come up and look around, and on the drum fill he shoots out and lands on the water.
function under(b, P) {
  P.mX = -21; P.mY = -38; P.mZ = 8; P.fX = 21; P.fY = -38; P.fZ = 8;
  P.lfx = -12; P.rfx = 12; P.lfyaw = -0.15; P.rfyaw = 0.15;
  P.smile = 0.55; P.py = -2;
  const bob = Math.sin(b * 1.7) * 0.8;
  let ry;
  if (b < 8.4) ry = -262;
  else if (b < 10.6) ry = lerp(-190, -177, easeInOut(seg(b, 8.4, 10.6)));
  else if (b < 11.7) ry = lerp(-177, -165.5, easeInOut(seg(b, 10.6, 11.7)));
  else if (b < 13.7) ry = -165.5;
  else if (b < 14.45) ry = lerp(-165.5, -171, easeInOut(seg(b, 13.7, 14.45)));
  else if (b < 15.2) ry = lerp(-171, 44, easeOutCubic(seg(b, 14.45, 15.2)));
  else ry = 44 * (1 - Math.pow(seg(b, 15.2, 16), 2));
  P.ry = ry + (b < 14.45 ? bob : 0);
  // eyes over the waterline: look left, look right, then straight at us
  const lookL = smoothstep(11.75, 12.0, b) * (1 - smoothstep(12.35, 12.55, b));
  const lookR = smoothstep(12.55, 12.8, b) * (1 - smoothstep(13.1, 13.3, b));
  P.hyaw = -0.55 * lookL + 0.55 * lookR;
  P.brow = smoothstep(13.25, 13.45, b) * 1.0 + 0.3 * lookL;
  P.blink = bump(b, 11.45, 0.06) + bump(b, 13.3, 0.05);
  // the jump: arms fly up into a V, legs tuck, then he lands on the downbeat
  const air = smoothstep(14.4, 14.9, b) * (1 - smoothstep(15.55, 16.0, b));
  P.mX = lerp(P.mX, -37, air); P.mY = lerp(P.mY, 44, air); P.mZ = lerp(P.mZ, 12, air);
  P.fX = lerp(P.fX, 37, air); P.fY = lerp(P.fY, 46, air); P.fZ = lerp(P.fZ, 12, air);
  P.fOpen = air;
  const tuck = bump(b, 15.1, 0.28);
  P.lfy = 14 * tuck; P.rfy = 18 * tuck; P.lkx = -0.5; P.rkx = 0.5;
  P.lfx = lerp(-12, -18, air); P.rfx = lerp(12, 18, air);
  P.smile = lerp(0.55, 1, smoothstep(13.3, 14.6, b));
  P.hpitch = -0.12 * air;
  P.squash = 0.06;
  return P;
}

// ---------------------------------------------------------------- moves
function snaps(b, P) {
  twoStep(b, 0.85, P);
  const dp = dip(b), s = sideHit(b);
  // free hand up by the shoulder, a finger snap on every beat
  P.fX = 30 + 3 * s; P.fY = 9 + 3 * dp; P.fZ = 17; P.fPole = 0.3;
  const u = b - Math.floor(b);
  P.fOpen = u > 0.72 ? lerp(1, 0.15, seg(u, 0.72, 0.95)) : smoothstep(0.0, 0.07, u) * 0.85 + 0.15;
  P.shF += 2.2 * bump(u, 0.02, 0.05) + 2.2 * bump(u, 1.02, 0.05);
  P.mX = -9; P.mY = -7 + 2 * dp; P.mZ = 25;
  P.hpitch += 0.07 * dp; P.smile = 1;
  return P;
}

function armRoll(b, P) {
  twoStep(b, 0.8, P);
  const th = TAU * b;   // one roll per beat
  const r = 8.5;
  P.mX = -3 + r * Math.cos(th); P.mY = -11 + r * Math.sin(th); P.mZ = 27; P.mPole = 0.2;
  P.fX = 3 + r * Math.cos(th + Math.PI); P.fY = -11 + r * Math.sin(th + Math.PI); P.fZ = 27; P.fPole = 0.2;
  P.fOpen = 0; P.smile = 1;
  P.hroll += 0.05 * Math.sin(Math.PI * b);
  return P;
}

function sing(b, P, s) {
  twoStep(b, 0.6, P);
  const sd = sideHit(b), sa = sideHit(b, 0.1, 0.3, 0.36, 1.8);
  const dp = dip(b);
  P.mX = -4 + sd * 1.5; P.mY = 15 + dp * 1.5; P.mZ = 17; P.micAim = 1; P.mPole = 0.25;
  P.fX = 37 + 4 * sa; P.fY = 7 + 7 * sa + 3 * dp; P.fZ = 21 - 5 * sa; P.fOpen = 1; P.fPole = 0.25;
  P.hpitch = -0.12 + dp * 0.08; P.hroll = -0.07 + sd * 0.06; P.hyaw = -0.06;
  P.mouth = voiceMouth(b * BEAT);
  P.brow = 0.6;
  const lb = b - s;
  P.blink = 0.92 * smoothstep(1.3, 1.6, lb) * (1 - smoothstep(2.6, 2.9, lb));
  P.smile = 0.35;
  return P;
}

// a full skater's spin in two beats: wind up, whip round with the coat flaring, land facing front
function spin(b, P, s) {
  const lb = b - s;
  twoStep(b, 0.35, P);
  const u = easeInOutCubic(seg(lb, 0.35, 1.55));
  let yaw = -0.4 * bump(lb, 0.22, 0.14) + TAU * u;
  if (u > 0.5) yaw -= TAU;          // same orientation, but lands on yaw = 0 so blends stay put
  P.pyaw = yaw; P.cyaw = -0.12 * Math.sin(Math.PI * u); P.croll = 0; P.proll = 0;
  P.px = 0; P.py = -3 - 4 * Math.sin(Math.PI * u);
  const out = 1 - 0.45 * Math.sin(Math.PI * u);
  P.mX = -40 * out; P.mY = 4; P.mZ = 8; P.fX = 40 * out; P.fY = 4; P.fZ = 8; P.fOpen = 1; P.mPole = 0; P.fPole = 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  P.lfx = -11 * cy + 2 * sy; P.lfz = 11 * sy + 2 * cy;
  P.rfx = 11 * cy + 2 * sy; P.rfz = -11 * sy + 2 * cy;
  P.lfyaw = -0.15 + yaw; P.rfyaw = 0.15 + yaw;
  const toes = Math.sin(Math.PI * u);
  P.lheel = 7 * toes; P.rheel = 7 * toes;
  P.lkx = -0.2; P.rkx = 0.2;
  P.hpitch = -0.05; P.smile = 1;
  P.squash = 0.02;
  return P;
}

function big(b, P) {
  twoStep(b, 1.3, P);
  const s = sideHit(b, 0, 0.3, 0.32, 1.4);
  const sa = sideHit(b, 0.08, 0.3, 0.36, 1.9);
  const dp = dip(b);
  const g = (s + 1) / 2;
  P.px += s * 8;
  // step-touch: leading foot steps out, trailing foot closes in
  P.lfx = lerp(-29, 3, g); P.rfx = lerp(-3, 29, g);
  const arc = Math.sin(Math.PI * clamp(g, 0, 1));
  P.lfy = arc * 6; P.rfy = arc * 4;
  const a = -sa;
  P.mX = -12 + 22 * a; P.mY = -12 + 13 * a - dp * 5; P.mZ = 24;
  P.fX = 12 + 22 * a; P.fY = -12 - 13 * a - dp * 5; P.fZ = 24;
  P.mouth = 0.06; P.smile = 1;
  return P;
}

// step-touch, and the free arm flings out into a point on every other beat
function bigPoint(b, P) {
  big(b, P);
  const k = Math.floor(b), u = b - k;
  if (parity(k) === 1) {
    const e = easeOutBack(seg(u, 0.0, 0.22), 2.2) * (1 - smoothstep(0.7, 0.98, u));
    P.fX = lerp(P.fX, 50, e); P.fY = lerp(P.fY, 22, e); P.fZ = lerp(P.fZ, 18, e);
    P.fPoint = e; P.fOpen = lerp(P.fOpen, 0, e); P.hyaw = lerp(P.hyaw, 0.3, e);
  }
  return P;
}

function shimmy(b, P) {
  twoStep(b, 0.7, P);
  const wob = Math.sin(TAU * 2 * b);
  P.shM += 3.6 * wob; P.shF -= 3.6 * wob; P.croll += 0.08 * wob;
  P.mX = -17; P.mY = -10 + 2 * wob; P.mZ = 21; P.fX = 17; P.fY = -10 - 2 * wob; P.fZ = 21; P.fOpen = 0;
  P.hpitch -= 0.08; P.smile = 1; P.brow = 0.5;
  const kw = Math.sin(TAU * 2 * b + 1);
  P.lkx = 0.7 * kw; P.rkx = 0.7 * kw;
  return P;
}

// arm rolls, then snap into jazz hands and freeze while the music stops dead
function jazzFreeze(b, P, s) {
  const lb = b - s;
  armRoll(Math.min(b, s + 2.9), P);
  const e = easeOutBack(seg(lb, 2.5, 2.85), 2.4);
  P.mX = lerp(P.mX, -36, e); P.mY = lerp(P.mY, 30, e); P.mZ = lerp(P.mZ, 16, e);
  P.fX = lerp(P.fX, 38, e); P.fY = lerp(P.fY, 32, e); P.fZ = lerp(P.fZ, 16, e);
  P.fOpen = e; P.py = lerp(P.py, -12, e); P.lkx = lerp(P.lkx, -0.9, e); P.rkx = lerp(P.rkx, 0.9, e);
  P.lfx = lerp(P.lfx, -22, e); P.rfx = lerp(P.rfx, 22, e);
  P.hpitch = lerp(P.hpitch, -0.1, e); P.hroll = lerp(P.hroll, 0.08, e);
  P.wink = bump(lb, 3.5, 0.18);
  P.smile = 1; P.brow = 0.6 * e;
  // a tiny tremble while frozen
  if (lb > 3) { const tr = Math.sin(b * 90) * 0.4; P.px += tr * 0.3; }
  return P;
}

// theatre: dancing, obliviously... quick glance at the wall, then a proper stare, hands on hips
function doubleTake(b, P, s) {
  const lb = b - s;
  twoStep(Math.min(b, s + 2.95), lerp(0.9, 0.2, smoothstep(2.9, 3.2, lb)), P);
  const look1 = smoothstep(2.3, 2.42, lb) * (1 - smoothstep(2.58, 2.72, lb));
  const look2 = smoothstep(2.92, 3.1, lb);
  const look = Math.max(look1, look2);
  P.hyaw = lerp(P.hyaw, 1.0, look); P.cyaw = lerp(P.cyaw, 0.3, look2); P.hroll = lerp(P.hroll, -0.05, look);
  P.brow = look; P.mO = look2 * 0.95; P.smile = lerp(0.9, 0.2, look2);
  const hh = smoothstep(2.95, 3.3, lb);
  P.mX = lerp(P.mX, -25, hh); P.mY = lerp(P.mY, -23, hh); P.mZ = lerp(P.mZ, 3, hh); P.mPole = lerp(P.mPole, -0.8, hh);
  P.fX = lerp(P.fX, 25, hh); P.fY = lerp(P.fY, -23, hh); P.fZ = lerp(P.fZ, 3, hh); P.fPole = lerp(P.fPole, -0.8, hh);
  P.fOpen = lerp(P.fOpen, 0, hh);
  return P;
}

// "anything you can do": four hip hits on the four brass stabs (da-da-da-DAH), a wagging finger,
// then he points to the heavens on the final TAH
function challenge(b, P, s) {
  const lb = b - s;
  twoStep(b, 0.3, P);
  const k = clamp(Math.floor(lb * 4), 0, 3), u = lb * 4 - Math.floor(lb * 4);
  const hitting = lb < 1.05;
  const side = (k % 2 ? -1 : 1) * (hitting ? easeOutBack(clamp(u / 0.35, 0, 1), 2.5) : 1);
  const hold = smoothstep(1.0, 1.3, lb);
  P.pyaw = 0.34 * side * (1 - hold); P.proll = 0.08 * side * (1 - hold); P.px = 5 * side * (1 - hold);
  P.lkx = 0.8 * side; P.rkx = 0.8 * side;
  P.mX = -25; P.mY = -23; P.mZ = 3; P.mPole = -0.8;
  const up = easeOutBack(seg(lb, 1.38, 1.62), 2.2);
  P.fX = lerp(26 + 4 * Math.sin(TAU * 4 * lb), 30, up); P.fY = lerp(12, 60, up); P.fZ = lerp(18, 12, up);
  P.fPoint = 1; P.fOpen = 0;
  P.py -= 4 * up;
  P.hyaw = lerp(0.55, 0.2, up); P.hpitch = lerp(0, -0.22, up);
  P.brow = 0.9; P.smile = 0.85;
  return P;
}

// watching the shadow's cartwheel, mouth open
function watch(b, P, s) {
  const lb = b - s;
  twoStep(s, 0.25, P);
  const e = smoothstep(0.0, 0.3, lb);
  P.hyaw = 0.95 * e; P.cyaw = 0.32 * e; P.hpitch = -0.06;
  P.brow = e; P.mO = e * (1 - smoothstep(1.7, 2.0, lb)); P.smile = lerp(0.3, 1, smoothstep(1.6, 2.0, lb));
  P.mX = lerp(P.mX, -22, e); P.mY = lerp(P.mY, 6, e); P.mZ = lerp(P.mZ, 18, e);
  P.fX = lerp(P.fX, 24, e); P.fY = lerp(P.fY, 6, e); P.fZ = lerp(P.fZ, 18, e); P.fOpen = e;
  P.ppitch = -0.05 * e; P.py = -3 - 2 * e;
  return P;
}

function pointMove(b, P, s) {       // s = beat the point lands on - 0.28
  twoStep(b, 0.55, P);
  const e = easeOutBack(clamp((b - s) / 0.5, 0, 1), 2.2);
  const dp = dip(b);
  P.fX = lerp(P.fX, 49, e); P.fY = lerp(P.fY, 15 + dp * 3, e); P.fZ = lerp(P.fZ, 33 + dp * 4, e);
  P.fPoint = smoothstep(s + 0.03, s + 0.33, b); P.fOpen = lerp(P.fOpen, 0, e); P.fPole = 0.4 * e;
  P.mX = lerp(P.mX, -23, e); P.mY = lerp(P.mY, -29, e); P.mZ = lerp(P.mZ, 12, e);
  P.hroll = lerp(P.hroll, -0.15, e); P.hyaw = lerp(P.hyaw, 0.12, e);
  P.smile = 1; P.brow = 0.7 * e; P.mouth = 0.12;
  return P;
}

// Saturday-night pointing: up to the stars on the even beats, down across the body on the odd
function discoPoint(b, P) {
  twoStep(b, 0.55, P);
  const k = Math.floor(b), u = b - k;
  const up = parity(k) === 0;
  const e = easeOutBack(seg(u, 0.0, 0.24), 2.0);
  const upT = [44, 60, 14], dnT = [-18, -30, 22];
  const from = up ? dnT : upT, to = up ? upT : dnT;
  P.fX = lerp(from[0], to[0], e); P.fY = lerp(from[1], to[1], e); P.fZ = lerp(from[2], to[2], e);
  P.fPoint = 1; P.fOpen = 0; P.fPole = 0.35;
  P.mX = -25; P.mY = -23; P.mZ = 3; P.mPole = -0.8;
  const hip = lerp(up ? -1 : 1, up ? 1 : -1, e);
  P.px += -7 * hip; P.proll += -0.09 * hip;
  P.hyaw = lerp(up ? -0.1 : 0.25, up ? 0.25 : -0.1, e); P.hpitch = lerp(up ? 0.05 : -0.22, up ? -0.22 : 0.05, e);
  P.smile = 1;
  return P;
}

// he lets the mic out on its cable and whirls it round, one loop per beat
function lasso(b, P, s) {
  big(b, P);
  const tw = smoothstep(s + 0.2, s + 0.55, b) * (1 - smoothstep(s + 3.3, s + 3.65, b));
  if (tw > 0) {
    const th = TAU * (b - s) - Math.PI / 2;
    P.twirl = tw; P.twA = th;
    P.mX = lerp(P.mX, -36 + 6 * Math.cos(th + 1.6), tw);
    P.mY = lerp(P.mY, 16 + 6 * Math.sin(th + 1.6), tw);
    P.mZ = lerp(P.mZ, 14, tw);
    P.hyaw = lerp(P.hyaw, -0.25, tw); P.hroll = lerp(P.hroll, 0.12, tw);
  }
  P.mouth = 0.06; P.smile = 1;
  return P;
}

function taDa(b, P, s) {
  const lb = b - s;
  twoStep(s, 0.45, P);
  const e = easeOutBack(seg(lb, 0, 0.35), 2.2);
  const br = Math.sin(TAU * 0.5 * lb) * 0.5;
  P.mX = lerp(P.mX, -37, e); P.mY = lerp(P.mY, 44, e); P.mZ = lerp(P.mZ, 14, e);
  P.fX = lerp(P.fX, 38, e); P.fY = lerp(P.fY, 46, e); P.fZ = lerp(P.fZ, 14, e); P.fOpen = e;
  P.py = lerp(P.py, -2 + br, e); P.hpitch = lerp(P.hpitch, -0.2, e); P.hroll = lerp(P.hroll, -0.06, e);
  P.lfx = -17; P.rfx = 13; P.rheel = 11 * e; P.lheel = 0; P.rkx = lerp(P.rkx, -0.9, e);
  P.smile = 1; P.brow = 0.8 * e; P.mouth = 0.3 * e;
  return P;
}

function bow(b, P, s) {
  const lb = b - s;
  taDa(s + 1.5, P, s);
  const down = smoothstep(0.35, 1.15, lb) * (1 - smoothstep(2.3, 3.1, lb));
  const settle = smoothstep(0, 0.4, lb);
  P.lfx = -14; P.rfx = 14; P.rheel = lerp(P.rheel, 0, settle);
  P.ppitch = 0.22 * down; P.cpitch = 0.03 + 0.5 * down; P.hpitch = lerp(P.hpitch, 0.4, down);
  P.mX = lerp(P.mX, -2, settle); P.mY = lerp(P.mY, -17, settle); P.mZ = lerp(P.mZ, 23, settle);
  P.fX = lerp(P.fX, lerp(34, 50, down), settle); P.fY = lerp(P.fY, lerp(-6, -2, down), settle); P.fZ = lerp(P.fZ, lerp(12, -6, down), settle);
  P.py = -3 - 3 * down;
  P.smile = 1; P.blink = down > 0.55 ? 1 : 0; P.mouth = 0.05;
  return P;
}

// in the gallery: he peers down out of his frame at the wall label as someone paints over it,
// does a double take, then turns back to us, grins, winks and points
function readLabel(b, P, s) {
  const lb = b - s;
  twoStep(s, 0.2, P);
  const look = smoothstep(0.0, 0.45, lb) * (1 - smoothstep(2.05, 2.35, lb));
  P.hpitch = lerp(P.hpitch, 0.42, look); P.hyaw = lerp(P.hyaw, 0.12, look); P.cpitch += 0.14 * look; P.ppitch = 0.05 * look;
  P.mX = -22; P.mY = -20; P.mZ = 10; P.fX = 24; P.fY = -18; P.fZ = 10;
  const shock = smoothstep(0.55, 0.75, lb) * (1 - smoothstep(2.1, 2.3, lb));
  P.brow = shock; P.mO = shock * 0.9; P.smile = lerp(0.6, 0.2, shock);
  P.py = -3 + 2 * shock;
  const e = easeOutBack(seg(lb, 2.25, 2.6), 2.2);
  P.fX = lerp(P.fX, 46, e); P.fY = lerp(P.fY, 14, e); P.fZ = lerp(P.fZ, 34, e); P.fPoint = e; P.fPole = 0.4 * e;
  P.hroll = lerp(P.hroll, -0.12, e); P.smile = lerp(P.smile, 1, e);
  P.wink = bump(lb, 2.62, 0.16);
  return P;
}

function waveBye(b, P) {
  twoStep(b, 0.35, P);
  P.fX = 31 + 7 * Math.sin(TAU * 2 * b); P.fY = 40; P.fZ = 14; P.fOpen = 1; P.fPole = 0.5;
  P.hroll = 0.08; P.smile = 1;
  return P;
}

// ---------------------------------------------------------------- the running order
const SECTIONS = [
  { b: -20, f: under },
  { b: 16, f: (b, P) => twoStep(b, lerp(0.7, 1.0, seg(b, 16, 18)), P) },
  { b: 24, f: snaps },
  { b: 28, f: armRoll },
  { b: 32, f: sing },
  { b: 38, f: spin },
  { b: 40, f: big },
  { b: 44, f: bigPoint },
  { b: 48, f: shimmy },
  { b: 52, f: jazzFreeze },
  { b: 56, f: (b, P) => twoStep(b, lerp(0.5, 1.0, seg(b, 56, 57)), P) },
  { b: 60, f: doubleTake },
  { b: 64, f: challenge },
  { b: 66, f: watch },
  { b: 68, f: (b, P) => { twoStep(b, 1.0, P); P.hyaw += 0.25; return P; } },
  { b: 70, f: (b, P) => pointMove(b, P, 70.25) },
  { b: 72, f: spin },
  { b: 74, f: big },
  { b: 80, f: discoPoint },
  { b: 84, f: lasso },
  { b: 88, f: shimmy },
  { b: 90, f: (b, P) => twoStep(b, 1.0, P) },
  { b: 92, f: sing },
  { b: 96, f: (b, P) => { pointMove(b, P, 96.72); P.wink = bump(b, 98.1, 0.3); return P; } },
  { b: 100, f: taDa },
  { b: 104, f: bow },
  { b: 107, f: readLabel },
  { b: 110, f: waveBye }
];

// natural blinks, a couple per bar
function naturalBlink(b) {
  const k = Math.floor(b / 2.7);
  const c = k * 2.7 + 0.4 + hash(k * 7.7) * 1.8;
  return bump(b, c, 0.045);
}

function danceAt(t) {
  const b = t / BEAT;
  let i = 0;
  while (i + 1 < SECTIONS.length && b >= SECTIONS[i + 1].b) i++;
  const S = SECTIONS[i];
  let P = S.f(b, basePose(), S.b);
  if (i > 0 && b < S.b + 0.25) {
    const Q = SECTIONS[i - 1].f(b, basePose(), SECTIONS[i - 1].b);
    P = lerpPose(Q, P, smoothstep(S.b - 0.35, S.b + 0.25, b));
  }
  if (i + 1 < SECTIONS.length) {
    const N = SECTIONS[i + 1];
    if (b > N.b - 0.35) {
      const Q = N.f(b, basePose(), N.b);
      P = lerpPose(P, Q, smoothstep(N.b - 0.35, N.b + 0.25, b));
    }
  }
  if (b > 16) P.blink = Math.max(P.blink, naturalBlink(b));
  return P;
}

// ============================================================
// The shadow in the theatre has ideas of its own.
// Returns the pose it strikes at time t, or null when it simply copies the dancer.
// ============================================================
function floss(b, P) {
  const s = sideHit(b * 2, 0, 0.3, 0.3, 1.3);
  const g = (s + 1) / 2;
  const front = parity(Math.floor(b * 2 + 0.5)) === 0 ? 1 : -1;
  P.px = -s * 13; P.proll = s * 0.12; P.croll = -s * 0.05; P.py = -6 - 4 * dip(b * 2);
  P.mX = lerp(-42, 8, g); P.mY = -36; P.mZ = 14 * front;
  P.fX = lerp(-8, 42, g); P.fY = -36; P.fZ = -14 * front;
  P.lfx = -17; P.rfx = 17; P.lkx = -0.6; P.rkx = 0.6;
  P.hroll = s * 0.1;
  return P;
}
function crossArms(b, P) {
  twoStep(b, 0.15, P);
  P.mX = 12; P.mY = -2; P.mZ = 17; P.fX = -12; P.fY = 1; P.fZ = 19;
  P.rheel = 9 * Math.pow(Math.max(0, Math.sin(Math.PI * b)), 4);
  P.hroll = 0.12 * Math.sin(Math.PI * 0.5 * b); P.hpitch = -0.1;
  return P;
}
function cartwheel(b, P, s) {
  const lb = b - s;
  const u = seg(lb, 0.25, 1.55);
  P.mX = -36; P.mY = 46; P.mZ = 6; P.fX = 36; P.fY = 46; P.fZ = 6; P.fOpen = 1;
  P.lfx = -38; P.rfx = 38; P.lkx = -0.2; P.rkx = 0.2; P.py = -4;
  P.flip = TAU * easeInOutCubic(u);
  P.ry = 30 * Math.sin(Math.PI * u);
  const land = smoothstep(1.55, 1.8, lb);
  P.lfx = lerp(P.lfx, -24, land); P.rfx = lerp(P.rfx, 24, land); P.py -= 8 * land * (1 - smoothstep(1.8, 2.0, lb));
  return P;
}
function hatTip(b, P, s, rick) {
  Object.assign(P, rick);
  const lb = b - s;
  const lift = smoothstep(0.25, 0.6, lb) * (1 - smoothstep(1.3, 1.75, lb));
  P.hat = 1; P.hatLift = lift;
  P.fX = lerp(P.fX, 8, lift); P.fY = lerp(P.fY, 56, lift); P.fZ = lerp(P.fZ, 8, lift); P.fOpen = 0;
  P.croll += 0.08 * lift; P.hroll += 0.12 * lift; P.hpitch += 0.15 * lift;
  return P;
}

const SHADOW_SECTIONS = [
  { b: 60.35, e: 64, f: floss },
  { b: 64, e: 66, f: crossArms },
  { b: 66, e: 68, f: cartwheel },
  { b: 69.2, e: 72.4, f: hatTip }
];
// rick: the pose the shadow would have if it simply copied him
function shadowPoseAt(t, rick) {
  const b = t / BEAT;
  let out = null, w = 0;
  for (const S of SHADOW_SECTIONS) {
    const k = smoothstep(S.b - 0.2, S.b + 0.15, b) * (1 - smoothstep(S.e - 0.15, S.e + 0.2, b));
    if (k <= 0) continue;
    const P = S.f(b, basePose(), S.b, rick);
    out = out ? lerpPose(out, P, k) : lerpPose(rick, P, k);
    w = Math.max(w, k);
  }
  if (!out) return rick;
  // the hat stays on once it has appeared
  if (b > 69.2 && b < 72.4) out.hat = 1;
  return out;
}
