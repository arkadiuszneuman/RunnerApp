import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';

export interface VerifiedUser {
  id: string;
  name: string | null;
  email: string | null;
}

/** Shared by the Auth.js Credentials provider and the mobile credentials endpoint. */
export async function verifyCredentials(email: string, password: string): Promise<VerifiedUser | null> {
  const user = await db.select().from(users).where(eq(users.email, email)).limit(1).then((r) => r[0]);
  if (!user?.password) return null;

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  return { id: user.id, name: user.name, email: user.email };
}
