// @vitest-environment node
//
// jose's webcrypto path does an `instanceof Uint8Array` check; jsdom (this
// project's default test environment) has its own realm with a distinct
// Uint8Array, so a `new TextEncoder().encode(...)` built under jsdom fails
// that check even though the exact same code works fine in the real Node
// runtime this module actually runs in. Force plain Node for this file.
import { SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './mobileTokens';

beforeAll(() => {
  process.env.MOBILE_JWT_SECRET = 'test-secret-not-for-production-use-only';
});

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips the subject', async () => {
    const token = await signAccessToken('user-123');
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual({ sub: 'user-123' });
  });

  it('rejects a malformed token', async () => {
    expect(await verifyAccessToken('not-a-jwt')).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const secretKey = new TextEncoder().encode('a-completely-different-secret');
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('attacker')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const secretKey = new TextEncoder().encode(process.env.MOBILE_JWT_SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secretKey);

    expect(await verifyAccessToken(expired)).toBeNull();
  });

  it('rejects a correctly-signed token from a different issuer/audience', async () => {
    // e.g. a token minted by some other consumer of the same secret, or by
    // this same code before issuer/audience were added — must not be usable.
    const secretKey = new TextEncoder().encode(process.env.MOBILE_JWT_SECRET);
    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-123')
      .setIssuer('some-other-service')
      .setAudience('some-other-service')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    expect(await verifyAccessToken(wrongAudience)).toBeNull();
  });
});
