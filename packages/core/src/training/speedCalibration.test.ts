import { describe, expect, it } from 'vitest';
import type { TelemetryPoint } from '../types/telemetry';
import {
  EMPTY_SPEED_CALIBRATION,
  learnSpeedCalibration,
  mergeSpeedCalibrations,
  parseSpeedCalibration,
  speedCalibrationsEqual,
  speedHintFor,
  type SpeedCalibration,
} from './speedCalibration';

/** Fills in the telemetry fields this module doesn't care about. */
function point(
  p: Partial<TelemetryPoint> & Pick<TelemetryPoint, 't' | 'hr' | 'thr'>
): TelemetryPoint {
  return { spd: 0, inc: 0, si: 0, err: 0, phr: p.hr, ...p };
}

/** One point per second from `t=0`, hr ramping linearly from `startHr` to `settledHr` over
 * `rampS` seconds and then holding, at a constant belt speed. */
function ramp(opts: {
  thr: number;
  startHr: number;
  settledHr: number;
  rampS: number;
  totalS: number;
  speed: number;
  useAspd?: boolean;
}): TelemetryPoint[] {
  const { thr, startHr, settledHr, rampS, totalS, speed, useAspd = true } = opts;
  return Array.from({ length: totalS }, (_, t) => {
    const hr = t >= rampS ? settledHr : Math.round(startHr + ((settledHr - startHr) * t) / rampS);
    return point({ t, hr, thr, spd: speed, ...(useAspd ? { aspd: speed } : {}) });
  });
}

describe('learnSpeedCalibration', () => {
  it('learns the settled speed once heart rate ramps into and holds the target band', () => {
    const telemetry = ramp({
      thr: 143,
      startHr: 75,
      settledHr: 143,
      rampS: 200,
      totalS: 320,
      speed: 14.3,
    });
    const result = learnSpeedCalibration(telemetry, EMPTY_SPEED_CALIBRATION);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toMatchObject({ bpm: 143 });
    expect(result.points[0].speed).toBeCloseTo(14.3, 5);
  });

  it('falls back to commanded speed (spd) when aspd is absent (older recordings)', () => {
    const telemetry = ramp({
      thr: 140,
      startHr: 80,
      settledHr: 140,
      rampS: 150,
      totalS: 300,
      speed: 12.5,
      useAspd: false,
    });
    const result = learnSpeedCalibration(telemetry, EMPTY_SPEED_CALIBRATION);
    expect(result.points[0].speed).toBeCloseTo(12.5, 5);
  });

  it('only averages the 120s window right after reaching the target, ignoring later drift', () => {
    const settled: TelemetryPoint[] = [];
    for (let t = 0; t < 300; t++) {
      const hr = 143;
      // Speed climbs after the first 120s (cardiac drift compensation) — must not pull the average.
      const speed = t < 120 ? 14.0 : 11.0;
      settled.push(point({ t, hr, thr: 143, spd: speed, aspd: speed }));
    }
    const result = learnSpeedCalibration(settled, EMPTY_SPEED_CALIBRATION);
    expect(result.points[0].speed).toBeCloseTo(14.0, 5);
  });

  it('skips a target that is never reached', () => {
    const telemetry = ramp({
      thr: 160,
      startHr: 75,
      settledHr: 130,
      rampS: 200,
      totalS: 260,
      speed: 14,
    });
    const result = learnSpeedCalibration(telemetry, EMPTY_SPEED_CALIBRATION);
    expect(result.points).toHaveLength(0);
  });

  it('skips a target reached too briefly (less than 60s of in-band time)', () => {
    const telemetry: TelemetryPoint[] = [
      point({ t: 0, hr: 100, thr: 140, spd: 10, aspd: 10 }),
      point({ t: 1, hr: 140, thr: 140, spd: 12, aspd: 12 }), // in band...
      point({ t: 31, hr: 140, thr: 140, spd: 12, aspd: 12 }), // ...for only 30s before dropping out
      point({ t: 32, hr: 120, thr: 140, spd: 12, aspd: 12 }),
    ];
    const result = learnSpeedCalibration(telemetry, EMPTY_SPEED_CALIBRATION);
    expect(result.points).toHaveLength(0);
  });

  it('ignores tempo-stage segments (thr === 0)', () => {
    const telemetry: TelemetryPoint[] = [
      point({ t: 0, hr: 130, thr: 0, spd: 11, aspd: 11 }),
      point({ t: 200, hr: 130, thr: 0, spd: 11, aspd: 11 }),
    ];
    const result = learnSpeedCalibration(telemetry, EMPTY_SPEED_CALIBRATION);
    expect(result.points).toHaveLength(0);
  });

  it('upserts: a new run at a nearby bpm replaces the old point instead of adding a second one', () => {
    const previous: SpeedCalibration = {
      points: [{ bpm: 142, speed: 13.0, at: '2026-01-01T00:00:00.000Z' }],
    };
    const telemetry = ramp({
      thr: 143,
      startHr: 75,
      settledHr: 143,
      rampS: 200,
      totalS: 320,
      speed: 14.5,
    });
    const result = learnSpeedCalibration(telemetry, previous, () => '2026-02-01T00:00:00.000Z');
    expect(result.points).toHaveLength(1);
    expect(result.points[0]).toEqual({ bpm: 143, speed: 14.5, at: '2026-02-01T00:00:00.000Z' });
  });

  it('keeps points for distinct targets separate and caps the stored history at 12', () => {
    let calibration = EMPTY_SPEED_CALIBRATION;
    for (let bpm = 120; bpm < 120 + 15 * 10; bpm += 10) {
      const telemetry = ramp({
        thr: bpm,
        startHr: bpm - 60,
        settledHr: bpm,
        rampS: 200,
        totalS: 320,
        speed: 10,
      });
      calibration = learnSpeedCalibration(
        telemetry,
        calibration,
        () => `2026-01-01T00:00:${bpm}.000Z`
      );
    }
    expect(calibration.points).toHaveLength(12);
    // The oldest (lowest bpm) entries were dropped, the most recent kept.
    expect(calibration.points[calibration.points.length - 1].bpm).toBe(120 + 14 * 10);
  });
});

