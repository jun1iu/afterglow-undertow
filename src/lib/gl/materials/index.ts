import { mercury } from "./mercury";
import { offset } from "./offset";
import { silk } from "./silk";
import { strata } from "./strata";
import { tide } from "./tide";

export interface ParamDef {
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly initial: number;
  readonly unit?: string;
}

export type Palette = readonly [string, string, string, string];
export type ParamValues = readonly [number, number, number, number];

export interface MaterialDef {
  readonly id: MaterialId;
  readonly name: string;
  readonly technique: string;
  readonly blurb: string;
  readonly fragment: string;
  readonly palette: Palette;
  /** Exactly four — they map onto the `u_p[4]` uniform. */
  readonly params: readonly [ParamDef, ParamDef, ParamDef, ParamDef];
}

export const MATERIAL_IDS = ["silk", "mercury", "offset", "strata", "tide"] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  silk: {
    id: "silk",
    name: "Silk",
    technique: "Domain-warped fBm",
    blurb: "Noise folded through itself three times, then lit along the pleats like satin.",
    fragment: silk,
    palette: ["#1a0b2e", "#b3264a", "#ff8a4c", "#ffe9c9"],
    params: [
      { label: "Scale", hint: "Size of the weave", min: 0.5, max: 3, step: 0.01, initial: 1.25 },
      { label: "Warp", hint: "How far the field bends itself", min: 0, max: 2.5, step: 0.01, initial: 1.35 },
      { label: "Sheen", hint: "Specular on the pleat crests", min: 0, max: 1, step: 0.01, initial: 0.6 },
      { label: "Folds", hint: "Pleat density", min: 0, max: 1, step: 0.01, initial: 0.4 },
    ],
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    technique: "Raymarched SDF",
    blurb: "Seven signed-distance spheres, smooth-unioned and finished in thin-film fresnel.",
    fragment: mercury,
    palette: ["#070812", "#3d2a8f", "#2fd4c4", "#f7f3e8"],
    params: [
      { label: "Mass", hint: "Radius of each droplet", min: 0.25, max: 0.7, step: 0.005, initial: 0.46 },
      { label: "Fusion", hint: "Smooth-union radius", min: 0.05, max: 1.2, step: 0.01, initial: 0.65 },
      { label: "Gloss", hint: "Mirror vs. matte", min: 0, max: 1, step: 0.01, initial: 0.7 },
      { label: "Film", hint: "Thin-film interference", min: 0, max: 1, step: 0.01, initial: 0.55 },
    ],
  },
  offset: {
    id: "offset",
    name: "Offset",
    technique: "Dual halftone screen",
    blurb: "Two dot screens thirty degrees apart, printed deliberately out of register.",
    fragment: offset,
    palette: ["#101014", "#ff4f2e", "#2a6bff", "#f5f0e1"],
    params: [
      { label: "Cell", hint: "Dot pitch", min: 0.012, max: 0.08, step: 0.001, initial: 0.03 },
      { label: "Angle", hint: "Screen rotation", min: 0, max: 90, step: 1, initial: 22, unit: "°" },
      { label: "Slip", hint: "Plate misregistration", min: 0, max: 1, step: 0.01, initial: 0.45 },
      { label: "Bleed", hint: "Ink spread at the dot edge", min: 0, max: 1, step: 0.01, initial: 0.12 },
    ],
  },
  strata: {
    id: "strata",
    name: "Strata",
    technique: "Derivative-AA isolines",
    blurb: "A drifting height field, terraced and traced with constant-width contour lines.",
    fragment: strata,
    palette: ["#0d1a14", "#1f5c46", "#c8b56a", "#f6f1dd"],
    params: [
      { label: "Scale", hint: "Map zoom", min: 0.6, max: 4, step: 0.01, initial: 1.6 },
      { label: "Levels", hint: "Number of contour bands", min: 4, max: 36, step: 1, initial: 14 },
      { label: "Weight", hint: "Line thickness in pixels", min: 0.5, max: 3, step: 0.05, initial: 1.2, unit: "px" },
      { label: "Relief", hint: "Shadow under each terrace", min: 0, max: 1, step: 0.01, initial: 0.6 },
    ],
  },
  tide: {
    id: "tide",
    name: "Tide",
    technique: "Worley caustics",
    blurb: "Two layers of animated cells, refracted per channel into pool-floor light.",
    fragment: tide,
    palette: ["#03141f", "#0b4f6c", "#37c8c3", "#eafff7"],
    params: [
      { label: "Scale", hint: "Cell density", min: 2, max: 10, step: 0.05, initial: 5 },
      { label: "Swell", hint: "Surface distortion", min: 0, max: 1.5, step: 0.01, initial: 0.6 },
      { label: "Focus", hint: "How tightly the light gathers", min: 1, max: 6, step: 0.05, initial: 3 },
      { label: "Prism", hint: "Chromatic dispersion", min: 0, max: 1, step: 0.01, initial: 0.45 },
    ],
  },
};

export const MATERIAL_LIST: readonly MaterialDef[] = MATERIAL_IDS.map((id) => MATERIALS[id]);

export function isMaterialId(value: unknown): value is MaterialId {
  return typeof value === "string" && (MATERIAL_IDS as readonly string[]).includes(value);
}
