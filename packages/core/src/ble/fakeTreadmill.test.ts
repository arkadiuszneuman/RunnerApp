import { describe, expect, it } from 'vitest';
import { TreadmillProtocol } from './treadmillProtocol';
import { FakeTreadmill } from './fakeTreadmill';

describe('FakeTreadmill', () => {
  it('ramps speed toward the commanded value and answers realistic status frames', async () => {
    const transport = new FakeTreadmill({ rampRate: 0.5 });
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    await protocol.start();

    // Pump until the protocol has observed a Running status frame.
    for (let i = 0; i < 30 && !protocol.isRunning(); i++) protocol.tick();
    expect(protocol.isRunning()).toBe(true);

    protocol.sendIncAndSpeed(2, 6);

    const speeds: number[] = [];
    protocol.subscribe((e) => {
      if (e.type === 'btRunning') speeds.push(e.state.currentSpeed);
    });

    for (let i = 0; i < 100; i++) protocol.tick();

    expect(speeds.length).toBeGreaterThan(0);
    expect(speeds[speeds.length - 1]).toBe(6);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1]);
    }
  });

  it('supports simulating a manual speed override via manualSpeed()', async () => {
    const transport = new FakeTreadmill();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    await protocol.start();
    for (let i = 0; i < 30 && !protocol.isRunning(); i++) protocol.tick();

    transport.manualSpeed(9);

    let sawSpeed: number | undefined;
    protocol.subscribe((e) => {
      if (e.type === 'btRunning') sawSpeed = e.state.currentSpeed;
    });
    for (let i = 0; i < 10 && sawSpeed === undefined; i++) protocol.tick();

    expect(sawSpeed).toBe(9);
  });

  it('reports Stopped and clears isRunning() after stop()', async () => {
    const transport = new FakeTreadmill();
    const protocol = new TreadmillProtocol({ transport });
    await protocol.attach();
    await protocol.start();
    for (let i = 0; i < 30 && !protocol.isRunning(); i++) protocol.tick();
    expect(protocol.isRunning()).toBe(true);

    await protocol.stop();
    for (let i = 0; i < 30 && protocol.isRunning(); i++) protocol.tick();

    expect(protocol.isRunning()).toBe(false);
  });
});
