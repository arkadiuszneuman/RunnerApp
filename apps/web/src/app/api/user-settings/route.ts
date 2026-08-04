import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);

  const data = result[0]?.data ?? {};
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const data = await request.json();

  await db
    .insert(userSettings)
    .values({ userId, data })
    .onConflictDoUpdate({ target: userSettings.userId, set: { data } });

  return NextResponse.json({ success: true });
}
