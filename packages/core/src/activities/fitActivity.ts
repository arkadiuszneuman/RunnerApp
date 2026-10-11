import { bestEfforts, kilometreSplits } from './bestEfforts';
import { histogramMean, hrHistogram, resample, sampleDurations, steadyState } from './samples';
import type { ActivityMetrics, ActivitySport, ActivityStreams, ImportedActivity } from './types';

/**
 * Turns an already-decoded FIT activity into ImportedActivity records. Decoding itself (the
 * binary format) is done by Garmin's `@garmin/fitsdk` in the web app — see
 * apps/web/src/lib/fit/decodeFit.ts — so this module stays dependency-free and works on plain
 * message objects. The `*Like` types below are the subset of the SDK's message shapes used here,
 * as produced by its decoder with default options (types converted to strings, scale/offset
 * applied); date-times may be FIT-epoch seconds or Date objects.
 */

type FitDateTime = number | Date;

export interface FitFileIdLike {
  type?: string | number;
  manufacturer?: string | number;
  product?: number;
  garminProduct?: string | number;
  productName?: string;
  serialNumber?: number;
  timeCreated?: FitDateTime;
}

export interface FitSessionLike {
  timestamp?: FitDateTime;
  startTime?: FitDateTime;
  sport?: string | number;
  subSport?: string | number;
  totalElapsedTime?: number;
  totalTimerTime?: number;
  totalDistance?: number;
  totalCalories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgRunningCadence?: number;
  avgCadence?: number;
  avgFractionalCadence?: number;
  totalAscent?: number;
  totalTrainingEffect?: number;
}

export interface FitRecordLike {
  timestamp?: FitDateTime;
  distance?: number;
  heartRate?: number;
  speed?: number;
  enhancedSpeed?: number;
  altitude?: number;
  enhancedAltitude?: number;
  cadence?: number;
  fractionalCadence?: number;
  /** Semicircles (2^31 per 180°), as the SDK hands them over. */
  positionLat?: number;
  positionLong?: number;
}

export interface FitActivityMesgLike {
  timestamp?: FitDateTime;
  localTimestamp?: FitDateTime;
}

export interface FitMessagesLike {
  fileIdMesgs?: FitFileIdLike[];
  sessionMesgs?: FitSessionLike[];
  recordMesgs?: FitRecordLike[];
  activityMesgs?: FitActivityMesgLike[];
}

export type FitSkipReason = 'not-an-activity' | 'no-session' | 'not-a-run';

export type FitImportResult = { activities: ImportedActivity[]; skipped?: FitSkipReason };

/** Milliseconds between the Unix epoch and the FIT epoch (1989-12-31T00:00:00Z). */
export const FIT_EPOCH_MS = 631065600000;

export function fitTimeToMs(value: FitDateTime | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' && Number.isFinite(value)
    ? value * 1000 + FIT_EPOCH_MS
    : undefined;
}

// FIT profile values, by name (decoder default) and by number (when types aren't converted).
const RUNNING = new Set<string | number>(['running', 1]);
const SUB_SPORTS: Record<string, ActivitySport> = {
  treadmill: 'treadmill',
  1: 'treadmill',
  trail: 'trail',
  3: 'trail',
  track: 'track',
  4: 'track',
  indoorRunning: 'indoor',
  45: 'indoor',
  virtualActivity: 'indoor',
  58: 'indoor',
};

function sportOf(session: FitSessionLike): ActivitySport | undefined {
  if (session.sport === undefined || !RUNNING.has(session.sport)) return undefined;
  return (session.subSport !== undefined && SUB_SPORTS[String(session.subSport)]) || 'run';
}

function deviceName(fileId: FitFileIdLike | undefined): string | undefined {
  if (!fileId) return undefined;
  if (fileId.productName) return fileId.productName;
  if (fileId.manufacturer === 'garmin' && typeof fileId.garminProduct === 'string') {
    return `Garmin ${fileId.garminProduct}`;
  }
  return typeof fileId.manufacturer === 'string' ? fileId.manufacturer : undefined;
}

