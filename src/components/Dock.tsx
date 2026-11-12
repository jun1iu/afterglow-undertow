"use client";

import { motion } from "motion/react";
import type { MouseEvent } from "react";
import { MATERIAL_LIST, type MaterialId } from "@/lib/gl/materials";
import { actions, useStudio } from "@/lib/store";

/** The material switcher. The reveal on the canvas grows from wherever you clicked. */
export function Dock() {
  const active = useStudio((s) => s.material);

  const select = (id: MaterialId) => (event: MouseEvent<HTMLButtonElement>) => {
    // Keyboard-initiated clicks report (0, 0); use the button's centre instead.
    const rect = event.currentTarget.getBoundingClientRect();
    const fromPointer = event.detail > 0;
    actions.setMaterial(id, {
      x: fromPointer ? event.clientX : rect.left + rect.width / 2,
      y: fromPointer ? event.clientY : rect.top + rect.height / 2,
    });
  };

  return (
    <nav aria-label="Materials" className="glass scrollbar-none flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1">
      {MATERIAL_LIST.map((material, i) => {
        const selected = material.id === active;
        return (
          <button
            key={material.id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={select(material.id)}
            className={`relative flex h-9 shrink-0 items-baseline gap-2 rounded-full px-3.5 text-[13px] leading-9 transition-colors duration-200 ${
              selected ? "text-ink" : "text-paper/65 hover:text-paper"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="dock-pill"
                className="absolute inset-0 rounded-full bg-paper"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span className={`relative font-mono text-[10px] tabular-nums ${selected ? "text-ink/50" : "text-paper/35"}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="relative font-medium">{material.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
