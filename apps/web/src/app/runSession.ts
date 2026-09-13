import { RunSession, type RunApi } from '@runner/core';
import axios from 'axios';
import BleManager from './BleManager';
import { store } from './store';
import { refreshRuns } from './userData';

const api: RunApi = {
  async createRun(startedAt, meta) {
    const { data } = await axios.post('/api/runs', { startedAt, ...meta });
    // So a run started just now shows up in /runs immediately, rather than
    // only after the next full reload — best-effort, doesn't block the caller.
    void refreshRuns();
    return { id: data.id };
  },
  async patchRun(id, payload) {
    await axios.patch(`/api/runs/${id}`, payload);
    // A finishing patch is the one that makes summary stats (duration,
    // distance, …) meaningful in the history list — refresh it then, not on
    // every periodic mid-run telemetry flush.
    if (payload.finishedAt) void refreshRuns();
  },
};

export const runSession = new RunSession({
  store,
  treadmill: BleManager,
  api,
  logger: (message) => console.warn(message),
});
