import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';

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

  const { name, data } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const result = await db
    .insert(programs)
    .values({
      userId,
      name: name.trim(),
      data: data ?? { stages: [], cooldown: false },
    })
    .returning({ id: programs.id });

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}
