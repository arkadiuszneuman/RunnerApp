import type { LinkMode } from './types';

/** The bits of a run record (run_history.data) that say when it happened. */
export interface RunTimingLike {
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  /** Wall-clock start as first created — unlike `startedAt`, never shifted by pauses. */
  wallStartedAt?: string;
}

export interface Interval {
  startMs: number;
  endMs: number;
}

function parseMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * When a RunnerApp run actually took place. `startedAt` can't be trusted as the start on its own:
 * RunSession moves it later by every pause (and resends it on each flush), so the original
 * wall-clock start (`wallStartedAt`) is preferred, then `finishedAt − durationMs` (running time
 * counted back from the real finish), then `startedAt`. A run that never finished ends at its last
 * telemetry point (`lastT`, seconds). Every fallback lands inside the real span of the run, which
 * is all overlap matching needs.
 */
export function runInterval(run: RunTimingLike, lastT?: number): Interval | undefined {
  const finished = parseMs(run.finishedAt);
  const startedAt = parseMs(run.startedAt);
  const start =
    parseMs(run.wallStartedAt) ??
    (finished !== undefined && run.durationMs !== undefined
      ? finished - run.durationMs
      : startedAt);
  if (start === undefined) return undefined;
  const end =
    finished ??
    (startedAt !== undefined && lastT !== undefined ? startedAt + lastT * 1000 : undefined);
  if (end === undefined || end <= start) return undefined;
  return { startMs: start, endMs: end };
}

export interface MatchableRun extends Interval {
  id: string;
}

export interface MatchableActivity extends Interval {
  id: string;
  linkedRunId?: string | null;
  linkMode?: LinkMode | null;
}

/** Overlap required, as a share of the shorter of the two spans. */
export const MIN_LINK_OVERLAP = 0.5;

function overlapRatio(a: Interval, b: Interval): number {
  const overlap = Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
  if (overlap <= 0) return 0;
  const shorter = Math.min(a.endMs - a.startMs, b.endMs - b.startMs);
  return shorter > 0 ? overlap / shorter : 0;
}

/**
 * Pairs runs with the watch activities recorded alongside them: a pair qualifies when the two
 * spans overlap by at least half of the shorter one (the watch is usually started a bit before the
 * treadmill and stopped after). Strongest overlaps are taken first and each run/activity is used
 * at most once. Activities already linked, or explicitly unlinked by the user (`linkMode: 'none'`),
 * and runs that already have an activity are left alone.
 */
export function matchRuns(
  runs: readonly MatchableRun[],
  activities: readonly MatchableActivity[],
  minOverlap = MIN_LINK_OVERLAP
): Array<{ runId: string; activityId: string }> {
  const taken = new Set(activities.map((a) => a.linkedRunId).filter((id): id is string => !!id));
  const freeRuns = runs.filter((r) => !taken.has(r.id));
  const freeActivities = activities.filter((a) => !a.linkedRunId && a.linkMode !== 'none');

  const candidates: Array<{ runId: string; activityId: string; ratio: number }> = [];
  for (const run of freeRuns) {
    for (const activity of freeActivities) {
      const ratio = overlapRatio(run, activity);
      if (ratio >= minOverlap) candidates.push({ runId: run.id, activityId: activity.id, ratio });
    }
  }
  candidates.sort((a, b) => b.ratio - a.ratio);

  const usedRuns = new Set<string>();
  const usedActivities = new Set<string>();
  const pairs: Array<{ runId: string; activityId: string }> = [];
  for (const c of candidates) {
    if (usedRuns.has(c.runId) || usedActivities.has(c.activityId)) continue;
    usedRuns.add(c.runId);
    usedActivities.add(c.activityId);
    pairs.push({ runId: c.runId, activityId: c.activityId });
  }
  return pairs;
}
