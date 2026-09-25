import { Segment, toSegments } from '../services/runAnalysis';
import type { TelemetryPoint } from '../types/telemetry';

/** One learned "this belt speed holds this heart rate, for this runner" data point. */
export interface SpeedCalibrationPoint {
  bpm: number;
  /** km/h */
  speed: number;
  /** ISO timestamp the point was learned, so newer runs can supersede older ones for the same bpm. */
  at: string;
}

export interface SpeedCalibration {
  /** Most recent last; capped at MAX_POINTS. */
  points: SpeedCalibrationPoint[];
}

export const EMPTY_SPEED_CALIBRATION: SpeedCalibration = { points: [] };

/** How close a target must have gotten to count as "reached" before averaging its settled speed. */
const REACH_BAND_BPM = 3;
/** Band used while averaging — a bit wider than REACH_BAND_BPM so brief noise doesn't drop samples. */
const SETTLE_BAND_BPM = 5;
/** How long after reaching the target to average over. */
const WINDOW_S = 120;
/** Minimum in-band time within the window for a target to be considered calibrated at all. */
const MIN_SAMPLE_S = 60;
/** Two learned points within this many bpm of each other are treated as "the same" target. */
const MERGE_BPM = 2;
const MAX_POINTS = 12;
/** Plausibility bounds for a stored point — also enforced by the /api/user-settings schema. */
export const MIN_BPM = 30;
export const MAX_BPM = 250;
export const MIN_SPEED_KMH = 1;
export const MAX_SPEED_KMH = 25;
export const MAX_CALIBRATION_POINTS = MAX_POINTS;

/**
 * Learns "at this heart rate, this runner's belt speed settles here" from a finished run's
 * telemetry, and folds it into `previous`. Used to seed AdaptiveTraining's `speedHint` so the
 * next run at (roughly) the same bpm can jump straight toward the right speed instead of PID-
 * feeling its way up from the start speed — see AdaptiveTraining.ts and the plan this shipped
 * with for the run-telemetry analysis behind the approach.
 *
 * For each contiguous run of segments targeting the same bpm (`thr`), finds the first moment
 * heart rate got within REACH_BAND_BPM of it, then time-weight-averages the belt's actual speed
 * (falling back to commanded speed on older recordings without `aspd`) over the next WINDOW_S
 * seconds while heart rate stays within SETTLE_BAND_BPM — deliberately an early window, before
 * cardiac drift would pull the settled speed down over a long stage. Targets never reached, or
 * reached too briefly (<MIN_SAMPLE_S of in-band time), are skipped rather than guessed at.
 */
export function learnSpeedCalibration(
  telemetry: TelemetryPoint[],
  previous: SpeedCalibration,
  now: () => string = () => new Date().toISOString()
): SpeedCalibration {
  const segments = toSegments(telemetry);
  let points = [...previous.points];

  for (const episode of groupByTarget(segments)) {
    const learned = learnFromEpisode(episode);
    if (learned === undefined) continue;
    points = upsertPoint(points, { bpm: episode[0].point.thr, speed: learned, at: now() });
  }

  return { points: points.slice(-MAX_POINTS) };
}

/** Splits into contiguous runs of segments sharing the same positive `thr` (tempo/cooldown segments, thr === 0, are dropped). */
function groupByTarget(segments: Segment[]): Segment[][] {
  const episodes: Segment[][] = [];
  for (const segment of segments) {
    if (segment.point.thr <= 0) continue;
    const current = episodes[episodes.length - 1];
    if (current && current[0].point.thr === segment.point.thr) {
      current.push(segment);
    } else {
      episodes.push([segment]);
    }
  }
  return episodes;
}

