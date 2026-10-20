import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.restoreAllMocks());

describe('GET /api/android/latest', () => {
  it('passes on the published build', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ versionCode: 3, versionName: '1.0.3' })
    );
    const response = await GET();
    expect(await response.json()).toEqual({ versionCode: 3, versionName: '1.0.3' });
    expect(response.headers.get('Cache-Control')).toContain('s-maxage');
  });

  it('answers null when nothing usable is published or GitHub is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    expect(await (await GET()).json()).toBeNull();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ versionCode: 'x' }));
    expect(await (await GET()).json()).toBeNull();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await (await GET()).json()).toBeNull();
  });
});
