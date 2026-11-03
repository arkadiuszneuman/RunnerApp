import type { TreadmillEvent } from '../ble/events';
import {
  activeProgramIdAtom,
  actualTreadmillSpeedAtom,
  currentStageAtom,
  currentStageIndexAtom,
  heartRateAtom,
  programCooldownAtom,
  programInternalAtom,
  runningStateAtom,
  speedControllerAtom,
  stagesAtom,
  temporaryProgramAtom,
  type TreadmillOptions,
} from '../state/atoms';
import { Timespan } from '../services/Timespan';
import type { MultiplyStage } from '../services/stagesCalculator';
import {
  createSpeedController,
  type SpeedController,
  type SpeedControllerKind,
} from '../training/SpeedController';
import type { TelemetryPoint } from '../types/telemetry';
import { ManualSpeedDetector } from './manualSpeedDetector';
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
  createRun(
    startedAt: string,
    meta?: {
      programId: string | null;
      /** Only for a temporary program (programId null) — a saved one's name is looked up by id. */
      programName?: string;
      program: { stages: MultiplyStage[]; cooldown: boolean };
      controller?: SpeedControllerKind;
    }
  ): Promise<{ id: string }>;
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
  /** Called with a message when a telemetry flush fails. Defaults to a no-op. */
  logger?: (message: string) => void;
  /**
   * Forwarded to `createSpeedController` on every `start()` — evaluated live each time a bmp
   * target is (re-)entered (not just once at construction), so a caller reading from a
   * per-user store that updates between runs (see `learnSpeedCalibration`) always sees the
   * latest calibration. See AdaptiveTraining.ts.
   */
  speedHint?: (bpm: number) => number | undefined;
}

/**
 * Framework-agnostic orchestration extracted from the web app's
 * useRunningLoop.ts: the PID control loop, manual-speed-override detection,
 * cooldown/stage transitions, telemetry buffering, and pause/resume time-shift
 * arithmetic. STOP/START on the treadmill's own console pause/resume the run;
 * only `stop()` (the app) ends it. Reads and writes the same Jotai atoms the UI
 * observes via useAtomValue — there is no separate state shape to keep in sync.
 *
 * Deliberately excluded (platform-specific, stays in each app's thin wrapper
 * hook): screen wake lock, heart rate device connection (RunSession only
 * reads heartRateAtom, already kept in sync by whoever owns that connection),
 * and BLE transport connect/pairing (RunSession assumes `treadmill` is
 * already attached — see TreadmillProtocol.attach()).
 */
/** See the resend in onTreadmillEvent. */
const RESEND_AFTER_MS = 5000;

export class RunSession {
  private readonly store: JotaiStore;
  private readonly treadmill: TreadmillControl;
  private readonly api: RunApi;
  private readonly now: () => number;
  private readonly flushIntervalMs: number;
  private readonly logger: (message: string) => void;
  private readonly speedHint?: (bpm: number) => number | undefined;

  private training: SpeedController = createSpeedController('legacy', 1);
  private cooldownInitialized = false;
  private lastStageIndex: number | undefined;
  private lastPidUpdate = 0;

  /** What the treadmill was last sent (unset until the belt runs, and after pause/manual). */
  private lastSent: { speed: number; incline: number; at: number } | undefined;
  private readonly manualSpeed = new ManualSpeedDetector();
  /** The treadmill last reported Stopped (and hasn't started since). */
  private treadmillStopped = false;

  private runId: string | null = null;
  private _telemetry: TelemetryPoint[] = [];
  private lastTelemetryPoint: Omit<TelemetryPoint, 't'> | null = null;
  private flushIntervalId: ReturnType<typeof setInterval> | undefined;
  private stopPromise: Promise<void> | undefined;

  constructor(opts: RunSessionOptions) {
    this.store = opts.store;
    this.treadmill = opts.treadmill;
    this.api = opts.api;
    this.now = opts.now ?? Date.now;
    this.flushIntervalMs = opts.flushIntervalMs ?? 30_000;
    this.logger = opts.logger ?? (() => {});
    this.speedHint = opts.speedHint;

    this.treadmill.subscribe(this.onTreadmillEvent);
  }

