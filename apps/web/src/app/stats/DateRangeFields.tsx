'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DAY_MS, resolveRange, type DateGranularity, type StatsFilter } from '@runner/core';
import dayjs, { type Dayjs } from 'dayjs';
import SegmentedControl from '../base/SegmentedControl';
import { tokens } from '../theme';
import { nowLocalMs } from './statsState';

const VIEWS: Record<DateGranularity, ('year' | 'month' | 'day')[]> = {
  year: ['year'],
  month: ['month', 'year'],
  day: ['year', 'month', 'day'],
};
const FORMAT: Record<DateGranularity, string> = {
  year: 'YYYY',
  month: 'MMM YYYY',
  day: 'D MMM YYYY',
};
const ISO = 'YYYY-MM-DD';

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
 */
export default function DateRangeFields({
  filter,
  onChange,
  years,
}: Readonly<{
  filter: StatsFilter;
  onChange: (patch: Partial<StatsFilter>) => void;
  years?: number[];
}>) {
  const granularity = filter.granularity ?? 'month';
  const { from, to } = shownRange(filter);
  const unit = granularity === 'day' ? 'day' : granularity;

  const set = (edge: 'from' | 'to', value: Dayjs | null) => {
    if (!value || !value.isValid()) return;
    const date = (edge === 'from' ? value.startOf(unit) : value.endOf(unit)).format(ISO);
    const next = { from, to, [edge]: date };
    // Keep the span the right way round.
    if (next.from && next.to && next.from > next.to) {
      if (edge === 'from') next.to = value.endOf(unit).format(ISO);
      else next.from = value.startOf(unit).format(ISO);
    }
    onChange({ range: 'custom', ...next });
  };

  const pickYear = (year: number) =>
    onChange({ range: 'custom', granularity: 'year', from: `${year}-01-01`, to: `${year}-12-31` });

  const picker = (edge: 'from' | 'to', label: string) => (
    <DatePicker
      label={label}
      views={VIEWS[granularity]}
      openTo={granularity === 'day' ? 'day' : granularity}
      format={FORMAT[granularity]}
      value={(edge === 'from' ? from : to) ? dayjs(edge === 'from' ? from : to) : null}
      onChange={(value) => set(edge, value)}
      disableFuture
      slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ width: 220 }}>
          <SegmentedControl
            aria-label="Pick dates by"
            value={granularity}
            onChange={(g) => onChange({ granularity: g })}
            options={[
              { value: 'year', label: 'Year', color: tokens.volt },
              { value: 'month', label: 'Month', color: tokens.volt },
              { value: 'day', label: 'Day', color: tokens.volt },
            ]}
          />
        </Box>
        {picker('from', 'From')}
        {picker('to', 'To')}
      </Box>
      {years && years.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {years.map((year) => {
            const selected =
              filter.range === 'custom' && from === `${year}-01-01` && to === `${year}-12-31`;
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
