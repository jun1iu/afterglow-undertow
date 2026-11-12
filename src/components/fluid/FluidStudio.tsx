"use client";

import { Download, Eye, Link2, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Tooltip } from "radix-ui";
import { useEffect, useState, type CSSProperties } from "react";
import { fluidController } from "@/lib/fluid/controller";
import { PRESETS, encodeFluid, fluidActions, getFluid, subscribeFluid, useFluid } from "@/lib/fluid/store";
import { IconButton, Kbd } from "../IconButton";
import { Readout } from "../Readout";
import { StudioNav } from "../StudioNav";
import { Toaster } from "../Toaster";
import { FluidCanvas } from "./FluidCanvas";
import { FluidPanel } from "./FluidPanel";
import { PresetDock } from "./PresetDock";

const EASE = [0.16, 1, 0.3, 1] as const;

function useUrlSync() {
  useEffect(() => {
    fluidActions.hydrate(window.location.hash);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) fluidActions.setPaused(true);

    let timer = 0;
    const unsubscribe = subscribeFluid(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.history.replaceState(null, "", `#${encodeFluid(getFluid())}`);
      }, 250);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [role="slider"], [contenteditable="true"]')) return;

      const preset = PRESETS[Number(event.key) - 1];
      if (preset) {
        fluidActions.applyPreset(preset.id);
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
          if (target?.closest("button, a")) return; // Space already activates the focused control.
          event.preventDefault();
          fluidActions.togglePaused();
          break;
        case "r":
          fluidActions.shuffle();
          break;
        case "x":
          fluidActions.clear();
          break;
        case "v":
          fluidActions.cycleView();
          break;
        case "h":
          fluidActions.toggleChrome();
          break;
        case "e":
          void fluidController.exportPng();
          break;
        case "c":
          void fluidController.copyLink();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function FluidStudio() {
  useUrlSync();
  useShortcuts();

  const chrome = useFluid((s) => s.chrome);
  const paused = useFluid((s) => s.paused);
  const accent = useFluid((s) => s.palette[2]);
  const [sheet, setSheet] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
        <main
          className="relative h-dvh w-full overflow-hidden bg-ink select-none"
          style={{ "--accent": accent } as CSSProperties}
        >
          <FluidCanvas />

          <AnimatePresence initial={false}>
            {chrome ? (
              <motion.div
                key="chrome"
                className="pointer-events-none absolute inset-0 flex flex-col p-4 sm:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <header className="flex items-center justify-between gap-3 [&>*]:pointer-events-auto">
                  <StudioNav current="Undertow" />
                  <div className="flex items-center rounded-full p-0.5 glass">
                    <IconButton
                      label="Controls"
                      onClick={() => setSheet((open) => !open)}
                      className="sm:hidden"
                      aria-expanded={sheet}
                    >
                      <SlidersHorizontal />
                    </IconButton>
                    <IconButton
                      label="Copy link"
                      shortcut="C"
                      onClick={() => void fluidController.copyLink()}
                    >
                      <Link2 />
                    </IconButton>
                    <IconButton
                      label="Export PNG"
                      shortcut="E"
                      onClick={() => void fluidController.exportPng()}
                    >
                      <Download />
                    </IconButton>
                  </div>
                </header>

                <div
                  className={`absolute inset-x-3 top-[4.5rem] bottom-3 z-20 sm:inset-x-auto sm:top-[4.75rem] sm:right-6 sm:bottom-[5.5rem] sm:z-auto ${sheet ? "flex" : "hidden"} items-end sm:flex sm:items-start [&>*]:pointer-events-auto`}
                >
                  <FluidPanel onClose={() => setSheet(false)} />
                </div>

                <div className={`mt-auto flex flex-col gap-5 ${sheet ? "max-sm:invisible" : ""}`}>
                  <div className="max-w-[26rem] [text-shadow:0_1px_18px_rgb(0_0_0/0.7)]">
                    <p className="flex items-center gap-3 label-caps text-paper/70">
                      Navier–Stokes
                      <span aria-hidden className="h-px w-8 bg-paper/40" />
                      Solved on the GPU
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-pretty text-paper/80">
                      Move the pointer to stir, drag to pour dye. The word is a solid wall: the pressure
                      solver routes the flow around every letter.
                    </p>
                    <p className="mt-3 hidden items-center gap-2 text-xs text-paper/50 sm:flex">
                      <Kbd>V</Kbd> field <Kbd>X</Kbd> clear <Kbd>R</Kbd> shuffle <Kbd>Space</Kbd> pause
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-6 [&>*]:pointer-events-auto">
                    <PresetDock />
                    <div className="hidden shrink-0 md:block">
                      <Readout paused={paused} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="reveal"
                className="absolute top-4 right-4 sm:top-6 sm:right-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <div className="rounded-full p-0.5 opacity-50 glass transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100">
                  <IconButton label="Show interface" shortcut="H" onClick={fluidActions.toggleChrome}>
                    <Eye />
                  </IconButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Toaster />
        </main>
      </Tooltip.Provider>
    </MotionConfig>
  );
}