  /**
   * The current run's buffered telemetry (or the just-finished run's, until the next `start()`
   * clears it) — read by callers that want to learn from a run once it ends, e.g. via
   * `watchRunEnd`/`learnSpeedCalibration`. Not cleared on flush; only on the next `start()`.
   */
  get telemetry(): readonly TelemetryPoint[] {
    return this._telemetry;
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
      const controller = this.store.get(speedControllerAtom);
      this.training = createSpeedController(controller, 4, { speedHint: this.speedHint });
      this.lastStageIndex = undefined;
      this.lastPidUpdate = 0;
      this.forgetSentSpeed();

      this._telemetry = [];
      this.lastTelemetryPoint = null;
      this.runId = null;

      const startDate = new Date(this.now() + 3000); // belt spin-up buffer
      const startedAt = startDate.toISOString();
      const temporary = this.store.get(temporaryProgramAtom);
      const programId = temporary ? null : this.store.get(activeProgramIdAtom);
      const program = this.store.get(programInternalAtom);

      this.api
        .createRun(startedAt, {
          programId,
          ...(temporary && { programName: temporary.name }),
          program,
          controller,
        })
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

  /**
   * Dedupes concurrent callers (mirrors the connect-dedup pattern in the
   * BleTransport implementations): pump() calls this without awaiting it
   * whenever the program ends without cooldown, and the UI's Stop button can
   * call it independently around the same time. Without this, two overlapping
   * calls would both read `state`/`runId` before either finished, double-fire
   * `treadmill.stop()`, and race to set `runningStateAtom`.
   */
  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this._stop().finally(() => {
      this.stopPromise = undefined;
    });
    return this.stopPromise;
  }

  private async _stop(): Promise<void> {
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
    // State first: the treadmill's btStopped may arrive while the STOP write is still awaited.
    this.pauseClock();
    await this.treadmill.stop();
  }

  async resume(): Promise<void> {
    await this.treadmill.start();
    this.resumeClock();
  }

  /** Pauses the running clock and telemetry. Leaves the treadmill alone. */
  private pauseClock(): void {
    const state = this.store.get(runningStateAtom);
    if (!state.running || state.paused) return;
    this.flushTelemetry();
    this.forgetSentSpeed();
    this.store.set(runningStateAtom, (prev) =>
      prev.running && !prev.paused
        ? { ...prev, paused: true, pauseStartedDate: new Date(this.now()) }
        : prev
    );
  }

