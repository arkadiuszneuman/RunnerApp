import { RunSession, type RunApi } from '@runner/core';
import TreadmillManager from '@/ble/treadmillManager';
import { client } from '@/api/client';
import { store } from '@/store';

const api: RunApi = {
  async createRun(startedAt) {
    const { data } = await client.post('/api/runs', { startedAt });
    return { id: data.id };
  },
  async patchRun(id, payload) {
    await client.patch(`/api/runs/${id}`, payload);
  },
};

export const runSession = new RunSession({ store, treadmill: TreadmillManager, api });
