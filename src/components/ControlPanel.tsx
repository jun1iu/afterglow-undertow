"use client";

import { Pause, Play, RotateCcw, Shuffle, X } from "lucide-react";
import { MATERIALS } from "@/lib/gl/materials";
import { actions, useStudio } from "@/lib/store";
import { IconButton } from "./IconButton";
import { Slider } from "./Slider";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-paper/10 px-4 pt-3.5 pb-4 first:border-t-0">
      <header className="mb-3 flex h-6 items-center justify-between">
        <h2 className="label-caps text-paper/45">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function SectionAction({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="-mr-1.5 flex h-6 items-center gap-1.5 rounded-full px-2 text-xs text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper [&_svg]:size-3"
      {...props}
    >
      {children}
    </button>
  );
}

function Parameters() {
  const material = useStudio((s) => s.material);
  const values = useStudio((s) => s.params[s.material]);
  const def = MATERIALS[material];

  return (
    <Section title="Parameters">
      <div className="space-y-2.5">
        {def.params.map((param, i) => (
          <Slider
            key={`${material}-${param.label}`}
            {...param}
            value={values[i] ?? param.initial}
            onChange={(value) => actions.setParam(i, value)}
          />
        ))}
      </div>
    </Section>
  );
}

const STOP_NAMES = ["Shadow", "Body", "Light", "Highlight"] as const;

function PaletteEditor() {
  const palette = useStudio((s) => s.palettes[s.material]);

  return (
    <Section
      title="Palette"
      action={
        <SectionAction onClick={actions.shuffle}>
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
              onChange={(event) => actions.setColor(i, event.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span className="mt-1.5 block text-center font-mono text-[10px] text-paper/45 uppercase transition-colors group-hover/swatch:text-paper/80">
              {hex.slice(1)}
            </span>
          </label>
        ))}
      </div>
      {/* The same OKLab interpolation the shader uses, so this strip is a true preview. */}
      <div
        aria-hidden
        className="mt-3 h-1.5 rounded-full"
        style={{ background: `linear-gradient(to right in oklab, ${palette.join(", ")})` }}
      />
    </Section>
  );
}

function Motion() {
  const tempo = useStudio((s) => s.tempo);
  const grain = useStudio((s) => s.grain);
  const paused = useStudio((s) => s.paused);

  return (
    <Section
      title="Motion & finish"
      action={
        <SectionAction onClick={actions.togglePaused} aria-pressed={paused}>
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {paused ? "Play" : "Pause"}
        </SectionAction>
      }
    >
      <div className="space-y-2.5">
        <Slider
          label="Tempo"
          hint="Animation speed"
          value={tempo}
          min={0}
          max={3}
          step={0.05}
          initial={1}
          unit="×"
          onChange={actions.setTempo}
        />
        <Slider
          label="Grain"
          hint="Film grain; also dithers away banding"
          value={grain}
          min={0}
          max={1}
          step={0.01}
          initial={0.25}
          onChange={actions.setGrain}
        />
      </div>
    </Section>
  );
}

export function ControlPanel({ onClose }: { onClose: () => void }) {
  const material = useStudio((s) => s.material);
  const def = MATERIALS[material];

  return (
    <aside
      aria-label="Material controls"
      className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl glass sm:w-[19rem]"
    >
      <header className="flex items-center justify-between py-2 pr-2 pl-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 animate-breathe rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
          />
          <span className="truncate text-sm font-medium">{def.name}</span>
          <span className="truncate label-caps text-paper/40">{def.technique}</span>
        </div>
        <div className="flex shrink-0">
          <IconButton label="Reset material" onClick={actions.resetMaterial}>
            <RotateCcw />
          </IconButton>
          <IconButton label="Close controls" onClick={onClose} className="sm:hidden">
            <X />
          </IconButton>
        </div>
      </header>
      <div className="scrollbar-none overflow-y-auto border-t border-paper/10">
        <Parameters />
        <PaletteEditor />
        <Motion />
      </div>
    </aside>
  );
}
