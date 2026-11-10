import { describe, expect, it } from 'vitest';
import calculateStages, { type MultiplyStage, type Stage } from '../services/stagesCalculator';
import { Timespan } from '../services/Timespan';
import AdaptiveTraining from './AdaptiveTraining';
import { simulateRun, summarizeSimulation, type SimulationPoint } from './heartRateSimulation';
import Training from './Training';

function bmpStage(bmp: number, minutes = 10): Stage {
  return { type: 'simple', speedType: 'bmp', bmp, duration: Timespan.fromMinutes(minutes) };
}

/** Feeds a constant heart rate for `ticks` 1 Hz steps; returns the speed after the last one. */
function runFor(controller: AdaptiveTraining, hr: number, stage: Stage, ticks: number): number {
  let speed = NaN;
  for (let i = 0; i < ticks; i++) speed = controller.update(hr, stage, 1000);
  return speed;
}

describe('AdaptiveTraining', () => {
  it('returns the tempo speed on tempo stages', () => {
    const controller = new AdaptiveTraining(5);
    const tempo: Stage = {
      type: 'simple',
      speedType: 'tempo',
      tempo: Timespan.fromMinutes(5),
      duration: Timespan.fromMinutes(5),
    };
    expect(controller.update(120, tempo, 1000)).toBe(12);
    expect(controller.lastState).toBeNull();
  });

  it('speeds up while heart rate stays below target', () => {
    expect(runFor(new AdaptiveTraining(6), 120, bmpStage(150), 30)).toBeGreaterThan(6);
  });

  it('slows down while heart rate stays above target', () => {
    expect(runFor(new AdaptiveTraining(10), 175, bmpStage(150), 30)).toBeLessThan(10);
  });

  it('never changes speed faster than the slew limit (plus one 0.1 quantization step)', () => {
    const controller = new AdaptiveTraining(6);
    const stage = bmpStage(185);
    let previous = 6;
    for (let i = 0; i < 40; i++) {
      const speed = controller.update(80, stage, 1000);
      expect(Math.abs(speed - previous)).toBeLessThanOrEqual(0.4 + 1e-9);
      previous = speed;
    }
  });

  it('holds the belt steady when heart rate hovers around the target', () => {
    const controller = new AdaptiveTraining(8);
    const stage = bmpStage(150);
    const speeds = Array.from({ length: 120 }, (_, i) => controller.update(i % 2 ? 151 : 149, stage, 1000));
    // No chatter: over two minutes of ±1 bpm noise the belt settles after at
    // most a couple of hysteresis-sized steps, instead of hunting every second.
    const changes = speeds.filter((s, i) => i > 0 && s !== speeds[i - 1]).length;
    expect(changes).toBeLessThanOrEqual(2);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThanOrEqual(0.3 + 1e-9);
  });

  it('ramps to most of the model-predicted speed difference when the target steps up', () => {
    const controller = new AdaptiveTraining(8);
    const before = runFor(controller, 150, bmpStage(150), 30);
    const first = controller.update(150, bmpStage(168), 1000);
    expect(first - before).toBeLessThanOrEqual(0.4 + 1e-9); // slew-limited, not a single jump
    const after = runFor(controller, 150, bmpStage(168), 5);
    expect(after).toBeGreaterThan(before + 1.4); // 18 bpm / 9 bpm per km/h × 0.8
  });

  it('drops well past the model-predicted difference when the target steps down', () => {
    const controller = new AdaptiveTraining(15);
    const before = runFor(controller, 168, bmpStage(168), 30);
    const after = runFor(controller, 168, bmpStage(143), 14);
    expect(after).toBeLessThan(before - 3.5); // 25 bpm / 9 bpm per km/h × 1.5 ≈ 4.2
  });

  it('closes a large error faster after a target change than the same error mid-stage', () => {
    const changed = new AdaptiveTraining(10);
    runFor(changed, 150, bmpStage(150), 30);
    const steady = new AdaptiveTraining(10);
    runFor(steady, 150, bmpStage(180), 30);

    const startChanged = runFor(changed, 150, bmpStage(180), 20); // ramp finished by now
    const startSteady = runFor(steady, 150, bmpStage(180), 20);
    const gainChanged = runFor(changed, 150, bmpStage(180), 20) - startChanged;
    const gainSteady = runFor(steady, 150, bmpStage(180), 20) - startSteady;
    expect(gainChanged).toBeGreaterThan(gainSteady * 2);
  });

  it('applies a target change made during a manual override once it is released', () => {
    const controller = new AdaptiveTraining(15);
    runFor(controller, 164, bmpStage(164), 30);
    for (let i = 0; i < 5; i++) {
      controller.trackManualSpeed(15);
      controller.update(164, bmpStage(143), 1000);
    }
    const after = runFor(controller, 164, bmpStage(143), 14);
    expect(after).toBeLessThan(15 - 2.5);
  });

  it('does not step after a manual override if heart rate already reached the new target', () => {
    const controller = new AdaptiveTraining(11);
    runFor(controller, 164, bmpStage(164), 30);
    for (let i = 0; i < 40; i++) {
      controller.trackManualSpeed(11);
      controller.update(143, bmpStage(143), 1000);
    }
    expect(runFor(controller, 143, bmpStage(143), 14)).toBeCloseTo(11, 0);
  });

  it('resumes from the belt speed it was told to track during a manual override', () => {
    const controller = new AdaptiveTraining(8);
    runFor(controller, 120, bmpStage(150), 20); // pushing the speed up meanwhile
    controller.trackManualSpeed(11.3);
    expect(controller.update(120, bmpStage(150), 1000)).toBeCloseTo(11.3, 1);
  });

  it('stays within bounds', () => {
    expect(runFor(new AdaptiveTraining(17.9), 60, bmpStage(200), 60)).toBeLessThanOrEqual(18);
    expect(runFor(new AdaptiveTraining(1.2), 200, bmpStage(100), 60)).toBeGreaterThanOrEqual(1);
  });

  describe('resumeAt', () => {
    /** HR settles at 143 for 13 km/h and moves 9 bpm per km/h, with a 47 s time constant. */
    function runner(controller: AdaptiveTraining, startHr: number, startSpeed: number) {
      let hr = startHr;
      let speed = startSpeed;
      return {
        tick(stage = bmpStage(143, 30)) {
          hr += (143 + 9 * (speed - 13) - hr) / 47;
          speed = controller.update(Math.round(hr), stage, 1000);
          return { hr, speed };
        },
        rest(seconds: number) {
          for (let i = 0; i < seconds; i++) hr += (95 - hr) / 47; // no control steps while paused
        },
      };
    }

    it('does not speed up while heart rate climbs back after a pause', () => {
      const controller = new AdaptiveTraining(13);
      runFor(controller, 143, bmpStage(143), 60);
      controller.resumeAt(13);
      for (let i = 0; i < 60; i++) {
        expect(controller.update(Math.round(115 + i * 0.4), bmpStage(143), 1000)).toBeLessThanOrEqual(13);
      }
    });

    it('still slows down if heart rate comes back above the target', () => {
      const controller = new AdaptiveTraining(13);
      runFor(controller, 143, bmpStage(143), 60);
      controller.resumeAt(13);
      expect(runFor(controller, 160, bmpStage(143), 30)).toBeLessThan(12.5);
    });

    it('after a two-minute pause, holds the speed from before it while heart rate returns to target', () => {
      const controller = new AdaptiveTraining(13);
      const sim = runner(controller, 143, 13);
      for (let i = 0; i < 120; i++) sim.tick();
      sim.rest(120);
      controller.resumeAt(13);

      const after = Array.from({ length: 300 }, () => sim.tick());
      const speeds = after.map((p) => p.speed);
      expect(Math.max(...speeds)).toBeLessThanOrEqual(13.3 + 1e-9);
      expect(Math.min(...speeds)).toBeGreaterThanOrEqual(12.7 - 1e-9);
      expect(Math.abs(after[after.length - 1].hr - 143)).toBeLessThanOrEqual(3);
    });
  });

  describe('speedHint', () => {
    it('does not crash when explicitly passed speedHint: undefined (createSpeedController always forwards the key)', () => {
      const controller = new AdaptiveTraining(6, { speedHint: undefined });
      expect(() => runFor(controller, 120, bmpStage(150), 5)).not.toThrow();
    });

    it('ramps toward 90% of the hint on the first stage, at the slew limit, instead of starting cold', () => {
      const hint = 14;
      const controller = new AdaptiveTraining(4, { speedHint: () => hint });
      const stage = bmpStage(200); // far above any speed reached here, so PI only ever pushes up too
      let reachedTick: number | undefined;
      for (let i = 0; i < 60 && reachedTick === undefined; i++) {
        const speed = controller.update(60, stage, 1000);
        if (speed >= hint * 0.9 - 1e-9) reachedTick = i;
      }
      // 4 -> 12.6 km/h at the 0.3 km/h/s slew limit takes ~29 ticks — far sooner than plain PI
      // feedback would get there from a cold 4 km/h start with heart rate still at 60.
      expect(reachedTick).toBeLessThanOrEqual(30);
    });

    it('ramps down to the hint when it is below the current speed, no 0.9 undershoot margin', () => {
      const controller = new AdaptiveTraining(14, { speedHint: () => 10 });
      const stage = bmpStage(80); // far below, so PI's own pressure (once the ramp hands over) is downward too
      // 14 -> 10 km/h at the 0.3 km/h/s slew limit lands exactly on tick 14 (13 full 0.3 steps +
      // one 0.1 remainder) — the returned (quantized, hysteresis-gated) speed can lag the internal
      // one by up to one 0.1 km/h step right at that landing tick, hence precision 0 below.
      let speed = NaN;
      for (let i = 0; i < 14; i++) speed = controller.update(200, stage, 1000);
      expect(speed).toBeCloseTo(10, 0);
    });

    it('never slows the belt on a step up when 90% of the hint is below the current speed', () => {
      const controller = new AdaptiveTraining(14.2, { speedHint: () => 15 });
      runFor(controller, 147, bmpStage(147), 30);
      const start = controller.update(147, bmpStage(147), 1000);
      for (let i = 0; i < 20; i++) {
        expect(controller.update(147, bmpStage(168), 1000)).toBeGreaterThanOrEqual(start);
      }
    });

    it('does not ramp down on the first stage when 90% of the hint is below the current speed', () => {
      const controller = new AdaptiveTraining(14.2, { speedHint: () => 15 });
      expect(controller.update(100, bmpStage(180), 1000)).toBeGreaterThanOrEqual(14.2);
    });

    it('lets a hint push a step further in its direction, but never hold it back', () => {
      const run = (hint: number, from: number, to: number) => {
        // Only for the new target, so both runs reach the step at the same speed.
        const controller = new AdaptiveTraining(14, {
          speedHint: (bmp) => (bmp === to ? hint : undefined),
        });
        runFor(controller, from, bmpStage(from), 30);
        return runFor(controller, from, bmpStage(to), 25);
      };
      const noHint = (from: number, to: number) => {
        const controller = new AdaptiveTraining(14);
        runFor(controller, from, bmpStage(from), 30);
        return runFor(controller, from, bmpStage(to), 25);
      };
      expect(run(18, 150, 170)).toBeGreaterThan(noHint(150, 170)); // hint further up
      expect(run(12, 150, 170)).toBeCloseTo(noHint(150, 170), 5); // hint below: ignored
      expect(run(7, 170, 150)).toBeLessThan(noHint(170, 150)); // hint further down
      expect(run(16, 170, 150)).toBeCloseTo(noHint(170, 150), 5); // hint above: ignored
    });

    it('a manual override interrupts the ramp — the belt does not jump toward a stale hint afterward', () => {
      const controller = new AdaptiveTraining(4, { speedHint: () => 16 });
      runFor(controller, 60, bmpStage(200), 3); // still ramping, well short of the hint (14.4)
      controller.trackManualSpeed(9);
      // One ordinary slew-limited PI step from the resumed speed (heart rate is still far below
      // target, so PI itself also pushes up) — not a jump toward the abandoned ramp target.
      expect(controller.update(60, bmpStage(200), 1000)).toBeCloseTo(9.3, 5);
    });

    it('with no hint for this bpm, behaves exactly as without the option (falls back to hrPerKmh feedforward)', () => {
      const withHint = new AdaptiveTraining(8, { speedHint: (bmp) => (bmp === 999 ? 12 : undefined) });
      const withoutHint = new AdaptiveTraining(8);
      const stage = bmpStage(168);
      expect(runFor(withHint, 150, stage, 5)).toBeCloseTo(runFor(withoutHint, 150, stage, 5), 5);
    });

    it('reaches a slow responder’s target noticeably sooner than without a hint, and does not add overshoot', () => {
      const stages = calculateStages([{ times: 1, stages: [bmpStage(143, 30)] }]);
      // Matches the sluggish real-world response (~4.5 bpm/km-h, ~70s time constant, ~15s dead
      // time) found by fitting AdaptiveTraining.ts's model against a run where reaching target
      // took far longer than expected — see the plan this shipped with.
      const slowModel = { hrPerKmh: 4.5, timeConstantS: 70, sensorDelayS: 15 };
      const withoutHint = simulateRun(new AdaptiveTraining(4), stages, slowModel);
      const withHint = simulateRun(new AdaptiveTraining(4, { speedHint: () => 14 }), stages, slowModel);

      const reachTick = (points: SimulationPoint[]) =>
        points.findIndex((p) => p.targetHr !== null && Math.abs(p.hr - p.targetHr) <= 5);
      const maxOvershoot = (points: SimulationPoint[]) =>
        Math.max(...points.filter((p) => p.targetHr !== null).map((p) => p.hr - (p.targetHr as number)));

      const tWithout = reachTick(withoutHint);
      const tWith = reachTick(withHint);
      expect(tWith).toBeGreaterThan(0);
      expect(tWith).toBeLessThan(tWithout - 30);
      expect(maxOvershoot(withHint)).toBeLessThanOrEqual(maxOvershoot(withoutHint) + 2);
    });
  });
});

