import { NextResponse } from 'next/server';
import { z } from 'zod';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Reads and validates a JSON request body in one step. Both malformed JSON
 * and schema violations come back as a ready-to-return 400 response instead
 * of throwing — every route handler that used to do a bare `await
 * request.json()` (and would 500 on non-JSON input, or happily persist any
 * shape at all) should go through this instead.
 */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid request body', issues: result.error.issues.map((issue) => issue.message) },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}

// ─── Shared domain shapes ───────────────────────────────────────────────────
//
// programs.data and run_history.data are schemaless JSONB (see
// apps/web/src/lib/db/schema.ts), so these mirror the corresponding
// packages/core types closely enough to reject garbage and cap array sizes,
// without trying to be a byte-for-byte re-encoding of the TS types (that
// would just be a second place for the shapes to drift out of sync).

/** Mirrors Timespan's toJSON() shape — see packages/core/src/services/Timespan.ts. */
const timespanJsonSchema = z.object({ totalMilliseconds: z.number() });

/** Loosely mirrors packages/core/src/services/stagesCalculator.ts's Stage type. */
const stageSchema = z.object({
  type: z.enum(['simple', 'sprint', 'regeneration']),
  speedType: z.enum(['bmp', 'tempo']),
  duration: timespanJsonSchema,
  bmp: z.number().optional(),
  tempo: timespanJsonSchema.optional(),
});

/** Loosely mirrors MultiplyStage. */
const multiplyStageSchema = z.object({
  times: z.number().int().positive().max(1000),
  stages: z.array(stageSchema).max(200),
  id: z.string().optional(),
});

/** Mirrors the programs.data JSONB shape: `{ stages: MultiplyStage[], cooldown: boolean }`. */
export const programDataSchema = z.object({
  stages: z.array(multiplyStageSchema).max(200),
  cooldown: z.boolean(),
});

/** Mirrors packages/core/src/types/telemetry.ts's TelemetryPoint. */
const telemetryPointSchema = z.object({
  t: z.number(),
  hr: z.number(),
  thr: z.number(),
  phr: z.number(),
  spd: z.number(),
  aspd: z.number().optional(),
  inc: z.number(),
  si: z.number(),
  err: z.number(),
});

/** Body of RunApi.createRun (see packages/core/src/session/RunSession.ts) — POST /api/runs. */
export const createRunSchema = z.object({
  /**
   * Optional client-generated id. The web client always sends one, so a run
   * started offline can be queued (and its telemetry PATCHes addressed)
   * before the server has ever seen it — and so a replayed create is
   * idempotent rather than a duplicate row.
   */
  id: z.uuid().optional(),
  startedAt: z.string().min(1),
  programId: z.string().min(1).nullable().optional(),
  program: programDataSchema.optional(),
  controller: z.enum(['legacy', 'adaptive']).optional(),
});

/** Body of RunApi.patchRun — PATCH /api/runs/:id, sent on every telemetry flush. */
export const patchRunSchema = z.object({
  startedAt: z.string().min(1).optional(),
  finishedAt: z.string().min(1).optional(),
  durationMs: z.number().nonnegative().optional(),
  telemetry: z.array(telemetryPointSchema).max(20_000),
});

/** Body of POST /api/register. 72 is bcrypt's own input cap — longer input is silently truncated. */
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});
