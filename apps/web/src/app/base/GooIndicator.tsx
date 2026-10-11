'use client';

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { alpha, type CSSObject } from '@mui/material/styles';
import type { GooWorkerMessage, GooWorkerRequest } from './goo.worker';
import type { GooOptions, Span } from './gooeyMorph';
import { epochNow, type GooCommand, parseColor } from './gooRenderer';

export interface GooIndicatorHandle {
  /** The layer the goo is drawn on: spans passed to `place`/`morph` are relative to its left edge. */
  layer(): HTMLElement | null;
  /** Puts the drop on `span`, tinted `color` (unless a `gradient` fills it). */
  place(span: Span, color?: string): void;
  /**
   * Moves the goo from `from` to `to` — or from wherever the drop has got to, if it's still flying,
   * so a quick second tap re-aims it. Call `place(to)` first: that's where it settles.
   */
  morph(
    from: Span,
    to: Span,
    options: GooOptions & { duration: number; fromColor?: string; toColor?: string }
  ): void;
}

/** Development only: `window.__gooSlowMotion = 20` plays the goo 20× slower, to look at it. */
const slowMotion = () =>
  process.env.NODE_ENV === 'production'
    ? 1
    : Number((globalThis as { __gooSlowMotion?: number }).__gooSlowMotion) || 1;

/** The one worker drawing every indicator on the page (goo.worker.ts), started on first use. */
let worker: Worker | null = null;
let nextId = 1;
const onDrawn = new Map<number, () => void>();

function gooWorker(): Worker {
  if (!worker) {
    // A classic worker, not { type: 'module' }: Turbopack's production worker bootstrap loads its
    // chunks with importScripts(), which module workers forbid (Android's WebView enforces it).
    worker = new Worker(new URL('./goo.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<GooWorkerMessage>) => {
      if (event.data.type === 'drawn') onDrawn.get(event.data.id)?.();
    };
  }
  return worker;
}

const send = (message: GooWorkerRequest, transfer: Transferable[] = []) =>
  gooWorker().postMessage(message, transfer);

/**
 * A selection indicator made of goo: three blobs (see gooeyMorph.ts) melted into one shape — a
 * bit stays stuck to the option being left while a drop flies off, and the neck between them
 * thins and snaps. Drawn with WebGL (gooRenderer.ts) by a worker shared by every indicator, so
 * the animation stays smooth while the page is busy (a tab's route rendering). Until the first
 * frame is drawn — and wherever a worker can't draw (no OffscreenCanvas, no WebGL) — a plain
 * rounded box stands in for it, jumping between options. Sits behind the options (`sx`
 * positions it); the parent drives it through `ref`.
 */
export default function GooIndicator({
  ref,
  radius,
  smooth,
  fillOpacity = 1,
  gradient,
  outline,
  padY = 0,
  fallbackSx,
  sx,
}: Readonly<{
  ref: Ref<GooIndicatorHandle>;
  /** Corner radius at rest (px); 999 for a capsule. */
  radius: number;
  /** How far apart (px) blobs still melt together. */
  smooth: number;
  /** Opacity of the option colours passed to `place`/`morph`. */
  fillOpacity?: number;
  /** A 135° gradient (CSS colours) filling the goo instead of the options' colours. */
  gradient?: [string, string];
  outline?: string;
  /**
   * Room (px) the layer has above and below the goo at rest, so melting blobs that swell where
   * they meet aren't cut off flat. The layer is that much taller than the goo.
   */
  padY?: number;
  /** Where the stand-in rests before `place` is first called (e.g. from server rendering). */
  fallbackSx?: CSSObject;
  sx?: CSSObject;
}>) {
  const layerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const postRef = useRef<((command: GooCommand) => void) | null>(null);
  const lastPlace = useRef<GooCommand | null>(null);
  const [drawn, setDrawn] = useState(false);

  useImperativeHandle(ref, () => {
    const tint = (color: string) => parseColor(color, fillOpacity);
    return {
      layer: () => layerRef.current,
      place(span, color) {
        const fallback = fallbackRef.current;
        if (fallback) {
          fallback.style.width = `${span.width}px`;
          fallback.style.transform = `translateX(${span.left}px)`;
          if (color && !gradient) fallback.style.backgroundColor = alpha(color, fillOpacity);
        }
        const command: GooCommand = { type: 'place', span, color: color ? tint(color) : undefined };
        lastPlace.current = command;
        postRef.current?.(command);
      },
      morph(from, to, { duration, fromColor, toColor, ...options }) {
        postRef.current?.({
          type: 'morph',
          from,
          to,
          fromColor: fromColor ? tint(fromColor) : undefined,
          toColor: toColor ? tint(toColor) : undefined,
          options,
          duration: duration * slowMotion(),
          startedAt: epochNow(),
        });
      },
    };
  }, [gradient, fillOpacity]);

  // The look is fixed for the indicator's lifetime.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof ResizeObserver === 'undefined' || typeof Worker === 'undefined') return;
    // A fresh canvas each time: one handed to a worker can't be handed over again (Strict Mode
    // runs this twice in development).
    const canvas = document.createElement('canvas');
    if (!('transferControlToOffscreen' in canvas)) return;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    const id = nextId++;
    const offscreen = canvas.transferControlToOffscreen();
    send({ type: 'init', id, canvas: offscreen }, [offscreen]);
    onDrawn.set(id, () => setDrawn(true));
    layer.appendChild(canvas);

    const post = (command: GooCommand) => send({ type: 'command', id, command });
    post({
      type: 'look',
      look: {
        radius,
        smooth,
        gradient: gradient && [parseColor(gradient[0]), parseColor(gradient[1])],
        outline: outline ? parseColor(outline) : undefined,
        padY,
      },
    });
    const sendSize = () =>
      post({
        type: 'size',
        width: layer.clientWidth,
        height: layer.clientHeight,
        dpr: window.devicePixelRatio || 1,
      });
    sendSize();
    if (lastPlace.current) post(lastPlace.current);
    postRef.current = post;
    const observer = new ResizeObserver(sendSize);
    observer.observe(layer);
    return () => {
      observer.disconnect();
      postRef.current = null;
      onDrawn.delete(id);
      send({ type: 'dispose', id });
      canvas.remove();
      setDrawn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box ref={layerRef} aria-hidden sx={{ position: 'absolute', pointerEvents: 'none', ...sx }}>
      <Box
        ref={fallbackRef}
        sx={{
          position: 'absolute',
          top: padY,
          bottom: padY,
          left: 0,
          borderRadius: `${radius}px`,
          background: gradient && `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          border: outline && `1px solid ${outline}`,
          boxSizing: 'border-box',
          visibility: drawn ? 'hidden' : 'visible',
          ...fallbackSx,
        }}
      />
    </Box>
  );
}
