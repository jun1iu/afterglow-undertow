export const mercury = /* glsl */ `
// Mercury — raymarched metaballs with a thin-film fresnel finish.
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

vec3 g_pointer;

float map(vec3 q) {
  float size = u_p[0];
  float k = u_p[1];
  float t = u_time * 0.45 + u_seed * 10.0;
  float d = 1e5;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec3 c = vec3(
      sin(t * (0.50 + 0.11 * fi) + fi * 2.4),
      cos(t * (0.43 + 0.07 * fi) + fi * 1.7) * 0.8,
      sin(t * (0.37 + 0.05 * fi) + fi * 4.1) * 0.5
    ) * 1.05;
    float r = size * (0.62 + 0.38 * hash11(fi + 3.0));
    d = smin(d, length(q - c) - r, k);
  }
  d = smin(d, length(q - g_pointer) - size * (0.5 + 0.35 * u_pulse), k);
  return d;
}

vec3 normalAt(vec3 q) {
  const vec2 e = vec2(1.0, -1.0) * 0.002;
  return normalize(
    e.xyy * map(q + e.xyy) + e.yyx * map(q + e.yyx) +
    e.yxy * map(q + e.yxy) + e.xxx * map(q + e.xxx)
  );
}

vec3 sky(vec3 d) {
  float band = 0.5 + 0.5 * d.y;
  float streak = fbm(d.xy * 2.2 + vec2(u_time * 0.03, 0.0));
  return ramp(clamp(band * 0.75 + streak * 0.35, 0.0, 1.0));
}

vec3 scene(vec2 uv, vec2 p) {
  float gloss = u_p[2];
  float film  = u_p[3];

  vec2 pp = (u_pointer - 0.5) * u_res / min(u_res.x, u_res.y);
  g_pointer = vec3(pp * 2.5, 0.35);

  vec3 ro = vec3(0.0, 0.0, 4.0);
  vec3 rd = normalize(vec3(p, -1.6));

  float dist = 0.0;
  float nearest = 1e5;
  bool hit = false;
  float d = 1.0;
  for (int i = 0; i < 56; i++) {
    d = map(ro + rd * dist);
    nearest = min(nearest, d);
    if (d < 0.003) { hit = true; break; }
    dist += d;
    if (dist > 8.0) break;
  }
  // Rays that graze the surface run out of steps just short of it;
  // accept them rather than letting the backdrop show through as cracks.
  if (!hit && dist < 8.0 && d < 0.04) hit = true;

  // Backdrop: a dim pool of light, brighter where the surface nearly grazes.
  vec3 bg = mix(stop(0) * 0.55, stop(1) * 0.45, smoothstep(0.9, 0.0, length(p)));
  bg += stop(2) * exp(-nearest * 7.0) * 0.22;
  if (!hit) return bg;

  vec3 pos = ro + rd * dist;
  vec3 n = normalAt(pos);
  vec3 r = reflect(rd, n);
  float ndv = max(dot(n, -rd), 0.0);
  float fres = pow(1.0 - ndv, 3.0);

  // Thin film: the ramp position cycles with viewing angle.
  float phase = ndv * (1.0 + film * 2.5) + dot(n, vec3(0.3, 0.5, 0.2)) * film;
  vec3 body = ramp(0.5 + 0.5 * sin(phase * TAU * 0.5 + 1.2));
  body = mix(ramp(0.2 + 0.5 * ndv), body, 0.35 + 0.65 * film);

  vec3 env = sky(r);
  vec3 col = mix(body, env, 0.25 + 0.55 * gloss);
  col += env * fres * (0.4 + 0.6 * gloss);

  vec3 light = normalize(vec3(-0.5, 0.8, 0.6));
  float spec = pow(max(dot(r, light), 0.0), mix(12.0, 90.0, gloss));
  col += stop(3) * spec * (0.3 + 0.9 * gloss);

  // Cheap occlusion from the field itself.
  float ao = clamp(map(pos + n * 0.25) / 0.25, 0.0, 1.0);
  col *= 0.55 + 0.45 * ao;
  return col;
}
`;
