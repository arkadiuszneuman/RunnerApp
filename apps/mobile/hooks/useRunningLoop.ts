import { useInterval } from '@runner/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback } from 'react';
import TreadmillManager from '@/ble/treadmillManager';
import { runSession } from '@/runSession';
import useHeartRate from './useHeartRate';

/**
 * Thin platform wrapper around the shared RunSession singleton (see
 * runSession.ts) — mirrors apps/web/src/app/useRunningLoop.ts. Owns
 * everything platform-specific: the 200ms pump timer, screen keep-awake,
 * heart rate device connection, and BLE connect/pairing before delegating to
 * RunSession.start().
 */
export default function useRunningLoop() {
  useKeepAwake();

  const heartRateMonitor = useHeartRate();

  useInterval({ interval: 200, loop: useCallback(() => runSession.pump(), []) });

  const start = useCallback(async () => {
    await TreadmillManager.initBTConnection();
    if (!TreadmillManager.isConnected()) return;
    await runSession.start();
  }, []);

  const stop = useCallback(() => runSession.stop(), []);
  const pause = useCallback(() => runSession.pause(), []);
  const resume = useCallback(() => runSession.resume(), []);
  const resetManualSpeed = useCallback(() => runSession.resetManualSpeed(), []);

  return {
    start,
    stop,
    pause,
    resume,
    resetManualSpeed,
    connectHeartRateMonitor: heartRateMonitor.connectHeartRate,
    heartRateConnected: heartRateMonitor.heartRateConnected,
    wakeLock: {
      isWakeLockSupported: true,
      wakeLockStatus: 'requested' as const,
    },
  };
}
