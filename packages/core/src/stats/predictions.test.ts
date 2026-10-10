import { describe, expect, it } from 'vitest';
import {
  effectiveVo2max,
  fitRiegelExponent,
  predictRaces,
  riegel,
  tandaMarathonSeconds,
  timeForVdot,
  vdotOf,
} from './predictions';
import { activity } from './testUtils';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 10);

describe('VDOT', () => {
  it("matches Daniels' tables (VDOT 50) within a few seconds", () => {
    // Daniels' Running Formula: 19:57, 41:21, 1:31:35, 3:10:49 — the published equations land
    // within ~10 s of the rounded table values.
    expect(timeForVdot(50, 5000)).toBeCloseTo(19 * 60 + 57, -1.5);
    expect(timeForVdot(50, 10000)).toBeCloseTo(41 * 60 + 21, -1.5);
    expect(Math.abs(timeForVdot(50, 21097.5) - (91 * 60 + 35))).toBeLessThan(12);
    expect(Math.abs(timeForVdot(50, 42195) - (190 * 60 + 49))).toBeLessThan(12);
  });

  it('round-trips a performance', () => {
    expect(timeForVdot(vdotOf(10000, 2700), 10000)).toBeCloseTo(2700, 3);
  });
});

describe('Riegel / Tanda', () => {
  it('scales by distance with the exponent', () => {
    expect(riegel(1200, 5000, 10000, 1.06)).toBeCloseTo(1200 * 2 ** 1.06, 6);
  });

  it('fits the exponent to two distances, clamped', () => {
    const k = fitRiegelExponent([
      { metres: 5000, seconds: 1200 },
      { metres: 10000, seconds: 1200 * 2 ** 1.08 },
    ]);
    expect(k).toBeCloseTo(1.08, 6);
    expect(fitRiegelExponent([{ metres: 5000, seconds: 1200 }])).toBeUndefined();
    expect(
      fitRiegelExponent([
        { metres: 5000, seconds: 1200 },
        { metres: 10000, seconds: 1300 },
      ])
    ).toBe(1.01);
  });

  it('Tanda: 60 km/week at 5:30/km → about 3:31', () => {
    expect(Math.round(tandaMarathonSeconds(60, 330))).toBeCloseTo(3 * 3600 + 31 * 60 + 18, -1);
  });
});

describe('effectiveVo2max', () => {
  const hr = { maxHr: 190, restingHr: 50 };

  it('reads fitness from an easy steady run', () => {
    // 12 km/h at 75 % HRR on the flat, outdoors.
    const v = effectiveVo2max(
      activity({
        startMs: NOW,
        sport: 'run',
        steady: { speedMps: 12 / 3.6, hr: 155, seconds: 1800 },
      }),
      hr
    );
    expect(v).toBeGreaterThan(45);
    expect(v).toBeLessThan(55);
  });

  it('credits treadmill incline and ignores unusable runs', () => {
    const flat = effectiveVo2max(
      activity({ startMs: NOW, steady: { speedMps: 3, hr: 150, seconds: 1800, gradePct: 0 } }),
      hr
    )!;
    const uphill = effectiveVo2max(
      activity({ startMs: NOW, steady: { speedMps: 3, hr: 150, seconds: 1800, gradePct: 3 } }),
      hr
    )!;
    expect(uphill).toBeGreaterThan(flat);
    expect(
      effectiveVo2max(
        activity({ startMs: NOW, steady: { speedMps: 3, hr: 90, seconds: 1800 } }),
        hr
      )
    ).toBeUndefined();
    expect(
      effectiveVo2max(
        activity({ startMs: NOW, steady: { speedMps: 3, hr: 150, seconds: 300 } }),
        hr
      )
    ).toBeUndefined();
  });
});

describe('predictRaces', () => {
  it('combines methods and reports its basis', () => {
    const runs = [
      activity({ startMs: NOW - 3 * DAY, bestEfforts: { '5k': 1200, '10k': 2520 } }),
      activity({
        startMs: NOW - 10 * DAY,
        sport: 'run',
        steady: { speedMps: 3.2, hr: 150, seconds: 2400 },
      }),
      // Too old for the 12-week window.
      activity({ startMs: NOW - 200 * DAY, bestEfforts: { '5k': 1000 } }),
    ];
    const { predictions, basis } = predictRaces(runs, {
      nowMs: NOW,
      hr: { maxHr: 190, restingHr: 50 },
    });
    expect(basis.effortVdot?.key).toBe('5k');
    expect(basis.hrRuns).toBe(1);
    const fiveK = predictions.find((p) => p.key === '5k')!;
    expect(fiveK.methods.vdot).toBeCloseTo(1200, -1);
    expect(fiveK.methods.hr).toBeDefined();
    expect(predictions.map((p) => p.key)).toEqual(['5k', '10k', 'hm', 'm']);
    // Low volume: no Tanda.
    expect(predictions.find((p) => p.key === 'm')!.methods.tanda).toBeUndefined();
  });

  it('predicts nothing without data', () => {
    expect(predictRaces([], { nowMs: NOW }).predictions).toEqual([]);
  });
});
