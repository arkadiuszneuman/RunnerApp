import { DAY_MS, type StatsActivity } from '@runner/core';

/** m:ss from seconds (pace per km, or a short duration). */
export function mmss(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** h:mm:ss above an hour, m:ss below. */
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 3600) return mmss(s);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** "123 h 45 min" for a total time. */
export function hoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export const km = (metres: number, digits = 1) => (metres / 1000).toFixed(digits);

export const paceOf = (a: StatsActivity) => a.movingS / (a.distanceM / 1000);

export { DAY_MS };
