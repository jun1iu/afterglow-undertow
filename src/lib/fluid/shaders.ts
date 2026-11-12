/**
 * GLSL for the fluid solver. Each fragment shader is one step of a
 * "stable fluids" pipeline running on ping-ponged float textures:
 *
 *   splat → curl → vorticity → divergence → pressure (Jacobi × N)
 *         → gradient subtract → advect velocity → advect dye
 *
 * followed by a bloom chain and the display pass. Solid obstacles come from
 * a mask texture and are enforced as boundary conditions in the divergence,
 * pressure and gradient steps.
 */

export const VERTEX = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_texel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = pos;
  vL = vUv - vec2(u_texel.x, 0.0);
  vR = vUv + vec2(u_texel.x, 0.0);
  vT = vUv + vec2(0.0, u_texel.y);
  vB = vUv - vec2(0.0, u_texel.y);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
`;

/** A cell is solid if the obstacle mask covers it or it lies outside the domain. */
const SOLID = /* glsl */ `
uniform sampler2D u_mask;
bool solid(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return true;
  return texture(u_mask, uv).r > 0.5;
}
float open(vec2 uv) { return 1.0 - smoothstep(0.35, 0.6, texture(u_mask, uv).r); }
`;

export const COPY = /* glsl */ `${HEADER}
uniform sampler2D u_source;
uniform float u_scale;
void main() { outColor = texture(u_source, vUv) * u_scale; }
`;

/** Adds a Gaussian blob of `u_value` (force or dye) centred on `u_point`. */
export const SPLAT = /* glsl */ `${HEADER}
${SOLID}
uniform sampler2D u_target;
uniform vec3 u_value;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_aspect;
void main() {
  vec2 p = vUv - u_point;
  p.x *= u_aspect;
  vec3 blob = exp(-dot(p, p) / u_radius) * u_value;
  outColor = vec4(texture(u_target, vUv).rgb + blob * open(vUv), 1.0);
}
`;

/** Semi-Lagrangian advection: trace each cell backwards along the velocity field. */
export const ADVECT = /* glsl */ `${HEADER}
${SOLID}
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_velTexel;
uniform float u_dt;
uniform float u_dissipation;
void main() {
  vec2 coord = vUv - u_dt * texture(u_velocity, vUv).xy * u_velTexel;
  vec4 result = texture(u_source, coord) / (1.0 + u_dissipation * u_dt);
  outColor = result * open(vUv);
}
`;

export const CURL = /* glsl */ `${HEADER}
uniform sampler2D u_velocity;
void main() {
  float L = texture(u_velocity, vL).y;
  float R = texture(u_velocity, vR).y;
  float T = texture(u_velocity, vT).x;
  float B = texture(u_velocity, vB).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}
