import { describe, expect, it } from 'vitest';
import {
  garminIdOf,
  isImportable,
  planRouteRefresh,
  planSync,
  sportOf,
  summaryOnlyCandidate,
} from './syncPlan';

const at = (iso: string) => ({ start_date: iso });

describe('isImportable / sportOf', () => {
  it('takes Garmin runs and skips other sports and Strava stubs', () => {
    expect(
      isImportable({
        id: '1',
        type: 'Run',
        source: 'GARMIN_CONNECT',
        ...at('2026-10-01T06:00:00Z'),
      })
    ).toBe(true);
    expect(isImportable({ id: '2', type: 'Ride', ...at('2026-10-01T06:00:00Z') })).toBe(false);
    expect(
      isImportable({ id: '3', type: 'Run', source: 'STRAVA', ...at('2026-10-01T06:00:00Z') })
    ).toBe(false);
    expect(isImportable({ id: '4', type: 'Run' })).toBe(false);
  });

  it('maps types to sports', () => {
    expect(sportOf({ id: '1', type: 'Run', trainer: true })).toBe('treadmill');
    expect(sportOf({ id: '1', type: 'Run' })).toBe('run');
    expect(sportOf({ id: '1', type: 'TrailRun' })).toBe('trail');
    expect(sportOf({ id: '1', type: 'VirtualRun' })).toBe('indoor');
  });
});

describe('planSync', () => {
  const listed = [
    { id: 'i1', type: 'Run', ...at('2026-10-01T06:00:00Z') },
    { id: 'i2', type: 'Run', ...at('2026-10-03T06:00:00Z') },
    { id: 'i3', type: 'Run', ...at('2026-10-05T06:00:00Z') },
    { id: 'i4', type: 'Walk', ...at('2026-10-06T06:00:00Z') },
  ];

  it('downloads what is not stored yet, newest first', () => {
    expect(planSync(listed, []).download.map((a) => a.id)).toEqual(['i3', 'i2', 'i1']);
  });

  it('skips known ids (including deleted ones) and attaches ids to file uploads with the same start', () => {
    const plan = planSync(listed, [
      { id: 'a1', intervalsId: 'i1', garminId: null, startMs: Date.parse('2026-10-01T06:00:00Z') },
      { id: 'a2', intervalsId: null, garminId: null, startMs: Date.parse('2026-10-03T06:00:01Z') },
    ]);
    expect(plan.download.map((a) => a.id)).toEqual(['i3']);
    expect(plan.attach).toEqual([{ activityId: 'a2', intervalsId: 'i2' }]);
    expect(plan.garminIds).toEqual([]);
  });

  it("records Garmin Connect's activity id on stored activities that lack one", () => {
    const fromGarmin = (id: string, garminId: string, start: string) => ({
      id,
      type: 'Run',
      source: 'GARMIN_CONNECT',
      external_id: garminId,
      ...at(start),
    });
    const plan = planSync(
      [
        fromGarmin('i1', '17000000001', '2026-10-01T06:00:00Z'),
        fromGarmin('i2', '17000000002', '2026-10-03T06:00:00Z'),
        fromGarmin('i3', '17000000003', '2026-10-05T06:00:00Z'),
      ],
      [
        {
          id: 'a1',
          intervalsId: 'i1',
          garminId: null,
          startMs: Date.parse('2026-10-01T06:00:00Z'),
        },
        {
          id: 'a2',
          intervalsId: null,
          garminId: null,
          startMs: Date.parse('2026-10-03T06:00:00Z'),
        },
        {
          id: 'a3',
          intervalsId: 'i3',
          garminId: '17000000003',
          startMs: Date.parse('2026-10-05T06:00:00Z'),
        },
      ]
    );
    expect(plan.garminIds).toEqual([{ activityId: 'a1', garminId: '17000000001' }]);
    expect(plan.attach).toEqual([{ activityId: 'a2', intervalsId: 'i2', garminId: '17000000002' }]);
    expect(plan.download).toEqual([]);
  });
});

describe('summaryOnlyCandidate / garminIdOf', () => {
  it('builds a stats-only activity from the list entry', () => {
    const activity = {
      id: 'i9',
      type: 'Run',
      source: 'GARMIN_CONNECT',
      external_id: '17000000009',
      name: 'Evening Run',
      distance: 8000,
      moving_time: 2400,
      elapsed_time: 2500,
      average_heartrate: 150,
      ...at('2026-10-01T18:00:00Z'),
    };
    expect(summaryOnlyCandidate(activity, 'boom')).toMatchObject({
      startTime: '2026-10-01T18:00:00.000Z',
      sport: 'run',
      dedupKey: 'intervals:i9',
      garminId: '17000000009',
      importError: 'boom',
      metrics: { distanceM: 8000, movingS: 2400, elapsedS: 2500, avgHr: 150, bestEfforts: {} },
    });
    expect(garminIdOf({ id: 'x', source: 'UPLOAD', external_id: '123456789' })).toBeUndefined();
  });
});

describe('planRouteRefresh', () => {
  const row = (
    id: string,
    patch: Partial<Parameters<typeof planRouteRefresh>[0][number]> = {}
  ) => ({
    id,
    intervalsId: `i-${id}`,
    sport: 'run',
    startMs: Number(id.replace(/\D/g, '')) * 1000,
    hasStreams: true,
    streamsVersion: 1,
    deleted: false,
    ...patch,
  });

  it('re-fetches outdoor intervals.icu activities without a route, newest first', () => {
    const plan = planRouteRefresh([
      row('a1'),
      row('a3', { sport: 'trail' }),
      row('a2', { sport: 'treadmill' }),
      row('a4', { streamsVersion: 2 }),
      row('a5', { intervalsId: null }),
      row('a6', { deleted: true }),
      row('a7', { hasStreams: false }),
    ]);
    expect(plan.map((s) => s.id)).toEqual(['a3', 'a1']);
  });
});
