import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MissingEncryptionKeyError } from '@/lib/crypto';
import { connectIntervals, disconnectIntervals, getIntervalsStatus } from '@/lib/intervals/sync';
import { isRateLimited } from '@/lib/rateLimit';
import { getUserId } from '@/lib/session';
import { parseJsonBody } from '@/lib/validation';

/** intervals.icu personal API keys are short alphanumeric tokens. */
const connectSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid API key'),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await getIntervalsStatus(userId));
}

/** Connects (or reconnects) with the user's intervals.icu API key, verified before it's stored. */
export async function PUT(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });
  if (isRateLimited(`intervals-connect:${userId}`, { windowMs: 60_000, max: 5 })) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, connectSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await connectIntervals(userId, parsed.data.apiKey);
    if (!result.ok) {
      return result.error === 'invalid_key'
        ? NextResponse.json(
            { error: 'intervals.icu did not accept this API key.' },
            { status: 400 }
          )
        : NextResponse.json(
            { error: 'intervals.icu is unreachable. Try again later.' },
            { status: 502 }
          );
    }
    return NextResponse.json(result.status);
  } catch (error) {
    if (error instanceof MissingEncryptionKeyError) {
      return NextResponse.json(
        { error: 'The server is not configured for integrations.' },
        { status: 503 }
      );
    }
    throw error;
  }
}

export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });
  await disconnectIntervals(userId);
  return NextResponse.json({ connected: false });
}
