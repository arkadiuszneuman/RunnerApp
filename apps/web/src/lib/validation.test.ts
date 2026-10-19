import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createRunSchema,
  importActivitiesSchema,
  parseJsonBody,
  patchRunSchema,
  programDataSchema,
} from './validation';

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/example', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string): Request {
  return new Request('http://localhost/api/example', { method: 'POST', body });
}

describe('parseJsonBody', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('returns the parsed data on a valid body', async () => {
    const result = await parseJsonBody(jsonRequest({ name: 'My Program' }), schema);
    expect(result).toEqual({ ok: true, data: { name: 'My Program' } });
  });

  it('returns a 400 response on malformed JSON instead of throwing', async () => {
    const result = await parseJsonBody(rawRequest('{not json'), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it('returns a 400 response when the body violates the schema', async () => {
    const result = await parseJsonBody(jsonRequest({ name: '' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
});

describe('programDataSchema', () => {
  it('accepts a well-formed program', () => {
    const program = {
      stages: [
        {
          times: 1,
          stages: [
            {
              type: 'simple',
              speedType: 'bmp',
              duration: { totalMilliseconds: 60_000 },
              bmp: 140,
            },
          ],
        },
      ],
      cooldown: true,
    };
    expect(programDataSchema.safeParse(program).success).toBe(true);
  });

  it('rejects the wrong top-level shape', () => {
    expect(programDataSchema.safeParse({ stages: 'nope', cooldown: 'nope' }).success).toBe(false);
  });

  it('rejects an oversized stages array', () => {
    const tooMany = Array.from({ length: 201 }, () => ({ times: 1, stages: [] }));
    expect(programDataSchema.safeParse({ stages: tooMany, cooldown: false }).success).toBe(false);
  });
});

describe('createRunSchema / patchRunSchema', () => {
  it('createRunSchema requires a non-empty startedAt', () => {
    expect(createRunSchema.safeParse({ startedAt: '2024-01-01T00:00:00.000Z' }).success).toBe(true);
    expect(createRunSchema.safeParse({ startedAt: '' }).success).toBe(false);
    expect(createRunSchema.safeParse({}).success).toBe(false);
  });

  it("createRunSchema takes a temporary program's name, trimmed and non-empty", () => {
    const startedAt = '2024-01-01T00:00:00.000Z';
    expect(createRunSchema.parse({ startedAt, programId: null, programName: ' Próg ' })).toMatchObject({
      programName: 'Próg',
    });
    expect(createRunSchema.safeParse({ startedAt, programName: '  ' }).success).toBe(false);
    expect(createRunSchema.safeParse({ startedAt, programName: 'x'.repeat(201) }).success).toBe(false);
  });

  it('patchRunSchema requires telemetry as an array of flat numeric points', () => {
    const point = { t: 0, hr: 140, thr: 150, phr: 145, spd: 8.5, inc: 2, si: 1, err: 5 };
    expect(patchRunSchema.safeParse({ telemetry: [point] }).success).toBe(true);
    expect(
      patchRunSchema.safeParse({ telemetry: [{ ...point, hr: 'not a number' }] }).success
    ).toBe(false);
    expect(patchRunSchema.safeParse({}).success).toBe(false);
  });
});

describe('importActivitiesSchema', () => {
  const activity = (streams: Record<string, unknown>) => ({
    activities: [
      {
        startTime: '2026-10-09T05:30:00.000Z',
        sport: 'run',
        dedupKey: 'fit:1:2',
        metrics: { distanceM: 10, movingS: 10, elapsedS: 10, bestEfforts: {} },
        streams: {
          t: [0, 5],
          d: [0, 10],
          hr: [1, 1],
          spd: [2, 2],
          alt: [0, 0],
          cad: [1, 1],
          ...streams,
        },
      },
    ],
  });

  it('keeps a GPS route', () => {
    const parsed = importActivitiesSchema.parse(activity({ lat: [52.1, 52.2], lng: [21, null] }));
    expect(parsed.activities[0].streams?.lat).toEqual([52.1, 52.2]);
  });

  it('rejects a half, misaligned or out-of-range route', () => {
    expect(importActivitiesSchema.safeParse(activity({ lat: [52.1, 52.2] })).success).toBe(false);
    expect(importActivitiesSchema.safeParse(activity({ lat: [52], lng: [21] })).success).toBe(
      false
    );
    expect(
      importActivitiesSchema.safeParse(activity({ lat: [91, 0], lng: [21, 21] })).success
    ).toBe(false);
  });
});
