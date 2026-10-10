'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import {
  ACTIVITY_SPORTS,
  byHour,
  byPeriod,
  byWeekday,
  cumulativeByYear,
  DAY_MS,
  distanceHistogram,
  effectiveVo2max,
  rollingMean,
  trainingLoad,
  zoneSeconds,
  type HrAnchors,
  type Period,
  type StatsActivity,
} from '@runner/core';
import {
  contextColor,
  formatLocalDate,
  seriesColors,
  trendColor,
  zoneColors,
} from '../charts/chartSetup';
import ChartCard from '../base/ChartCard';
import SegmentedControl from '../base/SegmentedControl';
import { sportLabel } from '../activities/format';
import { tokens } from '../theme';
import { BarChart, TimeChart, type TimeSeries } from './charts';
import { hoursMinutes, mmss, paceOf } from './format';

type PanelProps = Readonly<{ list: StatsActivity[]; index: number; deferIndex: number }>;

const PERIOD_FORMAT: Record<Period, Intl.DateTimeFormatOptions> = {
  week: { day: 'numeric', month: 'short' },
  month: { month: 'short', year: '2-digit' },
  year: { year: 'numeric' },
};

const kmLabel = (v: number) => `${v.toFixed(1)} km`;
const wholeKmLabel = (v: number) => `${Math.round(v)} km`;

/** Distance per week / month / year, with run counts and time in the tooltip. */
export function VolumePanel({
  list,
  span,
  index,
  deferIndex,
}: PanelProps & Readonly<{ span: { fromMs?: number; toMs?: number } }>) {
  const [period, setPeriod] = useState<Period>('week');
  const buckets = useMemo(() => byPeriod(list, period, span), [list, period, span]);
  const labels = useMemo(
    () => buckets.map((b) => formatLocalDate(b.start, PERIOD_FORMAT[period])),
    [buckets, period]
  );
  const series = useMemo(
    () => [
      { label: 'Distance', color: seriesColors[0], values: buckets.map((b) => b.distanceM / 1000) },
    ],
    [buckets]
  );
  const footer = useMemo(
    () => (i: number) => [`${buckets[i].count} runs · ${hoursMinutes(buckets[i].movingS)}`],
    [buckets]
  );
  return (
    <ChartCard title="Distance" wide index={index} deferIndex={deferIndex} height={300}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <SegmentedControl
          aria-label="Group by"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: 'Week', color: tokens.cyan },
            { value: 'month', label: 'Month', color: tokens.cyan },
            { value: 'year', label: 'Year', color: tokens.cyan },
          ]}
        />
      </Box>
      <Box sx={{ height: 240 }}>
        <BarChart
          labels={labels}
          series={series}
          yTitle="km"
          formatValue={kmLabel}
          tooltipFooter={footer}
        />
      </Box>
    </ChartCard>
  );
}

/** Cumulative kilometres through the year, this year emphasised against the previous ones. */
export function YearComparePanel({
  list,
  nowLocalMs,
  index,
  deferIndex,
}: PanelProps & Readonly<{ nowLocalMs: number }>) {
  const series = useMemo((): TimeSeries[] => {
    const years = [...cumulativeByYear(list, nowLocalMs).entries()].slice(-5);
    const current = new Date(nowLocalMs).getUTCFullYear();
    // x = the day in the current year, so every year shares one Jan–Dec axis.
    return years.map(([year, days]) => ({
      label: String(year),
      color: year === current ? seriesColors[0] : contextColor,
      kind: 'line',
      area: year === current,
      dashed: year !== current && year !== current - 1,
      points: days.map((value, d) => ({ x: Date.UTC(current, 0, 1) + d * DAY_MS, y: value })),
    }));
  }, [list, nowLocalMs]);
  if (series.length === 0) return null;
  return (
    <ChartCard title="Year to date" index={index} deferIndex={deferIndex}>
      <TimeChart
        series={series}
        yTitle="km"
        formatY={wholeKmLabel}
        xFormat={{ month: 'short' }}
        tooltipTitle={dayMonth}
        beginAtZero
      />
    </ChartCard>
  );
}
const dayMonth = (x: number) => formatLocalDate(x, { day: 'numeric', month: 'long' });

/**
 * Paces this chart believes: a few hundred metres, or a pace slower than walking, is a recording
 * left running or started by accident — one such point stretched the axis to 80 min/km and dragged
 * the rolling average with it.
 */
