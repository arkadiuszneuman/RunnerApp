import { ACTIVITY_STREAMS_VERSION } from '@runner/core/src/activities/types';
import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { importActivities, type ImportCandidate } from '@/lib/activities/repo';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';
import { externalActivities, userIntegrations, userSettings } from '@/lib/db/schema';
import { decodeFit } from '@/lib/fit/decodeFit';
import {
  createIntervalsClient,
  IntervalsError,
  type IntervalsActivity,
  type IntervalsAthlete,
  type IntervalsClient,
} from './client';
import {
  garminIdOf,
  planRouteRefresh,
  planSync,
  startMsOf,
  summaryOnlyCandidate,
} from './syncPlan';
import type { IntervalsStatus, SyncResult } from './types';

export type { IntervalsStatus, SyncResult };

const PROVIDER = 'intervals';

const LOCK_SECONDS = 90;
/** Work budget per pass, well inside the route's maxDuration. */
const TIME_BUDGET_MS = 40_000;
const CONCURRENCY = 2;
/** An incremental sync re-lists this far back, for activities that reached intervals.icu late. */
const RELIST_DAYS = 7;

async function loadIntegration(userId: string) {
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, PROVIDER)))
    .limit(1);
  return rows[0];
}

export async function getIntervalsStatus(userId: string): Promise<IntervalsStatus> {
  const row = await loadIntegration(userId);
  if (!row) return { connected: false };
  return {
    connected: true,
    status: row.status as 'ok' | 'needs_reconnect' | 'error',
    keyHint: row.keyHint,
    athleteName: row.athleteName,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    fullSyncDone: row.fullSyncDoneAt !== null,
    lastError: row.lastError,
  };
}

/** The runner's max/resting HR from intervals.icu, to fill an empty heart-rate profile. */
function profileFrom(athlete: IntervalsAthlete): { maxHr?: number; restingHr?: number } {
  const run = athlete.sportSettings?.find((s) => s.types?.includes('Run'));
  const profile: { maxHr?: number; restingHr?: number } = {};
  if (run?.max_hr && run.max_hr >= 100 && run.max_hr <= 250) profile.maxHr = Math.round(run.max_hr);
  if (athlete.icu_resting_hr && athlete.icu_resting_hr >= 25 && athlete.icu_resting_hr <= 120) {
    profile.restingHr = Math.round(athlete.icu_resting_hr);
  }
  return profile;
}

export type ConnectResult =
  { ok: true; status: IntervalsStatus } | { ok: false; error: 'invalid_key' | 'unreachable' };

/** Verifies the key against intervals.icu, then stores it encrypted (replacing any previous one). */
export async function connectIntervals(userId: string, apiKey: string): Promise<ConnectResult> {
  let athlete: IntervalsAthlete;
  try {
    athlete = await createIntervalsClient(apiKey).getAthlete();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof IntervalsError && error.isAuth ? 'invalid_key' : 'unreachable',
    };
  }

  const values = {
    secret: encryptSecret(apiKey, userId),
    keyHint: apiKey.slice(-4),
    athleteId: String(athlete.id),
    athleteName: athlete.name ?? null,
    status: 'ok',
    lastError: null,
    lastSyncedAt: null,
    fullSyncDoneAt: null,
    syncLockUntil: null,
    retryAfter: null,
    updatedAt: new Date(),
  };
  await db
    .insert(userIntegrations)
    .values({ userId, provider: PROVIDER, ...values })
    .onConflictDoUpdate({
      target: [userIntegrations.userId, userIntegrations.provider],
      set: values,
    });

  // Only fills a profile the user hasn't set — never overwrites their own numbers.
  const profile = profileFrom(athlete);
  if (Object.keys(profile).length > 0) {
    await db
      .insert(userSettings)
      .values({ userId, data: { athleteProfile: profile } })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          data: sql`case when ${userSettings.data} ? 'athleteProfile' then ${userSettings.data} else ${userSettings.data} || ${JSON.stringify({ athleteProfile: profile })}::jsonb end`,
        },
      });
  }
  return { ok: true, status: await getIntervalsStatus(userId) };
}

/** Forgets the key. Activities already imported stay. */
export async function disconnectIntervals(userId: string): Promise<void> {
  await db
    .delete(userIntegrations)
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, PROVIDER)));
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

type Job =
  | { kind: 'import'; listed: IntervalsActivity }
  | { kind: 'route'; id: string; intervalsId: string; startTime: Date };

