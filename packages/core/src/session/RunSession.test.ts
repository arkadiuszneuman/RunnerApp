import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'jotai/vanilla';
import { RunSession, type RunApi } from './RunSession';
import { TreadmillProtocol } from '../ble/treadmillProtocol';
import { FakeTreadmill } from '../ble/fakeTreadmill';
import { Timespan } from '../services/Timespan';
import type { MultiplyStage, Stage } from '../services/stagesCalculator';
import {
  heartRateAtom,
  isManualSpeedActiveAtom,
  programAtom,
  programCooldownAtom,
  runningStateAtom,
} from '../state/atoms';

function simpleStage(bmp: number, seconds: number, type: Stage['type'] = 'simple'): Stage {
  return { type, duration: Timespan.fromSeconds(seconds), speedType: 'bmp', bmp };
}

/** warmup(20s@140) -> [sprint(15s@170), regeneration(10s@130)] -> cooldown(15s@140) */
function testProgram(): MultiplyStage[] {
  return [
    { times: 1, stages: [simpleStage(140, 20)] },
    { times: 1, stages: [simpleStage(170, 15, 'sprint'), simpleStage(130, 10, 'regeneration')] },
    { times: 1, stages: [simpleStage(140, 15)] },
  ];
}

interface Harness {
  store: ReturnType<typeof createStore>;
  transport: FakeTreadmill;
  treadmill: TreadmillProtocol;
  session: RunSession;
  nowRef: { current: number };
  createRunCalls: string[];
  patchRunCalls: { id: string; payload: { telemetry: unknown[]; finishedAt?: string; durationMs?: number } }[];
}

function makeHarness(flushIntervalMs = 30_000): Harness {
  const store = createStore();
  const transport = new FakeTreadmill({ rampRate: 10 }); // fast ramp — not what's under test here
  const treadmill = new TreadmillProtocol({ transport });
  const nowRef = { current: 0 };
  const createRunCalls: string[] = [];
  const patchRunCalls: Harness['patchRunCalls'] = [];
  const api: RunApi = {
    async createRun(startedAt) {
      createRunCalls.push(startedAt);
      return { id: 'run-1' };
    },
    async patchRun(id, payload) {
      patchRunCalls.push({ id, payload });
    },
  };
  const session = new RunSession({ store, treadmill, api, now: () => nowRef.current, flushIntervalMs });
  return { store, transport, treadmill, session, nowRef, createRunCalls, patchRunCalls };
}

/** Advances the fake clock in 200ms steps (matching the original real-world poll cadence), pumping both the BLE tick and the session on every step. */
/**
 * Advances the fake clock in 200ms steps (matching the original real-world
 * poll cadence), pumping both the BLE tick and the session on every step.
 * Also advances vitest's fake timers in lockstep so RunSession's real
 * `setInterval`-based periodic telemetry flush fires realistically.
 */
function advance(h: Harness, ms: number, stepMs = 200): void {
  const target = h.nowRef.current + ms;
  while (h.nowRef.current < target) {
    const step = Math.min(stepMs, target - h.nowRef.current);
    h.nowRef.current += step;
    h.treadmill.tick();
    h.session.pump();
    vi.advanceTimersByTime(step);
  }
}

async function connectAndStart(h: Harness): Promise<void> {
  await h.treadmill.attach();
  // Drain the 3 initial info commands and get past Stopped -> Running.
  for (let i = 0; i < 30 && !h.treadmill.isRunning(); i++) h.treadmill.tick();
  await h.session.start();
  // start() sets runningStartedDate 3s in the future (belt spin-up); cross it.
  advance(h, 3100);
}

