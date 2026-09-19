interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Every this many calls, sweep out already-expired buckets so `buckets` doesn't
// grow without bound on a long-running server fielding requests from many
// distinct IPs. Purely a memory optimization — an expired bucket is already
// treated as absent by the resetAt check below, so this never changes a call's
// return value.
const SWEEP_INTERVAL = 1000;
let callsSinceSweep = 0;

export interface RateLimitOptions {
  /** Window length in ms. */
  windowMs: number;
  /** Max requests allowed per key within one window. */
  max: number;
}

/**
 * Minimal in-memory fixed-window rate limiter, keyed by a caller-supplied
 * string (see `rateLimitKey`). Deliberately simple — no external store.
 *
 * Caveat: this is per-process state. On a single long-running Node server
 * (e.g. `next start`, or this app's Docker/self-hosted deploy) it works as
 * expected; on a multi-instance or serverless deployment (Vercel functions)
 * each instance keeps its own counters, so it only throttles per-instance,
 * not globally. That's still meaningfully better than no limit at all, but
 * swap this for a shared store (Redis/Upstash) before relying on it as a
 * hard guarantee under real load.
 */
export function isRateLimited(key: string, { windowMs, max }: RateLimitOptions): boolean {
  const now = Date.now();

  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_INTERVAL) {
    callsSinceSweep = 0;
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > max;
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Builds a rate-limit key scoped to one route + the caller's IP. */
export function rateLimitKey(request: Request, route: string): string {
  return `${route}:${clientIp(request)}`;
}
