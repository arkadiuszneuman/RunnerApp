import { heartRateAtom } from '@runner/core';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import HeartRateManager from '@/ble/heartRateManager';

export default function useHeartRate() {
  const setHeartRate = useSetAtom(heartRateAtom);

  useEffect(() => {
    const removeHeartRateEvent = HeartRateManager.subscribe((heartRateData) =>
      setHeartRate(heartRateData.heartRate)
    );
    return () => {
      setHeartRate(undefined);
      removeHeartRateEvent();
    };
  }, [setHeartRate]);

  return {
    connectHeartRate: async () => {
      await HeartRateManager.requestDevice();
    },
    heartRateConnected: () => HeartRateManager.isConnected(),
  };
}
