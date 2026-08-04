import { auth } from './auth';
import { verifyAccessToken } from './mobileTokens';

/**
 * Resolves the current user id from either a mobile Bearer token or a web
 * session cookie. Bearer is checked first and is authoritative: if an
 * Authorization header is present but invalid, this returns null rather than
 * silently falling back to a cookie.
 */
export async function getUserId(request?: Request): Promise<string | null> {
  const header = request?.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const claims = await verifyAccessToken(header.slice(7).trim());
    return claims?.sub ?? null;
  }

  const session = await auth();
  return session?.user?.id ?? null;
}
