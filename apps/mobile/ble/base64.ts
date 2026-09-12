import { fromByteArray, toByteArray } from 'base64-js';

/**
 * react-native-ble-plx speaks base64 strings over the bridge; @runner/core's
 * BleTransport interface speaks raw Uint8Array. These two pure functions are
 * the only place that boundary is crossed, so they're unit-testable in Node
 * without a device (see base64.test.ts).
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return fromByteArray(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  return toByteArray(base64);
}
