import type { ActivityListItem } from '@/lib/activities/types';
import { writes } from '../offline/requests';
import { enqueueWrite } from '../offline/sync';
import { applyActivityLink, runStartMs, type RunListItem } from '../userData';
import { formatDuration, formatKm, sportLabel } from './format';
import type { LinkCandidate } from './LinkDialog';

/** How far from a run/activity to look for the other half of the pair. */
const CANDIDATE_WINDOW_MS = 12 * 3600_000;

/** Links (or with null unlinks) an activity: queued through the outbox, reflected immediately. */
export async function setLink(activityId: string, runId: string | null): Promise<void> {
  applyActivityLink(activityId, runId);
  await enqueueWrite(writes.linkActivity(activityId, runId));
}

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Watch activities recorded within ±12 h of a run, closest first. */
export function activityCandidates(
  run: RunListItem,
  activities: readonly ActivityListItem[]
): LinkCandidate[] {
  const start = runStartMs(run);
  return activities
    .map((a) => ({ a, distance: Math.abs(Date.parse(a.startTime) - start) }))
    .filter(({ distance }) => distance <= CANDIDATE_WINDOW_MS)
    .sort((x, y) => x.distance - y.distance)
    .map(({ a }) => ({
      id: a.id,
      title: `${a.name ?? sportLabel[a.sport]} · ${when(Date.parse(a.startTime))}`,
      subtitle: `${formatKm(a.metrics.distanceM)} km · ${formatDuration(a.metrics.movingS)}${a.metrics.avgHr ? ` · ${Math.round(a.metrics.avgHr)} bpm` : ''}${a.linkedRunId && a.linkedRunId !== run.id ? ' · linked to another run' : ''}`,
      current: a.linkedRunId === run.id,
    }));
}

/** App runs recorded within ±12 h of a watch activity, closest first. */
export function runCandidates(
  activity: ActivityListItem,
  runs: readonly RunListItem[]
): LinkCandidate[] {
  const start = Date.parse(activity.startTime);
  return runs
    .map((r) => ({ r, distance: Math.abs(runStartMs(r) - start) }))
    .filter(({ distance }) => distance <= CANDIDATE_WINDOW_MS)
    .sort((x, y) => x.distance - y.distance)
    .map(({ r }) => ({
      id: r.id,
      title: `${r.programName ?? 'Run'} · ${when(runStartMs(r))}`,
      subtitle: `${r.summary.distanceKm.toFixed(2)} km · ${formatDuration(r.summary.durationSeconds)}`,
      current: activity.linkedRunId === r.id,
    }));
}