function tzOffsetMinutes(activity: FitActivityMesgLike | undefined): number | undefined {
  const utc = fitTimeToMs(activity?.timestamp);
  const local = fitTimeToMs(activity?.localTimestamp);
  if (utc === undefined || local === undefined) return undefined;
  const minutes = Math.round((local - utc) / 60000 / 15) * 15;
  return Math.abs(minutes) <= 14 * 60 ? minutes : undefined;
}

const num = (v: number | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

/** Degrees from a FIT semicircle value; null when missing or out of range (no fix yet). */
function degrees(v: number | undefined, limit: number): number | null {
  const n = num(v);
  if (n === null) return null;
  const deg = n * SEMICIRCLE_TO_DEG;
  return Math.abs(deg) <= limit ? deg : null;
}

/** 1 Hz-ish raw streams for one session, `t` relative to `startMs`. */
function rawStreams(records: FitRecordLike[], startMs: number): ActivityStreams {
  const sorted = records
    .map((r) => ({ r, ms: fitTimeToMs(r.timestamp) }))
    .filter((x): x is { r: FitRecordLike; ms: number } => x.ms !== undefined)
    .sort((a, b) => a.ms - b.ms);
  const streams: ActivityStreams = { t: [], d: [], hr: [], spd: [], alt: [], cad: [] };
  // Only an outdoor recording has a route; a treadmill run gets no lat/lng arrays at all.
  const hasPosition = sorted.some(
    ({ r }) => degrees(r.positionLat, 90) !== null && degrees(r.positionLong, 180) !== null
  );
  const lat: (number | null)[] = [];
  const lng: (number | null)[] = [];
  for (const { r, ms } of sorted) {
    streams.t.push((ms - startMs) / 1000);
    streams.d.push(num(r.distance));
    streams.hr.push(num(r.heartRate) !== null && r.heartRate! > 0 ? r.heartRate! : null);
    streams.spd.push(num(r.enhancedSpeed) ?? num(r.speed));
    streams.alt.push(num(r.enhancedAltitude) ?? num(r.altitude));
    // FIT running cadence counts one foot (strides/min); steps/min is double that.
    streams.cad.push(
      num(r.cadence) !== null ? (r.cadence! + (r.fractionalCadence ?? 0)) * 2 : null
    );
    if (hasPosition) {
      const la = degrees(r.positionLat, 90);
      const lo = degrees(r.positionLong, 180);
      lat.push(la !== null && lo !== null ? la : null);
      lng.push(la !== null && lo !== null ? lo : null);
    }
  }
  return hasPosition ? { ...streams, lat, lng } : streams;
}

/**
 * Makes the distance stream usable for best efforts: forward-filled and non-decreasing, integrated
 * from speed when the file has no distance at all, and rescaled to the session total when they
 * disagree — a watch calibrating a treadmill run corrects the session total after the fact, but
 * the per-second records keep the original estimate.
 */
function cleanDistances(streams: ActivityStreams, sessionTotal: number | undefined): void {
  const hasDistance = streams.d.some((v) => v !== null);
  let running = 0;
  for (let i = 0; i < streams.t.length; i++) {
    if (hasDistance) {
      const v = streams.d[i];
      running = v !== null && v > running ? v : running;
    } else if (i > 0) {
      const speed = streams.spd[i - 1];
      const dt = Math.min(Math.max(0, streams.t[i] - streams.t[i - 1]), 10);
      if (speed !== null) running += speed * dt;
    }
    streams.d[i] = running;
  }
  const last = running;
  if (sessionTotal && last > 0) {
    const ratio = sessionTotal / last;
    if (Math.abs(ratio - 1) > 0.005 && ratio > 0.5 && ratio < 2) {
      streams.d = streams.d.map((v) => (v === null ? null : v * ratio));
    }
  }
}

function metricsFor(session: FitSessionLike, streams: ActivityStreams): ActivityMetrics {
  const durations = sampleDurations(streams.t);
  const t: number[] = [];
  const d: number[] = [];
  streams.t.forEach((ti, i) => {
    const di = streams.d[i];
    if (di !== null) {
      t.push(ti);
      d.push(di);
    }
  });
  const hist = hrHistogram(streams.hr, durations);
  const span = streams.t.length > 0 ? streams.t[streams.t.length - 1] - streams.t[0] : 0;
  const hrValues = streams.hr.filter((v): v is number => v !== null);
  const cadence = session.avgRunningCadence ?? session.avgCadence;

  return {
    distanceM: Math.round((session.totalDistance ?? d[d.length - 1] ?? 0) * 10) / 10,
    movingS: Math.round(session.totalTimerTime ?? span),
    elapsedS: Math.round(session.totalElapsedTime ?? span),
    avgHr: session.avgHeartRate ?? roundOrUndefined(histogramMean(hist)),
    maxHr: session.maxHeartRate ?? (hrValues.length > 0 ? Math.max(...hrValues) : undefined),
    elevGainM: session.totalAscent,
    cadenceSpm:
      cadence !== undefined
        ? Math.round((cadence + (session.avgFractionalCadence ?? 0)) * 2)
        : undefined,
    calories: session.totalCalories,
    trainingEffect: session.totalTrainingEffect,
    bestEfforts: bestEfforts(t, d),
    hrHist: hist,
    splitsKmS: kilometreSplits(t, d),
    steady: steadyState(streams.t, streams.spd, streams.hr, durations),
  };
}

function roundOrUndefined(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}

/** Drops undefined fields so the stored JSON stays compact. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * One ImportedActivity per running session in the file (usually exactly one; a multisport file
 * may hold several sessions, of which only the runs are kept).
 *
 * `dedupKey` identifies the recording itself — the watch's serial number plus the file's creation
 * time — so the same activity is recognised whether it arrives through intervals.icu, a single
 * uploaded file, or the full Garmin data export.
 */
export function activityFromFitMessages(messages: FitMessagesLike): FitImportResult {
  const fileId = messages.fileIdMesgs?.[0];
  if (fileId?.type !== undefined && fileId.type !== 'activity' && fileId.type !== 4) {
    return { activities: [], skipped: 'not-an-activity' };
  }
  const sessions = messages.sessionMesgs ?? [];
  if (sessions.length === 0) return { activities: [], skipped: 'no-session' };

  const runs = sessions
    .map((session) => ({ session, sport: sportOf(session) }))
    .filter((x): x is { session: FitSessionLike; sport: ActivitySport } => x.sport !== undefined);
  if (runs.length === 0) return { activities: [], skipped: 'not-a-run' };

  const records = messages.recordMesgs ?? [];
  const tzOffsetMin = tzOffsetMinutes(messages.activityMesgs?.[0]);
  const created = fitTimeToMs(fileId?.timeCreated);

  const activities = runs.flatMap(({ session, sport }, index): ImportedActivity[] => {
    const firstRecordMs = fitTimeToMs(records[0]?.timestamp);
    const startMs = fitTimeToMs(session.startTime) ?? firstRecordMs;
    if (startMs === undefined) return [];
    const endMs = fitTimeToMs(session.timestamp);
    const sessionRecords =
      runs.length === 1 || endMs === undefined
        ? records
        : records.filter((r) => {
            const ms = fitTimeToMs(r.timestamp);
            return ms !== undefined && ms >= startMs && ms <= endMs;
          });

    const streams = rawStreams(sessionRecords, startMs);
    cleanDistances(streams, session.totalDistance);
    const metrics = compact(metricsFor(session, streams));

    const suffix = runs.length > 1 ? `:${index}` : '';
    const dedupKey =
      fileId?.serialNumber !== undefined && created !== undefined
        ? `fit:${fileId.serialNumber}:${Math.round(created / 1000)}${suffix}`
        : `start:${Math.round(startMs / 1000)}${suffix}`;

    return [
      compact({
        startTime: new Date(startMs).toISOString(),
        tzOffsetMin,
        sport,
        device: deviceName(fileId),
        dedupKey,
        metrics,
        streams: streams.t.length > 0 ? resample(streams) : undefined,
      }),
    ];
  });

  return activities.length > 0 ? { activities } : { activities, skipped: 'no-session' };
}
