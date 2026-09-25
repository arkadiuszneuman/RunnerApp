import type { SpeedControllerKind } from '../training/SpeedController';
import type { TelemetryPoint } from '../types/telemetry';
import type { MultiplyStage, StageResult } from './stagesCalculator';
import { Timespan } from './Timespan';

/** A run's saved program snapshot — see the `programs.data` JSONB shape. */
export interface RunProgramSnapshot {
  stages: MultiplyStage[];
  cooldown: boolean;
}

/** The `run_history.data` JSONB shape (see apps/web/src/lib/db/schema.ts). */
export interface RunRecord {
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  telemetry: TelemetryPoint[];
  programId?: string | null;
  programName?: string;
  program?: RunProgramSnapshot;
  /** Speed controller that drove the run — absent on runs recorded before the toggle existed. */
  controller?: SpeedControllerKind;
}

export interface HrTargetStats {
  /** Time-weighted mean of |hr - thr| in bpm, over hr-targeted (thr > 0) time with a sensor reading. */
  avgDeviationBpm: number;
  /** % of hr-targeted time within ±TARGET_BAND_BPM of the target. */
  pctInTarget: number;
  pctAboveTarget: number;
  pctBelowTarget: number;
}

export interface StageSummary {
  /** 1-based ordinal, matches TelemetryPoint.si and currentStageIndexAtom. */
  stageIndex: number;
  type?: StageResult['type'];
  speedType?: StageResult['speedType'];
  targetBpm?: number;
  targetTempo?: Timespan;
  durationSeconds: number;
  avgHr: number;
  maxHr: number;
  hrTarget?: HrTargetStats;
  avgSpeed: number;
  distanceKm: number;
}

export interface HrBucket {
  /** Inclusive lower bound of a 10bpm bucket, e.g. 140 covers [140, 150). */
  bucketStart: number;
  seconds: number;
}

export interface RunSummary {
  durationSeconds: number;
  distanceKm: number;
  avgSpeed: number;
  maxSpeed: number;
  /** Undefined when distance is ~0 (pace would be infinite/meaningless). */
  avgPace?: Timespan;
  elevationGainM: number;
  /** 0 when no heart rate sensor was connected for the whole run. */
  avgHr: number;
  maxHr: number;
  minHr: number;
  hrTarget?: HrTargetStats;
  hrBuckets: HrBucket[];
  stages: StageSummary[];
}

export interface RunSeriesPoint {
  tMin: number;
  hr: number | null;
  thr: number | null;
  phr: number | null;
  spd: number;
  aspd: number | null;
  inc: number;
  /** hr - thr, only defined on hr-targeted segments with a sensor reading. */
  deviation: number | null;
}

const TARGET_BAND_BPM = 5;
const HR_BUCKET_SIZE = 10;

export interface Segment {
  point: TelemetryPoint;
  durationSeconds: number;
}

/**
 * RunSession only pushes a telemetry point when something changes (see
 * RunSession.runControlLogic), so points are sparse: each one holds until the
 * next point's `t` (or `endT`, the run's actual end). Every stat below must
 * be time-weighted by this held duration rather than averaged point-by-point,
 * or dense stretches would be over-counted relative to sparse ones.
 */
export function toSegments(telemetry: TelemetryPoint[], endT?: number): Segment[] {
  if (telemetry.length === 0) return [];
  const sorted = [...telemetry].sort((a, b) => a.t - b.t);
  return sorted.map((point, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1].t : (endT ?? point.t);
    return { point, durationSeconds: Math.max(0, next - point.t) };
  });
}

function weightedAvg(entries: { value: number; weight: number }[]): number {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) return 0;
  return entries.reduce((sum, e) => sum + e.value * e.weight, 0) / totalWeight;
}

function computeHrTarget(segments: Segment[]): HrTargetStats | undefined {
  const qualifying = segments.filter((s) => s.point.thr > 0 && s.point.hr > 0);
  const totalDuration = qualifying.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (totalDuration <= 0) return undefined;

  let deviationWeighted = 0;
  let inTarget = 0;
  let above = 0;
  let below = 0;
  for (const s of qualifying) {
    const deviation = s.point.hr - s.point.thr;
    deviationWeighted += Math.abs(deviation) * s.durationSeconds;
    if (Math.abs(deviation) <= TARGET_BAND_BPM) inTarget += s.durationSeconds;
    else if (deviation > 0) above += s.durationSeconds;
    else below += s.durationSeconds;
  }

  return {
    avgDeviationBpm: deviationWeighted / totalDuration,
    pctInTarget: (inTarget / totalDuration) * 100,
    pctAboveTarget: (above / totalDuration) * 100,
    pctBelowTarget: (below / totalDuration) * 100,
  };
}

function computeHrBuckets(segments: Segment[]): HrBucket[] {
  const bySeconds = new Map<number, number>();
  for (const s of segments) {
    if (s.point.hr <= 0) continue;
    const bucketStart = Math.floor(s.point.hr / HR_BUCKET_SIZE) * HR_BUCKET_SIZE;
    bySeconds.set(bucketStart, (bySeconds.get(bucketStart) ?? 0) + s.durationSeconds);
  }
  return [...bySeconds.entries()]
    .map(([bucketStart, seconds]) => ({ bucketStart, seconds }))
    .sort((a, b) => a.bucketStart - b.bucketStart);
}

