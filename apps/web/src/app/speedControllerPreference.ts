import { useEffect } from 'react';
import { SPEED_CONTROLLER_KINDS, type SpeedControllerKind } from '@runner/core';
import { useSetAtom } from 'jotai';
import { speedControllerAtom } from './atoms';

const STORAGE_KEY = 'runner.speedController';

/**
 * The speed-controller toggle is a per-device testing switch, so it lives in
 * localStorage rather than user_settings (whose PUT replaces the whole JSONB
 * blob and would need every writer to carry it along).
 */
export function saveSpeedControllerPreference(kind: SpeedControllerKind): void {
  try {
    localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    // Storage unavailable (private mode, blocked) — the choice just won't persist.
  }
}

/** Restores the saved choice into speedControllerAtom once, on mount. */
export function useLoadSpeedControllerPreference(): void {
  const setController = useSetAtom(speedControllerAtom);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const kind = SPEED_CONTROLLER_KINDS.find((k) => k === saved);
      if (kind) setController(kind);
    } catch {
      // Storage unavailable — keep the default.
    }
  }, [setController]);
}
