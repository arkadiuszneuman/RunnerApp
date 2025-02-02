import { Timespan } from "./Timespan";

export type Stage = ({
  duration: Timespan;
  type: StageType;
}) & ({
  bmp: number;
} | {
  tempo: Timespan;
})

export type MultiplyStage = {
  times: number,
  stages: Stage[]
}

export type StageType = 'simple' | 'sprint' | 'regeneration'
type FlattenedStage = Stage & { originalFrom: Timespan, originalTo: Timespan }
export type StageResult = Stage & {
  from: Timespan,
  to: Timespan
}

function flatStagesAndAddTimes(stages: (Stage | MultiplyStage)[]): FlattenedStage[] {
  let currentTime = new Timespan();
  const stagesWithOriginalTimes: FlattenedStage[] = stages.flatMap((stage) => {
    let oldCurrentTime = currentTime;

    if ('duration' in stage) {
      oldCurrentTime = currentTime;
      currentTime = currentTime.add(stage.duration);
      return { ...stage, originalFrom: oldCurrentTime, originalTo: currentTime }
    } else {
      const stagesToReturn: FlattenedStage[] = []
      for (let x = 0; x < stage.times; x++) {
        for (let i = 0; i < stage.stages.length; i++) {
          const subStage = stage.stages[i];
          oldCurrentTime = currentTime;

          if (stage.times === 1 || x !== stage.times - 1 || i !== stage.stages.length - 1) {
            currentTime = currentTime.add(subStage.duration);

            stagesToReturn.push({ ...subStage, originalFrom: oldCurrentTime, originalTo: currentTime })
          }

        }
      }
      return stagesToReturn
    }
  })

  return stagesWithOriginalTimes
}

export default function calculateStages(stages: (Stage | MultiplyStage)[]) {
  const stagesWithOriginalTimes = flatStagesAndAddTimes(stages)

  const resultStages: StageResult[] = [];

  for (let i = 0; i < stagesWithOriginalTimes.length; i++) {
    const stage = stagesWithOriginalTimes[i];

    if (stage.type === 'sprint') {
      const newOriginalFromTimespan = i == 0 ? stage.originalFrom : stage.originalFrom.subtract(Timespan.fromSeconds(10));
      const newOriginalFrom = new Timespan(Math.max(0, newOriginalFromTimespan.totalMilliseconds));
      const newOriginalTo = stage.originalTo;
      const newTime = newOriginalTo.subtract(newOriginalFrom)

      resultStages.push({
        ...stage,
        from: newOriginalFrom,
        to: newOriginalTo,
        duration: newTime
      })
    } else {
      const isNextSegmentSprint = stagesWithOriginalTimes.length - 1 === i ? false : stagesWithOriginalTimes[i + 1].type === 'sprint'
      const newOriginalFrom = stage.originalFrom;
      const newOriginalToTimespan = isNextSegmentSprint ? stage.originalTo.subtract(Timespan.fromSeconds(10)) : stage.originalTo
      const newOriginalTo = new Timespan(Math.max(0, newOriginalToTimespan.totalMilliseconds));
      const newTime = newOriginalTo.subtract(newOriginalFrom)

      resultStages.push({
        ...stage,
        from: newOriginalFrom,
        to: newOriginalTo,
        duration: newTime
      })
    }
  }

  for (const stage of resultStages) {
    const realStage = stage as { originalFrom?: Date, originalTo?: Date }
    delete realStage.originalFrom
    delete realStage.originalTo
  }
  return resultStages;
}