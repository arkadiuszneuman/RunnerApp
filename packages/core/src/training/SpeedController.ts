import type { Stage } from '../services/stagesCalculator';
import AdaptiveTraining from './AdaptiveTraining';
import Training from './Training';

/**
 * - `legacy` — the original `Training` PID, unchanged.
 * - `adaptive` — `AdaptiveTraining`: filtered/predicted HR, IMC-tuned
 *   velocity-form PI, feedforward on target steps, slew limit and output
 *   hysteresis.
 */
export type SpeedControllerKind = 'legacy' | 'adaptive';

export const SPEED_CONTROLLER_KINDS: readonly SpeedControllerKind[] = ['legacy', 'adaptive'];

/** What RunSession needs from a heart-rate → treadmill-speed controller. */
export interface SpeedController {
  /**
   * One control step. `deltaTimeMs` is the time since the previous call in
   * milliseconds (RunSession ticks at 1 Hz, so 1000). Returns the speed to
   * command in km/h.
   */
  update(currentHeartRate: number, currentSection: Stage, deltaTimeMs: number): number;
  /** Jump the controller's internal speed to a known belt speed (manual override detected). */
  syncToSpeed(speed: number): void;
  /** Called on every control tick while the user holds a manual speed. */
  trackManualSpeed(actualSpeed: number): void;
  /** Populated after each bmp-stage update; null for tempo stages. */
  readonly lastState: { predictedHr: number; error: number } | null;
}

export function createSpeedController(kind: SpeedControllerKind, initialSpeed: number): SpeedController {
  return kind === 'adaptive' ? new AdaptiveTraining(initialSpeed) : new Training(initialSpeed);
}
