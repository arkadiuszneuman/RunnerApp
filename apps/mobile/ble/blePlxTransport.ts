import type { BleTransport } from '@runner/core';
import * as SecureStore from 'expo-secure-store';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import { base64ToBytes, bytesToBase64 } from './base64';

export interface BlePlxTransportOptions {
  serviceUuid: string;
  readCharUuid: string;
  /** Omit for read-only sensors (e.g. the standard heart_rate service) — write() then throws. */
  writeCharUuid?: string;
  /**
   * Devices are matched by this name prefix during scanning (mirrors the web app's
   * picker filter). Omit when the service UUID alone is a specific enough filter
   * (e.g. the standard heart_rate service) — the scan is already restricted to
   * devices advertising `serviceUuid`, so any result is a match.
   */
  namePrefix?: string;
  /** SecureStore key used to remember the connected device id across app restarts. */
  storageKey: string;
  scanTimeoutMs?: number;
}

async function requestAndroidBlePermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Android 12 (API 31) replaced the location-permission-gated scan with dedicated
  // BLUETOOTH_SCAN/CONNECT permissions; below that, BLE scanning still requires location.
  if (Platform.Version < 31) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return;
  }
  await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
}

/**
 * react-native-ble-plx implementation of the transport-agnostic BleTransport
 * interface. Mirrors apps/web/src/app/ble/webBluetoothTransport.ts: same
 * connect-dedupe, teardown-before-reconnect, and cache-then-clear-on-failure
 * shape, adapted to ble-plx's scan/connect/discover API and base64 payloads.
 *
 * Device identity differs by platform: Android exposes a stable MAC address,
 * so a cached id can be connected to directly; iOS identifiers are
 * session-scoped and may not resolve after an app restart, so a direct
 * connect failure always falls back to scanning.
 */
export class BlePlxTransport implements BleTransport {
  private readonly manager = new BleManager();
  private device: Device | undefined;
  private connected = false;
  private notifySubscription: Subscription | undefined;
  private disconnectSubscription: Subscription | undefined;
  private connectPromise: Promise<void> | undefined;
  private notifyListeners: ((data: Uint8Array) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  constructor(private readonly opts: BlePlxTransportOptions) {}

  connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this._connect().finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  private async _connect(): Promise<void> {
    await requestAndroidBlePermissions();

    const previousDeviceId = this.device?.id;
    this.teardown();
    if (previousDeviceId) {
      await this.manager.cancelDeviceConnection(previousDeviceId).catch(() => {});
    }

    const savedId = await SecureStore.getItemAsync(this.opts.storageKey);
    let device: Device;
    try {
      device = savedId
        ? await this.manager.connectToDevice(savedId)
        : await this.connectViaScan();
    } catch {
      device = await this.connectViaScan();
    }

    try {
      const connected = await device.discoverAllServicesAndCharacteristics();
      this.device = connected;
      await SecureStore.setItemAsync(this.opts.storageKey, connected.id);

      this.notifySubscription = connected.monitorCharacteristicForService(
        this.opts.serviceUuid,
        this.opts.readCharUuid,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          const bytes = base64ToBytes(characteristic.value);
          this.notifyListeners.forEach((cb) => cb(bytes));
        }
      );

      this.disconnectSubscription = this.manager.onDeviceDisconnected(connected.id, () => {
        this.connected = false;
        this.disconnectListeners.forEach((cb) => cb());
      });

      this.connected = true;
    } catch (error) {
      await SecureStore.deleteItemAsync(this.opts.storageKey);
      await this.manager.cancelDeviceConnection(device.id).catch(() => {});
      this.device = undefined;
      throw error;
    }
  }

  private async connectViaScan(): Promise<Device> {
    const scanned = await this.scanForDevice();
    return this.manager.connectToDevice(scanned.id);
  }

  private scanForDevice(): Promise<Device> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        reject(new Error('BlePlxTransport: no matching device found while scanning'));
      }, this.opts.scanTimeoutMs ?? 15000);

      this.manager.startDeviceScan([this.opts.serviceUuid], null, (error, scanned) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (!scanned) return;
        const name = scanned.name ?? scanned.localName ?? '';
        if (!this.opts.namePrefix || name.startsWith(this.opts.namePrefix)) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(scanned);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    const deviceId = this.device?.id;
    this.teardown();
    if (deviceId) {
      await this.manager.cancelDeviceConnection(deviceId).catch(() => {});
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.opts.writeCharUuid) {
      throw new Error('BlePlxTransport: read-only (no writeCharUuid configured)');
    }
    if (!this.device) {
      throw new Error('BlePlxTransport: not connected');
    }
    await this.device.writeCharacteristicWithResponseForService(
      this.opts.serviceUuid,
      this.opts.writeCharUuid,
      bytesToBase64(data)
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

  private teardown(): void {
    this.notifySubscription?.remove();
    this.notifySubscription = undefined;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = undefined;
    this.connected = false;
  }
}
