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
 *
 * `androidNeverForLocation` deliberately isn't set: on Android 12+ it makes the plugin request
 * only BLUETOOTH_SCAN/CONNECT (no location permission) — which is the documented-correct,
 * privacy-preserving option, but on-device testing (Samsung/OneUI) found it makes
 * BluetoothLeScanner silently return zero scan results even with BLUETOOTH_SCAN granted, while
 * Chrome's Web Bluetooth (which does hold location permission) finds the same devices fine.
 * Requesting ACCESS_FINE_LOCATION too, same as classic pre-12 BLE scanning always required,
 * is what actually gets results delivered on the hardware this has been tested on.
 */
export function ensureNativeBleInitialized(): Promise<void> {
  if (!initializePromise) {
    initializePromise = BleClient.initialize();
  }
  return initializePromise;
}
