import { NextResponse } from 'next/server';
import { revokeRefreshToken } from '@/lib/mobileAuth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const refreshToken = body?.refreshToken as string | undefined;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return NextResponse.json({ success: true });
}
