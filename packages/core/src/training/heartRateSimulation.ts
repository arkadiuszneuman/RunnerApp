import type { StageResult } from '../services/stagesCalculator';
import type { SpeedController } from './SpeedController';

/**
 * A deliberately simple closed-loop model of a runner on a treadmill, used by
 * the controller tests and the /pid-simulator dev page to compare speed
 * controllers exactly the way RunSession drives them (1 Hz, deltaTime in ms).
 *
 * Steady-state HR = restingHr + hrPerKmh × speed, approached through a
 * first-order lag, plus slow cardiac drift at running speeds, a sensor dead
 * time, and seeded noise on the integer reading a strap or watch reports.
 */
export interface HeartRateModel {
  restingHr: number;
  hrPerKmh: number;
  timeConstantS: number;
  sensorDelayS: number;
  noiseBpm: number;
  /** Positive integer; the same seed replays the same noise. */
  seed: number;
}

export const defaultHeartRateModel: HeartRateModel = {
  restingHr: 60,
  hrPerKmh: 9,
  timeConstantS: 35,
  sensorDelayS: 8,
  noiseBpm: 2,
  seed: 7,
};

export interface SimulationPoint {
  t: number;
  /** null during tempo stages */
  targetHr: number | null;
  hr: number;
  speed: number;
}

export interface SimulationSummary {
  /** % of settled HR-targeted seconds within ±5 bpm of target. */
  pctInTarget: number;
  meanAbsErrorBpm: number;
  /** How many times the commanded speed changed. */
  speedChanges: number;
}

export function simulateRun(
  controller: SpeedController,
  stages: StageResult[],
  model: Partial<HeartRateModel> = {},
  startSpeed = 4
): SimulationPoint[] {
  const m = { ...defaultHeartRateModel, ...model };
  let seed = Math.max(1, Math.floor(m.seed));
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 2 * m.noiseBpm;
  };

  const endS = stages[stages.length - 1]?.to.totalSeconds ?? 0;
  const sensorBuffer: number[] = [];
  let trueHr = 70;
  let drift = 0;
  let speed = startSpeed;
  const points: SimulationPoint[] = [];

  for (let t = 0; t < endS; t++) {
    const stage = stages.find((s) => t >= s.from.totalSeconds && t < s.to.totalSeconds);
    if (!stage) break;

    trueHr += (m.restingHr + m.hrPerKmh * speed - trueHr) / m.timeConstantS;
    drift = Math.min(12, Math.max(0, drift + (speed > 8 ? 0.012 : -0.01)));
    sensorBuffer.push(trueHr + drift);
    const sensed = sensorBuffer.length > m.sensorDelayS ? (sensorBuffer.shift() as number) : sensorBuffer[0];
    const hr = Math.round(sensed + noise());

    // A fresh object per tick, like currentStageAtom hands RunSession.
    speed = controller.update(hr, { ...stage }, 1000);
    points.push({ t, targetHr: stage.speedType === 'bmp' ? stage.bmp : null, hr, speed });
  }

  return points;
}

/** Stats over HR-targeted time, ignoring the first `settleS` seconds after each target change. */
export function summarizeSimulation(points: SimulationPoint[], settleS = 90): SimulationSummary {
  let counted = 0;
  let inTarget = 0;
  let absError = 0;
  let speedChanges = 0;
  let sinceTargetChange = 0;

  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev && p.speed !== prev.speed) speedChanges++;
    sinceTargetChange = prev && prev.targetHr === p.targetHr ? sinceTargetChange + 1 : 0;
    if (p.targetHr === null || sinceTargetChange < settleS) return;
    counted++;
    const deviation = Math.abs(p.hr - p.targetHr);
    absError += deviation;
    if (deviation <= 5) inTarget++;
  });

  return {
    pctInTarget: counted ? (inTarget / counted) * 100 : 0,
    meanAbsErrorBpm: counted ? absError / counted : 0,
    speedChanges,
  };
}
