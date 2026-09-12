import { TreadmillProtocol } from '@runner/core';
import type { TreadmillEvent } from '@runner/core';
import { WebBluetoothTransport } from './ble/webBluetoothTransport';

export type { TreadmillEvent };

const S_SERIAL_PORT = '0000fff0-0000-1000-8000-00805f9b34fb';
const C_SERIAL_PORT_READ = '0000fff1-0000-1000-8000-00805f9b34fb';
const C_SERIAL_PORT_WRITE = '0000fff2-0000-1000-8000-00805f9b34fb';

const transport = new WebBluetoothTransport({
  serviceUuid: S_SERIAL_PORT,
  readCharUuid: C_SERIAL_PORT_READ,
  writeCharUuid: C_SERIAL_PORT_WRITE,
  filters: [{ namePrefix: 'FS-' }, { services: [S_SERIAL_PORT] }],
  storageKey: 'treadmilId',
});

const protocol = new TreadmillProtocol({
  transport,
  logger: (message) => console.log(message),
});

let intervalId: ReturnType<typeof setInterval> | undefined;

const BleManager = {
  async initBTConnection(): Promise<void> {
    await transport.connect();
    await protocol.attach();
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(() => protocol.tick(), 200);
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
