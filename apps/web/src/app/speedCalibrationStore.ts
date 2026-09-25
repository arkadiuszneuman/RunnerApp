import {
  EMPTY_SPEED_CALIBRATION,
  learnSpeedCalibration,
  mergeSpeedCalibrations,
  parseSpeedCalibration,
  speedHintFor,
  type SpeedCalibration,
  type TelemetryPoint,
} from '@runner/core';

const STORAGE_PREFIX = 'runner.speedCalibration.';

/**
 * The per-runner speed calibration's *device cache*. The source of truth is the user's
 * `user_settings` row on the server (see userData.ts's syncSpeedCalibration and
 * offline/requests.ts's setSpeedCalibration), so it follows the runner across devices and
 * survives clearing app data. It is cached here because `speedHint` is read synchronously in the
 * middle of a run, which must work offline and can't wait on the network.
 *
 * Every function that changes the calibration returns the resulting value so the caller can
 * queue it for the server — this module stays free of network/outbox concerns.
 */

/**
 * The signed-in user's id, as tracked by useOfflineSync's setSyncUser (see setUser below) — this
 * module has no React context of its own, since it's read from runSession.ts's module-level
 * RunSession instance, not a component.
 */
let userId: string | null = null;

/** Call alongside offline/sync.ts's setSyncUser — same login/logout lifecycle, same user id. */
export function setUser(id: string | null): void {
  userId = id;
}

function storageKey(): string | null {
  return userId ? `${STORAGE_PREFIX}${userId}` : null;
}

/** The cached calibration for the signed-in user (empty when none, corrupted, or signed out). */
export function currentCalibration(): SpeedCalibration {
  const key = storageKey();
  if (!key) return EMPTY_SPEED_CALIBRATION;
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseSpeedCalibration(JSON.parse(raw)) : EMPTY_SPEED_CALIBRATION;
  } catch {
    return EMPTY_SPEED_CALIBRATION;
  }
}

function saveCalibration(calibration: SpeedCalibration): void {
  const key = storageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(calibration));
  } catch {
    // Storage unavailable (private mode, blocked, quota) — the cache just won't persist; the
    // server copy (queued by the caller) still does.
  }
}

/** Whether there's any calibration yet — checked before bothering to fetch past runs to seed one. */
export function needsSeed(): boolean {
  return currentCalibration().points.length === 0;
}

/**
 * The per-runner learned speed for `bpm`, or `undefined` with nothing close enough calibrated —
 * passed as RunSession's `speedHint` (see AdaptiveTraining.ts's ramp-to-hint behavior).
 */
export function speedHint(bpm: number): number | undefined {
  return speedHintFor(currentCalibration(), bpm);
}

/** Learns from a just-finished run; returns the updated calibration to persist. */
export function learnFromRun(telemetry: readonly TelemetryPoint[]): SpeedCalibration {
  const updated = learnSpeedCalibration([...telemetry], currentCalibration());
  saveCalibration(updated);
  return updated;
}

/**
 * Folds the server's copy into the cache (newest point per target wins, so a run learned offline
 * or on another device isn't lost); returns the merged result, which may hold points the server
 * doesn't have yet.
 */
export function mergeServerCalibration(server: SpeedCalibration): SpeedCalibration {
  const merged = mergeSpeedCalibrations(currentCalibration(), server);
  saveCalibration(merged);
  return merged;
}

/**
 * Backfills from past runs' telemetry when nothing is calibrated yet (an account that
 * predates this feature) — see userData.ts's syncSpeedCalibration, which fetches the telemetry.
 * Never clobbers an existing calibration; returns the resulting one.
 */
export function seedFromRuns(
  telemetries: readonly (readonly TelemetryPoint[])[]
): SpeedCalibration {
  if (!needsSeed()) return currentCalibration();
  let calibration = EMPTY_SPEED_CALIBRATION;
  for (const telemetry of telemetries)
    calibration = learnSpeedCalibration([...telemetry], calibration);
  if (calibration.points.length > 0) saveCalibration(calibration);
  return calibration;
}
