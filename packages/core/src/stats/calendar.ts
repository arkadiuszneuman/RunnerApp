/** Calendar helpers on "local ms" (local wall-clock time encoded as UTC — see StatsActivity.localMs). */

export const DAY_MS = 86_400_000;

export type Period = 'week' | 'month' | 'year';

export function startOfDay(localMs: number): number {
  return Math.floor(localMs / DAY_MS) * DAY_MS;
}

/** Monday 00:00 of the ISO week containing the instant. */
export function startOfWeek(localMs: number): number {
  const day = startOfDay(localMs);
  const weekday = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  return day - weekday * DAY_MS;
}

export function startOfMonth(localMs: number): number {
  const d = new Date(localMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function startOfYear(localMs: number): number {
  return Date.UTC(new Date(localMs).getUTCFullYear(), 0, 1);
}

export function startOfPeriod(localMs: number, period: Period): number {
  if (period === 'week') return startOfWeek(localMs);
  if (period === 'month') return startOfMonth(localMs);
  return startOfYear(localMs);
}

export function nextPeriod(start: number, period: Period): number {
  if (period === 'week') return start + 7 * DAY_MS;
  const d = new Date(start);
  return period === 'month'
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    : Date.UTC(d.getUTCFullYear() + 1, 0, 1);
}

/** 0-based day of the year. */
export function dayOfYear(localMs: number): number {
  return Math.floor((startOfDay(localMs) - startOfYear(localMs)) / DAY_MS);
}

/** Converts a real instant to local ms for a given UTC offset (minutes east). */
export function toLocalMs(ms: number, tzOffsetMin: number): number {
  return ms + tzOffsetMin * 60_000;
}
