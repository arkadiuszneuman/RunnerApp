import { afterEach, describe, expect, it } from 'vitest';
import type { TelemetryPoint } from '@runner/core';
import { learnFromRun, needsSeed, seedFromRuns, setUser, speedHint } from './speedCalibrationStore';

function point(p: Partial<TelemetryPoint> & Pick<TelemetryPoint, 't' | 'hr' | 'thr'>): TelemetryPoint {
  return { spd: 0, inc: 0, si: 0, err: 0, phr: p.hr, ...p };
}

/** A run whose heart rate ramps into `thr` and settles there at `speed`, long enough to calibrate. */
function settledRun(thr: number, speed: number): TelemetryPoint[] {
  return Array.from({ length: 260 }, (_, t) => {
    const hr = t < 190 ? Math.round(70 + ((thr - 70) * t) / 190) : thr;
    return point({ t, hr, thr, spd: speed, aspd: speed });
  });
}

describe('speedCalibrationStore', () => {
  afterEach(() => {
    localStorage.clear();
    setUser(null);
  });

  it('does nothing (and reports needing a seed) with no signed-in user', () => {
    expect(needsSeed()).toBe(true);
    learnFromRun(settledRun(140, 12));
    expect(speedHint(140)).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });

  it('learns from a finished run and makes it available as a hint, scoped to that user', () => {
    setUser('user-1');
    expect(needsSeed()).toBe(true);

    learnFromRun(settledRun(140, 12));
    expect(needsSeed()).toBe(false);
    expect(speedHint(140)).toBeCloseTo(12, 5);

    // Scoped per user — a different signed-in user sees no calibration of their own.
    setUser('user-2');
    expect(needsSeed()).toBe(true);
    expect(speedHint(140)).toBeUndefined();
  });

  it('persists across a reload (same user, fresh module-level state simulated by re-setting the user)', () => {
    setUser('user-1');
    learnFromRun(settledRun(150, 13.5));
    setUser(null);
    setUser('user-1');
    expect(speedHint(150)).toBeCloseTo(13.5, 5);
  });

  it('seeds from history only when nothing is calibrated yet, and skips runs with no reachable target', () => {
    setUser('user-1');
    const neverReached = Array.from({ length: 100 }, (_, t) => point({ t, hr: 90, thr: 170 }));
    seedFromRuns([neverReached, settledRun(140, 12), settledRun(160, 14)]);
    expect(speedHint(140)).toBeCloseTo(12, 5);
    expect(speedHint(160)).toBeCloseTo(14, 5);

    // Already calibrated — a later seed call (e.g. next sign-in) must not clobber it.
    seedFromRuns([settledRun(140, 99)]);
    expect(speedHint(140)).toBeCloseTo(12, 5);
  });

  it('ignores corrupted localStorage content instead of throwing', () => {
    setUser('user-1');
    localStorage.setItem('runner.speedCalibration.user-1', '{not json');
    expect(needsSeed()).toBe(true);
    expect(speedHint(140)).toBeUndefined();
    expect(() => learnFromRun(settledRun(140, 12))).not.toThrow();
    expect(speedHint(140)).toBeCloseTo(12, 5);
  });
});
