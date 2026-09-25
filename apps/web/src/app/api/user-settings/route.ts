import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MAX_BPM,
  MAX_CALIBRATION_POINTS,
  MAX_SPEED_KMH,
  MIN_BPM,
  MIN_SPEED_KMH,
} from '@runner/core/src/training/speedCalibration';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { parseJsonBody } from '@/lib/validation';

/** Mirrors packages/core's SpeedCalibration (see training/speedCalibration.ts). */
const speedCalibrationSchema = z.object({
  points: z
    .array(
      z.object({
        bpm: z.number().min(MIN_BPM).max(MAX_BPM),
        speed: z.number().min(MIN_SPEED_KMH).max(MAX_SPEED_KMH),
        at: z.string().min(1).max(40),
      })
    )
    .max(MAX_CALIBRATION_POINTS),
});

// Every field is optional: each writer sends only what it owns (the programs list sends
// activeProgramId, the run-end learning sends speedCalibration), and PUT merges them into the
// stored blob instead of replacing it — see below.
const userSettingsSchema = z.object({
  activeProgramId: z.uuid().nullable().optional(),
  speedCalibration: speedCalibrationSchema.optional(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const data = result[0]?.data ?? {};
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const parsed = await parseJsonBody(request, userSettingsSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  // `||` on jsonb merges top-level keys atomically in the database, so one writer never wipes
  // out a field another owns. JSON.stringify drops undefined fields; an explicit
  // `activeProgramId: null` is kept (and clears it).
  await db
    .insert(userSettings)
    .values({ userId, data })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { data: sql`${userSettings.data} || ${JSON.stringify(data)}::jsonb` },
    });

  return NextResponse.json({ success: true });
}
