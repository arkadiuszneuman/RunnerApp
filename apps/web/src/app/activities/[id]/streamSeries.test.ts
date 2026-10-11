import type { ActivityStreams } from '@runner/core';
import { describe, expect, it } from 'vitest';
import { streamSeries } from './streamSeries';

function streams(t: number[], hr: (number | null)[], spd: (number | null)[]): ActivityStreams {
  const none = t.map(() => null);
  return { t, d: none, hr, spd, alt: none, cad: none };
}

describe('streamSeries', () => {
  it('squeezes a pause out of the time axis and breaks the line across it', () => {
    // 9 Oct 2026: an 18-minute stop mid-run — HR fell from 158 to 92 while the timer was off.
    const s = streamSeries(
      streams([0, 5, 10, 1085, 1090], [150, 155, 158, 92, 95], [3, 3, 3, 3, 3])
    );
    expect(s.hr).toEqual([
      { x: 0, y: 150 },
      { x: 5 / 60, y: 155 },
      { x: 10 / 60, y: 158 },
      { x: 20 / 60, y: null },
      { x: 20 / 60, y: 92 },
      { x: 25 / 60, y: 95 },
    ]);
  });

  it('leaves walking out of the pace chart, and empty streams out entirely', () => {
    const s = streamSeries(streams([0, 5, 10], [null, null, null], [4, 0.5, 2]));
    expect(s.pace?.map((p) => p.y)).toEqual([250, null, 500]);
    expect(s.hr).toBeNull();
    expect(streamSeries(streams([0, 5], [150, 150], [0.5, 0])).pace).toBeNull();
  });
});
