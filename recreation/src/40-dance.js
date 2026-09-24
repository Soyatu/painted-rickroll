// ============================================================================
// Choreography, in beats (0..120). Each move writes pose parameters; the
// running order blends neighbouring moves over a short window.
// ============================================================================
const parity = k => (mod(k, 2) === 0 ? 1 : -1);

// -1..1, arriving on the new side exactly on each beat with a little overshoot
function side(b, lag, lead, settle, over) {
  b -= lag || 0;
  const ld = lead === undefined ? 0.42 : lead, se = settle === undefined ? 0.14 : settle;
  const k = Math.floor(b + ld);
  const u = (b - (k - ld)) / (ld + se);
  return lerp(parity(k - 1), parity(k), easeInOutBack(u, over === undefined ? 1.15 : over));
}
// knee dip, 1 exactly on the beat
const dip = b => Math.pow(0.5 + 0.5 * Math.cos(TAU * b), 2.5);
const bump = (b, c, w) => Math.exp(-((b - c) * (b - c)) / (2 * w * w));
// 0..1 ramp between beats, eased
const ramp = (b, b0, b1, e) => (e || easeInOut)((b - b0) / (b1 - b0));

// ---------------------------------------------------------------- the signature two-step
function twoStep(b, P, amp) {
  const s = side(b);
  const sa = side(b, 0.07, 0.4, 0.3, 1.7);
  const dp = dip(b);
  P.x = s * 10 * amp;
  P.y = -3 - dp * 8 * amp;
  P.roll = s * 0.12 * amp;
  P.yaw = s * 0.13 * amp;
  P.croll = -s * 0.14 * amp;
  P.cyaw = -sa * 0.25 * amp;
  P.cpitch = 0.04 + dp * 0.1 * amp;
  P.hroll = s * 0.1 * amp;
  P.hpitch = -0.03 + dp * 0.15 * amp;
  P.hyaw = -sa * 0.12 * amp;
  const a = -sa;
  P.mx = -12 + 16 * a * amp; P.my = -22 + 8 * a * amp - dp * 4; P.mz = 23 - 3 * Math.abs(a) * amp;
  P.fx = 12 + 16 * a * amp; P.fy = -22 - 8 * a * amp - dp * 4; P.fz = 23 - 3 * Math.abs(a) * amp;
  P.fOpen = sstep(-0.25, 0.25, Math.sin(Math.PI * (b + 0.25)));
  P.lfx = -17; P.rfx = 17;
  P.lheel = Math.max(0, s) * 8 * amp;
  P.rheel = Math.max(0, -s) * 8 * amp;
  P.lkx = lerp(-0.3, 0.9, sat(s * amp));
  P.rkx = lerp(0.3, -0.9, sat(-s * amp));
  P.shM = Math.max(0, -s) * 2 * amp;
  P.shF = Math.max(0, s) * 2 * amp;
  P.smile = 0.9;
  P.mouth = 0.04 + 0.06 * dp;
  P.squash = 0.035 * amp;
  return P;
}

// ---------------------------------------------------------------- in the river
// The quiff rises like a moon (bars 2), the eyes peek (bar 2.5), the scratch, the
// drum fill, and then the burst on the downbeat of bar 4.
function mvSubmerged(b, P) {
  P.y = keyed([[0, -205], [7.4, -205], [10.2, -178], [11.0, -178], [11.7, -163], [14.0, -163], [15.3, -172], [15.9, -176]], b);
  P.y += Math.sin(b * 1.7) * 1.2;
  P.mx = -24; P.my = -34; P.mz = 16; P.fx = 24; P.fy = -34; P.fz = 16;
  P.lfx = -10; P.rfx = 10; P.feetRel = 1;
  P.lfy = 18; P.rfy = 22; P.lkx = -0.2; P.rkx = 0.2;
  // eyes: look left, right, then straight at us; the scratch opens them wide
  P.lookX = keyed([[11.6, 0], [12.0, -1], [12.6, -1], [12.9, 1], [13.4, 1], [13.7, 0]], b);
  P.hyaw = P.lookX * 0.16;
  P.eyeWide = pulse(11.9, 12.05, 13.6, 14.0, b) * 0.4 + pulse(12.0, 12.08, 12.9, 13.2, b) * 0.6;
  P.brow = 0.25 + P.eyeWide * 0.8;
  P.blink = bump(b, 11.4, 0.06) + bump(b, 14.6, 0.07);
  P.smile = 0.25; P.mouth = 0;
  P.hpitch = -0.05;
  return P;
}

