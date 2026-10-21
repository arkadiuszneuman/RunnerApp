'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useAtom, useAtomValue } from 'jotai';
import SegmentedControl from '../base/SegmentedControl';
import { effectsChoiceAtom, slowGpuAtom } from '../effects/visualEffects';
import { displayFont, enter, tokens } from '../theme';

/** Per-device choice of visual effects (see effects/visualEffects.ts). */
export default function EffectsCard({ index }: Readonly<{ index: number }>) {
  const [choice, setChoice] = useAtom(effectsChoiceAtom);
  const slowGpu = useAtomValue(slowGpuAtom);
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 }}>
        Visual effects
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Lighter effects drop the frosted-glass blur, so slower phones switch tabs and scroll
        smoothly. Auto turns them on when this device can&apos;t keep up.
        {choice === 'auto' && slowGpu && ' This one couldn’t, so they’re on.'}
      </Typography>
      <Box sx={{ maxWidth: 360 }}>
        <SegmentedControl
          aria-label="Visual effects"
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'auto', label: 'Auto', color: tokens.cyan },
            { value: 'full', label: 'Full', color: tokens.violet },
            { value: 'lite', label: 'Lighter', color: tokens.volt },
          ]}
        />
      </Box>
    </Paper>
  );
}