function learnFromEpisode(episode: Segment[]): number | undefined {
  const thr = episode[0].point.thr;
  const reachIndex = episode.findIndex((s) => Math.abs(s.point.hr - thr) <= REACH_BAND_BPM);
  if (reachIndex === -1) return undefined;

  const windowStart = episode[reachIndex].point.t;
  const windowEnd = windowStart + WINDOW_S;

  let weightedSpeed = 0;
  let totalDuration = 0;
  for (const segment of episode.slice(reachIndex)) {
    if (segment.point.t >= windowEnd) break;
    if (Math.abs(segment.point.hr - thr) > SETTLE_BAND_BPM) continue;
    const duration = Math.min(segment.durationSeconds, windowEnd - segment.point.t);
    if (duration <= 0) continue;
    weightedSpeed += (segment.point.aspd ?? segment.point.spd) * duration;
    totalDuration += duration;
  }

  if (totalDuration < MIN_SAMPLE_S) return undefined;
  return weightedSpeed / totalDuration;
}

function upsertPoint(
  points: SpeedCalibrationPoint[],
  next: SpeedCalibrationPoint
): SpeedCalibrationPoint[] {
  const withoutMatch = points.filter((p) => Math.abs(p.bpm - next.bpm) > MERGE_BPM);
  return [...withoutMatch, next];
}

/**
 * Merges two calibrations (e.g. the one saved on the server and the one cached on this device,
 * each possibly learned from runs the other never saw). Points are replayed oldest-first, so for
 * any bpm the newest point wins — the same "a newer run supersedes an older one" rule
 * learnSpeedCalibration applies within a single device.
 */
export function mergeSpeedCalibrations(a: SpeedCalibration, b: SpeedCalibration): SpeedCalibration {
  const ordered = [...a.points, ...b.points].sort((x, y) =>
    x.at < y.at ? -1 : x.at > y.at ? 1 : 0
  );
  return { points: ordered.reduce(upsertPoint, [] as SpeedCalibrationPoint[]).slice(-MAX_POINTS) };
}

export function speedCalibrationsEqual(a: SpeedCalibration, b: SpeedCalibration): boolean {
  return (
    JSON.stringify(mergeSpeedCalibrations(a, EMPTY_SPEED_CALIBRATION)) ===
    JSON.stringify(mergeSpeedCalibrations(b, EMPTY_SPEED_CALIBRATION))
  );
}

/**
 * Defensive parse of a calibration read from storage or the network: drops anything malformed or
 * implausible instead of trusting it, since a bad value here would steer the belt speed.
 */
export function parseSpeedCalibration(value: unknown): SpeedCalibration {
  const raw = (value as { points?: unknown } | null | undefined)?.points;
  if (!Array.isArray(raw)) return EMPTY_SPEED_CALIBRATION;
  const points = raw.filter(
    (p): p is SpeedCalibrationPoint =>
      typeof p === 'object' &&
      p !== null &&
      Number.isFinite(p.bpm) &&
      p.bpm >= MIN_BPM &&
      p.bpm <= MAX_BPM &&
      Number.isFinite(p.speed) &&
      p.speed >= MIN_SPEED_KMH &&
      p.speed <= MAX_SPEED_KMH &&
      typeof p.at === 'string' &&
      p.at.length > 0 &&
      p.at.length <= 40
  );
  return mergeSpeedCalibrations({ points }, EMPTY_SPEED_CALIBRATION);
}

/**
 * The learned speed for `bpm`, linearly nudged toward it from the nearest calibrated point —
 * `undefined` when nothing calibrated is close enough to trust (more than 15 bpm away, or no
 * calibration at all). The 0.2 km/h-per-bpm slope is deliberately conservative — under most
 * runners' real heart-rate-per-speed sensitivity (see the plan) — since this only has to get the
 * ramp target roughly right; AdaptiveTraining's own PI loop does the fine correction from there.
 */
export function speedHintFor(calibration: SpeedCalibration, bpm: number): number | undefined {
  if (calibration.points.length === 0) return undefined;
  const nearest = calibration.points.reduce((best, p) =>
    Math.abs(p.bpm - bpm) < Math.abs(best.bpm - bpm) ? p : best
  );
  const distance = bpm - nearest.bpm;
  if (Math.abs(distance) > 15) return undefined;
  return nearest.speed + distance / 5;
}
