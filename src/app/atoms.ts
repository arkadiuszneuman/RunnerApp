import calculateStages, { MultiplyStage, Stage, StageResult } from "@/services/stagesCalculator";
import { Timespan } from "@/services/Timespan";
import { atom } from "jotai";

export const runningStateAtom = atom<{
  running: false
} | {
  running: true,
  runningStartedDate: Date
  runningTime: Timespan
  treadmillOptions: {
    speed: number,
    incline: number,
    isCustomSpeedUsed: boolean
  }
}>({ running: false })

export const isRunningAtom = atom(get => {
  return get(runningStateAtom).running
})

export const runningStartedDateAtom = atom(get => {
  const runningState = get(runningStateAtom)
  return runningState.running ? runningState.runningStartedDate : undefined
})

export const runningTimeAtom = atom(get => {
  const runningState = get(runningStateAtom)
  return runningState.running ? runningState.runningTime : undefined
})

export const programAtom = atom<(Stage | MultiplyStage)[]>([])

export const stagesAtom = atom<StageResult[]>(get => {
  const program = get(programAtom)
  return calculateStages(program)
})

const currentStageInternalAtom = atom<(StageResult & { stageIndex: number }) | undefined>(get => {
  const runningState = get(runningStateAtom)

  if (!runningState.running) {
    return undefined
  }

  const stages = get(stagesAtom)

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
})

export const currentStageAtom = atom<(StageResult) | undefined>(get => {
  return get(currentStageInternalAtom)
})

export const currentStageIndexAtom = atom<number | undefined>(get => {
  return get(currentStageInternalAtom)?.stageIndex
})

export const treadmillOptionsAtom = atom(get => {
  const runningState = get(runningStateAtom)
  return runningState.running ? runningState.treadmillOptions : undefined
})

export const heartRateAtom = atom<number>()