import { describe, expect, it, vi } from 'vitest';
import { HeartRateMonitor, parseHeartRateMeasurement } from './heartRate';
import { RecordingTransport } from './fakeTreadmill';

describe('parseHeartRateMeasurement', () => {
  it('reads an 8-bit BPM value', () => {
    expect(parseHeartRateMeasurement(new Uint8Array([0x00, 72]))).toBe(72);
  });

  it('reads a 16-bit BPM value (little-endian) — this is the fix for the historical bug', () => {
    // Historically `handleRateChange` did `if (is16Bits) return value.getUint16(1, true);`,
    // returning from the event handler instead of emitting — 16-bit sensors silently
    // produced no readings at all. This must return a value, not undefined.
    expect(parseHeartRateMeasurement(new Uint8Array([0x01, 0x2c, 0x01]))).toBe(300);
  });

  it('still reads the 8-bit byte when other flag bits (e.g. sensor contact) are set', () => {
    expect(parseHeartRateMeasurement(new Uint8Array([0x06, 88]))).toBe(88);
  });

  it('returns undefined for an empty buffer', () => {
    expect(parseHeartRateMeasurement(new Uint8Array([]))).toBeUndefined();
  });

  it('returns undefined for a too-short 16-bit buffer', () => {
    expect(parseHeartRateMeasurement(new Uint8Array([0x01, 0x2c]))).toBeUndefined();
  });
});

describe('HeartRateMonitor', () => {
  it('emits parsed BPM values from transport notifications', async () => {
    const transport = new RecordingTransport();
    const monitor = new HeartRateMonitor({ transport });
    const readings: number[] = [];
    monitor.subscribe((bpm) => readings.push(bpm));

    await monitor.attach();
    transport.notify(new Uint8Array([0x00, 65]));
    transport.notify(new Uint8Array([0x01, 0x46, 0x00])); // 70 in 16-bit form

    expect(readings).toStrictEqual([65, 70]);
  });

  it('reconnects via the transport on a link drop instead of re-subscribing', async () => {
    const transport = new RecordingTransport();
    const connectSpy = vi.spyOn(transport, 'connect');
    const monitor = new HeartRateMonitor({ transport });

    await monitor.attach();
    expect(connectSpy).not.toHaveBeenCalled();

    transport.dropLink();
    await Promise.resolve(); // let the reconnect promise chain settle

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps emitting after a reconnect without re-subscribing', async () => {
    const transport = new RecordingTransport();
    const monitor = new HeartRateMonitor({ transport });
    const readings: number[] = [];
    monitor.subscribe((bpm) => readings.push(bpm));

    await monitor.attach();
    transport.dropLink();
    await Promise.resolve();

    // The transport re-arms notifications as part of connect(); the same onNotify
    // subscription (never re-registered) keeps receiving them.
    transport.notify(new Uint8Array([0x00, 80]));
    expect(readings).toStrictEqual([80]);
  });
});
