import useInterval from '@/hooks/useInterval';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { isPausedAtom, isRunningAtom, runningStartedDateAtom, runningStateAtom } from './atoms';
import { Timespan } from '@/services/Timespan';
import { useAtomValue } from 'jotai';

export default function useRunningStateLoop() {
  const isRunning = useAtomValue(isRunningAtom)
  const isPaused = useAtomValue(isPausedAtom)
  const runningStartedDate = useAtomValue(runningStartedDateAtom)
  const setRunningState = useSetAtom(runningStateAtom)

  useInterval({
    interval: 200, loop: useCallback(() => {
      if (isRunning && !isPaused && runningStartedDate) {
        const runningDateDiff = new Date().getTime() - runningStartedDate.getTime();
        const seconds = Math.max(0, Math.round(runningDateDiff / 1000));

        setRunningState(prev => {
          if (prev.running && prev.runningTime.totalSeconds !== seconds) {
            return {
              ...prev,
              runningTime: Timespan.fromSeconds(seconds)
            }
          }

          return prev
        })
      }
    }, [isRunning, isPaused, runningStartedDate, setRunningState])
  })
}
