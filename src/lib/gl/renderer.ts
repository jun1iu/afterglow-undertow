import { hexToOklab } from "../color";
import { getState, subscribe, type StudioState } from "../store";
import { MATERIAL_IDS, MATERIALS, type MaterialId, type Palette } from "./materials";
import { PRELUDE, VERTEX } from "./prelude";

export interface RenderStats {
  readonly fps: number;
  readonly width: number;
  readonly height: number;
  /** Internal resolution multiplier chosen by the adaptive scaler. */
  readonly scale: number;
}

interface Program {
  readonly handle: WebGLProgram;
  readonly uniforms: Record<UniformName, WebGLUniformLocation | null>;
}

interface Transition {
  readonly from: MaterialId;
  readonly to: MaterialId;
  /** Buffer-space origin, as fractions so it survives a resize. */
  readonly ox: number;
  readonly oy: number;
  /** Set on the first frame both programs are ready, so compiles don't eat the animation. */
  start: number | null;
}

const UNIFORMS = ["u_res", "u_time", "u_pointer", "u_pulse", "u_seed", "u_grain", "u_pal", "u_p", "u_wipe"] as const;
type UniformName = (typeof UNIFORMS)[number];

const MAX_DPR = 2;
const MIN_SCALE = 0.4;
const REVEAL_MS = 1100;
const NO_WIPE = 1e9;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Owns the WebGL2 context and the frame loop. It reads studio state straight
 * from the store (never through React) and only draws when something changed:
 * a paused, untouched canvas costs nothing.
 */
