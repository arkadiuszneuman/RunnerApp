import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runHistory } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { parseJsonBody, patchRunSchema } from '@/lib/validation';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, patchRunSchema);
  if (!parsed.ok) return parsed.response;

  const result = await db
    .update(runHistory)
    .set({ data: parsed.data })
    .where(and(eq(runHistory.id, id), eq(runHistory.userId, userId)))
    .returning({ id: runHistory.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });

  return NextResponse.json({ id: result[0].id });
}
