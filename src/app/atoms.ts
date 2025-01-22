import { StageResult } from "@/services/stagesCalculator";
import { Timespan } from "@/services/Timespan";
import { atom } from "jotai";

export const runningStateAtom = atom<{
  running: false
} | {
  running: true,
  runningStartedDate: Date
  runningTime: Timespan
}>({ running: false })

export const isRunningAtom = atom(get => {
  return get(runningStateAtom).running
})

export const runningStartedDateAtom = atom(get => {
  const runningState = get(runningStateAtom)
  return runningState.running ? runningState.runningStartedDate : undefined
})

export const programAtom = atom<StageResult[]>([])

export const currentStageAtom = atom<StageResult | undefined>(get => {
  const runningState = get(runningStateAtom)

  if (!runningState.running) {
    return undefined
  }

  const program = get(programAtom)

  for (const stage of program) {
    if (
      runningState.runningTime.totalMilliseconds >= stage.from.totalMilliseconds &&
      runningState.runningTime.totalMilliseconds < stage.to.totalMilliseconds
    ) {
      return stage;
    }
  }
})