'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RunSeriesPoint } from '@runner/core';
import { axisTitleColor, chartColors } from './chartSetup';

export default function InclineChart({ series }: Readonly<{ series: RunSeriesPoint[] }>) {
  const data: ChartData<'line'> = {
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
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
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
    plugins: { legend: { display: false } }, // single series — the chart title already names it
  };

  return <Line data={data} options={options} />;
}
