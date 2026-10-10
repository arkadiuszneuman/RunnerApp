import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programs, runHistory } from '@/lib/db/schema';
import { loadRunSummaries } from '@/lib/runs/summaries';
import { getUserId } from '@/lib/session';
import { createRunSchema, parseJsonBody } from '@/lib/validation';

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const parsed = await parseJsonBody(request, createRunSchema);
  if (!parsed.ok) return parsed.response;
  const { id, startedAt, programId, program, controller } = parsed.data;

  // Snapshot the program's name at run-start time (scoped to this user) so
  // history still shows it even if the program is later renamed or deleted.
  let programName: string | undefined;
  if (programId) {
    const result = await db
      .select({ name: programs.name })
      .from(programs)
      .where(and(eq(programs.id, programId), eq(programs.userId, userId)))
      .limit(1);
    programName = result[0]?.name;
  }

  // `program`'s Timespans are the wire-JSON shape ({ totalMilliseconds }), not
  // real Timespan instances — this jsonb column is untyped storage either
  // way, and the client re-hydrates them via Timespan.reviver on read (see
  // apps/web/src/app/runs/[id]/page.tsx), so no annotation here.
  // `wallStartedAt` keeps the original start: RunSession's later PATCHes resend `startedAt`
  // shifted by every pause (see runInterval in packages/core's activities/matching.ts), and the
  // PATCH schema drops unknown keys, so nothing ever overwrites this one.
  const data = {
    startedAt,
    wallStartedAt: startedAt,
    telemetry: [],
    programId,
    programName,
    program,
    controller,
  };
  const startedAtDate = new Date(startedAt);

  // Idempotent on a client-supplied id: the offline outbox replays a create
  // whose response it never received, which must not fail or duplicate.
  const result = await db
    .insert(runHistory)
    .values({ ...(id && { id }), userId, data, startedAt: startedAtDate })
    .onConflictDoNothing({ target: runHistory.id })
    .returning({ id: runHistory.id });

  if (result.length === 0) {
    const existing = await db
      .select({ id: runHistory.id })
      .from(runHistory)
      .where(and(eq(runHistory.id, id!), eq(runHistory.userId, userId)))
      .limit(1);
    return existing.length > 0
      ? NextResponse.json({ id }, { status: 200 })
      : NextResponse.json({ error: 'Id already in use' }, { status: 409 });
  }

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  // Every run, newest first, with summaries the server computed and stored when the run was
  // saved — the full telemetry never has to cross the wire (or even leave the database) just to
  // render a list row or a statistic.
  const rows = await loadRunSummaries(userId);
  return NextResponse.json(
    rows.map(({ id, createdAt, startedAt, endedAt, meta, summary }) => ({
      id,
      createdAt,
      startedAt: meta.startedAt,
      wallStartedAt: startedAt,
      endedAt,
      finishedAt: meta.finishedAt,
      programName: meta.programName,
      controller: meta.controller,
      summary: summary.run,
      metrics: summary.metrics,
    }))
  );
}
