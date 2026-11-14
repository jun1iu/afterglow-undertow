# Afterglow & Undertow

Two interactive art pieces that run in your web browser. Nothing is a video or a picture: everything you see is drawn live by your computer's graphics chip, and it responds to you as you move, click and type.

- **Afterglow** is a set of five moving, colourful surfaces you can restyle and save.
- **Undertow** is a pool of digital ink that swirls like real liquid and flows around a word you type.

## Afterglow

Afterglow shows one animated surface at a time, filling the whole screen. There are five to choose from:

| #   | Name    | What it looks like                                          |
| --- | ------- | ----------------------------------------------------------- |
| 1   | Silk    | Soft folds of fabric slowly shifting, with light on the creases |
| 2   | Mercury | Blobs of liquid metal that merge and split, with an oily sheen  |
| 3   | Offset  | Printed dots, like a newspaper photo that is slightly misprinted |
| 4   | Strata  | Stacked layers with contour lines, like a map of hills      |
| 5   | Tide    | A shimmering net of light, like sun on the floor of a pool  |

What you can do:

- **Move your mouse** and the surface reacts. **Click** and a ripple travels through it.
- **Adjust it** with sliders: each surface has four settings that change how it moves and looks.
- **Change the colours** by picking a palette, or shuffle for a random one.
- **Save a picture** of what is on screen.
- **Share it.** Copy a link, and whoever opens it sees exactly the look you made.

When you switch from one surface to another, the new one spreads out from the spot where you clicked.

## Undertow

Undertow is a simulation of liquid. Coloured ink is pushed around the screen, and it curls, mixes and fades the way smoke or dye in water would.

- **Drag your mouse** to stir the ink.
- **Type a word** and it becomes a solid object in the pool. The ink cannot pass through the letters, so it streams around them.
- **Switch views** to see the ink itself, how fast the liquid is moving, or where it is being squeezed.
- **Pick a preset** for a different starting style, and save or share the result just like in Afterglow.

## Keyboard shortcuts

You can do everything with the mouse, but the keyboard is faster.

| Key            | Afterglow                 | Undertow              |
| -------------- | ------------------------- | --------------------- |
| `1`–`5`        | Choose a surface          | Choose a preset (`1`–`4`) |
| `←` `→`        | Previous / next surface   | —                     |
| `Space`        | Pause or resume           | Pause or resume       |
| `R`            | Shuffle colours           | Shuffle colours       |
| `E`            | Save a picture            | Save a picture        |
| `C`            | Copy a link to share      | Copy a link to share  |
| `H`            | Hide or show the controls | Hide or show the controls |
| `V`            | —                         | Switch view           |
| `X`            | —                         | Clear the ink         |
| `⌘K` / `Ctrl K` | Open a searchable menu    | —                     |

## Built with care

- **Colours stay clean.** Blends between colours are worked out the way the human eye sees them, so they never turn grey or muddy in the middle.
- **It adapts to your device.** If your computer is struggling, the picture quietly becomes a little less sharp to keep the motion smooth, then sharpens again when it can.
- **It does not waste battery.** When paused and untouched, it stops drawing.
- **It works for more people.** Everything can be reached by keyboard and is labelled for screen readers. If you have asked your device to reduce motion, it starts paused. On older devices that cannot run it, you still get a still, coloured background.
- **It works on phones** as well as desktops.

## The design

The design is written up as a case study in Figma: [Afterglow & Undertow](https://www.figma.com/design/vdRPIQwuptIbVveMQIrjzn). It covers the idea behind the project, the colours, lettering and buttons, every screen on desktop and phone, and notes on how it moves and behaves.

## Running it yourself

This part needs a little technical setup. You need [Node.js](https://nodejs.org) installed. Then, in a terminal opened in this folder:

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000> in your browser. Afterglow is the home page, and Undertow is at <http://localhost:3000/fluid>.

## For developers

Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS v4, Radix UI, Motion, cmdk and raw WebGL2, with no 3D library.

```bash
npm run build      # production build
npm run lint && npm run typecheck
npm run format     # Prettier, with Tailwind class sorting
```

```
src/
  app/                 layout, page, global CSS (Tailwind theme tokens)
  app/fluid/           the Undertow route
  components/          Studio shell, control panel, dock, command menu
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

- **Afterglow** materials are hand-written GLSL fragment shaders. To add one, write a `vec3 scene(vec2 uv, vec2 p)` function and register it with four parameters and a palette in `materials/index.ts`; the UI, URL state and command menu pick it up from the registry.
- **Undertow** is a 2D "stable fluids" Navier–Stokes solver in fragment shaders on half-float textures: splat, vorticity confinement, divergence, Jacobi pressure, gradient subtract, semi-Lagrangian advection, then bloom and display. The typed word is rasterised to a mask texture and treated as solid walls.
- State lives in an external store read through `useSyncExternalStore`; the renderer subscribes directly, so React stays out of the frame loop.
