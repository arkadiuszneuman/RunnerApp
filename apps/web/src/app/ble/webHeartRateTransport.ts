/// <reference types="@types/web-bluetooth" />
import type { BleTransport } from '@runner/core';

export interface WebHeartRateTransportOptions {
  /** localStorage key used to remember the picked device across sessions. */
  storageKey: string;
}

/**
 * Web Bluetooth implementation of the standard BLE Heart Rate Profile.
 *
 * `connect()` only runs the device-picker/cache lookup the first time (when no
 * device has been selected yet); a later call — e.g. the automatic reconnect
 * `HeartRateMonitor` triggers on a dropped link — reuses the already-known
 * device and just re-establishes GATT + re-arms notifications. This is what
 * keeps readings flowing after a reconnect instead of silently stopping.
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

  connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect().finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async _connect(): Promise<void> {
    if (!this.device) {
      const savedDeviceId = localStorage.getItem(this.opts.storageKey);
      if (savedDeviceId && navigator.bluetooth.getDevices) {
        const devices = await navigator.bluetooth.getDevices();
        this.device = devices.find((d) => d.id === savedDeviceId);
      }
      if (!this.device) {
        this.device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ['heart_rate'] }],
        });
        localStorage.setItem(this.opts.storageKey, this.device.id);
      }
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
