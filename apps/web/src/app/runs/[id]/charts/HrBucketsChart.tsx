'use client';

import { useMemo } from 'react';
import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { HrBucket } from '@runner/core';
import { axisTitleColor, chartColors } from './chartSetup';

export default function HrBucketsChart({ buckets }: Readonly<{ buckets: HrBucket[] }>) {
  // See HeartRateChart.tsx for why this (and options below) is memoized.
  const data: ChartData<'bar'> = useMemo(
    () => ({
      labels: buckets.map((b) => `${b.bucketStart}-${b.bucketStart + 9}`),
      datasets: [
        {
          label: 'Time in zone',
          data: buckets.map((b) => b.seconds / 60),
          backgroundColor: chartColors.hr,
          borderRadius: 4,
          maxBarThickness: 24,
        },
      ],
    }),
    [buckets]
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'BPM', color: axisTitleColor },
          ticks: { color: axisTitleColor },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: 'Minutes', color: axisTitleColor },
          ticks: { color: axisTitleColor },
          min: 0,
        },
      },
      plugins: { legend: { display: false } }, // single series — the chart title already names it
    }),
    []
  );

  return <Bar data={data} options={options} />;
}
