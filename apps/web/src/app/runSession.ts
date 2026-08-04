import { RunSession, type RunApi } from '@runner/core';
import axios from 'axios';
import BleManager from './BleManager';
import { store } from './store';

const api: RunApi = {
  async createRun(startedAt) {
    const { data } = await axios.post('/api/runs', { startedAt });
    return { id: data.id };
  },
  async patchRun(id, payload) {
    await axios.patch(`/api/runs/${id}`, payload);
  },
};

export const runSession = new RunSession({ store, treadmill: BleManager, api });
