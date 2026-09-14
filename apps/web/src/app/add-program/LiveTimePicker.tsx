'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import { usePickerContext } from '@mui/x-date-pickers/hooks';
import type { PickerValidDate, TimeView } from '@mui/x-date-pickers/models';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { TimePicker, type TimePickerProps } from '@mui/x-date-pickers/TimePicker';
import { displayFont, tokens } from '../theme';

const TIME_VIEWS: readonly TimeView[] = ['hours', 'minutes', 'seconds'];

function sectionValue(date: PickerValidDate, view: TimeView): number {
  if (view === 'hours') return date.hour();
  if (view === 'minutes') return date.minute();
  return date.second();
}

const digitSx = {
  fontFamily: displayFont,
  fontWeight: 700,
  fontSize: '2.1rem',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
} as const;

/**
 * Toolbar shown above the clock face, reflecting the value currently being
 * dragged (not yet released) when there is one — see LiveTimePicker below
 * for why the stock TimePickerToolbar can't do this.
 */
function LiveToolbar({ liveValue }: Readonly<{ liveValue: PickerValidDate | null }>) {
  const { value, view, views, setView } = usePickerContext<PickerValidDate | null, TimeView>();
  const shown = liveValue ?? value;
  const activeViews = views.filter((v) => TIME_VIEWS.includes(v));

  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', pt: 2.5, pb: 1 }}>
      {activeViews.map((v, i) => (
        <Box key={v} sx={{ display: 'flex', alignItems: 'baseline' }}>
          {i > 0 && (
            <Box component="span" sx={{ ...digitSx, color: tokens.textFaint, px: '2px' }}>
              :
            </Box>
          )}
          <Box
            component="button"
            type="button"
            onClick={() => setView(v)}
            sx={{
              ...digitSx,
              background: 'none',
              border: 0,
              p: 0,
              cursor: 'pointer',
              color: v === view ? tokens.volt : tokens.text,
              transform: liveValue && v === view ? 'scale(1.1)' : 'scale(1)',
              transition: 'color 200ms ease, transform 150ms var(--ease-out)',
            }}
          >
            {shown ? String(sectionValue(shown, v)).padStart(2, '0') : '--'}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * `TimePicker` wrapper that keeps the toolbar above the clock face showing
 * the value currently being dragged, not just the value from the last
 * release. MUI X's clock reports a drag-in-progress move as a "shallow"
 * selection (`PickerSelectionState`), distinct from the "finish" one on
 * release, but `TimePickerToolbar` only ever reads the picker's committed
 * `value` via `usePickerContext()` — so the stock toolbar sits frozen while
 * dragging. This intercepts each view's `onChange` to track the shallow
 * value locally and feeds it to a custom toolbar (`LiveToolbar`) instead.
 */
export default function LiveTimePicker(props: Readonly<TimePickerProps>) {
  const [liveValue, setLiveValue] = useState<PickerValidDate | null>(null);

  return (
    <TimePicker
      {...props}
      onClose={() => {
        setLiveValue(null);
        props.onClose?.();
      }}
      viewRenderers={{
        hours: (viewProps) =>
          renderTimeViewClock({
            ...viewProps,
            onChange: (v, selectionState) => {
              setLiveValue(selectionState === 'shallow' ? v : null);
              viewProps.onChange(v, selectionState);
            },
          }),
        minutes: (viewProps) =>
          renderTimeViewClock({
            ...viewProps,
            onChange: (v, selectionState) => {
              setLiveValue(selectionState === 'shallow' ? v : null);
              viewProps.onChange(v, selectionState);
            },
          }),
        seconds: (viewProps) =>
          renderTimeViewClock({
            ...viewProps,
            onChange: (v, selectionState) => {
              setLiveValue(selectionState === 'shallow' ? v : null);
              viewProps.onChange(v, selectionState);
            },
          }),
        ...props.viewRenderers,
      }}
      slots={{ toolbar: () => <LiveToolbar liveValue={liveValue} />, ...props.slots }}
    />
  );
}
