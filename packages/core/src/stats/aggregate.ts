import {
  DAY_MS,
  dayOfYear,
  nextPeriod,
  startOfDay,
  startOfPeriod,
  startOfWeek,
  type Period,
} from './calendar';
import type { StatsActivity } from './statsActivity';

export interface Totals {
  count: number;
  distanceM: number;
  movingS: number;
  elevGainM: number;
  /** Seconds per km over everything; undefined without distance. */
  paceSPerKm?: number;
  /** Time-weighted over runs with heart rate. */
  avgHr?: number;
  longest?: StatsActivity;
  calories: number;
}

export function totals(list: readonly StatsActivity[]): Totals {
  let distanceM = 0;
  let movingS = 0;
  let elevGainM = 0;
  let calories = 0;
  let hrWeighted = 0;
  let hrSeconds = 0;
  let longest: StatsActivity | undefined;
  for (const a of list) {
    distanceM += a.distanceM;
    movingS += a.movingS;
    elevGainM += a.elevGainM ?? 0;
    calories += a.calories ?? 0;
    if (a.avgHr) {
      hrWeighted += a.avgHr * a.movingS;
      hrSeconds += a.movingS;
    }
    if (!longest || a.distanceM > longest.distanceM) longest = a;
  }
  return {
    count: list.length,
    distanceM,
    movingS,
    elevGainM,
    paceSPerKm: distanceM > 0 ? movingS / (distanceM / 1000) : undefined,
    avgHr: hrSeconds > 0 ? hrWeighted / hrSeconds : undefined,
    longest,
    calories,
  };
}

export interface PeriodBucket {
  /** Local ms of the period start. */
  start: number;
  count: number;
  distanceM: number;
  movingS: number;
  elevGainM: number;
  longestM: number;
}

/**
 * Totals per calendar week/month/year, oldest first, including empty periods in between (a gap
 * in training should show as a gap). `fromMs`/`toMs` (local ms) extend the span to the filter's
 * range so a quiet start or end still shows.
 */
export function byPeriod(
  list: readonly StatsActivity[],
  period: Period,
  span: { fromMs?: number; toMs?: number } = {}
): PeriodBucket[] {
  if (list.length === 0 && (span.fromMs === undefined || span.toMs === undefined)) return [];
  const starts = list.map((a) => a.localMs);
  const first = startOfPeriod(Math.min(...starts, span.fromMs ?? Infinity), period);
  const last = startOfPeriod(Math.max(...starts, (span.toMs ?? -Infinity) - 1), period);
  const buckets = new Map<number, PeriodBucket>();
  for (let start = first; start <= last; start = nextPeriod(start, period)) {
    buckets.set(start, { start, count: 0, distanceM: 0, movingS: 0, elevGainM: 0, longestM: 0 });
  }
  for (const a of list) {
    const bucket = buckets.get(startOfPeriod(a.localMs, period));
    if (!bucket) continue;
    bucket.count++;
    bucket.distanceM += a.distanceM;
    bucket.movingS += a.movingS;
    bucket.elevGainM += a.elevGainM ?? 0;
    bucket.longestM = Math.max(bucket.longestM, a.distanceM);
  }
  return [...buckets.values()];
}

/**
 * Cumulative distance (km) through each day of each year — the "am I ahead of last year"
 * chart. `year → km[dayOfYear]`; the current year stops at `untilLocalMs`.
 */
export function cumulativeByYear(
  list: readonly StatsActivity[],
  untilLocalMs: number
): Map<number, number[]> {
  const perDay = new Map<number, Map<number, number>>();
  for (const a of list) {
    const year = new Date(a.localMs).getUTCFullYear();
    const days = perDay.get(year) ?? new Map<number, number>();
    const day = dayOfYear(a.localMs);
    days.set(day, (days.get(day) ?? 0) + a.distanceM / 1000);
    perDay.set(year, days);
  }
  const nowYear = new Date(untilLocalMs).getUTCFullYear();
  const result = new Map<number, number[]>();
  for (const [year, days] of [...perDay.entries()].sort(([a], [b]) => a - b)) {
    const length =
      year === nowYear
        ? dayOfYear(untilLocalMs) + 1
        : (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
    let sum = 0;
    result.set(
      year,
      Array.from({ length }, (_, d) => {
        sum += days.get(d) ?? 0;
        return Math.round(sum * 10) / 10;
      })
    );
  }
  return result;
}

/** Consecutive ISO weeks with at least one run: the current streak (counting this week if it has a run, or ending last week) and the longest ever. */
export function weekStreaks(
  list: readonly StatsActivity[],
  nowLocalMs: number
): { current: number; longest: number } {
  const weeks = new Set(list.map((a) => startOfWeek(a.localMs)));
  const sorted = [...weeks].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | undefined;
  for (const w of sorted) {
    run = prev !== undefined && w - prev === 7 * DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }
  let current = 0;
  let week = startOfWeek(nowLocalMs);
  if (!weeks.has(week)) week -= 7 * DAY_MS;
  while (weeks.has(week)) {
    current++;
    week -= 7 * DAY_MS;
  }
  return { current, longest };
}

/** Runs and km per day of the week, Monday first. */
export function byWeekday(list: readonly StatsActivity[]): { count: number; distanceM: number }[] {
  const result = Array.from({ length: 7 }, () => ({ count: 0, distanceM: 0 }));
  for (const a of list) {
    const day = (new Date(a.localMs).getUTCDay() + 6) % 7;
    result[day].count++;
    result[day].distanceM += a.distanceM;
  }
  return result;
}

/** Runs started in each hour of the day (0–23, local time). */
export function byHour(list: readonly StatsActivity[]): number[] {
  const result = Array<number>(24).fill(0);
  for (const a of list) result[new Date(a.localMs).getUTCHours()]++;
  return result;
}

/** Runs per distance band: [0,5), [5,10), … up to `maxKm`+ in steps of `stepKm`. */
export function distanceHistogram(
  list: readonly StatsActivity[],
  stepKm = 2,
  maxKm = 30
): { fromKm: number; count: number }[] {
  const bins = Array.from({ length: Math.ceil(maxKm / stepKm) + 1 }, (_, i) => ({
    fromKm: i * stepKm,
    count: 0,
  }));
  for (const a of list) {
    const i = Math.min(bins.length - 1, Math.floor(a.distanceM / 1000 / stepKm));
    bins[i].count++;
  }
  return bins;
}

/** Kilometres per local day, for the calendar heatmap. */
export function dailyDistance(list: readonly StatsActivity[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const a of list) {
    const day = startOfDay(a.localMs);
    result.set(day, (result.get(day) ?? 0) + a.distanceM / 1000);
  }
  return result;
}

/** Trailing mean of `value` over the previous `windowDays` (inclusive), evaluated at each point. */
export function rollingMean(
  points: readonly { x: number; y: number }[],
  windowDays: number
): { x: number; y: number }[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const result: { x: number; y: number }[] = [];
  let start = 0;
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].y;
    while (sorted[i].x - sorted[start].x > windowDays * DAY_MS) sum -= sorted[start++].y;
    result.push({ x: sorted[i].x, y: sum / (i - start + 1) });
  }
  return result;
}
