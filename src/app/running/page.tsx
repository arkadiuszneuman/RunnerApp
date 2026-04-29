'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { isPausedAtom, runningStateAtom } from '../atoms';
import RunnerTypography from '../base/RunnerTypography';
import useRunningLoop from '../useRunningLoop';
import RunInfo from './RunInfo/RunInfo';

export default function Run() {
  const runningLoop = useRunningLoop();
  const runningState = useAtomValue(runningStateAtom);
  const isPaused = useAtomValue(isPausedAtom);

  return (
    <Grid container spacing={4}>
      <Grid size={12}>
        <RunInfo />
      </Grid>
      <Grid container spacing={1} sx={{ mx: 2 }} size={12}>
        <Grid size="auto">
          <Button variant="contained" onClick={runningLoop.start} disabled={runningState.running}>
            Start
          </Button>
        </Grid>
        {runningState.running && (
          <Grid size="auto">
            <Button variant="contained" onClick={isPaused ? runningLoop.resume : runningLoop.pause}>
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          </Grid>
        )}
        <Grid size="auto">
          <Button variant="contained" onClick={runningLoop.stop} disabled={!runningState.running}>
            Stop
          </Button>
        </Grid>
        <Grid size="grow"></Grid>
        <Grid size="auto">
          <Button
            variant="contained"
            color="error"
            href="/"
            disabled={runningState.running}
            LinkComponent={Link}
          >
            Back
          </Button>
        </Grid>
      </Grid>
      <Box>
        <RunnerTypography>
          Wake Lock Supported: {runningLoop.wakeLock.isWakeLockSupported.toString()}
        </RunnerTypography>
        <RunnerTypography>Wake Lock Status: {runningLoop.wakeLock.wakeLockStatus}</RunnerTypography>
        <RunnerTypography>
          Heart Rate: {runningLoop.heartRateConnected() ? 'Connected' : 'Disconnected'}
        </RunnerTypography>
      </Box>
    </Grid>
  );
}
