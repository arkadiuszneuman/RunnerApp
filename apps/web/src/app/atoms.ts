import { Timespan } from '@/services/Timespan';
import calculateStages, { MultiplyStage, StageResult } from '@/services/stagesCalculator';
import { atom } from 'jotai';

export const runningStateAtom = atom<
  | {
    running: false;
  }
  | {
    running: true;
    paused: boolean;
    pauseStartedDate?: Date;
    runningStartedDate: Date;
    runningTime: Timespan;
    treadmillOptions: {
      speed: number;
      incline: number;
      isCustomSpeedUsed: boolean;
      isManualSpeedActive: boolean;
    };
  }
>({ running: false });

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

/** Live treadmill speed reported by the device — updated from every btRunning event. */
export const actualTreadmillSpeedAtom = atom<number>(0);

export const heartRateAtom = atom<number>();
