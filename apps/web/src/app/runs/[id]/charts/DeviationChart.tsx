'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RunSeriesPoint } from '@runner/core';
import { axisTitleColor, chartColors, tooltipTitleAsClock } from './chartSetup';
import { makeStageShadingPlugin, type StageBand } from './stageShadingPlugin';

export default function DeviationChart({
  series,
  stageBands,
}: Readonly<{ series: RunSeriesPoint[]; stageBands?: StageBand[] }>) {
  // See HeartRateChart.tsx for why this (and options/plugins below) is memoized.
  const data: ChartData<'line'> = useMemo(
    () => ({
      datasets: [
        {
          label: 'HR − target',
          data: series.map((p) => ({ x: p.tMin, y: p.deviation })),
          borderColor: chartColors.deviation,
          borderWidth: 2,
          pointRadius: 0,
          stepped: 'after',
          normalized: true,
        },
      ],
    }),
    [series]
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
          title: { display: true, text: 'bpm above/below target', color: axisTitleColor },
          ticks: { color: axisTitleColor },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? chartColors.zeroLine : 'rgba(255,255,255,0.12)'),
            lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: tooltipTitleAsClock } },
      },
    }),
    []
  );

  const plugins = useMemo(() => (stageBands ? [makeStageShadingPlugin(stageBands)] : []), [stageBands]);

  return <Line data={data} options={options} plugins={plugins} />;
}