`;

/** Vorticity confinement: feeds energy back into the swirls numerical diffusion smears out. */
export const VORTICITY = /* glsl */ `${HEADER}
uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform float u_strength;
uniform float u_dt;
void main() {
  float L = texture(u_curl, vL).x;
  float R = texture(u_curl, vR).x;
  float T = texture(u_curl, vT).x;
  float B = texture(u_curl, vB).x;
  float C = texture(u_curl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  // Fade the force out for near-zero curl, otherwise it amplifies rounding
  // noise in still water into a field of tiny eddies.
  force *= u_strength * C * smoothstep(0.5, 6.0, abs(C));
  force.y *= -1.0;
  vec2 velocity = texture(u_velocity, vUv).xy + force * u_dt;
  outColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

export const DIVERGENCE = /* glsl */ `${HEADER}
${SOLID}
uniform sampler2D u_velocity;
void main() {
  vec2 C = texture(u_velocity, vUv).xy;
  float L = texture(u_velocity, vL).x;
  float R = texture(u_velocity, vR).x;
  float T = texture(u_velocity, vT).y;
  float B = texture(u_velocity, vB).y;
  // No-slip walls: a solid neighbour reflects the centre velocity.
  if (solid(vL)) L = -C.x;
  if (solid(vR)) R = -C.x;
  if (solid(vT)) T = -C.y;
  if (solid(vB)) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`;

/** One Jacobi iteration of the pressure Poisson equation. */
export const PRESSURE = /* glsl */ `${HEADER}
${SOLID}
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
void main() {
  float C = texture(u_pressure, vUv).x;
  float L = solid(vL) ? C : texture(u_pressure, vL).x;
  float R = solid(vR) ? C : texture(u_pressure, vR).x;
  float T = solid(vT) ? C : texture(u_pressure, vT).x;
  float B = solid(vB) ? C : texture(u_pressure, vB).x;
  float divergence = texture(u_divergence, vUv).x;
  outColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

/** Projects the velocity field onto its divergence-free part. */
export const GRADIENT = /* glsl */ `${HEADER}
${SOLID}
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
void main() {
  float C = texture(u_pressure, vUv).x;
  float L = solid(vL) ? C : texture(u_pressure, vL).x;
  float R = solid(vR) ? C : texture(u_pressure, vR).x;
  float T = solid(vT) ? C : texture(u_pressure, vT).x;
  float B = solid(vB) ? C : texture(u_pressure, vB).x;
  vec2 velocity = texture(u_velocity, vUv).xy - vec2(R - L, T - B);
  outColor = vec4(velocity * open(vUv), 0.0, 1.0);
}
`;

/** Keeps only what is brighter than the threshold, with a soft knee. */
export const BLOOM_PREFILTER = /* glsl */ `${HEADER}
uniform sampler2D u_source;
uniform float u_threshold;
void main() {
  vec3 c = texture(u_source, vUv).rgb;
  float brightness = max(c.r, max(c.g, c.b));
  float knee = u_threshold * 0.7;
  float soft = clamp(brightness - u_threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  outColor = vec4(c * max(soft, brightness - u_threshold) / max(brightness, 1e-4), 1.0);
}
`;

/** Four-tap box blur; used for both the down- and up-sampling halves of the bloom chain. */
export const BLUR = /* glsl */ `${HEADER}
uniform sampler2D u_source;
void main() {
  outColor = 0.25 * (texture(u_source, vL) + texture(u_source, vR) + texture(u_source, vT) + texture(u_source, vB));
}
`;

export const DISPLAY = /* glsl */ `${HEADER}
uniform sampler2D u_dye;
uniform sampler2D u_bloom;
uniform sampler2D u_velocity;
uniform sampler2D u_pressure;
uniform sampler2D u_mask;
uniform vec3 u_background;
uniform vec3 u_low;
uniform vec3 u_high;
uniform vec2 u_res;
uniform float u_bloomAmount;
uniform float u_relief;
uniform float u_grain;
uniform float u_time;
uniform int u_view;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 dyeView() {
  vec3 dye = texture(u_dye, vUv).rgb;
  float density = luma(dye);

  // Treat dye density as a height field and light it, so the fluid reads as
  // a glossy liquid rather than flat colour.
  float dx = luma(texture(u_dye, vR).rgb) - luma(texture(u_dye, vL).rgb);
  float dy = luma(texture(u_dye, vT).rgb) - luma(texture(u_dye, vB).rgb);
  vec3 normal = normalize(vec3(-dx, -dy, 0.12));
  vec3 light = normalize(vec3(-0.45, 0.6, 0.65));
  float diffuse = clamp(dot(normal, light), 0.0, 1.0);
  float specular = pow(clamp(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 28.0);

  dye *= mix(1.0, 0.45 + 0.85 * diffuse, u_relief);
  dye += specular * u_relief * 0.5 * smoothstep(0.02, 0.5, density);
  dye += texture(u_bloom, vUv).rgb * u_bloomAmount;

  // Exponential tone curve: dense dye saturates gracefully instead of clipping.
  return u_background + (1.0 - exp(-dye * 1.25));
}

vec3 velocityView() {
  vec2 v = texture(u_velocity, vUv).xy;
  // A linear ramp with a small dead zone: a square-root curve here would
  // amplify the solver's residual noise into visible speckle.
  float speed = smoothstep(0.02, 1.0, length(v) * 0.0045);
  float heading = atan(v.y, v.x);
  vec3 tint = mix(u_low, u_high, 0.5 + 0.5 * cos(heading));
  return u_background + tint * speed * (2.0 - speed);
}

vec3 pressureView() {
  float p = texture(u_pressure, vUv).x * 0.012;
  p = sign(p) * smoothstep(0.03, 1.0, abs(p));
  return u_background + u_high * clamp(p, 0.0, 1.0) + u_low * clamp(-p, 0.0, 1.0);
}

void main() {
  vec3 col = u_view == 1 ? velocityView() : u_view == 2 ? pressureView() : dyeView();

  // The obstacle: a dark void with a lit rim so it reads as a solid object.
  float mask = texture(u_mask, vUv).r;
  float inside = smoothstep(0.42, 0.58, mask);
  float rim = smoothstep(0.2, 0.5, mask) * (1.0 - smoothstep(0.5, 0.8, mask));
  col = mix(col, u_background * 0.4, inside);
  col += u_high * rim * 0.32;

  vec2 centred = vUv - 0.5;
  col *= 1.0 - 0.55 * dot(centred, centred);

  col = encodeSrgb(col);
  col += (hash(vUv * u_res + fract(u_time * 7.13) * 311.7) - 0.5) * (0.012 + u_grain * 0.12);
  outColor = vec4(col, 1.0);
}
`;
