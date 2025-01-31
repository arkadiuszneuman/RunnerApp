'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { runningStateAtom, stagesAtom } from './atoms';
import useRunningLoop from './useRunningLoop';

export default function BleConnector() {
  const runningState = useAtomValue(runningStateAtom);
  const stages = useAtomValue(stagesAtom);

  const runningLoop = useRunningLoop();

  async function connectHeartRate() {
    await runningLoop.connectHeartRateMonitor();
  }

  return (
    <>
      <Box sx={{ padding: 2 }}>
        <Stack spacing={1}>
          <Stack spacing={1} direction="row">
            <Button variant="contained" onClick={connectHeartRate}>
              Connect
            </Button>
            <Button variant="contained" color="secondary" href="/add-program" LinkComponent={Link}>
              Add program
            </Button>
            <Button variant="contained" href="/running" disabled={runningState.running}>
              Start running
            </Button>
          </Stack>
          <Stack spacing={1} direction="column">
            {stages.map((stage, index) => (
              <Box key={index}>
                <Box>Type: {stage.type}</Box>
                <Box>Duration: {stage.duration.toString()}</Box>
                <Box>From: {stage.from.toString()}</Box>
                <Box>To: {stage.to.toString()}</Box>
                {'bmp' in stage && <Box>BMP: {stage.bmp}</Box>}
                {'tempo' in stage && <Box>Tempo: {stage.tempo.toString()}</Box>}
                <Box>--------------------</Box>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
