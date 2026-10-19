/** Same shape as the DOM's ImageData (RGBA, row-major), so it also works in Node tests. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface PrepareOptions {
  /** Luminance under which a pixel counts as the watch's black screen. */
  dark?: number;
  /** Luminance over which a (grey enough) pixel counts as text. */
  bright?: number;
  /** Max spread between RGB channels for text: drops the coloured chart, glare and skin. */
  saturation?: number;
}

/** Tuned on photos of a Forerunner's workout screen; ocr.ts retries with others. */
export const DEFAULT_PREPARE_OPTIONS: Required<PrepareOptions> = {
  dark: 55,
  bright: 120,
  saturation: 100,
};

/** Cuts the bezel ticks off the edge of the screen. */
const SCREEN_INSET = 0.9;

/**
 * Turns a photo of a watch into what Tesseract reads best: just the screen, with its white text
 * black on a white background and everything else (bezel, strap, wrist, the coloured workout
 * chart, reflections) gone.
 *
 * The screen is found as the biggest dark, round-ish, central blob on a coarse grid, cropped
 * to, and masked to the ellipse inscribed in it. Without one (no dark screen in the photo) the
 * whole photo is thresholded instead.
 */
export function prepareWatchImage(image: RgbaImage, options: PrepareOptions = {}): RgbaImage {
  const { dark, bright, saturation } = { ...DEFAULT_PREPARE_OPTIONS, ...options };
  const { width, height, data } = image;

  const luminance = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    luminance[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const screen = findScreen(width, height, luminance, dark) ?? {
    x: 0,
    y: 0,
    width,
    height,
    masked: false,
  };

  const out = new Uint8ClampedArray(screen.width * screen.height * 4);
  const rx = (screen.width / 2) * SCREEN_INSET;
  const ry = (screen.height / 2) * SCREEN_INSET;
  for (let y = 0; y < screen.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const source = (screen.y + y) * width + screen.x + x;
      const dx = (x - screen.width / 2) / rx;
      const dy = (y - screen.height / 2) / ry;
      let ink = false;
      if (!screen.masked || dx * dx + dy * dy <= 1) {
        const r = data[source * 4];
        const g = data[source * 4 + 1];
        const b = data[source * 4 + 2];
        ink = luminance[source] > bright && Math.max(r, g, b) - Math.min(r, g, b) < saturation;
      }
      const o = (y * screen.width + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = ink ? 0 : 255;
      out[o + 3] = 255;
    }
  }
  return { width: screen.width, height: screen.height, data: out };
}

interface Screen {
  x: number;
  y: number;
  width: number;
  height: number;
  masked: boolean;
}

function findScreen(
  width: number,
  height: number,
  luminance: Float32Array,
  dark: number
): Screen | undefined {
  // A ~200-cell grid: cells mostly dark are screen candidates, and the text inside the screen
  // is too thin to split it.
  const cell = Math.max(2, Math.round(Math.max(width, height) / 200));
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const grid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let pixels = 0;
      let darkPixels = 0;
      for (let y = gy * cell; y < Math.min(height, (gy + 1) * cell); y++) {
        for (let x = gx * cell; x < Math.min(width, (gx + 1) * cell); x++) {
          pixels++;
          if (luminance[y * width + x] < dark) darkPixels++;
        }
      }
      grid[gy * gw + gx] = darkPixels / pixels > 0.5 ? 1 : 0;
    }
  }

  const seen = new Uint8Array(gw * gh);
  const stack: number[] = [];
  let best: { score: number; x0: number; y0: number; x1: number; y1: number } | undefined;
  for (let start = 0; start < gw * gh; start++) {
    if (!grid[start] || seen[start]) continue;
    let area = 0;
    let x0 = gw;
    let y0 = gh;
    let x1 = 0;
    let y1 = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % gw;
      const py = (p - px) / gw;
      area++;
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
      const neighbours = [
        px > 0 ? p - 1 : -1,
        px < gw - 1 ? p + 1 : -1,
        py > 0 ? p - gw : -1,
        py < gh - 1 ? p + gw : -1,
      ];
      for (const q of neighbours) {
        if (q >= 0 && grid[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }

    const boxWidth = x1 - x0 + 1;
    const boxHeight = y1 - y0 + 1;
    const aspect = Math.min(boxWidth, boxHeight) / Math.max(boxWidth, boxHeight);
    const fill = area / (boxWidth * boxHeight);
    const offCentre = Math.hypot((x0 + x1) / 2 / gw - 0.5, (y0 + y1) / 2 / gh - 0.5);
    // Round (a circle fills ~79% of its box), central, and not a dark background running off
    // the edge of the photo.
    const touchesEdge = x0 === 0 || y0 === 0 || x1 === gw - 1 || y1 === gh - 1;
    const score =
      area *
      aspect *
      aspect *
      Math.max(0, 1 - offCentre * 1.5) *
      (fill > 0.5 ? 1 : 0.2) *
      (touchesEdge ? 0.05 : 1);
    if (score > 0 && (!best || score > best.score)) best = { score, x0, y0, x1, y1 };
  }
  if (!best) return undefined;

  const x = best.x0 * cell;
  const y = best.y0 * cell;
  const screen = {
    x,
    y,
    width: Math.min(width, (best.x1 + 1) * cell) - x,
    height: Math.min(height, (best.y1 + 1) * cell) - y,
    masked: true,
  };
  // Something tiny is a dark speck, not the screen.
  return screen.width * screen.height > width * height * 0.03 ? screen : undefined;
}
