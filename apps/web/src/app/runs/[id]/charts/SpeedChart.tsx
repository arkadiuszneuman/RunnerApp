'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RunSeriesPoint } from '@runner/core';
import { axisTitleColor, chartColors } from './chartSetup';
import { makeStageShadingPlugin, type StageBand } from './stageShadingPlugin';

export default function SpeedChart({
  series,
  stageBands,
}: Readonly<{ series: RunSeriesPoint[]; stageBands?: StageBand[] }>) {
  const hasActual = series.some((p) => p.aspd !== null);

  const data: ChartData<'line'> = {
    datasets: [
      {
        label: 'Commanded speed',
        data: series.map((p) => ({ x: p.tMin, y: p.spd })),
        borderColor: chartColors.commandedSpeed,
        borderWidth: 2,
        pointRadius: 0,
        stepped: 'after',
      },
      ...(hasActual
        ? [
            {
              label: 'Actual speed',
              data: series.map((p) => ({ x: p.tMin, y: p.aspd })),
              borderColor: chartColors.actualSpeed,
              borderWidth: 2,
              pointRadius: 0,
              stepped: 'after' as const,
            },
          ]
        : []),
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
        title: { display: true, text: 'km/h', color: axisTitleColor },
        ticks: { color: axisTitleColor },
        min: 0,
      },
    },
    plugins: {
      legend: hasActual ? { position: 'top', labels: { boxWidth: 12 } } : { display: false },
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
