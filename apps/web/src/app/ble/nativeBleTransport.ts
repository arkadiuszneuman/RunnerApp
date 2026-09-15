import type { BleTransport } from '@runner/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { pickNativeDevice } from './nativeDevicePicker';
import { ensureNativeBleInitialized } from './platform';
import {
  forget as forgetRemembered,
  getRemembered,
  hasRemembered as hasRememberedDevice,
  remember,
} from './rememberedDevice';

export interface NativeBleTransportOptions {
  serviceUuid: string;
  readCharUuid: string;
  writeCharUuid: string;
  /** Passed to BleClient.requestDevice's picker filter. */
  namePrefix?: string;
  /** localStorage key used to remember the picked device across sessions. */
  storageKey: string;
}

export interface NativeBleConnectOptions {
  /** Force the device picker even if a device is already remembered — used by "Change device". */
  pick?: boolean;
  /**
   * Only try the remembered device — never falls back to the picker. Used for the silent
   * auto-reconnect on mount, which has no user gesture to spend on a picker anyway.
   */
  silent?: boolean;
}

/**
 * Capacitor/native-Android implementation of the transport-agnostic BleTransport interface —
 * the apps/android counterpart to WebBluetoothTransport (see ble/platform.ts for how the two are
 * chosen). The remembered device id is the Android BLE MAC address, so unlike Web Bluetooth
 * (which needs findRememberedDevice()'s getDevices()/watchAdvertisements() dance just to get
 * gatt.connect() to succeed), BleClient.connect(deviceId) can dial it directly — no scan, no
 * advertisement wait, no picker, no user gesture required for a silent reconnect.
 */
export class NativeBleTransport implements BleTransport {
  private deviceId: string | undefined;
  private connected = false;
  private connectPromise: Promise<void> | undefined;
  private notifyListeners: ((data: Uint8Array) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  constructor(private readonly opts: NativeBleTransportOptions) {}

  connect(options?: NativeBleConnectOptions): Promise<void> {
    // Deduplicate concurrent calls — return the in-flight promise if one exists.
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect(options).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async _connect(options?: NativeBleConnectOptions): Promise<void> {
    await ensureNativeBleInitialized();
    if (this.connected) {
      await this.disconnect();
    }

    let deviceId = options?.pick ? undefined : getRemembered(this.opts.storageKey)?.id;
    if (!deviceId) {
      if (options?.silent) {
        throw new Error('NativeBleTransport: no remembered device to silently reconnect to');
      }
      const device = await pickNativeDevice({
        services: [this.opts.serviceUuid],
        namePrefix: this.opts.namePrefix,
      });
      deviceId = device.deviceId;
      remember(this.opts.storageKey, { id: device.deviceId, name: device.name });
    }

    try {
      await BleClient.connect(deviceId, () => {
        this.connected = false;
        this.disconnectListeners.forEach((cb) => cb());
      });
      this.deviceId = deviceId;
      this.connected = true;
      await BleClient.startNotifications(
        deviceId,
        this.opts.serviceUuid,
        this.opts.readCharUuid,
        (value) => {
          const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          this.notifyListeners.forEach((cb) => cb(bytes));
        }
      );
    } catch (error) {
      // Keep the remembered device — a treadmill that's simply off or out of range
      // shouldn't need re-pairing, just a working connection attempt later.
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.deviceId) return;
    this.connected = false;
    try {
      await BleClient.stopNotifications(
        this.deviceId,
        this.opts.serviceUuid,
        this.opts.readCharUuid
      );
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

  async write(data: Uint8Array): Promise<void> {
    if (!this.deviceId || !this.connected) {
      throw new Error('NativeBleTransport: not connected');
    }
    await BleClient.write(
      this.deviceId,
      this.opts.serviceUuid,
      this.opts.writeCharUuid,
      dataViewFrom(data)
    );
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

/** BleClient.write wants a DataView backed by its own ArrayBuffer, not a view into a shared one. */
function dataViewFrom(data: Uint8Array): DataView {
  return new DataView(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  );
}
