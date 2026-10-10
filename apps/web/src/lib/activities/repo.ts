import { matchRuns } from '@runner/core/src/activities/matching';
import {
  ACTIVITY_METRICS_VERSION,
  type ActivityMetrics,
  type ActivitySport,
  type ActivityStreams,
  type ImportedActivity,
  type LinkMode,
} from '@runner/core/src/activities/types';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { externalActivities, runHistory } from '@/lib/db/schema';
import type { ActivityDetail, ActivityListItem, ActivitySource } from './types';

export type { ActivityDetail, ActivityListItem, ActivitySource };

const listColumns = {
  id: externalActivities.id,
  source: externalActivities.source,
  intervalsId: externalActivities.intervalsId,
  garminId: externalActivities.garminId,
  startTime: externalActivities.startTime,
  tzOffsetMin: externalActivities.tzOffsetMin,
  sport: externalActivities.sport,
  name: externalActivities.name,
  device: externalActivities.device,
  summary: externalActivities.summary,
  linkedRunId: externalActivities.linkedRunId,
  linkMode: externalActivities.linkMode,
  importError: externalActivities.importError,
};

function toListItem(row: {
  id: string;
  source: string;
  intervalsId: string | null;
  garminId: string | null;
  startTime: Date;
  tzOffsetMin: number | null;
  sport: string;
  name: string | null;
  device: string | null;
  summary: unknown;
  linkedRunId: string | null;
  linkMode: string | null;
  importError: string | null;
}): ActivityListItem {
  const { summary, ...rest } = row;
  return {
    ...rest,
    source: row.source as ActivitySource,
    sport: row.sport as ActivitySport,
    linkMode: row.linkMode as LinkMode | null,
    startTime: row.startTime.toISOString(),
    metrics: summary as ActivityMetrics,
  };
}

export async function listActivities(userId: string): Promise<ActivityListItem[]> {
  const rows = await db
    .select(listColumns)
    .from(externalActivities)
    .where(and(eq(externalActivities.userId, userId), isNull(externalActivities.deletedAt)))
    .orderBy(desc(externalActivities.startTime));
  return rows.map(toListItem);
}

