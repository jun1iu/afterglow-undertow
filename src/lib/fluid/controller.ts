"use client";

import { runtime } from "../runtime";
import type { FluidSim } from "./sim";
import { encodeFluid, getFluid } from "./store";

/** Imperative actions that need the live simulation rather than just its state. */

let sim: FluidSim | null = null;

export const fluidController = {
  attach(instance: FluidSim | null) {
    sim = instance;
  },

  async copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${encodeFluid(getFluid())}`;
    try {
      await navigator.clipboard.writeText(url);
      runtime.notify("Link copied — these settings are in the URL");
    } catch {
      runtime.notify("Couldn't reach the clipboard — copy the address bar instead");
    }
  },

  async exportPng() {
    const blob = await sim?.capture();
    if (!blob) {
      runtime.notify("Export failed");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `undertow-${Date.now().toString(36)}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    runtime.notify("Frame exported as PNG");
  },
};
