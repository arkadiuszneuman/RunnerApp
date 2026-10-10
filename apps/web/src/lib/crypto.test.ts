// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptSecret, encryptSecret, MissingEncryptionKeyError } from './crypto';

describe('encryptSecret / decryptSecret', () => {
  beforeEach(() => {
    vi.stubEnv('INTEGRATIONS_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('round-trips, with a fresh IV every time', () => {
    const a = encryptSecret('my-api-key', 'user-1');
    const b = encryptSecret('my-api-key', 'user-1');
    expect(a).not.toBe(b);
    expect(a).not.toContain('my-api-key');
    expect(decryptSecret(a, 'user-1')).toBe('my-api-key');
  });

  it('refuses another user, tampering and a different key', () => {
    const stored = encryptSecret('my-api-key', 'user-1');
    expect(decryptSecret(stored, 'user-2')).toBeNull();
    const [format, iv, tag, ct] = stored.split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 1;
    expect(
      decryptSecret([format, iv, tag, flipped.toString('base64')].join(':'), 'user-1')
    ).toBeNull();
    expect(decryptSecret('garbage', 'user-1')).toBeNull();
    vi.stubEnv('INTEGRATIONS_ENCRYPTION_KEY', Buffer.alloc(32, 8).toString('base64'));
    expect(decryptSecret(stored, 'user-1')).toBeNull();
  });

  it('falls back to a key derived from AUTH_SECRET, and fails loudly with neither', () => {
    vi.stubEnv('INTEGRATIONS_ENCRYPTION_KEY', '');
    vi.stubEnv('AUTH_SECRET', 'some-auth-secret');
    expect(decryptSecret(encryptSecret('k', 'u'), 'u')).toBe('k');
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => encryptSecret('k', 'u')).toThrow(MissingEncryptionKeyError);
  });
});
