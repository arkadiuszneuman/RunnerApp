import { HeartRateMonitor } from '@runner/core';
import { BlePlxTransport } from './blePlxTransport';

const S_HEART_RATE = '0000180d-0000-1000-8000-00805f9b34fb';
const C_HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

const transport = new BlePlxTransport({
  serviceUuid: S_HEART_RATE,
  readCharUuid: C_HEART_RATE_MEASUREMENT,
  storageKey: 'heartRateDeviceId',
});

const monitor = new HeartRateMonitor({ transport });

export type HeartRateData = {
  heartRate: number;
};

const HeartRateManager = {
  isConnected(): boolean {
    return monitor.isConnected();
  },

  async requestDevice(): Promise<void> {
    await monitor.attach();
    await transport.connect();
  },

  subscribe(callback: (data: HeartRateData) => void): () => void {
    return monitor.subscribe((bpm) => callback({ heartRate: bpm }));
  },
};

export default HeartRateManager;
