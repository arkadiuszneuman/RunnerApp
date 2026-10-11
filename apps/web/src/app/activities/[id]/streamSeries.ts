import { MAX_SAMPLE_GAP_S, movingTimes, type ActivityStreams } from '@runner/core';
import { MIN_PACE_SPEED_MPS } from './routeSegments';

export interface StreamPoint {
  /** Moving time, minutes. */
  x: number;
  y: number | null;
}

export interface StreamSeries {
  hr: StreamPoint[] | null;
  /** Seconds per km; walking/standing (below MIN_PACE_SPEED_MPS) is left out. */
  pace: StreamPoint[] | null;
  alt: StreamPoint[] | null;
  cad: StreamPoint[] | null;
}

/**
 * The activity's charts over moving time, like the watch's own: a pause takes no room on the x
 * axis, and a null point marks it, so the chart draws the jump across it as a gap (dashed) rather
 * than as data. Null where a stream has nothing to draw.
 */
export function streamSeries(streams: ActivityStreams): StreamSeries {
  const { t } = streams;
  const minutes = movingTimes(t).map((s) => s / 60);
  const pick = (values: (number | null)[]): StreamPoint[] | null => {
    if (!values.some((v) => v !== null)) return null;
    const points: StreamPoint[] = [];
    values.forEach((y, i) => {
      if (i > 0 && t[i] - t[i - 1] > MAX_SAMPLE_GAP_S) points.push({ x: minutes[i], y: null });
      points.push({ x: minutes[i], y });
    });
    return points;
  };
  return {
    hr: pick(streams.hr),
    pace: pick(streams.spd.map((v) => (v !== null && v >= MIN_PACE_SPEED_MPS ? 1000 / v : null))),
    alt: pick(streams.alt),
    cad: pick(streams.cad),
  };
}
