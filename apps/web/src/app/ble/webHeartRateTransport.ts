/// <reference types="@types/web-bluetooth" />
import type { BleTransport } from '@runner/core';
import {
  findRememberedDevice,
  forget as forgetRemembered,
  hasRemembered as hasRememberedDevice,
  pickDevice,
} from './rememberedDevice';

export interface WebHeartRateTransportOptions {
  /** localStorage key used to remember the picked device across sessions. */
  storageKey: string;
}

export interface WebHeartRateConnectOptions {
  /** Force the device picker even if a device is already remembered/connected — "Change device". */
  pick?: boolean;
  /**
   * Only try the remembered device — never falls back to the picker. Used for the silent
   * auto-reconnect on mount, which has no user gesture to spend on a picker anyway: without
   * this, a remembered device that findRememberedDevice() can't locate (no `getDevices()`
   * support, or the browser has forgotten the permission) would silently try to open the
   * picker, which the browser then rejects for lack of a gesture.
   */
  silent?: boolean;
}

/**
 * Web Bluetooth implementation of the standard BLE Heart Rate Profile.
 *
 * `connect()` only runs the device-picker/cache lookup the first time (when no
 * device has been selected yet, or `pick` forces a fresh one); a later call — e.g.
 * the automatic reconnect `HeartRateMonitor` triggers on a dropped link — reuses
 * the already-known device and just re-establishes GATT + re-arms notifications.
 * This is what keeps readings flowing after a reconnect instead of silently stopping.
 */
export class WebHeartRateTransport implements BleTransport {
  private device: BluetoothDevice | undefined;
  private char: BluetoothRemoteGATTCharacteristic | undefined;
  private connectPromise: Promise<void> | undefined;
  private notifyListeners: ((data: Uint8Array) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  private readonly notificationHandler = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic)?.value;
    if (!value) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.notifyListeners.forEach((cb) => cb(bytes));
  };

  private readonly gattDisconnectedHandler = () => {
    this.disconnectListeners.forEach((cb) => cb());
  };

  constructor(private readonly opts: WebHeartRateTransportOptions) {}

  connect(options?: WebHeartRateConnectOptions): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect(options).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async _connect(options?: WebHeartRateConnectOptions): Promise<void> {
    if (options?.pick) {
      // Switching devices mid-session — tear down the old link and forget it first.
      await this.disconnect();
    }

    if (!this.device) {
      let device = options?.pick ? undefined : await findRememberedDevice(this.opts.storageKey);
      if (!device) {
        if (options?.silent) {
          throw new Error('WebHeartRateTransport: no remembered device to silently reconnect to');
        }
        device = await pickDevice(this.opts.storageKey, {
          filters: [{ services: ['heart_rate'] }],
        });
      }
      this.device = device;
      this.device.addEventListener('gattserverdisconnected', this.gattDisconnectedHandler);
    }

    if (this.char) {
      this.char.removeEventListener('characteristicvaluechanged', this.notificationHandler);
      this.char = undefined;
    }

    const server = await this.device.gatt?.connect();
    const service = await server?.getPrimaryService('heart_rate');
    const char = await service?.getCharacteristic('heart_rate_measurement');
    if (!char) {
      throw new Error('WebHeartRateTransport: heart_rate_measurement characteristic not found');
    }
    this.char = char;
    char.addEventListener('characteristicvaluechanged', this.notificationHandler);
    await char.startNotifications();
  }

  async disconnect(): Promise<void> {
    if (this.char) {
      this.char.stopNotifications().catch(() => {});
      this.char.removeEventListener('characteristicvaluechanged', this.notificationHandler);
      this.char = undefined;
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.gattDisconnectedHandler);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    }
    this.device = undefined;
  }

  /** Disconnects, revokes the browser permission for the device, and forgets it. */
  async forget(): Promise<void> {
    const device = this.device;
    await this.disconnect();
    try {
      await device?.forget();
    } catch {
      // Not supported everywhere — the remembered id below is what actually matters to us.
    }
    forgetRemembered(this.opts.storageKey);
  }

  hasRemembered(): boolean {
    return hasRememberedDevice(this.opts.storageKey);
  }

  isConnected(): boolean {
    return this.device?.gatt?.connected ?? false;
  }

  async write(): Promise<void> {
    throw new Error('WebHeartRateTransport is read-only');
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
