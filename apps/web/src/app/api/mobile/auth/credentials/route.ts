import { NextResponse } from 'next/server';
import { issueTokenPair } from '@/lib/mobileAuth';
import { verifyCredentials } from '@/lib/verifyCredentials';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email as string | undefined;
  const password = body?.password as string | undefined;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const pair = await issueTokenPair(user.id);
  return NextResponse.json({ ...pair, user });
}
