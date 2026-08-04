import { TreadmillProtocol } from '@runner/core';
import type { TreadmillEvent } from '@runner/core';
import {
  START_COMMAND as CORE_START_COMMAND,
  STOP_COMMAND as CORE_STOP_COMMAND,
  SPORT_DATA_COMMAND as CORE_SPORT_DATA_COMMAND,
} from '@runner/core';
import { WebBluetoothTransport } from './ble/webBluetoothTransport';

export type { TreadmillEvent };

// Preserved for surface parity with call sites that may still import these —
// the protocol layer itself now uses tagged Command objects (see @runner/core/ble).
export const START_COMMAND: number[] = [...CORE_START_COMMAND.payload];
export const STOP_COMMAND: number[] = [...CORE_STOP_COMMAND.payload];
export const SPORT_DATA_COMMAND: number[] = [...CORE_SPORT_DATA_COMMAND.payload];
export const EVENT_RUNNING = 'running';
export const EVENT_STARTING = 'starting';
export const EVENT_STOPPED = 'stopped';

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