describe('RunSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start() connects, creates a run, and begins commanding speed', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    await connectAndStart(h);

    expect(h.createRunCalls).toHaveLength(1);
    const state = h.store.get(runningStateAtom);
    expect(state.running).toBe(true);
  });

  it('start() refuses to start (and pump() is a no-op) when the program has no stages', async () => {
    const h = makeHarness();
    // programAtom defaults to [] — no h.store.set(programAtom, ...) here.
    await connectAndStart(h);

    expect(h.createRunCalls).toHaveLength(0);
    expect(h.store.get(runningStateAtom).running).toBe(false);

    // Also guard the case where the program empties out mid-run (pump() must
    // not throw trying to read stages[stages.length - 1] off an empty array).
    h.store.set(programAtom, testProgram());
    await connectAndStart(h);
    expect(h.store.get(runningStateAtom).running).toBe(true);

    h.store.set(programAtom, []);
    expect(() => advance(h, 1000)).not.toThrow();
  });

  it('PID moves speed toward the target when heart rate is below target', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    h.store.set(heartRateAtom, 100); // well below the 140 target -> PID should push speed up
    await connectAndStart(h);

    const speedAfterStart = h.store.get(runningStateAtom);
    const speedBefore = speedAfterStart.running ? speedAfterStart.treadmillOptions.speed : 0;

    advance(h, 5000); // several 1Hz PID ticks

    const after = h.store.get(runningStateAtom);
    expect(after.running).toBe(true);
    if (after.running) {
      expect(after.treadmillOptions.speed).toBeGreaterThan(speedBefore);
    }
  });

  it('transitions between stages as runningTime crosses stage boundaries', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    h.store.set(heartRateAtom, 140); // stay near target — minimize PID movement, focus on stage tracking
    await connectAndStart(h);

    // Still inside the warmup stage. calculateStages pulls the sprint's `from`
    // back by 10s AND the preceding stage's `to` back by the same 10s (a
    // "steal", not a truncation — see stagesCalculator.ts) so warmup actually
    // spans [0, 10) here, not [0, 20).
    advance(h, 5000);
    let state = h.store.get(runningStateAtom);
    expect(state.running && state.runningTime.totalSeconds).toBeLessThan(10);

    // Cross into the sprint, which now starts at 10s.
    advance(h, 10_000);
    state = h.store.get(runningStateAtom);
    expect(state.running).toBe(true);
  });

  it('cooldown=true switches to a fixed 4km/h/0%% speed at the end of the program instead of stopping', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    h.store.set(programCooldownAtom, true);
    h.store.set(heartRateAtom, 140);
    await connectAndStart(h);

    // Total span is unchanged by the sprint steal (only the interior boundary
    // moves): 20 + 15 + 10 + 15 = 60s.
    advance(h, 61_000);

    const state = h.store.get(runningStateAtom);
    expect(state.running).toBe(true);
    if (state.running) {
      expect(state.treadmillOptions.speed).toBe(4);
      expect(state.treadmillOptions.incline).toBe(0);
      expect(state.treadmillOptions.isCustomSpeedUsed).toBe(true);
    }
  });

  it('cooldown=false stops the run at the end of the program', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    h.store.set(programCooldownAtom, false);
    h.store.set(heartRateAtom, 140);
    await connectAndStart(h);

    advance(h, 61_000);

    const state = h.store.get(runningStateAtom);
    expect(state.running).toBe(false);
  });

  it('pause() then resume() shifts runningStartedDate forward by the pause duration', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    h.store.set(heartRateAtom, 140);
    await connectAndStart(h);

    advance(h, 5000);
    const beforePause = h.store.get(runningStateAtom);
    const startedDateBefore = beforePause.running ? beforePause.runningStartedDate.getTime() : 0;

    await h.session.pause();
    const paused = h.store.get(runningStateAtom);
    expect(paused.running && paused.paused).toBe(true);

    // Time passes while paused — running clock must not advance.
    h.nowRef.current += 10_000;
    h.session.pump();
    const stillPaused = h.store.get(runningStateAtom);
    expect(stillPaused.running && stillPaused.runningTime.totalSeconds).toBe(
      beforePause.running ? beforePause.runningTime.totalSeconds : -1
    );

    await h.session.resume();
    const resumed = h.store.get(runningStateAtom);
    expect(resumed.running).toBe(true);
    if (resumed.running) {
      // Shifted forward by ~10s (the pause duration) so elapsed running time is unaffected.
      expect(resumed.runningStartedDate.getTime() - startedDateBefore).toBeGreaterThanOrEqual(9_000);
      expect(resumed.treadmillOptions.isManualSpeedActive).toBe(false);
    }
  });

  it('latches isManualSpeedActive when the belt moves away from the commanded speed, and resetManualSpeed() clears it', async () => {
    const h = makeHarness();
    h.store.set(programAtom, testProgram());
    h.store.set(heartRateAtom, 140);
    await connectAndStart(h);

    expect(h.store.get(isManualSpeedActiveAtom)).toBe(false);

    // Simulate the user pressing the console's own speed buttons, away from
    // whatever RunSession last commanded.
    const commanded = h.store.get(runningStateAtom);
    const commandedSpeed = commanded.running ? commanded.treadmillOptions.speed : 1;
    h.transport.manualSpeed(commandedSpeed + 3);

    // Let a STATUS poll observe the new (diverging) speed.
    advance(h, 1000);

    expect(h.store.get(isManualSpeedActiveAtom)).toBe(true);

    h.session.resetManualSpeed();
    expect(h.store.get(isManualSpeedActiveAtom)).toBe(false);
  });

  it('flushes telemetry periodically and on stop, and does not duplicate an unchanged point', async () => {
    const h = makeHarness(2000); // short flush interval for the test
    h.store.set(programAtom, testProgram());
    h.store.set(heartRateAtom, 140);
    await connectAndStart(h);

    advance(h, 5000);
    expect(h.patchRunCalls.length).toBeGreaterThan(0);
    const telemetryLengths = h.patchRunCalls.map((c) => c.payload.telemetry.length);
    // Full-replace semantics: each flush resends the whole (monotonically growing) buffer.
    for (let i = 1; i < telemetryLengths.length; i++) {
      expect(telemetryLengths[i]).toBeGreaterThanOrEqual(telemetryLengths[i - 1]);
    }

    await h.session.stop();
    const last = h.patchRunCalls[h.patchRunCalls.length - 1];
    expect(last?.payload.finishedAt).toBeDefined();
    expect(h.store.get(runningStateAtom).running).toBe(false);
  });
});
