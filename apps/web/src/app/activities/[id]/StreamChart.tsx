'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { axisTitleColor, tooltipTitleAsClock } from '@/app/charts/chartSetup';

/**
 * One watch-activity stream over time (x in minutes). `formatY` renders the hovered value (and
 * the ticks); `reverse` flips the axis — for pace, where lower is faster and belongs on top.
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
  // Memoized like HeartRateChart.tsx: react-chartjs-2 rebuilds the chart whenever these change identity.
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
          spanGaps: false,
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
          title: { display: true, text: 'Minutes', color: axisTitleColor },
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
