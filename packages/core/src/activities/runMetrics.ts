import { analyzeRun, toSegments, type RunSummary } from '../services/runAnalysis';
import type { TelemetryPoint } from '../types/telemetry';
import { bestEfforts, kilometreSplits } from './bestEfforts';
import { hrHistogram, steadyState } from './samples';
import type { ActivityMetrics } from './types';

/**
 * ActivityMetrics for one of RunnerApp's own treadmill runs, from its telemetry — the same shape
 * as an imported watch activity's, so best efforts, HR histograms and the steady-state estimate
 * are comparable across both. Belt speed is the source of distance (actual speed when the
 * treadmill reported it, the commanded speed otherwise), exactly like analyzeRun.
 *
 * Telemetry is sparse (a point only when something changed) and each point holds until the next,
 * so distance is piecewise linear between points and every per-point value is weighted by how
 * long it held — see toSegments. `summary` can be passed in when the caller already has it.
 */
export function metricsFromTelemetry(
  telemetry: TelemetryPoint[],
  endT?: number,
  summary: RunSummary = analyzeRun(telemetry, { endT })
): ActivityMetrics {
  const segments = toSegments(telemetry, endT);

  const t: number[] = [];
  const d: number[] = [];
  let distance = 0;
  for (const s of segments) {
    t.push(s.point.t);
    d.push(distance);
    distance += ((s.point.aspd ?? s.point.spd) * s.durationSeconds) / 3.6;
  }
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    t.push(last.point.t + last.durationSeconds);
    d.push(distance);
  }

  const durations = segments.map((s) => s.durationSeconds);
  const hr = segments.map((s) => (s.point.hr > 0 ? s.point.hr : null));
  const speedMps = segments.map((s) => (s.point.aspd ?? s.point.spd) / 3.6);
  const grade = segments.map((s) => s.point.inc);
  const segmentStarts = segments.map((s) => s.point.t);
  const duration = Math.round(summary.durationSeconds);

  const metrics: ActivityMetrics = {
    distanceM: Math.round(summary.distanceKm * 10000) / 10,
    movingS: duration,
    elapsedS: duration,
    bestEfforts: bestEfforts(t, d),
  };
  if (summary.avgHr > 0) {
    metrics.avgHr = Math.round(summary.avgHr);
    metrics.maxHr = summary.maxHr;
  }
  if (summary.elevationGainM > 0) metrics.elevGainM = Math.round(summary.elevationGainM);
  const hist = hrHistogram(hr, durations);
  if (hist) metrics.hrHist = hist;
  const splits = kilometreSplits(t, d);
  if (splits.length > 0) metrics.splitsKmS = splits;
  const steady = steadyState(segmentStarts, speedMps, hr, durations, grade);
  if (steady) metrics.steady = steady;
  return metrics;
}