function distanceKmOf(segments: Segment[]): number {
  return segments.reduce((sum, s) => {
    const speed = s.point.aspd ?? s.point.spd;
    return sum + (speed * s.durationSeconds) / 3600;
  }, 0);
}

function computeStages(segments: Segment[], stages?: StageResult[]): StageSummary[] {
  const bySi = new Map<number, Segment[]>();
  for (const s of segments) {
    const si = s.point.si;
    if (!si) continue; // si is 1-based; 0/undefined means "no stage recorded"
    const bucket = bySi.get(si) ?? [];
    bucket.push(s);
    bySi.set(si, bucket);
  }

  return [...bySi.entries()]
    .sort(([a], [b]) => a - b)
    .map(([stageIndex, stageSegments]) => {
      const durationSeconds = stageSegments.reduce((sum, s) => sum + s.durationSeconds, 0);
      const hrSegments = stageSegments.filter((s) => s.point.hr > 0);
      const hrDuration = hrSegments.reduce((sum, s) => sum + s.durationSeconds, 0);
      const avgHr = weightedAvg(hrSegments.map((s) => ({ value: s.point.hr, weight: s.durationSeconds })));
      const maxHr = hrDuration > 0 ? Math.max(...hrSegments.map((s) => s.point.hr)) : 0;
      const avgSpeed = weightedAvg(
        stageSegments.map((s) => ({ value: s.point.aspd ?? s.point.spd, weight: s.durationSeconds }))
      );
      const stageInfo = stages?.[stageIndex - 1];

      return {
        stageIndex,
        type: stageInfo?.type,
        speedType: stageInfo?.speedType,
        targetBpm: stageInfo?.speedType === 'bmp' ? stageInfo.bmp : undefined,
        targetTempo: stageInfo?.speedType === 'tempo' ? stageInfo.tempo : undefined,
        durationSeconds,
        avgHr,
        maxHr,
        hrTarget: computeHrTarget(stageSegments),
        avgSpeed,
        distanceKm: distanceKmOf(stageSegments),
      };
    });
}

/**
 * Computes run-level stats from raw telemetry. `endT` (seconds) should be the
 * run's actual duration (e.g. from `durationMs`/`finishedAt` - `startedAt`) so
 * the last telemetry point's held duration is counted correctly — without it,
 * the last segment is assumed to have zero duration. `stages` (typically
 * `calculateStages(record.program.stages)`) fills in each stage's target
 * bpm/tempo in the per-stage breakdown; omit it to get bare duration/HR/speed
 * numbers grouped by stage index.
 */
export function analyzeRun(
  telemetry: TelemetryPoint[],
  opts: { endT?: number; stages?: StageResult[] } = {}
): RunSummary {
  const segments = toSegments(telemetry, opts.endT);
  const durationSeconds = opts.endT ?? (telemetry.length > 0 ? Math.max(...telemetry.map((p) => p.t)) : 0);

  const distanceKm = distanceKmOf(segments);
  const speeds = telemetry.map((p) => p.aspd ?? p.spd);
  const avgSpeed = durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const avgPace = distanceKm > 0.01 ? Timespan.fromSeconds(durationSeconds / distanceKm) : undefined;

  const elevationGainM = segments.reduce((sum, s) => {
    if (s.point.inc <= 0) return sum;
    const speed = s.point.aspd ?? s.point.spd;
    const segmentDistanceKm = (speed * s.durationSeconds) / 3600;
    return sum + segmentDistanceKm * 1000 * (s.point.inc / 100);
  }, 0);

  const hrSegments = segments.filter((s) => s.point.hr > 0);
  const hrDuration = hrSegments.reduce((sum, s) => sum + s.durationSeconds, 0);
  const avgHr = weightedAvg(hrSegments.map((s) => ({ value: s.point.hr, weight: s.durationSeconds })));
  const maxHr = hrDuration > 0 ? Math.max(...hrSegments.map((s) => s.point.hr)) : 0;
  const minHr = hrDuration > 0 ? Math.min(...hrSegments.map((s) => s.point.hr)) : 0;

  return {
    durationSeconds,
    distanceKm,
    avgSpeed,
    maxSpeed,
    avgPace,
    elevationGainM,
    avgHr,
    maxHr,
    minHr,
    hrTarget: computeHrTarget(segments),
    hrBuckets: computeHrBuckets(segments),
    stages: computeStages(segments, opts.stages),
  };
}

function toSeriesPoint(p: TelemetryPoint): RunSeriesPoint {
  return {
    tMin: p.t / 60,
    hr: p.hr > 0 ? p.hr : null,
    thr: p.thr > 0 ? p.thr : null,
    phr: p.phr > 0 ? p.phr : null,
    spd: p.spd,
    aspd: p.aspd ?? null,
    inc: p.inc,
    deviation: p.thr > 0 && p.hr > 0 ? p.hr - p.thr : null,
  };
}

/**
 * Converts telemetry into a chart-ready series (minutes on the x axis).
 * Appends a final point at `endT` repeating the last value, so a stepped
 * chart draws the last held segment instead of stopping short at the last
 * recorded point.
 */
export function toSeries(telemetry: TelemetryPoint[], endT?: number): RunSeriesPoint[] {
  if (telemetry.length === 0) return [];
  const sorted = [...telemetry].sort((a, b) => a.t - b.t);
  const series = sorted.map(toSeriesPoint);
  const lastT = sorted[sorted.length - 1].t;
  if (endT !== undefined && endT > lastT) {
    series.push({ ...series[series.length - 1], tMin: endT / 60 });
  }
  return series;
}
