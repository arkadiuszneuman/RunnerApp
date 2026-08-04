import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const result = await db
    .select({ id: programs.id, name: programs.name, updatedAt: programs.updatedAt })
    .from(programs)
    .where(eq(programs.userId, session.user.id))
    .orderBy(desc(programs.updatedAt));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const { name, data } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const result = await db
    .insert(programs)
    .values({
      userId: session.user.id,
      name: name.trim(),
      data: data ?? { stages: [], cooldown: false },
    })
    .returning({ id: programs.id });

  return NextResponse.json({ id: result[0].id }, { status: 201 });
}
