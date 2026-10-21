import { describe, expect, it } from 'vitest';
import {
  byHour,
  byPeriod,
  byWeekday,
  cumulativeByYear,
  distanceHistogram,
  rollingMean,
  totals,
  weekStreaks,
} from './aggregate';
import { applyFilter, resolveRange } from './filters';
import { trainingLoad, trimp, zoneSeconds } from './load';
import { personalRecords } from './records';
import { buildStatsActivities } from './statsActivity';
import { activity } from './testUtils';

const DAY = 86_400_000;
// Monday 2026-10-05, 07:00.
const MON = Date.UTC(2026, 9, 5, 7);

describe('totals', () => {
  it('sums and time-weights heart rate', () => {
    const t = totals([
      activity({ startMs: MON, distanceM: 10_000, movingS: 3000, avgHr: 140 }),
      activity({ startMs: MON + DAY, distanceM: 5_000, movingS: 1000, avgHr: 160, elevGainM: 20 }),
    ]);
    expect(t.count).toBe(2);
    expect(t.distanceM).toBe(15_000);
    expect(t.paceSPerKm).toBeCloseTo(4000 / 15, 6);
    expect(t.avgHr).toBeCloseTo((140 * 3000 + 160 * 1000) / 4000, 6);
    expect(t.longest?.distanceM).toBe(10_000);
    expect(t.elevGainM).toBe(20);
  });
});

describe('byPeriod', () => {
  it('buckets by ISO week and keeps empty weeks', () => {
    const weeks = byPeriod(
      [
        activity({ startMs: MON }),
        activity({ startMs: MON + 6 * DAY }),
        activity({ startMs: MON + 15 * DAY }),
      ],
      'week'
    );
    expect(weeks.map((w) => [new Date(w.start).toISOString().slice(0, 10), w.count])).toEqual([
      ['2026-10-05', 2],
      ['2026-10-12', 0],
      ['2026-10-19', 1],
    ]);
  });

  it('buckets by month and year', () => {
    const list = [
      activity({ startMs: Date.UTC(2025, 11, 31) }),
      activity({ startMs: Date.UTC(2026, 1, 1) }),
    ];
    expect(byPeriod(list, 'month')).toHaveLength(3);
    expect(byPeriod(list, 'year').map((y) => y.count)).toEqual([1, 1]);
  });
});

describe('cumulativeByYear', () => {
  it('accumulates kilometres day by day, the current year up to today', () => {
    const years = cumulativeByYear(
      [
        activity({ startMs: Date.UTC(2025, 0, 1), distanceM: 5000 }),
        activity({ startMs: Date.UTC(2025, 0, 3), distanceM: 10_000 }),
        activity({ startMs: Date.UTC(2026, 0, 2), distanceM: 8000 }),
      ],
      Date.UTC(2026, 0, 5)
    );
    expect(years.get(2025)!.slice(0, 4)).toEqual([5, 5, 15, 15]);
    expect(years.get(2025)).toHaveLength(365);
    expect(years.get(2026)).toEqual([0, 8, 8, 8, 8]);
  });
});

describe('weekStreaks', () => {
  it('counts consecutive weeks, letting this week still be empty', () => {
    const list = [MON - 21 * DAY, MON - 14 * DAY, MON - 7 * DAY, MON - 35 * DAY].map((startMs) =>
      activity({ startMs })
    );
    expect(weekStreaks(list, MON + DAY)).toEqual({ current: 3, longest: 3 });
    expect(weekStreaks(list, MON + 8 * DAY)).toEqual({ current: 0, longest: 3 });
  });
});

