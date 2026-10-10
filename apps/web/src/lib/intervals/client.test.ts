// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { createIntervalsClient, IntervalsError } from './client';

function fakeFetch(respond: (url: string) => Response) {
  return vi.fn(async (url: string | URL | Request) =>
    respond(String(url))
  ) as unknown as typeof fetch & {
    mock: { calls: [string, RequestInit][] };
  };
}

describe('intervals.icu client', () => {
  it('authenticates with Basic API_KEY:<key> and lists activities by date', async () => {
    const fetchImpl = fakeFetch(() => Response.json([{ id: 123, type: 'Run' }, { nope: true }]));
    const client = createIntervalsClient('secret-key', fetchImpl);
    const list = await client.listActivities('2026-01-01', '2026-10-10');
    expect(list).toEqual([{ id: '123', type: 'Run' }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-01-01&newest=2026-10-10'
    );
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('API_KEY:secret-key').toString('base64')}`
    );
  });

  it('maps failures to IntervalsError, with Retry-After on 429', async () => {
    const unauthorized = createIntervalsClient(
      'k',
      fakeFetch(() => new Response('no', { status: 401 }))
    );
    await expect(unauthorized.getAthlete()).rejects.toMatchObject({ status: 401, isAuth: true });

    const limited = createIntervalsClient(
      'k',
      fakeFetch(() => new Response('slow down', { status: 429, headers: { 'retry-after': '30' } }))
    );
    const error = await limited.getAthlete().catch((e) => e);
    expect(error).toBeInstanceOf(IntervalsError);
    expect(error.retryAfterSec).toBe(30);
  });

  it('gunzips downloaded files only when they are gzipped', async () => {
    const fit = new Uint8Array([14, 16, 1, 2, 3]);
    const gz = createIntervalsClient(
      'k',
      fakeFetch(() => new Response(gzipSync(fit)))
    );
    expect(await gz.downloadFile('i1')).toEqual(fit);
    const plain = createIntervalsClient(
      'k',
      fakeFetch(() => new Response(fit))
    );
    expect(await plain.downloadFile('i1')).toEqual(fit);
  });
});
