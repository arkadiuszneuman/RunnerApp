import { describe, expect, it } from 'vitest';
import { matchRuns, runInterval } from './matching';

const T0 = Date.UTC(2026, 9, 1, 6, 0, 0);
const min = (m: number) => T0 + m * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('runInterval', () => {
  it('prefers the original wall-clock start', () => {
    expect(
      runInterval({
        wallStartedAt: iso(min(0)),
        startedAt: iso(min(5)),
        finishedAt: iso(min(60)),
        durationMs: 50 * 60_000,
      })
    ).toEqual({ startMs: min(0), endMs: min(60) });
  });

  it('counts the running time back from the finish when the start was shifted by pauses', () => {
    // Paused for 5 minutes: startedAt was moved 5 minutes later than the real start.
    expect(
      runInterval({ startedAt: iso(min(5)), finishedAt: iso(min(60)), durationMs: 55 * 60_000 })
    ).toEqual({
      startMs: min(5),
      endMs: min(60),
    });
  });

  it('falls back to startedAt..finishedAt without a duration (Bluetooth drop-out)', () => {
    expect(runInterval({ startedAt: iso(min(0)), finishedAt: iso(min(30)) })).toEqual({
      startMs: min(0),
      endMs: min(30),
    });
  });

  it('ends an unfinished run at its last telemetry point', () => {
    expect(runInterval({ startedAt: iso(min(0)) }, 20 * 60)).toEqual({
      startMs: min(0),
      endMs: min(20),
    });
    expect(runInterval({ startedAt: iso(min(0)) })).toBeUndefined();
  });
});

describe('matchRuns', () => {
  const run = (id: string, from: number, to: number) => ({
    id,
    startMs: min(from),
    endMs: min(to),
  });

  it('links a run to the activity recorded alongside it', () => {
    const pairs = matchRuns(
      [run('r1', 2, 50)],
      [{ ...run('a1', 0, 52) }, { ...run('a2', 120, 160) }]
    );
    expect(pairs).toEqual([{ runId: 'r1', activityId: 'a1' }]);
  });

  it('requires half of the shorter span to overlap', () => {
    expect(matchRuns([run('r1', 0, 60)], [run('a1', 40, 100)])).toEqual([]);
    expect(matchRuns([run('r1', 0, 60)], [run('a1', 25, 45)])).toEqual([
      { runId: 'r1', activityId: 'a1' },
    ]);
  });

  it('pairs one-to-one, strongest overlap first', () => {
    const pairs = matchRuns([run('r1', 0, 30), run('r2', 31, 60)], [run('a1', 0, 61)]);
    expect(pairs).toHaveLength(1);
    // Both runs are fully inside a1 (ratio 1), so either is acceptable — but never both.
    const twoActivities = matchRuns(
      [run('r1', 0, 30), run('r2', 31, 60)],
      [run('a1', 0, 30), run('a2', 29, 61)]
    );
    expect(twoActivities).toEqual(
      expect.arrayContaining([
        { runId: 'r1', activityId: 'a1' },
        { runId: 'r2', activityId: 'a2' },
      ])
    );
  });

  it('leaves existing links and explicit unlinks alone', () => {
    expect(
      matchRuns([run('r1', 0, 30)], [{ ...run('a1', 0, 30), linkMode: 'none' as const }])
    ).toEqual([]);
    expect(matchRuns([run('r1', 0, 30)], [{ ...run('a1', 0, 30), linkedRunId: 'r9' }])).toEqual([]);
    // r1 already has an activity (a2), so the new a1 is not attached to it.
    expect(
      matchRuns(
        [run('r1', 0, 30)],
        [run('a1', 0, 30), { ...run('a2', 0, 30), linkedRunId: 'r1', linkMode: 'auto' as const }]
      )
    ).toEqual([]);
  });
});
