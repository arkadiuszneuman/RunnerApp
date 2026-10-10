import { EFFORT_KEYS, type EffortKey } from '../activities/types';
import type { StatsActivity } from './statsActivity';

export interface PersonalRecord {
  key: EffortKey;
  seconds: number;
  activity: StatsActivity;
}

/** The fastest time at each standard distance across the given runs. */
export function personalRecords(list: readonly StatsActivity[]): PersonalRecord[] {
  const best = new Map<EffortKey, PersonalRecord>();
  for (const activity of list) {
    for (const key of EFFORT_KEYS) {
      const seconds = activity.bestEfforts[key];
      if (seconds === undefined) continue;
      const current = best.get(key);
      if (!current || seconds < current.seconds) best.set(key, { key, seconds, activity });
    }
  }
  return EFFORT_KEYS.flatMap((key) => (best.has(key) ? [best.get(key)!] : []));
}
