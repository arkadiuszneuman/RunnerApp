import { calculateSpeedByTempo } from '../services/speedCalculator';
import type { Stage } from '../services/stagesCalculator';
import type { SpeedController } from './SpeedController';

export interface AdaptiveTrainingOptions {
  /** Steady-state heart-rate rise per km/h of belt speed (process gain), bpm per km/h. */
  hrPerKmh?: number;
  /** Dominant time constant of the HR response to a speed change, seconds. */
  timeConstantS?: number;
  /** Sensor + physiological dead time, seconds. */
  deadTimeS?: number;
  /** Desired closed-loop time constant (IMC lambda), seconds — larger is calmer, smaller is snappier. */
  closedLoopS?: number;
  /** Errors smaller than this don't feed the integral term, so the belt holds still near target. */
  deadbandBpm?: number;
  /** Maximum speed change per second from the feedback terms, km/h per second. */
  maxAccelKmhPerS?: number;
  minSpeed?: number;
  maxSpeed?: number;
  /**
   * Looked up whenever a bmp target is (re-)entered — including the very first stage of a run —
   * to seed the ramp target with a speed known (from past runs at this heart rate, via
   * `learnSpeedCalibration`) to actually hold it for *this* runner, instead of relying purely on
   * `hrPerKmh`'s generic assumption. See HINT_ACCEL_SHARE below for why this beats a bigger
   * single-tick feedforward jump.
   */
  speedHint?: (bpm: number) => number | undefined;
}

const DEFAULTS: Required<AdaptiveTrainingOptions> = {
  hrPerKmh: 9,
  timeConstantS: 35,
  deadTimeS: 8,
  closedLoopS: 45,
  deadbandBpm: 2,
  maxAccelKmhPerS: 0.3,
  minSpeed: 1,
  maxSpeed: 18,
  speedHint: () => undefined,
};

/** Low-pass time constant applied to the raw (integer, noisy) HR reading. */
const HR_FILTER_TAU_S = 4;
/** Window for the least-squares HR trend. */
const TREND_WINDOW_S = 15;
/** How far ahead the trend is projected — roughly dead time plus half the time constant. */
const PREDICTION_HORIZON_S = 20;
/** Share of the model-predicted speed step ramped to when the HR target rises. */
const FEEDFORWARD_SHARE = 0.8;
/**
 * Same, when the HR target falls. Above 1 on purpose: slowing down too far is harmless, and heart
 * rate after a hard stage needs a much bigger speed drop than `hrPerKmh` suggests (fatigue and
 * heat keep it up).
 */
const FEEDFORWARD_SHARE_DOWN = 1.5;
/** Integral gain multiplier while heart rate is still far from a newly changed target. */
const TRANSITION_INTEGRAL_BOOST = 3;
/** A target change counts as finished once the predicted error is within this many bpm. */
const TRANSITION_BAND_BPM = 5;
/**
 * After a pause the run resumes at the speed held before it, and heart rate climbs back on its
 * own: for up to this long, while the predicted heart rate is still more than TRANSITION_BAND_BPM
 * below target, feedback leaves the speed alone. Speeding up would only overshoot once heart rate
 * caught up, and the proportional term would slow the belt down just because heart rate is rising
 * fast. A heart rate at or above target ends the hold at once, so slowing down still works.
 */
const RESUME_HOLD_S = 90;
/** The commanded (0.1 km/h-quantized) speed only moves once the internal speed drifts this far from it. */
const OUTPUT_HYSTERESIS_KMH = 0.15;
/**
 * When a speed hint is above the current speed (we need to speed up), the ramp only targets this
 * share of it — leaving the PI loop to close the last bit itself — rather than the full hint,
 * since the hint is itself only an estimate (subject to the same drift/day-to-day variation the
 * PI loop already exists to correct for). No such caution when the hint is below the current
 * speed: overshooting downward just means starting a bit high, not overexerting.
 */
const HINT_ACCEL_SHARE = 0.9;

/**
 * Heart-rate → treadmill-speed controller, the successor to `Training`.
 *
 * - HR is low-pass filtered, and its trend is a least-squares slope over the
 *   last ~15 s instead of a 1-sample difference, so the ~20 s look-ahead
 *   prediction doesn't amplify sensor noise.
 * - Velocity-form PI: each step changes the speed by
 *   `kp·Δerror + ki·error·dt`. Gains come from IMC/lambda tuning of a
 *   first-order-plus-dead-time HR model, so they're expressed in physical
 *   terms (see AdaptiveTrainingOptions) rather than hand-picked constants.
 *   The velocity form has no integral state to wind up, and the error step
 *   at a stage change doesn't kick the output.
 * - When the HR target changes mid-run, the speed ramps toward what the current
 *   heart-rate error calls for (feedforward) instead of waiting for the error to
 *   build up, and the integral term runs faster until heart rate gets close. A
 *   speed hint can only push that ramp further in the direction of the change.
 * - Feedback changes are slew-limited, and the 0.1 km/h rounding is applied
 *   only to the output (with hysteresis), never to the internal state — so
 *   small corrections accumulate instead of being rounded away, and noise
 *   doesn't chatter the belt.
 * - When a `speedHint` (a per-runner calibrated speed for this bpm — see
 *   speedCalibration.ts) is available on the first stage or after a tempo
 *   stage, it drives the initial approach instead of the generic hrPerKmh
 *   feedforward: the speed ramps, at the same slew limit, toward the hint (see
 *   HINT_ACCEL_SHARE), and the PI loop takes over from there.
 *
 * `deltaTimeMs` is in milliseconds, matching how RunSession calls it.
 */
