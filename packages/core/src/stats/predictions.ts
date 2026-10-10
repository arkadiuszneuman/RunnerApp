import { EFFORT_DISTANCES, type EffortKey } from '../activities/types';
import { DAY_MS } from './calendar';
import type { StatsActivity } from './statsActivity';

/**
 * Race-time predictions from training data, by several independent methods (each has blind
 * spots, so the spread between them is shown too):
 *
 * - **VDOT** (Daniels & Gilbert): the best recent effort at 5 km or longer, turned into an
 *   equivalent "VDOT" and back into times at other distances.
 * - **Riegel**: T₂ = T₁·(D₂/D₁)^k from the best recent effort; `k` is fitted to the runner's own
 *   efforts at two or more distances, 1.06 otherwise.
 * - **Heart rate**: an "effective VO2max" from steady running — the oxygen cost of the pace
 *   (Daniels' formula, plus the incline on a treadmill) divided by the share of heart-rate reserve
 *   used (Swain's %HRR ≈ %VO2R). It works without any hard effort, which matters here: most
 *   treadmill runs are heart-rate-controlled and easy, so best efforts alone would underrate fitness.
 * - **Tanda** (marathon only): from weekly volume and average training pace.
 */

export type RaceKey = '5k' | '10k' | 'hm' | 'm';
export const RACE_KEYS: RaceKey[] = ['5k', '10k', 'hm', 'm'];
export type PredictionMethod = 'vdot' | 'riegel' | 'hr' | 'tanda';

/** O₂ cost (ml/kg/min) of running at `v` m/min on the flat (Daniels & Gilbert). */
export function vo2AtSpeed(metresPerMin: number): number {
  return -4.6 + 0.182258 * metresPerMin + 0.000104 * metresPerMin * metresPerMin;
}

