// ============================================================
// WebGL2: stroke renderer (MRT colour + paint height) and composite
// ============================================================
const cv = document.getElementById('paint');
const gl = cv.getContext('webgl2', {
  antialias: false, alpha: false, depth: false, stencil: false,
  premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance'
});
if (!gl) {
  document.body.innerHTML = '<p style="color:#cbb;font:16px/1.5 Georgia,serif;padding:2em">This painting needs WebGL2 to move.</p>';
  throw new Error('WebGL2 unavailable');
}
const HAS_CBF = !!gl.getExtension('EXT_color_buffer_float');
cv.addEventListener('webglcontextlost', e => e.preventDefault());
cv.addEventListener('webglcontextrestored', () => location.reload());

const STROKE_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_p;
layout(location=3) in vec3 a_rev;
layout(location=4) in vec4 a_col;
layout(location=5) in vec4 a_col2;
layout(location=6) in vec4 a_ex;
uniform vec2 u_res;
uniform mat4 u_vp;
uniform float u_world;
uniform float u_boil;
uniform float u_jit;
out vec2 v_uv; flat out vec4 v_p; flat out vec3 v_rev; out vec4 v_col; flat out vec4 v_col2; flat out vec4 v_ex;
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
void main(){
  if (u_world > 0.5) {
    vec3 wp = a_pos;
    float s = a_p.z;
    wp.xy += (vec2(h11(s * 7.31 + u_boil * 3.17), h11(s * 3.77 + u_boil * 5.3)) - 0.5) * u_jit;
    gl_Position = u_vp * vec4(wp, 1.0);
  } else {
    vec2 c = a_pos.xy / u_res * 2.0 - 1.0;
    gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  }
  v_uv = a_uv; v_p = vec4(a_p.x, a_p.y, a_p.z + u_boil * 0.3719, a_p.w); v_rev = a_rev; v_col = a_col; v_col2 = a_col2; v_ex = a_ex;
}`;

// Each stroke carries two delays (s): when its paint goes on and when it lifts off.
// u_tIn / u_tOut are the clocks those delays are measured against, so every painted
// world can be brought in and scraped away on its own schedule.
const STROKE_FS = `#version 300 es
precision highp float;
in vec2 v_uv; flat in vec4 v_p; flat in vec3 v_rev; in vec4 v_col; flat in vec4 v_col2; flat in vec4 v_ex;
uniform float u_mask;
uniform float u_tIn, u_tOut;
layout(location=0) out vec4 o_col;
layout(location=1) out vec4 o_hgt;
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1,0)), u.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), u.x), u.y); }
float ease(float x){ x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main(){
  float k = v_rev.z;                  // stroke units -> css px
  float W = max(v_p.y * k, 0.5);      // stroke width, css px
  float u = v_uv.x * k;               // distance along stroke, css px
  float Lc = v_p.x * k;
  float v = v_uv.y;                   // across, -1.15..1.15
  float av = abs(v);
  float seed = mod(v_p.z, 97.0), th = v_p.w;
  float kind = floor(v_ex.z * 255.0 + 0.5);
  float dry = v_col2.a;
  float aa = max(fwidth(v), 0.002) * 1.1;
  float t = clamp(u / max(Lc, 1.0), 0.0, 1.0);
  float bIn = v_rev.x < -5000.0 ? 1.0 : ease((u_tIn - v_rev.x) / 0.3);
  float aOut = v_rev.y > 5000.0 ? 0.0 : ease((u_tOut - v_rev.y) / 0.30);
  float uA = aOut * Lc, uB = bIn * Lc;
  if (u < uA || u > uB || uB <= uA) discard;
  float cov, br, streak, bid;
  if (kind < 0.5) {
    float nb = clamp(W * 0.3, 4.0, 60.0);
    float bx = (v * 0.5 + 0.5) * nb;
    bid = floor(bx);
    float bs = smoothstep(0.0, 1.0, fract(bx));
    float b1 = mix(h11(bid * 1.713 + seed * 17.17), h11((bid + 1.0) * 1.713 + seed * 17.17), bs);
    float b2 = vn(vec2(bx * 0.3, seed * 3.1));
    streak = vn(vec2(u / (W * 1.4 + 8.0) + seed * 5.3, bx * 0.55 + seed));
    br = clamp(b1 * 0.32 + b2 * 0.33 + streak * 0.5 - 0.07, 0.0, 1.0);
    float side = step(0.0, v);
    float en = vn(vec2(u / (W * 1.1 + 6.0), seed * 9.1 + side * 7.0));
    float edge = 1.0 - 0.13 * en - 0.05 * dry;
    float ez = smoothstep(0.55, 0.97, av);
    float bl = h21(vec2(bid + seed * 13.0, floor(u / (W * 0.7 + 4.0))));
    edge -= ez * step(bl, 0.28 + 0.3 * dry) * 0.3;
    cov = 1.0 - smoothstep(edge - aa, edge + aa, av);
    float thr = dry * (0.1 + 0.95 * smoothstep(0.35, 1.0, t)) - 0.05;
    cov *= smoothstep(thr - 0.06, thr + 0.06, br);
  } else {
    bid = 0.0;
    streak = vn(vec2(u / (W + 10.0), seed));
    br = 0.45 + 0.3 * streak;
    cov = 1.0 - smoothstep(0.15, 1.05, av);
    cov *= cov;
  }
  float sq = 1.0 - v_ex.w;
  float capS = max(W * 0.5 * sq, 1.0);
  float ds = clamp((u - uA) / capS, 0.0, 1.0);
  float allowS = sqrt(ds * (2.0 - ds));
  cov *= 1.0 - smoothstep(allowS - aa, allowS + aa, av);
  float capE = max(W * 0.35 * sq, 1.0);
  float de = clamp((uB - u) / capE, 0.0, 1.0);
  float allowE = sqrt(de * (2.0 - de));
  cov *= 1.0 - smoothstep(allowE - aa, allowE + aa, av);
  float a = v_col.a * cov;
  if (a < 0.004) discard;
  vec3 c;
  if (u_mask > 0.5) {
    c = v_col.rgb;
  } else {
    float load = mix(h11(bid * 3.31 + seed * 7.7), h11((bid + 1.0) * 3.31 + seed * 7.7), smoothstep(0.2, 0.8, fract((v * 0.5 + 0.5) * clamp(W * 0.3, 4.0, 60.0))));
    float m2 = smoothstep(0.4, 0.72, load * 0.6 + streak * 0.5);
    c = mix(v_col.rgb, v_col2.rgb, m2);
    c *= 0.8 + 0.4 * br;
    c *= 1.0 + 0.06 * (1.0 - smoothstep(0.0, 0.15, t));
  }
  o_col = vec4(c * a, a);
  float hg = th * (0.22 + 0.78 * br) * (1.0 - 0.45 * dry * smoothstep(0.4, 1.0, t)) + th * 0.45 * smoothstep(0.62, 0.98, av);
  o_hgt = vec4(hg * a, v_ex.x * a, v_ex.y * a, a);
}`;

const COMP_VS = `#version 300 es
void main(){
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// Pop-art palettes, 10 inks each: 0 ground, 1 coat, 2 coat lining, 3 black clothes, 4 skin,
// 5 hair, 6 mic/shoes, 7 key-line ink, 8 lips, 9 whites.
const POP_PALETTES = [
  [[0.97, 0.35, 0.6], [1.0, 0.87, 0.18], [0.98, 0.52, 0.12], [0.13, 0.2, 0.62], [1.0, 0.74, 0.7], [1.0, 0.45, 0.1], [0.85, 0.88, 0.95], [0.07, 0.05, 0.12], [0.9, 0.1, 0.2], [1.0, 1.0, 0.96]],
  [[0.2, 0.8, 0.8], [1.0, 0.38, 0.62], [0.7, 0.12, 0.45], [0.1, 0.1, 0.3], [1.0, 0.9, 0.35], [1.0, 0.72, 0.08], [0.95, 0.95, 1.0], [0.08, 0.05, 0.1], [0.95, 0.15, 0.35], [1.0, 1.0, 0.96]],
  [[1.0, 0.55, 0.1], [0.3, 0.85, 0.85], [0.05, 0.5, 0.55], [0.35, 0.12, 0.55], [1.0, 0.62, 0.72], [1.0, 0.92, 0.2], [0.9, 0.92, 0.98], [0.08, 0.04, 0.12], [0.85, 0.05, 0.25], [1.0, 1.0, 0.96]],
  [[1.0, 0.9, 0.22], [0.92, 0.16, 0.18], [0.55, 0.05, 0.12], [0.06, 0.07, 0.15], [1.0, 0.86, 0.76], [1.0, 0.5, 0.1], [0.8, 0.85, 0.95], [0.06, 0.04, 0.08], [0.9, 0.1, 0.15], [1.0, 1.0, 0.96]],
  [[0.62, 0.9, 0.3], [0.58, 0.32, 0.85], [0.3, 0.12, 0.55], [0.05, 0.3, 0.2], [1.0, 0.68, 0.42], [0.95, 0.2, 0.6], [0.92, 0.92, 0.98], [0.06, 0.05, 0.12], [0.95, 0.1, 0.3], [1.0, 1.0, 0.96]],
  [[0.2, 0.36, 0.92], [1.0, 0.6, 0.18], [0.85, 0.2, 0.1], [0.05, 0.05, 0.08], [1.0, 0.72, 0.8], [1.0, 0.9, 0.25], [0.95, 0.95, 1.0], [0.05, 0.04, 0.1], [0.95, 0.12, 0.25], [1.0, 1.0, 0.96]]
];
const glslVec3 = c => `vec3(${c.map(x => x.toFixed(3)).join(',')})`;
const PAL_GLSL = `const vec3 PAL[60] = vec3[60](${POP_PALETTES.map(p => p.map(glslVec3).join(',')).join(',\n')});`;

const COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D u_bgC, u_bgH, u_fgC, u_fgH, u_sh, u_galC, u_galH;
uniform vec2 u_res;
uniform float u_dpr;
uniform vec3 u_amb, u_wCol, u_cCol, u_ground;
uniform vec4 u_wPool, u_wPool2, u_cPool, u_cPool2;
uniform float u_grain, u_relief, u_floorY, u_time, u_refl, u_waterY;
uniform float u_pop, u_grid, u_popSeed;
uniform float u_gal;
uniform vec4 u_frame;
uniform vec3 u_galAmb, u_galWarm;
uniform vec4 u_galPool;
uniform vec4 u_flash;
uniform float u_fade, u_vig;
out vec4 o;
${PAL_GLSL}
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float pool(vec2 p, vec4 P){
  vec2 d = (p - P.xy) / max(P.zw, vec2(1.0));
  float r = length(d);
  return (1.0 - smoothstep(0.2, 1.0, r)) + 0.35 * (1.0 - smoothstep(0.0, 0.45, r));
}
float waterLine(float x){
  return u_waterY + (sin(x * 0.09 / u_dpr + u_time * 4.0) * 1.3 + sin(x * 0.021 / u_dpr - u_time * 2.1) * 2.0) * u_dpr;
}
// Where to read the dancer layer for this pixel: the pop-art prints are all copies of the
// top-left panel, alternate ones mirrored.
vec2 fgPos(vec2 fc, out float panel){
  panel = 0.0;
  if (u_pop < 0.5 || u_grid < 1.5) return fc;
  vec2 cell = u_res / u_grid;
  vec2 ij = min(floor(fc / cell), vec2(u_grid - 1.0));
  vec2 loc = fc - ij * cell;
  float row = u_grid - 1.0 - ij.y;
  panel = ij.x + row * u_grid;
  if (mod(ij.x + row, 2.0) > 0.5) loc.x = cell.x - loc.x;
  return vec2(loc.x, u_res.y - cell.y + loc.y);
}
// the dancer is hidden below the river surface while he rises out of it
float fgMask(vec2 fc){
  if (u_waterY <= 0.0) return 1.0;
  float wl = waterLine(fc.x);
  return smoothstep(wl - u_dpr, wl + u_dpr, fc.y);
}
float inFrame(vec2 fc){
  if (u_gal < 0.5) return 1.0;
  return step(u_frame.x, fc.x) * step(fc.x, u_frame.z) * step(u_frame.y, fc.y) * step(fc.y, u_frame.w);
}
float hAt(vec2 fc){
  float pn;
  vec2 fp = fgPos(fc, pn);
  vec4 b = texture(u_bgH, fc / u_res);
  vec4 f = texture(u_fgH, fp / u_res) * fgMask(fc);
  float h = (b.r * (1.0 - f.a) + f.r) * inFrame(fc);
  if (u_gal > 0.5) { vec4 g = texture(u_galH, fc / u_res); h = h * (1.0 - g.a) + g.r; }
  return h;
}
vec3 sceneShade(vec2 fc, vec2 uv, vec4 bc, vec4 bh, vec4 fcol){
  vec2 sh = texture(u_sh, uv).rg;
  vec3 alb = bc.rgb + u_ground * (1.0 - bc.a);
  float recv = bh.a > 0.002 ? clamp(bh.g / bh.a, 0.0, 1.0) : 0.0;
  float wp = max(pool(fc, u_wPool), pool(fc, u_wPool2)) * (1.0 - sh.r);
  float cp = max(pool(fc, u_cPool), pool(fc, u_cPool2)) * (1.0 - sh.g);
  vec3 lightC = u_amb + u_wCol * wp + u_cCol * cp;
  vec3 bg = mix(alb, alb * lightC, recv * bc.a);
  // wet ground: a rippled reflection of the dancer below his feet
  float bgGloss = bh.a > 0.002 ? bh.b / bh.a : 0.0;
  float below = u_floorY - fc.y;
  if (below > 0.0 && u_refl > 0.0) {
    float dd = below / u_res.y;
    vec2 rp = vec2(fc.x + sin(fc.y * 0.35 / u_dpr + u_time * 5.0) * 2.5 * u_dpr * (0.3 + dd * 6.0), u_floorY + below * 1.1);
    vec4 rf = texture(u_fgC, rp / u_res) * fgMask(rp);
    float k = u_refl * smoothstep(0.45, 0.65, bgGloss) * (1.0 - smoothstep(0.0, 0.25, dd)) * recv;
    bg = bg * (1.0 - rf.a * k) + rf.rgb * k;
  }
  return bg * (1.0 - fcol.a) + fcol.rgb;
}
vec3 popShade(vec2 fc, vec4 bc, vec4 fcol, vec4 fh, float pn, vec2 fp){
  int base = int(mod(pn + u_popSeed, 6.0)) * 10;
  float bl = bc.a > 0.01 ? dot(bc.rgb / bc.a, vec3(0.3, 0.5, 0.2)) : 0.5;
  vec3 back = PAL[base] * (0.8 + 0.4 * bl);
  vec3 c = back;
  if (fcol.a > 0.003) {
    vec3 g = fcol.rgb / fcol.a;
    float l = dot(g, vec3(0.3, 0.5, 0.2));
    int id = int(clamp(floor(fh.g / max(fh.a, 1e-3) * 10.0 + 0.5), 1.0, 9.0));
    vec3 fcl = PAL[base + id];
    // Ben-Day dots in the shadows
    vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (fc / u_dpr);
    float d = length(fract(q / 5.0) - 0.5);
    float shd = id == 4 ? 1.0 - smoothstep(0.12, 0.36, l) : 1.0 - smoothstep(0.22, 0.6, l);
    float r = 0.6 * sqrt(shd);
    float dots = (1.0 - smoothstep(r - 0.08, r + 0.08, d)) * step(0.5, float(id != 7 && id != 9));
    vec3 fl = mix(fcl, fcl * 0.4 + PAL[base + 7] * 0.15, dots);
    if (id == 7) fl = PAL[base + 7];
    c = mix(back, fl, smoothstep(0.12, 0.6, fcol.a));
  }
  // the key-line screen, printed a little off register (each print slips its own way)
  vec2 op = fp + (vec2(1.5, -1.2) + 2.2 * vec2(h21(vec2(pn, 3.1)), -h21(vec2(pn, 7.7)))) * u_dpr;
  vec4 oc = texture(u_fgC, op / u_res);
  vec4 oh = texture(u_fgH, op / u_res);
  if (oc.a > 0.01) {
    float ol = dot(oc.rgb / oc.a, vec3(0.3, 0.5, 0.2));
    float oid = oh.g / max(oh.a, 1e-3) * 10.0;
    float ink = (1.0 - smoothstep(0.05, 0.12, ol)) * smoothstep(0.3, 0.8, oc.a);
    ink = max(ink, step(6.5, oid) * step(oid, 7.5) * oc.a);
    c = mix(c, PAL[base + 7], ink * 0.88);
  }
  if (u_grid > 1.5) {
    vec2 cell = u_res / u_grid;
    vec2 m = mod(fc, cell);
    float e = min(min(m.x, cell.x - m.x), min(m.y, cell.y - m.y));
    c = mix(u_ground, c, smoothstep(1.0 * u_dpr, 2.5 * u_dpr, e));
  }
  return c;
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  vec2 css = fc / u_dpr;
  float pn;
  vec2 fp = fgPos(fc, pn);
  vec4 bc = texture(u_bgC, uv), bh = texture(u_bgH, uv);
  float wm = fgMask(fc);
  vec4 fcol0 = texture(u_fgC, fp / u_res);
  vec4 fcol = fcol0 * wm, fh = texture(u_fgH, fp / u_res) * wm;
  vec3 col = u_pop > 0.5 ? popShade(fc, bc, fcol, fh, pn, fp) : sceneShade(fc, uv, bc, bh, fcol);
  if (u_waterY > 0.0) {
    float foam = fcol0.a * (1.0 - smoothstep(0.0, 2.5 * u_dpr, abs(fc.y - waterLine(fc.x))));
    col = mix(col, vec3(0.62, 0.76, 0.84), foam * 0.6);
  }
  float fin = inFrame(fc);
  col *= fin;
  float gloss = mix(bh.a > 0.002 ? bh.b / bh.a : 0.0, fh.a > 0.002 ? fh.b / fh.a : 0.0, fcol.a) * fin;
  float galA = 0.0;
  if (u_gal > 0.5) {
    vec4 gc = texture(u_galC, uv), gh = texture(u_galH, uv);
    vec3 gli = u_galAmb + u_galWarm * pool(fc, u_galPool);
    col = col * (1.0 - gc.a) + gc.rgb * gli;
    galA = gc.a;
    gloss = mix(gloss, gh.a > 0.002 ? gh.b / gh.a : 0.0, gc.a);
  }
  // impasto relief from the paint height field
  float s = max(u_dpr, 1.0);
  float hl = hAt(fc - vec2(s, 0.0)), hr = hAt(fc + vec2(s, 0.0));
  float hd = hAt(fc - vec2(0.0, s)), hu = hAt(fc + vec2(0.0, s));
  float hc = hAt(fc);
  float wv = 1.0 - smoothstep(0.0, 0.25, hc);
  vec2 weave = vec2(cos(css.x * 1.7) * sin(css.y * 1.7), sin(css.x * 1.7) * cos(css.y * 1.7)) * 0.12 * wv;
  vec3 n = normalize(vec3((hl - hr) * u_relief + weave.x, (hd - hu) * u_relief + weave.y, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float diff = dot(n, L) - L.z;
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 30.0);
  float lum = dot(col, vec3(0.3, 0.5, 0.2));
  col *= 1.0 + diff * 0.85;
  col += spec * (0.03 + 0.2 * gloss) * vec3(1.0, 0.93, 0.82) * (0.35 + 0.65 * smoothstep(0.02, 0.4, lum));
  // canvas tooth under everything
  col *= 0.955 + 0.09 * h21(floor(css * 0.5));
  // grade: cool the darks, warm the lights
  col = mix(col, col * vec3(0.9, 0.92, 1.12), (1.0 - smoothstep(0.0, 0.35, lum)) * (1.0 - u_pop));
  col = mix(col, u_flash.rgb, u_flash.a);
  col *= 1.0 - u_fade;
  vec2 q = uv - 0.5;
  col *= 1.0 - u_vig * dot(q * vec2(0.9, 1.15), q * vec2(0.9, 1.15));
  col += (h21(floor(css) + u_grain) - 0.5) * 0.03;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function glShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(log);
    throw new Error('shader: ' + log);
  }
  return s;
}
function glProgram(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, glShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, glShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
const PROG_STROKE = glProgram(STROKE_VS, STROKE_FS);
const PROG_COMP = glProgram(COMP_VS, COMP_FS);

function glTex(w, h, internal, format, type) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  return t;
}
let HEIGHT_FLOAT = HAS_CBF;
function glTarget(w, h, withHeight) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const color = glTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  let height = null;
  if (withHeight) {
    height = HEIGHT_FLOAT ? glTex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT) : glTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, height, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && HEIGHT_FLOAT) {
      gl.deleteTexture(height);
      HEIGHT_FLOAT = false;
      height = glTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, height, 0);
    }
  } else {
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, color, height, w, h, withHeight };
}
function glFreeTarget(T) {
  if (!T) return;
  gl.deleteFramebuffer(T.fb); gl.deleteTexture(T.color); if (T.height) gl.deleteTexture(T.height);
}
function glClearTarget(T) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
  gl.viewport(0, 0, T.w, T.h);
  gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
  if (T.withHeight) gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
}

