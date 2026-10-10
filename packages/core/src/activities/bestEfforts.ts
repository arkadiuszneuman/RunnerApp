import { EFFORT_DISTANCES, EFFORT_KEYS, type BestEfforts, type EffortKey } from './types';

/**
 * Faster than this over a best-effort window means bad distance data (a GPS spike, a footpod
 * glitch), not a performance — such windows are ignored. 400 m gets more headroom than the rest.
 */
const MAX_PLAUSIBLE_SPEED_MPS: Record<EffortKey, number> = {
  '400m': 10,
  '1k': 8,
  '1mi': 8,
  '5k': 7,
  '10k': 7,
  hm: 7,
  m: 7,
};

/**
 * Fastest time (seconds) to cover `target` metres anywhere within a recording, or undefined if
 * it's shorter than that. `t` (seconds) and `d` (cumulative metres) are parallel, both
 * non-decreasing. Distance is taken as linear between samples, so the window's start is
 * interpolated to the exact metre rather than snapping to a sample — O(n) two-pointer sweep.
 */
export function bestEffort(
  t: readonly number[],
  d: readonly number[],
  target: number
): number | undefined {
  const n = Math.min(t.length, d.length);
  if (n < 2 || d[n - 1] - d[0] < target) return undefined;

  let best = Infinity;
  let i = 0;
  for (let j = 1; j < n; j++) {
    const startDist = d[j] - target;
    if (startDist < d[0]) continue;
    // Invariant after this loop: d[i] <= startDist < d[i + 1] (startDist < d[j] always).
    while (i + 1 < j && d[i + 1] <= startDist) i++;
    const span = d[i + 1] - d[i];
    const startT = span > 0 ? t[i] + ((t[i + 1] - t[i]) * (startDist - d[i])) / span : t[i];
    const duration = t[j] - startT;
    if (duration > 0 && duration < best) best = duration;
  }
  return Number.isFinite(best) ? best : undefined;
}

/** bestEffort for every standard distance, dropping implausibly fast results. */
export function bestEfforts(t: readonly number[], d: readonly number[]): BestEfforts {
  const result: BestEfforts = {};
  for (const key of EFFORT_KEYS) {
    const distance = EFFORT_DISTANCES[key];
    const seconds = bestEffort(t, d, distance);
    if (seconds !== undefined && distance / seconds <= MAX_PLAUSIBLE_SPEED_MPS[key]) {
      result[key] = Math.round(seconds * 10) / 10;
    }
  }
  return result;
}

/** Seconds taken by each full kilometre (interpolated crossings), in order. */
export function kilometreSplits(t: readonly number[], d: readonly number[]): number[] {
  const n = Math.min(t.length, d.length);
  if (n < 2) return [];
  const splits: number[] = [];
  let prevCrossT = t[0];
  let nextMark = d[0] + 1000;
  for (let j = 1; j < n; j++) {
    while (d[j] >= nextMark) {
      const span = d[j] - d[j - 1];
      const crossT =
        span > 0 ? t[j - 1] + ((t[j] - t[j - 1]) * (nextMark - d[j - 1])) / span : t[j];
      splits.push(Math.round((crossT - prevCrossT) * 10) / 10);
      prevCrossT = crossT;
      nextMark += 1000;
    }
  }
  return splits;
}
