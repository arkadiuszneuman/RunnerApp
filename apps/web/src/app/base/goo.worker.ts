import { epochNow, type GooCommand, GooPainter, GooScene } from './gooRenderer';

/**
 * Draws every goo indicator on the page (see GooIndicator) off the main thread, so their
 * animations keep running while the page is busy rendering a route. One worker, one WebGL
 * context: each indicator's frame is painted by the shared GooPainter and handed to the
 * indicator's own canvas as a bitmap.
 */
export type GooWorkerRequest =
  | { type: 'init'; id: number; canvas: OffscreenCanvas }
  | { type: 'dispose'; id: number }
  | { type: 'command'; id: number; command: GooCommand };
/**
 * `drawn`: an indicator's frame is on screen, so the page can drop its stand-in. `lost`: the WebGL
 * context went away and the goo can't be drawn for now, so the stand-in has to come back.
 */
export type GooWorkerMessage = { type: 'drawn' | 'lost'; id: number };

const scope = self as unknown as {
  requestAnimationFrame?: (callback: () => void) => number;
  postMessage(message: GooWorkerMessage): void;
  onmessage: ((event: MessageEvent<GooWorkerRequest>) => void) | null;
};
const raf = (callback: () => void) =>
  scope.requestAnimationFrame ? scope.requestAnimationFrame(callback) : setTimeout(callback, 16);

interface Indicator {
  scene: GooScene;
  output: ImageBitmapRenderingContext;
  canvas: OffscreenCanvas;
  drawn: boolean;
}

/** How often to ask for a new WebGL context while the GPU won't give one out. */
const RETRY_MS = 500;

let painter: GooPainter | null = null;
/** Whether a context was ever had — only then is one worth waiting for. */
let hadContext = false;
let retry: ReturnType<typeof setTimeout> | undefined;
const indicators = new Map<number, Indicator>();
/** Indicators to paint on the next frame (besides those animating). */
const dirty = new Set<number>();
let scheduled = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  raf(paint);
}

/**
 * The painter, made anew once its context is lost — every indicator is then repainted, as what it
 * showed came from the lost context. Null while no context can be had: the indicators show their
 * stand-ins, and painting is retried a little later (unless there never was a context).
 */
function livePainter(): GooPainter | null {
  if (painter && !painter.lost) return painter;
  const fresh = GooPainter.create(onContextLost);
  if (painter || !fresh) {
    for (const [id, indicator] of indicators) {
      dirty.add(id);
      if (!fresh && indicator.drawn) {
        indicator.drawn = false;
        scope.postMessage({ type: 'lost', id });
      }
    }
  }
  painter = fresh;
  // Without WebGL at all there's nothing to wait for: the stand-ins stay.
  if (!fresh && hadContext) {
    clearTimeout(retry);
    retry = setTimeout(schedule, RETRY_MS);
  }
  if (fresh) hadContext = true;
  return fresh;
}

/** The context can go while every indicator is at rest — repaint them all at once. */
function onContextLost() {
  for (const id of indicators.keys()) dirty.add(id);
  schedule();
}

function paint() {
  scheduled = false;
  if (indicators.size === 0) return;
  const current = livePainter();
  if (!current) return;
  const now = epochNow();
  for (const [id, indicator] of indicators) {
    if (!dirty.has(id) && !indicator.scene.animating) continue;
    dirty.delete(id);
    const frame = indicator.scene.frame(now);
    if (!frame) continue;
    const bitmap = current.paint(frame);
    indicator.canvas.width = bitmap.width;
    indicator.canvas.height = bitmap.height;
    indicator.output.transferFromImageBitmap(bitmap);
    if (!indicator.drawn) {
      indicator.drawn = true;
      scope.postMessage({ type: 'drawn', id });
    }
  }
  if ([...indicators.values()].some((indicator) => indicator.scene.animating)) schedule();
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') {
    const output = message.canvas.getContext('bitmaprenderer');
    if (!output) return;
    indicators.set(message.id, {
      scene: new GooScene(),
      output,
      canvas: message.canvas,
      drawn: false,
    });
    return;
  }
  if (message.type === 'dispose') {
    indicators.delete(message.id);
    dirty.delete(message.id);
    return;
  }
  const indicator = indicators.get(message.id);
  if (!indicator) return;
  indicator.scene.handle(message.command);
  dirty.add(message.id);
  schedule();
};

if (process.env.NODE_ENV !== 'production') {
  // Development only: `__gooLoseContext()` in the worker's console takes the WebGL context away.
  (self as unknown as { __gooLoseContext: () => void }).__gooLoseContext = () =>
    painter?.loseContext();
}
