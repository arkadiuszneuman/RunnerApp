import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { normalizeEmail } from '@/lib/normalizeEmail';
import { isRateLimited, rateLimitKey } from '@/lib/rateLimit';
import { parseJsonBody, registerSchema } from '@/lib/validation';

export async function POST(request: Request) {
  if (isRateLimited(rateLimitKey(request, 'register'), { windowMs: 10 * 60_000, max: 10 })) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, registerSchema);
  if (!parsed.ok) return parsed.response;
  const { name, password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    name,
    email,
    password: hashedPassword,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
