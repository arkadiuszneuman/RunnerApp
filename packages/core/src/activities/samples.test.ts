import { describe, expect, it } from 'vitest';
import { histogramMean, hrHistogram, resample, sampleDurations, steadyState } from './samples';

describe('sampleDurations', () => {
  it('holds each sample until the next, capping pauses', () => {
    expect(sampleDurations([0, 1, 3, 60, 61])).toEqual([1, 2, 10, 1, 1]);
  });
});

describe('hrHistogram', () => {
  it('accumulates seconds per bpm and skips missing readings', () => {
    const hist = hrHistogram([140, 141, null, 140, 0], [2, 1, 5, 3, 4]);
    expect(hist).toEqual({ start: 140, s: [5, 1] });
    expect(histogramMean(hist)).toBeCloseTo((140 * 5 + 141) / 6, 6);
  });

  it('is undefined without any reading', () => {
    expect(hrHistogram([null, 0], [1, 1])).toBeUndefined();
  });
});

describe('steadyState', () => {
  it('skips the warm-up and the tail, and needs 5 minutes', () => {
    const t: number[] = [];
    const spd: (number | null)[] = [];
    const hr: (number | null)[] = [];
    for (let s = 0; s < 3600; s++) {
      t.push(s);
      spd.push(3);
      // HR still climbing during the first 10 minutes.
      hr.push(s < 600 ? 100 + s / 10 : 150);
    }
    const steady = steadyState(t, spd, hr, sampleDurations(t));
    expect(steady?.hr).toBe(150);
    expect(steady?.speedMps).toBe(3);
    expect(steady?.seconds).toBeGreaterThan(2500);

    const short = steadyState(t.slice(0, 200), spd, hr, sampleDurations(t.slice(0, 200)));
    expect(short).toBeUndefined();
  });

  it('ignores walking samples and averages the incline', () => {
    const t = Array.from({ length: 2000 }, (_, i) => i);
    const spd = t.map((s) => (s % 2 === 0 ? 3 : 1)); // every other second walking
    const hr = t.map(() => 140);
    const grade = t.map(() => 2);
    const steady = steadyState(t, spd, hr, sampleDurations(t), grade);
    expect(steady?.speedMps).toBe(3);
    expect(steady?.gradePct).toBe(2);
  });
});

describe('resample', () => {
  it('keeps the last distance and averages the rest per bin, leaving gaps out', () => {
    const out = resample(
      {
        t: [0, 1, 2, 3, 4, 5, 6, 20],
        d: [0, 3, 6, 9, 12, 15, 18, 20],
        hr: [100, 102, null, 104, 106, 110, 110, 120],
        spd: [3, 3, 3, 3, 3, 3, 3, 1],
        alt: [10, 10, 10, 10, 10, 11, 11, 12],
        cad: [170, 170, 170, 170, 170, null, null, 100],
      },
      5
    );
    expect(out.t).toEqual([0, 5, 20]);
    expect(out.d).toEqual([12, 18, 20]);
    expect(out.hr).toEqual([103, 110, 120]);
    expect(out.cad).toEqual([170, null, 100]);
  });
});
