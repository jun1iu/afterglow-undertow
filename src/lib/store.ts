"use client";

import { useSyncExternalStore } from "react";
import { generatePalette, isHex } from "./color";
import {
  MATERIAL_IDS,
  MATERIALS,
  isMaterialId,
  type MaterialId,
  type Palette,
  type ParamValues,
} from "./gl/materials";

/**
 * A deliberately tiny external store. React subscribes through
 * `useSyncExternalStore`; the WebGL renderer subscribes directly, so dragging
 * a slider repaints the canvas without re-rendering a single component that
 * doesn't display that value.
 */

export interface Point {
  /** Viewport coordinates in CSS pixels. */
  readonly x: number;
  readonly y: number;
}

export interface StudioState {
  readonly material: MaterialId;
  /** Where the last material change was triggered from (drives the reveal). */
  readonly origin: Point | null;
  readonly params: Readonly<Record<MaterialId, ParamValues>>;
  readonly palettes: Readonly<Record<MaterialId, Palette>>;
  readonly tempo: number;
  readonly grain: number;
  readonly seed: number;
  readonly paused: boolean;
  readonly chrome: boolean;
}

function defaults(): StudioState {
  const params = {} as Record<MaterialId, ParamValues>;
  const palettes = {} as Record<MaterialId, Palette>;
  for (const id of MATERIAL_IDS) {
    const def = MATERIALS[id];
    params[id] = def.params.map((p) => p.initial) as unknown as ParamValues;
    palettes[id] = def.palette;
  }
  return {
    material: "silk",
    origin: null,
    params,
    palettes,
    tempo: 1,
    grain: 0.25,
    seed: 0,
    paused: false,
    chrome: true,
  };
}

export const DEFAULT_STATE: StudioState = defaults();

type Listener = () => void;

let state: StudioState = DEFAULT_STATE;
const listeners = new Set<Listener>();

function set(next: StudioState) {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getState(): StudioState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStudio<T>(selector: (s: StudioState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULT_STATE),
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* ------------------------------------------------------------------ actions */

export const actions = {
  setMaterial(material: MaterialId, origin: Point | null = null) {
    if (material === state.material) return;
    set({ ...state, material, origin });
  },

  cycleMaterial(direction: 1 | -1) {
    const i = MATERIAL_IDS.indexOf(state.material);
    const next = MATERIAL_IDS[(i + direction + MATERIAL_IDS.length) % MATERIAL_IDS.length];
    if (next) actions.setMaterial(next);
  },

  setParam(index: number, value: number) {
    const def = MATERIALS[state.material].params[index];
    if (!def) return;
    const current = state.params[state.material];
    const next = current.map((v, i) => (i === index ? clamp(value, def.min, def.max) : v));
    set({ ...state, params: { ...state.params, [state.material]: next as unknown as ParamValues } });
  },

  setColor(index: number, hex: string) {
    if (!isHex(hex)) return;
    const next = state.palettes[state.material].map((c, i) => (i === index ? hex.toLowerCase() : c));
    set({ ...state, palettes: { ...state.palettes, [state.material]: next as unknown as Palette } });
  },

  setPalette(palette: Palette) {
    set({ ...state, palettes: { ...state.palettes, [state.material]: palette } });
  },

  setTempo(tempo: number) {
    set({ ...state, tempo: clamp(tempo, 0, 3) });
  },

  setGrain(grain: number) {
    set({ ...state, grain: clamp(grain, 0, 1) });
  },

  /** New seed + a freshly generated palette for the current material. */
  shuffle() {
    const seed = Math.floor(Math.random() * 9999) + 1;
    const palette = generatePalette(seed) as unknown as Palette;
    set({ ...state, seed, palettes: { ...state.palettes, [state.material]: palette } });
  },

  resetMaterial() {
    const def = MATERIALS[state.material];
    set({
      ...state,
      seed: 0,
      params: { ...state.params, [def.id]: def.params.map((p) => p.initial) as unknown as ParamValues },
      palettes: { ...state.palettes, [def.id]: def.palette },
    });
  },

  togglePaused() {
    set({ ...state, paused: !state.paused });
  },

  setPaused(paused: boolean) {
    set({ ...state, paused });
  },

  toggleChrome() {
    set({ ...state, chrome: !state.chrome });
  },

  hydrate(hash: string) {
    const next = decode(hash, state);
    if (next) set(next);
  },
};

/* -------------------------------------------------------------- URL sharing */

const round = (v: number) => Number(v.toFixed(3));

/** Serialises the visible look (current material only) into a URL fragment. */
export function encode(s: StudioState): string {
  const q = new URLSearchParams();
  q.set("m", s.material);
  q.set("p", s.params[s.material].map(round).join("_"));
  q.set("c", s.palettes[s.material].map((c) => c.slice(1)).join("_"));
  if (s.tempo !== DEFAULT_STATE.tempo) q.set("t", String(round(s.tempo)));
  if (s.grain !== DEFAULT_STATE.grain) q.set("g", String(round(s.grain)));
  if (s.seed !== 0) q.set("s", String(s.seed));
  return q.toString();
}

/** Parses a fragment defensively — a shared link is untrusted input. */
export function decode(hash: string, base: StudioState): StudioState | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const material = q.get("m");
  if (!isMaterialId(material)) return null;
  const def = MATERIALS[material];

  let params = base.params[material];
  const rawParams = q.get("p")?.split("_").map(Number);
  if (rawParams && rawParams.length === def.params.length && rawParams.every(Number.isFinite)) {
    params = def.params.map((p, i) => clamp(rawParams[i] ?? p.initial, p.min, p.max)) as unknown as ParamValues;
  }

  let palette = base.palettes[material];
  const rawColors = q.get("c")?.split("_").map((c) => `#${c.toLowerCase()}`);
  if (rawColors && rawColors.length === 4 && rawColors.every(isHex)) {
    palette = rawColors as unknown as Palette;
  }

  const num = (key: string, fallback: number, min: number, max: number) => {
    const raw = q.get(key);
    if (raw === null) return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? clamp(v, min, max) : fallback;
  };

  return {
    ...base,
    material,
    origin: null,
    params: { ...base.params, [material]: params },
    palettes: { ...base.palettes, [material]: palette },
    tempo: num("t", DEFAULT_STATE.tempo, 0, 3),
    grain: num("g", DEFAULT_STATE.grain, 0, 1),
    seed: Math.floor(num("s", 0, 0, 9999)),
  };
}
