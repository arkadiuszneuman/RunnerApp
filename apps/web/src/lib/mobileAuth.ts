import { and, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { mobileRefreshTokens } from './db/schema';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './mobileTokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Mints a fresh access/refresh pair, starting a new refresh-token family. */
export async function issueTokenPair(userId: string): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  const familyId = crypto.randomUUID();

  await db.insert(mobileRefreshTokens).values({
    userId,
    familyId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return {
    accessToken: await signAccessToken(userId),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export type RotateResult =
  | { ok: true; pair: TokenPair }
  | { ok: false; reason: 'invalid' | 'expired' | 'reused' };

/**
 * Rotates a refresh token: the presented token is revoked and a new one is
 * issued in the same family. Presenting a token that was already revoked is
 * treated as theft/replay — the entire family is revoked so every derived
 * token stops working, forcing a fresh login.
 */
export async function rotateRefreshToken(token: string): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(token);

  const [row] = await db
    .select()
    .from(mobileRefreshTokens)
    .where(eq(mobileRefreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) return { ok: false, reason: 'invalid' };

  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const newRefreshToken = generateRefreshToken();

  const result = await db.transaction(async (tx) => {
    // Atomically claim this token: the WHERE clause means only one of any
    // concurrent callers can flip revoked_at from NULL. If two requests race
    // to rotate the same token (e.g. a retried request after a slow/lost
    // response), the loser sees zero rows updated here instead of both
    // successfully rotating — which would otherwise mint two valid token
    // pairs from what should be a single-use token.
    const claimed = await tx
      .update(mobileRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(mobileRefreshTokens.id, row.id), isNull(mobileRefreshTokens.revokedAt)))
      .returning({ id: mobileRefreshTokens.id });

    if (claimed.length === 0) {
      // Already revoked by a previous rotation (or another concurrent one) —
      // treat as theft/replay and kill the whole family.
      await tx
        .update(mobileRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(mobileRefreshTokens.familyId, row.familyId), isNull(mobileRefreshTokens.revokedAt)));
      return { ok: false as const, reason: 'reused' as const };
    }

    await tx.insert(mobileRefreshTokens).values({
      userId: row.userId,
      familyId: row.familyId,
      tokenHash: hashRefreshToken(newRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { ok: true as const };
  });

  if (!result.ok) return result;

  return {
    ok: true,
    pair: {
      accessToken: await signAccessToken(row.userId),
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
  };
}

/** Revokes a single refresh token (logout on one device). No-op if unknown. */
export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(mobileRefreshTokens.tokenHash, hashRefreshToken(token)));
}
