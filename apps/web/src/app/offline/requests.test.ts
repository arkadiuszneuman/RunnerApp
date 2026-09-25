import { describe, expect, it } from 'vitest';
import { outboxKey, writes } from './requests';

describe('writes.setSpeedCalibration', () => {
  it('PUTs only the calibration, under its own outbox key', () => {
    const calibration = { points: [{ bpm: 143, speed: 14.3, at: '2026-01-01T00:00:00.000Z' }] };
    const write = writes.setSpeedCalibration(calibration);
    expect(write.request).toMatchObject({
      method: 'PUT',
      url: '/api/user-settings',
      body: { speedCalibration: calibration },
    });
    // Not 'user-settings': overlay.ts reads that entry's body as `{ activeProgramId }`, and a
    // shared key would let one write coalesce over (or be mistaken for) the other.
    expect(write.options.key).toBe(outboxKey.speedCalibration());
    expect(write.options.key).not.toBe(outboxKey.userSettings());
  });

  it('leaves the active-program write shape untouched', () => {
    expect(writes.setActiveProgram(null).request.body).toEqual({ activeProgramId: null });
  });
});
