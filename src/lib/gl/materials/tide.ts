export const tide = /* glsl */ `
// Tide — layered Worley cell borders, refracted into pool-floor caustics.

// Distance between the nearest and second-nearest feature point: zero
// exactly on a cell border, which is where the light gathers.
float border(vec2 x, float t) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int xo = -1; xo <= 1; xo++) {
      vec2 g = vec2(float(xo), float(y));
      vec2 o = 0.5 + 0.42 * sin(t + TAU * hash22(i + g));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}

float caustic(vec2 q, float t, float focus) {
  float k = 2.0 + focus * 3.5;
  float a = exp(-border(q, t) * k);
  float b = exp(-border(q * 1.43 + vec2(3.1, 7.7), t * 1.27 + 2.0) * k);
  // Two sheets of light; where their filaments cross, they flare.
  return 0.45 * (a + b) + 1.6 * a * b;
}

vec3 scene(vec2 uv, vec2 p) {
  float scale = u_p[0];
  float bend  = u_p[1];
  float focus = u_p[2];
  float split = u_p[3];

  float t = u_time * 0.55 + u_seed * 20.0;
  vec2 q = p * scale;

  // Surface swell bends the light before it lands.
  vec2 swell = vec2(fbm(q * 0.45 + t * 0.07), fbm(q * 0.45 - t * 0.06 + 4.0)) - 0.5;
  q += swell * bend * 1.6;

  // Pointer drops a ring of ripples.
  vec2 pp = (u_pointer - 0.5) * u_res / min(u_res.x, u_res.y);
  vec2 dp = p - pp;
  float dist = length(dp) + 1e-4;
  q += dp / dist * sin(dist * 34.0 - u_time * 5.0) * exp(-dist * 5.0) * (0.05 + 0.25 * u_pulse);

  // Dispersion: each channel refracts by a slightly different amount.
  vec2 off = (swell + vec2(0.06, 0.04)) * split * 0.16;
  vec3 light = vec3(
    caustic(q + off, t, focus),
    caustic(q, t, focus),
    caustic(q - off, t, focus)
  );

  float depth = clamp(0.3 + 0.45 * uv.y + swell.x * 0.6, 0.0, 1.0);
  vec3 col = mix(stop(0), stop(1), depth);
  col += light * mix(stop(2), stop(3), clamp(light.g - 0.35, 0.0, 1.0)) * 0.6;
  col *= 1.0 - 0.45 * dot(p, p);
  return col;
}
`;
