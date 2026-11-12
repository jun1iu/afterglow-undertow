"use client";

import { useSyncExternalStore } from "react";
import type { Renderer, RenderStats } from "./gl/renderer";
import { encode, getState } from "./store";

/**
 * Things that live outside React's data flow: the renderer instance, the
 * twice-a-second stats readout, and transient toasts.
 */

function createSignal<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function useSignal<T>(signal: ReturnType<typeof createSignal<T>>): T {
  return useSyncExternalStore(signal.subscribe, signal.get, signal.get);
}

type Support = "pending" | "ok" | "unsupported";

const stats = createSignal<RenderStats | null>(null);
const support = createSignal<Support>("pending");
const toast = createSignal<{ id: number; message: string } | null>(null);
const commandOpen = createSignal(false);

let renderer: Renderer | null = null;
let toastTimer = 0;
let toastId = 0;

export const runtime = {
  attach(instance: Renderer | null) {
    renderer = instance;
    support.set(instance ? "ok" : "unsupported");
  },
  detach() {
    renderer = null;
  },
  reportStats: stats.set,
  setCommandOpen: commandOpen.set,

  notify(message: string) {
    window.clearTimeout(toastTimer);
    toast.set({ id: ++toastId, message });
    toastTimer = window.setTimeout(() => toast.set(null), 2200);
  },

  shareUrl(): string {
    return `${window.location.origin}${window.location.pathname}#${encode(getState())}`;
  },

  async copyLink() {
    try {
      await navigator.clipboard.writeText(runtime.shareUrl());
      runtime.notify("Link copied — this exact look is in the URL");
    } catch {
      runtime.notify("Couldn't reach the clipboard — copy the address bar instead");
    }
  },

  async exportPng() {
    if (!renderer) return;
    const blob = await renderer.capture();
    if (!blob) {
      runtime.notify("Export failed");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `afterglow-${getState().material}-${Date.now().toString(36)}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    runtime.notify("Frame exported as PNG");
  },
};

export const useStats = () => useSignal(stats);
export const useSupport = () => useSignal(support);
export const useToast = () => useSignal(toast);
export const useCommandOpen = () => useSignal(commandOpen);
