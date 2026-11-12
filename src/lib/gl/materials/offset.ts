export const offset = /* glsl */ `
// Offset — two halftone screens printed slightly out of register.
float field(vec2 q) {
  vec2 drift = vec2(u_time * 0.05, -u_time * 0.035);
  float v = fbm(q * 1.5 + drift + u_seed * 4.0);
  v += 0.5 * fbm(q * 0.6 - drift * 0.6 + 11.0) - 0.25;
  return smoothstep(0.22, 0.78, v);
}

float screen(vec2 p, float angle, float cell, vec2 shift, float soft, vec2 pp) {
  mat2 m = rot(angle);
  vec2 r = m * p;
  vec2 c = (floor(r / cell) + 0.5) * cell;
  vec2 world = c * m; // inverse rotation: back to scene space

  float v = field(world + shift);
  vec2 dp = world - pp;
  v = clamp(v + (0.35 + 0.5 * u_pulse) * exp(-dot(dp, dp) * 14.0), 0.0, 1.0);

  // Dot area, not radius, tracks the tone — as on a real plate.
  float radius = cell * 0.6 * sqrt(v);
  float aa = 1.5 / min(u_res.x, u_res.y) + soft * cell * 0.35;
  return 1.0 - smoothstep(radius - aa, radius + aa, length(r - c));
}

vec3 scene(vec2 uv, vec2 p) {
  float cell  = u_p[0];
  float angle = radians(u_p[1]);
  float slip  = u_p[2];
  float soft  = u_p[3];

  vec2 pp = (u_pointer - 0.5) * u_res / min(u_res.x, u_res.y);
  vec2 shift = vec2(0.31, -0.17) * slip;

  float a = screen(p, angle, cell, vec2(0.0), soft, pp);
  float b = screen(p + shift * cell * 1.5, angle + radians(30.0), cell * 1.08, shift, soft, pp);

  vec3 col = stop(0);
  col *= 0.9 + 0.1 * vnoise(p * 260.0);            // paper tooth
  col = mix(col, stop(1), a * 0.96);
  col = mix(col, stop(2), b * 0.9);
  col = mix(col, stop(3), a * b);                  // overprint
  col *= 1.0 - 0.3 * dot(p, p);
  return col;
}
`;
