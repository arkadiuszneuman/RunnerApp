import calculateStages, { MultiplyStage, Stage } from './stagesCalculator';
import { Timespan } from './Timespan';

describe('calculateStages', () => {
  it('should handle empty array of stages', () => {
    expect(calculateStages([])).toStrictEqual([]);
  });

  it('should calculate total seconds when given stages with minutes', () => {
    const stages = [
      { time: Timespan.fromMinutes(15), bmp: 145 },
      {
        times: 2, stages: [
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

    expect(result.map(({ originalFrom, originalTo, type, ...rest }) => rest)).toStrictEqual([
      { time: Timespan.fromMinutes(10), bmp: 145 },
      { time: Timespan.fromMinutes(4).add(Timespan.fromSeconds(45)), bmp: 145 },

      { time: Timespan.fromSeconds(60), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)) },
      { time: Timespan.fromMinutes(2).add(Timespan.fromSeconds(45)), bmp: 132 },

      { time: Timespan.fromSeconds(60), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)) },

      { time: Timespan.fromMinutes(10), bmp: 145 },
    ]);
  });
});