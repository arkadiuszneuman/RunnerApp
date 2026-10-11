import type { ActivityStreams, HrHistogram, SteadyState } from './types';

/**
 * A sample stands for the time until the next one, but never longer than this: a longer gap
 * means the timer was paused (or the recording dropped out), and that time shouldn't count.
 * Garmin's "smart recording" legitimately spaces samples a few seconds apart.
 */
export const MAX_SAMPLE_GAP_S = 10;

/** How long each sample at `t[i]` holds, capped at `maxGap`; the last one gets 1 s. */
export function sampleDurations(t: readonly number[], maxGap = MAX_SAMPLE_GAP_S): number[] {
  return t.map((ti, i) => (i + 1 < t.length ? Math.min(Math.max(0, t[i + 1] - ti), maxGap) : 1));
}

/**
 * Moving time (seconds) at each sample: `t` with every pause squeezed out, the way the watch's own
 * charts run on timer time. A gap counts as `sampleDurations` counts it — up to `maxGap`.
 */
export function movingTimes(t: readonly number[], maxGap = MAX_SAMPLE_GAP_S): number[] {
  const out: number[] = [];
  t.forEach((ti, i) =>
    out.push(i === 0 ? 0 : out[i - 1] + Math.min(Math.max(0, ti - t[i - 1]), maxGap))
  );
  return out;
}

/** Time-weighted per-bpm histogram of the heart-rate samples that have a reading. */
export function hrHistogram(
  hr: readonly (number | null)[],
  durations: readonly number[]
): HrHistogram | undefined {
  const seconds = new Map<number, number>();
  for (let i = 0; i < hr.length; i++) {
    const bpm = hr[i];
    if (bpm === null || !(bpm > 0) || !(durations[i] > 0)) continue;
    const key = Math.round(bpm);
    seconds.set(key, (seconds.get(key) ?? 0) + durations[i]);
  }
  if (seconds.size === 0) return undefined;
  const start = Math.min(...seconds.keys());
  const end = Math.max(...seconds.keys());
  const s = Array.from(
    { length: end - start + 1 },
    (_, i) => Math.round((seconds.get(start + i) ?? 0) * 10) / 10
  );
  return { start, s };
}

export function histogramMean(hist: HrHistogram | undefined): number | undefined {
  if (!hist) return undefined;
  let total = 0;
  let weighted = 0;
  hist.s.forEach((sec, i) => {
    total += sec;
    weighted += sec * (hist.start + i);
  });
  return total > 0 ? weighted / total : undefined;
}

/** Below this a sample is walking/standing, not running — excluded from the steady state. */
const MIN_RUNNING_SPEED_MPS = 1.5;
const STEADY_SKIP_START_S = 10 * 60;
const MIN_STEADY_SECONDS = 5 * 60;

/**
 * Mean speed and HR over the steady middle of a run: the first 10 minutes (or first fifth of a
 * shorter run) are skipped because heart rate lags behind pace while warming up, the last 5% is
 * dropped (cool-down/stop), and so are samples without HR or below running speed. Undefined when
 * fewer than 5 minutes qualify.
 */
export function steadyState(
  t: readonly number[],
  spd: readonly (number | null)[],
  hr: readonly (number | null)[],
  durations: readonly number[],
  grade?: readonly (number | null)[]
): SteadyState | undefined {
  if (t.length === 0) return undefined;
  const last = t.length - 1;
  const span = t[last] + (durations[last] ?? 0) - t[0];
  const from = t[0] + Math.min(STEADY_SKIP_START_S, span / 5);
  const to = t[0] + span * 0.95;
  let seconds = 0;
  let speedSum = 0;
  let hrSum = 0;
  let gradeSum = 0;
  let gradeSeconds = 0;
  for (let i = 0; i < t.length; i++) {
    const speed = spd[i];
    const bpm = hr[i];
    // Only the part of a sample's hold that falls inside the window counts — a sparse
    // treadmill telemetry point can hold for many minutes across either boundary.
    const dt = Math.min(t[i] + durations[i], to) - Math.max(t[i], from);
    if (!(dt > 0)) continue;
    if (speed === null || bpm === null || speed < MIN_RUNNING_SPEED_MPS || !(bpm > 0)) continue;
    seconds += dt;
    speedSum += speed * dt;
    hrSum += bpm * dt;
    const g = grade?.[i];
    if (g !== undefined && g !== null) {
      gradeSum += g * dt;
      gradeSeconds += dt;
    }
  }
  if (seconds < MIN_STEADY_SECONDS) return undefined;
  return {
    speedMps: round(speedSum / seconds, 3),
    hr: round(hrSum / seconds, 1),
    seconds: Math.round(seconds),
    ...(gradeSeconds > 0 && { gradePct: round(gradeSum / gradeSeconds, 2) }),
  };
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function meanOf(values: (number | null)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue;
    sum += v;
    count++;
  }
  return count > 0 ? sum / count : null;
}

/**
 * Downsamples to one sample per `stepS`-second bin (for storage and charts): distance and the GPS
 * position take the bin's last reading, everything else the bin's mean. Bins without samples —
 * a paused timer — are left out rather than filled in.
 */
export function resample(streams: ActivityStreams, stepS = 5): ActivityStreams {
  const out: ActivityStreams = { t: [], d: [], hr: [], spd: [], alt: [], cad: [] };
  const route = streams.lat && streams.lng ? { lat: streams.lat, lng: streams.lng } : undefined;
  const lat: (number | null)[] = [];
  const lng: (number | null)[] = [];
  const n = streams.t.length;
  let i = 0;
  while (i < n) {
    const bin = Math.floor(streams.t[i] / stepS);
    let j = i;
    while (j < n && Math.floor(streams.t[j] / stepS) === bin) j++;
    const slice = <K extends 'd' | 'hr' | 'spd' | 'alt' | 'cad'>(key: K) =>
      streams[key].slice(i, j);
    const distances = slice('d').filter((v): v is number => v !== null);
    out.t.push(bin * stepS);
    out.d.push(distances.length > 0 ? round(distances[distances.length - 1], 1) : null);
    out.hr.push(roundOrNull(meanOf(slice('hr')), 0));
    out.spd.push(roundOrNull(meanOf(slice('spd')), 2));
    out.alt.push(roundOrNull(meanOf(slice('alt')), 1));
    out.cad.push(roundOrNull(meanOf(slice('cad')), 0));
    if (route) {
      // The last sample with both coordinates, so lat and lng always belong to the same fix.
      let k = j - 1;
      while (k >= i && (route.lat[k] === null || route.lng[k] === null)) k--;
      lat.push(k >= i ? roundOrNull(route.lat[k], 5) : null);
      lng.push(k >= i ? roundOrNull(route.lng[k], 5) : null);
    }
    i = j;
  }
  return route ? { ...out, lat, lng } : out;
}

function roundOrNull(value: number | null, digits: number): number | null {
  return value === null ? null : round(value, digits);
}