export async function getActivity(userId: string, id: string): Promise<ActivityDetail | null> {
  const rows = await db
    .select({ ...listColumns, streams: externalActivities.streams })
    .from(externalActivities)
    .where(
      and(
        eq(externalActivities.id, id),
        eq(externalActivities.userId, userId),
        isNull(externalActivities.deletedAt)
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  const { streams, ...rest } = rows[0];
  return { ...toListItem(rest), streams: (streams as ActivityStreams | null) ?? null };
}

/** Two recordings starting this close together with similar lengths are the same activity. */
const SAME_START_MS = 2000;

export type ImportOptions = {
  source: ActivitySource;
  /**
   * Whether an activity the user deleted comes back when imported again. True for an explicit
   * file upload (the user is asking for it); false for background sync (or it would keep
   * reappearing).
   */
  restoreDeleted: boolean;
};

export type ImportCandidate = ImportedActivity & { intervalsId?: string; importError?: string };

export type ImportResult = { inserted: string[]; updated: string[]; duplicates: number };

/**
 * Stores imported activities, recognising ones already stored — by recording identity
 * (`dedupKey`), by intervals.icu id, or by an identical start time (the same activity arriving
 * through a different path) — instead of duplicating them. A known activity is only touched to
 * add what it was missing (samples, an intervals.icu/Garmin id), or to restore it when
 * `restoreDeleted`. Then links new activities to runs recorded at the same time.
 */
export async function importActivities(
  userId: string,
  candidates: ImportCandidate[],
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = { inserted: [], updated: [], duplicates: 0 };
  if (candidates.length === 0) return result;

  const starts = candidates.map((c) => Date.parse(c.startTime));
  const from = new Date(Math.min(...starts) - SAME_START_MS);
  const to = new Date(Math.max(...starts) + SAME_START_MS);
  const dedupKeys = candidates.map((c) => c.dedupKey);
  const existing = await db
    .select({
      id: externalActivities.id,
      dedupKey: externalActivities.dedupKey,
      intervalsId: externalActivities.intervalsId,
      garminId: externalActivities.garminId,
      startTime: externalActivities.startTime,
      elapsedS: externalActivities.elapsedS,
      hasStreams: isNotNull(externalActivities.streams),
      deletedAt: externalActivities.deletedAt,
    })
    .from(externalActivities)
    .where(
      and(
        eq(externalActivities.userId, userId),
        or(
          and(gte(externalActivities.startTime, from), lte(externalActivities.startTime, to)),
          inArray(externalActivities.dedupKey, dedupKeys)
        )
      )
    );

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.dedupKey)) {
      result.duplicates++;
      continue;
    }
    seen.add(candidate.dedupKey);
    const startMs = Date.parse(candidate.startTime);
    const match = existing.find(
      (e) =>
        e.dedupKey === candidate.dedupKey ||
        (candidate.intervalsId !== undefined && e.intervalsId === candidate.intervalsId) ||
        (Math.abs(e.startTime.getTime() - startMs) <= SAME_START_MS &&
          Math.abs(e.elapsedS - candidate.metrics.elapsedS) <= Math.max(60, e.elapsedS * 0.05))
    );

    if (match) {
      const patch: Partial<typeof externalActivities.$inferInsert> = {};
      if (!match.hasStreams && candidate.streams) {
        Object.assign(patch, rowValues(candidate), { importError: null });
      }
      if (!match.intervalsId && candidate.intervalsId) patch.intervalsId = candidate.intervalsId;
      if (!match.garminId && candidate.garminId) patch.garminId = candidate.garminId;
      if (match.deletedAt && options.restoreDeleted) patch.deletedAt = null;
      if (match.deletedAt && !options.restoreDeleted) {
        // Stays deleted, but remembers its intervals.icu id so sync stops offering it.
        if (patch.intervalsId) {
          await db
            .update(externalActivities)
            .set({ intervalsId: patch.intervalsId })
            .where(eq(externalActivities.id, match.id));
        }
        result.duplicates++;
        continue;
      }
      if (Object.keys(patch).length > 0) {
        await db
          .update(externalActivities)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(externalActivities.id, match.id));
        result.updated.push(match.id);
      } else {
        result.duplicates++;
      }
      continue;
    }

    const inserted = await db
      .insert(externalActivities)
      .values({
        userId,
        source: options.source,
        dedupKey: candidate.dedupKey,
        intervalsId: candidate.intervalsId ?? null,
        garminId: candidate.garminId ?? null,
        importError: candidate.importError ?? null,
        ...rowValues(candidate),
      })
      .onConflictDoNothing()
      .returning({ id: externalActivities.id });
    if (inserted.length > 0) result.inserted.push(inserted[0].id);
    else result.duplicates++;
  }

  if (result.inserted.length > 0 || result.updated.length > 0) {
    await autoLink(userId, { fromMs: from.getTime(), toMs: to.getTime() });
  }
  return result;
}

/** The columns derived from an ImportedActivity's content. */
function rowValues(a: ImportCandidate) {
  return {
    startTime: new Date(a.startTime),
    tzOffsetMin: a.tzOffsetMin ?? null,
    sport: a.sport,
    name: a.name ?? null,
    device: a.device ?? null,
    distanceM: a.metrics.distanceM,
    elapsedS: Math.round(a.metrics.elapsedS),
    summary: a.metrics,
    summaryVersion: ACTIVITY_METRICS_VERSION,
    streams: a.streams ?? null,
  };
}

/** How far around the given span to look for the other half of a pair. */
const LINK_WINDOW_MS = 24 * 3600_000;

/**
 * Links runs and watch activities that were recorded together (see matchRuns) within the given
 * time span. Called after an import, and when a run finishes — whichever of the two reaches the
 * server second makes the link.
 */
