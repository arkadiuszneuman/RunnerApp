'use client';

import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { SPEED_CONTROLLER_KINDS, type SpeedControllerKind } from '@runner/core';
import { useAtom, useAtomValue } from 'jotai';
import { isRunningAtom, speedControllerAtom } from '../atoms';
import { saveSpeedControllerPreference } from '../speedControllerPreference';
import { enter, segmentedSx, segmentSelectedSx, tokens } from '../theme';

export const speedControllerLabel: Record<SpeedControllerKind, string> = {
  legacy: 'Classic',
  adaptive: 'Adaptive',
};

export const speedControllerColor: Record<SpeedControllerKind, string> = {
  legacy: tokens.amber,
  adaptive: tokens.cyan,
};

const description: Record<SpeedControllerKind, string> = {
  legacy: 'The original PID controller.',
  adaptive: 'Smoothed HR prediction, gentle PI with a jump on target changes.',
};

/** Small tag showing which controller drove a recorded run. */
export function SpeedControllerBadge({ kind }: Readonly<{ kind: SpeedControllerKind }>) {
  const color = speedControllerColor[kind];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color,
        background: alpha(color, 0.14),
        border: `1px solid ${alpha(color, 0.3)}`,
        flexShrink: 0,
      }}
    >
      {speedControllerLabel[kind]}
    </Box>
  );
}

/** Toggle between the legacy and adaptive HR speed controllers for the next run. */
export default function SpeedControllerPicker({ index = 0 }: Readonly<{ index?: number }>) {
  const [controller, setController] = useAtom(speedControllerAtom);
  const running = useAtomValue(isRunningAtom);

  return (
    <Paper variant="outlined" sx={{ p: 2, ...enter(index) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <TuneRoundedIcon sx={{ color: tokens.violet, fontSize: 20 }} />
        <Typography sx={{ fontWeight: 600, flex: 1 }}>Speed controller</Typography>
        {running && (
          <Typography variant="caption" color="text.secondary">
            Locked during a run
          </Typography>
        )}
      </Box>
      <ToggleButtonGroup
        exclusive
        aria-label="Speed controller"
        value={controller}
        disabled={running}
        onChange={(_event, value: SpeedControllerKind | null) => {
          if (!value) return;
          setController(value);
          saveSpeedControllerPreference(value);
        }}
        sx={segmentedSx}
      >
        {SPEED_CONTROLLER_KINDS.map((kind) => (
          <ToggleButton key={kind} value={kind} sx={segmentSelectedSx(speedControllerColor[kind])}>
            {speedControllerLabel[kind]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {description[controller]}
      </Typography>
    </Paper>
  );
}
