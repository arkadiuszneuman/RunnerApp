import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './normalizeEmail';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail(' Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail('Foo@Example.com');
    expect(normalizeEmail(once)).toBe(once);
  });

  it('makes differently-cased/spaced inputs collide, so both resolve to one account', () => {
    const variants = ['foo@x.com', 'Foo@x.com', ' foo@x.com ', 'FOO@X.COM'];
    const normalized = new Set(variants.map(normalizeEmail));
    expect(normalized.size).toBe(1);
  });
});
