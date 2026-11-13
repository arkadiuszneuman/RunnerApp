import { useCallback, useEffect, useState } from 'react';
import { useWakeLock } from 'react-screen-wake-lock';
import { useInterval } from '@runner/core';
import { useAtomValue } from 'jotai';
import { isRunningAtom, runningStateAtom } from './atoms';
import BleManager from './BleManager';
import { isChooserCancelled } from './ble/bluetoothAvailability';
import { useTreadmillConnected } from './ble/useDeviceConnection';
import { startRunBackground, stopRunBackground } from './nativeRunBackground';
import { runSession } from './runSession';
import { store } from './store';
import useHeartRate from './useHeartRate';

const RECONNECT_INTERVAL_MS = 10_000;

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

  // Losing the treadmill mid-run (switched off during a pause, out of range) only pauses the run
  // (see RunSession). Keep trying to get it back silently, so START on its console resumes the run
  // as soon as it's on again — Resume in the app reconnects by itself anyway.
  const running = useAtomValue(isRunningAtom);
  const treadmillConnected = useTreadmillConnected();
  useEffect(() => {
    if (!running || treadmillConnected || !BleManager.hasRemembered()) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      BleManager.connectRemembered()
        .catch(() => {})
        .finally(() => {
          if (!cancelled && !BleManager.isConnected()) {
            timeoutId = setTimeout(attempt, RECONNECT_INTERVAL_MS);
          }
        });
    };
    timeoutId = setTimeout(attempt, RECONNECT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [running, treadmillConnected]);

  const start = useCallback(async () => {
    try {
      await BleManager.connect();
    } catch (error) {
      if (!isChooserCancelled(error)) console.warn('Treadmill connection failed', error);
      return;
    }
    if (!BleManager.isConnected()) return;
    await startRunBackground();
    await runSession.start();
    // runSession.start() fails silently (empty program, treadmill not connected, etc.) and
    // never flips runningStateAtom to running — the runSession.ts subscription that clears the
    // foreground-service notification only fires on a running:true → false transition, so a
    // start that never actually started must be cleaned up here instead.
    if (!store.get(runningStateAtom).running) await stopRunBackground();
  }, []);

  const stop = useCallback(async () => {
    await runSession.stop();
    await releaseWakeLock();
    await stopRunBackground();
  }, [releaseWakeLock]);

  const pause = useCallback(() => runSession.pause(), []);
  const resume = useCallback(async () => {
    if (!BleManager.isConnected()) {
      try {
        await BleManager.connect();
      } catch (error) {
        if (!isChooserCancelled(error)) console.warn('Treadmill connection failed', error);
        return;
      }
    }
    await runSession.resume();
  }, []);
  const resetManualSpeed = useCallback(() => runSession.resetManualSpeed(), []);

  return {
    start,
    stop,
    pause,
    resume,
    resetManualSpeed,
    connectHeartRateMonitor: heartRateMonitor.connectHeartRate,
    heartRateConnected: heartRateMonitor.heartRateConnected,
    treadmillConnected,
    wakeLock: {
      isWakeLockSupported,
      wakeLockStatus,
    },
  };
}