  /**
   * Resumes the running clock, shifted by the pause so the elapsed time is unaffected. Leaves the
   * treadmill alone — the speed follows via dispatchSpeed once the belt runs.
   */
  private resumeClock(): void {
    this.forgetSentSpeed();
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
    this.forgetSentSpeed();
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

    // Cheap when nothing changed; catches up once the belt runs again after start/resume.
    this.dispatchSpeed();

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

    // While the user holds a manual speed, keep the controller glued to the
    // belt so "Reset" resumes from where they actually are rather than from
    // wherever the controller drifted meanwhile (no-op for the legacy one).
    if (treadmillOptions.isManualSpeedActive) {
      this.training.trackManualSpeed(this.store.get(actualTreadmillSpeedAtom));
    }

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
      aspd: this.store.get(actualTreadmillSpeedAtom),
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
      last.aspd !== point.aspd ||
      last.inc !== point.inc ||
      last.si !== point.si
    ) {
      this._telemetry.push({ t: elapsedS, ...point });
      this.lastTelemetryPoint = point;
    }
  }

  private updateTreadmillOptions(updater: (opts: TreadmillOptions) => TreadmillOptions): void {
    this.store.set(runningStateAtom, (prev) =>
      prev.running ? { ...prev, treadmillOptions: updater(prev.treadmillOptions) } : prev
    );
    this.dispatchSpeed();
  }

  /**
   * Sends the speed/incline only when they changed: re-sending every second would undo a press
   * on the treadmill's own buttons before it could be noticed, and the queued frames would push
   * the STATUS polls (the only speed readings) out to one every few seconds.
   */
  private dispatchSpeed(): void {
    if (!this.treadmill.isConnected() || !this.treadmill.isRunning()) return;
    const state = this.store.get(runningStateAtom);
    if (!state.running) return;
    const { speed, incline, isManualSpeedActive } = state.treadmillOptions;
    // Don't override the user's manual speed — let the treadmill maintain it.
    if (isManualSpeedActive) return;
    if (this.lastSent?.speed === speed && this.lastSent.incline === incline) return;
    this.send(speed, incline);
  }

  private send(speed: number, incline: number): void {
    const now = this.now();
    this.lastSent = { speed, incline, at: now };
    this.manualSpeed.command(speed, now);
    this.treadmill.sendIncAndSpeed(incline, speed);
  }

  /** The next dispatch sends again, and the manual-speed detector starts over. */
  private forgetSentSpeed(): void {
    this.lastSent = undefined;
    this.manualSpeed.reset();
  }

  private readonly onTreadmillEvent = (event: TreadmillEvent): void => {
    if (event.type === 'btDisconnected') {
      const finishedAt = new Date(this.now()).toISOString();
      this.flushTelemetry({ finishedAt });
      this.runId = null;
      this.clearFlushInterval();
      this.forgetSentSpeed();
      this.treadmillStopped = false;
      this.store.set(runningStateAtom, { running: false });
      return;
    }

    // STOP on the treadmill's console only pauses the run — ending it is up to the app. While
    // the app itself is stopping, the btStopped it causes is just the belt confirming it.
    if (event.type === 'btStopped') {
      this.treadmillStopped = true;
      if (!this.stopPromise) this.pauseClock();
      return;
    }

    // The belt coming back after a stop (START on the console, or the app's resume) resumes a
    // paused run. Only that transition counts: right after Pause in the app the belt still
    // reports Running while it slows down, and that must not undo the pause.
    if ((event.type === 'btStarting' || event.type === 'btRunning') && this.treadmillStopped) {
      this.treadmillStopped = false;
      const state = this.store.get(runningStateAtom);
      if (state.running && state.paused) this.resumeClock();
    }

    if (event.type === 'btRunning') {
      const treadmillSpeed = event.state.currentSpeed;
      this.store.set(actualTreadmillSpeedAtom, treadmillSpeed);

      const state = this.store.get(runningStateAtom);
      if (!state.running || state.paused || state.treadmillOptions.isManualSpeedActive) return;

      const now = this.now();
      if (this.manualSpeed.reading(treadmillSpeed, now)) {
        this.training.syncToSpeed(treadmillSpeed);
        this.store.set(runningStateAtom, (prev) =>
          prev.running
            ? { ...prev, treadmillOptions: { ...prev.treadmillOptions, isManualSpeedActive: true } }
            : prev
        );
        return;
      }

      // The firmware occasionally drops both copies of a command: if the belt still hasn't
      // reached it after a while, send it again.
      const sent = this.lastSent;
      if (sent && !this.manualSpeed.isSettled && now - sent.at >= RESEND_AFTER_MS) {
        this.send(sent.speed, sent.incline);
      }
    }
  };

  private flushTelemetry(extra?: { finishedAt?: string; durationMs?: number }): void {
    if (!this.runId) return;
    const state = this.store.get(runningStateAtom);
    const startedAt = state.running ? state.runningStartedDate.toISOString() : undefined;
    // Deliberately fire-and-forget (a slow/offline flush must never block the
    // pump loop or the stop/pause flow) but still surfaced via the logger —
    // silently swallowing this would lose telemetry with no way to notice.
    this.api
      .patchRun(this.runId, { startedAt, telemetry: this._telemetry, ...extra })
      .catch((error) => this.logger(`RunSession: telemetry flush failed: ${error}`));
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
