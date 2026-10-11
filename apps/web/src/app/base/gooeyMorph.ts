/** A horizontal span in px: a slot of a segmented control or a tab of the nav. */
export interface Span {
  left: number;
  width: number;
}

/** One blob's shape at a moment: where its centre is and how it's scaled (1 = a slot's size). */
export interface Pose {
  center: number;
  sx: number;
  sy: number;
}

export interface GooFrame {
  /** 0–1 along the animation. */
  offset: number;
  /** What's left stuck to the option being left: shrinks, pinching the neck off. */
  anchor: Pose;
  /** The drop itself, flying from option to option — what stays once it settles. */
  drop: Pose;
  /** A bump the target option puts out to catch the drop, swallowed when it lands. */
  catcher: Pose;
}

export interface GooOptions {
  /** The most the flying drop stretches along its path, as a multiple of its rest width. */
  maxStretch?: number;
  /** How much thinner the drop gets at full speed (0–1). */
  thinning?: number;
  /** Slingshot: the drop is first drawn back this many px, then released. */
  pullBackPx?: number;
  /** The share of the animation the pull-back takes. */
  pullShare?: number;
}

const SAMPLES = 36;
/** When (in the flight's own 0–1 time) the drop reaches the target; the rest is its landing wobble. */
const ARRIVE = 0.72;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** easeInOutCubic's slope, normalised to 0–1 (it peaks at 3 halfway). */
const cubicSpeed = (x: number) => (x < 0.5 ? 12 * x ** 2 : 12 * (1 - x) ** 2) / 3;
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const easeOutQuad = (x: number) => 1 - (1 - x) ** 2;
const HIDDEN = (center: number): Pose => ({ center, sx: 0, sy: 0 });

/**
 * How a blob of goo moves from one option to another, as three blobs that a blur-and-threshold
 * filter melts into one shape (see GooIndicator):
 * - the drop clings for a beat, then flies to the target — thinner than at rest and stretched along
 *   its path at speed, but never more than `maxStretch` — and lands with a little wobble;
 * - the anchor, a remnant stuck to the option being left, leans after the drop and shrinks, so the
 *   neck between them thins and snaps;
 * - the catcher, a bump the target puts out towards the drop, grabs it and is swallowed by it.
 * `base` is the blobs' rest width (one slot). Sampled, so play the frames with linear easing.
 */
export function gooFrames(
  from: Span,
  to: Span,
  base: number,
  { maxStretch = 1.3, thinning = 0.36, pullBackPx = 0, pullShare = 0 }: GooOptions = {}
): GooFrame[] {
  const fromCenter = from.left + from.width / 2;
  const toCenter = to.left + to.width / 2;
  const dir = Math.sign(toCenter - fromCenter) || 1;
  const fromSx = base ? from.width / base : 1;
  const pull = pullBackPx > 0 ? clamp01(pullShare) : 0;
  const start = fromCenter - dir * pullBackPx;

  return Array.from({ length: SAMPLES + 1 }, (_, i): GooFrame => {
    const t = i / SAMPLES;
    if (t < pull) {
      // Drawn back, squashing a little against the pull.
      const e = easeInOutSine(t / pull);
      return {
        offset: t,
        anchor: HIDDEN(fromCenter),
        drop: {
          center: fromCenter - dir * pullBackPx * e,
          sx: fromSx * (1 - 0.06 * e),
          sy: 1 + 0.04 * e,
        },
        catcher: HIDDEN(toCenter),
      };
    }
    const u = pull < 1 ? (t - pull) / (1 - pull) : 1;

    let drop: Pose;
    if (u < ARRIVE) {
      const x = u / ARRIVE;
      const speed = cubicSpeed(x);
      drop = {
        center: lerp(start, toCenter, easeInOutCubic(x)),
        sx: lerp(fromSx * (pull ? 0.94 : 1), 1, easeInOutCubic(x)) * (1 + (maxStretch - 1) * speed),
        sy: (pull ? lerp(1.04, 1, x) : 1) - thinning * speed,
      };
    } else {
      // Landing: a damped wobble, wider-and-flatter then narrower-and-taller.
      const w = (u - ARRIVE) / (1 - ARRIVE);
      const wobble = 0.07 * Math.sin(2 * Math.PI * w) * (1 - w);
      drop = { center: toCenter, sx: 1 + wobble, sy: 1 - wobble };
    }

    // Holds on a moment, then leans after the drop while it shrinks — thinning faster than it
    // narrows, so the neck pinches off.
    const a = clamp01((u - 0.06) / 0.5);
    const anchor: Pose = {
      center: start + dir * base * 0.12 * easeOutQuad(a),
      sx: fromSx * (1 - a ** 2),
      sy: (1 - a) ** 1.6,
    };

    // Grows towards the incoming drop, pulls back into the slot as it arrives, and is swallowed.
    const g = clamp01((u - 0.3) / (ARRIVE - 0.3));
    const swallowed = clamp01((u - ARRIVE) / 0.15);
    const size = 0.55 * Math.sin((Math.PI / 2) * g) * (1 - swallowed);
    const catcher: Pose = {
      center: toCenter - dir * base * 0.22 * (1 - g),
      sx: size,
      sy: Math.min(1, size * 1.15),
    };

    return { offset: t, anchor, drop, catcher };
  });
}

/** A blob's transform for a pose: the blob is `base` wide, scaled about its centre. */
export function poseTransform({ center, sx, sy }: Pose, base: number): string {
  return `translateX(${center - base / 2}px) scale(${sx}, ${sy})`;
}

/** Where a blob is right now, mid-animation included (scaled about its centre). */
export function renderedSpan(el: HTMLElement): Span {
  const { transform } = getComputedStyle(el);
  const { m11, m41 } = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
  const base = el.offsetWidth;
  const center = m41 + base / 2;
  return { left: center - (m11 * base) / 2, width: m11 * base };
}
