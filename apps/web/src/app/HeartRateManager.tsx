import { HeartRateMonitor } from '@runner/core';
import { WebHeartRateTransport } from './ble/webHeartRateTransport';

export type HeartRateData = {
  heartRate: number;
};

export const HEART_RATE_STORAGE_KEY = 'heartRateDeviceId';

const transport = new WebHeartRateTransport({ storageKey: HEART_RATE_STORAGE_KEY });
const monitor = new HeartRateMonitor({ transport });

const connectionListeners = new Set<(connected: boolean) => void>();

function notifyConnection(connected: boolean): void {
  connectionListeners.forEach((cb) => cb(connected));
}

// A bpm reading is proof of a live link, so it doubles as a "connected" signal — this is
// what keeps the UI in sync with HeartRateMonitor's own internal auto-reconnect after a
// dropped link (attach()'s onDisconnect handler), which happens outside the connect calls below.
monitor.subscribe(() => notifyConnection(true));
transport.onDisconnect(() => notifyConnection(false));

const HeartRateManager = {
  isConnected(): boolean {
    return monitor.isConnected();
  },

  hasRemembered(): boolean {
    return transport.hasRemembered();
  },

  /** Connects using the remembered sensor if one exists, otherwise opens the device picker. */
  async connect(): Promise<void> {
    if (monitor.isConnected()) return;
    await monitor.attach();
    await transport.connect();
    notifyConnection(true);
  },

  /** Silent reconnect for the remembered sensor only — never opens the picker. */
  async connectRemembered(): Promise<void> {
    if (monitor.isConnected() || !transport.hasRemembered()) return;
    await monitor.attach();
    await transport.connect({ silent: true });
    notifyConnection(true);
  },

  /** Forces the device picker even if a sensor is already remembered or connected. */
  async changeDevice(): Promise<void> {
    await monitor.attach();
    await transport.connect({ pick: true });
    notifyConnection(true);
  },

  forgetDevice(): Promise<void> {
    return transport.forget();
  },

  subscribe(callback: (data: HeartRateData) => void): () => void {
    return monitor.subscribe((bpm) => callback({ heartRate: bpm }));
  },

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    connectionListeners.add(callback);
    return () => connectionListeners.delete(callback);
  },
};

export default HeartRateManager;
