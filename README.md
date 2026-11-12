# Afterglow & Undertow

Two WebGL studios in one Next.js app:

- **Afterglow** (`/`) — five hand-written GLSL materials you can tune, recolour, export and share by URL.
- **Undertow** (`/fluid`) — a real-time fluid simulation solved on the GPU, where a word you type is a solid obstacle the fluid flows around.

Built with **Next.js 16** (App Router), **React 19**, **TypeScript** (strict), **Tailwind CSS v4**, **Radix UI**, **Motion**, **cmdk** and **raw WebGL2** — no 3D library.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint && npm run typecheck
npm run format     # Prettier, with Tailwind class sorting
```

## Afterglow: the materials

| #   | Name    | Technique                                                     |
| --- | ------- | ------------------------------------------------------------- |
| 1   | Silk    | Three-level domain-warped fBm with a pleat-crest specular     |
| 2   | Mercury | Raymarched smooth-union metaballs with thin-film fresnel      |
| 3   | Offset  | Two halftone screens 30° apart, deliberately out of register  |
| 4   | Strata  | Terraced height field with derivative-antialiased isolines    |
| 5   | Tide    | Two layers of Worley cell borders with per-channel dispersion |

Every material reacts to the pointer, and a click sends a pulse through it.

## Things worth looking at

- **Perceptual colour, end to end.** Palettes are converted to OKLab on the CPU and interpolated in OKLab on the GPU, so ramps never go muddy. The panel's preview strip uses `linear-gradient(in oklab, …)`, so it matches the shader. Shuffle generates palettes in OKLCH with gamut mapping.
- **A reveal that starts where you click.** Switching material draws the old shader, then alpha-blends the new one through an expanding, noise-edged mask centred on the click (`src/lib/gl/prelude.ts`).
- **React stays out of the frame loop.** State lives in a small external store (`src/lib/store.ts`). Components read it through `useSyncExternalStore`; the renderer subscribes directly, so dragging a slider repaints the canvas without re-rendering the tree.
- **Draw on demand, adaptive resolution.** A paused, untouched canvas draws nothing. While animating, the renderer lowers internal resolution when frames run long and recovers after a cool-down; the readout shows the current scale.
- **Shareable state.** The current look is serialised into the URL fragment and validated on the way back in.
- **Keyboard first.** `1`–`5` materials · `←` `→` cycle · `Space` pause · `R` shuffle · `E` export PNG · `C` copy link · `H` hide interface · `⌘K` command menu.
- **Accessible.** Radix sliders, labelled controls, visible focus, `prefers-reduced-motion` (starts paused, instant transitions), and a CSS-gradient fallback when WebGL2 is unavailable.

## Undertow: the fluid solver

A 2D incompressible Navier–Stokes solver ("stable fluids") running entirely in fragment shaders on half-float textures. Each frame runs, in order:

| Pass | What it does |
|------|--------------|
| Splat | Adds force and dye from the pointer and from two built-in jets |
| Curl → vorticity | Vorticity confinement, restoring swirl lost to numerical diffusion |
| Divergence | Measures how much the field compresses, with no-slip walls |
| Pressure | Jacobi iterations of the Poisson equation, warm-started from the last frame |
| Gradient subtract | Projects velocity onto its divergence-free part |
| Advect | Semi-Lagrangian transport of velocity, then dye |
| Bloom → display | Threshold, blur chain, relief lighting, tone curve, grain |

- **Typography as a boundary condition.** The obstacle word is rasterised with Canvas 2D into a mask texture. The divergence, pressure and gradient passes treat masked cells as solid walls, so the flow routes around each letter.
- **Three views of the same field.** Dye, velocity and pressure (`V` cycles them).
- **Resilient.** Fields are resampled, not wiped, on resize; dye and display resolution adapt to frame rate while the solver grid stays fixed; there is a fallback when float render targets are unavailable.
- **Shortcuts.** `1`–`4` presets · `V` field · `X` clear · `R` shuffle · `Space` pause · `E` export · `C` copy link · `H` hide interface.

The solver lives in `src/lib/fluid/` (`shaders.ts`, `sim.ts`, `store.ts`); its UI is in `src/components/fluid/`.

## Design file

The UI is mirrored in Figma: [Afterglow — WebGL material studio](https://www.figma.com/design/vdRPIQwuptIbVveMQIrjzn).

- **Variables**: `color/*`, a `palette/<material>/<stop>` set for all five materials, radii and spacing — the same values as `src/app/globals.css` and `src/lib/gl/materials/index.ts`.
- **Text styles**: Instrument Serif (display), Geist (UI) and Geist Mono (labels and readouts).
- **Components**: Slider, Swatch, Dock Item (selected / default), Icon Button and the icon set, each named after its React counterpart.
- **Screen**: the 1440 desktop studio, built from instances with editable layers. The shader backdrop is a stand-in made of blurred shapes; the real thing only exists at runtime.

## Layout

```
src/
  app/                 layout, page, global CSS (Tailwind theme tokens)
  app/fluid/           the Undertow route
  components/          Studio shell, control panel, dock, command menu, …
  components/fluid/    Undertow shell, panel and preset dock
  lib/
    color.ts           sRGB ↔ OKLab/OKLCH, palette generation
    store.ts           state, actions, URL encode/decode
    runtime.ts         renderer handle, stats, toasts, export/share
    create-store.ts    the tiny external store both studios use
    fluid/             fluid solver: shaders, simulation loop, state
    gl/
      prelude.ts       shared GLSL: noise, palette ramp, output stage
      renderer.ts      WebGL2 context, frame loop, transitions, capture
      materials/       one fragment shader per material + registry
```

To add a material, write a `vec3 scene(vec2 uv, vec2 p)` function, then register it with four parameters and a palette in `materials/index.ts`. The UI, URL state and command menu pick it up from the registry.
