import { NextResponse } from 'next/server';
import { syncIntervals } from '@/lib/intervals/sync';
import { isRateLimited } from '@/lib/rateLimit';
import { getUserId } from '@/lib/session';

// One pass works for ~40 s at most (see syncIntervals); this leaves headroom on every plan.
export const maxDuration = 60;

/**
 * One bounded pass of importing the user's runs from intervals.icu. The client repeats the call
 * while `remaining > 0` and nothing `stopped` it (see app/integrations/intervalsSync.ts).
 */
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });
  if (isRateLimited(`intervals-sync:${userId}`, { windowMs: 60_000, max: 20 })) {
    return NextResponse.json(
      { error: 'Too many sync requests. Try again later.' },
      { status: 429 }
    );
  }
  return NextResponse.json(await syncIntervals(userId));
}
