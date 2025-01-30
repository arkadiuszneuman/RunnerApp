import { useCallback, useEffect, useRef } from 'react';
import { currentStageAtom, heartRateAtom, runningStateAtom, runningTimeAtom, treadmillOptionsAtom } from './atoms';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import useRunningStateLoop from './useRunningStateLoop';
import { useWakeLock } from 'react-screen-wake-lock';
import BleManager, { TreadmillEvent } from './BleManager';
import { Timespan } from '@/services/Timespan';
import { calculateSpeedByHeartRate, calculateSpeedByTempo } from './speedCalculator';
import useHeartRate from './useHeartRate';
import Training from './Training';

const lastSpeedChangedDateAtom = atom(0)

export default function useRunningLoop() {
  const runningTime = useAtomValue(runningTimeAtom)
  const currentStage = useAtomValue(currentStageAtom)
  const heartRate = useAtomValue(heartRateAtom)
  const treadmillOptions = useAtomValue(treadmillOptionsAtom)
  const [lastSpeedChangedDate, setLastSpeedChangedDateAtom] = useAtom(lastSpeedChangedDateAtom)
  const setRunningState = useSetAtom(runningStateAtom)
  const wakeLock = useWakeLock();
  const training = useRef(new Training(1));

  useRunningStateLoop()
  const heartRateMonitor = useHeartRate()

  useEffect(() => {
    if (runningTime && BleManager.isRunning()) {
      if (currentStage) {
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
  }, [currentStage, heartRate, lastSpeedChangedDate, runningTime, setLastSpeedChangedDateAtom, setRunningState])

  useEffect(() => {
    console.log('in useRunningLoop useEffect');
    if (!BleManager.isConnected() || !treadmillOptions) {
      return;
    }

    console.log('sending speed ' + treadmillOptions?.speed);
    BleManager.sendIncAndSpeed(treadmillOptions?.incline, treadmillOptions?.speed);
  }, [treadmillOptions])

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
            incline: 0,
            speed: 1
          }
        }));

        await wakeLock.request();
      } catch {
        setRunningState({
          running: false,
        });
      }
    },
    stop: async () => {
      await BleManager.stop();
      setRunningState({
        running: false,
      });
      await wakeLock.release();
    },
    connectHeartRateMonitor: heartRateMonitor.connectHeartRate
  }
}
