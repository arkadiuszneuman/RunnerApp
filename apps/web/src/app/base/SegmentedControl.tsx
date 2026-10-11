'use client';

import { ReactNode, startTransition, useLayoutEffect, useOptimistic, useRef } from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { tokens } from '../theme';
import GooIndicator, { type GooIndicatorHandle } from './GooIndicator';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accent shown behind this option while selected — drives the indicator's tint. */
  color: string;
}

type Rect = { left: number; width: number };

/** Where option `index` sits, relative to `origin` (the goo's layer). */
function measureSlot(group: HTMLElement, index: number, origin: HTMLElement | null): Rect | null {
  const buttons = group.querySelectorAll<HTMLElement>('.MuiToggleButton-root');
  const btn = buttons[index];
  if (!btn) return null;
  const originRect = (origin ?? group).getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return { left: btnRect.left - originRect.left, width: btnRect.width };
}

/**
 * Segmented control (a ToggleButtonGroup styled as one pill) whose selection
 * indicator is a blob of goo (see GooIndicator): on a change a bit of it stays
 * stuck to the old option while a thinner drop flies off, the new option
 * reaches out to catch it, and the neck between them thins and snaps — its
 * colour going from one option's accent to the other's. Falls back to an
 * instant position (no animation) when the value changes on mount/resize,
 * under `prefers-reduced-motion`, or where the Web Animations API isn't
 * available (e.g. jsdom in tests).
 */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled,
  'aria-label': ariaLabel,
}: Readonly<{
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  disabled?: boolean;
  'aria-label': string;
}>) {
  // The new option is selected (and the indicator launched) the moment it's tapped; whatever the
  // change sets off — a heavy re-render of the page around it — follows as a transition.
  const [shown, setShown] = useOptimistic(value);
  const select = (next: T) =>
    startTransition(() => {
      setShown(next);
      onChange(next);
    });
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === shown)
  );
  const groupRef = useRef<HTMLDivElement>(null);
  const gooRef = useRef<GooIndicatorHandle>(null);
  const prevIndexRef = useRef(index);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const goo = gooRef.current;
    if (!group || !goo) return;

    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = index;
    const nextRect = measureSlot(group, index, goo.layer());
    if (!nextRect) return;
    const toColor = options[index].color;
    goo.place(nextRect, toColor);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (
      prevIndex === index ||
      reduceMotion ||
      typeof group.animate !== 'function' ||
      !options[prevIndex]
    ) {
      return;
    }
    goo.morph(measureSlot(group, prevIndex, goo.layer()) ?? nextRect, nextRect, {
      duration: 600,
      fromColor: options[prevIndex].color,
      toColor,
    });
  }, [index, options]);

  // Re-place (no animation) on resize — label reflow, viewport change.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const rect = measureSlot(group, prevIndexRef.current, gooRef.current?.layer() ?? null);
      const opt = options[prevIndexRef.current];
      if (rect && opt) gooRef.current?.place(rect, opt.color);
    });
    observer.observe(group);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ToggleButtonGroup
      ref={groupRef}
      exclusive
      aria-label={ariaLabel}
      value={shown}
      disabled={disabled}
      onChange={(_event, next: T | null) => {
        if (next) select(next);
      }}
      sx={{
        position: 'relative',
        width: '100%',
        p: 0.5,
        gap: 0.5,
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${tokens.border}`,
        overflow: 'hidden',
        '& .MuiToggleButton-root': {
          position: 'relative',
          zIndex: 1,
          flex: 1,
          py: 1,
          border: 0,
          borderRadius: '12px !important',
          color: tokens.textMuted,
          textTransform: 'none',
          fontWeight: 600,
          background: 'transparent !important',
          transition: 'color 250ms ease',
        },
      }}
    >
      <GooIndicator
        ref={gooRef}
        radius={12}
        smooth={12}
        fillOpacity={0.18}
        // Over the options only (inside the 4px padding), so goo pushed against an end squashes
        // there instead of running into the rounded frame; the padding above and below is room
        // for it to swell.
        padY={4}
        sx={{ top: 0, bottom: 0, left: 4, right: 4 }}
      />
      {options.map((opt) => (
        <ToggleButton
          key={opt.value}
          value={opt.value}
          sx={{ '&.Mui-selected, &.Mui-selected:hover': { color: opt.color } }}
        >
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
