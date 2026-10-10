import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for third-party credentials (e.g. a user's intervals.icu API key):
 * AES-256-GCM with a random IV per value, and the owning user id as additional authenticated data,
 * so a ciphertext copied onto another user's row fails to decrypt instead of granting access.
 *
 * The key is `INTEGRATIONS_ENCRYPTION_KEY` (32 bytes, base64) when set, otherwise derived from
 * `AUTH_SECRET` with HKDF — so a deployment works without extra setup, at the cost that rotating
 * AUTH_SECRET makes stored credentials unreadable (they then show as "reconnect needed"). It's read
 * on use, not at import: builds import route modules without any secrets configured.
 */

const FORMAT = 'v1';

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super('Neither INTEGRATIONS_ENCRYPTION_KEY nor AUTH_SECRET is set');
  }
}

function encryptionKey(): Buffer {
  const explicit = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (explicit) {
    const key = Buffer.from(explicit, 'base64');
    if (key.length !== 32)
      throw new Error('INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return key;
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new MissingEncryptionKeyError();
  return Buffer.from(hkdfSync('sha256', secret, 'runnerapp', 'integrations-encryption-v1', 32));
}

export function encryptSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [FORMAT, iv, cipher.getAuthTag(), ciphertext]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64')))
    .join(':');
}

/** The plain value, or null when it can't be decrypted (tampered, wrong user, rotated key). */
export function decryptSecret(stored: string, aad: string): string | null {
  const [format, iv, tag, ciphertext] = stored.split(':');
  if (format !== FORMAT || !iv || !tag || ciphertext === undefined) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof MissingEncryptionKeyError) throw error;
    return null;
  }
}
