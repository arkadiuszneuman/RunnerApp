import { gunzipSync } from 'node:zlib';

/**
 * Minimal intervals.icu API client (https://intervals.icu/api/v1/docs), authenticated with the
 * athlete's personal API key (HTTP Basic, user `API_KEY`). intervals.icu is an official Garmin
 * partner: once the user connects Garmin there, every watch activity shows up here with its
 * original FIT file. Only reads.
 */

// Overridable only so the sync can be exercised against a local stand-in.
const BASE_URL = process.env.INTERVALS_API_URL ?? 'https://intervals.icu/api/v1';
const REQUEST_TIMEOUT_MS = 15_000;

export class IntervalsError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** From Retry-After on a 429. */
    readonly retryAfterSec?: number
  ) {
    super(message);
  }

  /** The key is wrong or was revoked — the user has to reconnect. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/** The subset of intervals.icu's Activity used here. */
export interface IntervalsActivity {
  id: string;
  start_date?: string;
  start_date_local?: string;
  type?: string;
  name?: string;
  source?: string;
  file_type?: string;
  trainer?: boolean;
  external_id?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  calories?: number;
}

export interface IntervalsAthlete {
  id: string;
  name?: string;
  icu_resting_hr?: number;
  sportSettings?: { types?: string[]; max_hr?: number }[];
}

type FetchLike = typeof fetch;

export function createIntervalsClient(apiKey: string, fetchImpl: FetchLike = fetch) {
  const authorization = `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;

  async function request(path: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImpl(`${BASE_URL}${path}`, {
        headers: { authorization, accept: '*/*' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (error) {
      throw new IntervalsError(
        0,
        error instanceof Error ? error.message : 'intervals.icu is unreachable'
      );
    }
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new IntervalsError(
        response.status,
        `intervals.icu responded ${response.status}`,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
      );
    }
    return response;
  }

  return {
    /** The key's own athlete — also how a key is verified. */
    async getAthlete(): Promise<IntervalsAthlete> {
      return (await request('/athlete/0')).json();
    },

    /** Activities between two local dates (YYYY-MM-DD, inclusive), newest first. */
    async listActivities(oldest: string, newest: string): Promise<IntervalsActivity[]> {
      const query = new URLSearchParams({ oldest, newest });
      const list: unknown = await (await request(`/athlete/0/activities?${query}`)).json();
      return Array.isArray(list)
        ? list
            .filter((a): a is IntervalsActivity => !!a && typeof a === 'object' && 'id' in a)
            .map((a) => ({ ...a, id: String(a.id) }))
        : [];
    },

    /**
     * The activity's original file (FIT for Garmin activities), uncompressed. intervals.icu
     * gzips it; the magic bytes decide, so an uncompressed response works too.
     */
    async downloadFile(id: string, kind: 'file' | 'fit-file' = 'file'): Promise<Uint8Array> {
      const bytes = new Uint8Array(
        await (await request(`/activity/${encodeURIComponent(id)}/${kind}`)).arrayBuffer()
      );
      return bytes[0] === 0x1f && bytes[1] === 0x8b ? new Uint8Array(gunzipSync(bytes)) : bytes;
    },
  };
}

export type IntervalsClient = ReturnType<typeof createIntervalsClient>;
