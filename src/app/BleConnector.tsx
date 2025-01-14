"use client";

import { useCallback, useEffect, useState } from "react";
import BleManager, { TreadmillEvent } from "./BleManager";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import HeartRateManager from "./HeartRateManager";
import Link from "next/link";

export default function BleConnector() {
  const [isRunning, setIsRunning] = useState(false);
  const [heartRate, setHeartRate] = useState(0);
  const [treadmillSpeed, setTreadmillSpeed] = useState(4);
  const [treadmillIncline] = useState(2);
  const [lastSpeedChanged, setLastSpeedChanged] = useState(new Date());

  const targetHeartRate = 145;

  const onEventOccured = useCallback(
    (event: TreadmillEvent) => {
      // console.log(event);
      if (new Date().getTime() - lastSpeedChanged.getTime() > 5000) {
        console.log(new Date().getTime() - lastSpeedChanged.getTime());
        setLastSpeedChanged(new Date());
        if (isRunning && event.type === "btRunning") {
          const diff = targetHeartRate - heartRate;
          if (Math.abs(diff) > 5) {
            setTreadmillSpeed((oldSpeed) => {
              const newSpeed = Math.max(
                1,
                Math.min(18, Math.round((oldSpeed + diff / 100) * 10) / 10)
              );

              if (oldSpeed != newSpeed) {
                console.log("sending speed " + newSpeed);

                BleManager.sendIncAndSpeed(treadmillIncline, newSpeed);

                return newSpeed;
              }

              return oldSpeed;
            });
          }
        }
      }

      if (event.type === "btDisconnected" || event.type === "btStopped") {
        setIsRunning(false);
      }
    },
    [
      heartRate,
      isRunning,
      lastSpeedChanged,
      treadmillIncline,
      setLastSpeedChanged,
    ]
  );

  const runningLoop = useCallback(() => {
    if (isRunning) {
      //
      console.log("pętrla start " + new Date());
      const diff = targetHeartRate - heartRate;
      console.log("diff " + diff);
      if (Math.abs(diff) > 5) {
        setTreadmillSpeed((oldSpeed) => {
          const newSpeed = Math.max(
            1,
            Math.min(20, Math.round((oldSpeed + diff / 10) * 10) / 10)
          );

          if (oldSpeed != newSpeed) {
            BleManager.sendIncAndSpeed(treadmillIncline, newSpeed);
          }

          return newSpeed;
        });
      }
    }
  }, [heartRate, isRunning, targetHeartRate, treadmillIncline]);

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
  }, [onEventOccured, runningLoop]);

  async function startNew() {
    try {
      setIsRunning(true);
      setTreadmillSpeed(4);

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
            <Box>Heart rate: {heartRate}</Box>
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
