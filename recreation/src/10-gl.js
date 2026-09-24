// ============================================================================
// WebGL2. Brush strokes are ribbons whose fragment shader paints bristles,
// dry-brush breaks and a paint-height field into two render targets. A scene
// pass lights that height as impasto; a final pass does the transitions
// (palette knife, whip pan, pop prints, whirlpool, gallery) and the grade.
// ============================================================================
const cv = document.getElementById('paint');
const gl = cv.getContext('webgl2', {
  antialias: false, alpha: false, depth: false, stencil: false,
  premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'
});
if (!gl) {
  document.body.innerHTML = '<p style="color:#cdb;font:18px/1.6 Georgia,serif;padding:2em;max-width:36em">' +
    'This painting needs WebGL2 to move. Try a recent Chrome, Safari or Firefox.</p>';
  throw new Error('WebGL2 unavailable');
}
const HAS_CBF = !!gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');
cv.addEventListener('webglcontextlost', e => e.preventDefault());
cv.addEventListener('webglcontextrestored', () => location.reload());

// ---------------------------------------------------------------- stroke shader
const STROKE_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_geo;
layout(location=3) in vec4 a_anim;
layout(location=4) in vec2 a_uf;
layout(location=5) in vec4 a_col;
layout(location=6) in vec4 a_col2;
layout(location=7) in vec4 a_ex;
uniform mat4 u_vp;
uniform vec2 u_res;
uniform float u_world, u_boil, u_jit;
uniform vec4 u_stir;          // sky plane: centre xy, twist (rad), radius
out vec2 v_uv; out float v_wy;
flat out vec4 v_geo; flat out vec4 v_anim; flat out vec2 v_uf;
out vec4 v_col; flat out vec4 v_col2; flat out vec4 v_ex;
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
void main(){
  vec3 p = a_pos;
  if (u_world > 0.5) {
    float s = a_geo.z;
    p.xy += (vec2(h11(s * 7.31 + u_boil * 3.17), h11(s * 3.77 + u_boil * 5.3)) - 0.5) * u_jit;
    if (u_stir.z != 0.0 && mod(floor(a_uf.y / 2.0), 2.0) > 0.5) {
      vec2 d = p.xy - u_stir.xy;
      float r2 = dot(d, d) / (u_stir.w * u_stir.w);
      float a = u_stir.z * exp(-r2);
      float c = cos(a), sn = sin(a);
      p.xy = u_stir.xy + vec2(c * d.x - sn * d.y, sn * d.x + c * d.y);
    }
    gl_Position = u_vp * vec4(p, 1.0);
    v_wy = p.y;
  } else {
    vec2 c = p.xy / u_res * 2.0 - 1.0;
    gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
    v_wy = p.z;
  }
  v_uv = a_uv; v_geo = a_geo;
  v_anim = a_anim; v_uf = a_uf; v_col = a_col; v_col2 = a_col2; v_ex = a_ex;
}`;

const STROKE_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in float v_wy;
flat in vec4 v_geo; flat in vec4 v_anim; flat in vec2 v_uf;
in vec4 v_col; flat in vec4 v_col2; flat in vec4 v_ex;
uniform float u_time, u_mode;
uniform vec4 u_clip;          // on, surface world y, ripple amplitude, phase
layout(location=0) out vec4 o_col;
layout(location=1) out vec4 o_hgt;
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
const float EXT = 1.15;
void main(){
  float k = v_uf.x;
  float flags = v_uf.y;
  if (u_clip.x > 0.5 && mod(flags, 2.0) > 0.5) {
    float x = gl_FragCoord.x;
    float rip = u_clip.z * (0.6 * sin(x * 0.045 + u_clip.w * 3.1) + 0.4 * sin(x * 0.113 - u_clip.w * 4.7));
    if (v_wy < u_clip.y + rip) discard;
  }
  float L = v_geo.x * k, W = max(v_geo.y * k, 0.6);
  float u = v_uv.x * k, v = v_uv.y / EXT;
  float av = abs(v);
  float seed = mod(v_geo.z, 97.0), thick = v_geo.w;
  float kind = floor(v_ex.z * 255.0 + 0.5);
  float dry = v_col2.a, sq = v_ex.w;
  // the visible stretch of the stroke: painted on, lifted off, or a dash travelling along it
  float uA = 0.0, uB = L;
  if (v_anim.x > -0.5) uB = L * smoothstep(0.0, 1.0, (u_time - v_anim.x) / 0.32);
  if (v_anim.y < 9000.0) uA = L * smoothstep(0.0, 1.0, (u_time - v_anim.y) / 0.32);
  if (v_anim.z > 0.0) {
    float dl = v_anim.z * k, per = L + dl;
    float hd = mod(u_time * v_anim.w * k + seed * 53.0, per);
    uA = max(uA, hd - dl); uB = min(uB, hd);
  }
  if (u < uA || u > uB || uB - uA < 0.3) discard;
  float aa = max(fwidth(v), 0.004) * 1.2;
  float t01 = clamp((u - uA) / max(uB - uA, 1.0), 0.0, 1.0);
  float cov, bright, ridge, load;
  if (kind < 0.5) {
    // hog-hair brush: loaded paint in the body, bristle tracks showing at the edges and where
    // the brush runs dry, a ragged outline
    float nb = clamp(W * 0.2, 3.0, 28.0);
    float bx = (v * 0.5 + 0.5) * nb;
    float bi = floor(bx), bf = fract(bx);
    float ra = h11(bi * 1.37 + seed * 17.3), rb = h11((bi + 1.0) * 1.37 + seed * 17.3);
    load = mix(ra, rb, smoothstep(0.1, 0.9, bf));
    float along = vn(vec2(u / (W * 1.6 + 10.0) + seed * 3.1, bx * 0.3 + seed * 1.7));
    float fine = vn(vec2(u / 4.0 + seed, bx * 1.3));
    float blotch = vn(vec2(u / (W * 2.5 + 20.0) + seed * 7.0, v * 0.6 + seed));
    float streak = clamp(0.3 * load + 0.5 * along + 0.2 * fine, 0.0, 1.0);
    float side = step(0.0, v);
    float en = vn(vec2(u / (W * 0.9 + 6.0), seed * 9.1 + side * 5.0));
    float edge = 1.0 - 0.13 * en - 0.05 * dry;
    float nearEdge = smoothstep(0.55, 0.98, av);
    float broken = step(h21(vec2(bi + seed * 11.0, floor(u / (W * 0.6 + 5.0)))), 0.2 + 0.36 * dry);
    edge -= nearEdge * broken * 0.26;
    cov = 1.0 - smoothstep(edge - aa, edge + aa, av);
    float thr = dry * (0.12 + 0.9 * smoothstep(0.3, 1.0, t01)) - 0.06;
    cov *= smoothstep(thr - 0.05, thr + 0.05, streak);
    // the tracks show more toward the edges and the dry tail than in the loaded middle
    float show = mix(0.35, 1.0, max(smoothstep(0.45, 0.95, av), dry * smoothstep(0.4, 1.0, t01)));
    bright = 1.0 + (streak - 0.5) * 0.34 * show + (blotch - 0.5) * 0.1;
    ridge = 0.45 + 0.35 * (streak - 0.5) * show + 0.1 * (blotch - 0.5) + 0.5 * smoothstep(0.62, 0.97, av);
  } else if (kind < 1.5) {
    // soft glaze: glows, shadows, mist
    float n = vn(vec2(u / (W + 10.0), seed * 3.0 + v * 1.3));
    cov = 1.0 - smoothstep(0.05, 1.0, av);
    cov = cov * cov * (0.8 + 0.2 * n);
    load = 0.5; bright = 0.96 + 0.08 * n; ridge = 0.0;
  } else {
    // palette knife: flat and crisp, skipping over the weave, paint squeezed to the edges
    float n = vn(vec2(u / (W * 2.0 + 20.0) + seed, v * 1.5));
    float chatter = vn(vec2(u / 4.0 + seed * 5.0, v * 0.6 + seed));
    float edge = 1.0 - 0.05 * n;
    cov = 1.0 - smoothstep(edge - aa, edge + aa, av);
    cov *= smoothstep(0.05, 0.16, chatter + 0.3 - dry * 0.45 * t01);
    load = n; bright = 0.93 + 0.12 * n;
    ridge = 0.3 + 0.7 * smoothstep(0.72, 1.0, av);
  }
  // round start cap, softer tapered end
  float capS = max(W * 0.5 * (1.0 - sq), 0.8);
  float ds = clamp((u - uA) / capS, 0.0, 1.0), allowS = sqrt(ds * (2.0 - ds));
  cov *= 1.0 - smoothstep(allowS - aa, allowS + aa, av);
  float capE = max(W * 0.38 * (1.0 - sq), 0.8);
  float de = clamp((uB - u) / capE, 0.0, 1.0), allowE = sqrt(de * (2.0 - de));
  cov *= 1.0 - smoothstep(allowE - aa, allowE + aa, av);
  float a = v_col.a * cov;
  if (a < 0.004) discard;
  if (u_mode > 1.5) {            // flat colour, painted over (material ids)
    o_col = vec4(v_col.rgb * a, a);
    o_hgt = vec4(0.0);
    return;
  }
  if (u_mode > 0.5) {            // flat colour, MAX-blended (shadow masks)
    o_col = vec4(v_col.rgb * cov, cov);
    o_hgt = vec4(0.0);
    return;
  }
  float m2 = smoothstep(0.35, 0.78, load * 0.62 + (bright - 0.8) * 1.1);
  vec3 c = mix(v_col.rgb, v_col2.rgb, m2) * bright;
  c *= 1.0 + 0.07 * (1.0 - smoothstep(0.0, 0.12, t01));
  o_col = vec4(c * a, a);
  float h = thick * ridge * (1.0 - 0.4 * dry * t01) + thick * 0.35 * (1.0 - smoothstep(0.0, 0.1, t01));
  o_hgt = vec4(h * a, v_ex.x * a, v_ex.y * a, a);
}`;

