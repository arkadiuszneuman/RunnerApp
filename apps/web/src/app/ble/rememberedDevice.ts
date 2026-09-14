/// <reference types="@types/web-bluetooth" />
import { useSyncExternalStore } from 'react';

export interface RememberedDevice {
  id: string;
  name: string;
}

// Module-level cache + listener set, same pattern as bluetoothAvailability.ts: keeps the
// object reference stable between calls so useSyncExternalStore doesn't re-render on every
// getSnapshot() unless remember()/forget() actually changed something.
const listeners = new Set<() => void>();
const cache = new Map<string, RememberedDevice | null>();

function nameStorageKey(key: string): string {
  return `${key}Name`;
}

function readFromStorage(key: string): RememberedDevice | null {
  try {
    const id = localStorage.getItem(key);
    if (!id) return null;
    return { id, name: localStorage.getItem(nameStorageKey(key)) ?? '' };
  } catch {
    // Storage unavailable (private mode, blocked) — behave as if nothing is remembered.
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * The device remembered under `key`, or null if none (or storage is unavailable). Cached in
 * memory so repeated calls — including useSyncExternalStore snapshots — return the same
 * object reference until remember()/forget() changes it.
 */
export function getRemembered(key: string): RememberedDevice | null {
  if (!cache.has(key)) {
    cache.set(key, readFromStorage(key));
  }
  return cache.get(key) ?? null;
}

export function hasRemembered(key: string): boolean {
  return getRemembered(key) !== null;
}

function remember(key: string, device: Pick<BluetoothDevice, 'id' | 'name'>): void {
  const value: RememberedDevice = { id: device.id, name: device.name ?? '' };
  try {
    localStorage.setItem(key, value.id);
    localStorage.setItem(nameStorageKey(key), value.name);
  } catch {
    // Storage unavailable — the choice just won't persist across reloads.
  }
  cache.set(key, value);
  notify();
}

export function forget(key: string): void {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(nameStorageKey(key));
  } catch {
    // Storage unavailable — nothing to clear.
  }
  cache.set(key, null);
  notify();
}

/** The device remembered under `key`, updating live as remember()/forget() are called elsewhere. */
export function useRememberedDevice(key: string): RememberedDevice | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getRemembered(key),
    () => null
  );
}

/**
 * Looks up the device remembered under `key` via `navigator.bluetooth.getDevices()` (Chrome's
 * persistent-permissions API — works without a user gesture) and, if it exposes
 * `watchAdvertisements`, waits briefly to see it actually advertise. Chrome's GATT `connect()`
 * otherwise often rejects a device it hasn't seen advertise since the page loaded, even though
 * the device is right there — this gives it a chance to be seen first.
 *
 * Resolves to the device either way once one is found (a timeout with no advertisement seen
 * doesn't mean it's unreachable — `gatt.connect()` still gets to try), or to undefined if
 * nothing is remembered, storage is unavailable, or the browser has forgotten the permission.
 */
export async function findRememberedDevice(
  key: string,
  timeoutMs = 6000
): Promise<BluetoothDevice | undefined> {
  const remembered = getRemembered(key);
  if (!remembered) return undefined;
  const bluetooth = navigator.bluetooth;
  if (!bluetooth?.getDevices) return undefined;

  const devices = await bluetooth.getDevices();
  const device = devices.find((candidate) => candidate.id === remembered.id);
  if (!device) return undefined;
  if (device.gatt?.connected || !device.watchAdvertisements) return device;

  const controller = new AbortController();
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    device.addEventListener(
      'advertisementreceived',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true, signal: controller.signal }
    );
    device.watchAdvertisements({ signal: controller.signal }).catch(() => {
      clearTimeout(timer);
      resolve();
    });
  });
  controller.abort();
  return device;
}

/** Opens the browser's device picker and remembers whatever the user picks under `key`. */
export async function pickDevice(
  key: string,
  options: RequestDeviceOptions
): Promise<BluetoothDevice> {
  const device = await navigator.bluetooth.requestDevice(options);
  remember(key, device);
  return device;
}
