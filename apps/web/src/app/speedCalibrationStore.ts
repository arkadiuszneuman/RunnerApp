import {
  EMPTY_SPEED_CALIBRATION,
  learnSpeedCalibration,
  speedHintFor,
  type SpeedCalibration,
  type TelemetryPoint,
} from '@runner/core';

const STORAGE_PREFIX = 'runner.speedCalibration.';

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

function loadCalibration(): SpeedCalibration {
  const key = storageKey();
  if (!key) return EMPTY_SPEED_CALIBRATION;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY_SPEED_CALIBRATION;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as SpeedCalibration).points)
    ) {
      return EMPTY_SPEED_CALIBRATION;
    }
    return parsed as SpeedCalibration;
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
    // Storage unavailable (private mode, blocked, quota) — the learned calibration just won't persist.
  }
}

/** Whether the signed-in user has any calibration yet — checked before bothering to fetch past runs to seed one. */
export function needsSeed(): boolean {
  return loadCalibration().points.length === 0;
}

/**
 * The per-runner learned speed for `bpm`, or `undefined` with nothing close enough calibrated —
 * passed as RunSession's `speedHint` (see AdaptiveTraining.ts's ramp-to-hint behavior).
 */
export function speedHint(bpm: number): number | undefined {
  return speedHintFor(loadCalibration(), bpm);
}

/** Learns from a just-finished run and folds the result into the saved calibration. */
export function learnFromRun(telemetry: readonly TelemetryPoint[]): void {
  saveCalibration(learnSpeedCalibration([...telemetry], loadCalibration()));
}

/**
 * Seeds a fresh sign-in's calibration from past runs' telemetry, without clobbering anything
 * already learned (e.g. on another device, or from a run already recorded this session) — see
 * userData.ts's seedSpeedCalibrationFromHistory, which fetches the telemetry to pass here.
 */
export function seedFromRuns(telemetries: readonly (readonly TelemetryPoint[])[]): void {
  if (loadCalibration().points.length > 0) return;
  let calibration = EMPTY_SPEED_CALIBRATION;
  for (const telemetry of telemetries)
    calibration = learnSpeedCalibration([...telemetry], calibration);
  if (calibration.points.length > 0) saveCalibration(calibration);
}
