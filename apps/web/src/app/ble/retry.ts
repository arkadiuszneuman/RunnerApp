/**
 * Retries an async connect attempt once after a short delay. A remembered device
 * sometimes can't be reached the instant the page loads — the OS/browser hasn't
 * "seen" it advertise yet, or the previous session's GATT link hasn't fully torn
 * down — but succeeds moments later. This is what makes a manual retry (clicking
 * Connect again) work when an automatic attempt on mount didn't; giving the silent
 * auto-reconnect the same second chance closes that gap.
 *
 * Rethrows the *first* error if both attempts fail — it's the more informative one
 * (the second attempt often fails for the boring reason that the first is still
 * mid-flight/left something torn down).
 */
export async function connectWithRetry(
  attempt: () => Promise<void>,
  delayMs = 2500
): Promise<void> {
  try {
    await attempt();
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      await attempt();
    } catch {
      throw firstError;
    }
  }
}
