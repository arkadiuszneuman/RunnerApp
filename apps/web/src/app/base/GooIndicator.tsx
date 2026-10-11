'use client';

import { type Ref, useId, useImperativeHandle, useRef } from 'react';
import Box from '@mui/material/Box';
import type { CSSObject } from '@mui/material/styles';
import { gooFrames, type GooOptions, poseTransform, renderedSpan, type Span } from './gooeyMorph';

export interface GooIndicatorHandle {
  /** Puts the drop on `span` straight away, coloured `color` (when the blobs aren't styled by `background`). */
  place(span: Span, color?: string): void;
  /**
   * Moves the goo from `from` to `to` — or from wherever the drop has got to, if it's still flying, so
   * a quick second tap re-aims it. The drop's resting place must already be `to` (see `place`, or
   * `dropSx`): the animation only covers the way there.
   */
  morph(
    from: Span,
    to: Span,
    options: GooOptions & { duration: number; fromColor?: string; toColor?: string }
  ): void;
}

const BLOB = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  transformOrigin: '50% 50%',
} as const;

/**
 * A selection indicator made of goo: three blobs (see gooeyMorph.ts) melted into one shape by an
 * SVG filter — a blur, then a hard cut-off on opacity, so blobs near each other merge through a
 * neck that thins and snaps as they part. The blobs are drawn opaque (the cut-off needs it);
 * `fillOpacity` makes the result see-through and `outline` gives it a 1px edge. Sits behind the
 * options (`sx` positions it); the parent drives it through `ref`.
 */
export default function GooIndicator({
  ref,
  blur,
  fillOpacity,
  radius,
  background,
  outline,
  dropSx,
  sx,
}: Readonly<{
  ref: Ref<GooIndicatorHandle>;
  /** Blur radius (px): how far apart blobs still merge, and how round the shape gets. */
  blur: number;
  fillOpacity: number;
  radius: number | string;
  /** CSS background for every blob; otherwise `place`/`morph` colour them. */
  background?: string;
  outline?: string;
  /** Resting place of the drop, when the parent sets it with CSS rather than `place`. */
  dropSx?: CSSObject;
  sx?: CSSObject;
}>) {
  const filterId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const catcherRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      place(span, color) {
        const drop = dropRef.current;
        if (!drop) return;
        drop.style.width = `${span.width}px`;
        drop.style.transform = `translateX(${span.left}px)`;
        if (color) drop.style.backgroundColor = color;
      },
      morph(from, to, { duration, fromColor, toColor, ...options }) {
        const anchor = anchorRef.current;
        const drop = dropRef.current;
        const catcher = catcherRef.current;
        if (!anchor || !drop || !catcher) return;
        const blobs = [anchor, drop, catcher];
        const running = blobs.some((blob) => blob.getAnimations().length);
        const start = running ? renderedSpan(drop) : from;
        blobs.forEach((blob) => blob.getAnimations().forEach((animation) => animation.cancel()));

        const base = to.width;
        for (const [blob, color] of [
          [anchor, fromColor],
          [catcher, toColor],
        ] as const) {
          blob.style.width = `${base}px`;
          if (color) blob.style.backgroundColor = color;
        }
        const frames = gooFrames(start, to, base, {
          aspect: drop.offsetHeight ? base / drop.offsetHeight : undefined,
          ...options,
        });
        const play = (el: HTMLElement, pose: 'anchor' | 'drop' | 'catcher') =>
          el.animate(
            frames.map((frame) => ({
              offset: frame.offset,
              transform: poseTransform(frame[pose], base),
            })),
            { duration }
          );
        play(anchor, 'anchor');
        play(drop, 'drop');
        play(catcher, 'catcher');
        if (fromColor && toColor && !running) {
          drop.animate(
            [
              { backgroundColor: fromColor },
              { backgroundColor: toColor, offset: 0.45 },
              { backgroundColor: toColor },
            ],
            { duration }
          );
        }
      },
    }),
    []
  );

  const blob = { ...BLOB, borderRadius: radius, background } as const;
  const fill = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${fillOpacity} 0`;
  return (
    <Box aria-hidden sx={{ position: 'absolute', pointerEvents: 'none', ...sx }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter
          id={filterId}
          x="-10%"
          y="-50%"
          width="120%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          {/* Opacity ×18 − 7: the soft blur becomes a hard edge, and close blobs a single shape. */}
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape" />
          <feColorMatrix in="shape" type="matrix" values={fill} result="fill" />
          {outline && (
            <>
              <feMorphology in="goo" operator="erode" radius="1" result="inner" />
              <feComposite in="goo" in2="inner" operator="out" result="ring" />
              <feFlood floodColor={outline} result="ink" />
              <feComposite in="ink" in2="ring" operator="in" result="edge" />
              <feMerge>
                <feMergeNode in="fill" />
                <feMergeNode in="edge" />
              </feMerge>
            </>
          )}
        </filter>
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, filter: `url(#${filterId})` }}>
        <Box ref={anchorRef} sx={{ ...blob, transform: 'scale(0)' }} />
        <Box ref={catcherRef} sx={{ ...blob, transform: 'scale(0)' }} />
        <Box ref={dropRef} sx={{ ...blob, ...dropSx }} />
      </Box>
    </Box>
  );
}
