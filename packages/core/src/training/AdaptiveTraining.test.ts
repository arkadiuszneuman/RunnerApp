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

  it('jumps most of the model-predicted speed difference when the target steps up', () => {
    const controller = new AdaptiveTraining(8);
    const before = runFor(controller, 150, bmpStage(150), 30);
    const after = controller.update(150, bmpStage(168), 1000);
    expect(after).toBeGreaterThan(before + 1.4); // 18 bpm / 9 bpm per km/h × 0.8
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
