import { useCallback, useEffect, useRef, useState } from 'react';
import { currentStageAtom, currentStageIndexAtom, heartRateAtom, runningStateAtom, runningTimeAtom, stagesAtom, treadmillOptionsAtom } from './atoms';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import useRunningStateLoop from './useRunningStateLoop';
import { useWakeLock } from 'react-screen-wake-lock';
import BleManager, { TreadmillEvent } from './BleManager';
import { Timespan } from '@/services/Timespan';
import useHeartRate from './useHeartRate';
import Training from './Training';

const lastSpeedChangedDateAtom = atom(0)

export default function useRunningLoop() {
  const runningTime = useAtomValue(runningTimeAtom)
  const stages = useAtomValue(stagesAtom)
  const currentStage = useAtomValue(currentStageAtom)
  const currentStageIndex = useAtomValue(currentStageIndexAtom)
  const [lastStageIndex, setLastStageIndex] = useState<number | undefined>()
  const heartRate = useAtomValue(heartRateAtom)
  const treadmillOptions = useAtomValue(treadmillOptionsAtom)
  const [lastSpeedChangedDate, setLastSpeedChangedDateAtom] = useAtom(lastSpeedChangedDateAtom)
  const setRunningState = useSetAtom(runningStateAtom)
  const wakeLock = useWakeLock();
  const training = useRef(new Training(1));

  useRunningStateLoop()
  const heartRateMonitor = useHeartRate()

  const stop = useCallback(async () => {
    await BleManager.stop();
    setRunningState({
      running: false,
    });
    await wakeLock.release();
  }, [setRunningState, wakeLock])

  useEffect(() => {
    if (runningTime && BleManager.isRunning()) {
      if (runningTime.totalMilliseconds >= stages[stages.length - 1].to.totalMilliseconds) {
        stop();
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
                    isCustomSpeedUsed: false
                  }
                }
              }

              return prev
            });
          }
          setLastStageIndex(currentStageIndex);
        }
        if (new Date().getTime() - lastSpeedChangedDate >= 1000) {
          setLastSpeedChangedDateAtom(new Date().getTime());

          if (heartRate !== undefined) {
            const newSpeed = training.current.update(heartRate, currentStage, 1000);

            setRunningState((prev) => {
              if (prev.running) {
                return {
                  ...prev,
                  treadmillOptions: {
                    ...prev.treadmillOptions,
                    speed: newSpeed
                  }
                }
              }

              return prev
            });
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
  }, [currentStage, heartRate, currentStageIndex, lastStageIndex, lastSpeedChangedDate, runningTime, setLastSpeedChangedDateAtom, setRunningState, stages, stop, treadmillOptions])

  useEffect(() => {
    if (!BleManager.isConnected() || !treadmillOptions) {
      return;
    }

    BleManager.sendIncAndSpeed(treadmillOptions?.incline, treadmillOptions?.speed);
  }, [treadmillOptions])

  const onEventOccured = useCallback(
    (event: TreadmillEvent) => {
      if (event.type === 'btDisconnected' || event.type === 'btStopped') {
        setRunningState({
          running: false,
        });
      }

      if (event.type === 'btRunning' && event.state.currentSpeed !== treadmillOptions?.speed) {
        setRunningState((prev) => {
          if (prev.running) {
            return {
              ...prev,
              treadmillOptions: {
                ...prev.treadmillOptions,
                speed: event.state.currentSpeed,
                isCustomSpeedUsed: true
              }
            }
          }

          return prev
        })
      }
    },
    [treadmillOptions, setRunningState]
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

        training.current = new Training(4);

        setRunningState((prev) => ({
          ...prev,
          running: true,
          runningStartedDate: new Date(new Date().getTime() + 3000),
          runningTime: new Timespan(),
          treadmillOptions: {
            incline: 2,
            speed: 1,
            isCustomSpeedUsed: false
          }
        }));

        await wakeLock.request();
      } catch {
        setRunningState({
          running: false,
        });
      }
    },
    stop: stop,
    connectHeartRateMonitor: heartRateMonitor.connectHeartRate,
    heartRateConnected: heartRateMonitor.heartRateConnected
  }
}
