import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';

export interface VerifiedUser {
  id: string;
  name: string | null;
  email: string | null;
}

// A precomputed bcrypt hash of an unused, unguessable string — never the hash
// of a real password. Compared against below when no user/password is found,
// so a lookup for a non-existent (or Google-only, no-password) account still
// pays the ~bcrypt cost instead of returning near-instantly. Without this, an
// attacker can enumerate registered email addresses by timing responses.
const DUMMY_PASSWORD_HASH = '$2b$12$DIYZOqRU2pSt1QUJxskM6OIsl7FTydbzc30.L7oM9XlhmU./6LK3K';

/** Shared by the Auth.js Credentials provider and the mobile credentials endpoint. */
export async function verifyCredentials(email: string, password: string): Promise<VerifiedUser | null> {
  const user = await db.select().from(users).where(eq(users.email, email)).limit(1).then((r) => r[0]);

  const isValid = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
  if (!user?.password || !isValid) return null;

  return { id: user.id, name: user.name, email: user.email };
}
