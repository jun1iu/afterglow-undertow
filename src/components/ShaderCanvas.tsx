"use client";

import { useEffect, useRef } from "react";
import { Renderer } from "@/lib/gl/renderer";
import { runtime, useSupport } from "@/lib/runtime";
import { useStudio } from "@/lib/store";

export function ShaderCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const support = useSupport();
  const palette = useStudio((s) => s.palettes[s.material]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer(canvas, runtime.reportStats);
    } catch {
      // No WebGL2: fall through to the CSS gradient below.
    }
    runtime.attach(renderer);
    return () => {
      runtime.detach();
      renderer?.destroy();
    };
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        role="img"
        aria-label="Live generative WebGL artwork. Move the pointer to disturb it; click to send a pulse."
        className="absolute inset-0 size-full touch-none"
      />
      {support === "unsupported" && (
        <div
          className="absolute inset-0 grid place-items-center p-8 text-center"
          style={{
            background: `radial-gradient(120% 90% at 30% 20% in oklab, ${palette[2]}, ${palette[1]} 45%, ${palette[0]} 100%)`,
          }}
        >
          <p className="max-w-sm rounded-2xl px-5 py-4 text-sm text-paper/80 glass">
            This browser doesn&rsquo;t expose WebGL2, so you&rsquo;re seeing a static gradient of the palette
            instead of the live shader.
          </p>
        </div>
      )}
    </>
  );
}