describe('stage transitions on a runner fitted to a real 143/168/143 run', () => {
  /** Time constant and dead time fitted to that run's open-loop steps; noise-free for stable bounds. */
  const response = { timeConstantS: 47, sensorDelayS: 5, noiseBpm: 0 };

  function secondsToReach(
    startSpeed: number,
    fromBpm: number,
    toBpm: number,
    model: { restingHr: number; hrPerKmh: number },
    speedHint?: () => number
  ) {
    const controller = new AdaptiveTraining(startSpeed, { speedHint });
    const stages = calculateStages([
      { times: 1, stages: [bmpStage(fromBpm, 15), bmpStage(toBpm, 10)] },
    ]);
    // Settle on the first target at the speed that holds it, then measure from the target change.
    const points = simulateRun(controller, stages, { ...model, ...response }, startSpeed);
    const stageChange = 15 * 60;
    const after = points.slice(stageChange);
    const within = (band: number) =>
      after.findIndex((p) => Math.abs(p.hr - toBpm) <= band);
    const direction = Math.sign(toBpm - fromBpm);
    const overshoot = Math.max(...after.map((p) => (p.hr - toBpm) * direction));
    return { within5: within(5), within3: within(3), overshoot };
  }

  const stepUp = { restingHr: 15.8, hrPerKmh: 8.85 }; // 145 bpm at 14.6 km/h, 168 at ~17.2
  const stepDown = { restingHr: 85.3, hrPerKmh: 5.25 }; // 143 bpm at 11 km/h, 164 at 15

  it('reaches a higher target within about a minute and a half, with little overshoot', () => {
    const { within5, within3, overshoot } = secondsToReach(14.6, 145, 168, stepUp, () => 15);
    expect(within5).toBeGreaterThanOrEqual(0);
    expect(within5).toBeLessThanOrEqual(90);
    expect(within3).toBeLessThanOrEqual(110);
    expect(overshoot).toBeLessThanOrEqual(4);
  });

  it('reaches a lower target within about a minute and a half, with little undershoot', () => {
    const { within5, within3, overshoot } = secondsToReach(15, 164, 143, stepDown, () => 15);
    expect(within5).toBeGreaterThanOrEqual(0);
    expect(within5).toBeLessThanOrEqual(90);
    expect(within3).toBeLessThanOrEqual(110);
    expect(overshoot).toBeLessThanOrEqual(4);
  });
});