function mvBurst(b, P) {
  // pelvis flight: from the water to a peak and down to the cobbles
  const up = easeOut((b - 16) / 0.72, 2.2);
  const peak = 36;
  let y;
  if (b < 16.72) y = lerp(-176, peak, up);
  else { const u = (b - 16.72) / 0.6; y = peak - 44 * u * u; }
  const land = sstep(17.25, 17.4, b);
  y = lerp(y, -9 + 9 * sstep(17.4, 17.9, b), land);
  P.y = y;
  const air = 1 - land;
  P.feetRel = air;
  P.lfx = lerp(-14, -18, land); P.rfx = lerp(14, 18, land);
  P.lfy = air * 10; P.rfy = air * 16;
  P.lfz = 2 + air * 4; P.rfz = 2 - air * 6;
  P.lkx = -0.6; P.rkx = 0.6;
  // arms flung up in a V, down again on landing
  const arms = pulse(16.0, 16.3, 17.0, 17.5, b);
  P.mx = lerp(-20, -44, arms); P.my = lerp(-24, 50, arms); P.mz = lerp(18, 8, arms);
  P.fx = lerp(20, 44, arms); P.fy = lerp(-24, 50, arms); P.fz = lerp(18, 8, arms);
  P.fOpen = 1;
  P.cpitch = -0.12 * arms + 0.1 * land * (1 - sstep(17.4, 17.9, b));
  P.hpitch = -0.25 * arms;
  P.smile = 1; P.mouth = 0.35 * arms; P.brow = 0.8 * arms;
  P.squash = 0.06;
  return P;
}

// ---------------------------------------------------------------- the railway arch
function mvSnaps(b, P) {
  twoStep(b, P, 0.65);
  const dp = dip(b), s = side(b);
  // free hand up by the shoulder, clicking on 2 and 4
  P.fx = 30 + 3 * s; P.fy = 12 + dp * 3; P.fz = 18; P.fPole = 0.3;
  const k = mod(b - 1, 2);                    // 0 on each backbeat
  P.fSnap = k < 0.12 ? 1 - k / 0.12 : k > 1.7 ? (k - 1.7) / 0.3 : 0;
  P.fOpen = 0;
  P.mx = -16 + 4 * s; P.my = -8 + dp * 3; P.mz = 22;
  P.shF = 3 * dp; P.hroll = s * 0.12; P.hyaw = 0.12;
  P.smile = 1;
  return P;
}

function mvArmRolls(b, P) {
  twoStep(b, P, 0.7);
  const lr = keyed([[28, -1], [29.7, -1], [30.1, 1], [31.7, 1], [32.1, 0]], b);  // which side the roll travels to
  const th = TAU * (b - 28);
  const c = V(lr * 12, -12, 27);
  const r = 8.5;
  P.mx = c.x + Math.cos(th) * r - 3; P.my = c.y + Math.sin(th) * r; P.mz = c.z;
  P.fx = c.x + Math.cos(th + Math.PI) * r + 3; P.fy = c.y + Math.sin(th + Math.PI) * r; P.fz = c.z + 2;
  P.fOpen = 0.2; P.mPole = 0.4; P.fPole = 0.4;
  P.cyaw = lr * 0.22; P.hyaw = lr * 0.18; P.hroll = -lr * 0.06;
  P.smile = 1;
  return P;
}

function mvSing(b, P) {
  twoStep(b, P, 0.55);
  const s = side(b), sa = side(b, 0.1, 0.35, 0.36, 1.8);
  const dp = dip(b);
  P.mx = -4 + s * 1.5; P.my = 15 + dp * 1.5; P.mz = 17; P.micAim = 1; P.mPole = 0.25;
  P.fx = 38 + 4 * sa; P.fy = 8 + 8 * sa + 3 * dp; P.fz = 22 - 5 * sa; P.fOpen = 1; P.fPole = 0.25; P.fPalm = 1;
  P.hpitch = -0.14 + dp * 0.08; P.hroll = -0.08 + s * 0.06; P.hyaw = -0.06;
  P.mouth = singMouth(b);
  P.brow = 0.6;
  P.blink = 0.85 * pulse(34.0, 34.2, 34.9, 35.1, b);
  P.smile = 0.35;
  return P;
}
// mouth shapes follow the notes of the lead line in the score
function singMouth(b) {
  const notes = (typeof SCORE !== 'undefined' && SCORE.lead) || [];
  let m = 0;
  for (const n of notes) {
    if (b < n.b - 0.1 || b > n.b + n.d + 0.15) continue;
    const u = (b - n.b) / Math.max(n.d, 0.2);
    m = Math.max(m, (0.45 + 0.5 * hash(n.b * 3.1)) * sstep(-0.1, 0.08, u) * (1 - sstep(0.85, 1.15, u)));
  }
  return m;
}

