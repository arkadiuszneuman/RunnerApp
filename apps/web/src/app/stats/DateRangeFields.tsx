'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { type DatePickerToolbarProps } from '@mui/x-date-pickers/DatePicker';
import { MobileDatePicker } from '@mui/x-date-pickers/MobileDatePicker';
import { pickersLayoutClasses } from '@mui/x-date-pickers/PickersLayout';
import { DAY_MS, resolveRange, type DateGranularity, type StatsFilter } from '@runner/core';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import SegmentedControl from '../base/SegmentedControl';
import { tokens } from '../theme';
import { nowLocalMs } from './statsState';

const VIEWS: Record<DateGranularity, ('year' | 'month' | 'day')[]> = {
  year: ['year'],
  month: ['year', 'month'],
  day: ['year', 'month', 'day'],
};
const FORMAT: Record<DateGranularity, string> = {
  year: 'YYYY',
  month: 'MMM YYYY',
  day: 'D MMM YYYY',
};
const ISO = 'YYYY-MM-DD';
const OPEN_TO: Record<DateGranularity, 'year' | 'month' | 'day'> = {
  year: 'year',
  month: 'month',
  day: 'day',
};

type GranularityToolbarProps = DatePickerToolbarProps & {
  granularity: DateGranularity;
  onGranularityChange: (granularity: DateGranularity) => void;
};

/** The picker's header: what a pick spans — a whole year, a whole month or a single day. */
function GranularityToolbar(props: DatePickerToolbarProps) {
  const { granularity, onGranularityChange } = props as GranularityToolbarProps;
  return (
    // The layout's class is what places it in the picker's grid, above the calendar.
    <Box className={pickersLayoutClasses.toolbar} sx={{ px: 2, pt: 2, pb: 1 }}>
      <SegmentedControl
        aria-label="Pick dates by"
        value={granularity}
        onChange={onGranularityChange}
        options={[
          { value: 'year', label: 'Year', color: tokens.volt },
          { value: 'month', label: 'Month', color: tokens.volt },
          { value: 'day', label: 'Day', color: tokens.volt },
        ]}
      />
    </Box>
  );
}

/**
 * One date field; tapping it anywhere opens the calendar in a dialog (no typing into the field's
 * sections), with the Year/Month/Day switch on top.
 */
function RangePicker({
  label,
  value,
  onChange,
  granularity,
  onGranularityChange,
  minDate,
  maxDate,
  open,
  onOpenChange,
  onAccept,
}: Readonly<{
  label: string;
  value?: string;
  onChange: (value: Dayjs | null) => void;
  granularity: DateGranularity;
  onGranularityChange: (granularity: DateGranularity) => void;
  minDate?: string;
  maxDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
}>) {
  // Controlled, so switching granularity with the calendar open jumps straight to its view.
  const [view, setView] = useState<'year' | 'month' | 'day'>(OPEN_TO[granularity]);
  // Every opening — by tap or by the other field — starts at the granularity's own view.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setView(OPEN_TO[granularity]);
  }
  const changeGranularity = (next: DateGranularity) => {
    setView(OPEN_TO[next]);
    onGranularityChange(next);
  };
  const views = VIEWS[granularity];
  return (
    <MobileDatePicker
      label={label}
      views={views}
      openTo={OPEN_TO[granularity]}
      view={views.includes(view) ? view : OPEN_TO[granularity]}
      onViewChange={setView}
      open={open}
      onOpen={() => onOpenChange(true)}
      onClose={() => onOpenChange(false)}
      onAccept={onAccept}
      // A pick in the last view is the answer — no OK to confirm it.
      closeOnSelect
      format={FORMAT[granularity]}
      value={value ? dayjs(value) : null}
      onChange={onChange}
      minDate={minDate ? dayjs(minDate) : undefined}
      maxDate={dayjs(maxDate)}
      slots={{ toolbar: GranularityToolbar }}
      slotProps={{
        textField: { size: 'small', sx: { width: 160, '& *': { cursor: 'pointer' } } },
        // The field only shows the date: no typing into its sections, a tap anywhere opens the
        // calendar.
        field: { readOnly: true, onClick: () => onOpenChange(true) },
        actionBar: { actions: ['cancel'] },
        // MUI passes slotProps through to the slot; its type only knows the stock toolbar's props.
        toolbar: {
          hidden: false,
          granularity,
          onGranularityChange: changeGranularity,
        } as GranularityToolbarProps,
      }}
    />
  );
}

