export * from './types';
export { bestEffort, bestEfforts, kilometreSplits } from './bestEfforts';
export {
  hrHistogram,
  histogramMean,
  MAX_SAMPLE_GAP_S,
  resample,
  sampleDurations,
  steadyState,
} from './samples';
export { metricsFromTelemetry } from './runMetrics';
export { matchRuns, MIN_LINK_OVERLAP, runInterval } from './matching';
export type { Interval, MatchableActivity, MatchableRun, RunTimingLike } from './matching';
// fitActivity.ts is deliberately not re-exported: only the import paths need it, and they import
// it directly (@runner/core/src/activities/fitActivity) so it stays out of every other bundle.
