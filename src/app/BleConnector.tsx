"use client";

import { useCallback, useEffect, useState } from "react";
import BleManager, { TreadmillEvent } from "./BleManager";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

export default function BleConnector() {
  const [isRunning, setIsRunning] = useState(false);
  const [heartRate, setHeartRate] = useState(70);
  const [treadmillSpeed, setTreadmillSpeed] = useState(4);
  const [treadmillIncline, setTreadmillIncline] = useState(2);

  const targedHeartRate = 132;

  const onEventOccured = useCallback((event: TreadmillEvent) => {
    console.log(event);

    if (event.type === "btDisconnected" || event.type === "btStopped") {
      setIsRunning(false);
    }
  }, []);

  const runningLoop = useCallback(() => {
    if (isRunning && BleManager.isConnected() && BleManager.isRunning()) {
      //

      const diff = targedHeartRate - heartRate;
      if (Math.abs(diff) > 5) {
        setTreadmillSpeed((oldSpeed) => {
          const newSpeed = Math.max(
            1,
            Math.min(20, Math.round((oldSpeed + diff / 10) * 10) / 10)
          );

          BleManager.sendIncAndSpeed(treadmillIncline, newSpeed);

          return newSpeed;
        });
      }
    }
  }, [heartRate, isRunning, treadmillIncline]);

  useEffect(() => {
    const removeEvent = BleManager.subscribe(onEventOccured);
    const intervalId = setInterval(runningLoop, 5000);
    return () => {
      removeEvent();
      clearInterval(intervalId);
    };
  }, [onEventOccured, runningLoop]);

  function connect(): void {
    BleManager.initBTConnection();
  }

  function start() {
    BleManager.start();
  }

  function set() {
    BleManager.sendIncAndSpeed(2, 3);
  }

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function startNew() {
    try {
      setIsRunning(true);

      await BleManager.initBTConnection();
      if (!BleManager.isConnected()) {
        setIsRunning(false);
        return;
      }

      await BleManager.start();
      BleManager.sendIncAndSpeed(2, 4);
    } catch {
      setIsRunning(false);
    }
  }

  async function stop() {
    await BleManager.stop();
    setIsRunning(false);
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
          </Stack>
          <Stack spacing={1} direction="row">
            {/* <Button variant="contained" color="warning" onClick={connect}>
        Connect
      </Button>
      <Button variant="contained" onClick={start}>
        Start
      </Button>
      <Button variant="contained" onClick={set}>
        Set
      </Button>
      <Button variant="contained" onClick={stop}>
        Stop
      </Button> */}
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
