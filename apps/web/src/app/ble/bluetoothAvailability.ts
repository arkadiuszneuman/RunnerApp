/// <reference types="@types/web-bluetooth" />
import { useSyncExternalStore } from 'react';

/**
 * - `unknown`: not checked yet (server render, first client render)
 * - `unsupported`: no Web Bluetooth at all — Safari/iOS, Firefox, some embedded browsers
 * - `insecure`: served over plain http, where browsers hide the API
 * - `unavailable`: API present, but no usable adapter (Bluetooth off, or blocked by OS/permission)
 */
export type BluetoothAvailability = 'unknown' | 'available' | 'unavailable' | 'unsupported' | 'insecure';

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

/** The browser's chooser rejects with NotFoundError when the user just closes it — not worth reporting. */
export function isChooserCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}
