import { useSyncExternalStore } from 'react';
import BleManager, { TREADMILL_STORAGE_KEY } from '../BleManager';
import HeartRateManager, { HEART_RATE_STORAGE_KEY } from '../HeartRateManager';
import { useRememberedDevice, type RememberedDevice } from './rememberedDevice';

// Both managers are module-level singletons for the app's lifetime (see BleManager.tsx /
// HeartRateManager.tsx), so a single subscription registered here at import time — rather
// than per-component in an effect — is enough to keep these mirrors in sync everywhere.

let treadmillConnected = BleManager.isConnected();
const treadmillListeners = new Set<() => void>();
BleManager.subscribe((event) => {
  if (event.type !== 'btConnected' && event.type !== 'btDisconnected') return;
  const next = event.type === 'btConnected';
  if (next === treadmillConnected) return;
  treadmillConnected = next;
  treadmillListeners.forEach((listener) => listener());
});

/** Live treadmill connection state, updating as BleManager emits btConnected/btDisconnected. */
export function useTreadmillConnected(): boolean {
  return useSyncExternalStore(
    (listener) => {
      treadmillListeners.add(listener);
      return () => treadmillListeners.delete(listener);
    },
    () => treadmillConnected,
    () => false
  );
}

let heartRateConnected = HeartRateManager.isConnected();
const heartRateListeners = new Set<() => void>();
HeartRateManager.onConnectionChange((connected) => {
  if (connected === heartRateConnected) return;
  heartRateConnected = connected;
  heartRateListeners.forEach((listener) => listener());
});

/** Live heart-rate monitor connection state, updating as HeartRateManager reports changes. */
export function useHeartRateConnected(): boolean {
  return useSyncExternalStore(
    (listener) => {
      heartRateListeners.add(listener);
      return () => heartRateListeners.delete(listener);
    },
    () => heartRateConnected,
    () => false
  );
}

export function useTreadmillRemembered(): RememberedDevice | null {
  return useRememberedDevice(TREADMILL_STORAGE_KEY);
}

export function useHeartRateRemembered(): RememberedDevice | null {
  return useRememberedDevice(HEART_RATE_STORAGE_KEY);
}
