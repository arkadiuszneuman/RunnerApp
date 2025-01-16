"use client";

import { useCallback, useEffect, useState } from "react";
import { useWakeLock } from "react-screen-wake-lock";
import BleManager, { TreadmillEvent } from "./BleManager";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import HeartRateManager from "./HeartRateManager";
import Link from "next/link";
import { Stage, StageResult } from "../../calc/src/stagesCalculator";
import { Timespan } from "../../calc/src/Timespan";
import { calculateSpeed } from "./speedCalculator";

export function traningProgramReducer(
  state: {
    stages: Stage[];
  },
  action: {
    type: "add_stage";
    stageToAdd: Stage;
  }
) {
  switch (action.type) {
    case "add_stage":
      return {
        ...state,
        stages: [...state.stages, action.stageToAdd],
      };
  }
}

const calculated: StageResult[] = [
  {
    type: "simple",
    time: Timespan.fromMinutes(10),
    bmp: 145,
    from: new Timespan(),
    to: Timespan.fromMinutes(10),
  },
  {
    type: "simple",
    time: Timespan.fromMinutes(16),
    bmp: 172,
    from: Timespan.fromMinutes(10),
    to: Timespan.fromMinutes(26),
  },
  {
    type: "simple",
    time: Timespan.fromMinutes(10),
    bmp: 145,
    from: Timespan.fromMinutes(26),
    to: Timespan.fromMinutes(36),
  },
];

// const calculated = calculateStages(stages);

export default function BleConnector() {
  const [isRunning, setIsRunning] = useState(false);
  const [heartRate, setHeartRate] = useState(0);
  const [treadmillSpeed, setTreadmillSpeed] = useState(4);
  const [treadmillIncline] = useState(2);
  const [lastSpeedChanged, setLastSpeedChanged] = useState(new Date());

  const [runningStartedDate, setRunningStartedDate] = useState<Date>(
    new Date()
  );

  const [currentRunningTime, setCurrentRunningTime] = useState<Timespan>(
    new Timespan()
  );

  const wakeLock = useWakeLock({
    onRequest: () => console.log("Screen Wake Lock: requested!"),
    onError: (e) => console.error("An error occurred:", e),
    onRelease: () => console.log("Screen Wake Lock: released!"),
  });

  const getCurrentBmp = useCallback((runningTime: Timespan) => {
    for (const stage of calculated) {
      if (
        runningTime.totalMilliseconds >= stage.from.totalMilliseconds &&
        runningTime.totalMilliseconds < stage.to.totalMilliseconds
      ) {
        return "bmp" in stage ? stage.bmp : 0;
      }
    }

    return 0;
  }, []);

  const timerLoop = useCallback(() => {
    if (isRunning) {
      const runningDateDiff =
        new Date().getTime() - runningStartedDate.getTime();
      const runningTime = new Timespan(runningDateDiff);
      setCurrentRunningTime(runningTime);

      if (new Date().getTime() - lastSpeedChanged.getTime() > 5000) {
        console.log(new Date().getTime() - lastSpeedChanged.getTime());
        setLastSpeedChanged(new Date());

        setTreadmillSpeed((oldSpeed) => {
          const targetHeartRate = getCurrentBmp(runningTime);
          const newSpeed = calculateSpeed(heartRate, targetHeartRate, oldSpeed);

          if (oldSpeed != newSpeed) {
            console.log("sending speed " + newSpeed);

            BleManager.sendIncAndSpeed(treadmillIncline, newSpeed);

            return newSpeed;
          }

          return oldSpeed;
        });
      }
    }
  }, [
    getCurrentBmp,
    heartRate,
    isRunning,
    lastSpeedChanged,
    runningStartedDate,
    treadmillIncline,
  ]);

  useEffect(() => {
    const interval = setInterval(timerLoop, 1000);
    return () => clearInterval(interval);
  }, [timerLoop]);

  const onEventOccured = useCallback(
    (event: TreadmillEvent) => {
      if (event.type === "btDisconnected" || event.type === "btStopped") {
        setIsRunning(false);
      }
    },
    [setIsRunning]
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

      await BleManager.initBTConnection();
      if (!BleManager.isConnected()) {
        return;
      }

      setIsRunning(true);
      await BleManager.start();
      BleManager.sendIncAndSpeed(2, 4);

      setRunningStartedDate(new Date(new Date().getTime() + 3000));
      await wakeLock.request();
    } catch {
      setIsRunning(false);
    }
  }

  async function stop() {
    await BleManager.stop();
    setIsRunning(false);
    await wakeLock.release();
  }

  async function connectHeartRate() {
    await HeartRateManager.requestDevice();
  }

  return (
    <>
      <Box sx={{ padding: 2 }}>
        <Stack spacing={1}>
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
            <Box>Incline: {treadmillIncline}</Box>
            <Box>Speed: {treadmillSpeed}</Box>
            <Box>Target heart rate: {getCurrentBmp(currentRunningTime)}</Box>
            <Box>Running time: {currentRunningTime.toString()}</Box>
          </Stack>
          <Stack spacing={1} direction="row">
            <Button variant="contained" onClick={connectHeartRate}>
              Connect
            </Button>
            <Button
              variant="contained"
              color="secondary"
              href="/add-program"
              LinkComponent={Link}
            >
              Add program
            </Button>
            <Button variant="contained" onClick={startNew} disabled={isRunning}>
              Start
            </Button>
            <Button variant="contained" onClick={stop} disabled={!isRunning}>
              Stop
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
