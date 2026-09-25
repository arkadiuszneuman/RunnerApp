import { RunSession, speedCalibrationsEqual, type RunApi } from '@runner/core';
import BleManager from './BleManager';
import { stopRunBackground } from './nativeRunBackground';
import { writes } from './offline/requests';
import { enqueueWrite } from './offline/sync';
import { watchRunEnd } from './runEndWatcher';
import { currentCalibration, learnFromRun, speedHint } from './speedCalibrationStore';
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
  // Read live (per bmp target, not just once) so a calibration learned mid-session — or on
  // another device, synced back by the next sign-in's seeding — is picked up immediately. See
  // speedCalibrationStore.ts / AdaptiveTraining.ts's ramp-to-hint behavior.
  speedHint,
});

// See runEndWatcher.ts: clears the native foreground-service notification on every path a run
// can end, not just the Stop button. No-op outside the native shell.
watchRunEnd(store, () => void stopRunBackground());

// Learns this runner's actual speed-to-heart-rate calibration from every finished run, for
// speedHint above to use on the next one. Same "any way the run can end" coverage as the
// notification watcher.
watchRunEnd(store, () => {
  const before = currentCalibration();
  const after = learnFromRun(runSession.telemetry);
  // The device cache is updated already; the server copy (source of truth, shared with the
  // runner's other devices) goes through the offline outbox like every other write, so a run
  // finished without a connection uploads its calibration later.
  if (!speedCalibrationsEqual(before, after)) void enqueueWrite(writes.setSpeedCalibration(after));
});
