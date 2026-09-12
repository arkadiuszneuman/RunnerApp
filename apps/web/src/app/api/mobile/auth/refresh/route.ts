import { NextResponse } from 'next/server';
import { rotateRefreshToken } from '@/lib/mobileAuth';
import { isRateLimited, rateLimitKey } from '@/lib/rateLimit';

export async function POST(request: Request) {
  if (isRateLimited(rateLimitKey(request, 'mobile-refresh'), { windowMs: 5 * 60_000, max: 30 })) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const refreshToken = body?.refreshToken as string | undefined;
  if (!refreshToken) return NextResponse.json({ error: 'refreshToken is required' }, { status: 400 });

  const result = await rotateRefreshToken(refreshToken);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 });

  return NextResponse.json(result.pair);
}
