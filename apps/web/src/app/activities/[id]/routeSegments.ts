import type { ActivityStreams } from '@runner/core';
import { zoneColors } from '@/app/charts/chartSetup';
import { formatPace } from '../format';

export type RouteMetric = 'pace' | 'hr' | 'alt' | 'cad';

/** Slower than this is walking/standing — left out of the pace chart and the pace colouring. */
export const MIN_PACE_SPEED_MPS = 1.2;

/** A longer jump between two route samples is a pause or a lost fix — the line breaks there. */
const MAX_JOIN_GAP_S = 30;

/** Colour steps: consecutive segments in the same step are drawn as one polyline. */
export const COLOR_STEPS = 24;

/** Drawn where a sample has no value for the metric (e.g. walking, for pace). */
export const NO_VALUE_COLOR = 'rgba(226, 232, 245, 0.35)';

export type LatLng = [number, number];

export interface RouteRun {
  /** Step 0…COLOR_STEPS-1, or null for no value. */
  step: number | null;
  points: LatLng[];
}

export interface RouteScale {
  /** Values at the dark and the bright end of the ramp (5th and 95th percentile). */
  low: number;
  high: number;
}

/** The value each sample is coloured by — higher always means harder (faster, higher bpm…). */
export function metricValues(streams: ActivityStreams, metric: RouteMetric): (number | null)[] {
  switch (metric) {
    case 'pace':
      return streams.spd.map((v) => (v !== null && v >= MIN_PACE_SPEED_MPS ? v : null));
    case 'hr':
      return streams.hr;
    case 'alt':
      return streams.alt;
    case 'cad':
      return streams.cad.map((v) => (v !== null && v > 0 ? v : null));
  }
}

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * The value range the ramp spans: 5th–95th percentile, so one GPS speed spike or a sensor glitch
 * doesn't squash every other sample into a single colour. Undefined when there's nothing to scale.
 */
export function routeScale(values: readonly (number | null)[]): RouteScale | undefined {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  return { low: percentile(sorted, 0.05), high: percentile(sorted, 0.95) };
}

export function colorStep(value: number | null, scale: RouteScale | undefined): number | null {
  if (value === null || !scale) return null;
  const span = scale.high - scale.low;
  const t = span > 0 ? Math.min(1, Math.max(0, (value - scale.low) / span)) : 0.5;
  return Math.min(COLOR_STEPS - 1, Math.floor(t * COLOR_STEPS));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The sequential ramp for step `step`: the app's cyan heart-rate-zone ramp (darkest = easiest,
 * brightest = hardest on the dark map), interpolated between its five stops.
 */
export function stepColor(step: number | null): string {
  if (step === null) return NO_VALUE_COLOR;
  const t = (step + 0.5) / COLOR_STEPS;
  const pos = t * (zoneColors.length - 1);
  const i = Math.min(zoneColors.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = hexToRgb(zoneColors[i]);
  const b = hexToRgb(zoneColors[i + 1]);
  const mix = a.map((c, k) => Math.round(c + (b[k] - c) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

/** The CSS gradient of the whole ramp, for the legend. */
export const rampGradient = `linear-gradient(90deg, ${zoneColors.join(', ')})`;

/** All route points with a fix, for fitting the map to the route. */
export function routePoints(streams: ActivityStreams): LatLng[] {
  const { lat, lng } = streams;
  if (!lat || !lng) return [];
  const points: LatLng[] = [];
  lat.forEach((la, i) => {
    const lo = lng[i];
    if (la !== null && lo !== null) points.push([la, lo]);
  });
  return points;
}

/**
 * Splits the route into runs of consecutive segments that share a colour step. Each segment takes
 * the step of its end sample; the line breaks across a missing fix or a pause.
 */
export function routeRuns(streams: ActivityStreams, metric: RouteMetric): RouteRun[] {
  const { lat, lng, t } = streams;
  if (!lat || !lng) return [];
  const values = metricValues(streams, metric);
  const scale = routeScale(values);
  const runs: RouteRun[] = [];
  let current: RouteRun | null = null;
  for (let i = 1; i < t.length; i++) {
    const a: LatLng | null =
      lat[i - 1] !== null && lng[i - 1] !== null ? [lat[i - 1]!, lng[i - 1]!] : null;
    const b: LatLng | null = lat[i] !== null && lng[i] !== null ? [lat[i]!, lng[i]!] : null;
    if (!a || !b || t[i] - t[i - 1] > MAX_JOIN_GAP_S) {
      current = null;
      continue;
    }
    const step = colorStep(values[i], scale);
    if (current && current.step === step) {
      current.points.push(b);
    } else {
      current = { step, points: [a, b] };
      runs.push(current);
    }
  }
  return runs;
}

/** How a metric's value reads in the legend. */
export function formatMetric(metric: RouteMetric, value: number): string {
  switch (metric) {
    case 'pace':
      return `${formatPace(1000, value * 1000)}/km`;
    case 'hr':
      return `${Math.round(value)} bpm`;
    case 'alt':
      return `${Math.round(value)} m`;
    case 'cad':
      return `${Math.round(value)} spm`;
  }
}
