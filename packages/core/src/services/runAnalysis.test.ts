import { describe, expect, it } from 'vitest';
import type { TelemetryPoint } from '../types/telemetry';
import type { StageResult } from './stagesCalculator';
import { Timespan } from './Timespan';
import { analyzeRun, toSeries } from './runAnalysis';

function point(overrides: Partial<TelemetryPoint> & { t: number }): TelemetryPoint {
  return { hr: 0, thr: 0, phr: 0, spd: 0, inc: 0, si: 1, err: 0, ...overrides };
}

describe('analyzeRun', () => {
  it('returns zeroed-out stats for empty telemetry', () => {
    const summary = analyzeRun([]);
    expect(summary.durationSeconds).toBe(0);
    expect(summary.distanceKm).toBe(0);
    expect(summary.avgHr).toBe(0);
    expect(summary.hrTarget).toBeUndefined();
    expect(summary.hrBuckets).toEqual([]);
    expect(summary.stages).toEqual([]);
  });

  it('time-weights sparse points instead of averaging point-by-point', () => {
    // hr=100 held for 90s, then hr=200 held for 10s (only 2 recorded points).
    const telemetry = [point({ t: 0, hr: 100, spd: 10 }), point({ t: 90, hr: 200, spd: 10 })];
    const summary = analyzeRun(telemetry, { endT: 100 });

    // Naive point average would be 150; time-weighted average must be much closer to 100.
    expect(summary.avgHr).toBeCloseTo(100 * 0.9 + 200 * 0.1, 5);
    expect(summary.durationSeconds).toBe(100);
    // 10 km/h held for 100s = 10 * 100/3600 km.
    expect(summary.distanceKm).toBeCloseTo((10 * 100) / 3600, 5);
  });

  it('excludes hr=0 (no sensor) segments from HR stats but keeps them in duration/distance', () => {
    const telemetry = [
      point({ t: 0, hr: 0, spd: 8 }), // no sensor for the first 50s
      point({ t: 50, hr: 150, spd: 8 }),
    ];
    const summary = analyzeRun(telemetry, { endT: 100 });

    expect(summary.avgHr).toBe(150); // only the hr>0 segment counts
    expect(summary.maxHr).toBe(150);
    expect(summary.minHr).toBe(150);
    expect(summary.distanceKm).toBeCloseTo((8 * 100) / 3600, 5); // both segments count for distance
  });

  it('ignores tempo stages (thr=0) in HR-target deviation stats', () => {
    const telemetry = [
      point({ t: 0, hr: 160, thr: 0, spd: 10 }), // tempo stage — no target to deviate from
      point({ t: 30, hr: 145, thr: 140, spd: 10 }), // bmp stage, 5bpm over target
    ];
    const summary = analyzeRun(telemetry, { endT: 60 });

    expect(summary.hrTarget).toBeDefined();
    expect(summary.hrTarget?.avgDeviationBpm).toBeCloseTo(5, 5);
    expect(summary.hrTarget?.pctInTarget).toBeCloseTo(100, 5); // within the ±5bpm band
  });

  it('returns undefined hrTarget when no segment has both hr and thr', () => {
    const telemetry = [point({ t: 0, hr: 0, thr: 140 }), point({ t: 30, hr: 150, thr: 0 })];
    const summary = analyzeRun(telemetry, { endT: 60 });
    expect(summary.hrTarget).toBeUndefined();
  });

  it('groups telemetry by stage index (si) and fills target info from the matching StageResult', () => {
    const telemetry = [
      point({ t: 0, si: 1, hr: 140, thr: 140, spd: 8 }),
      point({ t: 20, si: 2, hr: 170, thr: 170, spd: 14 }),
      point({ t: 35, si: 2, hr: 165, thr: 170, spd: 14 }),
    ];
    const stages: StageResult[] = [
      {
        type: 'simple',
        speedType: 'bmp',
        bmp: 140,
        duration: Timespan.fromSeconds(20),
        from: new Timespan(),
        to: Timespan.fromSeconds(20),
      },
      {
        type: 'sprint',
        speedType: 'bmp',
        bmp: 170,
        duration: Timespan.fromSeconds(20),
        from: Timespan.fromSeconds(20),
        to: Timespan.fromSeconds(40),
      },
    ];
    const summary = analyzeRun(telemetry, { endT: 40, stages });

    expect(summary.stages).toHaveLength(2);
    expect(summary.stages[0]).toMatchObject({ stageIndex: 1, targetBpm: 140, durationSeconds: 20 });
    expect(summary.stages[1]).toMatchObject({ stageIndex: 2, targetBpm: 170, durationSeconds: 20 });
    // Stage 2: hr=170 for 15s then hr=165 for 5s -> weighted avg.
    expect(summary.stages[1].avgHr).toBeCloseTo((170 * 15 + 165 * 5) / 20, 5);
  });

  it('buckets HR into 10bpm ranges by held duration', () => {
    const telemetry = [point({ t: 0, hr: 142 }), point({ t: 10, hr: 151 })];
    const summary = analyzeRun(telemetry, { endT: 20 });
    expect(summary.hrBuckets).toEqual([
      { bucketStart: 140, seconds: 10 },
      { bucketStart: 150, seconds: 10 },
    ]);
  });
});

describe('toSeries', () => {
  it('returns an empty array for empty telemetry', () => {
    expect(toSeries([])).toEqual([]);
  });

  it('converts t (seconds) to minutes and nulls out unset hr/thr', () => {
    const telemetry = [point({ t: 120, hr: 0, thr: 0, spd: 8 })];
    const [series] = toSeries(telemetry);
    expect(series.tMin).toBe(2);
    expect(series.hr).toBeNull();
    expect(series.thr).toBeNull();
    expect(series.deviation).toBeNull();
  });

  it('appends a final held point at endT so the last segment is drawn', () => {
    const telemetry = [point({ t: 0, hr: 140 })];
    const series = toSeries(telemetry, 60);
    expect(series).toHaveLength(2);
    expect(series[1].tMin).toBe(1);
    expect(series[1].hr).toBe(140);
  });
});
