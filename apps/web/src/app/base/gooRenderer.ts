import { gooFrames, type GooFrame, type GooOptions, type Pose, type Span } from './gooeyMorph';

/** A colour as 0–1 floats, alpha not premultiplied. */
export type Rgba = [number, number, number, number];

export interface GooLook {
  /** Corner radius of a blob at rest (px); anything over half its height makes a capsule. */
  radius: number;
  /** How far apart (px) blobs still melt into each other — the neck's reach. */
  smooth: number;
  /** A 135° gradient filling every blob; without it each blob takes its option's colour. */
  gradient?: [Rgba, Rgba];
  /** A 1px edge along the inside of the shape. */
  outline?: Rgba;
  /**
   * Room (px) kept free above and below the goo at rest: melting blobs swell a little where they
   * meet, and a canvas exactly as tall as the goo would cut that off flat.
   */
  padY?: number;
}

/** What an indicator tells the goo worker about itself. */
export type GooCommand =
  | { type: 'look'; look: GooLook }
  | { type: 'size'; width: number; height: number; dpr: number }
  /** The drop's resting place; a running animation finishes there. */
  | { type: 'place'; span: Span; color?: Rgba }
  | {
      type: 'morph';
      /** Where to start from, unless the drop is still flying — then it's re-aimed mid-air. */
      from: Span;
      to: Span;
      fromColor?: Rgba;
      toColor?: Rgba;
      options: GooOptions;
      duration: number;
      /** performance.timeOrigin + performance.now() when the tap landed (same clock in a worker). */
      startedAt: number;
    };

/** Wall-clock ms, comparable between the page and its workers. */
export const epochNow = () => performance.timeOrigin + performance.now();

/** '#rgb', '#rrggbb' or 'rgb(a)(…)' → Rgba; `alpha` overrides the colour's own. */
export function parseColor(css: string, alpha?: number): Rgba {
  const value = css.trim();
  let rgba: Rgba = [0, 0, 0, 1];
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    rgba = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1) as Rgba;
  } else {
    const fn = /^rgba?\(([^)]+)\)$/i.exec(value);
    if (fn) {
      const [r = 0, g = 0, b = 0, a = 1] = fn[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      rgba = [r / 255, g / 255, b / 255, a];
    }
  }
  if (alpha !== undefined) rgba[3] = alpha;
  return rgba;
}

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Each blob is a rounded rectangle's signed distance field; a smooth minimum melts them together
// (a neck forms wherever two come within u_smooth px of each other), and the result is filled
// with anti-aliased edges — the same "goo" a blur-and-threshold filter gives, but computed per
// pixel on the GPU.
const FRAGMENT = `
precision mediump float;
uniform vec2 u_size;
uniform float u_dpr;
uniform float u_radius;
uniform float u_smooth;
uniform vec4 u_blob[3];
uniform vec4 u_colA[3];
uniform vec4 u_colB[3];
uniform vec4 u_outline;
// How much each blob melts into the ones before it (0 = a plain union).
uniform vec3 u_melt;

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float d = 1e4;
  vec4 col = vec4(0.0);
  float weights = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 b = u_blob[i];
    if (b.z < 0.25 || b.w < 0.25) continue;
    float di = sdRoundBox(p - b.xy, b.zw, u_radius);
    float k = u_smooth * (i == 0 ? u_melt.x : i == 1 ? u_melt.y : u_melt.z);
    d = k > 0.01 ? smin(d, di, k) : min(d, di);
    vec2 local = (p - (b.xy - b.zw)) / (2.0 * b.zw);
    vec4 c = mix(u_colA[i], u_colB[i], clamp((local.x + local.y) * 0.5, 0.0, 1.0));
    float w = 1.0 / pow(1.0 + max(di, 0.0), 2.0);
    col += c * w;
    weights += w;
  }
  if (weights <= 0.0) discard;
  col /= weights;
  float cover = clamp(0.5 - d * u_dpr, 0.0, 1.0);
  float ring = u_outline.a * clamp(0.5 - (abs(d + 0.5) - 0.5) * u_dpr, 0.0, 1.0) * cover;
  float fill = col.a * cover * (1.0 - ring);
  float a = ring + fill;
  gl_FragColor = vec4(u_outline.rgb * ring + col.rgb * fill, a);
}
`;

interface Animation {
  frames: GooFrame[];
  base: number;
  startedAt: number;
  duration: number;
  fromColor?: Rgba;
  toColor?: Rgba;
}

/** Everything the shader needs for one indicator's frame. */
export interface GooFrameData {
  width: number;
  height: number;
  dpr: number;
  look: GooLook;
  blobs: Float32Array;
  colA: Float32Array;
  colB: Float32Array;
  melt: [number, number, number];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  center: lerp(a.center, b.center, t),
  sx: lerp(a.sx, b.sx, t),
  sy: lerp(a.sy, b.sy, t),
});
const lerpColor = (a: Rgba, b: Rgba, t: number) => a.map((v, i) => lerp(v, b[i], t)) as Rgba;
const CLEAR: Rgba = [0, 0, 0, 0];

/**
 * One goo indicator's state — its look, size, resting place and running animation — turned into
 * a frame to paint (see GooPainter). Knows nothing of WebGL.
 */
export class GooScene {
  private look: GooLook = { radius: 12, smooth: 10 };
  private width = 0;
  private height = 0;
  private dpr = 1;
  private rest: Span | null = null;
  private restColor: Rgba = CLEAR;
  private animation: Animation | null = null;
  /** The drop as last painted, for re-aiming it mid-flight. */
  private drop: { span: Span; color: Rgba } | null = null;

  /** How tall the goo is at rest: the canvas less its padding. */
  private get pillHeight() {
    return Math.max(this.height - 2 * (this.look.padY ?? 0), 0);
  }