export default class AdaptiveTraining implements SpeedController {
  public lastState: { predictedHr: number; error: number } | null = null;

  private readonly opts: Required<AdaptiveTrainingOptions>;
  private readonly kp: number;
  private readonly ki: number;

  /** Continuous internal speed command. */
  private speed: number;
  /** Last quantized speed returned to the caller. */
  private output: number;
  private filteredHr: number | undefined;
  private trendWindow: number[] = [];
  private lastError = 0;
  private lastBpmTarget: number | undefined;
  private previousWasTempo = false;
  /** Set on a (re-)entered bmp target when a speed hint applies; cleared once reached or interrupted. */
  private rampTarget: number | undefined;
  /** Sign of a target change still being approached (boosts the integral term); 0 when none is. */
  private transitionDirection = 0;
  /** The belt is under manual control this tick, so a target change has to wait for its release. */
  private manualThisTick = false;
  /** Seconds left in which feedback may not speed up after resumeAt; 0 when not holding. */
  private resumeHoldS = 0;
  /** The next error is the baseline for the proportional term, not a step from the last one. */
  private errorBaselinePending = false;

  constructor(initialSpeed: number, options: AdaptiveTrainingOptions = {}) {
    // Spreading `options` over DEFAULTS would let an explicit `speedHint: undefined` (e.g. a
    // caller forwarding an optional prop as-is, like createSpeedController does) overwrite
    // DEFAULTS' no-op fallback with `undefined` itself, since spread copies own keys regardless
    // of value — `speedHint` is merged separately to guard against that.
    this.opts = { ...DEFAULTS, ...options, speedHint: options.speedHint ?? DEFAULTS.speedHint };
    const { hrPerKmh, timeConstantS, deadTimeS, closedLoopS } = this.opts;
    this.kp = timeConstantS / (hrPerKmh * (closedLoopS + deadTimeS));
    this.ki = this.kp / timeConstantS;
    this.speed = this.clamp(initialSpeed);
    this.output = this.speed;
  }

  public syncToSpeed(speed: number): void {
    this.speed = this.clamp(speed);
    this.output = Math.round(this.speed * 10) / 10;
    this.rampTarget = undefined;
    this.transitionDirection = 0;
  }

  public trackManualSpeed(actualSpeed: number): void {
    this.syncToSpeed(actualSpeed);
    this.manualThisTick = true;
  }

  /**
   * Picks up after a pause: at the belt speed held before it, with heart-rate history from before
   * the pause dropped (a stale trend would drive the first predictions), holding the speed while
   * heart rate climbs back.
   */
  public resumeAt(speed: number): void {
    this.syncToSpeed(speed);
    this.filteredHr = undefined;
    this.trendWindow = [];
    this.resumeHoldS = RESUME_HOLD_S;
    this.errorBaselinePending = true;
  }

