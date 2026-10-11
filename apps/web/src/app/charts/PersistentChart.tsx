'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  type ChartType,
  type Plugin,
} from 'chart.js';

type ChartProps<T extends ChartType> = Readonly<{
  data: ChartData<T>;
  options?: ChartOptions<T>;
  /** Read once, when the chart is created. */
  plugins?: Plugin<T>[];
}>;

/** How often a hidden chart checks whether its page has gone for good. */
const ORPHAN_CHECK_MS = 10_000;

/**
 * A chart.js chart — react-chartjs-2's `<Chart>`, but one that survives its page being hidden.
 * With cacheComponents, Next.js keeps recently visited routes in React's `<Activity>` and hides
 * them instead of unmounting; hiding runs effect cleanups just as unmounting does, and destroying
 * the chart there would mean rebuilding every chart on a page (Stats has fifteen) each time it's
 * shown again. So the chart is only destroyed once its canvas has really left the document —
 * checked right away (an unmount), and then now and again while hidden (an evicted route).
 */
export function Chart<T extends ChartType>({
  type,
  data,
  options,
  plugins,
}: ChartProps<T> & Readonly<{ type: T }>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<T> | null>(null);
  const shownRef = useRef<{ type: T; data: ChartData<T>; options?: ChartOptions<T> } | null>(null);
  const orphanCheckRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Shown again (or re-rendered): the chart is still wanted.
    clearInterval(orphanCheckRef.current);
    let chart = chartRef.current;
    if (!chart || shownRef.current?.type !== type) {
      chart?.destroy();
      chart = new ChartJS(canvas, { type, data, options, plugins });
      chartRef.current = chart;
    } else if (shownRef.current?.data !== data || shownRef.current?.options !== options) {
      chart.data = data;
      if (options) chart.options = options;
      chart.update();
    }
    shownRef.current = { type, data, options };

    return () => {
      const destroy = () => {
        chartRef.current?.destroy();
        chartRef.current = null;
        shownRef.current = null;
      };
      if (!canvas.isConnected) return destroy();
      orphanCheckRef.current = setInterval(() => {
        if (!canvas.isConnected) {
          clearInterval(orphanCheckRef.current);
          destroy();
        }
      }, ORPHAN_CHECK_MS);
    };
  }, [type, data, options, plugins]);

  return <canvas ref={canvasRef} role="img" />;
}

export function Bar(props: ChartProps<'bar'>) {
  return <Chart type="bar" {...props} />;
}

export function Line(props: ChartProps<'line'>) {
  return <Chart type="line" {...props} />;
}
