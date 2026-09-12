import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runHistory } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { createRunSchema, parseJsonBody } from '@/lib/validation';

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const parsed = await parseJsonBody(request, createRunSchema);
  if (!parsed.ok) return parsed.response;

  const result = await db
    .insert(runHistory)
    .values({ userId, data: parsed.data })
    .returning({ id: runHistory.id });

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select()
    .from(runHistory)
    .where(eq(runHistory.userId, userId))
    .orderBy(desc(runHistory.createdAt))
    .limit(50);

  return NextResponse.json(result.map((r) => r.data));
}