// a skater's spin: wind up, two turns with the arms pulled in, open out
function mvSpin(b, P) {
  const wind = ramp(b, 36, 36.6);
  const turn = ramp(b, 36.6, 39.1, easeInOut5);
  const open = ramp(b, 38.9, 39.5, t => easeOutBack(t, 1.6));
  P.spin = -0.5 * wind * (1 - turn) + TAU * 2 * turn;
  const tuck = sat(wind * 2) * (1 - open);
  P.y = -6 * wind * (1 - turn) + 4 * turn * (1 - open) - 3 * open;
  // arms: open on the wind-up, hugged in for the turns, flung out at the end
  const wide = wind * (1 - sstep(36.5, 36.8, b));
  P.mx = lerp(lerp(-30, -44, wide), -6, tuck); P.my = lerp(lerp(-20, 4, wide), -8, tuck); P.mz = lerp(16, 16, tuck);
  P.fx = lerp(lerp(30, 44, wide), 7, tuck); P.fy = lerp(lerp(-20, 4, wide), -6, tuck); P.fz = lerp(16, 18, tuck);
  P.mx = lerp(P.mx, -46, open); P.my = lerp(P.my, 14, open); P.mz = lerp(P.mz, 10, open);
  P.fx = lerp(P.fx, 46, open); P.fy = lerp(P.fy, 14, open); P.fz = lerp(P.fz, 10, open);
  P.fOpen = open; P.fPalm = open;
  // the free leg tucks up against the standing knee (passe), onto the ball of the foot
  const pas = sstep(36.6, 36.9, b) * (1 - sstep(38.9, 39.3, b));
  P.lfx = lerp(-15, -3, pas); P.lfz = 2; P.lheel = 10 * pas;
  P.rfx = lerp(15, 4, pas); P.rfy = 36 * pas; P.rfz = lerp(2, 6, pas); P.rkx = lerp(0.3, 1.4, pas);
  P.lfyaw = -0.2; P.rfyaw = 0.2;
  P.cpitch = 0.02; P.hpitch = -0.05 - 0.08 * tuck;
  P.smile = 1; P.mouth = 0.08 + 0.3 * open; P.brow = 0.4 * open;
  P.squash = 0;
  return P;
}

// ---------------------------------------------------------------- the pop-art prints
function mvPopStep(b, P) { twoStep(b, P, 1.12); P.smile = 1; return P; }
function mvShimmy(b, P) {
  twoStep(b, P, 0.45);
  const q = Math.sin(TAU * 2 * b);
  P.cyaw = q * 0.2; P.shM = 2 + 3 * q; P.shF = 2 - 3 * q; P.croll = 0.04 * q;
  P.cpitch = 0.12; P.y -= 6;
  P.mx = -24; P.my = -24; P.mz = 14; P.fx = 25; P.fy = -26; P.fz = 10; P.fOpen = 0; P.fHip = 1;
  P.hroll = 0.1 * Math.sin(TAU * b); P.smile = 1; P.brow = 0.5;
  return P;
}
function mvDiscoPoint(b, P) {
  twoStep(b, P, 0.8);
  const up = side(b, 0, 0.3, 0.12, 1.3);       // +1 pointing up-right, -1 down across the body
  P.fx = lerp(8, 44, sat((up + 1) / 2)); P.fy = lerp(-36, 52, sat((up + 1) / 2)); P.fz = lerp(24, 14, sat((up + 1) / 2));
  P.fPoint = 1; P.fOpen = 0; P.fPole = 0.35;
  P.mx = -24; P.my = -22; P.mz = 16;
  P.hyaw = 0.18 * up; P.hpitch = -0.18 * up; P.croll = -0.1 * up; P.roll = 0.05 * up;
  P.smile = 1;
  return P;
}
function mvPopFreeze(b, P) {
  twoStep(b, P, 0.9);
  // step-touch claps on 2 and 4, then the freeze and the wink
  const k = mod(b - 1, 2);
  const clap = k < 0.15 ? 1 - k / 0.15 : k > 1.65 ? (k - 1.65) / 0.35 : 0;
  P.mx = lerp(-26, -3, clap); P.my = lerp(-8, 4, clap); P.mz = 26;
  P.fx = lerp(26, 5, clap); P.fy = lerp(-8, 4, clap); P.fz = 26; P.fOpen = 1; P.fPalm = 1 - clap;
  const fr = sstep(54.3, 54.55, b);
  if (fr > 0) {
    const Q = pose0();
    Q.x = 8; Q.y = -4; Q.roll = 0.14; Q.yaw = 0.25; Q.croll = -0.16; Q.cyaw = -0.1; Q.cpitch = 0.02;
    Q.hroll = 0.2; Q.hyaw = -0.12; Q.hpitch = -0.04;
    Q.mx = -26; Q.my = 0; Q.mz = 20; Q.mPole = 0.2;
    Q.fx = 25; Q.fy = -26; Q.fz = 8; Q.fHip = 1; Q.fOpen = 0;
    Q.lfx = -24; Q.lfz = 6; Q.lheel = 9; Q.lfyaw = -0.5; Q.rfx = 12; Q.rfz = -2; Q.lkx = 0.9; Q.rkx = 0.4;
    Q.smile = 1; Q.brow = 0.9 * bump(b, 55.2, 0.3) + 0.3;
    Q.wink = pulse(54.9, 55.05, 55.55, 55.75, b);
    Q.mouth = 0.02;
    Object.assign(P, poseLerp(P, Q, fr));
  }
  return P;
}

