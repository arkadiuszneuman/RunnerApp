import { ACTIVITY_SPORTS, EFFORT_KEYS } from '@runner/core/src/activities/types';
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
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Invalid request body',
          issues: result.error.issues.map((issue) => issue.message),
        },
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
  startedAt: z.iso.datetime({ offset: true }),
  programId: z.string().min(1).nullable().optional(),
  /** Name of a temporary (unsaved) program — used only when there's no programId to look up. */
  programName: z.string().trim().min(1).max(200).optional(),
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

// ─── Imported watch activities ──────────────────────────────────────────────
//
// Mirrors packages/core/src/activities/types.ts's ImportedActivity. Uploads are parsed from FIT
// files in the browser (see app/import/), so everything here is untrusted input: numbers are
// bounded to what a run can plausibly produce and arrays are capped (one 5 s sample per entry
// covers ~27 h at 20 000).

const MAX_STREAM_LENGTH = 20_000;
const streamValue = z.number().nullable();

const activityStreamsSchema = z
  .object({
    t: z.array(z.number().min(0)).max(MAX_STREAM_LENGTH),
    d: z.array(streamValue).max(MAX_STREAM_LENGTH),
    hr: z.array(streamValue).max(MAX_STREAM_LENGTH),
    spd: z.array(streamValue).max(MAX_STREAM_LENGTH),
    alt: z.array(streamValue).max(MAX_STREAM_LENGTH),
    cad: z.array(streamValue).max(MAX_STREAM_LENGTH),
    lat: z.array(z.number().min(-90).max(90).nullable()).max(MAX_STREAM_LENGTH).optional(),
    lng: z.array(z.number().min(-180).max(180).nullable()).max(MAX_STREAM_LENGTH).optional(),
  })
  .refine(
    (s) =>
      [s.d, s.hr, s.spd, s.alt, s.cad, ...(s.lat ? [s.lat] : []), ...(s.lng ? [s.lng] : [])].every(
        (column) => column.length === s.t.length
      ),
    'Stream columns must all be as long as `t`'
  )
  .refine((s) => !s.lat === !s.lng, 'A route needs both `lat` and `lng`');

const activityMetricsSchema = z.object({
  distanceM: z.number().min(0).max(1_000_000),
  movingS: z
    .number()
    .min(0)
    .max(7 * 86_400),
  elapsedS: z
    .number()
    .min(0)
    .max(7 * 86_400),
  avgHr: z.number().min(0).max(300).optional(),
  maxHr: z.number().min(0).max(300).optional(),
  elevGainM: z.number().min(0).max(30_000).optional(),
  cadenceSpm: z.number().min(0).max(400).optional(),
  calories: z.number().min(0).max(50_000).optional(),
  trainingEffect: z.number().min(0).max(5).optional(),
  bestEfforts: z.partialRecord(
    z.enum(EFFORT_KEYS),
    z
      .number()
      .positive()
      .max(7 * 86_400)
  ),
  hrHist: z
    .object({ start: z.number().int().min(0).max(300), s: z.array(z.number().min(0)).max(300) })
    .optional(),
  splitsKmS: z.array(z.number().positive()).max(1_000).optional(),
  steady: z
    .object({
      speedMps: z.number().positive().max(15),
      hr: z.number().positive().max(300),
      seconds: z.number().positive(),
      gradePct: z.number().min(-50).max(50).optional(),
    })
    .optional(),
});

export const importedActivitySchema = z.object({
  startTime: z.iso.datetime(),
  tzOffsetMin: z
    .number()
    .int()
    .min(-14 * 60)
    .max(14 * 60)
    .optional(),
  sport: z.enum(ACTIVITY_SPORTS),
  name: z.string().max(200).optional(),
  device: z.string().max(100).optional(),
  dedupKey: z.string().min(1).max(100),
  garminId: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
  metrics: activityMetricsSchema,
  streams: activityStreamsSchema.optional(),
});

/** Body of POST /api/activities — one batch of browser-parsed uploads. */
export const importActivitiesSchema = z.object({
  activities: z.array(importedActivitySchema).min(1).max(100),
});

/** Body of PATCH /api/activities/:id — link to a run, or unlink with null. */
export const patchActivitySchema = z.object({
  linkedRunId: z.uuid().nullable(),
});
