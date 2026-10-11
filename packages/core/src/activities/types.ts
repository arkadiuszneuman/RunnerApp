/**
 * Shapes shared by imported watch activities (Garmin, via a FIT file — see fitActivity.ts) and by
 * RunnerApp's own runs (see runMetrics.ts), so history, linking and statistics can treat both the
 * same way. Everything here is plain JSON: it's stored in jsonb columns and sent over the wire.
 */

export type ActivitySport = 'run' | 'treadmill' | 'trail' | 'track' | 'indoor';

export const ACTIVITY_SPORTS = [
  'run',
  'treadmill',
  'trail',
  'track',
  'indoor',
] as const satisfies readonly ActivitySport[];

/** Standard best-effort distances, in metres. */
export const EFFORT_DISTANCES = {
  '400m': 400,
  '1k': 1000,
  '1mi': 1609.344,
  '5k': 5000,
  '10k': 10000,
  hm: 21097.5,
  m: 42195,
} as const;

export type EffortKey = keyof typeof EFFORT_DISTANCES;

export const EFFORT_KEYS = [
  '400m',
  '1k',
  '1mi',
  '5k',
  '10k',
  'hm',
  'm',
] as const satisfies readonly EffortKey[];

/** Fastest time (seconds) found for each standard distance within one activity. */
export type BestEfforts = Partial<Record<EffortKey, number>>;

/** Seconds spent at each bpm: `s[i]` is the time at `start + i` bpm. */
export interface HrHistogram {
  start: number;
  s: number[];
}

/**
 * Average speed/HR over the steady part of a run (warm-up and the tail cut off) — the input for
 * an HR-based fitness estimate, which works even when a run was never a hard effort.
 */
export interface SteadyState {
  speedMps: number;
  hr: number;
  seconds: number;
  /** Mean treadmill incline in %, when known. */
  gradePct?: number;
}

export interface ActivityMetrics {
  distanceM: number;
  /** Time with the timer running (pauses excluded). */
  movingS: number;
  /** Wall-clock span from start to finish (pauses included). */
  elapsedS: number;
  avgHr?: number;
  maxHr?: number;
  elevGainM?: number;
  /** Steps per minute (both feet). */
  cadenceSpm?: number;
  calories?: number;
  /** Garmin's aerobic Training Effect (0–5), when the file carries it. */
  trainingEffect?: number;
  bestEfforts: BestEfforts;
  hrHist?: HrHistogram;
  /** Seconds taken by each full kilometre, in order. */
  splitsKmS?: number[];
  steady?: SteadyState;
}

/**
 * Downsampled samples, stored column-wise to keep the JSON small. `t` is seconds since the
 * activity start, `d` metres, `spd` m/s, `alt` metres, `cad` steps per minute. Gaps (pauses)
 * are simply missing samples. `lat`/`lng` (degrees) are only there for activities recorded with
 * GPS — they draw the route map, index-aligned with the other streams so it can be coloured by
 * them; no stat uses them, and they never leave the owner's own activity endpoint.
 */
export interface ActivityStreams {
  t: number[];
  d: (number | null)[];
  hr: (number | null)[];
  spd: (number | null)[];
  alt: (number | null)[];
  cad: (number | null)[];
  lat?: (number | null)[];
  lng?: (number | null)[];
}

/** One parsed watch activity, ready to be stored. */
export interface ImportedActivity {
  /** ISO 8601, UTC. */
  startTime: string;
  /** Local-time offset at the start, in minutes (e.g. 120 for CEST). */
  tzOffsetMin?: number;
  sport: ActivitySport;
  name?: string;
  device?: string;
  /** Identity of the recording itself, stable across import paths — see fitActivity.ts. */
  dedupKey: string;
  /** Garmin Connect activity id, when the import path knows it. */
  garminId?: string;
  metrics: ActivityMetrics;
  streams?: ActivityStreams;
}

/**
 * Bump when the way ActivityMetrics are computed changes; stored summaries carry the version they
 * were computed with, so older ones can be recomputed from their streams/telemetry.
 */
export const ACTIVITY_METRICS_VERSION = 1;

/**
 * Bump when ActivityStreams gain data that can only come from the original file (2: GPS route).
 * Stored activities with an older version are re-fetched from intervals.icu, or upgraded when
 * their file is uploaded again.
 */
export const ACTIVITY_STREAMS_VERSION = 2;

/** How an imported activity came to be linked (or not) to a RunnerApp run. */
export type LinkMode = 'auto' | 'manual' | 'none';
