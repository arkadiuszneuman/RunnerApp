import type { SpeedControllerKind } from '../training/SpeedController';
import type {
  ActivityMetrics,
  ActivitySport,
  BestEfforts,
  HrHistogram,
  SteadyState,
} from '../activities/types';

/**
 * One run as statistics see it: a RunnerApp run, a watch activity, or both merged when they are
 * linked (the same run recorded twice). Built by buildStatsActivities from what the app already
 * holds — run list items and imported activities — so every stat works offline and filters
 * instantly, client-side.
 */
export interface StatsActivity {
  key: string;
  runId?: string;
  activityId?: string;
  /** 'app' = RunnerApp only, 'watch' = watch only, 'both' = linked pair. */
  source: 'app' | 'watch' | 'both';
  sport: ActivitySport;
  name?: string;
  programName?: string;
  controller?: SpeedControllerKind;
  startMs: number;
  /**
   * The start as local wall-clock time, encoded as a UTC timestamp — read it with getUTC*()
   * (day, weekday, hour, ISO week) and calendar maths stays right regardless of where the
   * statistics are viewed.
   */
  localMs: number;
  distanceM: number;
  movingS: number;
  avgHr?: number;
  maxHr?: number;
  elevGainM?: number;
  cadenceSpm?: number;
  calories?: number;
  bestEfforts: BestEfforts;
  hrHist?: HrHistogram;
  steady?: SteadyState;
  /** HR-targeted runs from the app: share of time within the target band. */
  pctInTarget?: number;
}

export interface StatsRunInput {
  id: string;
  startMs: number;
  /** Local-time offset at the start, minutes east of UTC. */
  tzOffsetMin: number;
  programName?: string;
  controller?: SpeedControllerKind;
  metrics: ActivityMetrics;
  pctInTarget?: number;
}

export interface StatsWatchInput {
  id: string;
  startMs: number;
  tzOffsetMin: number;
  sport: ActivitySport;
  name?: string;
  linkedRunId?: string | null;
  metrics: ActivityMetrics;
}

export interface StatsPrefs {
  /**
   * For a linked treadmill run, whose distance counts: the treadmill belt's (default — it
   * measures what was actually run) or the watch's (wrist/footpod estimate).
   */
  linkedDistance: 'belt' | 'watch';
}

export const DEFAULT_STATS_PREFS: StatsPrefs = { linkedDistance: 'belt' };

const histSeconds = (hist?: HrHistogram) => hist?.s.reduce((a, b) => a + b, 0) ?? 0;

/**
 * Belt and watch further apart than this (relative to the watch) means the belt's distance is
 * wrong, not the watch's estimate: older recordings without `aspd` count the commanded speed,
 * which a treadmill that didn't follow it (or one left at max while the runner slowed it by
 * hand) turns into a run twice as long and fast as the real one.
 */
const MAX_BELT_WATCH_DEVIATION = 0.3;

function beltDistancePlausible(belt: StatsActivity, watch: StatsActivity): boolean {
  if (belt.distanceM <= 0) return false;
  if (watch.distanceM <= 0) return true;
  return Math.abs(belt.distanceM - watch.distanceM) / watch.distanceM <= MAX_BELT_WATCH_DEVIATION;
}

function fromRun(run: StatsRunInput): StatsActivity {
  const m = run.metrics;
  return {
    key: `run:${run.id}`,
    runId: run.id,
    source: 'app',
    sport: 'treadmill',
    programName: run.programName,
    controller: run.controller,
    startMs: run.startMs,
    localMs: run.startMs + run.tzOffsetMin * 60_000,
    distanceM: m.distanceM,
    movingS: m.movingS,
    avgHr: m.avgHr,
    maxHr: m.maxHr,
    elevGainM: m.elevGainM,
    bestEfforts: m.bestEfforts,
    hrHist: m.hrHist,
    steady: m.steady,
    pctInTarget: run.pctInTarget,
  };
}

function fromWatch(a: StatsWatchInput): StatsActivity {
  const m = a.metrics;
  return {
    key: `watch:${a.id}`,
    activityId: a.id,
    source: 'watch',
    sport: a.sport,
    name: a.name,
    startMs: a.startMs,
    localMs: a.startMs + a.tzOffsetMin * 60_000,
    distanceM: m.distanceM,
    movingS: m.movingS,
    avgHr: m.avgHr,
    maxHr: m.maxHr,
    elevGainM: m.elevGainM,
    cadenceSpm: m.cadenceSpm,
    calories: m.calories,
    bestEfforts: m.bestEfforts,
    hrHist: m.hrHist,
    steady: m.steady,
  };
}

/**
 * A linked pair as one run: distance per prefs (the watch's when the belt's is implausible), HR
 * from whichever recorded more of it.
 */
function merge(run: StatsRunInput, watch: StatsWatchInput, prefs: StatsPrefs): StatsActivity {
  const app = fromRun(run);
  const w = fromWatch(watch);
  const distanceFrom = prefs.linkedDistance === 'belt' && beltDistancePlausible(app, w) ? app : w;
  const hrFrom = histSeconds(w.hrHist) > histSeconds(app.hrHist) ? w : app;
  return {
    ...app,
    key: `run:${run.id}`,
    activityId: watch.id,
    source: 'both',
    sport: watch.sport,
    name: watch.name,
    // The watch is usually started first and its clock is the reference for "when".
    startMs: w.startMs,
    localMs: w.localMs,
    distanceM: distanceFrom.distanceM,
    movingS: distanceFrom.movingS,
    bestEfforts: distanceFrom.bestEfforts,
    avgHr: hrFrom.avgHr,
    maxHr: hrFrom.maxHr,
    hrHist: hrFrom.hrHist,
    steady: hrFrom === w ? w.steady : app.steady,
    cadenceSpm: w.cadenceSpm,
    calories: w.calories,
    elevGainM: app.elevGainM ?? w.elevGainM,
  };
}

/**
 * Every run once, newest first. Runs without any distance or time (stopped straight away) are
 * left out unless `keepEmpty` — statistics skip them, but the History list still shows them.
 */
export function buildStatsActivities(
  runs: readonly StatsRunInput[],
  watch: readonly StatsWatchInput[],
  prefs: StatsPrefs = DEFAULT_STATS_PREFS,
  { keepEmpty = false }: { keepEmpty?: boolean } = {}
): StatsActivity[] {
  const runsById = new Map(runs.map((r) => [r.id, r]));
  const linkedRunIds = new Set<string>();
  const result: StatsActivity[] = [];
  for (const a of watch) {
    const run = a.linkedRunId ? runsById.get(a.linkedRunId) : undefined;
    if (run) {
      linkedRunIds.add(run.id);
      result.push(merge(run, a, prefs));
    } else {
      result.push(fromWatch(a));
    }
  }
  for (const run of runs) if (!linkedRunIds.has(run.id)) result.push(fromRun(run));
  return result
    .filter((a) => keepEmpty || (a.distanceM > 0 && a.movingS > 0))
    .sort((a, b) => b.startMs - a.startMs);
}
