'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useAtom } from 'jotai';
import SegmentedControl from '../base/SegmentedControl';
import { statsPrefsAtom } from '../stats/statsState';
import { displayFont, enter, tokens } from '../theme';

/** Per-device statistics preferences (see statsPrefsAtom). */
export default function StatsPrefsCard({ index }: Readonly<{ index: number }>) {
  const [prefs, setPrefs] = useAtom(statsPrefsAtom);
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 }}>
        Statistics
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        When a treadmill run was recorded by both RunnerApp and the watch, count the distance
        measured by the treadmill belt (usually the accurate one) or by the watch.
      </Typography>
      <Box sx={{ maxWidth: 320 }}>
        <SegmentedControl
          aria-label="Distance of linked treadmill runs"
          value={prefs.linkedDistance}
          onChange={(linkedDistance) => setPrefs({ ...prefs, linkedDistance })}
          options={[
            { value: 'belt', label: 'Treadmill belt', color: tokens.cyan },
            { value: 'watch', label: 'Watch', color: tokens.violet },
          ]}
        />
      </Box>
    </Paper>
  );
}
