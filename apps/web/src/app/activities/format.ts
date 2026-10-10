import { Timespan, type ActivitySport, type EffortKey } from '@runner/core';

export const sportLabel: Record<ActivitySport, string> = {
  run: 'Outdoor run',
  treadmill: 'Treadmill run',
  trail: 'Trail run',
  track: 'Track run',
  indoor: 'Indoor run',
};

export const effortLabel: Record<EffortKey, string> = {
  '400m': '400 m',
  '1k': '1 km',
  '1mi': '1 mile',
  '5k': '5 km',
  '10k': '10 km',
  hm: 'Half marathon',
  m: 'Marathon',
};

/** mm:ss under an hour, h:mm:ss above. */
export function formatDuration(seconds: number): string {
  return Timespan.fromSeconds(Math.round(seconds)).toString(seconds < 3600 ? 'mm:ss' : 'hh:mm:ss');
}

/** Pace in min/km for a distance covered in a time; '—' when there's no distance. */
export function formatPace(seconds: number, metres: number): string {
  if (!(metres > 10) || !(seconds > 0)) return '—';
  return Timespan.fromSeconds(Math.round((seconds * 1000) / metres)).toString('mm:ss');
}

export function formatKm(metres: number, digits = 2): string {
  return (metres / 1000).toFixed(digits);
}

/** Garmin Connect's page for an activity. */
export function garminConnectUrl(garminId: string): string {
  return `https://connect.garmin.com/modern/activity/${garminId}`;
}

export function intervalsUrl(intervalsId: string): string {
  return `https://intervals.icu/activities/${intervalsId}`;
}
