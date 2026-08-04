import { useCallback, useEffect, useState } from 'react';
import { useWakeLock } from 'react-screen-wake-lock';
import useInterval from '@/hooks/useInterval';
import BleManager from './BleManager';
import useHeartRate from './useHeartRate';
import { runSession } from './runSession';

/**
 * Thin platform wrapper around the shared RunSession singleton (see
 * runSession.ts): owns everything platform-specific — the 200ms pump timer,
 * screen wake lock, heart rate device connection, and BLE connect/pairing
 * before delegating to RunSession.start(). The PID loop, telemetry, manual-
 * override detection, and cooldown/stage logic all live in RunSession now.
 */
export default function useRunningLoop() {
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

  const heartRateMonitor = useHeartRate();

  useEffect(() => {
    if (wakeLockStatus !== 'requested') {
      requestWakeLock();
    }
  }, [requestWakeLock, wakeLockStatus]);

  useInterval({ interval: 200, loop: useCallback(() => runSession.pump(), []) });

  const start = useCallback(async () => {
    await BleManager.initBTConnection();
    if (!BleManager.isConnected()) return;
    await runSession.start();
  }, []);

  const stop = useCallback(async () => {
    await runSession.stop();
    await releaseWakeLock();
  }, [releaseWakeLock]);

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
      isWakeLockSupported,
      wakeLockStatus,
    },
  };
}
