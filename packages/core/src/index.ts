export { Timespan } from './services/Timespan';

export { default as calculateStages } from './services/stagesCalculator';
export type { Stage, MultiplyStage, StageType, StageResult } from './services/stagesCalculator';

export { calculateSpeedByHeartRate, calculateSpeedByTempo } from './services/speedCalculator';

export { parseProgram } from './services/programTextParser';

export { analyzeRun, toSeries } from './services/runAnalysis';
export type {
  RunRecord,
  RunProgramSnapshot,
  RunSummary,
  StageSummary,
  HrTargetStats,
  HrBucket,
  RunSeriesPoint,
} from './services/runAnalysis';

export {
  WARMUP_BPM,
  COOLDOWN_BPM,
  REGENERATION_BPM,
  WARMUP_DURATION,
  COOLDOWN_DURATION,
  REGENERATION_DURATION,
} from './services/trainingDefaults';

export { default as Training } from './training/Training';
export { default as AdaptiveTraining, type AdaptiveTrainingOptions } from './training/AdaptiveTraining';
export {
  createSpeedController,
  SPEED_CONTROLLER_KINDS,
  type SpeedController,
  type SpeedControllerFactoryOptions,
  type SpeedControllerKind,
} from './training/SpeedController';
export {
  defaultHeartRateModel,
  simulateRun,
  summarizeSimulation,
  type HeartRateModel,
  type SimulationPoint,
  type SimulationSummary,
} from './training/heartRateSimulation';
export {
  EMPTY_SPEED_CALIBRATION,
  learnSpeedCalibration,
  MAX_BPM,
  MAX_CALIBRATION_POINTS,
  MAX_SPEED_KMH,
  MIN_BPM,
  MIN_SPEED_KMH,
  mergeSpeedCalibrations,
  parseSpeedCalibration,
  speedCalibrationsEqual,
  speedHintFor,
  type SpeedCalibration,
  type SpeedCalibrationPoint,
} from './training/speedCalibration';

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
  speedControllerAtom,
} from './state/atoms';
export type { RunningState, TreadmillOptions } from './state/atoms';

export { default as useInterval } from './hooks/useInterval';

export type { TelemetryPoint } from './types/telemetry';

export * from './ble';
export * from './session';
export * from './sync';

export {
  formatDigits,
  digitsToTimespan,
  timespanToDigits,
  type DurationFields,
} from './duration/durationInput';
