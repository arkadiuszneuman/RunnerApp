import { FakeTreadmill, TreadmillProtocol } from '@runner/core';
import type { TreadmillEvent } from '@runner/core';

/**
 * Dev-mode treadmill: FakeTreadmill simulates the belt (ramps toward the
 * commanded speed, answers STATUS realistically) so the whole run flow —
 * screens, PID, telemetry — can be built and exercised without hardware.
 *
 * Phase 7 replaces this transport with BlePlxTransport (react-native-ble-plx)
 * for real devices; TreadmillManager's public surface (matching apps/web's
 * BleManager) stays the same either way, so nothing above this file changes.
 */
const transport = new FakeTreadmill();
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

  /** Dev-only: simulate the user pressing the treadmill console's own speed buttons. */
  simulateManualSpeed(kmh: number): void {
    transport.manualSpeed(kmh);
  },
};

export default TreadmillManager;
