'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { HrBucket } from '@runner/core';
import { axisTitleColor, chartColors, formatMinutesAsClock } from './chartSetup';

export default function HrBucketsChart({ buckets }: Readonly<{ buckets: HrBucket[] }>) {
  const data: ChartData<'bar'> = {
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
  };

  const options: ChartOptions<'bar'> = {
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
    plugins: {
      legend: { display: false }, // single series — the chart title already names it
      tooltip: {
        callbacks: {
          label: (item) => `Time in zone: ${formatMinutesAsClock(item.parsed.y ?? 0)}`,
        },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
