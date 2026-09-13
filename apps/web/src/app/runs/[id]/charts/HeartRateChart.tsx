'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RunSeriesPoint } from '@runner/core';
import { axisTitleColor, chartColors, tooltipTitleAsClock } from './chartSetup';
import { makeStageShadingPlugin, type StageBand } from './stageShadingPlugin';

export default function HeartRateChart({
  series,
  stageBands,
}: Readonly<{ series: RunSeriesPoint[]; stageBands?: StageBand[] }>) {
  // Passing through the null hr/thr values (rather than filtering them out)
  // is deliberate: with spanGaps left at its chart.js default of false, a
  // null point breaks the line — so "no sensor" and "tempo stage" show as an
  // honest gap instead of a straight line drawn across missing data.
  const data: ChartData<'line'> = {
    datasets: [
      {
        label: 'Target range (±5 bpm)',
        data: series.map((p) => ({ x: p.tMin, y: p.thr === null ? null : p.thr + 5 })),
        borderColor: 'transparent',
        pointRadius: 0,
        stepped: 'after',
        fill: '+1',
        backgroundColor: chartColors.targetBand,
        order: 3,
      },
      {
        // Lower edge of the target band — bounds the fill above, not its own legend entry.
        label: 'Target -5 bpm',
        data: series.map((p) => ({ x: p.tMin, y: p.thr === null ? null : p.thr - 5 })),
        borderColor: 'transparent',
        pointRadius: 0,
        stepped: 'after',
        order: 3,
      },
      {
        label: 'Target HR',
        data: series.map((p) => ({ x: p.tMin, y: p.thr })),
        borderColor: chartColors.target,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        stepped: 'after',
        order: 2,
      },
      {
        label: 'Predicted HR',
        data: series.map((p) => ({ x: p.tMin, y: p.phr })),
        borderColor: chartColors.predicted,
        borderWidth: 1,
        pointRadius: 0,
        stepped: 'after',
        hidden: true, // available via the legend, not shown by default — supplementary to actual HR
        order: 1,
      },
      {
        label: 'Heart rate',
        data: series.map((p) => ({ x: p.tMin, y: p.hr })),
        borderColor: chartColors.hr,
        borderWidth: 2,
        pointRadius: 0,
        stepped: 'after',
        order: 0,
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
        title: { display: true, text: 'BPM', color: axisTitleColor },
        ticks: { color: axisTitleColor },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          filter: (item) => item.text !== 'Target -5 bpm', // band's lower edge is chart plumbing, not a series
        },
      },
      tooltip: {
        filter: (item) => item.dataset.label !== 'Target -5 bpm' && item.dataset.label !== 'Target +5 bpm',
        callbacks: { title: tooltipTitleAsClock },
      },
    },
  };

  return (
    <Line
      data={data}
      options={options}
      plugins={stageBands ? [makeStageShadingPlugin(stageBands)] : []}
    />
  );
}
