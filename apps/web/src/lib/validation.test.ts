import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRunSchema, parseJsonBody, patchRunSchema, programDataSchema } from './validation';

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

  it('patchRunSchema requires telemetry as an array of flat numeric points', () => {
    const point = { t: 0, hr: 140, thr: 150, phr: 145, spd: 8.5, inc: 2, si: 1, err: 5 };
    expect(patchRunSchema.safeParse({ telemetry: [point] }).success).toBe(true);
    expect(patchRunSchema.safeParse({ telemetry: [{ ...point, hr: 'not a number' }] }).success).toBe(
      false
    );
    expect(patchRunSchema.safeParse({}).success).toBe(false);
  });
});
