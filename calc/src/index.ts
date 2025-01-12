import calculateStages, { MultiplyStage, Stage } from "./stagesCalculator";
import { Timespan } from "./Timespan";

const stages = [
  { time: Timespan.fromMinutes(15), bmp: 145 },
  {
    times: 7, stages: [
      {
        time: Timespan.fromSeconds(40), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40))
      },
      {
        time: Timespan.fromMinutes(3), bmp: 132
      }
    ]
  },
  { time: Timespan.fromMinutes(10), bmp: 145 },
] satisfies (Stage | MultiplyStage)[];

const result = calculateStages(stages)

console.table(result)