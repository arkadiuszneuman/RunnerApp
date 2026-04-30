import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { programs } from '@/lib/db/schema';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const { id } = await params;

  const result = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, session.user.id)))
    .limit(1);

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(result[0]);
}

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.data !== undefined) updates.data = body.data;

  const result = await db
    .update(programs)
    .set(updates)
    .where(and(eq(programs.id, id), eq(programs.userId, session.user.id)))
    .returning({ id: programs.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id: result[0].id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const { id } = await params;

  const result = await db
    .delete(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, session.user.id)))
    .returning({ id: programs.id });

  if (result.length === 0) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id: result[0].id });
}
