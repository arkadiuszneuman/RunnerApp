import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';
import { parseJsonBody, programDataSchema } from '@/lib/validation';

const createProgramSchema = z.object({
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
  const { name, data } = parsed.data;

  const result = await db
    .insert(programs)
    .values({
      userId,
      name,
      data: data ?? { stages: [], cooldown: false },
    })
    .returning({ id: programs.id });

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}
