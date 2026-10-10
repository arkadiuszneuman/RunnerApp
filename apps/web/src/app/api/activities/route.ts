import { NextResponse } from 'next/server';
import { importActivities, listActivities } from '@/lib/activities/repo';
import { getUserId } from '@/lib/session';
import { importActivitiesSchema, parseJsonBody } from '@/lib/validation';

/** Every imported watch activity of the user (summaries only — no samples), newest first. */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await listActivities(userId));
}

/**
 * One batch of activities parsed from uploaded FIT files in the browser (see app/import/).
 * Idempotent: activities already stored are recognised and reported as duplicates, and an
 * explicit re-upload restores one the user had deleted.
 */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const parsed = await parseJsonBody(request, importActivitiesSchema);
  if (!parsed.ok) return parsed.response;

  const result = await importActivities(userId, parsed.data.activities, {
    source: 'fit_upload',
    restoreDeleted: true,
  });
  return NextResponse.json({
    inserted: result.inserted.length,
    updated: result.updated.length,
    duplicates: result.duplicates,
  });
}
