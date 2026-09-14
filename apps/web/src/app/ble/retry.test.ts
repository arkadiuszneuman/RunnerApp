import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectWithRetry } from './retry';

afterEach(() => vi.useRealTimers());

describe('connectWithRetry', () => {
  it('resolves without retrying when the first attempt succeeds', async () => {
    const attempt = vi.fn().mockResolvedValue(undefined);
    await connectWithRetry(attempt);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries once after the delay and resolves if the second attempt succeeds', async () => {
    vi.useFakeTimers();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error('not in range'))
      .mockResolvedValueOnce(undefined);

    const promise = connectWithRetry(attempt, 2500);
    await vi.advanceTimersByTimeAsync(2500);
    await promise;

    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('rethrows the first error when both attempts fail', async () => {
    vi.useFakeTimers();
    const firstError = new Error('first failure');
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(new Error('second failure'));

    // Attach the assertion (which subscribes to the promise) before advancing the fake
    // timers that make it settle — otherwise it rejects in a brief window with no handler
    // attached yet, which Node flags as an unhandled rejection.
    const assertion = expect(connectWithRetry(attempt, 2500)).rejects.toBe(firstError);
    await vi.advanceTimersByTimeAsync(2500);
    await assertion;

    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
