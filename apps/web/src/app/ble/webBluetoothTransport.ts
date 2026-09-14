/// <reference types="@types/web-bluetooth" />
import type { BleTransport } from '@runner/core';
import {
  findRememberedDevice,
  forget as forgetRemembered,
  hasRemembered as hasRememberedDevice,
  pickDevice,
} from './rememberedDevice';

export interface WebBluetoothTransportOptions {
  serviceUuid: string;
  readCharUuid: string;
  writeCharUuid: string;
  filters: BluetoothLEScanFilter[];
  /** localStorage key used to remember the picked device across sessions. */
  storageKey: string;
}

export interface WebBluetoothConnectOptions {
  /** Force the device picker even if a device is already remembered — used by "Change device". */
  pick?: boolean;
}

/**
 * Web Bluetooth implementation of the transport-agnostic BleTransport interface.
 * Owns device discovery/picker, GATT connect/teardown, and DOM event wiring —
 * everything the protocol layer in @runner/core deliberately knows nothing about.
 */
export class WebBluetoothTransport implements BleTransport {
  private device: BluetoothDevice | undefined;
  private readChar: BluetoothRemoteGATTCharacteristic | undefined;
  private writeChar: BluetoothRemoteGATTCharacteristic | undefined;
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

  constructor(private readonly opts: WebBluetoothTransportOptions) {}

  connect(options?: WebBluetoothConnectOptions): Promise<void> {
    // Deduplicate concurrent calls — return the in-flight promise if one exists.
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect(options).finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async _connect(options?: WebBluetoothConnectOptions): Promise<void> {
    // Tear down any existing session before reconnecting. On Windows, the browser
    // reuses the same GATT/characteristic objects when reconnecting to the same
    // device, so we must explicitly disconnect first to avoid accumulating
    // duplicate event listeners.
    const wasConnected = this.device?.gatt?.connected ?? false;
    this.teardownGatt();
    if (wasConnected && this.device?.gatt) {
      this.device.gatt.disconnect();
      await this.waitForGattDisconnect();
    }

    let device = options?.pick ? undefined : await findRememberedDevice(this.opts.storageKey);
    if (!device) {
      device = await pickDevice(this.opts.storageKey, { filters: this.opts.filters });
    }
    this.device = device;

    try {
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(this.opts.serviceUuid);

      const readChar = await service.getCharacteristic(this.opts.readCharUuid);
      this.readChar = readChar;
      await readChar.startNotifications();
      readChar.addEventListener('characteristicvaluechanged', this.notificationHandler);
      readChar.addEventListener('characteristicvalueread', this.notificationHandler);

      this.writeChar = await service.getCharacteristic(this.opts.writeCharUuid);

      device.addEventListener('gattserverdisconnected', this.gattDisconnectedHandler);
    } catch (error) {
      // Keep the remembered device — a treadmill that's simply off or out of range
      // shouldn't need re-pairing, just a working connection attempt later. Only
      // drop our own in-memory reference so the next attempt starts clean.
      this.device = undefined;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.teardownGatt();
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
      await this.waitForGattDisconnect();
    }
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
    this.device = undefined;
  }

  hasRemembered(): boolean {
    return hasRememberedDevice(this.opts.storageKey);
  }

  isConnected(): boolean {
    return this.device?.gatt?.connected ?? false;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writeChar) {
      throw new Error('WebBluetoothTransport: not connected');
    }
    // Re-wrap: writeValue's BufferSource type wants a concrete ArrayBuffer-backed
    // view, while `data` is typed as Uint8Array<ArrayBufferLike> at the core
    // boundary (it could in principle be SharedArrayBuffer-backed).
    await this.writeChar.writeValue(new Uint8Array(data));
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

  private teardownGatt(): void {
    if (this.readChar) {
      // Fire-and-forget; may fail if GATT is already gone.
      this.readChar.stopNotifications().catch(() => {});
      this.readChar.removeEventListener('characteristicvaluechanged', this.notificationHandler);
      this.readChar.removeEventListener('characteristicvalueread', this.notificationHandler);
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.gattDisconnectedHandler);
    }
    this.readChar = undefined;
    this.writeChar = undefined;
  }

  private async waitForGattDisconnect(timeoutMs = 1000): Promise<void> {
    const start = Date.now();
    while (this.device?.gatt?.connected && Date.now() - start < timeoutMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }
}
