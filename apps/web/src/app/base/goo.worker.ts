import { type GooCommand, GooRenderer } from './gooRenderer';

/**
 * Hosts the goo indicator's renderer (see GooIndicator) off the main thread: its animation keeps
 * running while the page is busy rendering a route.
 */
export type GooWorkerRequest = GooCommand | { type: 'init'; canvas: OffscreenCanvas };
/** Posted once the first frame is on screen, so the page can drop its stand-in. */
export type GooWorkerMessage = 'drawn';

const scope = self as unknown as {
  requestAnimationFrame?: (callback: () => void) => number;
  postMessage(message: GooWorkerMessage): void;
  onmessage: ((event: MessageEvent<GooWorkerRequest>) => void) | null;
};
const raf = (callback: () => void) =>
  scope.requestAnimationFrame ? scope.requestAnimationFrame(callback) : setTimeout(callback, 16);

let renderer: GooRenderer | null = null;

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') {
    renderer = GooRenderer.create(message.canvas, raf, () => scope.postMessage('drawn'));
    return;
  }
  renderer?.handle(message);
};
