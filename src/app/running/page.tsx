'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import LockIcon from '@mui/icons-material/Lock';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isPausedAtom, runningStateAtom } from '../atoms';
import useRunningLoop from '../useRunningLoop';
import RunInfo from './RunInfo/RunInfo';

export default function Run() {
  const runningLoop = useRunningLoop();
  const runningState = useAtomValue(runningStateAtom);
  const isPaused = useAtomValue(isPausedAtom);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wakeLockSupported = mounted && runningLoop.wakeLock.isWakeLockSupported;
  const wakeLockActive = mounted && runningLoop.wakeLock.wakeLockStatus === 'requested';
  const heartConnected = mounted && runningLoop.heartRateConnected();

  return (
    <Grid container spacing={4}>
      <Grid size={12}>
        <RunInfo onResetManualSpeed={runningLoop.resetManualSpeed} />
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
      <Box sx={{ display: 'flex', gap: 1.5, mx: 2, alignItems: 'center' }}>
        <Tooltip title={`Wake lock: ${wakeLockSupported ? 'supported' : 'not supported'}`}>
          <LockIcon sx={{ color: wakeLockSupported ? 'white' : 'rgba(255,255,255,0.25)' }} />
        </Tooltip>
        <Tooltip title={`Screen keep-awake: ${runningLoop.wakeLock.wakeLockStatus}`}>
          <WbSunnyIcon sx={{ color: wakeLockActive ? 'white' : 'rgba(255,255,255,0.25)' }} />
        </Tooltip>
        <Tooltip title={`Heart rate monitor: ${heartConnected ? 'connected' : 'disconnected'}`}>
          <MonitorHeartIcon sx={{ color: heartConnected ? 'white' : 'rgba(255,255,255,0.25)' }} />
        </Tooltip>
      </Box>
    </Grid>
  );
}