/** Rate limit, revoked key or no connection: the job is retried by a later pass. */
function isTransient(error: unknown): error is IntervalsError {
  return (
    error instanceof IntervalsError && (error.status === 429 || error.isAuth || error.status === 0)
  );
}

async function markStreamsCurrent(id: string): Promise<void> {
  await db
    .update(externalActivities)
    .set({ streamsVersion: ACTIVITY_STREAMS_VERSION, updatedAt: new Date() })
    .where(eq(externalActivities.id, id));
}

/**
 * Downloads a stored activity's original file again for the GPS route, which older imports didn't
 * keep. `importActivities` recognises it by its intervals.icu id and only swaps the streams in; an
 * activity whose file has no route (or no longer decodes) is still marked current, so it isn't
 * fetched again.
 */
async function refreshRoute(
  userId: string,
  client: IntervalsClient,
  job: { id: string; intervalsId: string; startTime: Date }
): Promise<void> {
  const candidate = await candidateFor(client, {
    id: job.intervalsId,
    start_date: job.startTime.toISOString(),
  });
  if (!candidate.importError) {
    await importActivities(userId, [candidate], { source: 'intervals', restoreDeleted: false });
  }
  await markStreamsCurrent(job.id);
}

/**
 * Turns one listed activity into something to import: its original FIT file (or, if that isn't
 * a FIT — e.g. a GPX upload — intervals.icu's FIT rendering of it), falling back to the list
 * entry's summary when neither decodes.
 */
async function candidateFor(
  client: IntervalsClient,
  listed: IntervalsActivity
): Promise<ImportCandidate> {
  let lastError = 'No running session in the file';
  for (const kind of ['file', 'fit-file'] as const) {
    if (kind === 'file' && listed.file_type && listed.file_type.toLowerCase() !== 'fit') continue;
    const decoded = decodeFit(await client.downloadFile(listed.id, kind));
    if ('error' in decoded) {
      lastError = decoded.error;
      continue;
    }
    const activity = decoded.activities[0];
    if (activity) {
      return {
        ...activity,
        intervalsId: listed.id,
        name: listed.name || activity.name,
        garminId: garminIdOf(listed) ?? activity.garminId,
      };
    }
  }
  return summaryOnlyCandidate(listed, lastError);
}

/**
 * One bounded sync pass. A DB lease (`sync_lock_until`) keeps passes of the same user from
 * overlapping, even on different serverless instances. The work is recomputed from scratch every
 * pass (list → diff against what's stored → import newest first, until the time budget runs out),
 * so a pass can stop anywhere — time-out, rate limit, crash — and the next one simply carries on.
 * The first sync lists everything; later ones re-list the last week before the previous sync.
 */
