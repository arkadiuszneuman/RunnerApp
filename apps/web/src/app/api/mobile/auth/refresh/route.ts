import { NextResponse } from 'next/server';
import { rotateRefreshToken } from '@/lib/mobileAuth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refreshToken = body?.refreshToken as string | undefined;
  if (!refreshToken) return NextResponse.json({ error: 'refreshToken is required' }, { status: 400 });

  const result = await rotateRefreshToken(refreshToken);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 });

  return NextResponse.json(result.pair);
}