  get animating() {
    return this.animation !== null;
  }

  handle(command: GooCommand) {
    switch (command.type) {
      case 'look':
        this.look = command.look;
        break;
      case 'size':
        this.width = command.width;
        this.height = command.height;
        this.dpr = command.dpr;
        break;
      case 'place':
        this.rest = command.span;
        if (command.color) this.restColor = command.color;
        break;
      case 'morph': {
        const flying = this.animation && this.drop;
        const from = flying ? this.drop!.span : command.from;
        this.animation = {
          frames: gooFrames(from, command.to, command.to.width, {
            aspect: this.pillHeight ? command.to.width / this.pillHeight : undefined,
            ...command.options,
          }),
          base: command.to.width,
          startedAt: command.startedAt,
          duration: command.duration,
          fromColor: flying ? this.drop!.color : command.fromColor,
          toColor: command.toColor,
        };
        break;
      }
    }
  }

  /** The frame at `now` (epochNow), or null while there's nothing to show yet. */
  frame(now: number): GooFrameData | null {
    const { look } = this;
    if (!this.width || !this.height || !this.rest) return null;
    const blobs = new Float32Array(12);
    const colA = new Float32Array(12);
    const colB = new Float32Array(12);
    const put = (i: number, pose: Pose, base: number, color: Rgba) => {
      // Kept inside the canvas: goo pushed against an end (the slingshot's pull-back, a landing
      // wobble, a stretch next to the edge) squashes against it rather than being cut off.
      const half = (pose.sx * base) / 2;
      const left = Math.max(pose.center - half, 0);
      const right = Math.min(pose.center + half, this.width);
      const hx = Math.max(right - left, 0) / 2;
      const hy = Math.min(pose.sy, 1) * (this.pillHeight / 2);
      blobs.set([(left + right) / 2, this.height / 2, hx, hy], i * 4);
      colA.set(look.gradient ? look.gradient[0] : color, i * 4);
      colB.set(look.gradient ? look.gradient[1] : color, i * 4);
    };

    let melt: [number, number, number] = [1, 1, 1];
    const animation = this.animation;
    if (animation) {
      const t = Math.min(1, Math.max(0, (now - animation.startedAt) / animation.duration));
      const at = t * (animation.frames.length - 1);
      const i = Math.min(Math.floor(at), animation.frames.length - 2);
      const [a, b] = [animation.frames[i], animation.frames[i + 1]];
      const f = at - i;
      const fromColor = animation.fromColor ?? this.restColor;
      const toColor = animation.toColor ?? this.restColor;
      const dropColor = lerpColor(fromColor, toColor, Math.min(1, t / 0.45));
      const drop = lerpPose(a.drop, b.drop, f);
      // The drop first: each later blob melts into what's drawn before it (see u_melt).
      put(0, drop, animation.base, dropColor);
      put(1, lerpPose(a.anchor, b.anchor, f), animation.base, fromColor);
      put(2, lerpPose(a.catcher, b.catcher, f), animation.base, toColor);
      melt = [1, lerp(a.anchorMelt, b.anchorMelt, f), 1];
      const width = drop.sx * animation.base;
      this.drop = { span: { left: drop.center - width / 2, width }, color: dropColor };
      if (t >= 1) {
        this.animation = null;
        this.restColor = toColor;
      }
    } else {
      const { left, width } = this.rest;
      put(0, { center: left + width / 2, sx: 1, sy: 1 }, width, this.restColor);
      this.drop = { span: this.rest, color: this.restColor };
    }
    return { width: this.width, height: this.height, dpr: this.dpr, look, blobs, colA, colB, melt };
  }
}

const UNIFORMS = [
  'u_size',
  'u_dpr',
  'u_radius',
  'u_smooth',
  'u_blob',
  'u_colA',
  'u_colB',
  'u_outline',
  'u_melt',
] as const;

/**
 * Paints goo frames with WebGL, onto an OffscreenCanvas of its own. One painter serves every
 * indicator on the page: browsers allow only a handful of WebGL contexts per page, and with
 * Next.js keeping hidden routes alive there can be more indicators than that (the program editor
 * has two per stage). Each frame comes out as an ImageBitmap for the indicator's own canvas.
 */
export class GooPainter {
  private readonly uniforms: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  private constructor(
    private readonly canvas: OffscreenCanvas,
    private readonly gl: WebGLRenderingContext
  ) {
    const program = gl.createProgram()!;
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    gl.useProgram(program);
    // One triangle covering the whole canvas.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
    ) as GooPainter['uniforms'];
  }

  /** Null where WebGL isn't available. */
  static create(): GooPainter | null {
    const canvas = new OffscreenCanvas(1, 1);
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: true,
      antialias: false,
    }) as WebGLRenderingContext | null;
    return gl ? new GooPainter(canvas, gl) : null;
  }

  paint(frame: GooFrameData): ImageBitmap {
    const { gl, canvas } = this;
    const u = this.uniforms;
    canvas.width = Math.max(1, Math.round(frame.width * frame.dpr));
    canvas.height = Math.max(1, Math.round(frame.height * frame.dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.u_size, frame.width, frame.height);
    gl.uniform1f(u.u_dpr, frame.dpr);
    gl.uniform1f(u.u_radius, frame.look.radius);
    gl.uniform1f(u.u_smooth, frame.look.smooth);
    gl.uniform4fv(u.u_blob, frame.blobs);
    gl.uniform4fv(u.u_colA, frame.colA);
    gl.uniform4fv(u.u_colB, frame.colB);
    gl.uniform4fv(u.u_outline, frame.look.outline ?? CLEAR);
    gl.uniform3fv(u.u_melt, frame.melt);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return canvas.transferToImageBitmap();
  }
}
