import { FakeTreadmill, TreadmillProtocol } from '@runner/core';
import type { BleTransport, TreadmillEvent } from '@runner/core';
import { BlePlxTransport } from './blePlxTransport';

const S_SERIAL_PORT = '0000fff0-0000-1000-8000-00805f9b34fb';
const C_SERIAL_PORT_READ = '0000fff1-0000-1000-8000-00805f9b34fb';
const C_SERIAL_PORT_WRITE = '0000fff2-0000-1000-8000-00805f9b34fb';

/**
 * The emulator used for e2e/screenshot testing (see .maestro/) has no
 * Bluetooth, so EXPO_PUBLIC_USE_FAKE_TREADMILL forces FakeTreadmill there —
 * everywhere else (including real devices without a paired treadmill yet)
 * talks to real hardware over BlePlxTransport.
 */
const fakeTreadmill = new FakeTreadmill();
const transport: BleTransport =
  process.env.EXPO_PUBLIC_USE_FAKE_TREADMILL === '1'
    ? fakeTreadmill
    : new BlePlxTransport({
        serviceUuid: S_SERIAL_PORT,
        readCharUuid: C_SERIAL_PORT_READ,
        writeCharUuid: C_SERIAL_PORT_WRITE,
        namePrefix: 'FS-',
        storageKey: 'treadmillDeviceId',
      });

const protocol = new TreadmillProtocol({
  transport,
  logger: (message) => console.log(message),
});

let intervalId: ReturnType<typeof setInterval> | undefined;

const TreadmillManager = {
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

  subscribe(callback: (data: TreadmillEvent) => void): () => void {
    return protocol.subscribe(callback);
  },

  /** Dev-only: simulate the user pressing the treadmill console's own speed buttons. No-op on real hardware. */
  simulateManualSpeed(kmh: number): void {
    if (transport === fakeTreadmill) {
      fakeTreadmill.manualSpeed(kmh);
    }
  },
};

export default TreadmillManager;
