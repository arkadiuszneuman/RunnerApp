import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
  type ChartType,
  type Plugin,
  type ScriptableContext,
  type TooltipItem,
} from 'chart.js';
import { Timespan } from '@runner/core';

// Side-effect import shared by every chart in the app — registers the
// chart.js building blocks once, and applies the look shared by all of them
// (no animation on data this dense; text/grid colors legible against the
// app's dark theme). See apps/web/src/app/theme.ts for the app palette.
// CategoryScale backs HrBucketsChart's labeled x axis; every line chart uses
// LinearScale instead (minutes).
ChartJS.register(
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
  // Controllers for the generic <Chart> used by the statistics page's mixed charts.
  BarController,
  LineController,
  ScatterController
);
ChartJS.defaults.animation = false;
ChartJS.defaults.color = 'rgba(255,255,255,0.75)'; // ticks/labels — text tokens, never a series color
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.06)'; // hairline gridlines, recessive
ChartJS.defaults.font.family = 'var(--font-barlow), sans-serif';
ChartJS.defaults.font.size = 11;

// The app's glass look: no axis lines, only faint horizontal gridlines, rounded marks, and a
// frosted dark tooltip like the app's cards.
// Shared base of every scale's defaults (the per-type defaults inherit from it at runtime; its
// type is a union of all scale types, hence the narrowing cast).
const scaleDefaults = ChartJS.defaults.scale as unknown as {
  border: { display: boolean };
  grid: { drawTicks: boolean };
  ticks: { padding: number };
};
scaleDefaults.border.display = false;
scaleDefaults.grid.drawTicks = false;
scaleDefaults.ticks.padding = 6;
ChartJS.defaults.elements.line.borderWidth = 2.5;
ChartJS.defaults.elements.line.borderCapStyle = 'round';
ChartJS.defaults.elements.line.borderJoinStyle = 'round';
ChartJS.defaults.elements.point.hoverRadius = 5;
ChartJS.defaults.elements.point.hoverBorderWidth = 2;
ChartJS.defaults.elements.bar.borderRadius = 6;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.pointStyle = 'circle';
ChartJS.defaults.plugins.legend.labels.boxWidth = 7;
ChartJS.defaults.plugins.legend.labels.boxHeight = 7;
ChartJS.defaults.plugins.legend.labels.padding = 14;
ChartJS.defaults.plugins.legend.labels.color = 'rgba(226, 232, 245, 0.62)';
Object.assign(ChartJS.defaults.plugins.tooltip, {
  backgroundColor: 'rgba(14, 19, 29, 0.94)',
  borderColor: 'rgba(255, 255, 255, 0.14)',
  borderWidth: 1,
  cornerRadius: 12,
  padding: 10,
  caretSize: 5,
  boxPadding: 5,
  usePointStyle: true,
  titleColor: '#f2f5fb',
  bodyColor: 'rgba(226, 232, 245, 0.8)',
  footerColor: 'rgba(226, 232, 245, 0.55)',
  titleFont: {
    family: 'var(--font-display), var(--font-barlow), sans-serif',
    weight: 600,
    size: 13,
  },
  footerFont: { weight: 400 },
});

/**
 * A soft glow under every line in its own colour — the neon look of the rest of the app
 * (cf. the run screen's glowing rings). Purely cosmetic: drawn with the canvas shadow.
 */
const lineGlow: Plugin = {
  id: 'lineGlow',
  beforeDatasetDraw(chart, { meta }) {
    const dataset = chart.data.datasets[meta.index] as { borderColor?: unknown };
    if (meta.type !== 'line' || typeof dataset.borderColor !== 'string') return;
    chart.ctx.save();
    chart.ctx.shadowColor = dataset.borderColor;
    chart.ctx.shadowBlur = 12;
  },
  afterDatasetDraw(chart, { meta }) {
    const dataset = chart.data.datasets[meta.index] as { borderColor?: unknown };
    if (meta.type !== 'line' || typeof dataset.borderColor !== 'string') return;
    chart.ctx.restore();
  },
};
ChartJS.register(lineGlow);