export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly programs = new Map<MaterialId, Program | null>();
  private readonly paletteCache = new WeakMap<Palette, Float32Array>();
  private readonly cleanup: Array<() => void> = [];
  private readonly reducedMotion: MediaQueryList;

  private state: StudioState = getState();
  private transition: Transition | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private dirty = true;
  private lost = false;

  // Pointer, in 0..1 with a bottom-left origin to match gl_FragCoord.
  private pointerTarget: [number, number] = [0.5, 0.5];
  private pointer: [number, number] = [0.5, 0.5];
  private pulse = 0;

  // Adaptive resolution.
  private cssWidth = 1;
  private cssHeight = 1;
  private scale = 1;
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
    this.gl = gl;
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      this.cssWidth = entry.contentRect.width;
      this.cssHeight = entry.contentRect.height;
      this.resize();
    });
    observer.observe(canvas);
    this.cleanup.push(() => observer.disconnect());

    this.listen(window, "pointermove", this.onPointerMove);
    this.listen(canvas, "pointerdown", this.onPointerDown);
    this.listen(canvas, "webglcontextlost", this.onContextLost);
    this.listen(canvas, "webglcontextrestored", this.onContextRestored);
    this.cleanup.push(subscribe(this.onState));

    this.raf = requestAnimationFrame(this.frame);
    this.warm();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanup) fn();
    for (const program of this.programs.values()) {
      if (program) this.gl.deleteProgram(program.handle);
    }
    this.programs.clear();
  }

  /** Renders one frame at up to `maxEdge` px on the long side and returns it as a PNG. */
  capture(maxEdge = 3840): Promise<Blob | null> {
    const { canvas } = this;
    const prev: [number, number] = [canvas.width, canvas.height];
    const k = Math.min(maxEdge / Math.max(this.cssWidth, this.cssHeight), 3);
    canvas.width = Math.round(this.cssWidth * k);
    canvas.height = Math.round(this.cssHeight * k);
    this.transition = null;
    this.draw();
    // toBlob snapshots the drawing buffer synchronously, so restoring the
    // size straight afterwards is safe.
    const result = new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    [canvas.width, canvas.height] = prev;
    this.dirty = true;
    return result;
  }

  /* ---------------------------------------------------------------- events */

  private listen<T extends Event>(target: EventTarget, type: string, handler: (event: T) => void) {
    target.addEventListener(type, handler as EventListener, { passive: true });
    this.cleanup.push(() => target.removeEventListener(type, handler as EventListener));
  }

  private onState = () => {
    const next = getState();
    const prev = this.state;
    this.state = next;
    this.dirty = true;

    if (next.material !== prev.material) {
      const rect = this.canvas.getBoundingClientRect();
      const origin = next.origin;
      this.transition = {
        // If a reveal is already running, start from wherever it was heading.
        from: this.transition?.to ?? prev.material,
        to: next.material,
        ox: origin ? (origin.x - rect.left) / Math.max(rect.width, 1) : 0.5,
        oy: origin ? 1 - (origin.y - rect.top) / Math.max(rect.height, 1) : 0.5,
        start: null,
      };
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTarget = [
      (event.clientX - rect.left) / Math.max(rect.width, 1),
      1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
    ];
  };

  private onPointerDown = (event: PointerEvent) => {
    this.onPointerMove(event);
    this.pulse = 1;
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
  };

  private onContextRestored = () => {
    this.programs.clear();
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.lost = false;
    this.dirty = true;
  };

  /* ------------------------------------------------------------- programs */

  /** Compiles the remaining materials during idle time so switching never hitches. */
  private warm() {
    const queue = MATERIAL_IDS.filter((id) => id !== this.state.material);
    const idle: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function"
        ? (cb) => window.requestIdleCallback(cb, { timeout: 2000 })
        : (cb) => window.setTimeout(cb, 300);
    let cancelled = false;
    const next = () => {
      if (cancelled) return;
      const id = queue.shift();
      if (!id) return;
      if (!this.lost) this.program(id);
      idle(next);
    };
    idle(next);
    this.cleanup.push(() => {
      cancelled = true;
    });
  }

  private program(id: MaterialId): Program | null {
    const cached = this.programs.get(id);
    if (cached !== undefined) return cached;

    const { gl } = this;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, PRELUDE + MATERIALS[id].fragment);
    const handle = gl.createProgram();
    let program: Program | null = null;

    if (vs && fs && handle) {
      gl.attachShader(handle, vs);
      gl.attachShader(handle, fs);
      gl.linkProgram(handle);
      if (gl.getProgramParameter(handle, gl.LINK_STATUS)) {
        const uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
        for (const name of UNIFORMS) uniforms[name] = gl.getUniformLocation(handle, name);
        program = { handle, uniforms };
      } else if (!gl.isContextLost()) {
        console.error(
          `[afterglow] "${id}" failed to compile:\n`,
          gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(handle),
        );
      }
    }
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (!program && handle) gl.deleteProgram(handle);

    this.programs.set(id, program);
    return program;
  }

  private palette(palette: Palette): Float32Array {
    let data = this.paletteCache.get(palette);
    if (!data) {
      data = new Float32Array(palette.flatMap((hex) => hexToOklab(hex)));
      this.paletteCache.set(palette, data);
    }
    return data;
  }

  /* ----------------------------------------------------------------- frame */

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(1, Math.round(this.cssWidth * dpr * this.scale));
    const height = Math.max(1, Math.round(this.cssHeight * dpr * this.scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.dirty = true;
  }

  /**
   * Trades resolution for frame rate. Drops quickly when frames run long,
   * and only creeps back up after a cool-down so it can't oscillate.
   */
  private adapt(now: number, dt: number) {
    if (dt > 100) return; // tab was in the background
    this.frameMs += (dt - this.frameMs) * 0.08;
    this.samples++;
    if (this.samples < 40) return;

    if (this.frameMs > 24 && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, this.scale * 0.8);
      this.holdUntil = now + 8000;
    } else if (this.frameMs < 17.5 && this.scale < 1 && now > this.holdUntil && this.samples > 150) {
      this.scale = Math.min(1, this.scale * 1.15);
      this.holdUntil = now + 4000;
    } else {
      return;
    }
    this.samples = 0;
    this.frameMs = 16.7;
    this.resize();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(now - (this.last || now), 250);
    this.last = now;
    if (this.lost) return;

    const animating = !this.state.paused && this.state.tempo > 0;
    if (animating) {
      this.time += (dt / 1000) * this.state.tempo;
      this.adapt(now, dt);
    }

    // Critically-damped pointer follow; frame-rate independent.
    const follow = this.reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 0.006);
    const dx = this.pointerTarget[0] - this.pointer[0];
    const dy = this.pointerTarget[1] - this.pointer[1];
    const moving = Math.abs(dx) + Math.abs(dy) > 0.0005;
    if (moving) {
      this.pointer[0] += dx * follow;
      this.pointer[1] += dy * follow;
    }
    if (this.pulse > 0) {
      this.pulse *= Math.exp(-dt * 0.003);
      if (this.pulse < 0.002) this.pulse = 0;
    }

    if (animating || moving || this.pulse > 0 || this.transition || this.dirty) {
      this.draw(now);
      this.dirty = false;
    }

    if (now - this.lastStats > 500) {
      this.lastStats = now;
      this.onStats({
        fps: animating ? Math.round(1000 / this.frameMs) : 0,
        width: this.canvas.width,
        height: this.canvas.height,
        scale: this.scale,
      });
    }
  };

  private draw(now = performance.now()) {
    const { gl, canvas } = this;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const transition = this.transition;
    if (!transition) {
      gl.disable(gl.BLEND);
      this.paint(this.state.material, 0, 0, NO_WIPE);
      return;
    }

    // Make sure both programs exist before the clock starts.
    this.program(transition.from);
    this.program(transition.to);
    transition.start ??= now;

    const duration = this.reducedMotion.matches ? 0 : REVEAL_MS;
    const t = duration === 0 ? 1 : Math.min((now - transition.start) / duration, 1);
    if (t >= 1) {
      this.transition = null;
      gl.disable(gl.BLEND);
      this.paint(transition.to, 0, 0, NO_WIPE);
      return;
    }

    const unit = Math.min(canvas.width, canvas.height);
    const ox = transition.ox * canvas.width;
    const oy = transition.oy * canvas.height;
    const reach = Math.hypot(Math.max(ox, canvas.width - ox), Math.max(oy, canvas.height - oy));
    // Padding covers the feathered, noise-displaced rim of the mask.
    const radius = easeOutCubic(t) * (reach + unit * 0.26) - unit * 0.02;

    gl.disable(gl.BLEND);
    this.paint(transition.from, 0, 0, NO_WIPE);
    gl.enable(gl.BLEND);
    this.paint(transition.to, ox, oy, radius);
  }

  private paint(id: MaterialId, wipeX: number, wipeY: number, wipeRadius: number) {
    const program = this.program(id);
    if (!program) return;
    const { gl, canvas, state } = this;
    const u = program.uniforms;

    gl.useProgram(program.handle);
    gl.uniform2f(u.u_res, canvas.width, canvas.height);
    gl.uniform1f(u.u_time, this.time);
    gl.uniform2f(u.u_pointer, this.pointer[0], this.pointer[1]);
    gl.uniform1f(u.u_pulse, this.pulse);
    gl.uniform1f(u.u_seed, ((state.seed * 0.6180339887) % 1) * 10);
    gl.uniform1f(u.u_grain, state.grain);
    gl.uniform3fv(u.u_pal, this.palette(state.palettes[id]));
    gl.uniform1fv(u.u_p, state.params[id]);
    gl.uniform3f(u.u_wipe, wipeX, wipeY, wipeRadius);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
