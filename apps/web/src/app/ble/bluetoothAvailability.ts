/// <reference types="@types/web-bluetooth" />
import { useSyncExternalStore } from 'react';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { ensureNativeBleInitialized, isNativeApp } from './platform';

/**
 * - `unknown`: not checked yet (server render, first client render)
 * - `unsupported`: no Web Bluetooth at all — Safari/iOS, Firefox, some embedded browsers
 * - `insecure`: served over plain http, where browsers hide the API
 * - `unavailable`: API present, but no usable adapter (Bluetooth off, or blocked by OS/permission)
 */
export type BluetoothAvailability =
  'unknown' | 'available' | 'unavailable' | 'unsupported' | 'insecure';

let current: BluetoothAvailability = 'unknown';
let started = false;
const listeners = new Set<() => void>();

function set(next: BluetoothAvailability): void {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function start(): void {
  if (started) return;
  started = true;
  if (isNativeApp()) return startNative();
  if (!window.isSecureContext) return set('insecure');
  const bluetooth = navigator.bluetooth;
  if (!bluetooth) return set('unsupported');
  if (!bluetooth.getAvailability) return set('available');

  bluetooth.addEventListener?.('availabilitychanged', (event) =>
    set((event as Event & { value: boolean }).value ? 'available' : 'unavailable')
  );
  bluetooth.getAvailability().then(
    (available) => set(available ? 'available' : 'unavailable'),
    // Can't tell — let a connect attempt surface the real problem.
    () => set('available')
  );
}

/**
 * Native (apps/android): there's no "unsupported"/"insecure" — the app either has the BLE
 * plugin and permissions or it doesn't — so this only ever settles on 'available'/'unavailable',
 * driven by the OS-level Bluetooth radio state rather than a browser API.
 */
function startNative(): void {
  ensureNativeBleInitialized().then(
    () => {
      BleClient.startEnabledNotifications((enabled) => set(enabled ? 'available' : 'unavailable'));
      BleClient.isEnabled().then((enabled) => set(enabled ? 'available' : 'unavailable'));
    },
    // Permission denied or no adapter — let a connect attempt surface the real problem.
    () => set('available')
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

/** Live Web Bluetooth availability (updates when the adapter is switched on/off). */
export function useBluetoothAvailability(): BluetoothAvailability {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'unknown'
  );
}

/**
 * The browser's chooser rejects with NotFoundError when the user just closes it (not worth
 * reporting); the native (apps/android) picker rejects the same requestDevice() call with a
 * plain Error whose message is "requestDevice cancelled." (see @capacitor-community/bluetooth-le's
 * DeviceScanner.kt) when the user taps its Cancel button.
 */
export function isChooserCancelled(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'NotFoundError') return true;
  return error instanceof Error && error.message.toLowerCase().includes('cancelled');
}
