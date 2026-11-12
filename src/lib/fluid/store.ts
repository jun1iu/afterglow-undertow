"use client";

import { generatePalette, isHex } from "../color";
import { createStore } from "../create-store";

export type Palette = readonly [string, string, string, string];
export type View = "dye" | "velocity" | "pressure";
export const VIEWS: readonly View[] = ["dye", "velocity", "pressure"];

/** Every numeric control, with its range. The order is also the URL order. */
export const CONTROLS = {
  vorticity: {
    label: "Vorticity",
    hint: "Swirl energy fed back into the flow",
    min: 0,
    max: 60,
    step: 1,
    initial: 28,
  },
  drag: { label: "Drag", hint: "How quickly motion dies away", min: 0, max: 3, step: 0.05, initial: 0.25 },
  fade: { label: "Fade", hint: "How quickly dye dissipates", min: 0, max: 4, step: 0.05, initial: 0.9 },
  flow: { label: "Flow", hint: "Strength of the two built-in jets", min: 0, max: 2, step: 0.05, initial: 1 },
  solver: {
    label: "Solver",
    hint: "Pressure iterations per frame",
    min: 4,
    max: 60,
    step: 1,
    initial: 24,
    unit: " it",
  },
  brush: { label: "Brush", hint: "Size of pointer splats", min: 0.1, max: 2, step: 0.05, initial: 0.6 },
  bloom: { label: "Bloom", hint: "Glow around dense dye", min: 0, max: 1.5, step: 0.05, initial: 0.6 },
  relief: { label: "Relief", hint: "Lighting from dye density", min: 0, max: 1, step: 0.01, initial: 0.55 },
} as const satisfies Record<string, ControlDef>;

export interface ControlDef {
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly initial: number;
  readonly unit?: string;
}

export type ControlId = keyof typeof CONTROLS;
export const CONTROL_IDS = Object.keys(CONTROLS) as ControlId[];
export type ControlValues = Readonly<Record<ControlId, number>>;

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly palette: Palette;
  readonly values: Partial<ControlValues>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: "ink",
    name: "Ink",
    palette: ["#07080f", "#2b3fd6", "#ff3d81", "#ffe9d6"],
    values: {},
  },
  {
    id: "smoke",
    name: "Smoke",
    palette: ["#0b0b0c", "#5b5f66", "#b9bcc2", "#f4f1ea"],
    values: { vorticity: 14, drag: 0.6, fade: 0.5, bloom: 0.2, relief: 0.8 },
  },
  {
    id: "plasma",
    name: "Plasma",
    palette: ["#05020d", "#6a1bff", "#00e5c3", "#f1ffe8"],
    values: { vorticity: 52, drag: 0.1, fade: 1.6, flow: 1.4, bloom: 1.2, relief: 0.25 },
  },
  {
    id: "ember",
    name: "Ember",
    palette: ["#0d0503", "#b3200f", "#ff8a1f", "#fff0b8"],
    values: { vorticity: 36, drag: 0.4, fade: 1.2, flow: 0.8, bloom: 0.9, relief: 0.4 },
  },
];

export const MAX_WORD_LENGTH = 10;

export interface FluidState {
  readonly preset: string | null;
  readonly values: ControlValues;
  readonly palette: Palette;
  /** Text rendered into the obstacle mask; empty means open water. */
  readonly word: string;
  readonly view: View;
  readonly grain: number;
  readonly paused: boolean;
  readonly chrome: boolean;
  /** Bumped to ask the simulation to clear its fields. */
  readonly resetCount: number;
}

const defaultValues = Object.fromEntries(
  CONTROL_IDS.map((id) => [id, CONTROLS[id].initial]),
) as ControlValues;

const initialPreset = PRESETS[0]!;

const DEFAULT_STATE: FluidState = {
  preset: initialPreset.id,
  values: { ...defaultValues, ...initialPreset.values },
  palette: initialPreset.palette,
  word: "Undertow",
  view: "dye",
  grain: 0.2,
  paused: false,
  chrome: true,
  resetCount: 0,
};

const store = createStore(DEFAULT_STATE);

export const getFluid = store.get;
export const subscribeFluid = store.subscribe;
export const useFluid = store.use;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const cleanWord = (word: string) => word.replace(/[^\p{L}\p{N} &!?.-]/gu, "").slice(0, MAX_WORD_LENGTH);

export const fluidActions = {
  setValue(id: ControlId, value: number) {
    const def = CONTROLS[id];
    const state = store.get();
    store.set({ ...state, preset: null, values: { ...state.values, [id]: clamp(value, def.min, def.max) } });
  },

  applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    store.set({
      ...store.get(),
      preset: preset.id,
      values: { ...defaultValues, ...preset.values },
      palette: preset.palette,
    });
  },

  setColor(index: number, hex: string) {
    if (!isHex(hex)) return;
    const state = store.get();
    const palette = state.palette.map((c, i) => (i === index ? hex.toLowerCase() : c)) as unknown as Palette;
    store.set({ ...state, preset: null, palette });
  },

  shuffle() {
    const seed = Math.floor(Math.random() * 9999) + 1;
    store.set({ ...store.get(), preset: null, palette: generatePalette(seed) });
  },

  setWord(word: string) {
    store.set({ ...store.get(), word: cleanWord(word) });
  },

  setView(view: View) {
    store.set({ ...store.get(), view });
  },

  cycleView() {
    const state = store.get();
    const next = VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length] ?? "dye";
    store.set({ ...state, view: next });
  },

  togglePaused() {
    const state = store.get();
    store.set({ ...state, paused: !state.paused });
  },

  setPaused(paused: boolean) {
    store.set({ ...store.get(), paused });
  },

  toggleChrome() {
    const state = store.get();
    store.set({ ...state, chrome: !state.chrome });
  },

  /** Clears the dye and velocity fields without touching any settings. */
  clear() {
    const state = store.get();
    store.set({ ...state, resetCount: state.resetCount + 1 });
  },

  hydrate(hash: string) {
    const next = decodeFluid(hash, store.get());
    if (next) store.set(next);
  },
};

/* -------------------------------------------------------------- URL sharing */

const round = (v: number) => Number(v.toFixed(3));

export function encodeFluid(s: FluidState): string {
  const q = new URLSearchParams();
  q.set("p", CONTROL_IDS.map((id) => round(s.values[id])).join("_"));
  q.set("c", s.palette.map((c) => c.slice(1)).join("_"));
  q.set("w", s.word);
  if (s.view !== "dye") q.set("v", s.view);
  return q.toString();
}

/** Parses a fragment defensively — a shared link is untrusted input. */
function decodeFluid(hash: string, base: FluidState): FluidState | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = q.get("p")?.split("_").map(Number);
  if (!raw || raw.length !== CONTROL_IDS.length || !raw.every(Number.isFinite)) return null;

  const values = Object.fromEntries(
    CONTROL_IDS.map((id, i) => [
      id,
      clamp(raw[i] ?? CONTROLS[id].initial, CONTROLS[id].min, CONTROLS[id].max),
    ]),
  ) as ControlValues;

  const colors = q
    .get("c")
    ?.split("_")
    .map((c) => `#${c.toLowerCase()}`);
  const palette =
    colors && colors.length === 4 && colors.every(isHex) ? (colors as unknown as Palette) : base.palette;

  const view = q.get("v");
  return {
    ...base,
    preset: null,
    values,
    palette,
    word: cleanWord(q.get("w") ?? base.word),
    view: VIEWS.find((v) => v === view) ?? "dye",
  };
}