const PACE_MIN_DISTANCE_M = 500;
const PACE_SLOWEST_S_PER_KM = 15 * 60;
const PACE_FASTEST_S_PER_KM = 2.5 * 60;
const hasPlausiblePace = (a: StatsActivity) => {
  const pace = paceOf(a);
  return (
    a.distanceM >= PACE_MIN_DISTANCE_M &&
    pace >= PACE_FASTEST_S_PER_KM &&
    pace <= PACE_SLOWEST_S_PER_KM
  );
};

/** Every run's pace over time, treadmill vs outside, with a 4-week rolling average. */
export function PacePanel({ list: all, index, deferIndex }: PanelProps) {
  const series = useMemo((): TimeSeries[] => {
    const list = all.filter(hasPlausiblePace);
    const point = (a: StatsActivity) => ({ x: a.localMs, y: paceOf(a) });
    const indoor = list.filter((a) => a.sport === 'treadmill' || a.sport === 'indoor');
    const outdoor = list.filter((a) => a.sport !== 'treadmill' && a.sport !== 'indoor');
    const result: TimeSeries[] = [];
    if (indoor.length)
      result.push({
        label: 'Treadmill',
        color: seriesColors[0],
        kind: 'points',
        points: indoor.map(point),
      });
    if (outdoor.length)
      result.push({
        label: 'Outside',
        color: seriesColors[1],
        kind: 'points',
        points: outdoor.map(point),
      });
    if (list.length > 2) {
      result.push({
        label: '4-week average',
        color: trendColor,
        kind: 'line',
        points: rollingMean(list.map(point), 28),
      });
    }
    return result;
  }, [all]);
  return (
    <ChartCard title="Pace" index={index} deferIndex={deferIndex}>
      <TimeChart series={series} yTitle="min/km" formatY={mmss} yStep={60} reverse />
    </ChartCard>
  );
}

/**
 * Fitness from heart rate: each steady run's effective VO2max (pace cost ÷ heart-rate reserve
 * used, see predictions.ts) and its 6-week rolling average — rising means the same heart rate
 * buys a faster pace.
 */
export function FitnessPanel({
  list,
  hr,
  index,
  deferIndex,
}: PanelProps & Readonly<{ hr?: HrAnchors }>) {
  const series = useMemo((): TimeSeries[] => {
    if (!hr) return [];
    const points = list.flatMap((a) => {
      const v = effectiveVo2max(a, hr);
      return v !== undefined && v > 20 && v < 90 ? [{ x: a.localMs, y: v }] : [];
    });
    if (points.length === 0) return [];
    return [
      { label: 'Run', color: seriesColors[0], kind: 'points', points },
      {
        label: '6-week average',
        color: trendColor,
        kind: 'line',
        points: rollingMean(points, 42),
      },
    ];
  }, [list, hr]);
  if (series.length === 0) return null;
  return (
    <ChartCard title="Fitness (VO₂max from heart rate)" index={index} deferIndex={deferIndex}>
      <TimeChart series={series} yTitle="ml/kg/min" />
    </ChartCard>
  );
}