export async function syncIntervals(userId: string): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, attached: 0, failed: 0, remaining: 0 };
  const integration = await loadIntegration(userId);
  if (!integration) return { ...result, stopped: 'not_connected' };
  if (integration.retryAfter && integration.retryAfter.getTime() > Date.now()) {
    return {
      ...result,
      stopped: 'rate_limited',
      retryAfterSec: Math.ceil((integration.retryAfter.getTime() - Date.now()) / 1000),
    };
  }

  const where = and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, PROVIDER));
  const leased = await db
    .update(userIntegrations)
    .set({ syncLockUntil: new Date(Date.now() + LOCK_SECONDS * 1000) })
    .where(
      and(
        where,
        or(isNull(userIntegrations.syncLockUntil), lt(userIntegrations.syncLockUntil, new Date()))
      )
    )
    .returning({ userId: userIntegrations.userId });
  if (leased.length === 0) return { ...result, stopped: 'busy' };

  const finish = async (patch: Partial<typeof userIntegrations.$inferInsert>) => {
    await db
      .update(userIntegrations)
      .set({ ...patch, syncLockUntil: null, updatedAt: new Date() })
      .where(where);
  };

  const apiKey = decryptSecret(integration.secret, userId);
  if (!apiKey) {
    await finish({
      status: 'needs_reconnect',
      lastError: 'The stored key can no longer be read — reconnect.',
    });
    return { ...result, stopped: 'auth' };
  }
  const client = createIntervalsClient(apiKey);
  const startedAt = Date.now();
  const full = integration.fullSyncDoneAt === null;
  const oldest = full
    ? '2000-01-01'
    : isoDate((integration.lastSyncedAt?.getTime() ?? Date.now()) - RELIST_DAYS * 86_400_000);
  // Tomorrow: the list filters by the athlete's local date, which may be ahead of UTC.
  const newest = isoDate(Date.now() + 86_400_000);

  try {
    const listed = await client.listActivities(oldest, newest);
    const known = await db
      .select({
        id: externalActivities.id,
        intervalsId: externalActivities.intervalsId,
        garminId: externalActivities.garminId,
        startTime: externalActivities.startTime,
        sport: externalActivities.sport,
        hasStreams: isNotNull(externalActivities.streams),
        streamsVersion: externalActivities.streamsVersion,
        deletedAt: externalActivities.deletedAt,
      })
      .from(externalActivities)
      .where(eq(externalActivities.userId, userId));
    const plan = planSync(
      listed,
      known.map((k) => ({ ...k, startMs: k.startTime.getTime() }))
    );

    for (const { activityId, garminId } of plan.garminIds) {
      await db
        .update(externalActivities)
        .set({ garminId, updatedAt: new Date() })
        .where(and(eq(externalActivities.id, activityId), isNull(externalActivities.garminId)));
    }

    for (const { activityId, intervalsId, garminId } of plan.attach) {
      try {
        await db
          .update(externalActivities)
          .set({ intervalsId, ...(garminId && { garminId }), updatedAt: new Date() })
          .where(
            and(eq(externalActivities.id, activityId), isNull(externalActivities.intervalsId))
          );
        result.attached++;
      } catch {
        // Unique (user, intervals_id): another row already has it — nothing to do.
      }
    }

    // New activities first, then the GPS route backfill of ones stored before it existed.
    const queue: Job[] = [
      ...plan.download.map((listed): Job => ({ kind: 'import', listed })),
      ...planRouteRefresh(
        known.map((k) => ({
          ...k,
          startMs: k.startTime.getTime(),
          hasStreams: Boolean(k.hasStreams),
          deleted: k.deletedAt !== null,
        }))
      ).map((stored): Job => ({
        kind: 'route',
        id: stored.id,
        intervalsId: stored.intervalsId!,
        startTime: new Date(stored.startMs),
      })),
    ];
    let stop: IntervalsError | undefined;
    const worker = async () => {
      while (queue.length > 0 && !stop && Date.now() - startedAt < TIME_BUDGET_MS) {
        const job = queue.shift()!;
        if (job.kind === 'route') {
          try {
            await refreshRoute(userId, client, job);
          } catch (error) {
            if (isTransient(error)) {
              queue.unshift(job);
              stop = error;
            } else {
              // A file that no longer downloads or decodes: keep what's stored, don't retry.
              await markStreamsCurrent(job.id);
            }
          }
          continue;
        }
        const listedActivity = job.listed;
        try {
          const candidate = await candidateFor(client, listedActivity);
          const imported = await importActivities(userId, [candidate], {
            source: 'intervals',
            restoreDeleted: false,
          });
          if (candidate.importError) result.failed++;
          else result.imported += imported.inserted.length + imported.updated.length;
        } catch (error) {
          if (isTransient(error)) {
            queue.unshift(job);
            stop = error;
          } else {
            // A broken file or an unexpected response for this one activity: keep its summary.
            if (startMsOf(listedActivity) !== undefined) {
              await importActivities(
                userId,
                [
                  summaryOnlyCandidate(
                    listedActivity,
                    error instanceof Error ? error.message : 'Import failed'
                  ),
                ],
                { source: 'intervals', restoreDeleted: false }
              );
            }
            result.failed++;
          }
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    result.remaining = queue.length;

    if (stop) throw stop;
    const done = result.remaining === 0;
    await finish({
      status: 'ok',
      lastError: null,
      retryAfter: null,
      ...(done && { lastSyncedAt: new Date(startedAt) }),
      ...(done && full && { fullSyncDoneAt: new Date(startedAt) }),
    });
    return result;
  } catch (error) {
    if (!(error instanceof IntervalsError)) {
      await finish({
        status: 'error',
        lastError: error instanceof Error ? error.message.slice(0, 300) : 'Sync failed',
      });
      throw error;
    }
    if (error.status === 429) {
      const retryAfterSec = error.retryAfterSec ?? 60;
      await finish({ retryAfter: new Date(Date.now() + retryAfterSec * 1000) });
      return { ...result, stopped: 'rate_limited', retryAfterSec };
    }
    if (error.isAuth) {
      await finish({
        status: 'needs_reconnect',
        lastError: 'intervals.icu rejected the API key — reconnect.',
      });
      return { ...result, stopped: 'auth' };
    }
    await finish({ lastError: 'intervals.icu is unreachable.' });
    return { ...result, stopped: 'unreachable' };
  }
}
