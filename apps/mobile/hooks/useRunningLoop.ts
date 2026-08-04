import { useInterval } from '@runner/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback } from 'react';
import TreadmillManager from '@/ble/treadmillManager';
import { runSession } from '@/runSession';

/**
 * Thin platform wrapper around the shared RunSession singleton (see
 * runSession.ts) — mirrors apps/web/src/app/useRunningLoop.ts. Owns
 * everything platform-specific: the 200ms pump timer, screen keep-awake, and
 * BLE connect/pairing before delegating to RunSession.start().
 *
 * Heart rate device connection is a stub until Phase 7 wires up a real (or
 * fake) BLE heart rate monitor — bmp-based stages simply won't get a PID
 * update without a heart rate reading, same as on web with no strap connected.
 */
export default function useRunningLoop() {
  useKeepAwake();

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
    // TODO(Phase 7): wire a real HeartRateMonitor (ble-plx transport).
    connectHeartRateMonitor: async () => {},
    heartRateConnected: () => false,
    wakeLock: {
      isWakeLockSupported: true,
      wakeLockStatus: 'requested' as const,
    },
  };
}
