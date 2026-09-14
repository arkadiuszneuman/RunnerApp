'use client';

import { ReactNode, useLayoutEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha } from '@mui/material/styles';
import { tokens } from '../theme';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accent shown behind this option while selected — drives the indicator's tint. */
  color: string;
}

type Rect = { left: number; width: number };

function measureSlot(group: HTMLElement, index: number): Rect | null {
  const buttons = group.querySelectorAll<HTMLElement>('.MuiToggleButton-root');
  const btn = buttons[index];
  if (!btn) return null;
  const groupRect = group.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return { left: btnRect.left - groupRect.left, width: btnRect.width };
}

function place(el: HTMLElement, rect: Rect, color: string) {
  el.style.transform = `translateX(${rect.left}px)`;
  el.style.width = `${rect.width}px`;
  el.style.backgroundColor = color;
}

/**
 * Segmented control (a ToggleButtonGroup styled as one pill) whose selection
 * indicator morphs between options instead of jumping: it squashes into a
 * droplet stretched toward the target as it travels, then settles back into
 * a rounded square, tweening its color through the two options' accents
 * along the way. Falls back to an instant position (no animation) when the
 * value changes on mount/resize, under `prefers-reduced-motion`, or where
 * the Web Animations API isn't available (e.g. jsdom in tests).
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
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const groupRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(index);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const indicator = indicatorRef.current;
    if (!group || !indicator) return;

    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = index;
    const nextRect = measureSlot(group, index);
    if (!nextRect) return;
    const toColor = alpha(options[index].color, 0.18);

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prevIndex === index || reduceMotion || typeof indicator.animate !== 'function') {
      place(indicator, nextRect, toColor);
      return;
    }

    const prevRect = measureSlot(group, prevIndex) ?? nextRect;
    const dir = index > prevIndex ? 1 : -1;
    const fromColor = alpha(options[prevIndex].color, 0.18);
    // Mid-point "droplet": stretched wide in the direction of travel, its
    // left edge trailing behind so it still overlaps the origin slot.
    const midWidth = Math.max(prevRect.width, nextRect.width) * 1.3;
    const midLeft = prevRect.left + (nextRect.left - prevRect.left) * 0.5 - (midWidth - prevRect.width) / 2;
    // Slight overshoot past the target width before settling — the droplet
    // "landing" back into a square.
    const overshootWidth = nextRect.width * 0.92;
    const overshootLeft = nextRect.left + dir * (nextRect.width - overshootWidth) * 0.5;

    place(indicator, prevRect, fromColor);
    indicator.animate(
      [
        {
          transform: `translateX(${prevRect.left}px)`,
          width: `${prevRect.width}px`,
          borderRadius: '12px',
          backgroundColor: fromColor,
          offset: 0,
        },
        {
          transform: `translateX(${midLeft}px)`,
          width: `${midWidth}px`,
          borderRadius: '999px',
          backgroundColor: toColor,
          offset: 0.55,
        },
        {
          transform: `translateX(${overshootLeft}px)`,
          width: `${overshootWidth}px`,
          borderRadius: '10px',
          backgroundColor: toColor,
          offset: 0.82,
        },
        {
          transform: `translateX(${nextRect.left}px)`,
          width: `${nextRect.width}px`,
          borderRadius: '12px',
          backgroundColor: toColor,
          offset: 1,
        },
      ],
      { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    );
  }, [index, options]);

  // Re-place (no animation) on resize — label reflow, viewport change.
  useLayoutEffect(() => {
    const group = groupRef.current;
    const indicator = indicatorRef.current;
    if (!group || !indicator || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const rect = measureSlot(group, prevIndexRef.current);
      const opt = options[prevIndexRef.current];
      if (rect && opt) place(indicator, rect, alpha(opt.color, 0.18));
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
      value={value}
      disabled={disabled}
      onChange={(_event, next: T | null) => {
        if (next) onChange(next);
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
      <Box
        ref={indicatorRef}
        aria-hidden
        sx={{ position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: '12px', pointerEvents: 'none' }}
      />
      {options.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value} sx={{ '&.Mui-selected, &.Mui-selected:hover': { color: opt.color } }}>
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