describe('closed-loop comparison on the simulated runner', () => {
  const program: MultiplyStage[] = [
    { times: 1, stages: [bmpStage(135, 10)] },
    { times: 2, stages: [bmpStage(165, 4), bmpStage(140, 3)] },
    { times: 1, stages: [bmpStage(150, 10)] },
  ];

  it.each([7, 42, 1234])('adaptive tracks the target far more closely than legacy (seed %i)', (seed) => {
    const stages = calculateStages(program);
    const legacy = summarizeSimulation(simulateRun(new Training(4), stages, { seed }));
    const adaptive = summarizeSimulation(simulateRun(new AdaptiveTraining(4), stages, { seed }));

    expect(adaptive.pctInTarget).toBeGreaterThanOrEqual(80);
    expect(adaptive.pctInTarget).toBeGreaterThan(legacy.pctInTarget + 20);
    expect(adaptive.meanAbsErrorBpm).toBeLessThan(legacy.meanAbsErrorBpm);
    expect(adaptive.speedChanges).toBeLessThan(legacy.speedChanges);
  });

  it('stays usable when the runner responds differently than the controller assumes', () => {
    const stages = calculateStages(program);
    for (const hrPerKmh of [6, 12]) {
      const adaptive = summarizeSimulation(simulateRun(new AdaptiveTraining(4), stages, { hrPerKmh }));
      expect(adaptive.pctInTarget).toBeGreaterThanOrEqual(60);
    }
  });
});
