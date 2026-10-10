'use client';

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DAY_MS, dailyDistance, startOfDay, startOfWeek, type StatsActivity } from '@runner/core';
import { formatLocalDate, heatColors } from '../charts/chartSetup';
import { tokens } from '../theme';

const WEEKS = 53;
/** Upper bounds (km) of heat levels 1–4; above the last is level 5. */
const LEVELS = [5, 10, 15, 21];

/** The last year as a GitHub-style grid: a column per week, a cell per day, shaded by kilometres. */
export default function CalendarHeatmap({
  list,
  nowLocalMs,
}: Readonly<{ list: StatsActivity[]; nowLocalMs: number }>) {
  const { weeks, months } = useMemo(() => {
    const perDay = dailyDistance(list);
    const today = startOfDay(nowLocalMs);
    const firstWeek = startOfWeek(today) - (WEEKS - 1) * 7 * DAY_MS;
    const weeks = Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = firstWeek + (w * 7 + d) * DAY_MS;
        return { day, km: perDay.get(day) ?? 0, future: day > today };
      })
    );
    const months = weeks.map((week, i) => {
      const month = new Date(week[0].day).getUTCMonth();
      return i === 0 || new Date(weeks[i - 1][0].day).getUTCMonth() !== month
        ? formatLocalDate(week[0].day, { month: 'short' })
        : '';
    });
    return { weeks, months };
  }, [list, nowLocalMs]);

  const level = (value: number) =>
    value <= 0 ? 0 : LEVELS.findIndex((bound) => value < bound) + 1 || 5;

  return (
    <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
      <Box
        sx={{
          display: 'inline-grid',
          gridAutoFlow: 'column',
          gridTemplateRows: 'auto repeat(7, 11px)',
          gap: '2px',
        }}
      >
        {weeks.map((week, w) => [
          <Typography
            key={`m${w}`}
            sx={{
              fontSize: '0.6rem',
              color: tokens.textMuted,
              height: 14,
              whiteSpace: 'nowrap',
              width: 11,
              overflow: 'visible',
            }}
          >
            {months[w]}
          </Typography>,
          ...week.map((cell) => (
            <Box
              key={cell.day}
              title={`${formatLocalDate(cell.day, { dateStyle: 'medium' })}: ${cell.km > 0 ? `${cell.km.toFixed(1)} km` : 'no run'}`}
              sx={{
                width: 11,
                height: 11,
                borderRadius: '3px',
                bgcolor: cell.future ? 'transparent' : heatColors[level(cell.km)],
              }}
            />
          )),
        ])}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          mt: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Typography sx={{ fontSize: '0.65rem', color: tokens.textMuted, mr: 0.5 }}>0 km</Typography>
        {heatColors.map((color) => (
          <Box key={color} sx={{ width: 11, height: 11, borderRadius: '3px', bgcolor: color }} />
        ))}
        <Typography sx={{ fontSize: '0.65rem', color: tokens.textMuted, ml: 0.5 }}>
          21+ km
        </Typography>
      </Box>
    </Box>
  );
}
