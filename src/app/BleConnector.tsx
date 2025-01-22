'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWakeLock } from 'react-screen-wake-lock';
import { getCurrentProgram } from '@/services/db/programRepository';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { Timespan } from '../services/Timespan';
import calculateStages, { StageResult } from '../services/stagesCalculator';
import BleManager, { TreadmillEvent } from './BleManager';
import HeartRateManager from './HeartRateManager';
import { runningStateAtom } from './atoms';
import Timer from './run/Timer/Timer';
import { calculateSpeedByHeartRate, calculateSpeedByTempo } from './speedCalculator';
import useRunningLoop from './useRunningLoop';

export default function BleConnector() {
  const [heartRate, setHeartRate] = useState(0);
  const [treadmillSpeed, setTreadmillSpeed] = useState(4);
  const [treadmillIncline] = useState(2);
  const [lastSpeedChanged, setLastSpeedChanged] = useState(new Date());
  const [program, setProgram] = useState<StageResult[]>([]);
  const [currentStage, setCurrentStage] = useState<StageResult>();

  const [runningStartedDate, setRunningStartedDate] = useState<Date>(new Date());

  const [currentRunningTime, setCurrentRunningTime] = useState<Timespan>(new Timespan());

  const [runningState, setRunningState] = useAtom(runningStateAtom);

  useRunningLoop();

  useEffect(() => {
    async function get() {
      const program = await getCurrentProgram();
      const calculatedProgram = calculateStages(program);
      setProgram(calculatedProgram);
    }

    get();
  }, []);

  const wakeLock = useWakeLock({
    onRequest: () => console.log('Screen Wake Lock: requested!'),
    onError: (e) => console.error('An error occurred:', e),
    onRelease: () => console.log('Screen Wake Lock: released!'),
  });

  const updateCurrentStage = useCallback(
    (runningTime: Timespan) => {
      for (const stage of program) {
        if (
          runningTime.totalMilliseconds >= stage.from.totalMilliseconds &&
          runningTime.totalMilliseconds < stage.to.totalMilliseconds
        ) {
          setCurrentStage(stage);
          return stage;
        }
      }
    },
    [program]
  );

  const timerLoop = useCallback(() => {
    // if (isRunning) {
    //   const runningDateDiff = new Date().getTime() - runningStartedDate.getTime();
    //   const runningTime = new Timespan(runningDateDiff);
    //   setCurrentRunningTime(runningTime);
    //   updateCurrentStage(runningTime);
    //   if (currentStage) {
    //     if (new Date().getTime() - lastSpeedChanged.getTime() > 5000) {
    //       console.log(new Date().getTime() - lastSpeedChanged.getTime());
    //       setLastSpeedChanged(new Date());
    //       setTreadmillSpeed((oldSpeed) => {
    //         let newSpeed = 0;
    //         if ('bmp' in currentStage) {
    //           const targetHeartRate = currentStage.bmp;
    //           newSpeed = calculateSpeedByHeartRate(heartRate, targetHeartRate, oldSpeed);
    //         } else {
    //           newSpeed = calculateSpeedByTempo(currentStage.tempo);
    //         }
    //         if (oldSpeed != newSpeed) {
    //           console.log('sending speed ' + newSpeed);
    //           BleManager.sendIncAndSpeed(treadmillIncline, newSpeed);
    //           return newSpeed;
    //         }
    //         return oldSpeed;
    //       });
    //     }
    //   }
    // }
  }, [
    currentStage,
    heartRate,
    lastSpeedChanged,
    runningStartedDate,
    treadmillIncline,
    updateCurrentStage,
  ]);

  useEffect(() => {
    const interval = setInterval(timerLoop, 200);
    return () => clearInterval(interval);
  }, [timerLoop]);

  const onEventOccured = useCallback(
    (event: TreadmillEvent) => {
      if (event.type === 'btDisconnected' || event.type === 'btStopped') {
        setRunningState({
          running: false,
        });
      }
    },
    [setRunningState]
  );

  useEffect(() => {
    const removeEvent = BleManager.subscribe(onEventOccured);
    const removeHeartRateEvent = HeartRateManager.subscribe((heartRateData) =>
      setHeartRate(heartRateData.heartRate)
    );
    // const intervalId = setInterval(runningLoop, 5000);
    return () => {
      removeEvent();
      removeHeartRateEvent();
      // clearInterval(intervalId);
    };
  }, [onEventOccured]);

  async function startNew() {
    try {
      setTreadmillSpeed(4);

      // await BleManager.initBTConnection();
      // if (!BleManager.isConnected()) {
      //   return;
      // }

      // await BleManager.start();
      // BleManager.sendIncAndSpeed(2, 4);

      setRunningStartedDate(new Date(new Date().getTime() + 3000));

      setRunningState((prev) => ({
        ...prev,
        running: true,
        runningStartedDate: new Date(new Date().getTime() + 3000),
        runningTime: new Timespan(),
      }));

      await wakeLock.request();
    } catch {
      setRunningState({
        running: false,
      });
    }
  }

  async function stop() {
    // await BleManager.stop();
    setRunningState({
      running: false,
    });
    await wakeLock.release();
  }

  async function connectHeartRate() {
    await HeartRateManager.requestDevice();
  }

  return (
    <>
      <Box sx={{ padding: 2 }}>
        <Timer
          primaryText={currentStage?.to.subtract(currentRunningTime).toString()}
          primaryTextInfo="Time left"
          secondaryText={
            currentStage ? `${program.indexOf(currentStage) + 1}/${program.length}` : ''
          }
          secondaryTextInfo="Stage"
          progress={
            currentStage
              ? (currentStage.duration.subtract(currentStage.to.subtract(currentRunningTime))
                  .totalMilliseconds *
                  100) /
                currentStage.duration.totalMilliseconds
              : 0
          }
        ></Timer>

        <Stack spacing={1}>
          {runningState.running && (
            <Stack spacing={1} direction="row">
              <TextField
                type="number"
                variant="outlined"
                size="small"
                label="Heart rate"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
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
                  <Box>Incline: {treadmillIncline}</Box>
                  <Box>Speed: {treadmillSpeed}</Box>
                  {currentStage && 'bmp' in currentStage && (
                    <Box>Target heart rate: {currentStage.bmp}</Box>
                  )}
                  <Box>Running time: {runningState.runningTime.toString()}</Box>
                </Stack>
                <Stack spacing={1} direction="column">
                  <Box>Program length: {program.length}</Box>
                  <Box>
                    Program: {currentStage ? program.indexOf(currentStage) + 1 : 'Not started'}
                  </Box>
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
            {program.map((stage, index) => (
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
