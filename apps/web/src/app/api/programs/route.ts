import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { parseJsonBody, programDataSchema } from '@/lib/validation';

const createProgramSchema = z.object({
  /** Optional client-generated id, so a program created offline can be queued and replayed idempotently. */
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  data: programDataSchema.optional(),
});

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select({ id: programs.id, name: programs.name, updatedAt: programs.updatedAt })
    .from(programs)
    .where(eq(programs.userId, userId))
    .orderBy(desc(programs.updatedAt));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const parsed = await parseJsonBody(request, createProgramSchema);
  if (!parsed.ok) return parsed.response;
  const { id, name, data } = parsed.data;

  const result = await db
    .insert(programs)
    .values({
      ...(id && { id }),
      userId,
      name,
      data: data ?? { stages: [], cooldown: false },
    })
    .onConflictDoNothing({ target: programs.id })
    .returning({ id: programs.id });

  if (result.length === 0) {
    // Replayed create (see createRunSchema's id in lib/validation.ts): fine if
    // it's this user's own row, a conflict otherwise.
    const existing = await db
      .select({ id: programs.id })
      .from(programs)
      .where(and(eq(programs.id, id!), eq(programs.userId, userId)))
      .limit(1);
    return existing.length > 0
      ? NextResponse.json({ id }, { status: 200 })
      : NextResponse.json({ error: 'Id already in use' }, { status: 409 });
  }

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}
