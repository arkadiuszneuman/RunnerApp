import type { ActivityStreams } from '@runner/core';
import { describe, expect, it } from 'vitest';
import {
  colorStep,
  COLOR_STEPS,
  formatMetric,
  metricRamp,
  NO_VALUE_COLOR,
  routeRuns,
  routeScale,
  stepColor,
} from './routeSegments';

function streams(spd: (number | null)[], t = spd.map((_, i) => i * 5)): ActivityStreams {
  return {
    t,
    d: spd.map(() => null),
    hr: spd.map(() => 150),
    spd,
    alt: spd.map(() => null),
    cad: spd.map(() => null),
    lat: spd.map((_, i) => 50 + i * 1e-4),
    lng: spd.map(() => 19),
  };
}

describe('routeScale / colorStep', () => {
  it('spans the 5th–95th percentile, clamping outliers to the ends', () => {
    const values = Array.from({ length: 101 }, (_, i) => i);
    const scale = routeScale([...values, null])!;
    expect(scale.low).toBeCloseTo(5);
    expect(scale.high).toBeCloseTo(95);
    expect(colorStep(0, scale)).toBe(0);
    expect(colorStep(1000, scale)).toBe(COLOR_STEPS - 1);
    expect(colorStep(null, scale)).toBeNull();
  });

  it('puts a constant value mid-ramp', () => {
    expect(colorStep(3, routeScale([3, 3, 3]))).toBe(COLOR_STEPS / 2);
  });
});

describe('metricRamp / stepColor', () => {
  it("runs from a deep shade to a pale tint of the metric's own colour", () => {
    const ramp = metricRamp('hr');
    expect(ramp[2]).toBe('rgb(230, 103, 103)'); // chartColors.hr
    expect(stepColor(0, ramp)).toBe('rgb(138, 67, 72)');
    expect(stepColor(COLOR_STEPS - 1, ramp)).toBe('rgb(244, 190, 190)');
    expect(stepColor(null, ramp)).toBe(NO_VALUE_COLOR);
  });
});

describe('routeRuns', () => {
  it('merges same-coloured segments and starts a new run on a colour change', () => {
    const runs = routeRuns(streams([3, 3, 3, 4, 4]), 'pace');
    expect(runs.map((r) => r.points.length)).toEqual([3, 3]);
    // The second run starts where the first one ended — no hole in the line.
    expect(runs[1].points[0]).toEqual(runs[0].points[2]);
  });

  it('breaks the line across a pause and a missing fix', () => {
    const s = streams([3, 3, 3, 3, 3, 3], [0, 5, 10, 100, 105, 110]);
    s.lat![4] = null;
    expect(routeRuns(s, 'hr').map((r) => r.points.length)).toEqual([3]);
  });

  it('greys out walking when colouring by pace', () => {
    const runs = routeRuns(streams([3, 3, 0.5, 3]), 'pace');
    expect(runs.map((r) => r.step === null)).toEqual([false, true, false]);
  });

  it('is empty without a route', () => {
    expect(routeRuns({ ...streams([3, 3]), lat: undefined, lng: undefined }, 'pace')).toEqual([]);
  });
});

describe('formatMetric', () => {
  it('shows speed as pace', () => {
    expect(formatMetric('pace', 1000 / 300)).toBe('05:00/km');
    expect(formatMetric('hr', 151.6)).toBe('152 bpm');
  });
});
