// Imported from the concrete module rather than the `@runner/core` barrel:
// that barrel also re-exports useInterval (a React hook), and Next.js
// refuses to bundle anything hook-shaped into a Route Handler's module graph
// even when, as here, it's never called.
import { analyzeRun, type RunRecord } from '@runner/core/src/services/runAnalysis';
import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programs, runHistory } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { createRunSchema, parseJsonBody } from '@/lib/validation';

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const parsed = await parseJsonBody(request, createRunSchema);
  if (!parsed.ok) return parsed.response;
  const { startedAt, programId, program } = parsed.data;

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
  const data = { startedAt, telemetry: [], programId, programName, program };

  const result = await db.insert(runHistory).values({ userId, data }).returning({ id: runHistory.id });

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select({ id: runHistory.id, createdAt: runHistory.createdAt, data: runHistory.data })
    .from(runHistory)
    .where(eq(runHistory.userId, userId))
    .orderBy(desc(runHistory.createdAt))
    .limit(50);

  // The list view only needs summary stats, not the full (potentially large)
  // telemetry array — compute them server-side so that never has to cross
  // the wire just to render a list row.
  const summaries = result.map(({ id, createdAt, data }) => {
    const record = data as RunRecord;
    const endT = record.durationMs !== undefined ? record.durationMs / 1000 : undefined;
    return {
      id,
      createdAt,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      programName: record.programName,
      summary: analyzeRun(record.telemetry ?? [], { endT }),
    };
  });

  return NextResponse.json(summaries);
}
