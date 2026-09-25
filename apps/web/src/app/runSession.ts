import { RunSession, type RunApi } from '@runner/core';
import BleManager from './BleManager';
import { stopRunBackground } from './nativeRunBackground';
import { writes } from './offline/requests';
import { enqueueWrite } from './offline/sync';
import { watchRunEnd } from './runEndWatcher';
import { store } from './store';

/**
 * Run persistence goes through the offline queue: a run needs no network to
 * start or record — its id is generated here, the create and every telemetry
 * flush are persisted locally first, and delivered in order whenever the
 * server is reachable (see offline/sync.ts). The history list is refreshed
 * once they land (offline/useOfflineSync.ts).
 */
const api: RunApi = {
  async createRun(startedAt, meta) {
    const id = crypto.randomUUID();
    void enqueueWrite(writes.createRun(id, startedAt, meta));
    return { id };
  },
  patchRun(id, payload) {
    return enqueueWrite(writes.patchRun(id, payload));
  },
};

export const runSession = new RunSession({
  store,
  treadmill: BleManager,
  api,
  logger: (message) => console.warn(message),
});

// See runEndWatcher.ts: clears the native foreground-service notification on every path a run
// can end, not just the Stop button. No-op outside the native shell.
watchRunEnd(store, () => void stopRunBackground());
