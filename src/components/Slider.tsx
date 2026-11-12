"use client";

import { Slider as SliderPrimitive } from "radix-ui";

interface SliderProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  initial: number;
  unit?: string;
  onChange: (value: number) => void;
}

function format(value: number, step: number, unit?: string) {
  const decimals = step >= 1 ? 0 : step >= 0.05 ? 2 : step >= 0.005 ? 2 : 3;
  return `${value.toFixed(decimals)}${unit ?? ""}`;
}

/**
 * An instrument-style fader: hairline track, blade thumb. The whole row is
 * the hit target, and double-clicking it snaps back to the default.
 */
export function Slider({ label, hint, value, min, max, step, initial, unit, onChange }: SliderProps) {
  const modified = Math.abs(value - initial) > step / 2;

  return (
    <div className="group/slider" onDoubleClick={() => onChange(initial)} title={hint ? `${hint} · double-click to reset` : undefined}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-paper/75 transition-colors group-hover/slider:text-paper">{label}</span>
        <span
          className={`font-mono text-[11px] tabular-nums transition-colors ${modified ? "text-paper" : "text-paper/45"}`}
        >
          {format(value, step, unit)}
        </span>
      </div>
      <SliderPrimitive.Root
        className="relative flex h-6 w-full touch-none items-center select-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
      >
        <SliderPrimitive.Track className="relative h-px grow bg-paper/20">
          <SliderPrimitive.Range className="absolute -top-px h-[3px] rounded-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          className="block h-4 w-[5px] rounded-full bg-paper shadow-[0_0_0_3px_rgb(9_9_11/0.55)] transition-[height,width] duration-150 ease-out-expo hover:h-5 focus-visible:h-5 focus-visible:outline-offset-4 active:w-[3px]"
        />
      </SliderPrimitive.Root>
    </div>
  );
}
