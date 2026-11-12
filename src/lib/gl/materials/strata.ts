export const strata = /* glsl */ `
// Strata — isolines traced over a slowly drifting height field.
vec3 scene(vec2 uv, vec2 p) {
  float scale  = u_p[0];
  float lines  = u_p[1];
  float weight = u_p[2];
  float relief = u_p[3];

  float t = u_time * 0.035;
  vec2 q = p * scale + u_seed * 5.0;
  vec2 w = vec2(fbm(q + t), fbm(q - t + 3.7)) - 0.5;
  float h = fbm(q + w * 0.9 + vec2(t * 0.6, 0.0));

  // The pointer raises a hill you can drag across the map.
  vec2 pp = (u_pointer - 0.5) * u_res / min(u_res.x, u_res.y);
  vec2 dp = p - pp;
  h += (0.16 + 0.12 * u_pulse) * exp(-dot(dp, dp) * 9.0);

  float v = h * lines;
  float level = floor(v);
  float fr = v - level;
  float band = level / lines;

  // Terraced fill: each band is flat, with a soft drop shadow under its lip.
  vec3 col = ramp(smoothstep(0.2, 0.85, mix(h, band, 0.85)) * 0.82);
  col *= 1.0 - relief * 0.45 * exp(-fr * 5.0);
  col += stop(2) * relief * 0.08 * smoothstep(0.6, 1.0, fr);

  // Screen-space derivative keeps the line weight constant at any zoom.
  float px = fwidth(v);
  float edge = min(fr, 1.0 - fr);
  float isIndex = step(mod(level + step(0.5, fr), 5.0), 0.5);
  float width = weight * (0.5 + 0.6 * isIndex);
  float line = 1.0 - smoothstep(px * width * 0.5, px * (width * 0.5 + 1.0), edge);
  line *= smoothstep(0.9, 0.25, px);               // fade where lines would alias
  col = mix(col, stop(3), line * (0.45 + 0.4 * isIndex));

  col *= 1.0 - 0.35 * dot(p, p);
  return col;
}
`;
