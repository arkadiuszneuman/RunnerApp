'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { Timespan } from '../services/Timespan';
import { currentStageAtom, heartRateAtom, runningStateAtom, stagesAtom } from './atoms';
import Timer from './run/Timer/Timer';
import useRunningLoop from './useRunningLoop';

export default function BleConnector() {
  const runningState = useAtomValue(runningStateAtom);
  const currentStage = useAtomValue(currentStageAtom);
  const stages = useAtomValue(stagesAtom);
  const heartRate = useAtomValue(heartRateAtom);

  const runningLoop = useRunningLoop();

  async function startNew() {
    await runningLoop.start();
  }

  async function stop() {
    await runningLoop.stop();
  }

  async function connectHeartRate() {
    await runningLoop.connectHeartRateMonitor();
  }

  return (
    <>
      <Box sx={{ padding: 2 }}>
        {runningState.running && (
          <Timer
            primaryText={currentStage?.to.subtract(runningState.runningTime).toString()}
            primaryTextInfo="Time left"
            secondaryText={
              currentStage ? `${stages.indexOf(currentStage) + 1}/${stages.length}` : ''
            }
            secondaryTextInfo="Stage"
            progress={
              currentStage
                ? (currentStage.duration.subtract(
                    currentStage.to.subtract(runningState.runningTime)
                  ).totalMilliseconds *
                    100) /
                  currentStage.duration.totalMilliseconds
                : 0
            }
          ></Timer>
        )}

        <Stack spacing={1}>
          {runningState.running && (
            <Stack spacing={1} direction="row">
              <TextField
                type="number"
                variant="outlined"
                size="small"
                label="Heart rate"
                value={heartRate}
                slotProps={{
                  input: {
                    inputProps: {
                      min: 10,
                      max: 200,
                    },
                  },
                }}
              />
              <Stack spacing={1} direction="row">
                <Stack spacing={1} direction="column">
                  <Box>Incline: {runningState.treadmillOptions.incline}</Box>
                  <Box>Speed: {runningState.treadmillOptions.speed}</Box>
                  {currentStage && 'bmp' in currentStage && (
                    <Box>Target heart rate: {currentStage.bmp}</Box>
                  )}
                  <Box>Running time: {runningState.runningTime.toString()}</Box>
                </Stack>
              </Stack>
            </Stack>
          )}
          <Stack spacing={1} direction="row">
            <Button variant="contained" onClick={connectHeartRate}>
              Connect
            </Button>
            <Button variant="contained" color="secondary" href="/add-program" LinkComponent={Link}>
              Add program
            </Button>
            <Button variant="contained" onClick={startNew} disabled={runningState.running}>
              Start
            </Button>
            <Button variant="contained" onClick={stop} disabled={!runningState.running}>
              Stop
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