/** Share of VO2max sustainable for `minutes` (Daniels & Gilbert). */
export function sustainableFraction(minutes: number): number {
  return (
    0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

/** VDOT of covering `metres` in `seconds`. */
export function vdotOf(metres: number, seconds: number): number {
  const minutes = seconds / 60;
  return vo2AtSpeed(metres / minutes) / sustainableFraction(minutes);
}

/** Race time (seconds) at a VDOT — vdotOf solved for time by bisection (VDOT falls as time grows). */
export function timeForVdot(vdot: number, metres: number): number {
  let lo = (metres / 1000) * 60; // 1:00 /km
  let hi = (metres / 1000) * 20 * 60; // 20:00 /km
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (vdotOf(metres, mid) > vdot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function riegel(
  seconds: number,
  fromMetres: number,
  toMetres: number,
  exponent = 1.06
): number {
  return seconds * (toMetres / fromMetres) ** exponent;
}

/**
 * Tanda (2011): marathon pace (s/km) from mean weekly distance `kmPerWeek` and mean training pace
 * `paceSPerKm`, both over the 8 weeks before the race.
 */
export function tandaMarathonSeconds(kmPerWeek: number, paceSPerKm: number): number {
  return (17.1 + 140 * Math.exp(-0.0053 * kmPerWeek) + 0.55 * paceSPerKm) * 42.195;
}

/** Riegel exponent fitted (log-log least squares) to the best effort per distance. */
export function fitRiegelExponent(
  efforts: readonly { metres: number; seconds: number }[]
): number | undefined {
  if (efforts.length < 2) return undefined;
  const xs = efforts.map((e) => Math.log(e.metres));
  const ys = efforts.map((e) => Math.log(e.seconds));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  if (den === 0) return undefined;
  return Math.min(1.15, Math.max(1.01, num / den));
}

export interface HrAnchors {
  maxHr: number;
  restingHr: number;
}

/** Below this share of heart-rate reserve the HR/VO2 relation is too loose to trust. */
const MIN_HRR = 0.5;
const MAX_HRR = 0.95;
const MIN_STEADY_SECONDS = 10 * 60;

/** Effective VO2max of one run's steady state, or undefined when it can't be estimated. */
export function effectiveVo2max(activity: StatsActivity, hr: HrAnchors): number | undefined {
  const steady = activity.steady;
  if (!steady || steady.seconds < MIN_STEADY_SECONDS || hr.maxHr <= hr.restingHr) return undefined;
  const hrr = (steady.hr - hr.restingHr) / (hr.maxHr - hr.restingHr);
  if (hrr < MIN_HRR || hrr > MAX_HRR) return undefined;
  const v = steady.speedMps * 60;
  // Treadmills need ~1% incline to match the effort of running outdoors (no air resistance).
  const grade = (steady.gradePct ?? 0) / 100 + (activity.sport === 'treadmill' ? 0.01 : 0);
  const vo2 = vo2AtSpeed(v) + 0.9 * v * Math.max(0, grade);
  // Swain: %HRR ≈ %VO2R, with VO2R = VO2max − 3.5 (rest).
  return 3.5 + (vo2 - 3.5) / hrr;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface RacePrediction {
  key: RaceKey;
  /** Median of the methods that produced a value. */
  seconds: number;
  methods: Partial<Record<PredictionMethod, number>>;
}

export interface PredictionBasis {
  /** VDOT of the best recent effort, and which effort it was. */
  effortVdot?: { vdot: number; key: EffortKey; activity: StatsActivity };
  /** Median effective VO2max of recent steady runs. */
  hrVo2max?: number;
  hrRuns: number;
  riegelExponent: number;
  kmPerWeek: number;
}

export interface PredictionOptions {
  nowMs: number;
  hr?: HrAnchors;
  /** Efforts and HR estimates from this many weeks back. */
  windowWeeks?: number;
}

const VDOT_EFFORTS: EffortKey[] = ['5k', '10k', 'hm', 'm'];
const TANDA_WEEKS = 8;

/** Predictions for 5 km, 10 km, half and full marathon from the runs before `nowMs`. */
export function predictRaces(
  all: readonly StatsActivity[],
  { nowMs, hr, windowWeeks = 12 }: PredictionOptions
): { predictions: RacePrediction[]; basis: PredictionBasis } {
  const recent = all.filter(
    (a) => a.startMs <= nowMs && a.startMs > nowMs - windowWeeks * 7 * DAY_MS
  );

  let effortVdot: PredictionBasis['effortVdot'];
  const bestPerDistance = new Map<EffortKey, number>();
  for (const activity of recent) {
    for (const key of VDOT_EFFORTS) {
      const seconds = activity.bestEfforts[key];
      if (seconds === undefined) continue;
      const vdot = vdotOf(EFFORT_DISTANCES[key], seconds);
      if (!effortVdot || vdot > effortVdot.vdot) effortVdot = { vdot, key, activity };
      bestPerDistance.set(key, Math.min(bestPerDistance.get(key) ?? Infinity, seconds));
    }
  }
  const riegelExponent =
    fitRiegelExponent(
      [...bestPerDistance].map(([key, seconds]) => ({ metres: EFFORT_DISTANCES[key], seconds }))
    ) ?? 1.06;

  const hrEstimates = hr
    ? recent
        .map((a) => effectiveVo2max(a, hr))
        .filter((v): v is number => v !== undefined && v > 20 && v < 90)
    : [];
  const hrVo2max = median(hrEstimates);

  const tandaRuns = all.filter(
    (a) => a.startMs <= nowMs && a.startMs > nowMs - TANDA_WEEKS * 7 * DAY_MS
  );
  const tandaKm = tandaRuns.reduce((sum, a) => sum + a.distanceM, 0) / 1000;
  const tandaS = tandaRuns.reduce((sum, a) => sum + a.movingS, 0);
  const kmPerWeek = tandaKm / TANDA_WEEKS;

  const predictions = RACE_KEYS.flatMap((key): RacePrediction[] => {
    const metres = EFFORT_DISTANCES[key];
    const methods: RacePrediction['methods'] = {};
    if (effortVdot) {
      methods.vdot = timeForVdot(effortVdot.vdot, metres);
      const fromSeconds = effortVdot.activity.bestEfforts[effortVdot.key]!;
      methods.riegel = riegel(
        fromSeconds,
        EFFORT_DISTANCES[effortVdot.key],
        metres,
        riegelExponent
      );
    }
    if (hrVo2max !== undefined) methods.hr = timeForVdot(hrVo2max, metres);
    // Tanda's regression was fitted on runners doing roughly 20+ km a week.
    if (key === 'm' && kmPerWeek >= 20 && tandaKm > 0)
      methods.tanda = tandaMarathonSeconds(kmPerWeek, tandaS / tandaKm);
    const values = Object.values(methods);
    const seconds = median(values);
    return seconds === undefined ? [] : [{ key, seconds, methods }];
  });

  return {
    predictions,
    basis: { effortVdot, hrVo2max, hrRuns: hrEstimates.length, riegelExponent, kmPerWeek },
  };
}
