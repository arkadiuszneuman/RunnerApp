import { Timespan } from "./Timespan";
import _ from 'lodash'

export type Stage = ({
  time: Timespan;
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

function makeDivisibleBy15ByAddingRest(num: Timespan) {
  const millisecondsAs15Seconds = Timespan.fromSeconds(15).totalMilliseconds
  const remainder = num.totalMilliseconds % millisecondsAs15Seconds;
  // If the number is already divisible by 15, no addition is needed
  const toAdd = remainder === 0 ? 0 : millisecondsAs15Seconds - remainder;
  return new Timespan(num.totalMilliseconds + toAdd);
}

function makeDivisibleBy15BySubstractingRest(num: Timespan) {
  const millisecondsAs15Seconds = Timespan.fromSeconds(15).totalMilliseconds
  const remainder = num.totalMilliseconds % millisecondsAs15Seconds;
  return new Timespan(num.totalMilliseconds - remainder);
}

function flatStagesAndAddTimes(stages: (Stage | MultiplyStage)[]): FlattenedStage[] {
  let currentTime = new Timespan();
  const stagesWithOriginalTimes: FlattenedStage[] = stages.flatMap((stage) => {
    let oldCurrentTime = currentTime;

    if ('time' in stage) {
      oldCurrentTime = currentTime;
      currentTime = currentTime.add(stage.time);
      return { ...stage, originalFrom: oldCurrentTime, originalTo: currentTime, type: 'simple' }
    } else {
      const stagesToReturn: FlattenedStage[] = []
      for (let x = 0; x < stage.times; x++) {
        for (let i = 0; i < stage.stages.length; i++) {
          const subStage = stage.stages[i];
          oldCurrentTime = currentTime;

          if (x !== stage.times - 1 || i !== stage.stages.length - 1) {
            currentTime = currentTime.add(subStage.time);

            stagesToReturn.push({ ...subStage, originalFrom: oldCurrentTime, originalTo: currentTime, type: i % 2 === 0 ? 'sprint' : 'regeneration' })
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

  for (const stage of stagesWithOriginalTimes) {
    if (stage.type === 'sprint') {
      let newOriginalFrom = stage.originalFrom;
      let newOriginalTo = stage.originalTo;
      let newTime = stage.time

      if (stage.originalFrom.totalSeconds % 15 === 0) {
        newOriginalFrom = makeDivisibleBy15BySubstractingRest(stage.originalFrom.subtract(new Timespan(1)))
      } else {
        newOriginalFrom = makeDivisibleBy15BySubstractingRest(stage.originalFrom)
      }

      if (stage.originalTo.totalSeconds % 15 !== 0) {
        newOriginalTo = makeDivisibleBy15ByAddingRest(stage.originalTo)
      }

      newTime = newOriginalTo.subtract(newOriginalFrom)

      while (newTime.totalMinutes > 10) {
        resultStages.push({
          ...stage,
          from: newOriginalFrom,
          to: newOriginalFrom.add(Timespan.fromMinutes(10)),
          time: Timespan.fromMinutes(10)
        })

        newOriginalFrom = newOriginalFrom.add(Timespan.fromMinutes(10))
        newTime = newTime.subtract(Timespan.fromMinutes(10))
      }

      resultStages.push({
        ...stage,
        from: newOriginalFrom,
        to: newOriginalTo,
        time: newTime
      })
    } else {
      let newOriginalFrom = stage.originalFrom;
      let newOriginalTo = stage.originalTo;
      let newTime = stage.time

      if (stage.originalFrom.totalSeconds % 15 !== 0) {
        newOriginalFrom = makeDivisibleBy15ByAddingRest(stage.originalFrom)
      }

      if (_(stagesWithOriginalTimes).last() === stage) {
        if (stage.originalTo.totalSeconds % 15 !== 0) {
          newOriginalTo = makeDivisibleBy15ByAddingRest(stage.originalTo)
        }
      } else {
        if (stage.originalTo.totalSeconds % 15 === 0) {

          newOriginalTo = makeDivisibleBy15BySubstractingRest(stage.originalTo.subtract(new Timespan(1)))
        } else {
          newOriginalTo = makeDivisibleBy15BySubstractingRest(stage.originalTo)
        }
      }

      newTime = newOriginalTo.subtract(newOriginalFrom)

      while (newTime.totalMinutes > 10) {
        resultStages.push({
          ...stage,
          from: newOriginalFrom,
          to: newOriginalFrom.add(Timespan.fromMinutes(10)),
          time: Timespan.fromMinutes(10)
        })

        newOriginalFrom = newOriginalFrom.add(Timespan.fromMinutes(10))
        newTime = newTime.subtract(Timespan.fromMinutes(10))
      }

      resultStages.push({
        ...stage,
        from: newOriginalFrom,
        to: newOriginalTo,
        time: newTime
      })
    }
  }

  return resultStages;
}