// ---------------------------------------------------------------- theatre: he watches his shadow
function mvTheatre(b, P) {
  const amp = keyed([[56, 0.15], [57, 0.15], [57.3, 0.7], [63.6, 0.7], [64, 0.2], [68.2, 0.2], [68.6, 0.55], [71, 0.55], [71.5, 0.2]], b);
  twoStep(b, P, amp);
  // the spot hits him: a presenting pose
  const pres = pulse(56.9, 57.1, 57.6, 58.1, b);
  P.mx = lerp(P.mx, -36, pres); P.my = lerp(P.my, 20, pres);
  P.fx = lerp(P.fx, 36, pres); P.fy = lerp(P.fy, 20, pres); P.fOpen = Math.max(P.fOpen, pres); P.fPalm = pres;
  // glances back at the wall, then watches the cartwheels over his shoulder
  const look = Math.max(pulse(61.0, 61.3, 61.7, 62.0, b) * 0.7, pulse(62.8, 63.0, 63.4, 63.6, b) * 0.9,
    pulse(64.0, 64.4, 67.7, 68.2, b));
  const follow = b > 64 && b < 68.2 ? Math.sin(Math.PI * (b - 64) / 2) * 0.3 : 0;
  P.yaw += look * (0.55 + follow); P.cyaw += look * 0.35; P.hyaw += look * 0.6;
  P.hpitch -= look * 0.08;
  P.brow = Math.max(P.brow, look * 0.8);
  P.mouth = Math.max(P.mouth, look * 0.18 * (b > 64 ? 1 : 0));
  // the shadow tips its hat: he pats his own bare head, then shrugs
  const pat = pulse(70.2, 70.5, 71.0, 71.3, b);
  const tap = Math.sin(TAU * 4 * (b - 70.3)) * 2;
  P.fx = lerp(P.fx, 4, pat); P.fy = lerp(P.fy, 44 + tap * pat, pat); P.fz = lerp(P.fz, 6, pat); P.fOpen = lerp(P.fOpen, 1, pat); P.fPalm = 0;
  P.fPole = lerp(P.fPole, 0.6, pat);
  P.hpitch += pat * 0.1; P.brow = Math.max(P.brow, pat);
  const shrug = pulse(71.2, 71.4, 71.8, 72.0, b);
  P.shM += shrug * 6; P.shF += shrug * 6;
  P.mx = lerp(P.mx, -30, shrug); P.my = lerp(P.my, -12, shrug); P.mz = lerp(P.mz, 22, shrug);
  P.fx = lerp(P.fx, 30, shrug); P.fy = lerp(P.fy, -12, shrug); P.fz = lerp(P.fz, 22, shrug); P.fPalm = Math.max(P.fPalm, shrug);
  P.smile = lerp(P.smile, 0.3, Math.max(look, pat) * 0.8);
  return P;
}

