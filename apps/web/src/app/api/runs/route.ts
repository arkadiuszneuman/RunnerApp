import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { runHistory } from '@/lib/db/schema';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const data = await request.json();

  const result = await db
    .insert(runHistory)
    .values({ userId: session.user.id, data })
    .returning({ id: runHistory.id });

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select()
    .from(runHistory)
    .where(eq(runHistory.userId, session.user.id))
    .orderBy(desc(runHistory.createdAt))
    .limit(50);

  return NextResponse.json(result.map((r) => r.data));
}