export async function autoLink(
  userId: string,
  span: { fromMs: number; toMs: number }
): Promise<number> {
  const from = new Date(span.fromMs - LINK_WINDOW_MS);
  const to = new Date(span.toMs + LINK_WINDOW_MS);
  const [runs, activities] = await Promise.all([
    db
      .select({ id: runHistory.id, startedAt: runHistory.startedAt, endedAt: runHistory.endedAt })
      .from(runHistory)
      .where(
        and(
          eq(runHistory.userId, userId),
          isNotNull(runHistory.endedAt),
          gte(runHistory.startedAt, from),
          lte(runHistory.startedAt, to)
        )
      ),
    db
      .select({
        id: externalActivities.id,
        startTime: externalActivities.startTime,
        elapsedS: externalActivities.elapsedS,
        linkedRunId: externalActivities.linkedRunId,
        linkMode: externalActivities.linkMode,
      })
      .from(externalActivities)
      .where(
        and(
          eq(externalActivities.userId, userId),
          isNull(externalActivities.deletedAt),
          gte(externalActivities.startTime, new Date(from.getTime() - LINK_WINDOW_MS)),
          lte(externalActivities.startTime, to)
        )
      ),
  ]);
  if (runs.length === 0 || activities.length === 0) return 0;

  const pairs = matchRuns(
    runs.map((r) => ({ id: r.id, startMs: r.startedAt!.getTime(), endMs: r.endedAt!.getTime() })),
    activities.map((a) => ({
      id: a.id,
      startMs: a.startTime.getTime(),
      endMs: a.startTime.getTime() + a.elapsedS * 1000,
      linkedRunId: a.linkedRunId,
      linkMode: a.linkMode as LinkMode | null,
    }))
  );

  let linked = 0;
  for (const { runId, activityId } of pairs) {
    try {
      // Re-checked in the WHERE: a concurrent manual link/unlink must win over this one.
      const updated = await db
        .update(externalActivities)
        .set({ linkedRunId: runId, linkMode: 'auto', updatedAt: new Date() })
        .where(
          and(
            eq(externalActivities.id, activityId),
            isNull(externalActivities.linkedRunId),
            or(isNull(externalActivities.linkMode), ne(externalActivities.linkMode, 'none'))
          )
        )
        .returning({ id: externalActivities.id });
      linked += updated.length;
    } catch {
      // The unique index on linked_run_id: the run got another activity in the meantime.
    }
  }
  return linked;
}

/**
 * Sets (or clears, with null) the run an activity is linked to, as the user's explicit choice.
 * A run has at most one activity, so linking moves the run away from any other activity — which
 * is then marked as unlinked by the user, so auto-linking doesn't put it straight back. Returns
 * false when the activity or run doesn't exist for this user.
 */
export async function setActivityLink(
  userId: string,
  activityId: string,
  runId: string | null
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const activity = await tx
      .select({ id: externalActivities.id })
      .from(externalActivities)
      .where(
        and(
          eq(externalActivities.id, activityId),
          eq(externalActivities.userId, userId),
          isNull(externalActivities.deletedAt)
        )
      )
      .limit(1);
    if (activity.length === 0) return false;

    if (runId === null) {
      await tx
        .update(externalActivities)
        .set({ linkedRunId: null, linkMode: 'none', updatedAt: new Date() })
        .where(eq(externalActivities.id, activityId));
      return true;
    }

    const run = await tx
      .select({ id: runHistory.id })
      .from(runHistory)
      .where(and(eq(runHistory.id, runId), eq(runHistory.userId, userId)))
      .limit(1);
    if (run.length === 0) return false;

    await tx
      .update(externalActivities)
      .set({ linkedRunId: null, linkMode: 'none', updatedAt: new Date() })
      .where(and(eq(externalActivities.linkedRunId, runId), ne(externalActivities.id, activityId)));
    await tx
      .update(externalActivities)
      .set({ linkedRunId: runId, linkMode: 'manual', updatedAt: new Date() })
      .where(eq(externalActivities.id, activityId));
    return true;
  });
}

/** Soft delete: the row stays as a tombstone so background sync doesn't bring it back. */
export async function deleteActivity(userId: string, id: string): Promise<boolean> {
  const result = await db
    .update(externalActivities)
    .set({ deletedAt: new Date(), linkedRunId: null, updatedAt: new Date() })
    .where(
      and(
        eq(externalActivities.id, id),
        eq(externalActivities.userId, userId),
        isNull(externalActivities.deletedAt)
      )
    )
    .returning({ id: externalActivities.id });
  return result.length > 0;
}
