import { describe, expect, it } from 'vitest';
import { bestEffort, bestEfforts, kilometreSplits } from './bestEfforts';

/** Samples every `step` seconds at a constant speed (m/s). */
function constantPace(speed: number, seconds: number, step = 1): { t: number[]; d: number[] } {
  const t: number[] = [];
  const d: number[] = [];
  for (let s = 0; s <= seconds; s += step) {
    t.push(s);
    d.push(s * speed);
  }
  return { t, d };
}

describe('bestEffort', () => {
  it('is distance / speed at a constant pace', () => {
    const { t, d } = constantPace(4, 1500); // 6 km at 4 m/s
    expect(bestEffort(t, d, 1000)).toBeCloseTo(250, 6);
    expect(bestEffort(t, d, 5000)).toBeCloseTo(1250, 6);
  });

  it('is undefined when the recording is shorter than the distance', () => {
    const { t, d } = constantPace(4, 100);
    expect(bestEffort(t, d, 1000)).toBeUndefined();
    expect(bestEffort([], [], 400)).toBeUndefined();
  });

  it('interpolates the window start between sparse samples', () => {
    // 10 s samples: 3 m/s for 300 s, then 5 m/s for 300 s.
    const t: number[] = [];
    const d: number[] = [];
    for (let s = 0; s <= 600; s += 10) {
      t.push(s);
      d.push(s <= 300 ? s * 3 : 900 + (s - 300) * 5);
    }
    // The fastest kilometre lies entirely in the 5 m/s part: 200 s, even though no sample
    // falls exactly 1000 m before another.
    expect(bestEffort(t, d, 1000)).toBeCloseTo(200, 6);
    // 1500 m must include 1500 - 1500 (5 m/s part) ... the 5 m/s part is exactly 1500 m long.
    expect(bestEffort(t, d, 1500)).toBeCloseTo(300, 6);
    // 2000 m needs 500 m of the slower part: 300 s + 500/3 s.
    expect(bestEffort(t, d, 2000)).toBeCloseTo(300 + 500 / 3, 6);
  });

  it('counts a pause inside the window (elapsed time)', () => {
    // 4 m/s, but stopped for 60 s after 500 m.
    const t = [0, 125, 185, 310];
    const d = [0, 500, 500, 1000];
    expect(bestEffort(t, d, 1000)).toBeCloseTo(310, 6);
  });
});

describe('bestEfforts', () => {
  it('fills every distance the recording covers', () => {
    const { t, d } = constantPace(3.5, 3700, 2); // ~12.95 km
    const result = bestEfforts(t, d);
    expect(Object.keys(result).sort()).toEqual(['10k', '1k', '1mi', '400m', '5k'].sort());
    expect(result['5k']).toBeCloseTo(5000 / 3.5, 0);
  });

  it('drops physically implausible windows (bad distance data)', () => {
    // A GPS spike: 2 km "covered" in 100 s.
    const t = [0, 100, 400];
    const d = [0, 2000, 3000];
    const result = bestEfforts(t, d);
    expect(result['1k']).toBeUndefined();
  });
});

describe('kilometreSplits', () => {
  it('times each full kilometre', () => {
    const t = [0, 300, 540, 600];
    const d = [0, 1000, 2000, 2200];
    expect(kilometreSplits(t, d)).toEqual([300, 240]);
  });

  it('interpolates crossings between samples', () => {
    const { t, d } = constantPace(4, 600, 7);
    const splits = kilometreSplits(t, d);
    expect(splits).toHaveLength(2);
    splits.forEach((s) => expect(s).toBeCloseTo(250, 0));
  });
});
