'use client';

import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import {
  ACTIVITY_SPORTS,
  DEFAULT_STATS_FILTER,
  type RangePreset,
  type StatsFilter,
} from '@runner/core';
import { useAtom, type WritableAtom } from 'jotai';
import type { SetStateAction } from 'react';
import { sportLabel } from '../activities/format';
import DateRangeFields from './DateRangeFields';

const RANGES: { value: RangePreset; label: string }[] = [
  { value: '4w', label: 'Last 4 weeks' },
  { value: '3m', label: 'Last 3 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'This year' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom…' },
];

const SOURCES: { value: StatsFilter['source']; label: string }[] = [
  { value: 'all', label: 'All runs' },
  { value: 'app', label: 'RunnerApp' },
  { value: 'watch', label: 'Watch only' },
];

export const isDefaultFilter = (f: StatsFilter, defaults: StatsFilter = DEFAULT_STATS_FILTER) =>
  f.range === defaults.range &&
  f.source === 'all' &&
  f.sports.length === 0 &&
  f.minKm === undefined &&
  f.maxKm === undefined &&
  !f.query;

const parseKm = (text: string) => {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? undefined : value;
};

type FilterAtom = WritableAtom<StatsFilter, [SetStateAction<StatsFilter>], void>;

/** Run filters for History and Stats, each page with its own atom (see statsState.ts). */
export default function StatsFilterBar({
  atom,
  defaults = DEFAULT_STATS_FILTER,
  years,
  earliest,
}: Readonly<{
  atom: FilterAtom;
  defaults?: StatsFilter;
  years?: number[];
  /** The first activity's local date (YYYY-MM-DD): the earliest date the pickers offer. */
  earliest?: string;
}>) {
  const [filter, setFilter] = useAtom(atom);
  const update = (patch: Partial<StatsFilter>) => setFilter({ ...filter, ...patch });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Period"
          value={filter.range}
          onChange={(e) => update({ range: e.target.value as RangePreset })}
          sx={{ minWidth: 150 }}
        >
          {RANGES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Recorded by"
          value={filter.source}
          onChange={(e) => update({ source: e.target.value as StatsFilter['source'] })}
          sx={{ minWidth: 130 }}
        >
          {SOURCES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Min km"
          value={filter.minKm ?? ''}
          onChange={(e) => update({ minKm: parseKm(e.target.value) })}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ width: 84 }}
        />
        <TextField
          size="small"
          label="Max km"
          value={filter.maxKm ?? ''}
          onChange={(e) => update({ maxKm: parseKm(e.target.value) })}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ width: 84 }}
        />
        <TextField
          size="small"
          label="Search"
          placeholder="Program or name"
          value={filter.query ?? ''}
          onChange={(e) => update({ query: e.target.value || undefined })}
          sx={{ flex: 1, minWidth: 140 }}
        />
        {!isDefaultFilter(filter, defaults) && (
          <IconButton title="Clear filters" onClick={() => setFilter(defaults)} size="small">
            <FilterAltOffRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <DateRangeFields filter={filter} onChange={update} years={years} earliest={earliest} />
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {ACTIVITY_SPORTS.map((sport) => {
          const selected = filter.sports.includes(sport);
          return (
            <Chip
              key={sport}
              label={sportLabel[sport]}
              size="small"
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              onClick={() =>
                update({
                  sports: selected
                    ? filter.sports.filter((s) => s !== sport)
                    : [...filter.sports, sport],
                })
              }
            />
          );
        })}
      </Box>
    </Box>
  );
}
