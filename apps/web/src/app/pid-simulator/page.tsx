'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  AdaptiveTraining,
  calculateStages,
  parseProgram,
  simulateRun,
  summarizeSimulation,
  Training,
  type SimulationPoint,
  type SimulationSummary,
  type SpeedControllerKind,
} from '@runner/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { useAtomValue } from 'jotai';
import { Line } from 'react-chartjs-2';
import { stagesAtom } from '../atoms';
import Page from '../base/Page';
import { SpeedControllerBadge, speedControllerColor } from '../base/SpeedControllerPicker';
import { axisTitleColor, chartColors, tooltipTitleAsClock } from '../runs/[id]/charts/chartSetup';
import { displayFont, enter, tokens } from '../theme';

/** Used when no program is active, so the page always has something to show. */
const SAMPLE_PROGRAM = '4x4:00@175';

function lineOptions(yTitle: string): ChartOptions<'line'> {
  return {
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
        title: { display: true, text: yTitle, color: axisTitleColor },
        ticks: { color: axisTitleColor },
      },
    },
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12 } },
      tooltip: { callbacks: { title: tooltipTitleAsClock } },
    },
  };
}

function series(points: SimulationPoint[], pick: (p: SimulationPoint) => number | null) {
  return points.map((p) => ({ x: p.t / 60, y: pick(p) }));
}

function NumberField(
  props: Readonly<{ label: string; value: number; step?: number; min?: number; onChange: (value: number) => void }>
) {
  return (
    <TextField
      label={props.label}
      size="small"
      type="number"
      value={props.value}
      slotProps={{ htmlInput: { step: props.step, min: props.min, inputMode: 'decimal' } }}
      onChange={(e) => {
        const value = Number(e.target.value);
        if (Number.isFinite(value)) props.onChange(Math.max(props.min ?? -Infinity, value));
      }}
    />
  );
}

function SummaryCard(props: Readonly<{ kind: SpeedControllerKind; summary: SimulationSummary; index: number }>) {
  const stats = [
    { label: 'In ±5 bpm', value: `${Math.round(props.summary.pctInTarget)}%` },
    { label: 'Mean error', value: `${props.summary.meanAbsErrorBpm.toFixed(1)}` },
    { label: 'Speed changes', value: `${props.summary.speedChanges}` },
  ];
  return (
    <Paper variant="outlined" sx={{ p: 2, ...enter(props.index) }}>
      <SpeedControllerBadge kind={props.kind} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 1.5 }}>
        {stats.map((s) => (
          <Box key={s.label}>
            <Typography
              className="tabular"
              sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.1 }}
            >
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function PidSimulatorPage() {
  const activeStages = useAtomValue(stagesAtom);
  const [hrPerKmh, setHrPerKmh] = useState(9);
  const [timeConstantS, setTimeConstantS] = useState(35);
  const [noiseBpm, setNoiseBpm] = useState(2);
  const [seed, setSeed] = useState(7);

  const usingSample = activeStages.length === 0;
  const stages = useMemo(
    () => (usingSample ? calculateStages(parseProgram(SAMPLE_PROGRAM)) : activeStages),
    [usingSample, activeStages]
  );

  const results = useMemo(() => {
    const model = { hrPerKmh, timeConstantS, noiseBpm, seed };
    const legacy = simulateRun(new Training(4), stages, model);
    const adaptive = simulateRun(new AdaptiveTraining(4), stages, model);
    return {
      legacy,
      adaptive,
      legacySummary: summarizeSimulation(legacy),
      adaptiveSummary: summarizeSimulation(adaptive),
    };
  }, [stages, hrPerKmh, timeConstantS, noiseBpm, seed]);

  const hrData: ChartData<'line'> = {
    datasets: [
      {
        label: 'Target HR',
        data: series(results.adaptive, (p) => p.targetHr),
        borderColor: chartColors.target,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        stepped: 'after',
      },
      {
        label: 'Classic',
        data: series(results.legacy, (p) => p.hr),
        borderColor: speedControllerColor.legacy,
        borderWidth: 1.5,
        pointRadius: 0,
      },
      {
        label: 'Adaptive',
        data: series(results.adaptive, (p) => p.hr),
        borderColor: speedControllerColor.adaptive,
        borderWidth: 1.5,
        pointRadius: 0,
      },
    ],
  };

  const speedData: ChartData<'line'> = {
    datasets: [
      {
        label: 'Classic',
        data: series(results.legacy, (p) => p.speed),
        borderColor: speedControllerColor.legacy,
        borderWidth: 1.5,
        pointRadius: 0,
        stepped: 'after',
      },
      {
        label: 'Adaptive',
        data: series(results.adaptive, (p) => p.speed),
        borderColor: speedControllerColor.adaptive,
        borderWidth: 1.5,
        pointRadius: 0,
        stepped: 'after',
      },
    ],
  };

  return (
    <Page eyebrow="Dev tool" title="Controller simulator" maxWidth={900}>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Both speed controllers run {usingSample ? `the sample program ${SAMPLE_PROGRAM}` : 'your active program'}{' '}
        against a simulated runner, ticked at 1 Hz exactly like a real run.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 1.5, ...enter(0) }}>
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Simulated runner</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          <NumberField label="bpm per km/h" value={hrPerKmh} step={0.5} min={1} onChange={setHrPerKmh} />
          <NumberField label="HR lag τ (s)" value={timeConstantS} step={5} min={1} onChange={setTimeConstantS} />
          <NumberField label="Noise ± bpm" value={noiseBpm} step={0.5} min={0} onChange={setNoiseBpm} />
          <NumberField label="Noise seed" value={seed} step={1} min={1} onChange={setSeed} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
          The adaptive controller assumes 9 bpm per km/h and τ = 35 s — change these to see how it copes
          with a runner who responds differently.
        </Typography>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
        <SummaryCard kind="legacy" summary={results.legacySummary} index={1} />
        <SummaryCard kind="adaptive" summary={results.adaptiveSummary} index={2} />
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 1.5, ...enter(3) }}>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', mb: 1 }}>
          Heart rate
        </Typography>
        <Box sx={{ height: 300 }}>
          <Line data={hrData} options={lineOptions('BPM')} />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, ...enter(4) }}>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', mb: 1 }}>
          Commanded speed
        </Typography>
        <Box sx={{ height: 240 }}>
          <Line data={speedData} options={lineOptions('km/h')} />
        </Box>
      </Paper>

      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: tokens.textFaint }}>
        Stats skip the first 90 s after every target change.
      </Typography>
    </Page>
  );
}