// ---------------------------------------------------------------- the starry night
function mvStarStep(b, P) {
  twoStep(b, P, 1.2);
  const s = side(b, 0, 0.42, 0.14, 1.3), g = (s + 1) / 2;
  const dp = dip(b);
  P.x += s * 8;
  P.lfx = lerp(-30, 2, g); P.rfx = lerp(-2, 30, g);
  const arc = Math.sin(Math.PI * g);
  P.lfy = arc * 5; P.rfy = arc * 4;
  const sa = -side(b, 0.08, 0.36, 0.36, 1.9);
  P.mx = -12 + 22 * sa; P.my = -12 + 13 * sa - dp * 5; P.mz = 24;
  P.fx = 12 + 22 * sa; P.fy = -12 - 13 * sa - dp * 5; P.fz = 24;
  // points to the stars at the end of each phrase
  const pt = Math.max(pulse(78.9, 79.2, 79.8, 80.1, b), pulse(86.9, 87.2, 87.8, 88.1, b));
  P.fx = lerp(P.fx, 40, pt); P.fy = lerp(P.fy, 62, pt); P.fz = lerp(P.fz, 12, pt); P.fPoint = pt;
  P.hpitch -= pt * 0.35; P.hyaw += pt * 0.15;
  P.smile = 1;
  return P;
}
function mvLasso(b, P) {
  twoStep(b, P, 0.6);
  const on = sstep(88.0, 88.5, b) * (1 - sstep(95.4, 95.9, b));
  // mic hand up overhead, the mic whirling round on its cable, one loop per beat
  P.mx = lerp(P.mx, -8, on); P.my = lerp(P.my, 48, on); P.mz = lerp(P.mz, 8, on); P.mPole = 0.3;
  P.lasso = on; P.lassoA = TAU * (b - 88) - Math.PI / 2;
  P.lassoR = 44; P.lassoTilt = 0.45;
  P.fx = lerp(P.fx, 30, on); P.fy = lerp(P.fy, -18, on); P.fz = lerp(P.fz, 12, on); P.fHip = on;
  P.hpitch -= 0.3 * on; P.hyaw += 0.1 * Math.sin(P.lassoA) * on;
  P.smile = 1; P.mouth = 0.1 + 0.15 * on;
  return P;
}
function mvBuild(b, P) {
  twoStep(b, P, 0.5 + 0.5 * ramp(b, 96, 100));
  const r = ramp(b, 96, 99.8);
  const bb = Math.sin(TAU * 2 * b) * (0.3 + r);
  P.y -= 3 * Math.abs(bb);
  P.mx = lerp(P.mx, -30, r); P.my = lerp(P.my, 20, r); P.mz = lerp(P.mz, 14, r);
  P.fx = lerp(P.fx, 30, r); P.fy = lerp(P.fy, 20, r); P.fz = lerp(P.fz, 14, r); P.fOpen = r;
  P.cpitch -= 0.12 * r; P.hpitch -= 0.15 * r;
  P.smile = 1; P.brow = r * 0.6; P.mouth = 0.1 + 0.2 * r;
  return P;
}
function taDaPose(P) {
  P.x = -4; P.y = -5; P.yaw = -0.12; P.roll = -0.04; P.cyaw = 0.08; P.cpitch = -0.14; P.croll = 0.04;
  P.hyaw = -0.08; P.hpitch = -0.12; P.hroll = -0.08;
  P.mx = -60; P.my = 46; P.mz = 6; P.mPole = 0.1;
  P.fx = 60; P.fy = 48; P.fz = 6; P.fOpen = 1; P.fPalm = 1;
  P.lfx = -26; P.lfz = 14; P.lheel = 0; P.lfy = 0; P.lfyaw = -0.35; P.lkx = -0.2;
  P.rfx = 14; P.rfz = -4; P.rkx = 0.7;
  P.smile = 1; P.brow = 0.7; P.mouth = 0.15; P.shM = 3; P.shF = 3;
  return P;
}
function mvTaDa(b, P) {
  const e = easeOutBack(ramp(b, 100, 100.5, t => t), 2.2);
  const from = mvBuild(Math.min(b, 99.99), pose0());
  const to = taDaPose(pose0());
  Object.assign(P, poseLerp(from, to, e));
  // hold very still as the painting, then one sly wink at the laughing visitor
  P.wink = pulse(110.6, 110.8, 111.4, 111.6, b);
  P.blink = bump(b, 106.5, 0.08) * (b < 110 ? 1 : 0);
  return P;
}