describe('distributions', () => {
  it('by weekday, hour and distance', () => {
    const list = [
      activity({ startMs: MON }),
      activity({ startMs: MON + 6 * DAY + 11 * 3600_000, distanceM: 21_000 }),
    ];
    expect(byWeekday(list).map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
    const hours = byHour(list);
    expect(hours[7]).toBe(1);
    expect(hours[18]).toBe(1);
    const bins = distanceHistogram(list, 5, 20);
    expect(bins.map((b) => b.count)).toEqual([0, 0, 1, 0, 1]);
  });

  it('rolling mean over a window', () => {
    const r = rollingMean(
      [
        { x: 0, y: 10 },
        { x: DAY, y: 20 },
        { x: 10 * DAY, y: 30 },
      ],
      7
    );
    expect(r.map((p) => p.y)).toEqual([10, 15, 30]);
  });
});

describe('filters', () => {
  const list = [
    activity({ startMs: Date.UTC(2026, 9, 1), source: 'app', programName: 'Tempo 5x1k' }),
    activity({
      startMs: Date.UTC(2026, 3, 1),
      source: 'watch',
      sport: 'trail',
      name: 'Hills',
      distanceM: 21_000,
    }),
    activity({ startMs: Date.UTC(2025, 5, 1), source: 'both' }),
  ];
  const now = Date.UTC(2026, 9, 10, 12);

  it('resolves presets', () => {
    expect(resolveRange({ range: 'ytd', source: 'all', sports: [] }, now)).toEqual({
      fromMs: Date.UTC(2026, 0, 1),
    });
    expect(resolveRange({ range: 'lastYear', source: 'all', sports: [] }, now)).toEqual({
      fromMs: Date.UTC(2025, 0, 1),
      toMs: Date.UTC(2026, 0, 1),
    });
    expect(
      resolveRange(
        { range: 'custom', from: '2026-01-01', to: '2026-01-31', source: 'all', sports: [] },
        now
      )
    ).toEqual({ fromMs: Date.UTC(2026, 0, 1), toMs: Date.UTC(2026, 1, 1) });
  });

  it('filters by range, source, sport, distance and text', () => {
    const f = (patch: object) =>
      applyFilter(list, { range: 'all', source: 'all', sports: [], ...patch }, now).map(
        (a) => a.startMs
      );
    expect(f({ range: 'ytd' })).toHaveLength(2);
    expect(f({ source: 'app' })).toHaveLength(2);
    expect(f({ source: 'watch' })).toEqual([Date.UTC(2026, 3, 1)]);
    expect(f({ sports: ['trail'] })).toEqual([Date.UTC(2026, 3, 1)]);
    expect(f({ minKm: 15 })).toEqual([Date.UTC(2026, 3, 1)]);
    expect(f({ query: 'tempo' })).toEqual([Date.UTC(2026, 9, 1)]);
  });
});

describe('records', () => {
  it('keeps the fastest per distance', () => {
    const records = personalRecords([
      activity({ startMs: 1, bestEfforts: { '5k': 1300, '1k': 240 } }),
      activity({ startMs: 2, bestEfforts: { '5k': 1250 } }),
    ]);
    expect(records.map((r) => [r.key, r.seconds, r.activity.startMs])).toEqual([
      ['1k', 240, 1],
      ['5k', 1250, 2],
    ]);
  });
});

describe('training load and zones', () => {
  const hr = { maxHr: 200, restingHr: 50 };

  it('weights time at higher heart rate more', () => {
    const easy = trimp({ start: 125, s: [3600] }, hr);
    const hard = trimp({ start: 170, s: [3600] }, hr);
    expect(easy).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(easy * 2);
  });

  it('builds fitness/fatigue/form day by day', () => {
    const points = trainingLoad(
      [activity({ startMs: MON, hrHist: { start: 150, s: [3600] } })],
      hr,
      MON + 10 * DAY
    );
    expect(points).toHaveLength(11);
    expect(points[0].load).toBeGreaterThan(0);
    expect(points[0].atl).toBeGreaterThan(points[0].ctl);
    expect(points[10].atl).toBeLessThan(points[0].atl);
    expect(points[1].tsb).toBeLessThan(0);
  });

  it('splits time into five zones by % of max HR', () => {
    expect(zoneSeconds({ start: 100, s: [10, ...Array(79).fill(0), 20] }, 200)).toEqual([
      10, 0, 0, 0, 20,
    ]);
  });
});

describe('buildStatsActivities', () => {
  const metrics = (distanceM: number, avgHr?: number, seconds = 0) => ({
    distanceM,
    movingS: 1800,
    elapsedS: 1800,
    bestEfforts: {},
    ...(avgHr && { avgHr, hrHist: { start: avgHr, s: [seconds] } }),
  });

  it('merges a linked pair, measured by the watch', () => {
    const list = buildStatsActivities(
      [
        {
          id: 'r1',
          startMs: MON + 60_000,
          tzOffsetMin: 120,
          metrics: { ...metrics(5000, 140, 1800), bestEfforts: { '1k': 280 }, elevGainM: 40 },
          programName: 'Easy',
        },
      ],
      [
        {
          id: 'a1',
          startMs: MON,
          tzOffsetMin: 120,
          sport: 'treadmill',
          linkedRunId: 'r1',
          metrics: { ...metrics(5300, 142, 100), bestEfforts: { '1k': 300 }, cadenceSpm: 170 },
        },
        { id: 'a2', startMs: MON + DAY, tzOffsetMin: 120, sport: 'run', metrics: metrics(8000) },
      ]
    );
    expect(list).toHaveLength(2);
    const pair = list.find((a) => a.source === 'both')!;
    expect(pair).toMatchObject({
      runId: 'r1',
      activityId: 'a1',
      distanceM: 5300,
      bestEfforts: { '1k': 300 },
      avgHr: 142,
      cadenceSpm: 170,
      // Only the app's recording has it.
      elevGainM: 40,
      programName: 'Easy',
    });
    expect(pair.localMs).toBe(MON + 120 * 60_000);
  });

  it('falls back to the belt where the watch recorded nothing', () => {
    const [pair] = buildStatsActivities(
      [{ id: 'r1', startMs: MON, tzOffsetMin: 0, metrics: metrics(5000, 140, 1800) }],
      [
        {
          id: 'a1',
          startMs: MON,
          tzOffsetMin: 0,
          sport: 'treadmill',
          linkedRunId: 'r1',
          metrics: metrics(0),
        },
      ]
    );
    expect(pair).toMatchObject({ source: 'both', distanceM: 5000, avgHr: 140 });
  });

  it('drops empty runs unless asked to keep them', () => {
    const runs = [{ id: 'r1', startMs: MON, tzOffsetMin: 0, metrics: metrics(0) }];
    expect(buildStatsActivities(runs, [])).toEqual([]);
    expect(buildStatsActivities(runs, [], { keepEmpty: true })).toHaveLength(1);
  });
});
