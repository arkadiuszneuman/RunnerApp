import { auth } from './auth';

/** Resolves the current user id from the web session cookie, or null if unauthenticated. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
