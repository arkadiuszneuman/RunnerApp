import type { HrHistogram } from '../activities/types';
import { DAY_MS, startOfDay } from './calendar';
import type { HrAnchors } from './predictions';
import type { StatsActivity } from './statsActivity';

/**
 * Banister's TRIMP from a per-bpm histogram: minutes at each heart rate weighted by
 * HRr·0.64·e^(1.92·HRr), HRr being the fraction of heart-rate reserve.
 */
export function trimp(hist: HrHistogram | undefined, hr: HrAnchors): number {
  if (!hist || hr.maxHr <= hr.restingHr) return 0;
  let load = 0;
  hist.s.forEach((seconds, i) => {
    const hrr = Math.min(
      1,
      Math.max(0, (hist.start + i - hr.restingHr) / (hr.maxHr - hr.restingHr))
    );
    load += (seconds / 60) * hrr * 0.64 * Math.exp(1.92 * hrr);
  });
  return load;
}

export interface LoadPoint {
  /** Local day start. */
  day: number;
  /** That day's TRIMP. */
  load: number;
  /** Chronic training load ("fitness"), 42-day exponentially weighted. */
  ctl: number;
  /** Acute training load ("fatigue"), 7-day. */
  atl: number;
  /** Training stress balance ("form"): yesterday's CTL − ATL. */
  tsb: number;
}

/** Daily fitness/fatigue/form from the first run (or `fromLocalMs`) to `untilLocalMs`. */
export function trainingLoad(
  list: readonly StatsActivity[],
  hr: HrAnchors,
  untilLocalMs: number,
  fromLocalMs?: number
): LoadPoint[] {
  if (list.length === 0) return [];
  const daily = new Map<number, number>();
  for (const a of list) {
    const day = startOfDay(a.localMs);
    daily.set(day, (daily.get(day) ?? 0) + trimp(a.hrHist, hr));
  }
  const first = startOfDay(fromLocalMs ?? Math.min(...list.map((a) => a.localMs)));
  const last = startOfDay(untilLocalMs);
  const points: LoadPoint[] = [];
  let ctl = 0;
  let atl = 0;
  for (let day = first; day <= last; day += DAY_MS) {
    const load = daily.get(day) ?? 0;
    const tsb = ctl - atl;
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
    points.push({ day, load, ctl, atl, tsb });
  }
  return points;
}

/** Five zones by % of max HR (50–60, 60–70, 70–80, 80–90, 90–100 %); below 50 % counts into zone 1. */
export const ZONE_BOUNDS = [0.6, 0.7, 0.8, 0.9];

export function zoneSeconds(hist: HrHistogram | undefined, maxHr: number): number[] {
  const zones = [0, 0, 0, 0, 0];
  if (!hist || maxHr <= 0) return zones;
  hist.s.forEach((seconds, i) => {
    const share = (hist.start + i) / maxHr;
    const zone = ZONE_BOUNDS.findIndex((bound) => share < bound);
    zones[zone === -1 ? 4 : zone] += seconds;
  });
  return zones;
}
