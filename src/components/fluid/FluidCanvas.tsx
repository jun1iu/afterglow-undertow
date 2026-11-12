"use client";

import { useEffect, useRef, useState } from "react";
import { fluidController } from "@/lib/fluid/controller";
import { FluidSim } from "@/lib/fluid/sim";
import { useFluid } from "@/lib/fluid/store";
import { runtime } from "@/lib/runtime";

export function FluidCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = useFluid((s) => s.palette);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let sim: FluidSim | null = null;
    try {
      sim = new FluidSim(canvas, runtime.reportStats);
    } catch (error) {
      console.error(error);
      // No WebGL2 or no float render targets: fall back to a still gradient.
      queueMicrotask(() => setFailed(true));
    }
    fluidController.attach(sim);
    return () => {
      fluidController.attach(null);
      sim?.destroy();
    };
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        role="img"
        aria-label="Live fluid simulation. Move the pointer to stir the fluid; press and drag to inject dye."
        className="absolute inset-0 size-full cursor-crosshair touch-none"
      />
      {failed && (
        <div
          className="absolute inset-0 grid place-items-center p-8 text-center"
          style={{
            background: `radial-gradient(120% 90% at 30% 20% in oklab, ${palette[2]}, ${palette[1]} 45%, ${palette[0]} 100%)`,
          }}
        >
          <p className="max-w-sm rounded-2xl px-5 py-4 text-sm text-paper/80 glass">
            This browser can&rsquo;t render to floating-point textures, which the fluid solver needs, so
            you&rsquo;re seeing a still gradient of the palette instead.
          </p>
        </div>
      )}
    </>
  );
}
