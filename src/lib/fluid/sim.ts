import { hexToLinearRgb, type Vec3 } from "../color";
import type { RenderStats } from "../gl/renderer";
import * as glsl from "./shaders";
import { getFluid, subscribeFluid, VIEWS, type FluidState } from "./store";

interface Program {
  readonly handle: WebGLProgram;
  readonly uniforms: Record<string, WebGLUniformLocation>;
  readonly ints: ReadonlySet<string>;
}

interface Target {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
  readonly texel: readonly [number, number];
}

/** A pair of targets that swap roles each pass: read from one, write to the other. */
interface Double {
  read: Target;
  write: Target;
}

interface Format {
  readonly internal: number;
  readonly format: number;
  readonly filter: number;
}

interface Splat {
  readonly x: number;
  readonly y: number;
  readonly force: readonly [number, number];
  readonly dye: Vec3;
  readonly radius: number;
}

type UniformValue = number | readonly number[] | WebGLTexture;

const SOURCES = {
  copy: glsl.COPY,
  splat: glsl.SPLAT,
  advect: glsl.ADVECT,
  curl: glsl.CURL,
  vorticity: glsl.VORTICITY,
  divergence: glsl.DIVERGENCE,
  pressure: glsl.PRESSURE,
  gradient: glsl.GRADIENT,
  bloomPrefilter: glsl.BLOOM_PREFILTER,
  blur: glsl.BLUR,
  display: glsl.DISPLAY,
} as const;

type ProgramName = keyof typeof SOURCES;

const SIM_RESOLUTION = 176; // grid cells along the short side
const DYE_RESOLUTION = 1024; // dye texels along the short side, at full quality
const MASK_SCALE = 3; // obstacle mask texels per grid cell
const BLOOM_LEVELS = 4;
const MAX_DPR = 2;
const MIN_QUALITY = 0.4;
const WARM_UP_STEPS = 60;
const PANEL_WIDTH = 352; // px the control panel occupies on wide screens
const WORD_FONT = 'italic 400 100px "Instrument Serif"';

/**
 * A 2D incompressible fluid solved entirely on the GPU. Velocity, pressure
 * and dye live in half-float textures; each frame runs the solver passes,
 * then a bloom chain and the display shader. Like the material renderer it
 * reads state straight from its store and never touches React.
 */
export class FluidSim {
  private readonly gl: WebGL2RenderingContext;
  private readonly cleanup: Array<() => void> = [];
  private programs!: Record<ProgramName, Program>;

  private velocity!: Double;
  private dye!: Double;
  private pressure!: Double;
  private divergence!: Target;
  private curl!: Target;
  private bloom: Target[] = [];
  private mask!: WebGLTexture;

  private state: FluidState = getFluid();
  private splats: Splat[] = [];
  private pointer: { x: number; y: number; time: number } | null = null;
  private pointerDown = false;

  private raf = 0;
  private last = 0;
  private time = 0;
  private dirty = true;
  private lost = false;
  private destroyed = false;