const DANCE = [
  { b: -99, f: mvSubmerged },
  { b: 16, f: mvBurst, blend: 0.05 },
  { b: 17.7, f: (b, P) => twoStep(b, P, 1.0), blend: 0.4 },
  { b: 24, f: mvSnaps },
  { b: 28, f: mvArmRolls },
  { b: 32, f: mvSing },
  { b: 36, f: mvSpin },
  { b: 39.6, f: mvPopStep, blend: 0.4 },
  { b: 44, f: mvShimmy },
  { b: 48, f: mvDiscoPoint },
  { b: 52, f: mvPopFreeze },
  { b: 56, f: mvTheatre },
  { b: 72, f: mvStarStep },
  { b: 88, f: mvLasso },
  { b: 96, f: mvBuild },
  { b: 100, f: mvTaDa, blend: 0.02 }
];

function danceAt(b) {
  b = mod(b, BEATS);
  let i = 0;
  while (i + 1 < DANCE.length && b >= DANCE[i + 1].b) i++;
  let P = DANCE[i].f(b, pose0());
  const cur = DANCE[i];
  const bl = cur.blend !== undefined ? cur.blend : 0.3;
  if (i > 0 && b < cur.b + bl) {
    const Q = DANCE[i - 1].f(b, pose0());
    P = poseLerp(Q, P, sstep(cur.b - bl, cur.b + bl, b));
  }
  if (i + 1 < DANCE.length) {
    const nx = DANCE[i + 1], nbl = nx.blend !== undefined ? nx.blend : 0.3;
    if (b > nx.b - nbl) {
      const Q = nx.f(b, pose0());
      P = poseLerp(P, Q, sstep(nx.b - nbl, nx.b + nbl, b));
    }
  }
  return P;
}

// ---------------------------------------------------------------- the shadow's own routine (theatre)
function shadowPoseAt(b) {
  const man = danceAt(b - 0.15);
  if (b < 60 || b >= 72) return man;
  let P = pose0();
  if (b < 64) {
    // the floss: straight arms swing past the hips, hips swing the other way
    const s = Math.sin(TAU * (b - 60) * 1.0);
    const q = side(b * 2, 0, 0.3, 0.1, 1.2);
    P.x = -q * 9; P.roll = -q * 0.12; P.yaw = 0; P.croll = q * 0.1;
    P.mx = -8 + q * 26; P.my = -44; P.mz = 10 + 12 * s;
    P.fx = 8 + q * 26; P.fy = -44; P.fz = 10 - 12 * s;
    P.fOpen = 0.6;
    P.hroll = q * 0.12;
    P.y = -2 - 4 * dip(b * 2);
    const w = sstep(60, 60.3, b) * (1 - sstep(63.7, 64, b));
    return poseLerp(man, P, w);
  }
  if (b < 68) {
    // two cartwheels: over to the right and back again
    const first = b < 66;
    const u = first ? ramp(b, 64.15, 65.85, easeInOut) : ramp(b, 66.15, 67.85, easeInOut);
    const dir = first ? 1 : -1;
    const x0 = first ? 0 : 95;
    P.x = x0 + dir * 95 * u;
    P.croot = -dir * TAU * u;
    P.rootY = 100;
    const star = Math.sin(Math.PI * u);
    P.mx = -34; P.my = 40; P.mz = 4; P.fx = 34; P.fy = 40; P.fz = 4; P.fOpen = 1;
    P.lfx = -14 - 30 * star; P.rfx = 14 + 30 * star; P.feetRel = 1;
    P.lfy = 40 * star * 0; P.y = 6 * star;
    const w = sstep(64, 64.2, b) * (1 - sstep(67.8, 68, b));
    return poseLerp(man, P, w);
  }
  // the top hat he isn't wearing
  P = danceAt(b - 0.15);
  P.hat = 1;
  const lift = pulse(69.4, 70.0, 70.8, 71.3, b);
  const bow = pulse(69.8, 70.2, 70.6, 71.0, b);
  P.fx = lerp(P.fx, 4, sstep(69.0, 69.4, b) * (1 - sstep(71.3, 71.6, b)));
  P.fy = lerp(P.fy, 44 + 26 * lift, sstep(69.0, 69.4, b) * (1 - sstep(71.3, 71.6, b)));
  P.fz = lerp(P.fz, 8 + 24 * bow, sstep(69.0, 69.4, b) * (1 - sstep(71.3, 71.6, b)));
  P.hatLift = lift;
  P.cpitch += 0.35 * bow; P.hpitch += 0.2 * bow;
  P.mx = lerp(P.mx, -30, bow); P.my = lerp(P.my, -20, bow); P.mz = lerp(P.mz, -12, bow);
  return P;
}
