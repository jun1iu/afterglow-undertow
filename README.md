# Afterglow

A WebGL material studio: five hand-written GLSL materials you can tune, recolour, export and share by URL.

Built with **Next.js 16** (App Router), **React 19**, **TypeScript** (strict), **Tailwind CSS v4**, **Radix UI**, **Motion**, **cmdk** and **raw WebGL2** — no 3D library.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint && npm run typecheck
```

## The materials

| # | Name | Technique |
|---|---------|-----------|
| 1 | Silk    | Three-level domain-warped fBm with a pleat-crest specular |
| 2 | Mercury | Raymarched smooth-union metaballs with thin-film fresnel |
| 3 | Offset  | Two halftone screens 30° apart, deliberately out of register |
| 4 | Strata  | Terraced height field with derivative-antialiased isolines |
| 5 | Tide    | Two layers of Worley cell borders with per-channel dispersion |

Every material reacts to the pointer, and a click sends a pulse through it.

## Things worth looking at

- **Perceptual colour, end to end.** Palettes are converted to OKLab on the CPU and interpolated in OKLab on the GPU, so ramps never go muddy. The panel's preview strip uses `linear-gradient(in oklab, …)`, so it matches the shader. Shuffle generates palettes in OKLCH with gamut mapping.
- **A reveal that starts where you click.** Switching material draws the old shader, then alpha-blends the new one through an expanding, noise-edged mask centred on the click (`src/lib/gl/prelude.ts`).
- **React stays out of the frame loop.** State lives in a small external store (`src/lib/store.ts`). Components read it through `useSyncExternalStore`; the renderer subscribes directly, so dragging a slider repaints the canvas without re-rendering the tree.
- **Draw on demand, adaptive resolution.** A paused, untouched canvas draws nothing. While animating, the renderer lowers internal resolution when frames run long and recovers after a cool-down; the readout shows the current scale.
- **Shareable state.** The current look is serialised into the URL fragment and validated on the way back in.
- **Keyboard first.** `1`–`5` materials · `←` `→` cycle · `Space` pause · `R` shuffle · `E` export PNG · `C` copy link · `H` hide interface · `⌘K` command menu.
- **Accessible.** Radix sliders, labelled controls, visible focus, `prefers-reduced-motion` (starts paused, instant transitions), and a CSS-gradient fallback when WebGL2 is unavailable.

## Layout

```
src/
  app/                 layout, page, global CSS (Tailwind theme tokens)
  components/          Studio shell, control panel, dock, command menu, …
  lib/
    color.ts           sRGB ↔ OKLab/OKLCH, palette generation
    store.ts           state, actions, URL encode/decode
    runtime.ts         renderer handle, stats, toasts, export/share
    gl/
      prelude.ts       shared GLSL: noise, palette ramp, output stage
      renderer.ts      WebGL2 context, frame loop, transitions, capture
      materials/       one fragment shader per material + registry
```

To add a material, write a `vec3 scene(vec2 uv, vec2 p)` function, then register it with four parameters and a palette in `materials/index.ts`. The UI, URL state and command menu pick it up from the registry.