/** The filter's current span as inclusive local dates — the preset's when it isn't custom. */
function shownRange(filter: StatsFilter): { from?: string; to?: string } {
  if (filter.range === 'custom') return { from: filter.from, to: filter.to };
  const { fromMs, toMs } = resolveRange(filter, nowLocalMs());
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return {
    from: fromMs !== undefined ? day(fromMs) : undefined,
    to: toMs !== undefined ? day(toMs - DAY_MS) : day(nowLocalMs()),
  };
}

/**
 * From–to date pickers that work in whole years, whole months or days: with "Year" a pick spans
 * 1 Jan–31 Dec, with "Month" the whole month. Picking a date switches the period to custom,
 * starting from whatever the preset showed. `years` (those with runs) become one-tap chips.
 * Picks are kept between `earliest` (the first activity's date) and today: a whole year or month
 * is cut short at either end.
 */
export default function DateRangeFields({
  filter,
  onChange,
  years,
  earliest,
}: Readonly<{
  filter: StatsFilter;
  onChange: (patch: Partial<StatsFilter>) => void;
  years?: number[];
  earliest?: string;
}>) {
  const granularity = filter.granularity ?? 'month';
  const unit = granularity === 'day' ? 'day' : granularity;
  const today = new Date(nowLocalMs()).toISOString().slice(0, 10);
  const clamp = (date: string) => {
    const notFuture = date > today ? today : date;
    return earliest && notFuture < earliest ? earliest : notFuture;
  };
  // Presets (e.g. the last 12 months) can reach back before the first activity — shown, and
  // edited, from where the data starts.
  const shown = shownRange(filter);
  const from = shown.from && clamp(shown.from);
  const to = shown.to && clamp(shown.to);
  const yearRange = (year: number) => ({
    from: clamp(`${year}-01-01`),
    to: clamp(`${year}-12-31`),
  });

  const set = (edge: 'from' | 'to', value: Dayjs | null) => {
    if (!value || !value.isValid()) return;
    const date = clamp((edge === 'from' ? value.startOf(unit) : value.endOf(unit)).format(ISO));
    const next = { from, to, [edge]: date };
    // Keep the span the right way round.
    if (next.from && next.to && next.from > next.to) {
      if (edge === 'from') next.to = clamp(value.endOf(unit).format(ISO));
      else next.from = clamp(value.startOf(unit).format(ISO));
    }
    onChange({ range: 'custom', ...next });
  };

  const pickYear = (year: number) =>
    onChange({ range: 'custom', granularity: 'year', ...yearRange(year) });

  const [openEdge, setOpenEdge] = useState<'from' | 'to' | null>(null);
  const picker = (edge: 'from' | 'to', label: string) => (
    <RangePicker
      label={label}
      value={edge === 'from' ? from : to}
      onChange={(value) => set(edge, value)}
      granularity={granularity}
      onGranularityChange={(g) => onChange({ granularity: g })}
      // "To" can't go before "From".
      minDate={edge === 'to' ? (from ?? earliest) : earliest}
      maxDate={today}
      open={openEdge === edge}
      onOpenChange={(open) =>
        setOpenEdge((current) => (open ? edge : current === edge ? null : current))
      }
      // Picking "From" goes straight on to picking "To".
      onAccept={edge === 'from' ? () => setOpenEdge('to') : undefined}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {picker('from', 'From')}
        {picker('to', 'To')}
      </Box>
      {years && years.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {years.map((year) => {
            const span = yearRange(year);
            const selected = filter.range === 'custom' && from === span.from && to === span.to;
            return (
              <Chip
                key={year}
                label={year}
                size="small"
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                onClick={() => pickYear(year)}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}
