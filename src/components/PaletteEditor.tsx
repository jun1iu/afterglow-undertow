"use client";

import { Shuffle } from "lucide-react";
import { Section, SectionAction } from "./Panel";

const STOP_NAMES = ["Shadow", "Body", "Light", "Highlight"] as const;

export function PaletteEditor({
  palette,
  onColorChange,
  onShuffle,
}: {
  palette: readonly string[];
  onColorChange: (index: number, hex: string) => void;
  onShuffle: () => void;
}) {
  return (
    <Section
      title="Palette"
      action={
        <SectionAction onClick={onShuffle}>
          <Shuffle aria-hidden />
          Shuffle
        </SectionAction>
      }
    >
      <div className="grid grid-cols-4 gap-1.5">
        {palette.map((hex, i) => (
          <label key={i} className="group/swatch relative block cursor-pointer">
            <span className="sr-only">{STOP_NAMES[i]} colour</span>
            <span
              className="block h-11 rounded-lg ring-1 ring-paper/15 transition-transform duration-200 ease-out-expo ring-inset group-focus-within/swatch:outline-[1.5px] group-focus-within/swatch:outline-offset-2 group-focus-within/swatch:outline-paper group-hover/swatch:-translate-y-0.5"
              style={{ backgroundColor: hex }}
            />
            <input
              type="color"
              value={hex}
              onChange={(event) => onColorChange(i, event.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span className="mt-1.5 block text-center font-mono text-[10px] text-paper/45 uppercase transition-colors group-hover/swatch:text-paper/80">
              {hex.slice(1)}
            </span>
          </label>
        ))}
      </div>
      {/* The same OKLab interpolation the shaders use, so this strip is a true preview. */}
      <div
        aria-hidden
        className="mt-3 h-1.5 rounded-full"
        style={{ background: `linear-gradient(to right in oklab, ${palette.join(", ")})` }}
      />
    </Section>
  );
}
