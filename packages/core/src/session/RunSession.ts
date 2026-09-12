import type { TreadmillEvent } from '../ble/events';
import {
  actualTreadmillSpeedAtom,
  currentStageAtom,
  currentStageIndexAtom,
  heartRateAtom,
  programCooldownAtom,
  runningStateAtom,
  stagesAtom,
  type TreadmillOptions,
} from '../state/atoms';
import { Timespan } from '../services/Timespan';
import Training from '../training/Training';
import type { TelemetryPoint } from '../types/telemetry';
import type { JotaiStore } from './store';

/**
 * The narrow slice of TreadmillProtocol's public API RunSession actually
 * needs — structural on purpose (not `TreadmillProtocol` itself, which has
 * private fields and would force every caller to pass a real instance) so
 * each app's thin BleManager-equivalent wrapper object can be passed directly.
 */
export interface TreadmillControl {
  isConnected(): boolean;
  isRunning(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendIncAndSpeed(incline: number, speed: number): void;
  subscribe(cb: (data: TreadmillEvent) => void): () => void;
}

export interface RunApi {
  createRun(startedAt: string): Promise<{ id: string }>;
  patchRun(
    id: string,
    payload: { startedAt?: string; telemetry: TelemetryPoint[]; finishedAt?: string; durationMs?: number }
  ): Promise<void>;
}

export interface RunSessionOptions {
  store: JotaiStore;
  treadmill: TreadmillControl;
  api: RunApi;
  /** Injectable clock for tests. Defaults to Date.now. */
  now?: () => number;
  /** Defaults to 30s, matching the original web implementation. */
  flushIntervalMs?: number;
}

/**
 * Framework-agnostic orchestration extracted from the web app's
 * useRunningLoop.ts: the PID control loop, manual-speed-override detection,
 * cooldown/stage transitions, telemetry buffering, and pause/resume time-shift
 * arithmetic. Reads and writes the same Jotai atoms the UI observes via
 * useAtomValue — there is no separate state shape to keep in sync.
 *
 * Deliberately excluded (platform-specific, stays in each app's thin wrapper
 * hook): screen wake lock, heart rate device connection (RunSession only
 * reads heartRateAtom, already kept in sync by whoever owns that connection),
 * and BLE transport connect/pairing (RunSession assumes `treadmill` is
 * already attached — see TreadmillProtocol.attach()).
 */
export class RunSession {
  private readonly store: JotaiStore;
  private readonly treadmill: TreadmillControl;
  private readonly api: RunApi;
  private readonly now: () => number;
  private readonly flushIntervalMs: number;

  private training = new Training(1);
  private cooldownInitialized = false;
  private lastStageIndex: number | undefined;
  private lastPidUpdate = 0;

  private lastCommandedSpeed = 0;
  private previousActualSpeed = 0;

  private runId: string | null = null;
  private telemetry: TelemetryPoint[] = [];
  private lastTelemetryPoint: Omit<TelemetryPoint, 't'> | null = null;
  private flushIntervalId: ReturnType<typeof setInterval> | undefined;

  constructor(opts: RunSessionOptions) {
    this.store = opts.store;
    this.treadmill = opts.treadmill;
    this.api = opts.api;
    this.now = opts.now ?? Date.now;
    this.flushIntervalMs = opts.flushIntervalMs ?? 30_000;

    this.treadmill.subscribe(this.onTreadmillEvent);
  }

  /**
   * Call on a foreground timer (~200ms) and, later, from BLE notifications for
   * background execution (see the React Native background-execution design).
   * Advances the running clock and, once the treadmill confirms it's
   * physically running, drives the 1Hz PID/telemetry step. Idempotent and
   * cheap; safe to over-call.
   */
  pump(): void {
    const state = this.store.get(runningStateAtom);
    if (!state.running) return;

    if (!state.paused) {
      const t = this.now();
      const diffMs = t - state.runningStartedDate.getTime();
      const seconds = Math.max(0, Math.round(diffMs / 1000));
      if (state.runningTime.totalSeconds !== seconds) {
        this.store.set(runningStateAtom, (prev) =>
          prev.running ? { ...prev, runningTime: Timespan.fromSeconds(seconds) } : prev
        );
      }
    }

    if (!this.treadmill.isRunning()) return;
    this.runControlLogic();
  }

