'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { stagesAtom } from './atoms';
import useRunningLoop from './useRunningLoop';
import { useWakeLock } from 'react-screen-wake-lock';
import { useEffect, useState } from 'react';

export default function BleConnector() {
  const stages = useAtomValue(stagesAtom);
  const [wakeLockStatus, setWakeLockStatus] = useState<
    'connecting' | 'requested' | 'released' | 'error'
  >('connecting');

  const { isSupported, request } = useWakeLock({
    onRequest: () => setWakeLockStatus('requested'),
    onRelease: () => setWakeLockStatus('released'),
    onError: (error) => {
      console.log('Wake lock error', error);
      setWakeLockStatus('error');
    },
  });
  const runningLoop = useRunningLoop();

  async function connectHeartRate() {
    await runningLoop.connectHeartRateMonitor();
  }

  useEffect(() => {
    if (wakeLockStatus !== 'requested') {
      request();
    }
  }, [request, wakeLockStatus]);

  return (
    <Box sx={{ padding: 2 }}>
      <Stack spacing={1}>
        <Stack spacing={1} direction="row">
          <Button variant="contained" onClick={connectHeartRate}>
            Connect
          </Button>
          <Button variant="contained" color="secondary" href="/add-program" LinkComponent={Link}>
            Program
          </Button>
          <Button
            variant="contained"
            href="/running"
            LinkComponent={Link}
            disabled={
              stages.length === 0 ||
              (stages.filter((x) => x.speedType === 'bmp').length >= 1 &&
                runningLoop.heartRateConnected() === false)
            }
          >
            Start running
          </Button>
        </Stack>
      </Stack>
      <Box>
        <Box>Is wake lock supported: {isSupported ? 'Yes' : 'No'}</Box>
        <Box>Wake lock status: {wakeLockStatus}</Box>
      </Box>
    </Box>
  );
}
