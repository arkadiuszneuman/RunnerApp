import { describe, expect, it } from 'vitest';
import { Timespan, type OutboxEntry } from '@runner/core';
import type { RunListItem } from '../userData';
import {
  countPendingRuns,
  overlayActiveProgramId,
  overlayPrograms,
  overlayRuns,
  pendingProgram,
} from './overlay';
import { writes, type QueuedWrite } from './requests';

let seq = 0;
function entry(write: QueuedWrite, enqueuedAt = Date.UTC(2026, 8, 13)): OutboxEntry {
  return {
    id: `e${++seq}`,
    key: write.options.key,
    method: write.request.method,
    url: write.request.url,
    body: write.request.body === undefined ? undefined : JSON.parse(JSON.stringify(write.request.body)),
    enqueuedAt,
    attempts: 0,
  };
}

const serverPrograms = [
  { id: 'p1', name: 'Intervals', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p2', name: 'Long run', updatedAt: '2026-01-02T00:00:00.000Z' },
];

describe('overlayPrograms', () => {
  it('returns the server list untouched when nothing is pending', () => {
    expect(overlayPrograms(serverPrograms, [])).toBe(serverPrograms);
  });

  it('adds programs created offline, applies renames and hides deletes', () => {
    const result = overlayPrograms(serverPrograms, [
      entry(writes.createProgram('p3', 'Tempo')),
      entry(writes.updateProgram('p1', { name: 'Hills' })),
      entry(writes.deleteProgram('p2')),
    ]);
    expect(result.map((p) => [p.id, p.name])).toEqual([
      ['p3', 'Tempo'],
      ['p1', 'Hills'],
    ]);
  });

  it('does not duplicate a created program the server already returns', () => {
    const result = overlayPrograms(serverPrograms, [entry(writes.createProgram('p1', 'Intervals'))]);
    expect(result).toHaveLength(2);
  });

  it('keeps the name on a data-only update', () => {
    const result = overlayPrograms(serverPrograms, [
      entry(writes.updateProgram('p1', { data: { stages: [], cooldown: true } })),
    ]);
    expect(result[0].name).toBe('Intervals');
  });
});

describe('pendingProgram', () => {
  it('is undefined when nothing is queued for that program', () => {
    expect(pendingProgram('p1', [entry(writes.updateProgram('p2', { name: 'x' }))])).toBeUndefined();
  });

  it('combines create + later edits, reviving Timespans in the data', () => {
    const data = {
      stages: [
        {
          times: 2,
          stages: [{ type: 'simple' as const, speedType: 'bmp' as const, bmp: 150, duration: Timespan.fromMinutes(3) }],
        },
      ],
      cooldown: false,
    };
    const pending = pendingProgram('p9', [
      entry(writes.createProgram('p9', 'New')),
      entry(writes.updateProgram('p9', { data })),
      entry(writes.updateProgram('p9', { name: 'Renamed' })),
    ]);
    expect(pending?.created).toBe(true);
    expect(pending?.deleted).toBe(false);
    expect(pending?.name).toBe('Renamed');
    expect(pending?.data?.stages[0].stages[0].duration).toBeInstanceOf(Timespan);
    expect(pending?.data?.stages[0].stages[0].duration.totalMinutes).toBe(3);
  });

  it('flags a pending delete', () => {
    expect(pendingProgram('p1', [entry(writes.deleteProgram('p1'))])?.deleted).toBe(true);
  });
});

describe('overlayActiveProgramId', () => {
  it('prefers the latest queued settings write over the server value', () => {
    expect(overlayActiveProgramId('p1', [])).toBe('p1');
    expect(overlayActiveProgramId('p1', [entry(writes.setActiveProgram('p2'))])).toBe('p2');
    expect(overlayActiveProgramId('p1', [entry(writes.setActiveProgram(null))])).toBeNull();
  });
});

describe('run overlays', () => {
  const run = (id: string) => ({ id }) as RunListItem;

  it('hides runs deleted offline', () => {
    expect(overlayRuns([run('r1'), run('r2')], [entry(writes.deleteRun('r1'))]).map((r) => r.id)).toEqual(['r2']);
  });

  it('counts distinct runs with pending writes', () => {
    const meta = { programId: null, program: { stages: [], cooldown: false } };
    expect(
      countPendingRuns([
        entry(writes.createRun('r1', '2026-09-13T10:00:00.000Z', meta)),
        entry(writes.patchRun('r1', { telemetry: [] })),
        entry(writes.patchRun('r2', { telemetry: [] })),
        entry(writes.updateProgram('p1', { name: 'x' })),
      ])
    ).toBe(2);
  });
});