  async start(): Promise<void> {
    try {
      if (!this.treadmill.isConnected()) return;
      // A program with no stages has no end time for runControlLogic to
      // compare the running clock against — refuse to start rather than
      // start the belt and then never stop or progress.
      if (this.store.get(stagesAtom).length === 0) return;

      await this.treadmill.start();
      this.treadmill.sendIncAndSpeed(2, 4);

      this.cooldownInitialized = false;
      this.training = new Training(4);
      this.lastStageIndex = undefined;
      this.lastPidUpdate = 0;
      this.lastCommandedSpeed = 0;
      this.previousActualSpeed = 0;

      this.telemetry = [];
      this.lastTelemetryPoint = null;
      this.runId = null;

      const startDate = new Date(this.now() + 3000); // belt spin-up buffer
      const startedAt = startDate.toISOString();

      this.api
        .createRun(startedAt)
        .then(({ id }) => {
          this.runId = id;
          this.startFlushInterval();
        })
        .catch(() => {});

      this.store.set(runningStateAtom, (prev) => ({
        ...prev,
        running: true,
        paused: false,
        runningStartedDate: startDate,
        runningTime: new Timespan(),
        treadmillOptions: { incline: 2, speed: 1, isCustomSpeedUsed: false, isManualSpeedActive: false },
      }));
      this.dispatchSpeed();
    } catch {
      this.store.set(runningStateAtom, { running: false });
    }
  }

  async stop(): Promise<void> {
    const state = this.store.get(runningStateAtom);
    const finishedAt = new Date(this.now()).toISOString();
    const durationMs = state.running ? state.runningTime.totalMilliseconds : undefined;
    this.flushTelemetry({ finishedAt, durationMs });
    this.runId = null;
    this.clearFlushInterval();

    await this.treadmill.stop();
    this.store.set(runningStateAtom, { running: false });
  }

  async pause(): Promise<void> {
    this.flushTelemetry();
    await this.treadmill.stop();
    this.store.set(runningStateAtom, (prev) =>
      prev.running ? { ...prev, paused: true, pauseStartedDate: new Date(this.now()) } : prev
    );
  }

  async resume(): Promise<void> {
    await this.treadmill.start();
    this.store.set(runningStateAtom, (prev) => {
      if (prev.running && prev.paused && prev.pauseStartedDate) {
        const pauseDuration = this.now() - prev.pauseStartedDate.getTime();
        const newStartedDate = new Date(prev.runningStartedDate.getTime() + pauseDuration);
        return {
          ...prev,
          paused: false,
          pauseStartedDate: undefined,
          runningStartedDate: newStartedDate,
          treadmillOptions: { ...prev.treadmillOptions, isManualSpeedActive: false },
        };
      }
      return prev;
    });
    this.dispatchSpeed();
  }

  resetManualSpeed(): void {
    this.store.set(runningStateAtom, (prev) => {
      if (prev.running && prev.treadmillOptions.isManualSpeedActive) {
        return { ...prev, treadmillOptions: { ...prev.treadmillOptions, isManualSpeedActive: false } };
      }
      return prev;
    });
    this.dispatchSpeed();
  }

  private runControlLogic(): void {
    const state = this.store.get(runningStateAtom);
    if (!state.running) return;

    const stages = this.store.get(stagesAtom);
    // Belt-and-braces alongside start()'s guard: the program could in
    // principle become empty mid-run (e.g. edited in another tab via
    // useProgramSync). stages[stages.length - 1] below would throw on an
    // empty array otherwise.
    if (stages.length === 0) return;

    const currentStage = this.store.get(currentStageAtom);
    const currentStageIndex = this.store.get(currentStageIndexAtom);
    const programCooldown = this.store.get(programCooldownAtom);
    const treadmillOptions = state.treadmillOptions;

    if (state.runningTime.totalMilliseconds >= stages[stages.length - 1].to.totalMilliseconds) {
      if (programCooldown) {
        if (!this.cooldownInitialized) {
          this.updateTreadmillOptions((opts) => ({ ...opts, isCustomSpeedUsed: true, speed: 4, incline: 0 }));
          this.cooldownInitialized = true;
        }
      } else {
        this.stop();
        return;
      }
    }

    if (!currentStage) return;

    if (this.lastStageIndex === undefined || currentStageIndex !== this.lastStageIndex) {
      if (treadmillOptions.isCustomSpeedUsed) {
        this.updateTreadmillOptions((opts) => ({ ...opts, isCustomSpeedUsed: false }));
      }
      this.lastStageIndex = currentStageIndex;
    }

    const t = this.now();
    if (t - this.lastPidUpdate < 1000) return;
    this.lastPidUpdate = t;

    const heartRate = this.store.get(heartRateAtom);
    const isTempoStage = currentStage.speedType === 'tempo';
    if (!isTempoStage && heartRate === undefined) return;

    const newSpeed = this.training.update(heartRate ?? 0, currentStage, 1000);
    this.updateTreadmillOptions((opts) => ({ ...opts, speed: newSpeed }));

    const elapsedS = Math.floor(state.runningTime.totalMilliseconds / 1000);
    const thr = currentStage.speedType === 'bmp' ? currentStage.bmp : 0;
    const phr = this.training.lastState?.predictedHr ?? 0;
    const err = this.training.lastState?.error ?? 0;
    const point: Omit<TelemetryPoint, 't'> = {
      hr: heartRate ?? 0,
      thr,
      phr,
      spd: newSpeed,
      inc: treadmillOptions.incline,
      si: currentStageIndex ?? 0,
      err,
    };
    const last = this.lastTelemetryPoint;
    if (
      !last ||
      last.hr !== point.hr ||
      last.thr !== point.thr ||
      last.phr !== point.phr ||
      last.spd !== point.spd ||
      last.inc !== point.inc ||
      last.si !== point.si
    ) {
      this.telemetry.push({ t: elapsedS, ...point });
      this.lastTelemetryPoint = point;
    }
  }

