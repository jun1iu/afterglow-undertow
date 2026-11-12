"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { MATERIALS } from "@/lib/gl/materials";
import { actions, useStudio } from "@/lib/store";
import { IconButton } from "./IconButton";
import { PaletteEditor } from "./PaletteEditor";
import { Panel, Section, SectionAction } from "./Panel";
import { Slider } from "./Slider";

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
  const palette = useStudio((s) => s.palettes[s.material]);
  const def = MATERIALS[material];

  return (
    <Panel
      label="Material controls"
      title={def.name}
      caption={def.technique}
      onClose={onClose}
      actions={
        <IconButton label="Reset material" onClick={actions.resetMaterial}>
          <RotateCcw />
        </IconButton>
      }
    >
      <Parameters />
      <PaletteEditor palette={palette} onColorChange={actions.setColor} onShuffle={actions.shuffle} />
      <Motion />
    </Panel>
  );
}