  private cssWidth = 0;
  private cssHeight = 0;
  private quality = 1;
  private frameMs = 16.7;
  private samples = 0;
  private holdUntil = 0;
  private lastStats = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onStats: (stats: RenderStats) => void,
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available");
    // Rendering to float textures is an extension even in WebGL2.
    if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) {
      throw new Error("Float render targets are not available");
    }
    this.gl = gl;
    this.compile();

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      this.cssWidth = entry.contentRect.width;
      this.cssHeight = entry.contentRect.height;
      this.allocate();
    });
    observer.observe(canvas);
    this.cleanup.push(() => observer.disconnect());

    this.listen(canvas, "pointermove", this.onPointerMove);
    this.listen(canvas, "pointerdown", this.onPointerDown);
    this.listen(window, "pointerup", this.onPointerUp);
    this.listen(canvas, "pointerleave", this.onPointerLeave);
    this.listen(canvas, "webglcontextlost", this.onContextLost);
    this.listen(canvas, "webglcontextrestored", this.onContextRestored);
    this.cleanup.push(subscribeFluid(this.onState));

    // The obstacle is set in the display face; redraw it once that has loaded.
    void document.fonts?.load(WORD_FONT).then(
      () => this.drawMask(),
      () => undefined,
    );

    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanup) fn();
  }

  /** Renders the current frame and returns it as a PNG. */
  capture(): Promise<Blob | null> {
    this.render();
    // toBlob snapshots the drawing buffer synchronously.
    return new Promise((resolve) => this.canvas.toBlob(resolve, "image/png"));
  }

  /* ---------------------------------------------------------------- events */

  private listen<T extends Event>(target: EventTarget, type: string, handler: (event: T) => void) {
    target.addEventListener(type, handler as EventListener, { passive: true });
    this.cleanup.push(() => target.removeEventListener(type, handler as EventListener));
  }

  private onState = () => {
    const prev = this.state;
    this.state = getFluid();
    this.dirty = true;
    if (this.lost || !this.velocity) return;
    if (this.state.word !== prev.word) this.drawMask();
    if (this.state.resetCount !== prev.resetCount) this.clear();
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
    const now = performance.now();
    const prev = this.pointer;
    this.pointer = { x, y, time: now };
    if (!prev || !this.velocity || this.state.paused) return;

    const dt = Math.max((now - prev.time) / 1000, 1 / 240);
    if (dt > 0.25) return; // the pointer re-entered; don't draw a streak across the canvas

    // Pointer speed, converted to grid cells per second.
    const limit = 900;
    const fx = Math.max(-limit, Math.min(limit, ((x - prev.x) / dt) * this.velocity.read.width * 0.5));
    const fy = Math.max(-limit, Math.min(limit, ((y - prev.y) / dt) * this.velocity.read.height * 0.5));
    const energy = Math.min(Math.hypot(fx, fy) / 300, 1) * (this.pointerDown ? 0.9 : 0.3);
    this.splats.push({
      x,
      y,
      force: [fx, fy],
      dye: scale(this.brushColor(), energy),
      radius: 0.0016 * this.state.values.brush,
    });
  };

  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = true;
    this.pointer = null;
    this.onPointerMove(event);
  };

  private onPointerUp = () => {
    this.pointerDown = false;
  };

  private onPointerLeave = () => {
    this.pointer = null;
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
  };

  private onContextRestored = () => {
    if (this.destroyed) return;
    this.lost = false;
    this.bloom = [];
    this.compile();
    this.allocate(true);
  };

  /* ------------------------------------------------------------- resources */

  private compile() {
    const { gl } = this;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error("Could not create shader");
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const vertex = shader(gl.VERTEX_SHADER, glsl.VERTEX);
    const programs = {} as Record<ProgramName, Program>;

    for (const name of Object.keys(SOURCES) as ProgramName[]) {
      const fragment = shader(gl.FRAGMENT_SHADER, SOURCES[name]);
      const handle = gl.createProgram();
      gl.attachShader(handle, vertex);
      gl.attachShader(handle, fragment);
      gl.linkProgram(handle);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS) && !gl.isContextLost()) {
        const log = gl.getShaderInfoLog(fragment) || gl.getProgramInfoLog(handle);
        throw new Error(`[undertow] "${name}" failed to compile:\n${log}`);
      }
      gl.deleteShader(fragment);

      const uniforms: Record<string, WebGLUniformLocation> = {};
      const ints = new Set<string>();
      const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(handle, i);
        const location = info && gl.getUniformLocation(handle, info.name);
        if (!info || !location) continue;
        uniforms[info.name] = location;
        if (info.type === gl.INT) ints.add(info.name);
      }
      programs[name] = { handle, uniforms, ints };
    }
    gl.deleteShader(vertex);
    this.programs = programs;
  }

  private createTarget(width: number, height: number, { internal, format, filter }: Format): Target {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, gl.HALF_FLOAT, null);

    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, framebuffer, width, height, texel: [1 / width, 1 / height] };
  }

  private deleteTarget(target: Target | undefined) {
    if (!target) return;
    this.gl.deleteTexture(target.texture);
    this.gl.deleteFramebuffer(target.framebuffer);
  }

  /** Creates a ping-pong pair, resampling the previous contents so a resize doesn't wipe the fluid. */
  private createDouble(width: number, height: number, format: Format, previous?: Double): Double {
    const next: Double = {
      read: this.createTarget(width, height, format),
      write: this.createTarget(width, height, format),
    };
    if (previous) {
      this.pass("copy", next.read, { u_source: previous.read.texture, u_scale: 1 });
      this.deleteTarget(previous.read);
      this.deleteTarget(previous.write);
    }
    return next;
  }

  /** (Re)builds every render target for the current canvas size and quality level. */
  private allocate(fresh = false) {
    if (this.lost || this.cssWidth < 1 || this.cssHeight < 1) return;
    const { gl, canvas } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.max(1, Math.round(this.cssWidth * dpr * this.quality));
    canvas.height = Math.max(1, Math.round(this.cssHeight * dpr * this.quality));

    const aspect = this.cssWidth / this.cssHeight;
    const size = (short: number): [number, number] => {
      const long = Math.round(short * Math.max(aspect, 1 / aspect));
      return aspect >= 1 ? [long, short] : [short, long];
    };
    const [simW, simH] = size(SIM_RESOLUTION);
    const dyeShort = Math.round(
      Math.min(DYE_RESOLUTION * this.quality, Math.min(canvas.width, canvas.height)),
    );
    const [dyeW, dyeH] = size(Math.max(dyeShort, 128));

    const vector: Format = { internal: gl.RG16F, format: gl.RG, filter: gl.LINEAR };
    const colour: Format = { internal: gl.RGBA16F, format: gl.RGBA, filter: gl.LINEAR };
    const scalar: Format = { internal: gl.R16F, format: gl.RED, filter: gl.NEAREST };

    const keep = !fresh && Boolean(this.velocity);
    const isFirst = !keep;
    this.velocity = this.createDouble(simW, simH, vector, keep ? this.velocity : undefined);
    this.dye = this.createDouble(dyeW, dyeH, colour, keep ? this.dye : undefined);
    this.pressure = this.createDouble(simW, simH, scalar, keep ? this.pressure : undefined);
    if (keep) {
      this.deleteTarget(this.divergence);
      this.deleteTarget(this.curl);
    }
    this.divergence = this.createTarget(simW, simH, scalar);
    this.curl = this.createTarget(simW, simH, scalar);

    for (const level of this.bloom) this.deleteTarget(level);
    this.bloom = [];
    let [w, h] = [dyeW >> 1, dyeH >> 1];
    for (let i = 0; i < BLOOM_LEVELS && Math.min(w, h) >= 8; i++) {
      this.bloom.push(this.createTarget(w, h, colour));
      [w, h] = [w >> 1, h >> 1];
    }

    this.drawMask();
    // Start with the fluid already in motion rather than an empty tank.
    if (isFirst) for (let i = 0; i < WARM_UP_STEPS; i++) this.step(1 / 60);
    this.dirty = true;
  }

  /**
   * Rasterises the obstacle word with Canvas 2D and uploads it as a mask
   * texture. Text is the hardest shape to describe analytically and the
   * easiest to draw, so the browser does the work.
   */
  private drawMask() {
    if (this.lost || !this.velocity) return;
    const { gl } = this;
    const width = this.velocity.read.width * MASK_SCALE;
    const height = this.velocity.read.height * MASK_SCALE;
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const ctx = surface.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const word = this.state.word.trim();
    if (word) {
      // Centre the word in the space the control panel leaves free.
      const free = this.cssWidth >= 640 ? (this.cssWidth - PANEL_WIDTH) / this.cssWidth : 1;
      const family = '"Instrument Serif", "Iowan Old Style", "Times New Roman", serif';
      ctx.font = `italic 400 100px ${family}`;
      const probe = ctx.measureText(word);
      const fit = Math.min((width * free * 0.78) / Math.max(probe.width, 1), (height * 0.5) / 100);
      ctx.font = `italic 400 ${100 * fit}px ${family}`;
      const metrics = ctx.measureText(word);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(word, (width * free) / 2, height * 0.47 + (ascent - descent) / 2);
    }

    this.mask ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, surface);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.dirty = true;
  }

  private clear() {
    const { gl } = this;
    gl.clearColor(0, 0, 0, 1);
    for (const pair of [this.velocity, this.dye, this.pressure]) {
      for (const target of [pair.read, pair.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  }

  /* ----------------------------------------------------------------- passes */

  /** Runs one fullscreen pass of `name` into `target` (or the canvas when null). */
  private pass(
    name: ProgramName,
    target: Target | null,
    values: Record<string, UniformValue>,
    texel?: readonly [number, number],
  ) {
    const { gl } = this;
    const program = this.programs[name];
    gl.useProgram(program.handle);

    let unit = 0;
    const set = (key: string, value: UniformValue) => {
      const location = program.uniforms[key];
      if (!location) return;
      if (value instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, value);
        gl.uniform1i(location, unit++);
      } else if (typeof value === "number") {
        if (program.ints.has(key)) gl.uniform1i(location, value);
        else gl.uniform1f(location, value);
      } else if (value.length === 2) {
        gl.uniform2f(location, value[0] ?? 0, value[1] ?? 0);
      } else {
        gl.uniform3f(location, value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
      }
    };
    const size = texel ?? target?.texel ?? [1 / this.canvas.width, 1 / this.canvas.height];
    set("u_texel", size);
    for (const key in values) set(key, values[key] as UniformValue);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    gl.viewport(0, 0, target ? target.width : this.canvas.width, target ? target.height : this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Runs a pass that reads and writes the same field, then swaps the pair. */
  private update(name: ProgramName, field: Double, values: Record<string, UniformValue>) {
    this.pass(name, field.write, values);
    [field.read, field.write] = [field.write, field.read];
  }

  private splat({ x, y, force, dye, radius }: Splat) {
    const shared = {
      u_mask: this.mask,
      u_point: [x, y],
      u_radius: radius,
      u_aspect: this.cssWidth / this.cssHeight,
    };
    this.update("splat", this.velocity, {
      ...shared,
      u_target: this.velocity.read.texture,
      u_value: [force[0], force[1], 0],
    });
    this.update("splat", this.dye, { ...shared, u_target: this.dye.read.texture, u_value: dye });
  }

  /* ------------------------------------------------------------- simulation */

  private colors(): [Vec3, Vec3, Vec3, Vec3] {
    const [a, b, c, d] = this.state.palette;
    return [hexToLinearRgb(a), hexToLinearRgb(b), hexToLinearRgb(c), hexToLinearRgb(d)];
  }

  /** The pointer's dye drifts through the three bright palette stops over time. */
  private brushColor(): Vec3 {
    const [, body, light, highlight] = this.colors();
    const phase = (this.time * 0.25) % 3;
    const stops = [body, light, highlight, body] as const;
    const i = Math.floor(phase);
    return mix(stops[i] ?? body, stops[i + 1] ?? body, phase - i);
  }

  /** Two wandering jets keep the tank alive when nobody is stirring it. */
  private jets(dt: number): Splat[] {
    const flow = this.state.values.flow;
    if (flow <= 0) return [];
    const t = this.time;
    const [, body, light] = this.colors();
    const push = this.velocity.read.height * 5 * flow * dt;
    const ink = 13 * dt * Math.min(flow, 1.2);
    return [
      {
        x: 0.03,
        y: 0.5 + 0.24 * Math.sin(t * 0.31),
        force: [push, push * 0.35 * Math.sin(t * 0.73)],
        dye: scale(body, ink),
        radius: 0.0011,
      },
      {
        x: 0.42 + 0.3 * Math.sin(t * 0.23 + 1.3),
        y: 0.03,
        force: [push * 0.4 * Math.cos(t * 0.51), push],
        dye: scale(light, ink),
        radius: 0.0011,
      },
    ];
  }

  private step(dt: number) {
    const { values } = this.state;
    this.time += dt;

    for (const splat of this.jets(dt)) this.splat(splat);
    for (const splat of this.splats) this.splat(splat);
    this.splats = [];

    const { velocity, pressure, dye, mask } = this;

    this.pass("curl", this.curl, { u_velocity: velocity.read.texture });
    this.update("vorticity", velocity, {
      u_velocity: velocity.read.texture,
      u_curl: this.curl.texture,
      u_strength: values.vorticity,
      u_dt: dt,
    });

    this.pass("divergence", this.divergence, { u_velocity: velocity.read.texture, u_mask: mask });
    // Warm-start the solver from a damped copy of last frame's pressure.
    this.update("copy", pressure, { u_source: pressure.read.texture, u_scale: 0.8 });
    for (let i = 0; i < Math.round(values.solver); i++) {
      this.update("pressure", pressure, {
        u_pressure: pressure.read.texture,
        u_divergence: this.divergence.texture,
        u_mask: mask,
      });
    }
    this.update("gradient", velocity, {
      u_pressure: pressure.read.texture,
      u_velocity: velocity.read.texture,
      u_mask: mask,
    });

    const advect = {
      u_velocity: velocity.read.texture,
      u_velTexel: velocity.read.texel,
      u_dt: dt,
      u_mask: mask,
    };
    this.update("advect", velocity, {
      ...advect,
      u_source: velocity.read.texture,
      u_dissipation: values.drag,
    });
    this.update("advect", dye, { ...advect, u_source: dye.read.texture, u_dissipation: values.fade });
  }

  private render() {
    const { gl, state } = this;
    const view = Math.max(0, VIEWS.indexOf(state.view));
    const bloomOn = view === 0 && state.values.bloom > 0 && this.bloom.length > 1;
    const first = this.bloom[0];

    if (bloomOn && first) {
      this.pass("bloomPrefilter", first, { u_source: this.dye.read.texture, u_threshold: 0.55 });
      for (let i = 1; i < this.bloom.length; i++) {
        const source = this.bloom[i - 1] as Target;
        this.pass("blur", this.bloom[i] as Target, { u_source: source.texture }, source.texel);
      }
      // Walk back up the chain, accumulating each blurred level additively.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = this.bloom.length - 2; i >= 0; i--) {
        const source = this.bloom[i + 1] as Target;
        this.pass("blur", this.bloom[i] as Target, { u_source: source.texture }, source.texel);
      }
      gl.disable(gl.BLEND);
    }

    const [shadow, body, , highlight] = this.colors();
    this.pass(
      "display",
      null,
      {
        u_dye: this.dye.read.texture,
        u_bloom: (first ?? this.dye.read).texture,
        u_velocity: this.velocity.read.texture,
        u_pressure: this.pressure.read.texture,
        u_mask: this.mask,
        u_background: scale(shadow, 0.85),
        u_low: body,
        u_high: highlight,
        u_res: [this.canvas.width, this.canvas.height],
        u_bloomAmount: bloomOn ? state.values.bloom : 0,
        u_relief: state.values.relief,
        u_grain: state.grain,
        u_time: this.time,
        u_view: view,
      },
      this.dye.read.texel,
    );
  }

  /* ------------------------------------------------------------------ loop */

  /** Trades dye and display resolution for frame rate; the solver grid stays fixed. */
  private adapt(now: number, dt: number) {
    if (dt > 100) return;
    this.frameMs += (dt - this.frameMs) * 0.08;
    this.samples++;
    if (this.samples < 40) return;

    if (this.frameMs > 24 && this.quality > MIN_QUALITY) {
      this.quality = Math.max(MIN_QUALITY, this.quality * 0.8);
      this.holdUntil = now + 8000;
    } else if (this.frameMs < 17.5 && this.quality < 1 && now > this.holdUntil && this.samples > 150) {
      this.quality = Math.min(1, this.quality * 1.15);
      this.holdUntil = now + 4000;
    } else {
      return;
    }
    this.samples = 0;
    this.frameMs = 16.7;
    this.allocate();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = Math.min(now - (this.last || now), 250);
    this.last = now;
    if (this.lost || !this.velocity) return;

    const running = !this.state.paused;
    if (running) {
      // Clamp the timestep: the solver is stable, but big steps look mushy.
      this.step(Math.min(Math.max(elapsed / 1000, 1 / 240), 1 / 30));
      this.adapt(now, elapsed);
    } else {
      this.splats = [];
    }

    if (running || this.dirty) {
      this.render();
      this.dirty = false;
    }

    if (now - this.lastStats > 500) {
      this.lastStats = now;
      this.onStats({
        fps: running ? Math.round(1000 / this.frameMs) : 0,
        width: this.velocity.read.width,
        height: this.velocity.read.height,
        scale: this.quality,
      });
    }
  };
}

function scale(c: Vec3, k: number): Vec3 {
  return [c[0] * k, c[1] * k, c[2] * k];
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
