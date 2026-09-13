import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

// Side-effect import shared by every chart in this folder — registers the
// chart.js building blocks once, and applies the look shared by all of them
// (no animation on data this dense; text/grid colors legible against the
// app's dark theme). See apps/web/src/app/theme.ts for the app palette.
// CategoryScale backs HrBucketsChart's labeled x axis; every line chart uses
// LinearScale instead (minutes).
ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);
ChartJS.defaults.animation = false;
ChartJS.defaults.color = 'rgba(255,255,255,0.75)'; // ticks/labels — text tokens, never a series color
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.12)'; // hairline gridlines, recessive
ChartJS.defaults.font.family = 'var(--font-barlow), sans-serif';

/** Categorical dark-mode slots from the validated reference palette (see the
 * dataviz skill's references/palette.md), re-validated against this app's
 * teal Paper surface (#0d5f6e) — kept as named roles rather than raw hex
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
} as const;

export const axisTitleColor = 'rgba(255, 255, 255, 0.55)';