  private updateTreadmillOptions(updater: (opts: TreadmillOptions) => TreadmillOptions): void {
    this.store.set(runningStateAtom, (prev) =>
      prev.running ? { ...prev, treadmillOptions: updater(prev.treadmillOptions) } : prev
    );
    this.dispatchSpeed();
  }

  private dispatchSpeed(): void {
    if (!this.treadmill.isConnected()) return;
    const state = this.store.get(runningStateAtom);
    if (!state.running) return;
    const { treadmillOptions } = state;
    // Don't override the user's manual speed — let the treadmill maintain it.
    if (treadmillOptions.isManualSpeedActive) return;
    this.lastCommandedSpeed = treadmillOptions.speed;
    this.treadmill.sendIncAndSpeed(treadmillOptions.incline, treadmillOptions.speed);
  }

  private readonly onTreadmillEvent = (event: TreadmillEvent): void => {
    if (event.type === 'btDisconnected' || event.type === 'btStopped') {
      const finishedAt = new Date(this.now()).toISOString();
      this.flushTelemetry({ finishedAt });
      this.runId = null;
      this.clearFlushInterval();

      this.store.set(runningStateAtom, (prev) => {
        if (prev.running && prev.paused && event.type === 'btStopped') return prev;
        return { running: false };
      });
    }

    if (event.type === 'btRunning') {
      const treadmillSpeed = event.state.currentSpeed;
      this.store.set(actualTreadmillSpeedAtom, treadmillSpeed);

      // Detect manual speed override using direction analysis:
      // - gap: how far the treadmill is from the commanded speed
      // - trend: which direction the treadmill is moving (vs previous reading)
      // If the treadmill is moving AWAY from the commanded speed (opposite
      // signs), the user is controlling it manually — distinguishes this from
      // normal ramp-up (which moves TOWARD the commanded speed).
      const gap = this.lastCommandedSpeed - treadmillSpeed;
      const trend = treadmillSpeed - this.previousActualSpeed;
      this.previousActualSpeed = treadmillSpeed;

      const isMovingAwayFromTarget = Math.abs(gap) > 0.05 && gap * trend < 0;
      if (isMovingAwayFromTarget) {
        const state = this.store.get(runningStateAtom);
        if (state.running && !state.treadmillOptions.isManualSpeedActive) {
          this.training.syncToSpeed(treadmillSpeed);
          this.store.set(runningStateAtom, (prev) =>
            prev.running
              ? { ...prev, treadmillOptions: { ...prev.treadmillOptions, isManualSpeedActive: true } }
              : prev
          );
        }
      }
    }
  };

  private flushTelemetry(extra?: { finishedAt?: string; durationMs?: number }): void {
    if (!this.runId) return;
    const state = this.store.get(runningStateAtom);
    const startedAt = state.running ? state.runningStartedDate.toISOString() : undefined;
    this.api.patchRun(this.runId, { startedAt, telemetry: this.telemetry, ...extra }).catch(() => {});
  }

  private startFlushInterval(): void {
    this.flushIntervalId = setInterval(() => this.flushTelemetry(), this.flushIntervalMs);
  }

  private clearFlushInterval(): void {
    if (this.flushIntervalId !== undefined) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = undefined;
    }
  }
}