// ---------------------------------------------------------------- full-screen triangle
const QUAD_VS = `#version 300 es
void main(){
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const NOISE_GLSL = `
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.03 + 7.1) * 0.3 + vn(p * 4.1 + 3.3) * 0.15; }
`;

// ---------------------------------------------------------------- scene composite: light + impasto
const SCENE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_bgC, u_bgH, u_fgC, u_fgH, u_sh;
uniform vec2 u_tex;           // texture size (px)
uniform float u_dpr, u_relief, u_time, u_expo;
uniform vec3 u_amb, u_ground;
uniform vec4 u_Lw[4];         // light pool on the wall / backdrop: x, y (GL px), rx, ry
uniform vec4 u_Lf[4];         // its pool on the floor
uniform vec4 u_Lc[4];         // rgb, shadow channel (0 none, 1 r, 2 g, 3 b)
uniform vec4 u_refl;          // on, floor line (GL px y), strength, ripple
uniform vec3 u_Ldir;          // impasto key direction
out vec4 o;
${NOISE_GLSL}
float pool(vec2 p, vec4 P){
  vec2 d = (p - P.xy) / max(P.zw, vec2(1.0));
  float r2 = dot(d, d);
  return exp(-r2 * 1.7) + 0.45 * exp(-r2 * 9.0);
}
float hAt(vec2 uv){ vec4 b = texture(u_bgH, uv); vec4 f = texture(u_fgH, uv); return b.r * (1.0 - f.a) + f.r; }
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_tex, px = 1.0 / u_tex;
  vec4 bc = texture(u_bgC, uv), bh = texture(u_bgH, uv);
  vec4 fcol = texture(u_fgC, uv), fh = texture(u_fgH, uv);
  vec3 sh = texture(u_sh, uv).rgb;
  vec3 alb = bc.rgb + u_ground * (1.0 - bc.a);
  float recv = bh.a > 0.002 ? clamp(bh.g / bh.a, 0.0, 1.0) : 1.0;
  vec3 light = u_amb;
  for (int i = 0; i < 4; i++) {
    vec4 C = u_Lc[i];
    if (C.r + C.g + C.b <= 0.0) continue;
    float s = C.a < 0.5 ? 0.0 : C.a < 1.5 ? sh.r : C.a < 2.5 ? sh.g : sh.b;
    float p = max(pool(fc, u_Lw[i]), pool(fc, u_Lf[i]));
    light += C.rgb * p * (1.0 - s);
  }
  vec3 bg = mix(alb, alb * light, recv);
  float gloss = bh.a > 0.002 ? bh.b / bh.a : 0.0;
  if (u_refl.x > 0.5) {
    float below = u_refl.y - fc.y;
    if (below > 0.0) {
      float dd = below / u_tex.y;
      float wob = sin(fc.y * 0.33 / u_dpr + u_time * 5.0) * (1.5 + 30.0 * dd) * u_dpr * u_refl.w;
      vec2 rp = vec2(fc.x + wob, u_refl.y + below * 1.05);
      vec4 rf = texture(u_fgC, rp / u_tex);
      float k = u_refl.z * smoothstep(0.3, 0.65, gloss) * (1.0 - smoothstep(0.0, 0.3, dd));
      bg = bg * (1.0 - rf.a * k) + rf.rgb * k * (0.8 + 0.2 * light);
    }
  }
  vec3 col = bg * (1.0 - fcol.a) + fcol.rgb;
  // impasto: light the paint-height field
  float s = max(u_dpr, 1.0);
  float hl = hAt(uv - vec2(px.x * s, 0.0)), hr = hAt(uv + vec2(px.x * s, 0.0));
  float hd = hAt(uv - vec2(0.0, px.y * s)), hu = hAt(uv + vec2(0.0, px.y * s));
  float hc = bh.r * (1.0 - fh.a) + fh.r;
  vec2 css = fc / u_dpr;
  float wv = 1.0 - smoothstep(0.0, 0.3, hc);
  vec2 weave = vec2(cos(css.x * 1.75) * sin(css.y * 1.75), sin(css.x * 1.75) * cos(css.y * 1.75)) * 0.13 * wv;
  vec3 n = normalize(vec3((hl - hr) * u_relief + weave.x, (hd - hu) * u_relief + weave.y, 1.0));
  vec3 L = normalize(u_Ldir);
  float diff = dot(n, L) - L.z;
  float gl2 = mix(gloss, fh.a > 0.002 ? fh.b / fh.a : 0.0, fcol.a);
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 28.0);
  float lum = dot(col, vec3(0.3, 0.5, 0.2));
  col *= 1.0 + diff * 0.85;
  col += spec * (0.025 + 0.2 * gl2) * vec3(1.0, 0.94, 0.84) * (0.35 + 0.65 * smoothstep(0.02, 0.4, lum));
  col *= 0.955 + 0.09 * h21(floor(css * 0.5));
  col *= u_expo;
  o = vec4(max(col, 0.0), fcol.a);
}`;

