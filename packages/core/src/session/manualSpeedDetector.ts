/** Belt readings come in 0.1 km/h steps; anything closer than this is the same speed. */
const TOLERANCE = 0.05;

export interface ManualSpeedDetectorOptions {
  /**
   * How long a superseded target still explains the belt's motion: the treadmill applies a
   * command a while after it's queued, and keeps ramping toward the previous one until then.
   */
  memoryMs?: number;
  /** Consecutive unexplained readings needed, so a single odd reading never counts. */
  confirmations?: number;
  /** A reading this far outside every recent target counts at once. */
  jumpKmh?: number;
}

/**
 * Tells the user's own presses on the treadmill's speed buttons apart from the belt following
 * what the app commanded. The belt may legitimately sit anywhere between the targets commanded
 * in the last few seconds (it ramps, and applies commands late); a reading outside that range is
 * unexplained when the belt keeps moving further out, or when it had already settled on the
 * current target and now holds a different speed (a finished press).
 */
export class ManualSpeedDetector {
  private readonly memoryMs: number;
  private readonly confirmations: number;
  private readonly jumpKmh: number;

  /** Commanded targets, oldest first; the last one is current. */
  private targets: { speed: number; at: number }[] = [];
  private previous: number | undefined;
  private settled = false;
  private suspicious = 0;

  constructor(opts: ManualSpeedDetectorOptions = {}) {
    this.memoryMs = opts.memoryMs ?? 3000;
    this.confirmations = opts.confirmations ?? 2;
    this.jumpKmh = opts.jumpKmh ?? 0.3;
  }

  /** Whether the belt has reached the current target since it was commanded. */
  get isSettled(): boolean {
    return this.settled;
  }

  reset(): void {
    this.targets = [];
    this.previous = undefined;
    this.settled = false;
    this.suspicious = 0;
  }

  /** The app sent the treadmill a speed (repeating the current one changes nothing). */
  command(speed: number, now: number): void {
    if (this.targets[this.targets.length - 1]?.speed === speed) return;
    this.targets.push({ speed, at: now });
    this.settled = false;
    this.suspicious = 0;
  }

  /** A belt speed reading; true once it shows the user changed the speed on the treadmill. */
  reading(speed: number, now: number): boolean {
    const previous = this.previous;
    this.previous = speed;
    // A target stays relevant until its successor has had memoryMs to take over.
    this.targets = this.targets.filter(
      (_, i, all) => i === all.length - 1 || all[i + 1].at > now - this.memoryMs
    );
    const current = this.targets[this.targets.length - 1];
    if (!current) return false;

    // Two readings in a row on the target: passing through it on the way to an older one
    // doesn't count.
    if (
      previous !== undefined &&
      Math.abs(speed - current.speed) <= TOLERANCE &&
      Math.abs(previous - current.speed) <= TOLERANCE
    ) {
      this.settled = true;
    }

    const speeds = this.targets.map((t) => t.speed);
    const min = Math.min(...speeds);
    const max = Math.max(...speeds);
    const outside = speed > max ? speed - max : speed < min ? min - speed : 0;
    if (outside <= TOLERANCE) {
      this.suspicious = 0;
      return false;
    }

    const trend = previous === undefined ? 0 : speed - previous;
    const movingOut = speed > max ? trend > TOLERANCE : trend < -TOLERANCE;
    const holding = Math.abs(trend) <= TOLERANCE;
    // Otherwise it's heading back in, or hasn't started on a fresh command yet.
    if (movingOut || (this.settled && holding)) this.suspicious++;
    else this.suspicious = 0;

    return this.suspicious >= this.confirmations || (movingOut && outside >= this.jumpKmh);
  }
}
