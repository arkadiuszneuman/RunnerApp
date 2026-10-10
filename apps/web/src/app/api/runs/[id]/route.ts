import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { autoLink } from '@/lib/activities/repo';
import { db } from '@/lib/db';
import { runHistory } from '@/lib/db/schema';
import { computeRunDerived, saveRunDerived, type RunMeta } from '@/lib/runs/summaries';
import { getUserId } from '@/lib/session';
import { parseJsonBody, patchRunSchema } from '@/lib/validation';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;

  const result = await db
    .select()
    .from(runHistory)
    .where(and(eq(runHistory.id, id), eq(runHistory.userId, userId)))
    .limit(1);

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(result[0]);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;

  const result = await db
    .delete(runHistory)
    .where(and(eq(runHistory.id, id), eq(runHistory.userId, userId)))
    .returning({ id: runHistory.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id: result[0].id });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, patchRunSchema);
  if (!parsed.ok) return parsed.response;

  // A shallow jsonb merge, not a full replace: POST /api/runs stores
  // programId/programName/program alongside startedAt, and this patch (sent
  // on every telemetry flush) must not wipe those out. `telemetry` itself is
  // still fully replaced by design — RunSession resends its whole
  // monotonically-growing buffer on each flush, not a delta.
  const result = await db
    .update(runHistory)
    .set({ data: sql`${runHistory.data} || ${JSON.stringify(parsed.data)}::jsonb` })
    .where(and(eq(runHistory.id, id), eq(runHistory.userId, userId)))
    .returning({ id: runHistory.id, meta: sql<RunMeta>`${runHistory.data} - 'telemetry'` });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });

  // Each flush carries the whole telemetry buffer, so the stored summary can be recomputed from
  // this request alone (plus the merged metadata the update just returned).
  const derived = computeRunDerived(result[0].meta, parsed.data.telemetry);
  await saveRunDerived(id, derived);

  // A run finished after its watch activity was imported (e.g. it synced from offline later)
  // gets linked here; the other order is handled by the import.
  if (parsed.data.finishedAt && derived.startedAt && derived.endedAt) {
    await autoLink(userId, {
      fromMs: derived.startedAt.getTime(),
      toMs: derived.endedAt.getTime(),
    });
  }

  return NextResponse.json({ id: result[0].id });
}
