import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRateLimited, rateLimitKey } from './rateLimit';

function fakeRequest(ip: string): Request {
  return new Request('http://localhost/api/example', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('rateLimitKey', () => {
  it('scopes the key to both the route and the caller IP', () => {
    const a = rateLimitKey(fakeRequest('1.2.3.4'), 'register');
    const b = rateLimitKey(fakeRequest('5.6.7.8'), 'register');
    const c = rateLimitKey(fakeRequest('1.2.3.4'), 'login');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('takes only the first hop of a comma-separated x-forwarded-for chain', () => {
    const request = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
    });
    expect(rateLimitKey(request, 'r')).toBe('r:1.2.3.4');
  });

  it('falls back to x-real-ip, then "unknown"', () => {
    const withRealIp = new Request('http://localhost/', { headers: { 'x-real-ip': '1.1.1.1' } });
    expect(rateLimitKey(withRealIp, 'r')).toBe('r:1.1.1.1');

    const withNeither = new Request('http://localhost/');
    expect(rateLimitKey(withNeither, 'r')).toBe('r:unknown');
  });
});

describe('isRateLimited', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to `max` requests per key within the window, then blocks', () => {
    const key = `test-${Math.random()}`;
    const opts = { windowMs: 1000, max: 3 };

    expect(isRateLimited(key, opts)).toBe(false); // 1
    expect(isRateLimited(key, opts)).toBe(false); // 2
    expect(isRateLimited(key, opts)).toBe(false); // 3
    expect(isRateLimited(key, opts)).toBe(true); // 4 — over the limit
    expect(isRateLimited(key, opts)).toBe(true); // still blocked
  });

  it('resets once the window has elapsed', () => {
    const key = `test-${Math.random()}`;
    const opts = { windowMs: 1000, max: 1 };

    expect(isRateLimited(key, opts)).toBe(false);
    expect(isRateLimited(key, opts)).toBe(true);

    vi.advanceTimersByTime(1001);

    expect(isRateLimited(key, opts)).toBe(false);
  });

  it('tracks independent keys separately', () => {
    const opts = { windowMs: 1000, max: 1 };
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;

    expect(isRateLimited(keyA, opts)).toBe(false);
    expect(isRateLimited(keyA, opts)).toBe(true);
    expect(isRateLimited(keyB, opts)).toBe(false);
  });

  it('sweeps out expired buckets without changing behavior for live ones', () => {
    // A bucket that's already expired by the time the periodic sweep runs.
    const staleKey = `stale-${Math.random()}`;
    expect(isRateLimited(staleKey, { windowMs: 10, max: 1 })).toBe(false);
    vi.advanceTimersByTime(11);

    // A key created just before the sweep, still within its window, must
    // survive the sweep and keep counting normally.
    const liveKey = `live-${Math.random()}`;
    const liveOpts = { windowMs: 100_000, max: 2 };
    expect(isRateLimited(liveKey, liveOpts)).toBe(false); // 1

    // Drive enough distinct-key calls to cross the internal sweep interval.
    for (let i = 0; i < 1000; i++) {
      isRateLimited(`filler-${i}`, { windowMs: 10, max: 1 });
    }

    expect(isRateLimited(liveKey, liveOpts)).toBe(false); // 2, still within max
    expect(isRateLimited(liveKey, liveOpts)).toBe(true); // 3, over max

    // The stale key was swept and expired, so it starts a fresh window.
    expect(isRateLimited(staleKey, { windowMs: 10, max: 1 })).toBe(false);
  });
});
