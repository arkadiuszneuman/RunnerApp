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
  getItem(key: string, initialValue: { stages: (Stage | MultiplyStage)[]; cooldown: boolean }) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return initialValue;
    const stored = globalThis.localStorage.getItem(key);
    if (!stored) return initialValue;
    try {
      const parsed = JSON.parse(stored, Timespan.reviver);
      if (Array.isArray(parsed)) {
        return { stages: parsed, cooldown: false };
      }
      return parsed;
    } catch {
      return initialValue;
    }
  },
  setItem(key: string, value: { stages: (Stage | MultiplyStage)[]; cooldown: boolean }) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
    globalThis.localStorage.setItem(key, JSON.stringify(value));
  },
  removeItem(key: string) {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
    globalThis.localStorage.removeItem(key);
  },
};

const programInternalAtom = atomWithStorage<{ stages: MultiplyStage[]; cooldown: boolean }>(
  'programAtom',
  { stages: [], cooldown: false },
  programStorage
);

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

export const heartRateAtom = atom<number>();
