import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { parseJsonBody, programDataSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const updateProgramSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  data: programDataSchema.optional(),
});

export async function GET(request: Request, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;

  const result = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, userId)))
    .limit(1);

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(result[0]);
}

export async function PUT(request: Request, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody(request, updateProgramSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.data !== undefined) updates.data = body.data;

  const result = await db
    .update(programs)
    .set(updates)
    .where(and(eq(programs.id, id), eq(programs.userId, userId)))
    .returning({ id: programs.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id: result[0].id });
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;

  const result = await db
    .delete(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, userId)))
    .returning({ id: programs.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id: result[0].id });
}
