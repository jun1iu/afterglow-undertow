"use client";

import { Eraser, Pause, Play } from "lucide-react";
import {
  CONTROLS,
  MAX_WORD_LENGTH,
  PRESETS,
  VIEWS,
  fluidActions,
  useFluid,
  type ControlId,
} from "@/lib/fluid/store";
import { IconButton } from "../IconButton";
import { PaletteEditor } from "../PaletteEditor";
import { Panel, Section, SectionAction } from "../Panel";
import { Slider } from "../Slider";

function Controls({ ids }: { ids: readonly ControlId[] }) {
  const values = useFluid((s) => s.values);
  return (
    <div className="space-y-2.5">
      {ids.map((id) => (
        <Slider
          key={id}
          {...CONTROLS[id]}
          value={values[id]}
          onChange={(value) => fluidActions.setValue(id, value)}
        />
      ))}
    </div>
  );
}

function Obstacle() {
  const word = useFluid((s) => s.word);
  return (
    <Section title="Obstacle">
      <label className="block">
        <span className="sr-only">Word the fluid flows around</span>
        <input
          type="text"
          value={word}
          maxLength={MAX_WORD_LENGTH}
          spellCheck={false}
          autoComplete="off"
          placeholder="Open water"
          onChange={(event) => fluidActions.setWord(event.target.value)}
          className="h-10 w-full rounded-lg border border-paper/15 bg-paper/5 px-3 font-display text-xl text-paper italic outline-none select-text placeholder:text-paper/30 focus-visible:border-paper/60"
        />
      </label>
      <p className="mt-2 text-xs leading-relaxed text-paper/45">
        Rasterised into a mask and enforced as a solid boundary in the pressure solve.
      </p>
    </Section>
  );
}

const VIEW_LABELS = { dye: "Dye", velocity: "Velocity", pressure: "Pressure" } as const;

function ViewSwitch() {
  const view = useFluid((s) => s.view);
  return (
    <Section title="Field">
      <div
        role="radiogroup"
        aria-label="Field to display"
        className="grid grid-cols-3 gap-1 rounded-lg bg-paper/5 p-1"
      >
        {VIEWS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={view === option}
            onClick={() => fluidActions.setView(option)}
            className={`h-7 rounded-md text-xs transition-colors ${
              view === option ? "bg-paper text-ink" : "text-paper/60 hover:text-paper"
            }`}
          >
            {VIEW_LABELS[option]}
          </button>
        ))}
      </div>
    </Section>
  );
}

export function FluidPanel({ onClose }: { onClose: () => void }) {
  const preset = useFluid((s) => s.preset);
  const palette = useFluid((s) => s.palette);
  const paused = useFluid((s) => s.paused);
  const name = PRESETS.find((p) => p.id === preset)?.name ?? "Custom";

  return (
    <Panel
      label="Fluid controls"
      title={name}
      caption="Stable fluids"
      onClose={onClose}
      actions={
        <IconButton label="Clear the tank" shortcut="X" onClick={fluidActions.clear}>
          <Eraser />
        </IconButton>
      }
    >
      <Section
        title="Dynamics"
        action={
          <SectionAction onClick={fluidActions.togglePaused} aria-pressed={paused}>
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {paused ? "Play" : "Pause"}
          </SectionAction>
        }
      >
        <Controls ids={["vorticity", "drag", "fade", "flow", "solver"]} />
      </Section>
      <Obstacle />
      <PaletteEditor
        palette={palette}
        onColorChange={fluidActions.setColor}
        onShuffle={fluidActions.shuffle}
      />
      <Section title="Look">
        <Controls ids={["brush", "bloom", "relief"]} />
      </Section>
      <ViewSwitch />
    </Panel>
  );
}
