import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getUserId } from '@/lib/session';

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json(null, { status: 401 });

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0]);
  if (!user) return NextResponse.json(null, { status: 404 });

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, image: user.image });
}
