import type { BleTransport } from '@runner/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import { ensureNativeBleInitialized } from './platform';
import {
  forget as forgetRemembered,
  getRemembered,
  hasRemembered as hasRememberedDevice,
  remember,
} from './rememberedDevice';

const S_HEART_RATE = numberToUUID(0x180d);
const C_HEART_RATE_MEASUREMENT = numberToUUID(0x2a37);

export interface NativeHeartRateTransportOptions {
  /** localStorage key used to remember the picked device across sessions. */
  storageKey: string;
}

export interface NativeHeartRateConnectOptions {
  /** Force the device picker even if a device is already remembered/connected — "Change device". */
  pick?: boolean;
  /**
   * Only try the remembered device — never falls back to the picker. Used for the silent
   * auto-reconnect on mount, which has no user gesture to spend on a picker anyway.
   */
  silent?: boolean;
}

/**
 * Capacitor/native-Android implementation of the standard BLE Heart Rate Profile — the
 * apps/android counterpart to WebHeartRateTransport (see ble/platform.ts for how the two are
 * chosen). Connects directly to the remembered device's Android BLE MAC address, no scan needed.
 */
export class NativeHeartRateTransport implements BleTransport {
  private deviceId: string | undefined;
  private connected = false;
  private connectPromise: Promise<void> | undefined;
  private notifyListeners: ((data: Uint8Array) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  constructor(private readonly opts: NativeHeartRateTransportOptions) {}

  connect(options?: NativeHeartRateConnectOptions): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect(options).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async _connect(options?: NativeHeartRateConnectOptions): Promise<void> {
    await ensureNativeBleInitialized();
    if (options?.pick) {
      // Switching devices mid-session — tear down the old link and forget it first.
      await this.disconnect();
      this.deviceId = undefined;
    }

    let deviceId = this.deviceId;
    if (!deviceId) {
      deviceId = options?.pick ? undefined : getRemembered(this.opts.storageKey)?.id;
      if (!deviceId) {
        if (options?.silent) {
          throw new Error(
            'NativeHeartRateTransport: no remembered device to silently reconnect to'
          );
        }
        const device = await BleClient.requestDevice({ services: [S_HEART_RATE] });
        deviceId = device.deviceId;
        remember(this.opts.storageKey, { id: device.deviceId, name: device.name ?? '' });
      }
    }

    await BleClient.connect(deviceId, () => {
      this.connected = false;
      this.disconnectListeners.forEach((cb) => cb());
    });
    this.deviceId = deviceId;
    this.connected = true;
    await BleClient.startNotifications(
      deviceId,
      S_HEART_RATE,
      C_HEART_RATE_MEASUREMENT,
      (value) => {
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        this.notifyListeners.forEach((cb) => cb(bytes));
      }
    );
  }

  async disconnect(): Promise<void> {
    if (!this.deviceId) return;
    this.connected = false;
    try {
      await BleClient.stopNotifications(this.deviceId, S_HEART_RATE, C_HEART_RATE_MEASUREMENT);
    } catch {
      // Already gone — fine.
    }
    try {
      await BleClient.disconnect(this.deviceId);
    } catch {
      // Already disconnected — fine.
    }
  }

  /** Disconnects and forgets the remembered device id. */
  async forget(): Promise<void> {
    await this.disconnect();
    forgetRemembered(this.opts.storageKey);
    this.deviceId = undefined;
  }

  hasRemembered(): boolean {
    return hasRememberedDevice(this.opts.storageKey);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async write(): Promise<void> {
    throw new Error('NativeHeartRateTransport is read-only');
  }

  onNotify(cb: (data: Uint8Array) => void): () => void {
    this.notifyListeners.push(cb);
    return () => {
      this.notifyListeners = this.notifyListeners.filter((listener) => listener !== cb);
    };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((listener) => listener !== cb);
    };
  }
}
