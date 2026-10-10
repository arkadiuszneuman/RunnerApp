'use client';

import { useMemo } from 'react';
import type { ChartData, ChartDataset, ChartOptions, TooltipItem } from 'chart.js';
import { Bar, Chart } from 'react-chartjs-2';
import {
  axisTitleColor,
  formatLocalDate,
  verticalGradient,
  withAlpha,
} from '@/app/charts/chartSetup';

/**
 * Generic chart.js wrappers for the statistics page. Two shapes cover every panel: a bar chart
 * over categories (periods, weekdays, bands — optionally stacked), and points/lines over time
 * (x = local ms, see StatsActivity.localMs). Data and options are memoized because
 * react-chartjs-2 rebuilds the chart whenever they change identity.
 */

const defaultFormat = (v: number) => String(Math.round(v * 10) / 10);
const defaultXFormat: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' };
const defaultTooltipTitle = (x: number) => formatLocalDate(x, { dateStyle: 'medium' });

export type BarSeries = { label: string; color: string; values: number[] };

export function BarChart({
  labels,
  series,
  yTitle,
  stacked,
  formatValue = defaultFormat,
  tooltipFooter,
}: Readonly<{
  labels: string[];
  series: BarSeries[];
  yTitle: string;
  stacked?: boolean;
  formatValue?: (value: number) => string;
  /** Extra tooltip lines for a hovered category index. */
  tooltipFooter?: (index: number) => string | string[];
}>) {
  const data: ChartData<'bar'> = useMemo(
    () => ({
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.values,
        // Stacked segments keep one solid colour each (zones must stay distinguishable); a lone
        // series fades towards the baseline, like the app's glowing cards.
        backgroundColor: stacked ? s.color : verticalGradient<'bar'>(s.color),
        hoverBackgroundColor: s.color,
        borderRadius: stacked ? 3 : 6,
        borderSkipped: stacked ? false : 'start',
        // A 2px surface gap between stacked segments.
        borderWidth: stacked ? { top: 2 } : 0,
        borderColor: '#0e131d',
        maxBarThickness: 26,
      })),
    }),
    [labels, series, stacked]
  );
  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          stacked,
          grid: { display: false },
          ticks: { color: axisTitleColor, maxRotation: 0, autoSkip: true },
        },
        y: {
          stacked,
          beginAtZero: true,
          title: { display: true, text: yTitle, color: axisTitleColor },
          ticks: { color: axisTitleColor },
        },
      },
      plugins: {
        legend:
          series.length > 1 ? { position: 'top', labels: { boxWidth: 12 } } : { display: false },
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'bar'>) =>
              `${series.length > 1 ? `${item.dataset.label}: ` : ''}${formatValue(Number(item.raw))}`,
            ...(tooltipFooter && {
              footer: (items: TooltipItem<'bar'>[]) => tooltipFooter(items[0].dataIndex),
            }),
          },
        },
      },
    }),
    [series.length, stacked, yTitle, formatValue, tooltipFooter]
  );
  return <Bar data={data} options={options} />;
}

export type TimeSeries = {
  label: string;
  color: string;
  points: { x: number; y: number }[];
  /** Points (scatter) or a line. */
  kind: 'points' | 'line';
  dashed?: boolean;
  /** Shade the area under a line. */
  area?: boolean;
};

export function TimeChart({
  series,
  yTitle,
  formatY = defaultFormat,
  reverse,
  xFormat = defaultXFormat,
  tooltipTitle = defaultTooltipTitle,
  beginAtZero,
  yStep,
}: Readonly<{
  series: TimeSeries[];
  yTitle: string;
  formatY?: (value: number) => string;
  reverse?: boolean;
  xFormat?: Intl.DateTimeFormatOptions;
  tooltipTitle?: (x: number) => string;
  beginAtZero?: boolean;
  /** Tick spacing on the y axis, e.g. 60 for whole minutes of pace. */
  yStep?: number;
}>) {
  const data = useMemo(
    () => ({
      datasets: series.map((s): ChartDataset<'line' | 'scatter', { x: number; y: number }[]> =>
        s.kind === 'points'
          ? {
              type: 'scatter',
              label: s.label,
              data: s.points,
              backgroundColor: withAlpha(s.color, 0.8),
              borderColor: '#0e131d',
              borderWidth: 1,
              pointRadius: 3.5,
              pointHoverRadius: 6,
              pointHoverBackgroundColor: s.color,
            }
          : {
              type: 'line',
              label: s.label,
              data: s.points,
              borderColor: s.color,
              borderWidth: s.dashed ? 1.5 : 2.5,
              borderDash: s.dashed ? [5, 4] : undefined,
              backgroundColor: s.area ? verticalGradient<'line'>(s.color, 0.32, 0) : undefined,
              fill: s.area ? 'origin' : false,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: s.color,
              tension: 0.35,
            }
      ),
    }),
    [series]
  );
  const xBounds = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    return xs.length > 0 ? { min: Math.min(...xs), max: Math.max(...xs) } : {};
  }, [series]);
  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          // Exactly the data's span — "nice" rounding would pad it with empty months.
          ...xBounds,
          ticks: {
            color: axisTitleColor,
            maxTicksLimit: 7,
            callback: (v) => formatLocalDate(Number(v), xFormat),
          },
        },
        y: {
          reverse,
          beginAtZero,
          title: { display: true, text: yTitle, color: axisTitleColor },
          ticks: {
            color: axisTitleColor,
            stepSize: yStep,
            callback: (v) => formatY(Number(v)),
          },
        },
      },
      plugins: {
        legend:
          series.length > 1 ? { position: 'top', labels: { boxWidth: 12 } } : { display: false },
        tooltip: {
          callbacks: {
            title: (items) => (items[0] ? tooltipTitle(items[0].parsed.x ?? 0) : ''),
            label: (item) =>
              `${series.length > 1 ? `${item.dataset.label}: ` : ''}${formatY(item.parsed.y ?? 0)}`,
          },
        },
      },
    }),
    [series.length, xBounds, yTitle, formatY, reverse, xFormat, tooltipTitle, beginAtZero, yStep]
  );
  return <Chart type="line" data={data as ChartData<'line'>} options={options} />;
}