// ---------------------------------------------------------------- final pass
const FINAL_FS = `#version 300 es
precision highp float;
uniform sampler2D u_A, u_B, u_C, u_ovC, u_ovH, u_popF, u_popI, u_pal;
uniform vec2 u_res, u_sA, u_sB, u_sC;  // canvas size; uv scales of the three scene images
uniform float u_mode, u_time, u_grain, u_dpr, u_fade;
uniform vec4 u_p0, u_p1, u_p2, u_p3, u_p4, u_w;
uniform vec4 u_band[3];
out vec4 o;
${NOISE_GLSL}
vec3 sA(vec2 uv){ return texture(u_A, clamp(uv, 0.0005, 0.9995) * u_sA).rgb; }
vec3 sB(vec2 uv){ return texture(u_B, clamp(uv, 0.0005, 0.9995) * u_sB).rgb; }
vec3 sC(vec2 uv){ return texture(u_C, clamp(uv, 0.0005, 0.9995) * u_sC).rgb; }
float lum(vec3 c){ return dot(c, vec3(0.3, 0.55, 0.15)); }

// ---- pop-art prints: the dancer's material ids + painted luminance, silkscreened in a grid
vec3 pal(float cell, float slot){ return texture(u_pal, (vec2(slot, mod(cell, 16.0)) + 0.5) / vec2(8.0, 16.0)).rgb; }
vec3 popPrint(vec2 q, float cell, float seed){
  // q: 0..1 within the print. The dancer image was rendered for a square-ish print.
  vec2 fuv = vec2(u_p1.x + q.x * u_p1.z, u_p1.y + q.y * u_p1.w);
  vec2 mis = (vec2(h21(vec2(cell, 3.0)), h21(vec2(cell, 7.0))) - 0.5) * 0.012;
  vec4 f = texture(u_popF, fuv);
  vec4 fk = texture(u_popF, fuv + mis);
  vec4 id = texture(u_popI, fuv);
  vec3 bg = pal(cell, 0.0);
  float paper = vn(q * vec2(40.0, 7.0) + seed) * 0.5 + vn(q * 160.0 + seed) * 0.5;
  vec3 c = bg * (0.93 + 0.1 * paper);
  // flat colour blocks per material, slightly off register
  if (id.a > 0.35) {
    float m = floor(id.r / max(id.a, 0.001) * 8.0 + 0.5);
    vec3 fill = pal(cell, clamp(m, 1.0, 7.0));
    float inkN = vn(q * 90.0 + seed * 3.0);
    c = mix(c, fill * (0.94 + 0.08 * inkN), smoothstep(0.35, 0.6, id.a));
  }
  // black key plate from the painted tones, with a halftone in the mid-tones
  float L = fk.a > 0.01 ? lum(fk.rgb / fk.a) : 1.0;
  vec2 hp = q * vec2(u_p2.x, u_p2.x * u_p2.y);
  vec2 g = fract(mat2(0.866, -0.5, 0.5, 0.866) * hp) - 0.5;
  float dotR = length(g);
  float tone = smoothstep(0.34, 0.12, L);
  float key = max(step(L, 0.1), step(dotR, 0.62 * sqrt(tone)) * step(0.02, tone));
  key *= smoothstep(0.1, 0.4, fk.a);
  c = mix(c, vec3(0.05, 0.04, 0.06), key * 0.94);
  // a few hot highlights
  float hi = smoothstep(0.78, 0.9, L) * smoothstep(0.3, 0.6, f.a);
  c = mix(c, pal(cell, 7.0) * 0.4 + 0.62, hi * 0.8);
  return c;
}
vec3 popGrid(vec2 uv){
  float N = u_p0.x;                       // prints per side
  vec2 p = uv * u_res;
  vec2 area = u_p0.zw;                    // grid area size (px), centred
  vec2 o0 = (u_res - area) * 0.5;
  vec2 g = (p - o0) / area;
  vec3 wall = vec3(0.93, 0.9, 0.84) * (0.95 + 0.05 * vn(p * 0.02));
  if (g.x < 0.0 || g.y < 0.0 || g.x > 1.0 || g.y > 1.0) return wall;
  vec2 cellF = g * N;
  vec2 ci = floor(cellF);
  vec2 q = fract(cellF);
  float gap = u_p0.y / (area.x / N);
  vec2 qq = (q - gap) / (1.0 - 2.0 * gap);
  if (qq.x < 0.0 || qq.y < 0.0 || qq.x > 1.0 || qq.y > 1.0) return wall;
  float cell = ci.y * N + ci.x;
  float order = u_p3.x;                   // colourway offset for this grid size
  vec3 c = popPrint(qq, cell + order, cell * 3.1 + order);
  // a print that has just landed flashes white on the crash
  c = mix(c, vec3(1.0, 0.98, 0.92), u_p3.y * (0.5 + 0.5 * h21(ci + order)));
  return c;
}

// ---- palette knife: scraped bands reveal B under A
vec3 knife(vec2 uv){
  vec2 p = uv * u_res;
  vec3 a = sA(uv), b = sB(uv);
  float show = 0.0; vec3 extra = vec3(0.0); float extraA = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 B = u_band[i];                   // centre y, half height, edge x, active
    if (B.w < 0.5) continue;
    float dy = abs(p.y - B.x) / B.y;
    float wob = (vn(vec2(p.y * 0.05, float(i) * 9.0)) - 0.5) * 18.0 * u_dpr;
    float edge = B.z + wob;
    float inBand = 1.0 - smoothstep(0.9, 1.0, dy);
    // behind the edge: scraped clean, but streaks of old paint stay in the canvas tooth
    float behind = step(p.x, edge) * inBand;
    float streak = smoothstep(0.62, 0.8, vn(vec2(p.x * 0.004, p.y * 0.35 / u_dpr + float(i) * 13.0)));
    float fadeS = 1.0 - smoothstep(0.0, 500.0 * u_dpr, edge - p.x);
    float keep = streak * (0.35 + 0.65 * fadeS) * behind;
    // ragged top/bottom of the scrape
    float rag = smoothstep(0.82, 1.0, dy) * step(vn(vec2(p.x * 0.03, float(i))), 0.55);
    show = max(show, behind * (1.0 - keep) * (1.0 - rag));
    // the bow wave: a ridge of mixed old paint pushed ahead of the blade
    float ahead = p.x - edge;
    float wave = (1.0 - smoothstep(0.0, 26.0 * u_dpr, ahead)) * step(0.0, ahead) * inBand;
    if (wave > 0.0) {
      vec3 smear = sA(vec2(uv.x + 0.02, uv.y)) * 0.5 + sA(vec2(uv.x + 0.05, uv.y + 0.004)) * 0.5;
      float ridgeL = 0.75 + 0.55 * sin(ahead / (26.0 * u_dpr) * 3.1416);
      extra = smear * ridgeL; extraA = max(extraA, wave * 0.9);
    }
  }
  vec3 c = mix(a, b, show);
  return mix(c, extra, extraA);
}

// ---- whip pan: A leaves left, B arrives from the right, both smeared
vec3 blurA(vec2 uv, float len){
  vec3 s = vec3(0.0);
  for (int i = 0; i < 16; i++) { float f = (float(i) / 15.0 - 0.5) * len; s += sA(uv + vec2(f, 0.0)); }
  return s / 16.0;
}
vec3 blurB(vec2 uv, float len){
  vec3 s = vec3(0.0);
  for (int i = 0; i < 16; i++) { float f = (float(i) / 15.0 - 0.5) * len; s += (u_w.w > 0.5 ? popGrid(uv + vec2(f, 0.0)) : sB(uv + vec2(f, 0.0))); }
  return s / 16.0;
}

// ---- whirlpool: A is wound into a vortex and B unwinds out of it
vec2 swirl(vec2 uv, vec2 c, float ang, float rad){
  vec2 d = (uv - c) * vec2(u_res.x / u_res.y, 1.0);
  float r = length(d);
  float a = ang * exp(-r * r / (rad * rad));
  float cs = cos(a), sn = sin(a);
  d = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  return c + d / vec2(u_res.x / u_res.y, 1.0);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  vec3 col;
  int mode = int(u_mode + 0.5);
  if (mode == 0) {
    col = sA(uv);
  } else if (mode == 1) {
    col = knife(uv);
  } else if (mode == 2) {
    // u_w: A offset (uv), blur length (uv), B offset (uv), 1 when B is the pop grid; u_p4.y picks B
    float blur = u_w.y;
    col = u_p4.y < 0.5 ? blurA(uv + vec2(u_w.x, 0.0), blur) : blurB(uv + vec2(u_w.z, 0.0), blur);
  } else if (mode == 3) {
    col = popGrid(uv);
  } else if (mode == 4) {
    // p0: centre (uv), angle A, angle B ; p1: radius, mix
    vec2 c = u_p0.xy;
    vec3 a = sA(swirl(uv, c, u_p0.z, u_p1.x));
    vec3 b = sB(swirl(uv, c, u_p0.w, u_p1.x));
    vec2 d = (uv - c) * vec2(u_res.x / u_res.y, 1.0);
    float r = length(d), th = atan(d.y, d.x);
    float spiral = fract(th / 6.2832 + r * 2.2 - u_time * 0.4);
    // the new world opens out from the eye of the whirlpool along a spiral edge
    float re = u_p1.y * 1.4;
    float m = 1.0 - smoothstep(re - 0.12, re + 0.12, r + 0.12 * (spiral - 0.5));
    col = mix(a, b, m);
  } else {
    // gallery: C with the two paintings (A, B) set into their frames
    col = sC(uv);
    vec4 gC = texture(u_C, clamp(uv, 0.0005, 0.9995) * u_sC);
    for (int i = 0; i < 2; i++) {
      vec4 R = i == 0 ? u_p0 : u_p1;     // x0, y0, x1, y1 in uv
      if (R.z <= R.x) continue;
      if (uv.x < R.x || uv.x > R.z || uv.y < R.y || uv.y > R.w) continue;
      vec2 q = (uv - R.xy) / (R.zw - R.xy);
      vec3 pc = i == 0 ? sA(q) : sB(q);
      // picture light from above, a little inner shadow under the frame lip
      float pl = (i == 0 ? u_p2.x : u_p2.y);
      float top = 1.0 + pl * (0.12 * smoothstep(0.4, 1.0, q.y) - 0.1 * (1.0 - smoothstep(0.0, 0.5, q.y)));
      vec2 e = min(q, 1.0 - q) * (R.zw - R.xy) * u_res;
      float lip = smoothstep(0.0, 9.0 * u_dpr * pl + 0.001, min(e.x, e.y));
      pc *= top * mix(0.55, 1.0, lip);
      col = mix(pc, col, gC.a);
    }
  }
  // overlay strokes (title card, palette knife, closing curtains), lit as impasto with a drop shadow
  vec4 ov = texture(u_ovC, uv);
  // a soft cast shadow, a few pixels down and to the left
  float shA = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 j = vec2(float(i % 2), float(i / 2)) - 0.5;
    shA += texture(u_ovC, uv + (vec2(-3.0, 4.5) * (1.0 + 0.35 * float(i)) + j * 2.5) * u_dpr / u_res).a;
  }
  col *= 1.0 - 0.4 * shA * 0.25 * u_p4.x;
  if (ov.a > 0.002) {
    vec2 px = u_dpr / u_res;
    float hl = texture(u_ovH, uv - vec2(px.x, 0.0)).r, hr = texture(u_ovH, uv + vec2(px.x, 0.0)).r;
    float hd = texture(u_ovH, uv - vec2(0.0, px.y)).r, hu = texture(u_ovH, uv + vec2(0.0, px.y)).r;
    vec3 n = normalize(vec3((hl - hr) * 2.2, (hd - hu) * 2.2, 1.0));
    vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
    float gls = texture(u_ovH, uv).b / max(ov.a, 0.001);
    vec3 oc = ov.rgb * (1.0 + (dot(n, L) - L.z) * 0.9);
    oc += pow(max(dot(n, normalize(L + vec3(0, 0, 1))), 0.0), 30.0) * (0.04 + 0.35 * gls);
    col = col * (1.0 - ov.a) + oc;
  }
  // grade: cool darks, warm lights, vignette, grain, fade from/to black
  float l = lum(col);
  col = mix(col, col * vec3(0.9, 0.93, 1.12), 1.0 - smoothstep(0.0, 0.32, l));
  vec2 q2 = uv - 0.5;
  col *= 1.0 - 0.85 * dot(q2 * vec2(0.9, 1.15), q2 * vec2(0.9, 1.15));
  col += (h21(floor(fc / u_dpr) + u_grain) - 0.5) * 0.028;
  col *= u_fade;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ---------------------------------------------------------------- program helpers
function glShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(log, src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
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
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}
const PROG_STROKE = glProgram(STROKE_VS, STROKE_FS);
const PROG_SCENE = glProgram(QUAD_VS, SCENE_FS);
const PROG_FINAL = glProgram(QUAD_VS, FINAL_FS);

function glTex(w, h, internal, format, type, filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const f = filter || gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  return t;
}
let HEIGHT_FLOAT = HAS_CBF;
// a render target: colour (RGBA8) and optionally a paint-height layer (RGBA16F)
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
  gl.deleteFramebuffer(T.fb); gl.deleteTexture(T.color);
  if (T.height) gl.deleteTexture(T.height);
}

// ---- vertex layout: 18 words (72 bytes) per vertex
// pos(3f) uv(2f) geo(4f: L, W, seed, thickness) anim(4f: in, out, dash, dash speed) uf(2f: unit, flags)
// col(4ub) col2(4ub: rgb + dryness) ex(4ub: receives light, gloss, kind, square caps)
const VSTRIDE = 18;
function glMakeStrokeVAO() {
  const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  [[0, 3, gl.FLOAT, false, 0], [1, 2, gl.FLOAT, false, 12], [2, 4, gl.FLOAT, false, 20], [3, 4, gl.FLOAT, false, 36],
   [4, 2, gl.FLOAT, false, 52], [5, 4, gl.UNSIGNED_BYTE, true, 60], [6, 4, gl.UNSIGNED_BYTE, true, 64], [7, 4, gl.UNSIGNED_BYTE, true, 68]]
    .forEach(([loc, n, type, normd, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, type, normd, VSTRIDE * 4, off); });
  gl.bindVertexArray(null);
  return { vao, vbo, ibo };
}
const emptyVAO = gl.createVertexArray();

// ---------------------------------------------------------------- targets
// CW x CH is the canvas; scenes may render into a smaller RW x RH corner of the layers.
let CW = 0, CH = 0, DPR = 1;
const T = { BG: null, FG: null, SH: null, ID: null, OV: null, OUT: [null, null, null] };
let PAL_TEX = null;
const FORCE_W = parseInt(QS.get('w') || '0', 10), FORCE_H = parseInt(QS.get('h') || '0', 10);
function glResize() {
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.max(1, window.innerWidth || 1280), ch = Math.max(1, window.innerHeight || 720);
  let w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  const maxPx = 3.7e6;
  if (w * h > maxPx) { const k = Math.sqrt(maxPx / (w * h)); w = Math.round(w * k); h = Math.round(h * k); dpr *= k; }
  if (FORCE_W > 0 && FORCE_H > 0) { w = FORCE_W; h = FORCE_H; dpr = parseFloat(QS.get('dpr') || '1'); }
  if (w === CW && h === CH) return false;
  CW = w; CH = h; DPR = dpr;
  cv.width = w; cv.height = h;
  for (const k of ['BG', 'FG', 'SH', 'ID', 'OV']) glFreeTarget(T[k]);
  T.OUT.forEach(glFreeTarget);
  T.BG = glTarget(w, h, true);
  T.FG = glTarget(w, h, true);
  T.OV = glTarget(w, h, true);
  T.ID = glTarget(w, h, false);
  T.SH = glTarget(Math.ceil(w / 2), Math.ceil(h / 2), false);
  T.OUT = [glTarget(w, h, false), glTarget(w, h, false), glTarget(w, h, false)];
  return true;
}

// opts: {world, vp, mode (0 paint, 1 mask, 2 ids), boil, jit, noClear, time, clip, stir, w, h}
function glDrawStrokes(buf, TG, opts) {
  const w = opts.w || TG.w, h = opts.h || TG.h;
  gl.bindFramebuffer(gl.FRAMEBUFFER, TG.fb);
  gl.viewport(0, 0, opts.vw || w, opts.vh || h);
  gl.disable(gl.BLEND);
  if (!opts.noClear) {
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    if (TG.withHeight) gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
  }
  if (buf.ni === 0) return;
  const P = PROG_STROKE, u = P.u;
  gl.useProgram(P.p);
  gl.uniform2f(u.u_res, w, h);
  gl.uniform1f(u.u_mode, opts.mode || 0);
  gl.uniform1f(u.u_world, opts.world ? 1 : 0);
  gl.uniform1f(u.u_boil, opts.boil || 0);
  gl.uniform1f(u.u_jit, opts.jit || 0);
  gl.uniform1f(u.u_time, opts.time || 0);
  gl.uniform4fv(u.u_clip, opts.clip || [0, 0, 0, 0]);
  gl.uniform4fv(u.u_stir, opts.stir || [0, 0, 0, 1]);
  gl.uniformMatrix4fv(u.u_vp, false, opts.vp || new Float32Array(16));
  gl.enable(gl.BLEND);
  if (opts.mode === 1) gl.blendEquation(gl.MAX);
  else { gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
  gl.bindVertexArray(buf.vao);
  if (buf.dirty) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf.ab, 0, buf.nv * VSTRIDE * 4), buf.static ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, buf.idx.subarray(0, buf.ni), buf.static ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
    buf.dirty = false;
  }
  gl.drawElements(gl.TRIANGLES, buf.ni, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
}

function glBindTex(prog, list) {
  list.forEach(([tex, name], i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name], i);
  });
}

// light the layers of one scene into OUT[slot]
function glSceneComposite(slot, U, w, h) {
  const OUT = T.OUT[slot];
  gl.bindFramebuffer(gl.FRAMEBUFFER, OUT.fb);
  gl.viewport(0, 0, w, h);
  const P = PROG_SCENE, u = P.u;
  gl.useProgram(P.p);
  glBindTex(P, [[T.BG.color, 'u_bgC'], [T.BG.height, 'u_bgH'], [T.FG.color, 'u_fgC'], [T.FG.height, 'u_fgH'], [T.SH.color, 'u_sh']]);
  gl.uniform2f(u.u_tex, CW, CH);
  gl.uniform1f(u.u_dpr, DPR);
  gl.uniform1f(u.u_relief, U.relief !== undefined ? U.relief : 2.0);
  gl.uniform1f(u.u_time, U.time || 0);
  gl.uniform1f(u.u_expo, U.expo !== undefined ? U.expo : 1);
  gl.uniform3fv(u.u_amb, U.amb || [1, 1, 1]);
  gl.uniform3fv(u.u_ground, U.ground || [0.05, 0.04, 0.06]);
  const Lw = new Float32Array(16), Lf = new Float32Array(16), Lc = new Float32Array(16);
  (U.lights || []).slice(0, 4).forEach((L, i) => {
    Lw.set(L.wall || [0, 0, 1, 1], i * 4);
    Lf.set(L.floor || [0, 0, 1, 1], i * 4);
    Lc.set([L.col[0], L.col[1], L.col[2], L.sh || 0], i * 4);
  });
  gl.uniform4fv(u.u_Lw, Lw); gl.uniform4fv(u.u_Lf, Lf); gl.uniform4fv(u.u_Lc, Lc);
  gl.uniform4fv(u.u_refl, U.refl || [0, 0, 0, 0]);
  gl.uniform3fv(u.u_Ldir, U.ldir || [-0.45, 0.55, 0.7]);
  gl.bindVertexArray(emptyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

function glFinal(F) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, CW, CH);
  const P = PROG_FINAL, u = P.u;
  gl.useProgram(P.p);
  glBindTex(P, [[T.OUT[0].color, 'u_A'], [T.OUT[1].color, 'u_B'], [T.OUT[2].color, 'u_C'],
    [T.OV.color, 'u_ovC'], [T.OV.height, 'u_ovH'], [T.FG.color, 'u_popF'], [T.ID.color, 'u_popI'], [PAL_TEX, 'u_pal']]);
  gl.uniform2f(u.u_res, CW, CH);
  const s = k => F[k] || [1, 1];
  gl.uniform2fv(u.u_sA, s('sA')); gl.uniform2fv(u.u_sB, s('sB')); gl.uniform2fv(u.u_sC, s('sC'));
  gl.uniform1f(u.u_mode, F.mode || 0);
  gl.uniform1f(u.u_time, F.time || 0);
  gl.uniform1f(u.u_grain, F.grain || 0);
  gl.uniform1f(u.u_dpr, DPR);
  gl.uniform1f(u.u_fade, F.fade !== undefined ? F.fade : 1);
  for (let i = 0; i < 5; i++) gl.uniform4fv(u['u_p' + i], F['p' + i] || [0, 0, 0, 0]);
  gl.uniform4fv(u.u_w, F.w || [0, 0, 0, 0]);
  const band = new Float32Array(12);
  (F.bands || []).slice(0, 3).forEach((b, i) => band.set(b, i * 4));
  gl.uniform4fv(u.u_band, band);
  gl.bindVertexArray(emptyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

// pop-art colourways: 16 rows of 8 slots (bg, coat, skin, hair, blacks, mic, lips/detail, highlight)
function glMakePalette(rows) {
  const data = new Uint8Array(8 * 16 * 4);
  rows.forEach((row, y) => row.forEach((c, x) => {
    const q = (y * 8 + x) * 4;
    data[q] = c[0] * 255; data[q + 1] = c[1] * 255; data[q + 2] = c[2] * 255; data[q + 3] = 255;
  }));
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 8, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return t;
}
