'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RunSeriesPoint } from '@runner/core';
import { axisTitleColor, chartColors, tooltipTitleAsClock } from './chartSetup';

export default function InclineChart({ series }: Readonly<{ series: RunSeriesPoint[] }>) {
  // See HeartRateChart.tsx for why this (and options below) is memoized.
  const data: ChartData<'line'> = useMemo(
    () => ({
      datasets: [
        {
          label: 'Incline',
          data: series.map((p) => ({ x: p.tMin, y: p.inc })),
          borderColor: chartColors.incline,
          backgroundColor: chartColors.incline + '1a', // ~10% area wash, per the mark spec
          borderWidth: 2,
          pointRadius: 0,
          stepped: 'after',
          fill: 'origin',
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
          title: { display: true, text: '%', color: axisTitleColor },
          ticks: { color: axisTitleColor },
          min: 0,
        },
      },
      plugins: {
        legend: { display: false }, // single series — the chart title already names it
        tooltip: { callbacks: { title: tooltipTitleAsClock } },
      },
    }),
    []
  );

  return <Line data={data} options={options} />;
}
