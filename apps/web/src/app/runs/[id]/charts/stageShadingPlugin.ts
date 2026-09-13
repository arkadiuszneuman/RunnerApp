import type { Plugin } from 'chart.js';

export interface StageBand {
  fromMin: number;
  toMin: number;
}

/**
 * Draws a faint vertical band behind every other stage, so the HR/speed
 * charts read against stage boundaries without needing per-stage labels
 * crowding the plot (the stage table below the charts carries the detail).
 * A fresh instance is created per chart (bands differ per run) rather than
 * registered globally.
 */
export function makeStageShadingPlugin(bands: StageBand[]): Plugin<'line'> {
  return {
    id: 'stageShading',
    beforeDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const xScale = scales.x;
      ctx.save();
      bands.forEach((band, i) => {
        if (i % 2 !== 0) return; // shade only every other stage
        const xFrom = xScale.getPixelForValue(band.fromMin);
        const xTo = xScale.getPixelForValue(band.toMin);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(xFrom, chartArea.top, xTo - xFrom, chartArea.bottom - chartArea.top);
      });
      ctx.restore();
    },
  };
}