// ---- vertex layout: 15 x 4 bytes = 60 bytes per vertex
// pos(3f) uv(2f) p(4f: L, W, seed, thickness) rev(3f: in-delay, out-delay, unit->css px) col(4ub) col2(4ub) ex(4ub)
const VSTRIDE = 15;
function glMakeStrokeVAO() {
  const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  [[0, 3, gl.FLOAT, false, 0], [1, 2, gl.FLOAT, false, 12], [2, 4, gl.FLOAT, false, 20], [3, 3, gl.FLOAT, false, 36],
   [4, 4, gl.UNSIGNED_BYTE, true, 48], [5, 4, gl.UNSIGNED_BYTE, true, 52], [6, 4, gl.UNSIGNED_BYTE, true, 56]]
    .forEach(([loc, n, type, normd, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, type, normd, VSTRIDE * 4, off); });
  gl.bindVertexArray(null);
  return { vao, vbo, ibo };
}
const emptyVAO = gl.createVertexArray();

let CW = 0, CH = 0, DPR = 1;
let T_BG = null, T_FG = null, T_SH = null, T_GAL = null;
function glResize() {
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.max(1, window.innerWidth || 1280), ch = Math.max(1, window.innerHeight || 800);
  let w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  const maxPx = 4.3e6;
  if (w * h > maxPx) { const k = Math.sqrt(maxPx / (w * h)); w = Math.round(w * k); h = Math.round(h * k); dpr *= k; }
  if (w === CW && h === CH) return false;
  CW = w; CH = h; DPR = dpr;
  cv.width = w; cv.height = h;
  glFreeTarget(T_BG); glFreeTarget(T_FG); glFreeTarget(T_SH); glFreeTarget(T_GAL);
  T_BG = glTarget(w, h, true);
  T_FG = glTarget(w, h, true);
  T_SH = glTarget(Math.ceil(w / 2), Math.ceil(h / 2), false);
  T_GAL = glTarget(w, h, true);
  return true;
}