  public update(currentHeartRate: number, currentSection: Stage, deltaTimeMs: number): number {
    const dt = deltaTimeMs / 1000;
    const manual = this.manualThisTick;
    this.manualThisTick = false;

    // Keep the filter and trend warm through tempo stages too (when a sensor
    // is connected), so returning to an HR stage doesn't start from stale data.
    if (currentHeartRate > 0) this.observeHeartRate(currentHeartRate, dt);

    if (currentSection.speedType === 'tempo') {
      this.lastState = null;
      this.previousWasTempo = true;
      return calculateSpeedByTempo(currentSection.tempo);
    }

    if (this.filteredHr === undefined) {
      this.lastState = null;
      return this.output;
    }

    const predictedHr = this.filteredHr + this.trendBpmPerS(dt) * PREDICTION_HORIZON_S;
    const error = currentSection.bmp - predictedHr;
    if (this.errorBaselinePending) {
      this.lastError = error;
      this.errorBaselinePending = false;
    }
    if (this.resumeHoldS > 0) {
      this.resumeHoldS = error <= TRANSITION_BAND_BPM ? 0 : Math.max(0, this.resumeHoldS - dt);
    }

    // A change made while the belt is under manual control waits for the release: the ramp would
    // be wiped by the next tick's sync, and the change would be lost for the rest of the stage.
    const targetChanged = this.lastBpmTarget !== currentSection.bmp;
    if (!manual && (targetChanged || this.previousWasTempo)) {
      this.enterTarget(currentSection.bmp, targetChanged);
      this.lastBpmTarget = currentSection.bmp;
      this.lastError = error; // no proportional kick from the target step itself
      this.previousWasTempo = false;
    }

    if (this.transitionDirection !== 0 && error * this.transitionDirection <= TRANSITION_BAND_BPM) {
      this.transitionDirection = 0;
    }
    const ki = this.transitionDirection !== 0 ? this.ki * TRANSITION_INTEGRAL_BOOST : this.ki;
    const integralError = Math.abs(error) < this.opts.deadbandBpm ? 0 : error;
    const maxStep = this.opts.maxAccelKmhPerS * dt;
    const feedback = Math.max(
      -maxStep,
      Math.min(maxStep, this.kp * (error - this.lastError) + ki * integralError * dt)
    );
    const step = this.resumeHoldS > 0 ? 0 : feedback;
    this.lastError = error;

    if (this.rampTarget !== undefined) {
      const toGo = this.rampTarget - this.speed;
      this.speed = this.clamp(this.speed + Math.sign(toGo) * Math.min(Math.abs(toGo), maxStep));
      if (Math.abs(this.rampTarget - this.speed) < 1e-9) this.rampTarget = undefined;
    } else {
      this.speed = this.clamp(this.speed + step);
    }

    if (Math.abs(this.speed - this.output) >= OUTPUT_HYSTERESIS_KMH) {
      this.output = Math.round(this.speed * 10) / 10;
    }

    this.lastState = { predictedHr: Math.round(predictedHr), error: Math.round(error * 10) / 10 };
    return this.output;
  }

  /** Sets up the approach to a bmp target that was just (re-)entered. */
  private enterTarget(target: number, targetChanged: boolean): void {
    const previous = this.lastBpmTarget;
    const hint = this.opts.speedHint(target);
    const clampedHint = hint === undefined ? undefined : this.clamp(hint);

    if (targetChanged && previous !== undefined && !this.previousWasTempo) {
      this.enterChangedTarget(Math.sign(target - previous), target, clampedHint);
    } else if (clampedHint !== undefined) {
      // A calibrated hint replaces the generic hrPerKmh feedforward — it's a far better estimate
      // of the speed that actually holds this bpm for this runner (see speedCalibration.ts). The
      // slew-limited march toward it happens after the PI step is computed, in update().
      this.rampTarget =
        clampedHint > this.speed
          ? Math.max(this.speed, this.clamp(clampedHint * HINT_ACCEL_SHARE))
          : clampedHint;
    } else if (targetChanged && previous !== undefined) {
      const modelStep = (target - previous) / this.opts.hrPerKmh;
      this.speed = this.clamp(this.speed + modelStep * FEEDFORWARD_SHARE);
    }
  }

  /**
   * A mid-run step to a new target. The step is sized from how far heart rate really is from the
   * target, so a target that changed during a manual override and is only acted on at its release
   * doesn't push the belt once heart rate has already got there. The result never moves against
   * the direction of the change — a hint learned on a fresher day can't slow the belt on a step up.
   */
  private enterChangedTarget(direction: number, target: number, hint: number | undefined): void {
    const share = direction > 0 ? FEEDFORWARD_SHARE : FEEDFORWARD_SHARE_DOWN;
    const modelStep = ((target - (this.filteredHr as number)) / this.opts.hrPerKmh) * share;
    const modelTarget = this.speed + modelStep;
    const rampTarget =
      direction > 0
        ? Math.max(this.speed, modelTarget, (hint ?? 0) * HINT_ACCEL_SHARE)
        : Math.min(this.speed, modelTarget, hint ?? Infinity);
    this.rampTarget = this.clamp(rampTarget);
    this.transitionDirection = direction;
  }

  private observeHeartRate(heartRate: number, dt: number): void {
    this.filteredHr =
      this.filteredHr === undefined
        ? heartRate
        : this.filteredHr + (heartRate - this.filteredHr) * Math.min(1, dt / HR_FILTER_TAU_S);
    this.trendWindow.push(this.filteredHr);
    const maxSamples = Math.max(5, Math.round(TREND_WINDOW_S / dt));
    if (this.trendWindow.length > maxSamples) this.trendWindow.shift();
  }

  /** Least-squares slope of the filtered HR window, in bpm per second. */
  private trendBpmPerS(dt: number): number {
    const n = this.trendWindow.length;
    if (n < 5) return 0;
    const meanIndex = (n - 1) / 2;
    let numerator = 0;
    let denominator = 0;
    this.trendWindow.forEach((hr, i) => {
      numerator += (i - meanIndex) * hr;
      denominator += (i - meanIndex) ** 2;
    });
    return numerator / denominator / dt;
  }

  private clamp(speed: number): number {
    return Math.max(this.opts.minSpeed, Math.min(this.opts.maxSpeed, speed));
  }
}
