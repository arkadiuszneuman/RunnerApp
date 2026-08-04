import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  const data = result[0]?.data ?? {};
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const data = await request.json();

  await db
    .insert(userSettings)
    .values({ userId: session.user.id, data })
    .onConflictDoUpdate({ target: userSettings.userId, set: { data } });

  return NextResponse.json({ success: true });
}
