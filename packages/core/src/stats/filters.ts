import type { ActivitySport } from '../activities/types';
import type { StatsActivity } from './statsActivity';

export type DateGranularity = 'year' | 'month' | 'day';

export type RangePreset = '4w' | '3m' | '12m' | 'ytd' | 'lastYear' | 'all' | 'custom';

export interface StatsFilter {
  range: RangePreset;
  /** Local dates (YYYY-MM-DD), inclusive — used when range is 'custom'. */
  from?: string;
  to?: string;
  /** How the custom dates are picked — whole years, whole months or single days (UI only). */
  granularity?: DateGranularity;
  /** 'app' = recorded with RunnerApp (alone or linked), 'watch' = watch-only runs. */
  source: 'all' | 'app' | 'watch';
  /** Empty = every sport. */
  sports: ActivitySport[];
  minKm?: number;
  maxKm?: number;
  /** Matched against the program / activity name, case-insensitively. */
  query?: string;
}

export const DEFAULT_STATS_FILTER: StatsFilter = { range: '12m', source: 'all', sports: [] };

const DAY_MS = 86_400_000;

function startOfLocalDay(localMs: number): number {
  return Math.floor(localMs / DAY_MS) * DAY_MS;
}

/**
 * The filter's span as local-time ms ([from, to), comparable with StatsActivity.localMs).
 * `nowLocalMs` is "now" in the same local encoding. Undefined bounds are open.
 */
export function resolveRange(
  filter: StatsFilter,
  nowLocalMs: number
): { fromMs?: number; toMs?: number } {
  const today = startOfLocalDay(nowLocalMs);
  const year = new Date(nowLocalMs).getUTCFullYear();
  switch (filter.range) {
    case '4w':
      return { fromMs: today - 27 * DAY_MS };
    case '3m':
      return {
        fromMs: Date.UTC(
          year,
          new Date(nowLocalMs).getUTCMonth() - 3,
          new Date(nowLocalMs).getUTCDate()
        ),
      };
    case '12m':
      return {
        fromMs: Date.UTC(
          year - 1,
          new Date(nowLocalMs).getUTCMonth(),
          new Date(nowLocalMs).getUTCDate()
        ),
      };
    case 'ytd':
      return { fromMs: Date.UTC(year, 0, 1) };
    case 'lastYear':
      return { fromMs: Date.UTC(year - 1, 0, 1), toMs: Date.UTC(year, 0, 1) };
    case 'custom': {
      const from = filter.from ? Date.parse(`${filter.from}T00:00:00Z`) : NaN;
      const to = filter.to ? Date.parse(`${filter.to}T00:00:00Z`) : NaN;
      return {
        fromMs: Number.isFinite(from) ? from : undefined,
        toMs: Number.isFinite(to) ? to + DAY_MS : undefined,
      };
    }
    default:
      return {};
  }
}

export function applyFilter(
  activities: readonly StatsActivity[],
  filter: StatsFilter,
  nowLocalMs: number
): StatsActivity[] {
  const { fromMs, toMs } = resolveRange(filter, nowLocalMs);
  const query = filter.query?.trim().toLowerCase();
  return activities.filter((a) => {
    if (fromMs !== undefined && a.localMs < fromMs) return false;
    if (toMs !== undefined && a.localMs >= toMs) return false;
    if (filter.source === 'app' && a.source === 'watch') return false;
    if (filter.source === 'watch' && a.source !== 'watch') return false;
    if (filter.sports.length > 0 && !filter.sports.includes(a.sport)) return false;
    const km = a.distanceM / 1000;
    if (filter.minKm !== undefined && km < filter.minKm) return false;
    if (filter.maxKm !== undefined && km > filter.maxKm) return false;
    if (query && !`${a.programName ?? ''} ${a.name ?? ''}`.toLowerCase().includes(query))
      return false;
    return true;
  });
}
