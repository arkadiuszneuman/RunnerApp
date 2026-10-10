// Imported from the concrete modules rather than the `@runner/core` barrel: that barrel also
// re-exports useInterval (a React hook), and Next.js refuses to bundle anything hook-shaped into a
// Route Handler's module graph even when, as here, it's never called.
import { runInterval, type RunTimingLike } from '@runner/core/src/activities/matching';
import { metricsFromTelemetry } from '@runner/core/src/activities/runMetrics';
import type { ActivityMetrics } from '@runner/core/src/activities/types';
import { analyzeRun, type RunRecord, type RunSummary } from '@runner/core/src/services/runAnalysis';
import type { TelemetryPoint } from '@runner/core/src/types/telemetry';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { runHistory } from '@/lib/db/schema';

/**
 * Bump when computeRunSummary's output changes: rows stored with another version are recomputed
 * lazily the next time the run list is loaded (see loadRunSummaries).
 */
export const RUN_SUMMARY_VERSION = 1;

/** What run_history.summary holds. `run` is the list-row summary the history page already used. */
export type StoredRunSummary = { run: RunSummary; metrics: ActivityMetrics };

/** run_history.data without the telemetry array. */
export type RunMeta = Omit<RunRecord, 'telemetry'> & Pick<RunTimingLike, 'wallStartedAt'>;

export type RunDerived = {
  startedAt: Date | null;
  endedAt: Date | null;
  summary: StoredRunSummary;
  summaryVersion: number;
};

/** The run's own clock length in seconds — the same rule runs/[id]/page.tsx uses. */
export function runEndT(meta: RunMeta): number | undefined {
  if (meta.durationMs !== undefined) return meta.durationMs / 1000;
  if (meta.finishedAt && meta.startedAt) {
    const seconds = (Date.parse(meta.finishedAt) - Date.parse(meta.startedAt)) / 1000;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }
  return undefined;
}

/** Everything run_history stores next to `data`, computed from it. */
export function computeRunDerived(meta: RunMeta, telemetry: TelemetryPoint[]): RunDerived {
  const endT = runEndT(meta);
  const run = analyzeRun(telemetry, { endT });
  // The per-stage breakdown needs the program's stages and is only shown on the detail page,
  // which computes it itself.
  run.stages = [];
  const lastT = telemetry.reduce((max, p) => Math.max(max, p.t), 0);
  const interval = runInterval(meta, endT ?? lastT);
  const fallbackStart = meta.startedAt ? new Date(meta.startedAt) : null;
  return {
    startedAt: interval ? new Date(interval.startMs) : validDate(fallbackStart),
    endedAt: interval ? new Date(interval.endMs) : null,
    summary: { run, metrics: metricsFromTelemetry(telemetry, endT, run) },
    summaryVersion: RUN_SUMMARY_VERSION,
  };
}

function validDate(date: Date | null): Date | null {
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export async function saveRunDerived(id: string, derived: RunDerived): Promise<void> {
  await db
    .update(runHistory)
    .set({
      startedAt: derived.startedAt,
      endedAt: derived.endedAt,
      summary: derived.summary,
      summaryVersion: derived.summaryVersion,
    })
    .where(eq(runHistory.id, id));
}

export type RunListRow = {
  id: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  meta: RunMeta;
  summary: StoredRunSummary;
};

const BACKFILL_CHUNK = 20;

export type Span = { fromMs: number; toMs: number };

/**
 * Computes and stores the derived columns of every run whose summary is missing or outdated
 * (recorded before summaries were stored, or computed by an older RUN_SUMMARY_VERSION), a chunk
 * at a time so memory stays bounded — a one-off cost per row. Returns the span of the runs it
 * filled in, if any: until then those runs had no start/end and couldn't be linked to watch
 * activities, so the caller should link that span.
 */
export async function backfillRunSummaries(userId: string): Promise<Span | undefined> {
  const stale = await db
    .select({ id: runHistory.id, meta: sql<RunMeta>`${runHistory.data} - 'telemetry'` })
    .from(runHistory)
    .where(
      and(
        eq(runHistory.userId, userId),
        sql`${runHistory.summaryVersion} is distinct from ${RUN_SUMMARY_VERSION}`
      )
    );
  let span: Span | undefined;
  for (let i = 0; i < stale.length; i += BACKFILL_CHUNK) {
    const chunk = stale.slice(i, i + BACKFILL_CHUNK);
    const telemetries = await db
      .select({
        id: runHistory.id,
        telemetry: sql<TelemetryPoint[] | null>`${runHistory.data} -> 'telemetry'`,
      })
      .from(runHistory)
      .where(
        and(
          eq(runHistory.userId, userId),
          inArray(
            runHistory.id,
            chunk.map((r) => r.id)
          )
        )
      );
    const byId = new Map(telemetries.map((t) => [t.id, t.telemetry ?? []]));
    await Promise.all(
      chunk.map(async (row) => {
        const derived = computeRunDerived(row.meta, byId.get(row.id) ?? []);
        await saveRunDerived(row.id, derived);
        if (derived.startedAt && derived.endedAt) {
          span = {
            fromMs: Math.min(span?.fromMs ?? Infinity, derived.startedAt.getTime()),
            toMs: Math.max(span?.toMs ?? -Infinity, derived.endedAt.getTime()),
          };
        }
      })
    );
  }
  return span;
}

/**
 * Every run of a user, newest first, with its stored summary — without ever selecting the
 * (potentially large) telemetry. Outdated summaries are brought up to date first (see
 * backfillRunSummaries); `backfilled` is the span that needed it.
 */
export async function loadRunSummaries(
  userId: string
): Promise<{ rows: RunListRow[]; backfilled?: Span }> {
  const backfilled = await backfillRunSummaries(userId);
  const rows = await db
    .select({
      id: runHistory.id,
      createdAt: runHistory.createdAt,
      startedAt: runHistory.startedAt,
      endedAt: runHistory.endedAt,
      meta: sql<RunMeta>`${runHistory.data} - 'telemetry'`,
      summary: runHistory.summary,
    })
    .from(runHistory)
    .where(eq(runHistory.userId, userId))
    .orderBy(sql`coalesce(${runHistory.startedAt}, ${runHistory.createdAt}) desc`);
  return {
    rows: rows.map((row) => ({ ...row, summary: row.summary as StoredRunSummary })),
    backfilled,
  };
}
