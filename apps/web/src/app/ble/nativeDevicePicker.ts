import { useSyncExternalStore } from 'react';
import {
  BleClient,
  type RequestBleDeviceOptions,
  type ScanResult,
} from '@capacitor-community/bluetooth-le';

export interface DiscoveredDevice {
  deviceId: string;
  name: string;
}

interface PickerRequest {
  devices: DiscoveredDevice[];
  scanning: boolean;
}

// Mirrors @capacitor-community/bluetooth-le's own MAX_SCAN_DURATION for requestDevice() — after
// this, scanning stops (no more devices appear) but the dialog stays open with whatever's found.
const SCAN_DURATION_MS = 30000;

let request: PickerRequest | null = null;
let activeOptions: RequestBleDeviceOptions | undefined;
let resolveRequest: ((device: DiscoveredDevice) => void) | undefined;
let rejectRequest: ((error: Error) => void) | undefined;
let stopScan: (() => void) | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function setRequest(next: PickerRequest | null): void {
  request = next;
  notify();
}

/**
 * The current device-picker request, if one is open. NativeDevicePickerDialog (mounted once in
 * AppShell) subscribes to this and renders the list — this is what apps/android shows *instead
 * of* BleClient.requestDevice()'s plain native Android AlertDialog, so the picker actually looks
 * like the rest of the app.
 */
export function useNativeDevicePicker(): PickerRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => request,
    () => null
  );
}

/**
 * Scans for nearby BLE devices matching `options` and resolves with whichever one the user taps
 * in NativeDevicePickerDialog. Rejects with the same "requestDevice cancelled." message
 * isChooserCancelled() (bluetoothAvailability.ts) already recognizes when the user dismisses it,
 * so existing cancel-handling call sites (BleConnector.tsx) need no changes.
 */
export function pickNativeDevice(options: RequestBleDeviceOptions): Promise<DiscoveredDevice> {
  if (request) return Promise.reject(new Error('A device picker is already open.'));

  return new Promise((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
    activeOptions = options;
    setRequest({ devices: [], scanning: false });
    startScan(options).catch((error) => {
      finishRequest();
      reject(error);
    });
  });
}

/** Starts (or restarts) the scan for the currently-open request, stopping after SCAN_DURATION_MS. */
function startScan(options: RequestBleDeviceOptions): Promise<void> {
  if (request) setRequest({ ...request, scanning: true });

  const timeout = setTimeout(() => {
    stopScan?.();
    if (request) setRequest({ ...request, scanning: false });
  }, SCAN_DURATION_MS);

  stopScan = () => {
    clearTimeout(timeout);
    BleClient.stopLEScan().catch(() => {});
  };

  return BleClient.requestLEScan(options, (result: ScanResult) => {
    if (!request) return;
    const name = result.device.name ?? result.localName ?? '';
    if (request.devices.some((d) => d.deviceId === result.device.deviceId)) return;
    setRequest({
      ...request,
      devices: [...request.devices, { deviceId: result.device.deviceId, name }],
    });
  });
}

function finishRequest(): void {
  stopScan?.();
  stopScan = undefined;
  resolveRequest = undefined;
  rejectRequest = undefined;
  activeOptions = undefined;
  setRequest(null);
}

/** Called by NativeDevicePickerDialog when the user taps a device in the list. */
export function selectNativeDevice(device: DiscoveredDevice): void {
  const resolve = resolveRequest;
  finishRequest();
  resolve?.(device);
}

/** Called by NativeDevicePickerDialog when the user cancels/dismisses it. */
export function cancelNativeDevicePicker(): void {
  const reject = rejectRequest;
  finishRequest();
  reject?.(new Error('requestDevice cancelled.'));
}

/**
 * Called by NativeDevicePickerDialog's "Scan again" button once the 30s window has elapsed —
 * reuses whichever filter the open request was started with.
 */
export function rescanNativeDevicePicker(): void {
  if (!request || !activeOptions) return;
  startScan(activeOptions).catch(cancelNativeDevicePicker);
}
