export { Timespan } from './services/Timespan';

export { default as calculateStages } from './services/stagesCalculator';
export type { Stage, MultiplyStage, StageType, StageResult } from './services/stagesCalculator';

export { calculateSpeedByHeartRate, calculateSpeedByTempo } from './services/speedCalculator';

export { parseProgram } from './services/programTextParser';

export {
  WARMUP_BPM,
  COOLDOWN_BPM,
  REGENERATION_BPM,
  WARMUP_DURATION,
  COOLDOWN_DURATION,
  REGENERATION_DURATION,
} from './services/trainingDefaults';

export { default as Training } from './training/Training';

export {
  runningStateAtom,
  isRunningAtom,
  isPausedAtom,
  runningStartedDateAtom,
  runningTimeAtom,
  activeProgramIdAtom,
  programInternalAtom,
  programAtom,
  programCooldownAtom,
  stagesAtom,
  currentStageAtom,
  currentStageIndexAtom,
  treadmillOptionsAtom,
  isManualSpeedActiveAtom,
  actualTreadmillSpeedAtom,
  heartRateAtom,
} from './state/atoms';
export type { RunningState, TreadmillOptions } from './state/atoms';

export { default as useInterval } from './hooks/useInterval';

export type { TelemetryPoint } from './types/telemetry';

export * from './ble';
export * from './session';
