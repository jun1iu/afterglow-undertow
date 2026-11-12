/**
 * Shared GLSL for every material: uniforms, hashing/noise, the OKLab palette
 * ramp and the output stage (grain, sRGB encode, reveal mask).
 *
 * A material only has to implement `vec3 scene(vec2 uv, vec2 p)` returning
 * linear RGB. `uv` is 0..1, `p` is centred and aspect-corrected (short side
 * spans -0.5..0.5).
 */

export const VERTEX = /* glsl */ `#version 300 es
void main() {
  // Single oversized triangle — no buffers, no diagonal seam.
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const PRELUDE = /* glsl */ `#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2  u_res;      // drawing buffer size in px
uniform float u_time;     // seconds, already scaled by tempo
uniform vec2  u_pointer;  // smoothed pointer, 0..1, origin bottom-left
uniform float u_pulse;    // 1 on click, decays to 0
uniform float u_seed;
uniform float u_grain;
uniform vec3  u_pal[4];   // palette stops in OKLab
uniform float u_p[4];     // material parameters
uniform vec3  u_wipe;     // reveal: xy = origin px, z = radius px

#define TAU 6.28318530718

float hash11(float n) { return fract(sin(n) * 43758.5453123); }

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

const mat2 OCTAVE = mat2(1.6, 1.2, -1.2, 1.6); // rotate + scale by 2

float fbm(vec2 p) {
  float a = 0.5;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = OCTAVE * p + 17.3;
    a *= 0.5;
  }
  return v / 0.96875;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

// One palette stop as linear RGB.
vec3 stop(int i) { return max(oklabToLinear(u_pal[i]), 0.0); }

// Continuous ramp through all four stops, interpolated in OKLab.
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  vec3 c = mix(u_pal[0], u_pal[1], smoothstep(0.0, 1.0, t));
  c = mix(c, u_pal[2], smoothstep(1.0, 2.0, t));
  c = mix(c, u_pal[3], smoothstep(2.0, 3.0, t));
  return max(oklabToLinear(c), 0.0);
}

vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 scene(vec2 uv, vec2 p);

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_res;
  vec2 p = (frag - 0.5 * u_res) / min(u_res.x, u_res.y);

  vec3 col = encodeSrgb(scene(uv, p));

  // Film grain, added after encoding so it reads evenly across shadows
  // and highlights. Doubles as dithering against banding.
  float g = hash21(frag + fract(u_time * 7.13) * 311.7) - 0.5;
  col += g * (0.012 + u_grain * 0.14);

  // Reveal mask: an expanding disc with a noisy, feathered rim.
  float unit = min(u_res.x, u_res.y);
  float d = distance(frag, u_wipe.xy);
  float rim = (fbm(frag / unit * 5.0 + u_seed) - 0.5) * unit * 0.22;
  float alpha = 1.0 - smoothstep(u_wipe.z - unit * 0.12, u_wipe.z, d + rim);

  outColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
`;
