import { Timespan } from '../services/Timespan';
import calculateStages, { MultiplyStage, StageResult } from '../services/stagesCalculator';
import { atom } from 'jotai';
import type { SpeedControllerKind } from '../training/SpeedController';

export interface TreadmillOptions {
  speed: number;
  incline: number;
  isCustomSpeedUsed: boolean;
  isManualSpeedActive: boolean;
}

export type RunningState =
  | { running: false }
  | {
      running: true;
      paused: boolean;
      pauseStartedDate?: Date;
      runningStartedDate: Date;
      runningTime: Timespan;
      treadmillOptions: TreadmillOptions;
    };

export const runningStateAtom = atom<RunningState>({ running: false });

export const isRunningAtom = atom((get) => {
  return get(runningStateAtom).running;
});

export const isPausedAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running && runningState.paused;
});

export const runningStartedDateAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running ? runningState.runningStartedDate : undefined;
});

export const runningTimeAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running ? runningState.runningTime : undefined;
});

export const activeProgramIdAtom = atom<string | null>(null);

export const programInternalAtom = atom<{ stages: MultiplyStage[]; cooldown: boolean }>({
  stages: [],
  cooldown: false,
});

export const programAtom = atom(
  (get) => get(programInternalAtom).stages,
  (get, set, update: MultiplyStage[] | ((prev: MultiplyStage[]) => MultiplyStage[])) => {
    const prev = get(programInternalAtom);
    const newStages = typeof update === 'function' ? update(prev.stages) : update;
    set(programInternalAtom, { ...prev, stages: newStages });
  }
);

export const programCooldownAtom = atom(
  (get) => get(programInternalAtom).cooldown,
  (get, set, update: boolean | ((prev: boolean) => boolean)) => {
    const prev = get(programInternalAtom);
    const newCooldown = typeof update === 'function' ? update(prev.cooldown) : update;
    set(programInternalAtom, { ...prev, cooldown: newCooldown });
  }
);

export const stagesAtom = atom<StageResult[]>((get) => {
  const program = get(programAtom);
  return calculateStages(program);
});

const currentStageInternalAtom = atom<(StageResult & { stageIndex: number }) | undefined>((get) => {
  const runningState = get(runningStateAtom);

  if (!runningState.running) {
    return undefined;
  }

  const stages = get(stagesAtom);

  // 1-based: this is a human-facing ordinal ("stage 1 of 4"), not a 0-based
  // array index into `stages` — see currentStageIndexAtom below and its use
  // in RunInfo.tsx's `${currentStageIndex}/${stages.length}` display.
  let i = 0;
  for (const stage of stages) {
    ++i;
    if (
      runningState.runningTime.totalMilliseconds >= stage.from.totalMilliseconds &&
      runningState.runningTime.totalMilliseconds < stage.to.totalMilliseconds
    ) {
      return { ...stage, stageIndex: i };
    }
  }
});

export const currentStageAtom = atom<StageResult | undefined>((get) => {
  return get(currentStageInternalAtom);
});

/**
 * 1-based ordinal of the current stage (1 = first stage), not a 0-based
 * array index — despite the name. Kept this way because its only consumers
 * (RunInfo.tsx's "N/total" progress display, and RunSession's telemetry/
 * stage-change tracking, which only needs a value that's stable within a
 * stage and changes between stages) both treat it as a display ordinal.
 * Renaming would mean either an off-by-one in the UI or a misleading name —
 * this comment is the cheaper fix.
 */
export const currentStageIndexAtom = atom<number | undefined>((get) => {
  return get(currentStageInternalAtom)?.stageIndex;
});

export const treadmillOptionsAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running ? runningState.treadmillOptions : undefined;
});

export const isManualSpeedActiveAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running ? runningState.treadmillOptions.isManualSpeedActive : false;
});

/** Which heart-rate speed controller the next run uses — read once, at RunSession.start(). */
export const speedControllerAtom = atom<SpeedControllerKind>('legacy');

/** Live treadmill speed reported by the device — updated from every btRunning event. */
export const actualTreadmillSpeedAtom = atom<number>(0);

export const heartRateAtom = atom<number>();
