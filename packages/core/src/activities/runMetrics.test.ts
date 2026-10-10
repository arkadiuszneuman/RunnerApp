import { describe, expect, it } from 'vitest';
import { analyzeRun } from '../services/runAnalysis';
import type { TelemetryPoint } from '../types/telemetry';
import { metricsFromTelemetry } from './runMetrics';

function point(overrides: Partial<TelemetryPoint> & { t: number }): TelemetryPoint {
  return { hr: 0, thr: 0, phr: 0, spd: 0, inc: 0, si: 1, err: 0, ...overrides };
}

describe('metricsFromTelemetry', () => {
  // 10 km/h for 20 min, then 12 km/h for 20 min (sparse: a point only on change).
  const telemetry = [
    point({ t: 0, spd: 10, hr: 120 }),
    point({ t: 300, spd: 10, hr: 140 }),
    point({ t: 1200, spd: 12, hr: 150, inc: 1 }),
  ];
  const endT = 2400;

  it('agrees with analyzeRun on distance, time and HR', () => {
    const summary = analyzeRun(telemetry, { endT });
    const metrics = metricsFromTelemetry(telemetry, endT);
    expect(metrics.distanceM).toBeCloseTo(summary.distanceKm * 1000, 0);
    expect(metrics.movingS).toBe(2400);
    expect(metrics.avgHr).toBe(Math.round(summary.avgHr));
    expect(metrics.maxHr).toBe(150);
    expect(metrics.elevGainM).toBe(Math.round(summary.elevationGainM));
  });

  it('finds best efforts on the piecewise-linear belt distance', () => {
    const metrics = metricsFromTelemetry(telemetry, endT);
    // The fastest km is entirely at 12 km/h: 300 s.
    expect(metrics.bestEfforts['1k']).toBeCloseTo(300, 1);
    // 5 km: 4 km at 12 km/h (1200 s) + 1 km at 10 km/h (360 s).
    expect(metrics.bestEfforts['5k']).toBeCloseTo(1560, 1);
    expect(metrics.splitsKmS?.[0]).toBeCloseTo(360, 1);
  });

  it('time-weights the HR histogram and records the incline in the steady state', () => {
    const metrics = metricsFromTelemetry(telemetry, endT);
    expect(metrics.hrHist).toEqual({
      start: 120,
      s: [300, ...Array(19).fill(0), 900, ...Array(9).fill(0), 1200],
    });
    expect(metrics.steady?.gradePct).toBeGreaterThan(0);
  });

  it('handles a run without HR or telemetry', () => {
    const metrics = metricsFromTelemetry([point({ t: 0, spd: 10 })], 600);
    expect(metrics.avgHr).toBeUndefined();
    expect(metrics.hrHist).toBeUndefined();
    expect(metricsFromTelemetry([], 0)).toMatchObject({
      distanceM: 0,
      movingS: 0,
      bestEfforts: {},
    });
  });
});
