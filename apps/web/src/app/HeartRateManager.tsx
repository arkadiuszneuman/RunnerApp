import { HeartRateMonitor } from '@runner/core';
import { WebHeartRateTransport } from './ble/webHeartRateTransport';

export type HeartRateData = {
  heartRate: number;
};

const transport = new WebHeartRateTransport({ storageKey: 'heartRateDeviceId' });
const monitor = new HeartRateMonitor({ transport });

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
