import type { ActivitySport } from '@runner/core/src/activities/types';
import type { ImportCandidate } from '@/lib/activities/repo';
import type { IntervalsActivity } from './client';

/** intervals.icu activity types imported (everything else — rides, walks, gym — is ignored). */
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

/** Two recordings starting this close together are the same activity (see activities/repo.ts). */
const SAME_START_MS = 2000;

export function startMsOf(activity: IntervalsActivity): number | undefined {
  const ms = Date.parse(activity.start_date ?? '');
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Whether a listed activity should be imported: runs only, with a start time, and not ones that
 * reached intervals.icu from Strava — the API returns only an empty stub for those (Strava's terms),
 * so they're useless here; the user has to connect Garmin to intervals.icu directly.
 */
export function isImportable(activity: IntervalsActivity): boolean {
  return (
    RUN_TYPES.has(activity.type ?? '') &&
    activity.source !== 'STRAVA' &&
    activity.source !== 'MANUAL' &&
    startMsOf(activity) !== undefined
  );
}

export function sportOf(activity: IntervalsActivity): ActivitySport {
  if (activity.type === 'TrailRun') return 'trail';
  if (activity.type === 'VirtualRun') return 'indoor';
  return activity.trainer ? 'treadmill' : 'run';
}

/** What's already stored, as far as planning a sync is concerned (tombstones included). */
export type KnownActivity = { id: string; intervalsId: string | null; startMs: number };

export type SyncPlan = {
  /** To download and import, newest first. */
  download: IntervalsActivity[];
  /** Already stored (e.g. uploaded from a FIT file) — only needs its intervals.icu id recorded. */
  attach: { activityId: string; intervalsId: string }[];
};

/**
 * Decides what a sync pass has to do with the activities intervals.icu listed. Nothing is
 * remembered between passes: the pending set is recomputed from what's stored every time, which
 * makes syncing idempotent and resumable after a time-out, a rate limit or a crash.
 */
export function planSync(
  listed: readonly IntervalsActivity[],
  known: readonly KnownActivity[]
): SyncPlan {
  const knownIntervalsIds = new Set(
    known.map((k) => k.intervalsId).filter((id): id is string => !!id)
  );
  const unidentified = known.filter((k) => !k.intervalsId);
  const plan: SyncPlan = { download: [], attach: [] };
  for (const activity of listed) {
    if (!isImportable(activity) || knownIntervalsIds.has(activity.id)) continue;
    const startMs = startMsOf(activity)!;
    const sameStart = unidentified.find((k) => Math.abs(k.startMs - startMs) <= SAME_START_MS);
    if (sameStart) {
      plan.attach.push({ activityId: sameStart.id, intervalsId: activity.id });
      unidentified.splice(unidentified.indexOf(sameStart), 1);
    } else {
      plan.download.push(activity);
    }
  }
  plan.download.sort((a, b) => startMsOf(b)! - startMsOf(a)!);
  return plan;
}

/** Garmin Connect's activity id, when intervals.icu recorded it as the external id. */
export function garminIdOf(activity: IntervalsActivity): string | undefined {
  return activity.source === 'GARMIN_CONNECT' && /^\d{6,20}$/.test(activity.external_id ?? '')
    ? activity.external_id
    : undefined;
}

/**
 * An import built only from the list entry, for when the file couldn't be downloaded or decoded:
 * the activity still counts in history and statistics (no samples, no best efforts), and the
 * error is kept so a later re-upload of the file can fill it in.
 */
export function summaryOnlyCandidate(activity: IntervalsActivity, error: string): ImportCandidate {
  const elapsed = activity.elapsed_time ?? activity.moving_time ?? 0;
  return {
    startTime: new Date(startMsOf(activity)!).toISOString(),
    sport: sportOf(activity),
    name: activity.name || undefined,
    dedupKey: `intervals:${activity.id}`,
    intervalsId: activity.id,
    garminId: garminIdOf(activity),
    importError: error.slice(0, 300),
    metrics: {
      distanceM: activity.distance ?? 0,
      movingS: activity.moving_time ?? elapsed,
      elapsedS: elapsed,
      ...(activity.average_heartrate && { avgHr: activity.average_heartrate }),
      ...(activity.max_heartrate && { maxHr: activity.max_heartrate }),
      ...(activity.total_elevation_gain !== undefined && {
        elevGainM: activity.total_elevation_gain,
      }),
      ...(activity.calories && { calories: activity.calories }),
      bestEfforts: {},
    },
  };
}
