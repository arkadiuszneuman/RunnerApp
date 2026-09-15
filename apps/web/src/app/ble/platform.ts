import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

/**
 * True when running inside the Capacitor Android shell (see apps/android) rather than a
 * regular browser tab/PWA. BleManager/HeartRateManager use this to pick the native BLE
 * transport (nativeBleTransport.ts / nativeHeartRateTransport.ts) instead of Web Bluetooth —
 * the two are mutually exclusive at runtime, never both active.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

let initializePromise: Promise<void> | undefined;

/**
 * BleClient.initialize() must run exactly once (it's what triggers the Android runtime
 * permission prompt) before any other BleClient call, shared across NativeBleTransport,
 * NativeHeartRateTransport and bluetoothAvailability.ts so none of them re-prompt the others.
 */
export function ensureNativeBleInitialized(): Promise<void> {
  if (!initializePromise) {
    initializePromise = BleClient.initialize({ androidNeverForLocation: true });
  }
  return initializePromise;
}