/** Hours in each heart-rate zone per month. */
export function ZonesPanel({
  list,
  hr,
  index,
  deferIndex,
}: PanelProps & Readonly<{ hr?: HrAnchors }>) {
  const data = useMemo(() => {
    if (!hr) return null;
    const months = byPeriod(list, 'month');
    if (months.length === 0) return null;
    const perMonth = new Map(months.map((m) => [m.start, [0, 0, 0, 0, 0]]));
    for (const a of list) {
      const d = new Date(a.localMs);
      const zones = perMonth.get(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      if (!zones) continue;
      zoneSeconds(a.hrHist, hr.maxHr).forEach((s, z) => (zones[z] += s / 3600));
    }
    if ([...perMonth.values()].every((z) => z.every((v) => v === 0))) return null;
    return {
      labels: months.map((m) => formatLocalDate(m.start, PERIOD_FORMAT.month)),
      series: ['Z1 easy', 'Z2 aerobic', 'Z3 tempo', 'Z4 threshold', 'Z5 max'].map((label, z) => ({
        label,
        color: zoneColors[z],
        values: months.map((m) => perMonth.get(m.start)![z]),
      })),
    };
  }, [list, hr]);
  if (!data) return null;
  return (
    <ChartCard title="Heart-rate zones" index={index} deferIndex={deferIndex}>
      <BarChart
        labels={data.labels}
        series={data.series}
        yTitle="hours"
        stacked
        formatValue={hoursLabel}
      />
    </ChartCard>
  );
}
const hoursLabel = (h: number) => hoursMinutes(h * 3600);

/** Fitness / fatigue / form from heart-rate training load (TRIMP), daily. */
export function LoadPanel({
  list,
  all,
  hr,
  span,
  nowLocalMs,
  index,
  deferIndex,
}: PanelProps &
  Readonly<{
    all: StatsActivity[];
    hr?: HrAnchors;
    span: { fromMs?: number; toMs?: number };
    nowLocalMs: number;
  }>) {
  const series = useMemo((): TimeSeries[] => {
    if (!hr || list.length === 0) return [];
    // Load builds up from all history, then the filtered span is shown (sources/sports still apply).
    const keys = new Set(list.map((a) => a.key));
    const sameKind = all.filter((a) => keys.has(a.key) || a.localMs < (span.fromMs ?? -Infinity));
    const points = trainingLoad(sameKind, hr, Math.min(span.toMs ?? Infinity, nowLocalMs)).filter(
      (p) => span.fromMs === undefined || p.day >= span.fromMs
    );
    if (points.every((p) => p.load === 0)) return [];
    return [
      {
        label: 'Fitness (CTL)',
        color: seriesColors[0],
        kind: 'line',
        points: points.map((p) => ({ x: p.day, y: p.ctl })),
      },
      {
        label: 'Fatigue (ATL)',
        color: seriesColors[1],
        kind: 'line',
        points: points.map((p) => ({ x: p.day, y: p.atl })),
      },
      {
        label: 'Form (TSB)',
        color: seriesColors[2],
        kind: 'line',
        points: points.map((p) => ({ x: p.day, y: p.tsb })),
      },
    ];
  }, [list, all, hr, span, nowLocalMs]);
  if (series.length === 0) return null;
  return (
    <ChartCard title="Training load" wide index={index} deferIndex={deferIndex}>
      <TimeChart series={series} yTitle="TRIMP / day" />
    </ChartCard>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekdayPanel({ list, index, deferIndex }: PanelProps) {
  const series = useMemo(
    () => [
      {
        label: 'Distance',
        color: seriesColors[0],
        values: byWeekday(list).map((d) => d.distanceM / 1000),
      },
    ],
    [list]
  );
  return (
    <ChartCard title="Day of the week" index={index} deferIndex={deferIndex} height={220}>
      <BarChart labels={WEEKDAYS} series={series} yTitle="km" formatValue={kmLabel} />
    </ChartCard>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h));

export function HourPanel({ list, index, deferIndex }: PanelProps) {
  const series = useMemo(
    () => [{ label: 'Runs', color: seriesColors[0], values: byHour(list) }],
    [list]
  );
  return (
    <ChartCard title="Time of day" index={index} deferIndex={deferIndex} height={220}>
      <BarChart labels={HOURS} series={series} yTitle="runs" formatValue={runsLabel} />
    </ChartCard>
  );
}
const runsLabel = (v: number) => `${v} ${v === 1 ? 'run' : 'runs'}`;

export function DistanceHistogramPanel({ list, index, deferIndex }: PanelProps) {
  const data = useMemo(() => {
    const bins = distanceHistogram(list, 2, 30);
    return {
      labels: bins.map((b, i) =>
        i === bins.length - 1 ? `${b.fromKm}+` : `${b.fromKm}–${b.fromKm + 2}`
      ),
      series: [{ label: 'Runs', color: seriesColors[0], values: bins.map((b) => b.count) }],
    };
  }, [list]);
  return (
    <ChartCard title="Run distances" index={index} deferIndex={deferIndex} height={220}>
      <BarChart labels={data.labels} series={data.series} yTitle="runs" formatValue={runsLabel} />
    </ChartCard>
  );
}

/** Kilometres per kind of run. */
export function SportPanel({ list, index, deferIndex }: PanelProps) {
  const data = useMemo(() => {
    const present = ACTIVITY_SPORTS.filter((s) => list.some((a) => a.sport === s));
    return {
      labels: present.map((s) => sportLabel[s]),
      series: [
        {
          label: 'Distance',
          color: seriesColors[0],
          values: present.map(
            (s) => list.filter((a) => a.sport === s).reduce((sum, a) => sum + a.distanceM, 0) / 1000
          ),
        },
      ],
    };
  }, [list]);
  if (data.labels.length < 2) return null;
  return (
    <ChartCard title="Where you run" index={index} deferIndex={deferIndex} height={220}>
      <BarChart labels={data.labels} series={data.series} yTitle="km" formatValue={kmLabel} />
    </ChartCard>
  );
}

export function LongestRunPanel({
  list,
  span,
  index,
  deferIndex,
}: PanelProps & Readonly<{ span: { fromMs?: number; toMs?: number } }>) {
  const data = useMemo(() => {
    const weeks = byPeriod(list, 'week', span);
    return {
      labels: weeks.map((w) => formatLocalDate(w.start, PERIOD_FORMAT.week)),
      series: [
        {
          label: 'Longest run',
          color: seriesColors[0],
          values: weeks.map((w) => w.longestM / 1000),
        },
      ],
    };
  }, [list, span]);
  return (
    <ChartCard title="Longest run each week" index={index} deferIndex={deferIndex}>
      <BarChart labels={data.labels} series={data.series} yTitle="km" formatValue={kmLabel} />
    </ChartCard>
  );
}

export function CadencePanel({ list, index, deferIndex }: PanelProps) {
  const series = useMemo((): TimeSeries[] => {
    const points = list.flatMap((a) => (a.cadenceSpm ? [{ x: a.localMs, y: a.cadenceSpm }] : []));
    if (points.length === 0) return [];
    return [
      { label: 'Run', color: seriesColors[2], kind: 'points', points },
      {
        label: '4-week average',
        color: trendColor,
        kind: 'line',
        points: rollingMean(points, 28),
      },
    ];
  }, [list]);
  if (series.length === 0) return null;
  return (
    <ChartCard title="Cadence" index={index} deferIndex={deferIndex}>
      <TimeChart series={series} yTitle="steps/min" formatY={roundLabel} />
    </ChartCard>
  );
}
const roundLabel = (v: number) => String(Math.round(v));

export function ElevationPanel({ list, index, deferIndex }: PanelProps) {
  const data = useMemo(() => {
    const months = byPeriod(list, 'month');
    return {
      labels: months.map((m) => formatLocalDate(m.start, PERIOD_FORMAT.month)),
      series: [
        { label: 'Elevation', color: seriesColors[0], values: months.map((m) => m.elevGainM) },
      ],
    };
  }, [list]);
  if (data.series[0].values.every((v) => v === 0)) return null;
  return (
    <ChartCard title="Elevation gain" index={index} deferIndex={deferIndex}>
      <BarChart labels={data.labels} series={data.series} yTitle="m" formatValue={metresLabel} />
    </ChartCard>
  );
}
const metresLabel = (v: number) => `${Math.round(v)} m`;

/** RunnerApp's heart-rate-controlled runs: share of time within ±5 bpm of the target, per speed controller. */
export function AdherencePanel({ list, index, deferIndex }: PanelProps) {
  const series = useMemo((): TimeSeries[] => {
    const runs = list.filter((a) => a.pctInTarget !== undefined);
    const point = (a: StatsActivity) => ({ x: a.localMs, y: a.pctInTarget! });
    const adaptive = runs.filter((a) => a.controller === 'adaptive');
    const legacy = runs.filter((a) => a.controller !== 'adaptive');
    const result: TimeSeries[] = [];
    if (adaptive.length)
      result.push({
        label: 'Adaptive',
        color: seriesColors[0],
        kind: 'points',
        points: adaptive.map(point),
      });
    if (legacy.length)
      result.push({
        label: 'Legacy',
        color: seriesColors[1],
        kind: 'points',
        points: legacy.map(point),
      });
    return result;
  }, [list]);
  if (series.length === 0) return null;
  return (
    <ChartCard title="Heart rate in target" index={index} deferIndex={deferIndex}>
      <TimeChart series={series} yTitle="% of time" formatY={percentLabel} beginAtZero />
    </ChartCard>
  );
}
const percentLabel = (v: number) => `${Math.round(v)}%`;
