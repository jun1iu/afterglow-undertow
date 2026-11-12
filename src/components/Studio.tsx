"use client";

import { Command, Download, Eye, Link2, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Tooltip } from "radix-ui";
import { useEffect, useState, type CSSProperties } from "react";
import { MATERIAL_IDS } from "@/lib/gl/materials";
import { runtime } from "@/lib/runtime";
import { actions, encode, getState, subscribe, useStudio } from "@/lib/store";
import { CommandMenu } from "./CommandMenu";
import { ControlPanel } from "./ControlPanel";
import { Dock } from "./Dock";
import { IconButton } from "./IconButton";
import { Readout } from "./Readout";
import { ShaderCanvas } from "./ShaderCanvas";
import { StudioNav } from "./StudioNav";
import { Title } from "./Title";
import { Toaster } from "./Toaster";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Restores a shared look from the URL, then keeps the URL in step with the store. */
function useUrlSync() {
  useEffect(() => {
    actions.hydrate(window.location.hash);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) actions.setPaused(true);

    let timer = 0;
    const unsubscribe = subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.history.replaceState(null, "", `#${encode(getState())}`);
      }, 250);
    });
    const onHashChange = () => actions.hydrate(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
}

function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        runtime.setCommandOpen(true);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;

      // Leave keys alone while a control that uses them has focus.
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest('input, textarea, select, [role="slider"], [role="dialog"], [contenteditable="true"]')
      )
        return;
      const onButton = Boolean(target?.closest("button, a"));

      const digit = Number(event.key);
      const material = Number.isInteger(digit) ? MATERIAL_IDS[digit - 1] : undefined;
      if (material) {
        actions.setMaterial(material);
        return;
      }

      switch (event.key.toLowerCase()) {
        case "arrowright":
          actions.cycleMaterial(1);
          break;
        case "arrowleft":
          actions.cycleMaterial(-1);
          break;
        case " ":
          if (onButton) return; // Space already activates the focused button.
          event.preventDefault();
          actions.togglePaused();
          break;
        case "r":
          actions.shuffle();
          break;
        case "h":
          actions.toggleChrome();
          break;
        case "e":
          void runtime.exportPng();
          break;
        case "c":
          void runtime.copyLink();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export function Studio() {
  useUrlSync();
  useShortcuts();

  const chrome = useStudio((s) => s.chrome);
  const paused = useStudio((s) => s.paused);
  const accent = useStudio((s) => s.palettes[s.material][2]);
  const [sheet, setSheet] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
        <main
          className="relative h-dvh w-full overflow-hidden bg-ink select-none"
          style={{ "--accent": accent } as CSSProperties}
        >
          <ShaderCanvas />

          {/* Scrims keep the type legible over whatever the shader is doing. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 bg-[radial-gradient(90%_75%_at_0%_100%,rgb(0_0_0/0.62),transparent_70%),linear-gradient(to_bottom,rgb(0_0_0/0.45),transparent_20%)] transition-opacity duration-700 ${chrome ? "opacity-100" : "opacity-0"}`}
          />

          <AnimatePresence initial={false}>
            {chrome ? (
              <motion.div
                key="chrome"
                className="pointer-events-none absolute inset-0 flex flex-col p-4 sm:p-6 [&>*]:pointer-events-auto"
                // Opacity only: a `filter` here would become the backdrop root
                // and stop the glass panels from blurring the canvas.
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <header className="flex items-center justify-between gap-3">
                  <StudioNav current="Afterglow" />

                  <div className="flex items-center rounded-full p-0.5 glass">
                    <IconButton
                      label="Controls"
                      onClick={() => setSheet((open) => !open)}
                      className="sm:hidden"
                      aria-expanded={sheet}
                    >
                      <SlidersHorizontal />
                    </IconButton>
                    <IconButton label="Copy link" shortcut="C" onClick={() => void runtime.copyLink()}>
                      <Link2 />
                    </IconButton>
                    <IconButton label="Export PNG" shortcut="E" onClick={() => void runtime.exportPng()}>
                      <Download />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => runtime.setCommandOpen(true)}
                      className="mr-0.5 ml-1 hidden h-8 items-center gap-1.5 rounded-full bg-paper/10 pr-2.5 pl-3 text-[13px] text-paper/85 transition-colors hover:bg-paper/20 hover:text-paper sm:flex"
                    >
                      Commands
                      <span className="flex items-center font-mono text-[11px] text-paper/50">
                        <Command className="size-3" aria-hidden />K
                      </span>
                    </button>
                  </div>
                </header>

                {/* Controls: a docked column on desktop, a sheet on phones. */}
                <div
                  className={`!pointer-events-none absolute inset-x-3 top-[4.5rem] bottom-3 z-20 sm:inset-x-auto sm:top-[4.75rem] sm:right-6 sm:bottom-[5.5rem] sm:z-auto ${sheet ? "flex" : "hidden"} items-end sm:flex sm:items-start [&>*]:pointer-events-auto`}
                >
                  <ControlPanel onClose={() => setSheet(false)} />
                </div>

                <div className={`mt-auto flex flex-col gap-6 sm:gap-8 ${sheet ? "max-sm:invisible" : ""}`}>
                  <Title />
                  <div className="flex items-center justify-between gap-6">
                    <Dock />
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
                  <IconButton label="Show interface" shortcut="H" onClick={actions.toggleChrome}>
                    <Eye />
                  </IconButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Toaster />
          <CommandMenu />
        </main>
      </Tooltip.Provider>
    </MotionConfig>
  );
}
