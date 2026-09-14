import { TreadmillProtocol } from '@runner/core';
import type { TreadmillEvent } from '@runner/core';
import { WebBluetoothTransport } from './ble/webBluetoothTransport';

export type { TreadmillEvent };

export const TREADMILL_STORAGE_KEY = 'treadmilId';

const S_SERIAL_PORT = '0000fff0-0000-1000-8000-00805f9b34fb';
const C_SERIAL_PORT_READ = '0000fff1-0000-1000-8000-00805f9b34fb';
const C_SERIAL_PORT_WRITE = '0000fff2-0000-1000-8000-00805f9b34fb';

const transport = new WebBluetoothTransport({
  serviceUuid: S_SERIAL_PORT,
  readCharUuid: C_SERIAL_PORT_READ,
  writeCharUuid: C_SERIAL_PORT_WRITE,
  filters: [{ namePrefix: 'FS-' }, { services: [S_SERIAL_PORT] }],
  storageKey: TREADMILL_STORAGE_KEY,
});

const protocol = new TreadmillProtocol({
  transport,
  // Fires on every malformed/mismatched BLE reply (see handleNotification in
  // treadmillProtocol.ts) — routine over a real radio link, so only surface
  // it in development rather than spamming every end user's console.
  logger: process.env.NODE_ENV === 'development' ? (message) => console.log(message) : undefined,
});

let intervalId: ReturnType<typeof setInterval> | undefined;

async function attachAndTick(): Promise<void> {
  await protocol.attach();
  if (intervalId !== undefined) {
    clearInterval(intervalId);
  }
  intervalId = setInterval(() => protocol.tick(), 200);
}

const BleManager = {
  /** Connects using the remembered treadmill if one exists, otherwise opens the device picker. */
  async connect(): Promise<void> {
    if (protocol.isConnected()) return;
    await transport.connect();
    await attachAndTick();
  },

  /** Silent reconnect for the remembered treadmill only — never opens the picker. */
  async connectRemembered(): Promise<void> {
    if (protocol.isConnected() || !transport.hasRemembered()) return;
    await transport.connect({ silent: true });
    await attachAndTick();
  },

  /** Forces the device picker even if a treadmill is already remembered or connected. */
  async changeDevice(): Promise<void> {
    await transport.connect({ pick: true });
    await attachAndTick();
  },

  forgetDevice(): Promise<void> {
    return transport.forget();
  },

  hasRemembered(): boolean {
    return transport.hasRemembered();
  },

  isConnected(): boolean {
    return protocol.isConnected();
  },

  isRunning(): boolean {
    return protocol.isRunning();
  },

  start(): Promise<void> {
    return protocol.start();
  },

  stop(): Promise<void> {
    return protocol.stop();
  },

  sendIncAndSpeed(incline: number, speed: number): void {
    protocol.sendIncAndSpeed(incline, speed);
  },

  addMessage(msg: number[]): void {
    protocol.enqueue({ kind: 'sportData', payload: msg });
  },

  subscribe(callback: (data: TreadmillEvent) => void): () => void {
    return protocol.subscribe(callback);
  },
};

export default BleManager;
