import { Timespan } from '@runner/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunRow } from '../../userData';
import { buildExportFilename, buildExportJson, exportRun } from './exportRun';

function makeRow(overrides: Partial<RunRow['data']> = {}): RunRow {
  return {
    id: 'run-1',
    createdAt: '2026-03-04T09:15:00.000Z',
    data: {
      startedAt: '2026-03-04T09:15:00.000Z',
      finishedAt: '2026-03-04T09:45:00.000Z',
      durationMs: 1_800_000,
      telemetry: [{ t: 0, hr: 120, thr: 140, phr: 121, spd: 8, inc: 2, si: 0, err: 20 }],
      controller: 'adaptive',
      program: {
        cooldown: true,
        stages: [
          {
            times: 1,
            stages: [
              { type: 'simple', speedType: 'bmp', bmp: 140, duration: Timespan.fromMinutes(5) },
            ],
          },
        ],
      },
      ...overrides,
    },
  };
}

describe('buildExportFilename', () => {
  it('formats as run-YYYY-MM-DD-HHmm.json from the run start time, in local time', () => {
    const row = makeRow({ startedAt: new Date(2026, 2, 4, 9, 5).toISOString() });
    expect(buildExportFilename(row)).toBe('run-2026-03-04-0905.json');
  });

  it('zero-pads month, day, hour and minute', () => {
    const row = makeRow({ startedAt: new Date(2026, 0, 1, 0, 3).toISOString() });
    expect(buildExportFilename(row)).toBe('run-2026-01-01-0003.json');
  });
});

describe('buildExportJson', () => {
  it('includes id, createdAt and every field of data, with Timespans as plain objects', () => {
    const row = makeRow();
    const parsed = JSON.parse(buildExportJson(row));

    expect(parsed.id).toBe('run-1');
    expect(parsed.createdAt).toBe(row.createdAt);
    expect(parsed.startedAt).toBe(row.data.startedAt);
    expect(parsed.finishedAt).toBe(row.data.finishedAt);
    expect(parsed.durationMs).toBe(row.data.durationMs);
    expect(parsed.controller).toBe('adaptive');
    expect(parsed.telemetry).toEqual(row.data.telemetry);
    // Timespan serializes via its own toJSON() — {totalMilliseconds}, not re-hydrated — this
    // export is for reading (by a person or Claude), not for round-tripping through the app's
    // own Timespan.reviver.
    expect(parsed.program.stages[0].stages[0].duration).toEqual({ totalMilliseconds: 300_000 });
  });

  it('produces valid, parseable JSON even with an empty telemetry array', () => {
    const row = makeRow({ telemetry: [] });
    expect(() => JSON.parse(buildExportJson(row))).not.toThrow();
  });
});

describe('exportRun on web (not the native shell)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the JSON via a clicked, then discarded, object-URL anchor', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const row = makeRow();
    const result = await exportRun(row);

    expect(result).toEqual({ method: 'download' });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // The anchor is removed from the DOM again after the click (no leftover node).
    expect(document.querySelector(`a[download="${buildExportFilename(row)}"]`)).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');

    vi.unstubAllGlobals();
  });
});
