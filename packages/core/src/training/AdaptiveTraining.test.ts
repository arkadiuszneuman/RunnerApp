import { describe, expect, it } from 'vitest';
import calculateStages, { type MultiplyStage, type Stage } from '../services/stagesCalculator';
import { Timespan } from '../services/Timespan';
import AdaptiveTraining from './AdaptiveTraining';
import { simulateRun, summarizeSimulation } from './heartRateSimulation';
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
