import { Timespan } from '@/services/Timespan';
import calculateStages, { MultiplyStage, Stage, StageResult } from '@/services/stagesCalculator';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export const runningStateAtom = atom<
  | {
      running: false;
    }
  | {
      running: true;
      runningStartedDate: Date;
      runningTime: Timespan;
      treadmillOptions: {
        speed: number;
        incline: number;
        isCustomSpeedUsed: boolean;
      };
    }
>({ running: false });

export const isRunningAtom = atom((get) => {
  return get(runningStateAtom).running;
});

export const runningStartedDateAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running ? runningState.runningStartedDate : undefined;
});

export const runningTimeAtom = atom((get) => {
  const runningState = get(runningStateAtom);
  return runningState.running ? runningState.runningTime : undefined;
});

// Custom storage to handle Timespan deserialization
const programStorage = {
  getItem(key: string, initialValue: (Stage | MultiplyStage)[]) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return initialValue;
    const stored = globalThis.localStorage.getItem(key);
    if (!stored) return initialValue;
    try {
      return JSON.parse(stored, Timespan.reviver);
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: (Stage | MultiplyStage)[]) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
    globalThis.localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem(key: string) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
    globalThis.localStorage.removeItem(key);
  },
};

export const programAtom = atomWithStorage<MultiplyStage[]>('programAtom', [], programStorage);

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

export const heartRateAtom = atom<number>();