// opts: {mask, world, vp, boil, jit, noClear, tIn, tOut}
function glDrawStrokes(buf, T, opts) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb);
  gl.viewport(0, 0, T.w, T.h);
  gl.disable(gl.BLEND);
  if (!opts.noClear) {
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    if (T.withHeight) gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
  }
  if (buf.ni === 0) return;
  const P = PROG_STROKE, u = P.u;
  gl.useProgram(P.p);
  gl.uniform2f(u.u_res, CW, CH);
  gl.uniform1f(u.u_mask, opts.mask ? 1 : 0);
  gl.uniform1f(u.u_world, opts.world ? 1 : 0);
  gl.uniform1f(u.u_boil, opts.boil || 0);
  gl.uniform1f(u.u_jit, opts.jit || 0);
  gl.uniform1f(u.u_tIn, opts.tIn !== undefined ? opts.tIn : 1e4);
  gl.uniform1f(u.u_tOut, opts.tOut !== undefined ? opts.tOut : -1e4);
  if (opts.vp) gl.uniformMatrix4fv(u.u_vp, false, opts.vp);
  gl.enable(gl.BLEND);
  if (opts.mask) { gl.blendEquation(gl.MAX); }
  else { gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
  gl.bindVertexArray(buf.vao);
  if (buf.dirty) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf.ab, 0, buf.nv * VSTRIDE * 4), buf.static ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buf.idx.subarray(0, buf.ni), buf.static ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
    buf.dirty = false;
  }
  gl.drawElements(gl.TRIANGLES, buf.ni, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
}

