export const silk = /* glsl */ `
// Silk — noise warped by noise warped by noise, then lit along its folds.
vec3 scene(vec2 uv, vec2 p) {
  float scale = u_p[0];
  float warp  = u_p[1];
  float sheen = u_p[2];
  float folds = u_p[3];

  float t = u_time * 0.06;
  vec2 q = p * scale + u_seed * 3.1;
  q += (u_pointer - 0.5) * 0.3;

  vec2 a = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - t));
  vec2 b = vec2(
    fbm(q + warp * 2.0 * a + vec2(1.7, 9.2) + t * 0.7),
    fbm(q + warp * 2.0 * a + vec2(8.3, 2.8) - t * 0.5)
  );
  float f = fbm(q + warp * 2.0 * b + u_pulse * 0.08);

  // The fold coordinate runs across the cloth; its sine is the pleating.
  float along = f * (1.5 + folds * 7.0) + b.x * 1.5 + a.y;
  float pleat = sin(along * TAU);

  float tone = smoothstep(0.26, 0.98, f + 0.3 * (b.y - 0.5));
  tone += folds * 0.1 * pleat;
  vec3 col = ramp(tone);

  // Satin highlight: tight specular riding the crest of each pleat.
  float crest = pow(0.5 + 0.5 * pleat, 9.0);
  col += stop(3) * crest * sheen * 0.4 * smoothstep(0.1, 0.7, tone);

  // Shadows pool where the warp field collapses.
  col *= 0.72 + 0.28 * smoothstep(0.0, 0.5, length(b - a) * 1.6 + 0.15);

  col *= 1.0 - 0.35 * dot(p, p);
  return col;
}
`;
