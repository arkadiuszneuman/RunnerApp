import { runningStateAtom } from '@runner/core';
import type { createStore } from 'jotai/vanilla';

/**
 * Calls `onEnd` once for every `running: true` → `running: false` transition of
 * `runningStateAtom` — regardless of which code path caused it (Stop button, a program
 * finishing without cooldown, the treadmill reporting btStopped/btDisconnected, ...). Used by
 * runSession.ts to clear the native foreground-service notification ("Training in progress")
 * without RunSession itself (framework/platform-agnostic by design) needing to know about it.
 * Does NOT catch a start() that never actually started (state stays running:false throughout) —
 * see the `!store.get(runningStateAtom).running` check after `runSession.start()` in
 * useRunningLoop.ts for that case.
 */
export function watchRunEnd(store: ReturnType<typeof createStore>, onEnd: () => void): () => void {
  let wasRunning = store.get(runningStateAtom).running;
  return store.sub(runningStateAtom, () => {
    const running = store.get(runningStateAtom).running;
    if (wasRunning && !running) onEnd();
    wasRunning = running;
  });
}
