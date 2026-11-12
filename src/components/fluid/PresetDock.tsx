"use client";

import { motion } from "motion/react";
import { PRESETS, fluidActions, useFluid } from "@/lib/fluid/store";

export function PresetDock() {
  const active = useFluid((s) => s.preset);

  return (
    <nav
      aria-label="Presets"
      className="scrollbar-none flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1 glass"
    >
      {PRESETS.map((preset, i) => {
        const selected = preset.id === active;
        return (
          <button
            key={preset.id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => fluidActions.applyPreset(preset.id)}
            className={`relative flex h-9 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-2.5 text-[13px] transition-colors duration-200 ${
              selected ? "text-ink" : "text-paper/65 hover:text-paper"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="preset-pill"
                className="absolute inset-0 rounded-full bg-paper"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span
              aria-hidden
              className="relative size-4 rounded-full ring-1 ring-black/20"
              style={{
                background: `conic-gradient(in oklab, ${preset.palette[1]}, ${preset.palette[2]}, ${preset.palette[3]}, ${preset.palette[1]})`,
              }}
            />
            <span className="relative font-medium">{preset.name}</span>
            <span className={`relative font-mono text-[10px] ${selected ? "text-ink/50" : "text-paper/35"}`}>
              {i + 1}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
