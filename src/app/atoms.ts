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
    incline: number
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

export const currentStageAtom = atom<StageResult | undefined>(get => {
  const runningState = get(runningStateAtom)

  if (!runningState.running) {
    return undefined
  }

  const stages = get(stagesAtom)

  for (const stage of stages) {
    if (
      runningState.runningTime.totalMilliseconds >= stage.from.totalMilliseconds &&
      runningState.runningTime.totalMilliseconds < stage.to.totalMilliseconds
    ) {
      return stage;
    }
  }
})

export const treadmillOptionsAtom = atom(get => {
  const runningState = get(runningStateAtom)
  return runningState.running ? runningState.treadmillOptions : undefined
})

export const heartRateAtom = atom<number>()