describe('speedHintFor', () => {
  const calibration: SpeedCalibration = {
    points: [
      { bpm: 130, speed: 11, at: '2026-01-01T00:00:00.000Z' },
      { bpm: 150, speed: 15, at: '2026-01-01T00:00:00.000Z' },
    ],
  };

  it('returns undefined with no calibration at all', () => {
    expect(speedHintFor(EMPTY_SPEED_CALIBRATION, 143)).toBeUndefined();
  });

  it('returns the exact learned speed for an exact bpm match', () => {
    expect(speedHintFor(calibration, 130)).toBeCloseTo(11, 5);
  });

  it('nudges the nearest point toward a nearby bpm at 0.2 km/h per bpm', () => {
    expect(speedHintFor(calibration, 133)).toBeCloseTo(11.6, 5); // 130 + 3/5
    expect(speedHintFor(calibration, 145)).toBeCloseTo(14, 5); // 150 - 5/5
  });

  it('returns undefined when the nearest calibrated point is more than 15 bpm away', () => {
    expect(speedHintFor(calibration, 170)).toBeUndefined();
  });
});

describe('mergeSpeedCalibrations', () => {
  const at = (n: number) => `2026-01-0${n}T00:00:00.000Z`;

  it('keeps distinct targets from both sides', () => {
    const merged = mergeSpeedCalibrations(
      { points: [{ bpm: 130, speed: 11, at: at(1) }] },
      { points: [{ bpm: 150, speed: 15, at: at(2) }] }
    );
    expect(merged.points.map((p) => p.bpm)).toEqual([130, 150]);
  });

  it('for the same target the newer point wins, whichever side it came from', () => {
    const older = { points: [{ bpm: 143, speed: 13, at: at(1) }] };
    const newer = { points: [{ bpm: 144, speed: 14.3, at: at(3) }] };
    expect(mergeSpeedCalibrations(older, newer).points).toEqual(newer.points);
    expect(mergeSpeedCalibrations(newer, older).points).toEqual(newer.points);
  });

  it('caps at 12 points, dropping the oldest', () => {
    const many = {
      points: Array.from({ length: 15 }, (_, i) => ({
        bpm: 100 + i * 10,
        speed: 10,
        at: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
    };
    const merged = mergeSpeedCalibrations(many, EMPTY_SPEED_CALIBRATION);
    expect(merged.points).toHaveLength(12);
    expect(merged.points[0].bpm).toBe(130);
  });
});

describe('speedCalibrationsEqual', () => {
  it('ignores ordering', () => {
    const a = {
      points: [
        { bpm: 130, speed: 11, at: '2026-01-01T00:00:00.000Z' },
        { bpm: 150, speed: 15, at: '2026-01-02T00:00:00.000Z' },
      ],
    };
    const b = { points: [...a.points].reverse() };
    expect(speedCalibrationsEqual(a, b)).toBe(true);
    expect(speedCalibrationsEqual(a, EMPTY_SPEED_CALIBRATION)).toBe(false);
  });
});

describe('parseSpeedCalibration', () => {
  it('returns empty for garbage', () => {
    for (const v of [null, undefined, 'x', 3, {}, { points: 'no' }]) {
      expect(parseSpeedCalibration(v)).toEqual(EMPTY_SPEED_CALIBRATION);
    }
  });

  it('drops malformed or implausible points but keeps valid ones', () => {
    const parsed = parseSpeedCalibration({
      points: [
        { bpm: 143, speed: 14.3, at: '2026-01-01T00:00:00.000Z' },
        { bpm: 143, speed: 99, at: '2026-01-01T00:00:00.000Z' }, // implausible speed
        { bpm: 'x', speed: 10, at: '2026-01-01T00:00:00.000Z' },
        { bpm: 10, speed: 10, at: '2026-01-01T00:00:00.000Z' }, // implausible bpm
        { bpm: 150, speed: 15 }, // missing at
        null,
      ],
    });
    expect(parsed.points).toEqual([{ bpm: 143, speed: 14.3, at: '2026-01-01T00:00:00.000Z' }]);
  });
});
