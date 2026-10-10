import type { StatsActivity } from './statsActivity';

/** A minimal StatsActivity for tests (local time = UTC). */
export function activity(overrides: Partial<StatsActivity> & { startMs: number }): StatsActivity {
  return {
    key: `k${overrides.startMs}`,
    source: 'app',
    sport: 'treadmill',
    localMs: overrides.startMs,
    distanceM: 10_000,
    movingS: 3_000,
    bestEfforts: {},
    ...overrides,
  };
}
