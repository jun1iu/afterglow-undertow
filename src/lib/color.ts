/**
 * Colour maths. Palettes are authored as sRGB hex, but everything the GPU
 * touches is OKLab so gradients stay perceptually even (no muddy midpoints).
 */

type Vec3 = readonly [number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function hexToRgb(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex([r, g, b]: Vec3): string {
  const to = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function linearRgbToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklab(hex: string): Vec3 {
  const [r, g, b] = hexToRgb(hex);
  return linearRgbToOklab([srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]);
}

/** OKLCH → hex, reducing chroma until the colour fits inside sRGB. */
function oklchToHex(l: number, c: number, hueDeg: number): string {
  const h = (hueDeg * Math.PI) / 180;
  let chroma = c;
  for (let i = 0; i < 24; i++) {
    const rgb = oklabToLinearRgb([l, chroma * Math.cos(h), chroma * Math.sin(h)]);
    const inGamut = rgb.every((v) => v >= -0.0005 && v <= 1.0005);
    if (inGamut || chroma < 0.002) {
      return rgbToHex([
        linearToSrgb(clamp01(rgb[0])),
        linearToSrgb(clamp01(rgb[1])),
        linearToSrgb(clamp01(rgb[2])),
      ]);
    }
    chroma *= 0.9;
  }
  return rgbToHex([l, l, l]);
}

/** Small deterministic PRNG so a seed always yields the same palette. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a four-stop ramp: a deep shade, two chromatic mids and a bright
 * accent. Lightness climbs monotonically so every material keeps its depth;
 * only hue relationships and chroma are left to chance.
 */
export function generatePalette(seed: number): [string, string, string, string] {
  const rand = mulberry32(seed);
  const base = rand() * 360;
  const schemes = [
    [0, 28, 56, 84], // analogous sweep
    [0, 24, 180, 204], // split pair
    [0, 40, 150, 190], // wide triad-ish
    [0, -30, -60, 120], // reverse sweep + pop
  ] as const;
  const scheme = schemes[Math.floor(rand() * schemes.length)] ?? schemes[0];
  const lightness = [
    0.16 + rand() * 0.08,
    0.42 + rand() * 0.1,
    0.66 + rand() * 0.1,
    0.9 + rand() * 0.06,
  ] as const;
  const chroma = [
    0.05 + rand() * 0.05,
    0.14 + rand() * 0.1,
    0.13 + rand() * 0.1,
    0.04 + rand() * 0.08,
  ] as const;
  const stop = (i: 0 | 1 | 2 | 3) => oklchToHex(lightness[i], chroma[i], base + scheme[i]);
  return [stop(0), stop(1), stop(2), stop(3)];
}
