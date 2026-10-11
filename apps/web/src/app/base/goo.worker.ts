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
/** Posted once an indicator's first frame is on screen, so the page can drop its stand-in. */
export type GooWorkerMessage = { type: 'drawn'; id: number };

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

const painter = GooPainter.create();
const indicators = new Map<number, Indicator>();
/** Indicators to paint on the next frame (besides those animating). */
const dirty = new Set<number>();
let scheduled = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  raf(paint);
}

function paint() {
  scheduled = false;
  if (!painter) return;
  const now = epochNow();
  for (const [id, indicator] of indicators) {
    if (!dirty.has(id) && !indicator.scene.animating) continue;
    dirty.delete(id);
    const frame = indicator.scene.frame(now);
    if (!frame) continue;
    const bitmap = painter.paint(frame);
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
    if (!output || !painter) return;
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
