import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { heartRateAtom } from './atoms';
import HeartRateManager from './HeartRateManager';

export default function useHeartRate() {
  const setHeartRate = useSetAtom(heartRateAtom);

  useEffect(() => {
    const removeHeartRateEvent = HeartRateManager.subscribe((heartRateData) =>
      setHeartRate(heartRateData.heartRate)
    );
    return () => {
      setHeartRate(undefined)
      removeHeartRateEvent();
    };
  }, [setHeartRate]);

  return {
    connectHeartRate: async () => {
      await HeartRateManager.requestDevice();
    }
  }
}
