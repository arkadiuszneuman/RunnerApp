'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, ScriptableLineSegmentContext, TooltipItem } from 'chart.js';
import { Line } from '@/app/charts/PersistentChart';
import { axisTitleColor, timeAxisFit, tooltipTitleAsClock } from '@/app/charts/chartSetup';

const GAP_DASH = [4, 4];

/**
 * One watch-activity stream over moving time (x in minutes, pauses squeezed out). `formatY`
 * renders the hovered value (and the ticks); `reverse` flips the axis — for pace, where lower is
 * faster and belongs on top.
 */
export default function StreamChart({
  points,
  color,
  yTitle,
  formatY,
  reverse,
  fill,
}: Readonly<{
  points: { x: number; y: number | null }[];
  color: string;
  yTitle: string;
  formatY?: (value: number) => string;
  reverse?: boolean;
  fill?: boolean;
}>) {
  // Memoized like HeartRateChart.tsx: the chart redraws whenever these change identity.
  const data: ChartData<'line'> = useMemo(
    () => ({
      datasets: [
        {
          label: yTitle,
          data: points,
          borderColor: color,
          backgroundColor: `${color}26`,
          borderWidth: 2,
          pointRadius: 0,
          fill: fill ? 'start' : false,
          // Gaps (a pause, walking for pace, a sensor dropout) are bridged with a dashed line, so
          // the trace reads as one but the missing stretch stays visible.
          spanGaps: true,
          segment: {
            borderDash: (ctx: ScriptableLineSegmentContext) =>
              ctx.p0.skip || ctx.p1.skip ? GAP_DASH : undefined,
          },
          normalized: true,
        },
      ],
    }),
    [points, color, yTitle, fill]
  );

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear',
          ...timeAxisFit,
          title: { display: true, text: 'Moving time (min)', color: axisTitleColor },
          ticks: { color: axisTitleColor },
        },
        y: {
          reverse,
          title: { display: true, text: yTitle, color: axisTitleColor },
          ticks: {
            color: axisTitleColor,
            ...(formatY && { callback: (value: string | number) => formatY(Number(value)) }),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: tooltipTitleAsClock,
            label: (item: TooltipItem<'line'>) =>
              item.parsed.y === null
                ? ''
                : formatY
                  ? formatY(item.parsed.y)
                  : String(Math.round(item.parsed.y)),
          },
        },
      },
    }),
    [yTitle, formatY, reverse]
  );

  return <Line data={data} options={options} />;
}