/** `#rrggbb` at an opacity. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * A scriptable fill fading from `top` to `bottom` opacity down the plot area — for bars and areas,
 * so the full colour sits at the data end and the mark melts into the card towards the baseline.
 */
export function verticalGradient<T extends ChartType>(hex: string, top = 0.95, bottom = 0.25) {
  return (context: ScriptableContext<T>) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return withAlpha(hex, top);
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, withAlpha(hex, top));
    gradient.addColorStop(1, withAlpha(hex, bottom));
    return gradient;
  };
}

/** Categorical dark-mode slots from the validated reference palette (see the
 * dataviz skill's references/palette.md), originally validated against the old
 * teal surface (#0d5f6e); the current near-black glass cards (~#0f131b) only
 * raise their contrast — kept as named roles rather than raw hex
 * inline in every chart so the mapping stays in one place. */
export const chartColors = {
  hr: '#e66767', // slot 8 (red)
  target: '#c98500', // slot 4 (yellow)
  targetBand: 'rgba(201, 133, 0, 0.16)',
  predicted: 'rgba(255, 255, 255, 0.45)', // supplementary series — muted ink, not a categorical slot
  commandedSpeed: '#3987e5', // slot 1 (blue)
  actualSpeed: '#199e70', // slot 3 (aqua)
  incline: '#9085e9', // slot 7 (violet)
  deviation: '#d95926', // slot 2 (orange)
  zeroLine: 'rgba(255, 255, 255, 0.25)',
  // Watch-activity charts (one series each, so no two of these share a plot).
  pace: '#3987e5', // slot 1 (blue)
  elevation: '#9085e9', // slot 7 (violet)
  cadence: '#199e70', // slot 3 (aqua)
} as const;

/**
 * The statistics palette: the app's own accent hues (cyan, volt, violet, heart, amber — see
 * theme.ts tokens), each stepped down into the dataviz lightness band so no series outshines the
 * others. In this fixed order it passes the dataviz validator on the card surface (#0e131d):
 * lightness band, chroma, adjacent CVD ΔE ≥ 8, normal-vision ΔE ≥ 15, ≥ 3:1 contrast.
 */
export const seriesColors = ['#1f9fbf', '#77a316', '#8b7bff', '#e8455f', '#c4831a'] as const;

/** De-emphasised context series (e.g. previous years behind the current one). */
export const contextColor = 'rgba(226, 232, 245, 0.3)';

/** Neutral ink for supplementary lines (rolling averages) — never a series hue. */
export const trendColor = 'rgba(242, 245, 251, 0.75)';

/**
 * Ordinal ramp for the five heart-rate zones in the app's cyan, darkest (easiest) to brightest
 * (hardest) — on the dark surface the brighter step reads as the more intense one.
 */
export const zoneColors = ['#145a6b', '#1a7a91', '#1f9fbf', '#4cc3e0', '#8fe3f5'] as const;

/** Sequential volt ramp for the calendar heatmap, low to high (index 0 = no run). */
export const heatColors = [
  'rgba(255, 255, 255, 0.05)',
  '#2f4410',
  '#4a6b16',
  '#6a9a1c',
  '#93cc2a',
  '#c6ff3d',
] as const;

/**
 * Formats an x value of the statistics charts: local wall-clock time encoded as UTC ms (see
 * StatsActivity.localMs), so it's rendered in UTC to show the local date unchanged.
 */
export function formatLocalDate(localMs: number, options: Intl.DateTimeFormatOptions): string {
  return new Date(localMs).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
}

export const axisTitleColor = 'rgba(255, 255, 255, 0.55)';

/**
 * All line charts here use a linear x axis in fractional minutes (so
 * telemetry's `t`-in-seconds lines up across charts and with stage
 * boundaries). Minutes-with-decimals reads fine on the axis ticks, but is
 * useless in a hover tooltip — this renders the hovered x as run-clock
 * mm:ss instead, reusing the same Timespan formatting the rest of the app
 * uses for durations.
 */
export function tooltipTitleAsClock(items: TooltipItem<'line'>[]): string {
  const x = items[0]?.parsed.x;
  if (x === undefined || x === null) return '';
  return Timespan.fromMinutes(x).toString('mm:ss');
}
