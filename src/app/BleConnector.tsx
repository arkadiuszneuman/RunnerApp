'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { activeProgramIdAtom, stagesAtom } from './atoms';
import useRunningLoop from './useRunningLoop';

export default function BleConnector() {
  const stages = useAtomValue(stagesAtom);
  const activeProgramId = useAtomValue(activeProgramIdAtom);
  const [programName, setProgramName] = useState<string | null>(null);

  const runningLoop = useRunningLoop();

  useEffect(() => {
    if (!activeProgramId) { setProgramName(null); return; }
    axios
      .get(`/api/programs/${activeProgramId}`)
      .then(({ data }) => setProgramName(data?.name ?? null))
      .catch(() => {});
  }, [activeProgramId]);

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
          <Button variant="contained" color="secondary" href="/programs" LinkComponent={Link}>
            Programs
          </Button>
          <Button
            variant="contained"
            href="/running"
            LinkComponent={Link}
            disabled={
              stages.length === 0 ||
              (stages.filter((x) => x.speedType === 'bmp').length >= 1 &&
                !runningLoop.heartRateConnected())
            }
          >
            Start running
          </Button>
        </Stack>
        {programName ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Active program: <strong>{programName}</strong>
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'warning.main' }}>
            No program selected —{' '}
            <Link href="/programs" style={{ color: 'inherit' }}>
              pick one
            </Link>
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
