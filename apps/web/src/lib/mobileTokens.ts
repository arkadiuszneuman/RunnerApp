import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenClaims {
  sub: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error('MOBILE_JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

/**
 * Signs a short-lived access token for the mobile app. Uses a dedicated secret
 * (not AUTH_SECRET) so rotating mobile tokens doesn't invalidate web sessions,
 * and vice versa.
 */
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Returns null for a missing, malformed, expired, or badly-signed token — never throws. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

/** Opaque 32 random bytes, base64url. Returned to the client; only its hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
