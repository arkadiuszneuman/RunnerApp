'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { stagesAtom } from './atoms';
import useRunningLoop from './useRunningLoop';
import StageChart from './StageChart';

export default function BleConnector() {
  const stages = useAtomValue(stagesAtom);

  const runningLoop = useRunningLoop();

  async function connectHeartRate() {
    await runningLoop.connectHeartRateMonitor();
  }

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
        <StageChart />
      </Stack>
    </Box>
  );
}
