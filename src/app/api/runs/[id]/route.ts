import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { runHistory } from '@/lib/db/schema';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const data = await request.json();

  const result = await db
    .update(runHistory)
    .set({ data })
    .where(and(eq(runHistory.id, id), eq(runHistory.userId, session.user.id)))
    .returning({ id: runHistory.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });

  return NextResponse.json({ id: result[0].id });
}