function glComposite(U) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, CW, CH);
  gl.useProgram(PROG_COMP.p);
  const u = PROG_COMP.u;
  const texs = [[T_BG.color, 'u_bgC'], [T_BG.height, 'u_bgH'], [T_FG.color, 'u_fgC'], [T_FG.height, 'u_fgH'], [T_SH.color, 'u_sh'],
                [T_GAL.color, 'u_galC'], [T_GAL.height, 'u_galH']];
  texs.forEach(([tex, name], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u[name], i); });
  gl.uniform2f(u.u_res, CW, CH);
  gl.uniform1f(u.u_dpr, DPR);
  const v3 = (name, val) => { if (u[name]) gl.uniform3fv(u[name], val); };
  const v4 = (name, val) => { if (u[name]) gl.uniform4fv(u[name], val); };
  const f1 = (name, val) => { if (u[name]) gl.uniform1f(u[name], val); };
  v3('u_amb', U.amb); v3('u_wCol', U.wCol); v3('u_cCol', U.cCol); v3('u_ground', U.ground);
  v4('u_wPool', U.wPool); v4('u_wPool2', U.wPool2); v4('u_cPool', U.cPool); v4('u_cPool2', U.cPool2);
  f1('u_grain', U.grain); f1('u_relief', U.relief); f1('u_floorY', U.floorY); f1('u_time', U.time);
  f1('u_refl', U.refl); f1('u_waterY', U.waterY);
  f1('u_pop', U.pop); f1('u_grid', U.grid); f1('u_popSeed', U.popSeed);
  f1('u_gal', U.gal); v4('u_frame', U.frame); v3('u_galAmb', U.galAmb); v3('u_galWarm', U.galWarm); v4('u_galPool', U.galPool);
  v4('u_flash', U.flash); f1('u_fade', U.fade); f1('u_vig', U.vig);
  gl.bindVertexArray(emptyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}
