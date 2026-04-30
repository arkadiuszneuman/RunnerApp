import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualTreadmillSpeedAtom,
  currentStageAtom,
  currentStageIndexAtom,
  heartRateAtom,
  programAtom,
  programCooldownAtom,
  runningStateAtom,
  runningTimeAtom,
  stagesAtom,
  treadmillOptionsAtom,
} from './atoms';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';import useRunningStateLoop from './useRunningStateLoop';
import { useWakeLock } from 'react-screen-wake-lock';
import axios from 'axios';
import BleManager, { TreadmillEvent } from './BleManager';
import { Timespan } from '@/services/Timespan';
import useHeartRate from './useHeartRate';
import Training from './Training';
import type { TelemetryPoint } from '@/types/telemetry';

const lastSpeedChangedDateAtom = atom(0);

export default function useRunningLoop() {
  const runningTime = useAtomValue(runningTimeAtom);
  const stages = useAtomValue(stagesAtom);
  const currentStage = useAtomValue(currentStageAtom);
  const currentStageIndex = useAtomValue(currentStageIndexAtom);
  const [lastStageIndex, setLastStageIndex] = useState<number | undefined>();
  const heartRate = useAtomValue(heartRateAtom);
  const treadmillOptions = useAtomValue(treadmillOptionsAtom);
  const [lastSpeedChangedDate, setLastSpeedChangedDateAtom] = useAtom(lastSpeedChangedDateAtom);
  const [runningState, setRunningState] = useAtom(runningStateAtom);
  const program = useAtomValue(programAtom);
  const programCooldown = useAtomValue(programCooldownAtom);
  const [cooldownInitialized, setCooldownInitialized] = useState(false);
  const [wakeLockStatus, setWakeLockStatus] = useState<
    'connecting' | 'requested' | 'released' | 'error'
  >('connecting');

  const {
    isSupported: isWakeLockSupported,
    request: requestWakeLock,
    release: releaseWakeLock,
  } = useWakeLock({
    reacquireOnPageVisible: true,
    onRequest: () => setWakeLockStatus('requested'),
    onRelease: () => setWakeLockStatus('released'),
    onError: (error) => {
      console.log('Wake lock error', error);
      setWakeLockStatus('error');
    },
  });

  const training = useRef(new Training(1));

  // Manual speed override detection
  const lastCommandedSpeedRef = useRef<number>(0);
  const consecutiveDivergentCountRef = useRef<number>(0);
  const setActualTreadmillSpeed = useSetAtom(actualTreadmillSpeedAtom);

  // Telemetry state
  const runIdRef = useRef<string | null>(null);
  const telemetryRef = useRef<TelemetryPoint[]>([]);
  const lastTelemetryPointRef = useRef<Omit<TelemetryPoint, 't'> | null>(null);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useRunningStateLoop();
  const heartRateMonitor = useHeartRate();

  useEffect(() => {
    if (wakeLockStatus !== 'requested') {
      requestWakeLock();
    }
  }, [requestWakeLock, wakeLockStatus]);

  const flushTelemetry = useCallback(
    (extra?: { finishedAt?: string; durationMs?: number }) => {
      if (!runIdRef.current || !runningState.running) return;
      const payload = {
        startedAt: runningState.runningStartedDate.toISOString(),
        telemetry: telemetryRef.current,
        ...extra,
      };
      axios.patch(`/api/runs/${runIdRef.current}`, payload).catch(() => {});
    },
    [runningState]
  );

  const stop = useCallback(async () => {
    if (runningState.running) {
      const finishedAt = new Date().toISOString();
      const durationMs = runningState.runningTime.totalMilliseconds;
      flushTelemetry({ finishedAt, durationMs });
    }

    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    await BleManager.stop();
    setRunningState({ running: false });
    await releaseWakeLock();
  }, [runningState, flushTelemetry, setRunningState, releaseWakeLock]);

  const pause = useCallback(async () => {
    flushTelemetry();
    await BleManager.stop();
    setRunningState((prev) => {
      if (prev.running) {
        return {
          ...prev,
          paused: true,
          pauseStartedDate: new Date(),
        };
      }
      return prev;
    });
  }, [flushTelemetry, setRunningState]);

  const resume = useCallback(async () => {
    await BleManager.start();
    setRunningState((prev) => {
      if (prev.running && prev.paused && prev.pauseStartedDate) {
        const pauseDuration = Date.now() - prev.pauseStartedDate.getTime();
        const newStartedDate = new Date(prev.runningStartedDate.getTime() + pauseDuration);
        return {
          ...prev,
          paused: false,
          pauseStartedDate: undefined,
          runningStartedDate: newStartedDate,
          treadmillOptions: {
            ...prev.treadmillOptions,
            isManualSpeedActive: false,
          },
        };
      }
      return prev;
    });
  }, [setRunningState]);

  const resetManualSpeed = useCallback(() => {
    consecutiveDivergentCountRef.current = 0;
    setRunningState((prev) => {
      if (prev.running && prev.treadmillOptions.isManualSpeedActive) {
        return {
          ...prev,
          treadmillOptions: {
            ...prev.treadmillOptions,
            isManualSpeedActive: false,
          },
        };
      }
      return prev;
    });
  }, [setRunningState]);

  useEffect(() => {
    if (runningTime && BleManager.isRunning()) {
      if (runningTime.totalMilliseconds >= stages[stages.length - 1].to.totalMilliseconds) {
        if (programCooldown) {
          if (!cooldownInitialized) {
            setRunningState((prev) => {
              if (prev.running) {
                return {
                  ...prev,
                  treadmillOptions: {
                    ...prev.treadmillOptions,
                    isCustomSpeedUsed: true,
                    speed: 4,
                    incline: 0,
                  },
                };
              }

              return prev;
            });
            setCooldownInitialized(true);
          }
        } else {
          stop();
        }
      }

      if (currentStage) {
        if (lastStageIndex === undefined || currentStageIndex !== lastStageIndex) {
          if (treadmillOptions?.isCustomSpeedUsed) {
            setRunningState((prev) => {
              if (prev.running) {
                return {
                  ...prev,
                  treadmillOptions: {
                    ...prev.treadmillOptions,
                    isCustomSpeedUsed: false,
                  },
                };
              }

              return prev;
            });
          }
          setLastStageIndex(currentStageIndex);
        }
        if (Date.now() - lastSpeedChangedDate >= 1000) {
          setLastSpeedChangedDateAtom(Date.now());

          if (heartRate !== undefined) {
            const newSpeed = training.current.update(heartRate, currentStage, 1000);

            setRunningState((prev) => {
              if (prev.running) {
                return {
                  ...prev,
                  treadmillOptions: {
                    ...prev.treadmillOptions,
                    speed: newSpeed,
                  },
                };
              }

              return prev;
            });

            // Record telemetry point — only when values change
            const elapsedS = Math.floor(runningTime.totalMilliseconds / 1000);
            const thr = currentStage.speedType === 'bmp' ? currentStage.bmp : 0;
            const phr = training.current.lastState?.predictedHr ?? 0;
            const err = training.current.lastState?.error ?? 0;
            const point: Omit<TelemetryPoint, 't'> = {
              hr: heartRate,
              thr,
              phr,
              spd: newSpeed,
              inc: treadmillOptions?.incline ?? 0,
              si: currentStageIndex ?? 0,
              err,
            };
            const last = lastTelemetryPointRef.current;
            if (
              !last ||
              last.hr !== point.hr ||
              last.thr !== point.thr ||
              last.phr !== point.phr ||
              last.spd !== point.spd ||
              last.inc !== point.inc ||
              last.si !== point.si
            ) {
              telemetryRef.current.push({ t: elapsedS, ...point });
              lastTelemetryPointRef.current = point;
            }
          }

          // setRunningState((prev) => {
          //   if (prev.running) {
          //     const oldSpeed = prev.treadmillOptions.speed
          //     const oldState = prev
          //     let newSpeed = oldSpeed;
          //     if ('bmp' in currentStage) {
          //       if (heartRate !== undefined) {
          //         const targetHeartRate = currentStage.bmp;
          //         newSpeed = calculateSpeedByHeartRate(heartRate, targetHeartRate, oldSpeed);
          //       }
          //     } else {
          //       newSpeed = calculateSpeedByTempo(currentStage.tempo);
          //     }
          //     if (oldSpeed != newSpeed) {
          //       return {
          //         ...oldState, treadmillOptions: {
          //           ...oldState.treadmillOptions,
          //           speed: newSpeed
          //         }
          //       }
          //     }

          //     return prev;
          //   }

          //   return prev
          // });
        }
      }
    }
  }, [
    currentStage,
    heartRate,
    currentStageIndex,
    lastStageIndex,
    lastSpeedChangedDate,
    runningTime,
    setLastSpeedChangedDateAtom,
    setRunningState,
    stages,
    stop,
    treadmillOptions,
  ]);

  useEffect(() => {
    if (!BleManager.isConnected() || !treadmillOptions) {
      return;
    }

    // Don't override the user's manual speed — let the treadmill maintain it.
    if (treadmillOptions.isManualSpeedActive) {
      return;
    }

    lastCommandedSpeedRef.current = treadmillOptions.speed;
    consecutiveDivergentCountRef.current = 0;
    BleManager.sendIncAndSpeed(treadmillOptions?.incline, treadmillOptions?.speed);
  }, [treadmillOptions]);

  const onEventOccured = useCallback(
    (event: TreadmillEvent) => {
      if (event.type === 'btDisconnected' || event.type === 'btStopped') {
        setRunningState((prev) => {
          if (prev.running && prev.paused && event.type === 'btStopped') {
            return prev;
          }
          return {
            running: false,
          };
        });
      }

      if (event.type === 'btRunning') {
        const treadmillSpeed = event.state.currentSpeed;
        setActualTreadmillSpeed(treadmillSpeed);

        // Detect manual speed override: if the treadmill reports a speed significantly
        // different from what the app last commanded for 3+ consecutive readings, the
        // user has manually overridden speed on the treadmill.
        setRunningState((prev) => {
          if (!prev.running || prev.treadmillOptions.isManualSpeedActive) {
            consecutiveDivergentCountRef.current = 0;
            return prev;
          }

          const diff = Math.abs(treadmillSpeed - lastCommandedSpeedRef.current);
          if (diff > 0.5) {
            consecutiveDivergentCountRef.current++;
            if (consecutiveDivergentCountRef.current >= 3) {
              consecutiveDivergentCountRef.current = 0;
              training.current.syncToSpeed(treadmillSpeed);
              return {
                ...prev,
                treadmillOptions: {
                  ...prev.treadmillOptions,
                  isManualSpeedActive: true,
                },
              };
            }
          } else {
            consecutiveDivergentCountRef.current = 0;
          }

          return prev;
        });
      }
    },
    [setRunningState, setActualTreadmillSpeed],
  );

  useEffect(() => {
    const removeEvent = BleManager.subscribe(onEventOccured);
    return () => removeEvent();
  }, [onEventOccured]);

  return {
    start: async () => {
      try {
        await BleManager.initBTConnection();
        if (!BleManager.isConnected()) {
          return;
        }

        await BleManager.start();
        BleManager.sendIncAndSpeed(2, 4);

        setCooldownInitialized(false);
        training.current = new Training(4);

        // Reset telemetry state for the new run
        telemetryRef.current = [];
        lastTelemetryPointRef.current = null;
        runIdRef.current = null;

        const startedAt = new Date(Date.now() + 3000).toISOString();

        // Create run record immediately so data is saved even if run is stopped early
        axios
          .post('/api/runs', { startedAt })
          .then(({ data }) => {
            runIdRef.current = data.id;

            // Flush telemetry every 30 seconds
            flushIntervalRef.current = setInterval(() => {
              flushTelemetry();
            }, 30_000);
          })
          .catch(() => {});

        setRunningState((prev) => ({
          ...prev,
          running: true,
          paused: false,
          runningStartedDate: new Date(Date.now() + 3000),
          runningTime: new Timespan(),
          treadmillOptions: {
            incline: 2,
            speed: 1,
            isCustomSpeedUsed: false,
            isManualSpeedActive: false,
          },
        }));
      } catch {
        setRunningState({
          running: false,
        });
      }
    },
    stop: stop,
    pause: pause,
    resume: resume,
    resetManualSpeed,
    connectHeartRateMonitor: heartRateMonitor.connectHeartRate,
    heartRateConnected: heartRateMonitor.heartRateConnected,
    wakeLock: {
      isWakeLockSupported,
      wakeLockStatus,
    },
  };
}
